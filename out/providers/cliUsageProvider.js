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
exports.CliUsageProvider = void 0;
/**
 * Claude Usage Monitor - Claude CLI Diagnostic Provider
 *
 * Inspects local Claude Code CLI installation and runs `claude auth status`
 * to detect whether Claude Code is installed and authenticated.
 */
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
class CliUsageProvider {
    id = 'claude-cli-provider';
    displayName = 'Claude Code CLI';
    async isAvailable() {
        const status = await this.getCliStatus();
        return status.isInstalled;
    }
    async getCliStatus() {
        const binPath = await this.locateClaudeBinary();
        if (!binPath) {
            return {
                isInstalled: false,
                error: 'Claude Code CLI binary not found in standard system PATH or known directories.',
            };
        }
        return new Promise((resolve) => {
            (0, child_process_1.exec)(`"${binPath}" auth status`, { timeout: 5000 }, (err, stdout, stderr) => {
                if (err) {
                    resolve({
                        isInstalled: true,
                        cliPath: binPath,
                        loggedIn: false,
                        error: err.message || stderr,
                    });
                    return;
                }
                try {
                    // Attempt to extract JSON from stdout
                    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        resolve({
                            isInstalled: true,
                            cliPath: binPath,
                            loggedIn: Boolean(parsed.loggedIn),
                            authMethod: parsed.authMethod,
                            configDirectory: parsed.configDirectory,
                            rawOutput: stdout,
                        });
                        return;
                    }
                    resolve({
                        isInstalled: true,
                        cliPath: binPath,
                        loggedIn: stdout.toLowerCase().includes('logged in'),
                        rawOutput: stdout,
                    });
                }
                catch (parseErr) {
                    resolve({
                        isInstalled: true,
                        cliPath: binPath,
                        loggedIn: false,
                        rawOutput: stdout,
                    });
                }
            });
        });
    }
    async fetchUsage() {
        const status = await this.getCliStatus();
        const snapshot = {
            timestamp: new Date(),
            fiveHour: null,
            weekly: null,
            extraUsage: null,
            subscriptionType: null,
            rateLimitTier: null,
            auth: {
                isAuthenticated: Boolean(status.loggedIn),
                authMethod: 'cli',
                details: status.isInstalled
                    ? `Claude CLI found at ${status.cliPath} (Status: ${status.loggedIn ? 'Logged in' : 'Not logged in'})`
                    : 'Claude Code CLI is not installed.',
            },
            isCached: false,
            isStale: false,
            errorMessage: status.loggedIn
                ? 'Claude CLI is logged in, but usage data must be retrieved through the OAuth Usage API.'
                : 'Claude CLI is not authenticated. Run `claude auth login` in your terminal.',
            providerName: this.displayName,
        };
        return snapshot;
    }
    /**
     * Searches for `claude` executable in PATH and known Claude Code directories.
     */
    async locateClaudeBinary() {
        return new Promise((resolve) => {
            (0, child_process_1.exec)(process.platform === 'win32' ? 'where claude' : 'which claude', (err, stdout) => {
                if (!err && stdout.trim().length > 0) {
                    const first = stdout.trim().split(/\r?\n/)[0];
                    if (fs.existsSync(first)) {
                        resolve(first);
                        return;
                    }
                }
                // Check common Claude Code install locations
                const home = os.homedir();
                const candidateLocations = [
                    path.join(home, '.claude', 'bin', 'claude'),
                    path.join(home, '.local', 'bin', 'claude'),
                    path.join('/usr', 'local', 'bin', 'claude'),
                ];
                // Also search in ~/.config/Claude*/claude-code/...
                try {
                    const configClaudeDirs = [
                        path.join(home, '.config', 'Claude', 'claude-code'),
                        path.join(home, '.config', 'Claude-3p', 'claude-code'),
                    ];
                    for (const baseDir of configClaudeDirs) {
                        if (fs.existsSync(baseDir)) {
                            const versions = fs.readdirSync(baseDir);
                            for (const ver of versions) {
                                const verDir = path.join(baseDir, ver);
                                if (fs.statSync(verDir).isDirectory()) {
                                    const subdirs = fs.readdirSync(verDir);
                                    for (const sub of subdirs) {
                                        const candidate = path.join(verDir, sub, 'claude');
                                        if (fs.existsSync(candidate)) {
                                            candidateLocations.push(candidate);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                catch {
                    // Ignore directory traversal errors
                }
                for (const loc of candidateLocations) {
                    if (fs.existsSync(loc)) {
                        resolve(loc);
                        return;
                    }
                }
                resolve(null);
            });
        });
    }
}
exports.CliUsageProvider = CliUsageProvider;
//# sourceMappingURL=cliUsageProvider.js.map