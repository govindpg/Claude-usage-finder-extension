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
exports.ConfigurationManager = void 0;
/**
 * Claude Usage Monitor - Configuration Management
 */
const vscode = __importStar(require("vscode"));
class ConfigurationManager {
    static CONFIG_SECTION = 'claudeUsage';
    _onDidChange = new vscode.EventEmitter();
    onDidChange = this._onDidChange.event;
    _disposable;
    constructor() {
        this._disposable = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(ConfigurationManager.CONFIG_SECTION)) {
                this._onDidChange.fire(this.get());
            }
        });
    }
    dispose() {
        this._onDidChange.dispose();
        this._disposable.dispose();
    }
    /**
     * Retrieves current configuration with validated and clamped values.
     */
    get() {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        const enable = config.get('enable', true);
        const show5HourUsage = config.get('show5HourUsage', true);
        const showWeeklyUsage = config.get('showWeeklyUsage', true);
        // Refresh interval in seconds: clamp between 15s and 3600s
        const rawRefresh = config.get('refreshInterval', 60);
        const refreshInterval = Math.max(15, Math.min(3600, Number.isFinite(rawRefresh) ? rawRefresh : 60));
        // Thresholds: clamp between 1% and 99%
        const rawWarning = config.get('warningThreshold', 25);
        const rawCritical = config.get('criticalThreshold', 10);
        const warningThreshold = Math.max(2, Math.min(99, Number.isFinite(rawWarning) ? rawWarning : 25));
        const criticalThreshold = Math.max(1, Math.min(warningThreshold - 1, Number.isFinite(rawCritical) ? rawCritical : 10));
        const rawDisplayMode = config.get('displayMode', 'both');
        let displayMode = 'both';
        if (rawDisplayMode === 'consumed' || rawDisplayMode === 'remaining') {
            displayMode = rawDisplayMode;
        }
        const showIcon = config.get('showIcon', true);
        const rawLayout = config.get('statusBarLayout', 'single');
        const statusBarLayout = rawLayout === 'split' ? 'split' : 'single';
        const autoRefresh = config.get('autoRefresh', true);
        const rawFormat = config.get('statusBarFormat', 'compact');
        let statusBarFormat = 'compact';
        if (rawFormat === 'detailed' || rawFormat === 'icon-only') {
            statusBarFormat = rawFormat;
        }
        const customCredentialsPath = (config.get('customCredentialsPath', '') || '').trim();
        return {
            enable,
            show5HourUsage,
            showWeeklyUsage,
            refreshInterval,
            warningThreshold,
            criticalThreshold,
            displayMode,
            showIcon,
            statusBarLayout,
            autoRefresh,
            statusBarFormat,
            customCredentialsPath,
        };
    }
    /**
     * Open the extension settings page in VS Code
     */
    async openSettings() {
        await vscode.commands.executeCommand('workbench.action.openSettings', `@ext:anthropic-tools.claude-usage-monitor`);
    }
}
exports.ConfigurationManager = ConfigurationManager;
//# sourceMappingURL=configuration.js.map