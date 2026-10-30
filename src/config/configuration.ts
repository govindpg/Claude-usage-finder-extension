/**
 * Claude Usage Monitor - Configuration Management
 */
import * as vscode from 'vscode';
import { DisplayMode, StatusBarFormat } from '../models/usage';

export type StatusBarLayout = 'single' | 'split';

export interface ExtensionConfig {
  enable: boolean;
  show5HourUsage: boolean;
  showWeeklyUsage: boolean;
  refreshInterval: number; // in seconds
  warningThreshold: number; // e.g. 25
  criticalThreshold: number; // e.g. 10
  displayMode: DisplayMode; // 'both' | 'consumed' | 'remaining'
  showIcon: boolean; // whether to show Claude logo icon in status bar
  statusBarLayout: StatusBarLayout; // 'single' compact window or 'split' separate items
  autoRefresh: boolean;
  statusBarFormat: StatusBarFormat; // 'compact' | 'detailed' | 'icon-only'
  customCredentialsPath: string;
}

export class ConfigurationManager {
  private static readonly CONFIG_SECTION = 'claudeUsage';
  private readonly _onDidChange = new vscode.EventEmitter<ExtensionConfig>();
  public readonly onDidChange = this._onDidChange.event;
  private _disposable: vscode.Disposable;

  constructor() {
    this._disposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ConfigurationManager.CONFIG_SECTION)) {
        this._onDidChange.fire(this.get());
      }
    });
  }

  public dispose(): void {
    this._onDidChange.dispose();
    this._disposable.dispose();
  }

  /**
   * Retrieves current configuration with validated and clamped values.
   */
  public get(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);

    const enable = config.get<boolean>('enable', true);
    const show5HourUsage = config.get<boolean>('show5HourUsage', true);
    const showWeeklyUsage = config.get<boolean>('showWeeklyUsage', true);

    // Refresh interval in seconds: clamp between 15s and 3600s
    const rawRefresh = config.get<number>('refreshInterval', 60);
    const refreshInterval = Math.max(15, Math.min(3600, Number.isFinite(rawRefresh) ? rawRefresh : 60));

    // Thresholds: clamp between 1% and 99%
    const rawWarning = config.get<number>('warningThreshold', 25);
    const rawCritical = config.get<number>('criticalThreshold', 10);

    const warningThreshold = Math.max(2, Math.min(99, Number.isFinite(rawWarning) ? rawWarning : 25));
    const criticalThreshold = Math.max(
      1,
      Math.min(warningThreshold - 1, Number.isFinite(rawCritical) ? rawCritical : 10)
    );

    const rawDisplayMode = config.get<string>('displayMode', 'both');
    let displayMode: DisplayMode = 'both';
    if (rawDisplayMode === 'consumed' || rawDisplayMode === 'remaining') {
      displayMode = rawDisplayMode;
    }

    const showIcon = config.get<boolean>('showIcon', true);

    const rawLayout = config.get<string>('statusBarLayout', 'single');
    const statusBarLayout: StatusBarLayout = rawLayout === 'split' ? 'split' : 'single';

    const autoRefresh = config.get<boolean>('autoRefresh', true);

    const rawFormat = config.get<string>('statusBarFormat', 'compact');
    let statusBarFormat: StatusBarFormat = 'compact';
    if (rawFormat === 'detailed' || rawFormat === 'icon-only') {
      statusBarFormat = rawFormat;
    }

    const customCredentialsPath = (config.get<string>('customCredentialsPath', '') || '').trim();

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
  public async openSettings(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.openSettings', `@ext:anthropic-tools.claude-usage-monitor`);
  }
}
