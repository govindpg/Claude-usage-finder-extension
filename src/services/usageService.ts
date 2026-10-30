/**
 * Claude Usage Monitor - Usage Service
 *
 * Orchestrates:
 * - Refresh scheduling & periodic timer
 * - In-memory caching and stale-while-revalidate behavior
 * - Concurrency protection (mutex locks)
 * - Broadcasts change events to UI components
 */
import * as vscode from 'vscode';
import { ClaudeUsageSnapshot } from '../models/usage';
import { IClaudeUsageProvider } from '../providers/types';
import { ConfigurationManager } from '../config/configuration';

export class UsageService implements vscode.Disposable {
  private lastSnapshot: ClaudeUsageSnapshot | null = null;
  private lastValidSnapshot: ClaudeUsageSnapshot | null = null;
  private isRefreshing = false;
  private refreshTimer: NodeJS.Timeout | null = null;

  private readonly _onDidChangeUsage = new vscode.EventEmitter<ClaudeUsageSnapshot>();
  public readonly onDidChangeUsage = this._onDidChangeUsage.event;

  private readonly _onDidStartRefresh = new vscode.EventEmitter<void>();
  public readonly onDidStartRefresh = this._onDidStartRefresh.event;

  private readonly _onDidEndRefresh = new vscode.EventEmitter<void>();
  public readonly onDidEndRefresh = this._onDidEndRefresh.event;

  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly provider: IClaudeUsageProvider,
    private readonly configManager: ConfigurationManager
  ) {
    // Listen for configuration updates to restart timer or adjust interval
    this.disposables.push(
      this.configManager.onDidChange(() => {
        this.restartTimer();
      })
    );
  }

  /**
   * Initializes the service, performs initial refresh, and starts periodic timer.
   */
  public async initialize(): Promise<void> {
    await this.refresh(true);
    this.restartTimer();
  }

  /**
   * Returns current cached snapshot, or null if never fetched.
   */
  public getSnapshot(): ClaudeUsageSnapshot | null {
    return this.lastSnapshot;
  }

  /**
   * Returns whether a refresh operation is currently underway.
   */
  public getIsRefreshing(): boolean {
    return this.isRefreshing;
  }

  /**
   * Executes a usage refresh with concurrency locking and caching.
   */
  public async refresh(force: boolean = false): Promise<ClaudeUsageSnapshot> {
    if (this.isRefreshing) {
      return (
        this.lastSnapshot ||
        this.createPlaceholderSnapshot('Refresh in progress...')
      );
    }

    this.isRefreshing = true;
    this._onDidStartRefresh.fire();

    try {
      const freshSnapshot = await this.provider.fetchUsage();

      if (freshSnapshot.fiveHour || freshSnapshot.weekly) {
        // Successful data fetch
        this.lastValidSnapshot = { ...freshSnapshot };
        this.lastSnapshot = freshSnapshot;
      } else if (this.lastValidSnapshot && freshSnapshot.errorMessage) {
        // Preserve last known valid usage data, but flag it as stale
        this.lastSnapshot = {
          ...this.lastValidSnapshot,
          timestamp: new Date(),
          isCached: true,
          isStale: true,
          errorMessage: `Update failed: ${freshSnapshot.errorMessage} (showing cached data)`,
        };
      } else {
        // No previous data and current fetch had no metrics
        this.lastSnapshot = freshSnapshot;
      }

      this._onDidChangeUsage.fire(this.lastSnapshot);
      return this.lastSnapshot;
    } catch (err) {
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
      } else {
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
    } finally {
      this.isRefreshing = false;
      this._onDidEndRefresh.fire();
    }
  }

  /**
   * Clears cached snapshot and triggers a fresh usage fetch.
   */
  public async resetCache(): Promise<void> {
    this.lastSnapshot = null;
    this.lastValidSnapshot = null;
    await this.refresh(true);
  }

  /**
   * Starts or restarts the periodic timer based on configuration.
   */
  public restartTimer(): void {
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

  public dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this._onDidChangeUsage.dispose();
    this._onDidStartRefresh.dispose();
    this._onDidEndRefresh.dispose();
    this.disposables.forEach((d) => d.dispose());
  }

  private createPlaceholderSnapshot(message: string): ClaudeUsageSnapshot {
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
