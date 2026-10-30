/**
 * Claude Usage Monitor - Authentication & Credential Service
 *
 * Discovers and manages authentication sessions across:
 * 1. VS Code SecretStorage (extension-owned secure vault)
 * 2. Environment variables (CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_AUTH_TOKEN)
 * 3. Local Claude Code credentials files (~/.claude/.credentials.json, ~/.config/Claude/.credentials.json)
 * 4. Custom configured credentials path
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AuthStatus } from '../models/usage';

export interface RetrievedToken {
  token: string | null;
  authMethod: AuthStatus['authMethod'];
  accountEmail?: string | null;
  organizationUuid?: string | null;
  subscriptionType?: string | null;
  rateLimitTier?: string | null;
  expiresAt?: Date | null;
  isExpired?: boolean;
  sourceDescription: string;
}

export class AuthService {
  private static readonly SECRET_KEY_TOKEN = 'claudeUsage.oauthToken';
  private static readonly SECRET_KEY_METADATA = 'claudeUsage.tokenMetadata';

  constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly getCustomPath: () => string
  ) {}

  /**
   * Discovers the best available Claude authentication token across all supported sources.
   */
  public async getActiveToken(): Promise<RetrievedToken> {
    // 1. Check VS Code SecretStorage (highest precedence for explicit user configuration)
    const secretToken = await this.secrets.get(AuthService.SECRET_KEY_TOKEN);
    if (secretToken && secretToken.trim().length > 0) {
      let metadata: any = null;
      try {
        const metaStr = await this.secrets.get(AuthService.SECRET_KEY_METADATA);
        if (metaStr) {
          metadata = JSON.parse(metaStr);
        }
      } catch {
        // Ignore json parse error
      }

      const expiresAt = metadata?.expiresAt ? new Date(metadata.expiresAt) : null;
      const isExpired = expiresAt ? Date.now() >= expiresAt.getTime() : false;

      return {
        token: secretToken.trim(),
        authMethod: 'secret_storage',
        accountEmail: metadata?.email ?? null,
        organizationUuid: metadata?.organizationUuid ?? null,
        subscriptionType: metadata?.subscriptionType ?? null,
        rateLimitTier: metadata?.rateLimitTier ?? null,
        expiresAt,
        isExpired,
        sourceDescription: 'VS Code Secure Storage',
      };
    }

    // 2. Check Environment Variables
    const envToken = process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN;
    if (envToken && envToken.trim().length > 0) {
      return {
        token: envToken.trim(),
        authMethod: 'environment',
        sourceDescription: 'Environment Variable (CLAUDE_CODE_OAUTH_TOKEN)',
      };
    }

    // 3. Check Custom Credentials Path if configured
    const customPath = this.getCustomPath();
    if (customPath) {
      const fromCustom = this.readCredentialsFromFile(customPath, 'Custom Configured Path');
      if (fromCustom) {
        return fromCustom;
      }
    }

    // 4. Check standard Claude Code file locations
    const candidatePaths = this.getCandidateCredentialPaths();
    for (const candPath of candidatePaths) {
      const result = this.readCredentialsFromFile(candPath, `Claude Code File (${candPath})`);
      if (result) {
        return result;
      }
    }

    // No credentials found
    return {
      token: null,
      authMethod: 'none',
      sourceDescription: 'None detected',
    };
  }

  /**
   * Helper to retrieve candidates file paths across operating systems.
   */
  private getCandidateCredentialPaths(): string[] {
    const homedir = os.homedir();
    const paths: string[] = [];

    // Check CLAUDE_CONFIG_DIR env var if set
    if (process.env.CLAUDE_CONFIG_DIR) {
      paths.push(path.join(process.env.CLAUDE_CONFIG_DIR, '.credentials.json'));
      paths.push(path.join(process.env.CLAUDE_CONFIG_DIR, 'credentials.json'));
    }

    // Default ~/.claude/.credentials.json
    paths.push(path.join(homedir, '.claude', '.credentials.json'));
    paths.push(path.join(homedir, '.claude', 'credentials.json'));

    // OS specific paths
    if (process.platform === 'linux') {
      paths.push(path.join(homedir, '.config', 'Claude', '.credentials.json'));
      paths.push(path.join(homedir, '.config', 'Claude-3p', '.credentials.json'));
      paths.push(path.join(homedir, '.config', 'claude-code', '.credentials.json'));
    } else if (process.platform === 'darwin') {
      paths.push(path.join(homedir, 'Library', 'Application Support', 'Claude', '.credentials.json'));
      paths.push(path.join(homedir, 'Library', 'Application Support', 'claude-code', '.credentials.json'));
    } else if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming');
      paths.push(path.join(appData, 'Claude', '.credentials.json'));
      paths.push(path.join(appData, 'claude-code', '.credentials.json'));
    }

    return paths;
  }

  /**
   * Safely reads and parses a credentials JSON file.
   */
  private readCredentialsFromFile(filePath: string, sourceName: string): RetrievedToken | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      if (!content || content.trim().length === 0) {
        return null;
      }

      const parsed = JSON.parse(content);
      // Claude Code credentials structure typically nests under `claudeAiOauth`
      const oauthData = parsed.claudeAiOauth || parsed;

      const accessToken = oauthData.accessToken || oauthData.access_token || oauthData.token;
      if (!accessToken || typeof accessToken !== 'string' || accessToken.trim().length === 0) {
        return null;
      }

      const expiresAtRaw = oauthData.expiresAt || oauthData.expires_at;
      let expiresAt: Date | null = null;
      if (expiresAtRaw) {
        const num = Number(expiresAtRaw);
        if (!isNaN(num) && num > 0) {
          expiresAt = new Date(num < 10000000000 ? num * 1000 : num);
        } else if (typeof expiresAtRaw === 'string') {
          const parsedDate = Date.parse(expiresAtRaw);
          if (!isNaN(parsedDate)) {
            expiresAt = new Date(parsedDate);
          }
        }
      }

      const isExpired = expiresAt ? Date.now() >= expiresAt.getTime() : false;

      return {
        token: accessToken.trim(),
        authMethod: 'oauth_credentials',
        accountEmail: oauthData.email ?? null,
        organizationUuid: oauthData.organizationUuid ?? oauthData.orgUuid ?? null,
        subscriptionType: oauthData.subscriptionType ?? null,
        rateLimitTier: oauthData.rateLimitTier ?? null,
        expiresAt,
        isExpired,
        sourceDescription: sourceName,
      };
    } catch {
      return null;
    }
  }

  /**
   * Save a manual OAuth token or session key to VS Code's SecretStorage
   */
  public async setSecretToken(token: string, metadata?: Record<string, any>): Promise<void> {
    const trimmed = token.trim();
    if (trimmed.length === 0) {
      await this.clearSecretToken();
      return;
    }

    await this.secrets.store(AuthService.SECRET_KEY_TOKEN, trimmed);
    if (metadata) {
      await this.secrets.store(AuthService.SECRET_KEY_METADATA, JSON.stringify(metadata));
    }
  }

  /**
   * Clear any stored credentials from SecretStorage
   */
  public async clearSecretToken(): Promise<void> {
    await this.secrets.delete(AuthService.SECRET_KEY_TOKEN);
    await this.secrets.delete(AuthService.SECRET_KEY_METADATA);
  }

  /**
   * Returns current high-level authentication status for display in UI
   */
  public async getAuthStatus(): Promise<AuthStatus> {
    const active = await this.getActiveToken();
    return {
      isAuthenticated: Boolean(active.token && !active.isExpired),
      authMethod: active.authMethod,
      accountEmail: active.accountEmail,
      organizationUuid: active.organizationUuid,
      subscriptionType: active.subscriptionType,
      rateLimitTier: active.rateLimitTier,
      details: active.sourceDescription,
      isExpired: active.isExpired,
      expiresAt: active.expiresAt,
    };
  }
}
