# Claude Usage Monitor for VS Code

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85.0%2B-blue)](https://code.visualstudio.com)
[![Version](https://img.shields.io/badge/Version-1.0.1-green.svg)](CHANGELOG.md)

A lightweight, reliable, production-ready Visual Studio Code extension that displays your **Claude 5-Hour** and **Weekly** subscription usage allowances directly in the bottom status bar — complete with Claude logo icon, consumed and remaining percentages, live countdowns to reset, visual warning badges, and an interactive dashboard.

---

## ✨ Features

- **Claude AI Sparkle Logo**:
  - Displays the `$(sparkle)` logo icon in the status bar so you can instantly identify Claude usage.
- **Combined Consumed & Remaining Percentages**:
  - Displays both consumed usage and remaining allowance simultaneously:
    `$(sparkle) Claude 5h: 53% used (47% left)`
    `$(sparkle) Claude Weekly: 75% used (25% left)`
- **Unified Hover Tooltip**:
  - Hovering either status bar item reveals a complete, unified overview of **both** 5-Hour and Weekly windows with used %, remaining %, reset countdowns, and plan status.
- **Flexible Display Modes**:
  - **Both** (default): `Claude 5h: 53% used (47% left)`
  - **Consumed Usage**: `Claude 5h: 53% used`
  - **Remaining Allowance**: `Claude 5h: 47% left`
  - **Compact / Detailed / Icon-only** formats.
- **Tightly Grouped Status Bar Items**:
  - Priority alignment (`100.2` and `100.1`) ensures the 5h and Weekly items stay side-by-side without interference from other extensions.
- **Smart Warning Indicators**:
  - Displays `$(warning)` in amber when remaining allowance drops below the warning threshold (default: 25%).
  - Displays `$(error)` in red with error highlighting when allowance reaches critical levels (default: 10%).
- **Interactive Reset Countdowns**:
  - Tooltips and dashboard calculate real-time countdowns until usage resets (e.g. `Resets in 2h 33m`, `Tomorrow at 1:59 am`).
- **Rich Dashboard Webview**:
  - Click any status bar item or run `Claude Usage: Show Detailed Usage` to open a clean dashboard with animated progress bars, plan tier details, and spend caps.
- **Zero-Friction Authentication**:
  - Automatically reuses your existing local Claude Code CLI credentials (`~/.claude/.credentials.json` or `~/.config/Claude/.credentials.json`).
  - Supports environment variables (`CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_AUTH_TOKEN`).
  - Allows manual, encrypted token entry stored inside VS Code's secure `SecretStorage`.
- **Automatic Background Refresh**:
  - Automatically updates approximately every 60 seconds (configurable from 15s to 3600s).
  - Automatically updates when VS Code launches and when the editor regains focus.
  - Concurrency-safe: eliminates duplicate or overlapping requests.
  - Graceful fallback: caches and retains the last valid data with a stale indicator if temporary network issues occur.

---

## 📸 Status Bar Examples

| State | Status Bar Appearance (Single Item Default) | Split Layout (`claudeUsage.statusBarLayout: "split"`) |
|---|---|---|
| **Default (Compact Both)** | `$(sparkle) 5h: 53%, Wk: 75%` | `$(sparkle) Claude 5h: 53% used (47% left)` + `$(sparkle) Claude Weekly: 75% used (25% left)` |
| **Consumed Mode** | `$(sparkle) 5h: 53% used, Wk: 75% used` | `$(sparkle) Claude 5h: 53% used` + `$(sparkle) Claude Weekly: 75% used` |
| **Remaining Mode** | `$(sparkle) 5h: 47% left, Wk: 25% left` | `$(sparkle) Claude 5h: 47% left` + `$(sparkle) Claude Weekly: 25% left` |
| **Warning Threshold** | `$(sparkle) 5h: 53%, $(warning) Wk: 75%` | `$(sparkle) Claude 5h: 53% used (47% left)` + `$(warning) $(sparkle) Claude Weekly: 75% used (25% left)` |
| **Critical Threshold** | `$(error) $(sparkle) 5h: 95%, Wk: 75%` | `$(error) $(sparkle) Claude 5h: 95% used (5% left)` + `Claude Weekly: ...` |
| **Unauthenticated** | `$(key) $(sparkle) Claude Usage: Sign in` | `$(key) $(sparkle) Claude Usage: Sign in` |

*Hovering any status bar item opens a rich tooltip with full countdowns (`Resets in 2h 22m`), exact reset timestamps (`Tomorrow at 2:00 am`), and percentage metrics for both windows.*

---

## 🚀 Installation

### Option 1: Install from VS Code GUI

1. Open VS Code.
2. Go to the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3. Click the three dots (`...`) in the top-right corner of the Extensions panel.
4. Select **Install from VSIX...**.
5. Choose `claude-usage-monitor-1.0.2.vsix`.
6. Reload VS Code if prompted.

### Option 2: Install via Terminal

Run the following command in your terminal:

```bash
code --install-extension claude-usage-monitor-1.0.2.vsix
```

To distribute to teammates or coworkers, share the `claude-usage-monitor-1.0.2.vsix` file. They can install it instantly without needing to compile from source.

---

## 🔑 Authentication Setup

The extension seamlessly integrates with your existing Claude session using any of the following methods:

1. **Automatic Discovery (Recommended)**:
   If you have already used the official Claude Code CLI (`claude auth login`), the extension automatically detects and reads your session credentials from:
   - Linux: `~/.claude/.credentials.json` or `~/.config/Claude/.credentials.json`
   - macOS: `~/Library/Application Support/Claude/.credentials.json`
   - Windows: `%APPDATA%\Claude\.credentials.json`
2. **Environment Variable**:
   Set `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_AUTH_TOKEN` in your environment.
3. **Manual Token Storage (Encrypted)**:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P`).
   - Run command: `Claude Usage: Enter OAuth / Session Token Manually`.
   - Paste your token. It is encrypted in VS Code's native `SecretStorage`.

---

## ⚙️ Configuration Settings

Customize behavior via VS Code Settings (`Ctrl+,` or `Cmd+,` and search `Claude Usage`):

| Setting | Default | Description |
|---|---|---|
| `claudeUsage.enable` | `true` | Master toggle for the extension. |
| `claudeUsage.statusBarLayout` | `"single"` | Choose `"single"` for space-saving combined window (`$(sparkle) 5h: 53%, Wk: 75%`) or `"split"` for two separate items. |
| `claudeUsage.showIcon` | `true` | Display the Claude AI sparkle logo in the status bar. |
| `claudeUsage.displayMode` | `"both"` | Display mode: `"both"` (default), `"consumed"` (used only), or `"remaining"` (left only). |
| `claudeUsage.show5HourUsage` | `true` | Show or hide the 5-hour indicator in the status bar. |
| `claudeUsage.showWeeklyUsage` | `true` | Show or hide the weekly indicator in the status bar. |
| `claudeUsage.refreshInterval` | `60` | Auto-refresh interval in seconds (min: 15, max: 3600). |
| `claudeUsage.warningThreshold` | `25` | Percentage threshold below which amber warning is shown. |
| `claudeUsage.criticalThreshold` | `10` | Percentage threshold below which red critical alert is shown. |
| `claudeUsage.statusBarFormat` | `"compact"` | Format: `"compact"` (`5h: 53%, Wk: 75%`), `"detailed"` (includes left % and reset), `"icon-only"`. |
| `claudeUsage.autoRefresh` | `true` | Enable or disable periodic background refreshes. |
| `claudeUsage.customCredentialsPath` | `""` | Optional manual path to `.credentials.json`. |

---

## ⌨️ Command Palette

Access these commands anytime via `Ctrl+Shift+P` / `Cmd+Shift+P`:

- **Claude Usage: Refresh**: Forces an immediate refresh of usage data.
- **Claude Usage: Show Detailed Usage**: Opens the detailed visual dashboard.
- **Claude Usage: Toggle Status Bar Indicators**: Quick toggle for status bar items.
- **Claude Usage: Reset Cache and Refresh**: Clears cached data and fetches fresh stats.
- **Claude Usage: Open Settings**: Direct shortcut to extension settings.
- **Claude Usage: Sign In / Account Guidance**: Interactive authentication setup wizard.
- **Claude Usage: Enter OAuth / Session Token Manually**: Secure token input.
- **Claude Usage: Clear Stored Credentials**: Removes any manually saved credentials.

---

## 🏗️ Architecture & Data Provider

The extension is architected around an extensible, test-driven provider model:

```
┌────────────────────────────────────────────────────────┐
│                   VS Code Status Bar                   │
│   [ Claude 5h: 78% ]         [ Claude Weekly: 64% ]    │
└───────────────▲────────────────────────▲───────────────┘
                │                        │
        StatusBarManager          UsageWebview
                │                        │
                └───────────┬────────────┘
                            │
                      UsageService
              (Caching, Timer, Mutex, Events)
                            │
                   ClaudeUsageProvider
                            │
         ┌──────────────────┴──────────────────┐
         │                                     │
OAuthApiUsageProvider                  CliUsageProvider
  (Primary HTTP)                         (Diagnostics)
  GET /api/oauth/usage                   `claude auth status`
  RateLimit Headers                      Local Binary Path
```

- **Accurate Ground Truth**: Connects directly to Anthropic's subscription rate-limiting endpoints (`/api/oauth/usage` and `anthropic-ratelimit-unified-*` headers).
- **No Token Approximations**: Does not fabricate tokens or substitute API billing for subscription usage.
- **Zero External Runtime Dependencies**: Built entirely with native Node.js and the VS Code Extension API for maximum speed, security, and low memory consumption.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
