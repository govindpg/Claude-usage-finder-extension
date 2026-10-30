"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class AuthService {
    secrets;
    getCustomPath;
    static SECRET_KEY_TOKEN = 'claudeUsage.oauthToken';
    static SECRET_KEY_METADATA = 'claudeUsage.tokenMetadata';
    constructor(secrets, getCustomPath) {
        this.secrets = secrets;
        this.getCustomPath = getCustomPath;
    }
    /**
     * Discovers the best available Claude authentication token across all supported sources.
     */
    async getActiveToken() {
        // 1. Check VS Code SecretStorage (highest precedence for explicit user configuration)
        const secretToken = await this.secrets.get(AuthService.SECRET_KEY_TOKEN);
        if (secretToken && secretToken.trim().length > 0) {
            let metadata = null;
            try {
                const metaStr = await this.secrets.get(AuthService.SECRET_KEY_METADATA);
                if (metaStr) {
                    metadata = JSON.parse(metaStr);
                }
            }
            catch {
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
    getCandidateCredentialPaths() {
        const homedir = os.homedir();
        const paths = [];
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
        }
        else if (process.platform === 'darwin') {
            paths.push(path.join(homedir, 'Library', 'Application Support', 'Claude', '.credentials.json'));
            paths.push(path.join(homedir, 'Library', 'Application Support', 'claude-code', '.credentials.json'));
        }
        else if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming');
            paths.push(path.join(appData, 'Claude', '.credentials.json'));
            paths.push(path.join(appData, 'claude-code', '.credentials.json'));
        }
        return paths;
    }
    /**
     * Safely reads and parses a credentials JSON file.
     */
    readCredentialsFromFile(filePath, sourceName) {
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
            let expiresAt = null;
            if (expiresAtRaw) {
                const num = Number(expiresAtRaw);
                if (!isNaN(num) && num > 0) {
                    expiresAt = new Date(num < 10000000000 ? num * 1000 : num);
                }
                else if (typeof expiresAtRaw === 'string') {
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
        }
        catch {
            return null;
        }
    }
    /**
     * Save a manual OAuth token or session key to VS Code's SecretStorage
     */
    async setSecretToken(token, metadata) {
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
    async clearSecretToken() {
        await this.secrets.delete(AuthService.SECRET_KEY_TOKEN);
        await this.secrets.delete(AuthService.SECRET_KEY_METADATA);
    }
    /**
     * Returns current high-level authentication status for display in UI
     */
    async getAuthStatus() {
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
exports.AuthService = AuthService;
//# sourceMappingURL=authService.js.map