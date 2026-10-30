/**
 * Claude Usage Monitor - Composite Claude Usage Provider
 *
 * Coordinates between available integration strategies:
 * 1. Primary: OAuthApiUsageProvider (direct Anthropic subscription usage API)
 * 2. Diagnostic fallback: CliUsageProvider (inspects Claude Code installation and status)
 */
import { IClaudeUsageProvider } from './types';
import { OAuthApiUsageProvider } from './oauthApiUsageProvider';
import { CliUsageProvider } from './cliUsageProvider';
import { AuthService } from '../services/authService';
import { ClaudeUsageSnapshot } from '../models/usage';

export class ClaudeUsageProvider implements IClaudeUsageProvider {
  public readonly id = 'claude-composite-provider';
  public readonly displayName = 'Claude Usage Provider';

  private readonly oauthProvider: OAuthApiUsageProvider;
  private readonly cliProvider: CliUsageProvider;

  constructor(
    private readonly authService: AuthService,
    getThresholds: () => { warning: number; critical: number }
  ) {
    this.oauthProvider = new OAuthApiUsageProvider(this.authService, getThresholds);
    this.cliProvider = new CliUsageProvider();
  }

  public async isAvailable(): Promise<boolean> {
    return (await this.oauthProvider.isAvailable()) || (await this.cliProvider.isAvailable());
  }

  public async fetchUsage(): Promise<ClaudeUsageSnapshot> {
    // 1. Try direct OAuth API if credentials are present
    const hasOAuth = await this.oauthProvider.isAvailable();
    if (hasOAuth) {
      try {
        return await this.oauthProvider.fetchUsage();
      } catch (err) {
        // If OAuth request failed, attach error but don't fabricate data
        const errMsg = err instanceof Error ? err.message : String(err);
        const authStatus = await this.authService.getAuthStatus();

        return {
          timestamp: new Date(),
          fiveHour: null,
          weekly: null,
          extraUsage: null,
          subscriptionType: authStatus.subscriptionType ?? null,
          rateLimitTier: authStatus.rateLimitTier ?? null,
          auth: authStatus,
          isCached: false,
          isStale: false,
          errorMessage: errMsg,
          providerName: this.oauthProvider.displayName,
        };
      }
    }

    // 2. If no OAuth token, check Claude Code CLI for diagnostics
    const cliStatus = await this.cliProvider.getCliStatus();
    const authStatus = await this.authService.getAuthStatus();

    let guidanceMessage = 'Claude authentication not found.';
    if (cliStatus.isInstalled) {
      if (cliStatus.loggedIn) {
        guidanceMessage =
          'Claude CLI is installed and logged in, but the session token is not yet stored for VS Code. Run a Claude session or enter your token via "Claude Usage: Enter OAuth / Session Token".';
      } else {
        guidanceMessage =
          'Claude CLI is installed but not authenticated. Run `claude auth login` in your terminal or enter your token via "Claude Usage: Enter OAuth / Session Token".';
      }
    } else {
      guidanceMessage =
        'No Claude Code credentials found. Please sign in via `claude auth login` or enter your token manually using "Claude Usage: Enter OAuth / Session Token".';
    }

    return {
      timestamp: new Date(),
      fiveHour: null,
      weekly: null,
      extraUsage: null,
      subscriptionType: null,
      rateLimitTier: null,
      auth: {
        ...authStatus,
        isAuthenticated: false,
        details: guidanceMessage,
      },
      isCached: false,
      isStale: false,
      errorMessage: guidanceMessage,
      providerName: this.displayName,
    };
  }

  public async getDiagnosticInfo(): Promise<{
    auth: Awaited<ReturnType<AuthService['getAuthStatus']>>;
    cli: Awaited<ReturnType<CliUsageProvider['getCliStatus']>>;
  }> {
    const [auth, cli] = await Promise.all([this.authService.getAuthStatus(), this.cliProvider.getCliStatus()]);
    return { auth, cli };
  }
}
