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
/**
 * Unit Tests - StatusBarManager rendering & formatting logic
 */
const assert = __importStar(require("assert"));
const statusBarManager_1 = require("../ui/statusBarManager");
class MockConfigManager {
    config = {
        enable: true,
        show5HourUsage: true,
        showWeeklyUsage: true,
        refreshInterval: 60,
        warningThreshold: 25,
        criticalThreshold: 10,
        displayMode: 'both',
        showIcon: true,
        statusBarLayout: 'single',
        autoRefresh: true,
        statusBarFormat: 'compact',
        customCredentialsPath: '',
    };
    get() {
        return this.config;
    }
    onDidChange = () => ({ dispose: () => { } });
}
class MockUsageService {
    snapshot = null;
    onDidChangeUsage = () => ({ dispose: () => { } });
    onDidStartRefresh = () => ({ dispose: () => { } });
    onDidEndRefresh = () => ({ dispose: () => { } });
    getSnapshot() {
        return this.snapshot;
    }
}
describe('StatusBarManager Tests', () => {
    it('should initialize and toggle visibility', () => {
        const usageService = new MockUsageService();
        const configManager = new MockConfigManager();
        const manager = new statusBarManager_1.StatusBarManager(usageService, configManager);
        // Initial toggle hides
        const v1 = manager.toggle();
        assert.strictEqual(v1, false);
        // Toggle again shows
        const v2 = manager.toggle();
        assert.strictEqual(v2, true);
        manager.dispose();
    });
    it('should render single compact window by default with logo and both limits', () => {
        const usageService = new MockUsageService();
        const configManager = new MockConfigManager();
        assert.strictEqual(configManager.config.statusBarLayout, 'single');
        const manager = new statusBarManager_1.StatusBarManager(usageService, configManager);
        const snapshot = {
            timestamp: new Date(),
            fiveHour: {
                rawUtilization: 22,
                usedPercentage: 22,
                remainingPercentage: 78,
                resetsAt: new Date(Date.now() + 3600000),
                resetTimeFormatted: '1 hour later',
                timeUntilReset: '1h 0m',
                status: 'normal',
            },
            weekly: {
                rawUtilization: 36,
                usedPercentage: 36,
                remainingPercentage: 64,
                resetsAt: new Date(Date.now() + 86400000 * 3),
                resetTimeFormatted: '3 days later',
                timeUntilReset: '3d 0h',
                status: 'normal',
            },
            subscriptionType: 'pro',
            rateLimitTier: 'default',
            auth: {
                isAuthenticated: true,
                authMethod: 'oauth_credentials',
            },
            isCached: false,
            isStale: false,
            providerName: 'Test Provider',
        };
        manager.update(snapshot);
        const item5h = manager.item5h;
        const itemWeekly = manager.itemWeekly;
        // Single item must combine both: '$(sparkle) 5h: 22%, Wk: 36%'
        assert.ok(item5h.text.includes('$(sparkle)'), 'Expected $(sparkle) logo in combined single item');
        assert.ok(item5h.text.includes('5h: 22%'), `Expected '5h: 22%', got: ${item5h.text}`);
        assert.ok(item5h.text.includes('Wk: 36%'), `Expected 'Wk: 36%', got: ${item5h.text}`);
        // itemWeekly should be hidden to avoid extra status bar space
        assert.strictEqual(itemWeekly.isVisible, false, 'Weekly item should be hidden in single layout mode');
        // Tooltip must contain unified breakdown of BOTH windows
        const tooltipValue = item5h.tooltip.value;
        assert.ok(tooltipValue.includes('5-Hour Usage Window'), 'Tooltip should include 5h section');
        assert.ok(tooltipValue.includes('Weekly (7-Day) Usage Window'), 'Tooltip should include Weekly section');
        assert.ok(tooltipValue.includes('22% used'), 'Tooltip should have 5h consumed %');
        assert.ok(tooltipValue.includes('78% remaining'), 'Tooltip should have 5h remaining %');
        assert.ok(tooltipValue.includes('36% used'), 'Tooltip should have Weekly consumed %');
        assert.ok(tooltipValue.includes('64% remaining'), 'Tooltip should have Weekly remaining %');
        manager.dispose();
    });
    it('should render warning icon and colors in single window mode when threshold breached', () => {
        const usageService = new MockUsageService();
        const configManager = new MockConfigManager();
        const manager = new statusBarManager_1.StatusBarManager(usageService, configManager);
        const snapshotWarning = {
            timestamp: new Date(),
            fiveHour: {
                rawUtilization: 53,
                usedPercentage: 53,
                remainingPercentage: 47,
                resetsAt: new Date(Date.now() + 3600000),
                resetTimeFormatted: '1 hour later',
                timeUntilReset: '1h 0m',
                status: 'normal',
            },
            weekly: {
                rawUtilization: 75,
                usedPercentage: 75,
                remainingPercentage: 25,
                resetsAt: new Date(Date.now() + 86400000 * 3),
                resetTimeFormatted: '3 days later',
                timeUntilReset: '3d 0h',
                status: 'warning',
            },
            subscriptionType: 'pro',
            rateLimitTier: 'default',
            auth: {
                isAuthenticated: true,
                authMethod: 'oauth_credentials',
            },
            isCached: false,
            isStale: false,
            providerName: 'Test Provider',
        };
        manager.update(snapshotWarning);
        const item5h = manager.item5h;
        // Must show $(warning) on weekly piece
        assert.ok(item5h.text.includes('$(warning) Wk: 75%'), `Expected '$(warning) Wk: 75%' in single window, got: ${item5h.text}`);
        assert.ok(item5h.text.includes('5h: 53%'), `Expected '5h: 53%', got: ${item5h.text}`);
        // Warning color must be applied
        assert.ok(item5h.color !== undefined, 'Expected warning color on status bar item');
        manager.dispose();
    });
    it('should correctly render single window for consumed mode', () => {
        const usageService = new MockUsageService();
        const configManager = new MockConfigManager();
        configManager.config.displayMode = 'consumed';
        const manager = new statusBarManager_1.StatusBarManager(usageService, configManager);
        const snapshot = {
            timestamp: new Date(),
            fiveHour: {
                rawUtilization: 22,
                usedPercentage: 22,
                remainingPercentage: 78,
                resetsAt: new Date(Date.now() + 3600000),
                resetTimeFormatted: '1 hour later',
                timeUntilReset: '1h 0m',
                status: 'normal',
            },
            weekly: {
                rawUtilization: 36,
                usedPercentage: 36,
                remainingPercentage: 64,
                resetsAt: new Date(Date.now() + 86400000 * 3),
                resetTimeFormatted: '3 days later',
                timeUntilReset: '3d 0h',
                status: 'normal',
            },
            subscriptionType: 'pro',
            rateLimitTier: 'default',
            auth: {
                isAuthenticated: true,
                authMethod: 'oauth_credentials',
            },
            isCached: false,
            isStale: false,
            providerName: 'Test Provider',
        };
        manager.update(snapshot);
        const item5h = manager.item5h;
        assert.ok(item5h.text.includes('5h: 22% used'), `Expected '5h: 22% used', got: ${item5h.text}`);
        assert.ok(item5h.text.includes('Wk: 36% used'), `Expected 'Wk: 36% used', got: ${item5h.text}`);
        manager.dispose();
    });
    it('should correctly render single window for remaining mode', () => {
        const usageService = new MockUsageService();
        const configManager = new MockConfigManager();
        configManager.config.displayMode = 'remaining';
        const manager = new statusBarManager_1.StatusBarManager(usageService, configManager);
        const snapshot = {
            timestamp: new Date(),
            fiveHour: {
                rawUtilization: 22,
                usedPercentage: 22,
                remainingPercentage: 78,
                resetsAt: null,
                resetTimeFormatted: 'Unknown',
                timeUntilReset: 'N/A',
                status: 'normal',
            },
            weekly: {
                rawUtilization: 36,
                usedPercentage: 36,
                remainingPercentage: 64,
                resetsAt: null,
                resetTimeFormatted: 'Unknown',
                timeUntilReset: 'N/A',
                status: 'normal',
            },
            subscriptionType: 'pro',
            rateLimitTier: 'default',
            auth: {
                isAuthenticated: true,
                authMethod: 'oauth_credentials',
            },
            isCached: false,
            isStale: false,
            providerName: 'Test Provider',
        };
        manager.update(snapshot);
        const item5h = manager.item5h;
        assert.ok(item5h.text.includes('5h: 78% left'), `Expected '5h: 78% left', got: ${item5h.text}`);
        assert.ok(item5h.text.includes('Wk: 64% left'), `Expected 'Wk: 64% left', got: ${item5h.text}`);
        manager.dispose();
    });
    it('should support split layout mode when configured', () => {
        const usageService = new MockUsageService();
        const configManager = new MockConfigManager();
        configManager.config.statusBarLayout = 'split';
        const manager = new statusBarManager_1.StatusBarManager(usageService, configManager);
        const snapshot = {
            timestamp: new Date(),
            fiveHour: {
                rawUtilization: 22,
                usedPercentage: 22,
                remainingPercentage: 78,
                resetsAt: new Date(Date.now() + 3600000),
                resetTimeFormatted: '1 hour later',
                timeUntilReset: '1h 0m',
                status: 'normal',
            },
            weekly: {
                rawUtilization: 36,
                usedPercentage: 36,
                remainingPercentage: 64,
                resetsAt: new Date(Date.now() + 86400000 * 3),
                resetTimeFormatted: '3 days later',
                timeUntilReset: '3d 0h',
                status: 'normal',
            },
            subscriptionType: 'pro',
            rateLimitTier: 'default',
            auth: {
                isAuthenticated: true,
                authMethod: 'oauth_credentials',
            },
            isCached: false,
            isStale: false,
            providerName: 'Test Provider',
        };
        manager.update(snapshot);
        const item5h = manager.item5h;
        const itemWeekly = manager.itemWeekly;
        // Both items visible in split mode
        assert.strictEqual(item5h.isVisible, true);
        assert.strictEqual(itemWeekly.isVisible, true);
        assert.ok(item5h.text.includes('Claude 5h: 22% used (78% left)'));
        assert.ok(itemWeekly.text.includes('Claude Weekly: 36% used (64% left)'));
        manager.dispose();
    });
    it('should render Sign In when unauthenticated', () => {
        const usageService = new MockUsageService();
        const configManager = new MockConfigManager();
        const manager = new statusBarManager_1.StatusBarManager(usageService, configManager);
        const unauthSnapshot = {
            timestamp: new Date(),
            fiveHour: null,
            weekly: null,
            subscriptionType: null,
            rateLimitTier: null,
            auth: {
                isAuthenticated: false,
                authMethod: 'none',
                details: 'No tokens found',
            },
            isCached: false,
            isStale: false,
            providerName: 'Test Provider',
        };
        manager.update(unauthSnapshot);
        const item5h = manager.item5h;
        assert.ok(item5h.text.includes('Sign in'), 'Expected Sign in text');
        assert.strictEqual(item5h.command, 'claudeUsage.signIn');
        manager.dispose();
    });
});
//# sourceMappingURL=statusBar.test.js.map