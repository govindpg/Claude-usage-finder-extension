/**
 * Unit Tests - StatusBarManager rendering & formatting logic
 */
import * as assert from 'assert';
import { StatusBarManager } from '../ui/statusBarManager';
import { UsageService } from '../services/usageService';
import { ClaudeUsageSnapshot } from '../models/usage';

class MockConfigManager {
  public config = {
    enable: true,
    show5HourUsage: true,
    showWeeklyUsage: true,
    refreshInterval: 60,
    warningThreshold: 25,
    criticalThreshold: 10,
    displayMode: 'both' as 'both' | 'consumed' | 'remaining',
    showIcon: true,
    statusBarLayout: 'single' as 'single' | 'split',
    autoRefresh: true,
    statusBarFormat: 'compact' as 'compact' | 'detailed' | 'icon-only',
    customCredentialsPath: '',
  };

  public get() {
    return this.config;
  }

  public onDidChange = () => ({ dispose: () => {} });
}

class MockUsageService {
  public snapshot: ClaudeUsageSnapshot | null = null;
  public onDidChangeUsage = () => ({ dispose: () => {} });
  public onDidStartRefresh = () => ({ dispose: () => {} });
  public onDidEndRefresh = () => ({ dispose: () => {} });

  public getSnapshot() {
    return this.snapshot;
  }
}

describe('StatusBarManager Tests', () => {
  it('should initialize and toggle visibility', () => {
    const usageService = new MockUsageService();
    const configManager = new MockConfigManager();
    const manager = new StatusBarManager(usageService as any, configManager as any);

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

    const manager = new StatusBarManager(usageService as any, configManager as any);

    const snapshot: ClaudeUsageSnapshot = {
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
    const item5h = (manager as any).item5h;
    const itemWeekly = (manager as any).itemWeekly;

    // Single item must combine both: '$(sparkle) 5h: 22%, Wk: 36%'
    assert.ok(item5h.text.includes('$(sparkle)'), 'Expected $(sparkle) logo in combined single item');
    assert.ok(item5h.text.includes('5h: 22%'), `Expected '5h: 22%', got: ${item5h.text}`);
    assert.ok(item5h.text.includes('Wk: 36%'), `Expected 'Wk: 36%', got: ${item5h.text}`);

    // itemWeekly should be hidden to avoid extra status bar space
    assert.strictEqual((itemWeekly as any).isVisible, false, 'Weekly item should be hidden in single layout mode');

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
    const manager = new StatusBarManager(usageService as any, configManager as any);

    const snapshotWarning: ClaudeUsageSnapshot = {
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
    const item5h = (manager as any).item5h;

    // Must show $(warning) on weekly piece
    assert.ok(
      item5h.text.includes('$(warning) Wk: 75%'),
      `Expected '$(warning) Wk: 75%' in single window, got: ${item5h.text}`
    );
    assert.ok(item5h.text.includes('5h: 53%'), `Expected '5h: 53%', got: ${item5h.text}`);

    // Warning color must be applied
    assert.ok(item5h.color !== undefined, 'Expected warning color on status bar item');

    manager.dispose();
  });

  it('should correctly render single window for consumed mode', () => {
    const usageService = new MockUsageService();
    const configManager = new MockConfigManager();
    configManager.config.displayMode = 'consumed';
    const manager = new StatusBarManager(usageService as any, configManager as any);

    const snapshot: ClaudeUsageSnapshot = {
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
    const item5h = (manager as any).item5h;

    assert.ok(item5h.text.includes('5h: 22% used'), `Expected '5h: 22% used', got: ${item5h.text}`);
    assert.ok(item5h.text.includes('Wk: 36% used'), `Expected 'Wk: 36% used', got: ${item5h.text}`);

    manager.dispose();
  });

  it('should correctly render single window for remaining mode', () => {
    const usageService = new MockUsageService();
    const configManager = new MockConfigManager();
    configManager.config.displayMode = 'remaining';
    const manager = new StatusBarManager(usageService as any, configManager as any);

    const snapshot: ClaudeUsageSnapshot = {
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
    const item5h = (manager as any).item5h;

    assert.ok(item5h.text.includes('5h: 78% left'), `Expected '5h: 78% left', got: ${item5h.text}`);
    assert.ok(item5h.text.includes('Wk: 64% left'), `Expected 'Wk: 64% left', got: ${item5h.text}`);

    manager.dispose();
  });

  it('should support split layout mode when configured', () => {
    const usageService = new MockUsageService();
    const configManager = new MockConfigManager();
    configManager.config.statusBarLayout = 'split';
    const manager = new StatusBarManager(usageService as any, configManager as any);

    const snapshot: ClaudeUsageSnapshot = {
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
    const item5h = (manager as any).item5h;
    const itemWeekly = (manager as any).itemWeekly;

    // Both items visible in split mode
    assert.strictEqual((item5h as any).isVisible, true);
    assert.strictEqual((itemWeekly as any).isVisible, true);

    assert.ok(item5h.text.includes('Claude 5h: 22% used (78% left)'));
    assert.ok(itemWeekly.text.includes('Claude Weekly: 36% used (64% left)'));

    manager.dispose();
  });

  it('should render Sign In when unauthenticated', () => {
    const usageService = new MockUsageService();
    const configManager = new MockConfigManager();
    const manager = new StatusBarManager(usageService as any, configManager as any);

    const unauthSnapshot: ClaudeUsageSnapshot = {
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
    const item5h = (manager as any).item5h;

    assert.ok(item5h.text.includes('Sign in'), 'Expected Sign in text');
    assert.strictEqual(item5h.command, 'claudeUsage.signIn');

    manager.dispose();
  });
});
