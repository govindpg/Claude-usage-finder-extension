# Changelog

All notable changes to the **Claude Usage Monitor** extension will be documented in this file.

## [1.0.2] - 2026-10-29

### Added & Improved
- **Single Compact Status Bar Window (Default)**:
  - Replaced the extended two-item layout with a single consolidated status bar item: `$(sparkle) 5h: 53%, Wk: 75%` (or `$(sparkle) 5h: 53% used, Wk: 75% used` in consumed mode).
  - Eliminates status bar bloat and preserves horizontal space while keeping both 5-hour and weekly limits visible at a single glance.
  - Granular per-window warning icons (e.g. `$(sparkle) 5h: 53%, $(warning) Wk: 75%`) when individual thresholds are exceeded.
  - Retains split layout option via configuration `claudeUsage.statusBarLayout: "split"`.
- **Unified Tooltip & Interactive Dashboard**:
  - Full breakdown of both limits, remaining percentages, and reset countdowns remains instantly accessible on hover or click.

## [1.0.1] - 2026-10-29

### Added & Improved
- **Combined Consumed & Remaining Status Bar Display**:
  - Displays both consumed and remaining percentages simultaneously (e.g., `$(sparkle) Claude 5h: 53% used (47% left)` and `$(sparkle) Claude Weekly: 75% used (25% left)`).
  - Configurable via `claudeUsage.displayMode` (`both`, `consumed`, `remaining`).
- **Claude AI Sparkle Logo**:
  - Added identifiable `$(sparkle)` logo icon to both status bar items (toggleable via `claudeUsage.showIcon`).
- **Unified Hover Tooltip**:
  - Hovering either status bar item now shows a comprehensive overview of **both** 5-Hour and Weekly windows with consumed %, remaining %, reset countdowns, and plan status in a single unified tooltip.
- **Tightly Grouped Status Bar Placement**:
  - Adjusted priority alignment (`100.2` and `100.1`) so that 5h and Weekly items stay side-by-side without other extension items slipping between them.

## [1.0.0] - 2026-10-29

### Added
- **Dual Status Bar Items**:
  - 5-hour rate limit allowance tracker (`Claude 5h: 78%`).
  - Weekly rate limit allowance tracker (`Claude Weekly: 64%`).
- **Configurable Display Modes**:
  - Support for displaying remaining allowance (`78%`) or consumed usage (`22% used`).
  - Formats for compact, detailed (with reset countdowns), and icon-only layouts.
- **Visual Warnings**:
  - Amber warning indicators when remaining allowance falls below `warningThreshold` (25%).
  - Red critical indicators and background badges when remaining allowance falls below `criticalThreshold` (10%).
- **Interactive Reset Timers**:
  - Live countdown calculation until each sliding window resets.
- **Detailed Usage Dashboard**:
  - Interactive Webview dashboard matching VS Code dark/light themes.
  - Animated progress bars for 5-hour and weekly windows.
  - Support for Spend Caps and extra usage reporting.
  - Quick keyboard-accessible QuickPick interface fallback.
- **Authentication Discovery**:
  - Automatic detection of local Claude Code CLI credentials across Linux, macOS, and Windows.
  - Environment variable fallback (`CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_AUTH_TOKEN`).
  - Native VS Code `SecretStorage` for manual encrypted credential storage.
  - Seamless "Sign In" status bar pill with interactive guidance when not authenticated.
- **Concurrency & Caching**:
  - Mutex-locked refresh scheduling.
  - Periodic background auto-refresh (default: 60s).
  - Stale-while-revalidate fallback behavior ensuring status bar never flickers or drops data during temporary network interruptions.
- **Unit Test Suite**:
  - 19 test cases covering percentage arithmetic, threshold evaluation, date formatters, caching, and status bar rendering.
