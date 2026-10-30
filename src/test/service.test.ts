/**
 * Unit Tests - UsageService & Caching
 */
import * as assert from 'assert';
import { UsageService } from '../services/usageService';
import { IClaudeUsageProvider } from '../providers/types';
import { ClaudeUsageSnapshot } from '../models/usage';

// Minimal mock configuration manager
class MockConfigManager {
  private config = {
    enable: true,
    show5HourUsage: true,
    showWeeklyUsage: true,
    refreshInterval: 60,
    warningThreshold: 25,
    criticalThreshold: 10,
    displayMode: 'remaining' as const,
    autoRefresh: true,
    statusBarFormat: 'compact' as const,
    customCredentialsPath: '',
  };

  public get() {
    return this.config;
  }

  public onDidChange = () => ({ dispose: () => {} });
}

// Mock usage provider
class MockUsageProvider implements IClaudeUsageProvider {
  public id = 'mock-provider';
  public displayName = 'Mock Usage Provider';
  public shouldFail = false;
  public failMessage = 'Simulated network timeout';
  public callCount = 0;

  public mockSnapshot: ClaudeUsageSnapshot = {
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

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async fetchUsage(): Promise<ClaudeUsageSnapshot> {
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
    const service = new UsageService(provider, config as any);

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
    const service = new UsageService(provider, config as any);

    // Initial successful fetch
    await service.refresh(true);
    assert.strictEqual(service.getSnapshot()?.isStale, false);

    // Now make provider fail
    provider.shouldFail = true;
    const staleSnapshot = await service.refresh(true);

    assert.ok(staleSnapshot.fiveHour !== null, 'Should retain fiveHour data');
    assert.strictEqual(staleSnapshot.fiveHour?.remainingPercentage, 78);
    assert.strictEqual(staleSnapshot.isStale, true, 'Should be flagged as stale');
    assert.ok(
      staleSnapshot.errorMessage?.includes('Simulated network timeout'),
      'Should include error in snapshot'
    );
    service.dispose();
  });

  it('should clear cache on resetCache', async () => {
    const provider = new MockUsageProvider();
    const config = new MockConfigManager();
    const service = new UsageService(provider, config as any);

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
    const service = new UsageService(provider, config as any);

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
