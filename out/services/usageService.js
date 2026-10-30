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
exports.UsageService = void 0;
/**
 * Claude Usage Monitor - Usage Service
 *
 * Orchestrates:
 * - Refresh scheduling & periodic timer
 * - In-memory caching and stale-while-revalidate behavior
 * - Concurrency protection (mutex locks)
 * - Broadcasts change events to UI components
 */
const vscode = __importStar(require("vscode"));
class UsageService {
    provider;
    configManager;
    lastSnapshot = null;
    lastValidSnapshot = null;
    isRefreshing = false;
    refreshTimer = null;
    _onDidChangeUsage = new vscode.EventEmitter();
    onDidChangeUsage = this._onDidChangeUsage.event;
    _onDidStartRefresh = new vscode.EventEmitter();
    onDidStartRefresh = this._onDidStartRefresh.event;
    _onDidEndRefresh = new vscode.EventEmitter();
    onDidEndRefresh = this._onDidEndRefresh.event;
    disposables = [];
    constructor(provider, configManager) {
        this.provider = provider;
        this.configManager = configManager;
        // Listen for configuration updates to restart timer or adjust interval
        this.disposables.push(this.configManager.onDidChange(() => {
            this.restartTimer();
        }));
    }
    /**
     * Initializes the service, performs initial refresh, and starts periodic timer.
     */
    async initialize() {
        await this.refresh(true);
        this.restartTimer();
    }
    /**
     * Returns current cached snapshot, or null if never fetched.
     */
    getSnapshot() {
        return this.lastSnapshot;
    }
    /**
     * Returns whether a refresh operation is currently underway.
     */
    getIsRefreshing() {
        return this.isRefreshing;
    }
    /**
     * Executes a usage refresh with concurrency locking and caching.
     */
    async refresh(force = false) {
        if (this.isRefreshing) {
            return (this.lastSnapshot ||
                this.createPlaceholderSnapshot('Refresh in progress...'));
        }
        this.isRefreshing = true;
        this._onDidStartRefresh.fire();
        try {
            const freshSnapshot = await this.provider.fetchUsage();
            if (freshSnapshot.fiveHour || freshSnapshot.weekly) {
                // Successful data fetch
                this.lastValidSnapshot = { ...freshSnapshot };
                this.lastSnapshot = freshSnapshot;
            }
            else if (this.lastValidSnapshot && freshSnapshot.errorMessage) {
                // Preserve last known valid usage data, but flag it as stale
                this.lastSnapshot = {
                    ...this.lastValidSnapshot,
                    timestamp: new Date(),
                    isCached: true,
                    isStale: true,
                    errorMessage: `Update failed: ${freshSnapshot.errorMessage} (showing cached data)`,
                };
            }
            else {
                // No previous data and current fetch had no metrics
                this.lastSnapshot = freshSnapshot;
            }
            this._onDidChangeUsage.fire(this.lastSnapshot);
            return this.lastSnapshot;
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (this.lastValidSnapshot) {
                // Retain last valid usage information and indicate that it is outdated
                this.lastSnapshot = {
                    ...this.lastValidSnapshot,
                    timestamp: new Date(),
                    isCached: true,
                    isStale: true,
                    errorMessage: `Refresh failed: ${errMsg} (showing cached data)`,
                };
            }
            else {
                this.lastSnapshot = {
                    timestamp: new Date(),
                    fiveHour: null,
                    weekly: null,
                    extraUsage: null,
                    subscriptionType: null,
                    rateLimitTier: null,
                    auth: {
                        isAuthenticated: false,
                        authMethod: 'none',
                        details: errMsg,
                    },
                    isCached: false,
                    isStale: false,
                    errorMessage: errMsg,
                    providerName: this.provider.displayName,
                };
            }
            this._onDidChangeUsage.fire(this.lastSnapshot);
            return this.lastSnapshot;
        }
        finally {
            this.isRefreshing = false;
            this._onDidEndRefresh.fire();
        }
    }
    /**
     * Clears cached snapshot and triggers a fresh usage fetch.
     */
    async resetCache() {
        this.lastSnapshot = null;
        this.lastValidSnapshot = null;
        await this.refresh(true);
    }
    /**
     * Starts or restarts the periodic timer based on configuration.
     */
    restartTimer() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        const config = this.configManager.get();
        if (!config.enable || !config.autoRefresh) {
            return;
        }
        const intervalMs = config.refreshInterval * 1000;
        this.refreshTimer = setInterval(() => {
            this.refresh(false).catch((err) => {
                console.error('Background usage refresh failed:', err);
            });
        }, intervalMs);
    }
    dispose() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        this._onDidChangeUsage.dispose();
        this._onDidStartRefresh.dispose();
        this._onDidEndRefresh.dispose();
        this.disposables.forEach((d) => d.dispose());
    }
    createPlaceholderSnapshot(message) {
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
            },
            isCached: false,
            isStale: false,
            errorMessage: message,
            providerName: this.provider.displayName,
        };
    }
}
exports.UsageService = UsageService;
//# sourceMappingURL=usageService.js.map