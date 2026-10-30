/**
 * Claude Usage Monitor - Status Bar Manager
 *
 * Implements two distinct VS Code status bar items:
 * 1. 5-Hour Usage allowance & reset tracker
 * 2. Weekly (7-day) Usage allowance & reset tracker
 *
 * Features:
 * - Claude sparkle logo icon prefix
 * - Displays consumed usage % and remaining allowance %
 * - Comprehensive unified hover tooltip showing both 5h and Weekly metrics
 * - Critical and warning visual indicators
 */
import * as vscode from 'vscode';
import {
  ClaudeUsageSnapshot,
  UsageWindow,
  DisplayMode,
  StatusBarFormat,
} from '../models/usage';
import { ConfigurationManager } from '../config/configuration';
import { UsageService } from '../services/usageService';

export class StatusBarManager implements vscode.Disposable {
  private item5h: vscode.StatusBarItem;
  private itemWeekly: vscode.StatusBarItem;
  private isVisible: boolean = true;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly usageService: UsageService,
    private readonly configManager: ConfigurationManager
  ) {
    // 5-Hour item (priority 100.2 so items are tightly grouped)
    this.item5h = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100.2
    );
    this.item5h.name = 'Claude 5-Hour Usage Monitor';

    // Weekly item (priority 100.1)
    this.itemWeekly = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100.1
    );
    this.itemWeekly.name = 'Claude Weekly Usage Monitor';

    // Set initial loading state
    this.setInitialState();

    // Listen to usage updates
    this.disposables.push(
      this.usageService.onDidChangeUsage((snapshot) => {
        this.update(snapshot);
      })
    );

    // Listen to refresh indicators
    this.disposables.push(
      this.usageService.onDidStartRefresh(() => {
        this.showRefreshSpinner();
      })
    );

    // Listen to configuration updates
    this.disposables.push(
      this.configManager.onDidChange(() => {
        const snapshot = this.usageService.getSnapshot();
        if (snapshot) {
          this.update(snapshot);
        }
      })
    );
  }

  /**
   * Toggles overall visibility of status bar items.
   */
  public toggle(): boolean {
    this.isVisible = !this.isVisible;
    if (this.isVisible) {
      const snapshot = this.usageService.getSnapshot();
      if (snapshot) {
        this.update(snapshot);
      } else {
        this.setInitialState();
      }
    } else {
      this.item5h.hide();
      this.itemWeekly.hide();
    }
    return this.isVisible;
  }

  /**
   * Sets initial loading state before first fetch completes.
   */
  private setInitialState(): void {
    const config = this.configManager.get();
    if (!config.enable || !this.isVisible) {
      this.item5h.hide();
      this.itemWeekly.hide();
      return;
    }

    const icon = config.showIcon ? '$(sparkle) ' : '';

    if (config.statusBarLayout === 'single') {
      this.item5h.text = `$(sync~spin) ${icon}Claude: ...`;
      this.item5h.tooltip = 'Claude Usage Monitor: Initializing usage data...';
      this.item5h.command = 'claudeUsage.showDetails';
      this.item5h.show();
      this.itemWeekly.hide();
    } else {
      this.item5h.text = `$(sync~spin) ${icon}Claude 5h: ...`;
      this.item5h.tooltip = 'Claude Usage Monitor: Initializing usage data...';
      this.item5h.command = 'claudeUsage.showDetails';
      this.item5h.show();

      this.itemWeekly.text = `$(sync~spin) ${icon}Claude Weekly: ...`;
      this.itemWeekly.tooltip = 'Claude Usage Monitor: Initializing usage data...';
      this.itemWeekly.command = 'claudeUsage.showDetails';
      this.itemWeekly.show();
    }
  }

  /**
   * Briefly shows a spinning sync icon while refresh is in progress.
   */
  private showRefreshSpinner(): void {
    const snapshot = this.usageService.getSnapshot();
    if (snapshot && (snapshot.fiveHour || snapshot.weekly)) {
      // Don't wipe existing text, refresh spinner will be in tooltip
      return;
    }
    const config = this.configManager.get();
    const icon = config.showIcon ? '$(sparkle) ' : '';
    if (config.statusBarLayout === 'single') {
      this.item5h.text = `$(sync~spin) ${icon}Claude: ...`;
      this.itemWeekly.hide();
    } else {
      this.item5h.text = `$(sync~spin) ${icon}Claude 5h: ...`;
      this.itemWeekly.text = `$(sync~spin) ${icon}Claude Weekly: ...`;
    }
  }

  /**
   * Updates the status bar items from a fresh usage snapshot.
   */
  public update(snapshot: ClaudeUsageSnapshot): void {
    const config = this.configManager.get();

    if (!config.enable || !this.isVisible) {
      this.item5h.hide();
      this.itemWeekly.hide();
      return;
    }

    // Handle Unauthenticated State
    if (!snapshot.auth.isAuthenticated || (!snapshot.fiveHour && !snapshot.weekly)) {
      this.renderUnavailableOrUnauthenticated(snapshot);
      return;
    }

    // Build unified tooltip for both items
    const unifiedTooltip = this.generateUnifiedTooltip(snapshot);

    if (config.statusBarLayout === 'single') {
      this.renderSingleItem(snapshot, config, unifiedTooltip);
    } else {
      this.renderSplitItems(snapshot, config, unifiedTooltip);
    }
  }

  /**
   * Renders a single compact status bar item combining both 5-Hour and Weekly limits.
   * e.g. "$(sparkle) 5h: 53%, Wk: 75%" or with warning: "$(sparkle) 5h: 53%, $(warning) Wk: 75%"
   */
  private renderSingleItem(
    snapshot: ClaudeUsageSnapshot,
    config: ReturnType<ConfigurationManager['get']>,
    unifiedTooltip: vscode.MarkdownString
  ): void {
    const logo = config.showIcon ? '$(sparkle) ' : '';
    const parts: string[] = [];

    // 5-Hour piece
    if (config.show5HourUsage && snapshot.fiveHour) {
      const w5 = snapshot.fiveHour;
      const used5h = Math.round(w5.usedPercentage);
      const rem5h = Math.round(w5.remainingPercentage);

      let icon5h = '';
      if (w5.status === 'exhausted' || w5.status === 'critical') {
        icon5h = '$(error) ';
      } else if (w5.status === 'warning') {
        icon5h = '$(warning) ';
      }

      let text5h = '';
      if (config.displayMode === 'consumed') {
        text5h = `${icon5h}5h: ${used5h}% used`;
      } else if (config.displayMode === 'remaining') {
        text5h = `${icon5h}5h: ${rem5h}% left`;
      } else if (config.statusBarFormat === 'detailed') {
        text5h = `${icon5h}5h: ${used5h}% (${rem5h}% left)`;
      } else {
        // Compact default: concise '5h: 53%'
        text5h = `${icon5h}5h: ${used5h}%`;
      }
      parts.push(text5h);
    }

    // Weekly piece
    if (config.showWeeklyUsage && snapshot.weekly) {
      const wk = snapshot.weekly;
      const usedWk = Math.round(wk.usedPercentage);
      const remWk = Math.round(wk.remainingPercentage);

      let iconWk = '';
      if (wk.status === 'exhausted' || wk.status === 'critical') {
        iconWk = '$(error) ';
      } else if (wk.status === 'warning') {
        iconWk = '$(warning) ';
      }

      let textWk = '';
      if (config.displayMode === 'consumed') {
        textWk = `${iconWk}Wk: ${usedWk}% used`;
      } else if (config.displayMode === 'remaining') {
        textWk = `${iconWk}Wk: ${remWk}% left`;
      } else if (config.statusBarFormat === 'detailed') {
        textWk = `${iconWk}Wk: ${usedWk}% (${remWk}% left)`;
      } else {
        // Compact default: concise 'Wk: 75%'
        textWk = `${iconWk}Wk: ${usedWk}%`;
      }
      parts.push(textWk);
    }

    if (parts.length === 0) {
      this.item5h.hide();
      this.itemWeekly.hide();
      return;
    }

    let fullText = `${logo}${parts.join(', ')}`;
    if (snapshot.isStale) {
      fullText += ' $(watch)';
    }

    this.item5h.text = fullText;
    this.item5h.command = 'claudeUsage.showDetails';
    this.item5h.tooltip = unifiedTooltip;

    // Apply color styling if any window is warning or critical
    const isExhaustedOrCritical =
      (snapshot.fiveHour && (snapshot.fiveHour.status === 'exhausted' || snapshot.fiveHour.status === 'critical')) ||
      (snapshot.weekly && (snapshot.weekly.status === 'exhausted' || snapshot.weekly.status === 'critical'));

    const isWarning =
      (snapshot.fiveHour && snapshot.fiveHour.status === 'warning') ||
      (snapshot.weekly && snapshot.weekly.status === 'warning');

    if (isExhaustedOrCritical) {
      this.item5h.color = new vscode.ThemeColor('statusBarItem.errorForeground');
      this.item5h.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (isWarning) {
      this.item5h.color = new vscode.ThemeColor('statusBarItem.warningForeground');
      this.item5h.backgroundColor = undefined;
    } else {
      this.item5h.color = undefined;
      this.item5h.backgroundColor = undefined;
    }

    this.item5h.show();
    this.itemWeekly.hide();
  }

  /**
   * Renders two separate items in split layout mode.
   */
  private renderSplitItems(
    snapshot: ClaudeUsageSnapshot,
    config: ReturnType<ConfigurationManager['get']>,
    unifiedTooltip: vscode.MarkdownString
  ): void {
    // Render 5-Hour item
    if (config.show5HourUsage && snapshot.fiveHour) {
      this.renderUsageItem(
        this.item5h,
        '5h',
        snapshot.fiveHour,
        config.displayMode,
        config.statusBarFormat,
        config.showIcon,
        snapshot,
        unifiedTooltip
      );
      this.item5h.show();
    } else {
      this.item5h.hide();
    }

    // Render Weekly item
    if (config.showWeeklyUsage && snapshot.weekly) {
      this.renderUsageItem(
        this.itemWeekly,
        'Weekly',
        snapshot.weekly,
        config.displayMode,
        config.statusBarFormat,
        config.showIcon,
        snapshot,
        unifiedTooltip
      );
      this.itemWeekly.show();
    } else {
      this.itemWeekly.hide();
    }
  }

  /**
   * Displays clear Sign In / Unavailable indicator.
   */
  private renderUnavailableOrUnauthenticated(snapshot: ClaudeUsageSnapshot): void {
    const isUnauth = !snapshot.auth.isAuthenticated;
    const config = this.configManager.get();
    const icon = config.showIcon ? '$(sparkle) ' : '';

    this.item5h.text = isUnauth
      ? `$(key) ${icon}Claude Usage: Sign in`
      : `$(circle-slash) ${icon}Claude Usage: Unavailable`;
    this.item5h.command = isUnauth ? 'claudeUsage.signIn' : 'claudeUsage.showDetails';
    this.item5h.color = undefined;
    this.item5h.backgroundColor = undefined;

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportThemeIcons = true;

    if (isUnauth) {
      md.appendMarkdown('### $(key) Claude Usage Monitor: Sign In Required\n\n');
      md.appendMarkdown('The extension could not find an active Claude authentication session.\n\n');
      md.appendMarkdown(
        `- **Details**: ${snapshot.auth.details || 'No credentials found'}\n`
      );
      md.appendMarkdown('\n[Sign in or Configure Token](command:claudeUsage.signIn)');
    } else {
      md.appendMarkdown('### $(warning) Claude Usage Information Unavailable\n\n');
      md.appendMarkdown(
        `${snapshot.errorMessage || 'Unable to retrieve usage limits from provider.'}\n\n`
      );
      md.appendMarkdown('[Retry Refresh](command:claudeUsage.refresh) | [Open Details](command:claudeUsage.showDetails)');
    }

    this.item5h.tooltip = md;
    this.item5h.show();

    // Hide second item so we don't clutter the bar with duplicate pills
    this.itemWeekly.hide();
  }

  /**
   * Renders an individual usage window item (5h or Weekly).
   */
  private renderUsageItem(
    item: vscode.StatusBarItem,
    labelPrefix: '5h' | 'Weekly',
    window: UsageWindow,
    displayMode: DisplayMode,
    format: StatusBarFormat,
    showIcon: boolean,
    snapshot: ClaudeUsageSnapshot,
    tooltip: vscode.MarkdownString
  ): void {
    item.command = 'claudeUsage.showDetails';

    const usedRound = Math.round(window.usedPercentage);
    const remRound = Math.round(window.remainingPercentage);

    // 1. Determine percentage text to display
    let percentText = '';
    if (displayMode === 'consumed') {
      percentText = `${usedRound}% used`;
    } else if (displayMode === 'remaining') {
      percentText = `${remRound}% left`;
    } else {
      // Default: 'both' shows consumed and remaining
      percentText = `${usedRound}% used (${remRound}% left)`;
    }

    // 2. Format label based on user presentation preference
    const logo = showIcon ? '$(sparkle) ' : '';
    let labelText = '';

    if (format === 'icon-only') {
      if (displayMode === 'both') {
        labelText = `${logo}${labelPrefix}: ${usedRound}% / ${remRound}%`;
      } else if (displayMode === 'consumed') {
        labelText = `${logo}${labelPrefix}: ${usedRound}% used`;
      } else {
        labelText = `${logo}${labelPrefix}: ${remRound}% left`;
      }
    } else if (format === 'detailed') {
      const resetNote = window.timeUntilReset !== 'N/A' ? ` · ${window.timeUntilReset}` : '';
      labelText = `${logo}Claude ${labelPrefix}: ${percentText}${resetNote}`;
    } else {
      // Compact default
      labelText = `${logo}Claude ${labelPrefix}: ${percentText}`;
    }

    // 3. Stale indicator if cached data is outdated
    if (snapshot.isStale) {
      labelText += ' $(watch)';
    }

    // 4. Apply warning / critical visual styling
    if (window.status === 'exhausted' || window.status === 'critical') {
      item.text = `$(error) ${labelText}`;
      item.color = new vscode.ThemeColor('statusBarItem.errorForeground');
      item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (window.status === 'warning') {
      item.text = `$(warning) ${labelText}`;
      item.color = new vscode.ThemeColor('statusBarItem.warningForeground');
      item.backgroundColor = undefined;
    } else {
      item.text = labelText;
      item.color = undefined;
      item.backgroundColor = undefined;
    }

    // 5. Attach comprehensive unified tooltip
    item.tooltip = tooltip;
  }

  /**
   * Builds an informative, unified Markdown tooltip showing BOTH 5-Hour and Weekly limits.
   */
  private generateUnifiedTooltip(snapshot: ClaudeUsageSnapshot): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportThemeIcons = true;

    md.appendMarkdown(`### $(sparkle) Claude Usage Limits\n\n`);

    if (snapshot.subscriptionType) {
      md.appendMarkdown(`**Plan**: Claude **${snapshot.subscriptionType.toUpperCase()}**\n\n`);
    }

    md.appendMarkdown(`---\n\n`);

    // 5-Hour window section
    if (snapshot.fiveHour) {
      const w5 = snapshot.fiveHour;
      let statusIcon = '$(check) Normal';
      if (w5.status === 'exhausted') {
        statusIcon = '$(error) Limit Exhausted';
      } else if (w5.status === 'critical') {
        statusIcon = '$(error) Critically Low';
      } else if (w5.status === 'warning') {
        statusIcon = '$(warning) Running Low';
      }

      md.appendMarkdown(`#### $(history) 5-Hour Usage Window\n`);
      md.appendMarkdown(`- **Consumed Usage**: **${w5.usedPercentage}% used**\n`);
      md.appendMarkdown(`- **Remaining Allowance**: **${w5.remainingPercentage}% remaining**\n`);
      md.appendMarkdown(`- **Status**: ${statusIcon}\n`);
      md.appendMarkdown(`- **Resets In**: **${w5.timeUntilReset}** (${w5.resetTimeFormatted})\n\n`);
    }

    // Weekly window section
    if (snapshot.weekly) {
      const wk = snapshot.weekly;
      let statusIcon = '$(check) Normal';
      if (wk.status === 'exhausted') {
        statusIcon = '$(error) Limit Exhausted';
      } else if (wk.status === 'critical') {
        statusIcon = '$(error) Critically Low';
      } else if (wk.status === 'warning') {
        statusIcon = '$(warning) Running Low';
      }

      md.appendMarkdown(`#### $(calendar) Weekly (7-Day) Usage Window\n`);
      md.appendMarkdown(`- **Consumed Usage**: **${wk.usedPercentage}% used**\n`);
      md.appendMarkdown(`- **Remaining Allowance**: **${wk.remainingPercentage}% remaining**\n`);
      md.appendMarkdown(`- **Status**: ${statusIcon}\n`);
      md.appendMarkdown(`- **Resets In**: **${wk.timeUntilReset}** (${wk.resetTimeFormatted})\n\n`);
    }

    // Extra usage / Spend caps if active
    if (snapshot.extraUsage?.isEnabled) {
      const spendUsed = (snapshot.extraUsage.usedCreditsCents / 100).toFixed(2);
      const spendCap = (snapshot.extraUsage.monthlyLimitCents / 100).toFixed(2);
      md.appendMarkdown(`---\n`);
      md.appendMarkdown(
        `**Extra Usage Spend**: $${spendUsed} / $${spendCap} (${snapshot.extraUsage.utilizationPercentage}%)\n\n`
      );
    }

    md.appendMarkdown(`---\n\n`);

    const updateTimeStr = snapshot.timestamp.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });

    if (snapshot.isStale) {
      md.appendMarkdown(`$(watch) *Data may be outdated (last valid: ${updateTimeStr})*\n\n`);
    } else {
      md.appendMarkdown(`*Last updated: ${updateTimeStr}*\n\n`);
    }

    md.appendMarkdown(`[Refresh Now](command:claudeUsage.refresh)  |  [View Full Details](command:claudeUsage.showDetails)`);

    return md;
  }

  public dispose(): void {
    this.item5h.dispose();
    this.itemWeekly.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
