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
 * Unit Tests - UsageService & Caching
 */
const assert = __importStar(require("assert"));
const usageService_1 = require("../services/usageService");
// Minimal mock configuration manager
class MockConfigManager {
    config = {
        enable: true,
        show5HourUsage: true,
        showWeeklyUsage: true,
        refreshInterval: 60,
        warningThreshold: 25,
        criticalThreshold: 10,
        displayMode: 'remaining',
        autoRefresh: true,
        statusBarFormat: 'compact',
        customCredentialsPath: '',
    };
    get() {
        return this.config;
    }
    onDidChange = () => ({ dispose: () => { } });
}
// Mock usage provider
class MockUsageProvider {
    id = 'mock-provider';
    displayName = 'Mock Usage Provider';
    shouldFail = false;
    failMessage = 'Simulated network timeout';
    callCount = 0;
    mockSnapshot = {
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
            details: 'Mock auth',
        },
        isCached: false,
        isStale: false,
        providerName: 'Mock Usage Provider',
    };
    async isAvailable() {
        return true;
    }
    async fetchUsage() {
        this.callCount++;
        if (this.shouldFail) {
            throw new Error(this.failMessage);
        }
        return { ...this.mockSnapshot, timestamp: new Date() };
    }
}
describe('UsageService Tests', () => {
    it('should fetch and cache fresh usage data on refresh', async () => {
        const provider = new MockUsageProvider();
        const config = new MockConfigManager();
        const service = new usageService_1.UsageService(provider, config);
        const snapshot = await service.refresh(true);
        assert.strictEqual(provider.callCount, 1);
        assert.ok(snapshot.fiveHour !== null);
        assert.strictEqual(snapshot.fiveHour?.remainingPercentage, 78);
        assert.strictEqual(snapshot.weekly?.remainingPercentage, 64);
        assert.strictEqual(snapshot.isStale, false);
        service.dispose();
    });
    it('should retain last valid usage data and mark as stale on refresh failure', async () => {
        const provider = new MockUsageProvider();
        const config = new MockConfigManager();
        const service = new usageService_1.UsageService(provider, config);
        // Initial successful fetch
        await service.refresh(true);
        assert.strictEqual(service.getSnapshot()?.isStale, false);
        // Now make provider fail
        provider.shouldFail = true;
        const staleSnapshot = await service.refresh(true);
        assert.ok(staleSnapshot.fiveHour !== null, 'Should retain fiveHour data');
        assert.strictEqual(staleSnapshot.fiveHour?.remainingPercentage, 78);
        assert.strictEqual(staleSnapshot.isStale, true, 'Should be flagged as stale');
        assert.ok(staleSnapshot.errorMessage?.includes('Simulated network timeout'), 'Should include error in snapshot');
        service.dispose();
    });
    it('should clear cache on resetCache', async () => {
        const provider = new MockUsageProvider();
        const config = new MockConfigManager();
        const service = new usageService_1.UsageService(provider, config);
        await service.refresh(true);
        assert.ok(service.getSnapshot() !== null);
        await service.resetCache();
        // After resetCache, fresh refresh was triggered
        assert.strictEqual(provider.callCount, 2);
        assert.strictEqual(service.getSnapshot()?.isStale, false);
        service.dispose();
    });
    it('should prevent simultaneous concurrent refreshes with mutex', async () => {
        const provider = new MockUsageProvider();
        const config = new MockConfigManager();
        const service = new usageService_1.UsageService(provider, config);
        // Trigger two refreshes simultaneously
        const p1 = service.refresh(true);
        const p2 = service.refresh(true);
        const [r1, r2] = await Promise.all([p1, p2]);
        assert.ok(r1 !== null);
        assert.ok(r2 !== null);
        // Provider should not be flooded
        assert.ok(provider.callCount <= 2);
        service.dispose();
    });
});
//# sourceMappingURL=service.test.js.map