/**
 * Claude Usage Monitor - OAuth API Usage Provider
 *
 * Directly interfaces with Anthropic's subscription rate-limiting endpoints:
 * - GET https://api.anthropic.com/api/oauth/usage
 * - Headers: anthropic-ratelimit-unified-*
 *
 * Utilizes the official sliding usage windows:
 * - 5-Hour window (five_hour)
 * - 7-Day window (seven_day / weekly)
 */
import * as https from 'https';
import { IClaudeUsageProvider } from './types';
import { AuthService } from '../services/authService';
import {
  ClaudeUsageSnapshot,
  UsageWindow,
  calculatePercentages,
  evaluateUsageStatus,
  parseResetDate,
  formatResetTime,
  formatDurationUntil,
  ExtraUsageInfo,
} from '../models/usage';

export class OAuthApiUsageProvider implements IClaudeUsageProvider {
  public readonly id = 'anthropic-oauth-api';
  public readonly displayName = 'Claude Subscription Usage API';

  private static readonly PRIMARY_URL = 'https://api.anthropic.com/api/oauth/usage';
  private static readonly FALLBACK_URL = 'https://claude.ai/api/oauth/usage';

  constructor(
    private readonly authService: AuthService,
    private readonly getThresholds: () => { warning: number; critical: number }
  ) {}

  public async isAvailable(): Promise<boolean> {
    const creds = await this.authService.getActiveToken();
    return Boolean(creds.token && !creds.isExpired);
  }

  public async fetchUsage(): Promise<ClaudeUsageSnapshot> {
    const creds = await this.authService.getActiveToken();

    if (!creds.token) {
      return this.createUnauthenticatedSnapshot('No Claude authentication found. Please sign in or configure your token.');
    }

    if (creds.isExpired) {
      return this.createUnauthenticatedSnapshot('Claude authentication token has expired. Please re-authenticate.');
    }

    try {
      // First attempt primary Anthropic API
      const result = await this.performHttpRequest(OAuthApiUsageProvider.PRIMARY_URL, creds.token);
      return this.parseResponse(result, creds);
    } catch (primaryErr) {
      const errMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);

      // If network error, attempt fallback endpoint
      if (errMsg.includes('404') || errMsg.includes('ENOTFOUND') || errMsg.includes('fallback')) {
        try {
          const fallbackResult = await this.performHttpRequest(OAuthApiUsageProvider.FALLBACK_URL, creds.token);
          return this.parseResponse(fallbackResult, creds);
        } catch {
          // If fallback fails too, rethrow original error
        }
      }

      throw primaryErr;
    }
  }

  /**
   * Executes HTTP request with timeout and error handling.
   */
  private performHttpRequest(
    urlString: string,
    token: string
  ): Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlString);

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'claude-usage-monitor/1.0.0 (VS Code Extension)',
          Accept: 'application/json',
          'anthropic-beta': 'claude-code-20250219',
        },
        timeout: 10000, // 10-second timeout
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const statusCode = res.statusCode || 0;
          if (statusCode >= 200 && statusCode < 300) {
            resolve({
              statusCode,
              headers: res.headers,
              body: data,
            });
          } else if (statusCode === 401) {
            reject(new Error('Authentication failed (401 Unauthorized): The Claude token is invalid or expired.'));
          } else if (statusCode === 403) {
            reject(new Error('Access forbidden (403): Your account does not have access to this usage endpoint.'));
          } else if (statusCode === 429) {
            reject(new Error('Rate limited (429): Too many usage requests to Anthropic servers.'));
          } else {
            reject(new Error(`Server responded with status code ${statusCode}: ${data.slice(0, 150)}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out while connecting to Claude usage servers.'));
      });

      req.on('error', (err) => {
        reject(new Error(`Network error connecting to Claude API: ${err.message}`));
      });

      req.end();
    });
  }

  /**
   * Parses the JSON payload and rate limit headers into a strongly-typed snapshot.
   */
  private parseResponse(
    response: { statusCode: number; headers: Record<string, string | string[] | undefined>; body: string },
    creds: Awaited<ReturnType<AuthService['getActiveToken']>>
  ): ClaudeUsageSnapshot {
    let json: any = {};
    if (response.body && response.body.trim().length > 0) {
      try {
        json = JSON.parse(response.body);
      } catch (e) {
        throw new Error('Received non-JSON response from Claude usage endpoint.');
      }
    }

    const { warning, critical } = this.getThresholds();
    const headers = response.headers;

    // 1. Parse 5-hour window from body or headers
    let fiveHourRaw = json.five_hour?.utilization;
    let fiveHourResetRaw = json.five_hour?.resets_at;

    // Check headers if body didn't contain five_hour
    if (fiveHourRaw === undefined && headers['anthropic-ratelimit-unified-5h-utilization']) {
      fiveHourRaw = parseFloat(String(headers['anthropic-ratelimit-unified-5h-utilization']));
    }
    if (!fiveHourResetRaw && headers['anthropic-ratelimit-unified-5h-reset']) {
      fiveHourResetRaw = String(headers['anthropic-ratelimit-unified-5h-reset']);
    }

    let fiveHourWindow: UsageWindow | null = null;
    if (fiveHourRaw !== undefined && fiveHourRaw !== null) {
      const { usedPercentage, remainingPercentage } = calculatePercentages(fiveHourRaw);
      const resetsAt = parseResetDate(fiveHourResetRaw);
      fiveHourWindow = {
        rawUtilization: fiveHourRaw,
        usedPercentage,
        remainingPercentage,
        resetsAt,
        resetTimeFormatted: formatResetTime(resetsAt),
        timeUntilReset: formatDurationUntil(resetsAt),
        status: evaluateUsageStatus(remainingPercentage, warning, critical),
      };
    }

    // 2. Parse Weekly (7-day) window from body or headers
    let weeklyRaw = json.seven_day?.utilization;
    let weeklyResetRaw = json.seven_day?.resets_at;

    // Check headers if body didn't contain seven_day
    if (weeklyRaw === undefined && headers['anthropic-ratelimit-unified-7d-utilization']) {
      weeklyRaw = parseFloat(String(headers['anthropic-ratelimit-unified-7d-utilization']));
    }
    if (!weeklyResetRaw && headers['anthropic-ratelimit-unified-7d-reset']) {
      weeklyResetRaw = String(headers['anthropic-ratelimit-unified-7d-reset']);
    }

    // Also check limits array if weekly was not at top level
    if (weeklyRaw === undefined && Array.isArray(json.limits)) {
      const weeklyLimit = json.limits.find(
        (l: any) => l.kind === 'weekly_scoped' || l.group === 'weekly' || l.group === 'seven_day'
      );
      if (weeklyLimit) {
        weeklyRaw = weeklyLimit.percent ?? weeklyLimit.utilization;
        weeklyResetRaw = weeklyResetRaw || weeklyLimit.resets_at;
      }
    }

    let weeklyWindow: UsageWindow | null = null;
    if (weeklyRaw !== undefined && weeklyRaw !== null) {
      const { usedPercentage, remainingPercentage } = calculatePercentages(weeklyRaw);
      const resetsAt = parseResetDate(weeklyResetRaw);
      weeklyWindow = {
        rawUtilization: weeklyRaw,
        usedPercentage,
        remainingPercentage,
        resetsAt,
        resetTimeFormatted: formatResetTime(resetsAt),
        timeUntilReset: formatDurationUntil(resetsAt),
        status: evaluateUsageStatus(remainingPercentage, warning, critical),
      };
    }

    // 3. Parse Extra Usage / Spend overage if present
    let extraUsage: ExtraUsageInfo | null = null;
    if (json.extra_usage && typeof json.extra_usage === 'object') {
      const eu = json.extra_usage;
      extraUsage = {
        isEnabled: Boolean(eu.is_enabled),
        monthlyLimitCents: Number(eu.monthly_limit || 0),
        usedCreditsCents: Number(eu.used_credits || 0),
        utilizationPercentage: Number(eu.utilization || 0),
        currency: String(eu.currency || 'USD'),
      };
    }

    return {
      timestamp: new Date(),
      fiveHour: fiveHourWindow,
      weekly: weeklyWindow,
      extraUsage,
      subscriptionType: creds.subscriptionType || json.subscription_type || null,
      rateLimitTier: creds.rateLimitTier || json.rate_limit_tier || null,
      auth: {
        isAuthenticated: true,
        authMethod: creds.authMethod,
        accountEmail: creds.accountEmail,
        organizationUuid: creds.organizationUuid,
        subscriptionType: creds.subscriptionType || json.subscription_type || null,
        rateLimitTier: creds.rateLimitTier || json.rate_limit_tier || null,
        details: creds.sourceDescription,
        isExpired: false,
        expiresAt: creds.expiresAt,
      },
      isCached: false,
      isStale: false,
      providerName: this.displayName,
    };
  }

  private createUnauthenticatedSnapshot(reason: string): ClaudeUsageSnapshot {
    return {
      timestamp: new Date(),
      fiveHour: null,
      weekly: null,
      extraUsage: null,
      subscriptionType: null,
      rateLimitTier: null,
      auth: {
        isAuthenticated: false,
        authMethod: 'none',
        details: reason,
      },
      isCached: false,
      isStale: false,
      errorMessage: reason,
      providerName: this.displayName,
    };
  }
}
