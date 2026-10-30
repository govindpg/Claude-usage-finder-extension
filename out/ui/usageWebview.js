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
exports.UsageWebviewManager = void 0;
/**
 * Claude Usage Monitor - Detailed Usage Webview & Quick Pick
 *
 * Implements a responsive, VS Code theme-compliant dashboard displaying:
 * - 5-Hour usage limits & reset countdown
 * - Weekly usage limits & reset countdown
 * - Progress bars & threshold indicators
 * - Account authentication details
 * - Interactive refresh and settings actions
 */
const vscode = __importStar(require("vscode"));
class UsageWebviewManager {
    context;
    usageService;
    authService;
    currentPanel = null;
    disposables = [];
    constructor(context, usageService, authService) {
        this.context = context;
        this.usageService = usageService;
        this.authService = authService;
        // Listen for usage changes to update webview content live
        this.disposables.push(this.usageService.onDidChangeUsage((snapshot) => {
            if (this.currentPanel) {
                this.currentPanel.webview.html = this.generateHtml(snapshot);
            }
        }));
    }
    /**
     * Opens or reveals the detailed usage Webview panel.
     */
    async showDetails() {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : vscode.ViewColumn.One;
        if (this.currentPanel) {
            this.currentPanel.reveal(column);
            // Trigger a soft refresh to ensure latest numbers
            const snapshot = this.usageService.getSnapshot();
            if (snapshot) {
                this.currentPanel.webview.html = this.generateHtml(snapshot);
            }
            return;
        }
        this.currentPanel = vscode.window.createWebviewPanel('claudeUsageDetails', 'Claude Usage Monitor', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        this.currentPanel.iconPath = {
            light: vscode.Uri.file(this.context.asAbsolutePath('media/icon.png')),
            dark: vscode.Uri.file(this.context.asAbsolutePath('media/icon.png')),
        };
        // Handle messages from Webview script
        this.currentPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'refresh':
                    await this.usageService.refresh(true);
                    break;
                case 'openSettings':
                    await vscode.commands.executeCommand('claudeUsage.openSettings');
                    break;
                case 'signIn':
                    await vscode.commands.executeCommand('claudeUsage.signIn');
                    break;
                case 'resetCache':
                    await this.usageService.resetCache();
                    break;
            }
        }, null, this.disposables);
        this.currentPanel.onDidDispose(() => {
            this.currentPanel = null;
        }, null, this.disposables);
        // Initial render
        let snapshot = this.usageService.getSnapshot();
        if (!snapshot) {
            snapshot = await this.usageService.refresh(false);
        }
        this.currentPanel.webview.html = this.generateHtml(snapshot);
    }
    /**
     * Fallback QuickPick interface for fast keyboard-driven inspection
     */
    async showQuickPick() {
        const snapshot = this.usageService.getSnapshot() || (await this.usageService.refresh(false));
        const items = [];
        if (snapshot.fiveHour) {
            items.push({
                label: `$(history) 5-Hour Usage: ${snapshot.fiveHour.remainingPercentage}% remaining`,
                description: `${snapshot.fiveHour.usedPercentage}% used · Status: ${snapshot.fiveHour.status.toUpperCase()}`,
                detail: `Resets in ${snapshot.fiveHour.timeUntilReset} (${snapshot.fiveHour.resetTimeFormatted})`,
            });
        }
        if (snapshot.weekly) {
            items.push({
                label: `$(calendar) Weekly Usage: ${snapshot.weekly.remainingPercentage}% remaining`,
                description: `${snapshot.weekly.usedPercentage}% used · Status: ${snapshot.weekly.status.toUpperCase()}`,
                detail: `Resets in ${snapshot.weekly.timeUntilReset} (${snapshot.weekly.resetTimeFormatted})`,
            });
        }
        if (!snapshot.fiveHour && !snapshot.weekly) {
            items.push({
                label: '$(key) Sign In Required',
                description: snapshot.auth.details || 'No credentials found',
                detail: 'Click to configure your Claude Code authentication',
            });
        }
        items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
        items.push({
            label: '$(sync) Refresh Now',
            description: 'Fetch latest usage from Claude',
        });
        items.push({
            label: '$(browser) Open Full Dashboard',
            description: 'Open visual usage view with charts',
        });
        items.push({
            label: '$(gear) Configure Settings',
            description: 'Change intervals, thresholds, and display mode',
        });
        const chosen = await vscode.window.showQuickPick(items, {
            title: 'Claude Usage Monitor',
            placeHolder: 'Select an action or review your current limits',
        });
        if (!chosen) {
            return;
        }
        if (chosen.label.includes('Refresh Now')) {
            await this.usageService.refresh(true);
        }
        else if (chosen.label.includes('Open Full Dashboard')) {
            await this.showDetails();
        }
        else if (chosen.label.includes('Configure Settings')) {
            await vscode.commands.executeCommand('claudeUsage.openSettings');
        }
        else if (chosen.label.includes('Sign In Required')) {
            await vscode.commands.executeCommand('claudeUsage.signIn');
        }
    }
    /**
     * Generates clean, accessible, VS Code-themed HTML for the webview.
     */
    generateHtml(snapshot) {
        const isAuth = snapshot.auth.isAuthenticated;
        const isRefreshing = this.usageService.getIsRefreshing();
        const fiveHourCard = snapshot.fiveHour
            ? this.renderWindowCard('5-Hour Usage Window', snapshot.fiveHour, 'history')
            : this.renderEmptyWindowCard('5-Hour Usage Window', 'No 5-hour limit data available');
        const weeklyCard = snapshot.weekly
            ? this.renderWindowCard('Weekly (7-Day) Usage Window', snapshot.weekly, 'calendar')
            : this.renderEmptyWindowCard('Weekly (7-Day) Usage Window', 'No weekly limit data available');
        const lastUpdated = snapshot.timestamp.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
        });
        let extraUsageHtml = '';
        if (snapshot.extraUsage?.isEnabled) {
            const spent = (snapshot.extraUsage.usedCreditsCents / 100).toFixed(2);
            const cap = (snapshot.extraUsage.monthlyLimitCents / 100).toFixed(2);
            extraUsageHtml = `
        <div class="card">
          <div class="card-header">
            <h3>Extra Usage & Spend Cap</h3>
            <span class="badge badge-normal">${snapshot.extraUsage.utilizationPercentage}% used</span>
          </div>
          <div class="stat-grid">
            <div class="stat-item">
              <span class="stat-label">Used Spend</span>
              <span class="stat-value">$${spent} ${snapshot.extraUsage.currency}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Monthly Limit</span>
              <span class="stat-value">$${cap} ${snapshot.extraUsage.currency}</span>
            </div>
          </div>
          <div class="progress-container">
            <div class="progress-bar progress-normal" style="width: ${Math.min(100, snapshot.extraUsage.utilizationPercentage)}%;"></div>
          </div>
        </div>
      `;
        }
        let staleWarning = '';
        if (snapshot.isStale) {
            staleWarning = `
        <div class="banner banner-warning">
          <strong>Notice:</strong> Retaining last valid usage data. ${snapshot.errorMessage || 'Live update failed.'}
        </div>
      `;
        }
        else if (snapshot.errorMessage && !isAuth) {
            staleWarning = `
        <div class="banner banner-error">
          <strong>Authentication Issue:</strong> ${snapshot.errorMessage}
        </div>
      `;
        }
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Usage Monitor</title>
  <style>
    :root {
      --font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      --bg-color: var(--vscode-editor-background, #1e1e1e);
      --fg-color: var(--vscode-editor-foreground, #d4d4d4);
      --card-bg: var(--vscode-sideBar-background, #252526);
      --card-border: var(--vscode-widget-border, #3c3c3c);
      --button-bg: var(--vscode-button-background, #0e639c);
      --button-fg: var(--vscode-button-foreground, #ffffff);
      --button-hover: var(--vscode-button-hoverBackground, #1177bb);
      --button-sec-bg: var(--vscode-button-secondaryBackground, #3a3d41);
      --button-sec-fg: var(--vscode-button-secondaryForeground, #ffffff);
      --button-sec-hover: var(--vscode-button-secondaryHoverBackground, #45494e);
      --color-normal: #4ec9b0;
      --color-warning: #cca700;
      --color-critical: #f14c4c;
      --color-exhausted: #e51400;
      --border-radius: 8px;
    }

    body {
      font-family: var(--font-family);
      background-color: var(--bg-color);
      color: var(--fg-color);
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
      line-height: 1.5;
    }

    .container {
      max-width: 760px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
    }

    h1 {
      font-size: 1.4rem;
      font-weight: 600;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-actions {
      display: flex;
      gap: 10px;
    }

    button {
      background-color: var(--button-bg);
      color: var(--button-fg);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease;
    }

    button:hover {
      background-color: var(--button-hover);
    }

    button.secondary {
      background-color: var(--button-sec-bg);
      color: var(--button-sec-fg);
    }

    button.secondary:hover {
      background-color: var(--button-sec-hover);
    }

    .banner {
      padding: 12px 16px;
      border-radius: var(--border-radius);
      margin-bottom: 20px;
      font-size: 0.9rem;
    }

    .banner-warning {
      background-color: rgba(204, 167, 0, 0.15);
      border: 1px solid rgba(204, 167, 0, 0.4);
      color: var(--color-warning);
    }

    .banner-error {
      background-color: rgba(241, 76, 76, 0.15);
      border: 1px solid rgba(241, 76, 76, 0.4);
      color: var(--color-critical);
    }

    .cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }

    @media (max-width: 600px) {
      .cards-grid {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--border-radius);
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .card-header h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 600;
    }

    .badge {
      font-size: 0.75rem;
      padding: 3px 8px;
      border-radius: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-normal {
      background-color: rgba(78, 201, 176, 0.2);
      color: var(--color-normal);
      border: 1px solid var(--color-normal);
    }

    .badge-warning {
      background-color: rgba(204, 167, 0, 0.2);
      color: var(--color-warning);
      border: 1px solid var(--color-warning);
    }

    .badge-critical {
      background-color: rgba(241, 76, 76, 0.2);
      color: var(--color-critical);
      border: 1px solid var(--color-critical);
    }

    .badge-exhausted {
      background-color: rgba(229, 20, 0, 0.25);
      color: var(--color-exhausted);
      border: 1px solid var(--color-exhausted);
    }

    .percent-main {
      font-size: 2.2rem;
      font-weight: 700;
      margin-bottom: 6px;
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .percent-sub {
      font-size: 0.85rem;
      color: var(--vscode-descriptionForeground, #888);
      font-weight: 400;
    }

    .progress-container {
      background-color: rgba(255, 255, 255, 0.08);
      height: 10px;
      border-radius: 5px;
      overflow: hidden;
      margin: 14px 0 16px 0;
    }

    .progress-bar {
      height: 100%;
      border-radius: 5px;
      transition: width 0.4s ease;
    }

    .progress-normal { background-color: var(--color-normal); }
    .progress-warning { background-color: var(--color-warning); }
    .progress-critical { background-color: var(--color-critical); }
    .progress-exhausted { background-color: var(--color-exhausted); }

    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      font-size: 0.85rem;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
    }

    .stat-label {
      color: var(--vscode-descriptionForeground, #888);
      font-size: 0.75rem;
    }

    .stat-value {
      font-weight: 600;
      margin-top: 2px;
    }

    .meta-card {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--border-radius);
      padding: 18px 20px;
      font-size: 0.85rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .meta-list {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }

    .meta-item {
      display: flex;
      gap: 6px;
    }

    .meta-label {
      color: var(--vscode-descriptionForeground, #888);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        Claude Usage Monitor
      </h1>
      <div class="header-actions">
        <button id="btnRefresh" ${isRefreshing ? 'disabled' : ''}>
          ${isRefreshing ? 'Refreshing...' : 'Refresh Now'}
        </button>
        <button class="secondary" id="btnSettings">Settings</button>
      </div>
    </header>

    ${staleWarning}

    <div class="cards-grid">
      ${fiveHourCard}
      ${weeklyCard}
    </div>

    ${extraUsageHtml}

    <div class="meta-card">
      <div class="meta-list">
        <div class="meta-item">
          <span class="meta-label">Status:</span>
          <strong>${isAuth ? 'Authenticated' : 'Not Connected'}</strong>
        </div>
        <div class="meta-item">
          <span class="meta-label">Source:</span>
          <span>${snapshot.auth.details || snapshot.providerName}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Plan Tier:</span>
          <span>${snapshot.subscriptionType ? snapshot.subscriptionType.toUpperCase() : 'Default'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Last Updated:</span>
          <span>${lastUpdated}</span>
        </div>
      </div>
      <div>
        ${!isAuth
            ? '<button id="btnSignIn">Sign In / Configure Token</button>'
            : '<button class="secondary" id="btnResetCache">Reset Cache</button>'}
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    document.getElementById('btnRefresh')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });

    document.getElementById('btnSettings')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openSettings' });
    });

    document.getElementById('btnSignIn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'signIn' });
    });

    document.getElementById('btnResetCache')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'resetCache' });
    });
  </script>
</body>
</html>`;
    }
    renderWindowCard(title, window, icon) {
        const isExhausted = window.status === 'exhausted';
        const isCritical = window.status === 'critical';
        const isWarning = window.status === 'warning';
        const statusBadgeClass = isExhausted
            ? 'badge-exhausted'
            : isCritical
                ? 'badge-critical'
                : isWarning
                    ? 'badge-warning'
                    : 'badge-normal';
        const progressBarClass = isExhausted
            ? 'progress-exhausted'
            : isCritical
                ? 'progress-critical'
                : isWarning
                    ? 'progress-warning'
                    : 'progress-normal';
        return `
      <div class="card">
        <div class="card-header">
          <h3>${title}</h3>
          <span class="badge ${statusBadgeClass}">${window.status}</span>
        </div>

        <div class="percent-main">
          <span>${window.remainingPercentage}%</span>
          <span class="percent-sub">remaining allowance</span>
        </div>

        <div class="progress-container">
          <div class="progress-bar ${progressBarClass}" style="width: ${Math.min(100, window.usedPercentage)}%;"></div>
        </div>

        <div class="stat-grid">
          <div class="stat-item">
            <span class="stat-label">Consumed Usage</span>
            <span class="stat-value">${window.usedPercentage}% used</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Resets In</span>
            <span class="stat-value">${window.timeUntilReset}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Reset Timestamp</span>
            <span class="stat-value">${window.resetTimeFormatted}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Allowance State</span>
            <span class="stat-value">${isExhausted ? 'Blocked' : 'Active'}</span>
          </div>
        </div>
      </div>
    `;
    }
    renderEmptyWindowCard(title, reason) {
        return `
      <div class="card">
        <div class="card-header">
          <h3>${title}</h3>
          <span class="badge badge-normal">No Data</span>
        </div>
        <p style="color: var(--vscode-descriptionForeground); margin: 24px 0;">${reason}</p>
        <button class="secondary" onclick="vscode.postMessage({ command: 'refresh' })">Check Again</button>
      </div>
    `;
    }
    dispose() {
        if (this.currentPanel) {
            this.currentPanel.dispose();
            this.currentPanel = null;
        }
        this.disposables.forEach((d) => d.dispose());
    }
}
exports.UsageWebviewManager = UsageWebviewManager;
//# sourceMappingURL=usageWebview.js.map