/**
 * Claude Usage Monitor - Data Models & Calculation Utilities
 */

export type DisplayMode = 'both' | 'consumed' | 'remaining';
export type StatusBarFormat = 'compact' | 'detailed' | 'icon-only';
export type SubscriptionTier = 'pro' | 'team' | 'max' | 'custom' | 'unknown';
export type UsageStatus = 'normal' | 'warning' | 'critical' | 'exhausted' | 'unknown';

export interface UsageWindow {
  /** Raw utilization fraction or percentage returned by provider */
  rawUtilization: number;
  /** Calculated used percentage (0 - 100+) */
  usedPercentage: number;
  /** Calculated remaining percentage (0 - 100) */
  remainingPercentage: number;
  /** When this usage window resets */
  resetsAt: Date | null;
  /** Formatted human-readable reset time (e.g. "11:45 PM" or "Oct 30, 2:00 AM") */
  resetTimeFormatted: string;
  /** Time remaining until reset (e.g. "1h 42m" or "3d 4h") */
  timeUntilReset: string;
  /** Status based on thresholds */
  status: UsageStatus;
}

export interface ExtraUsageInfo {
  isEnabled: boolean;
  monthlyLimitCents: number;
  usedCreditsCents: number;
  utilizationPercentage: number;
  currency: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  authMethod: 'oauth_credentials' | 'secret_storage' | 'environment' | 'cli' | 'none';
  accountEmail?: string | null;
  organizationUuid?: string | null;
  subscriptionType?: string | null;
  rateLimitTier?: string | null;
  details?: string;
  isExpired?: boolean;
  expiresAt?: Date | null;
}

export interface ClaudeUsageSnapshot {
  /** Timestamp when snapshot was captured */
  timestamp: Date;
  /** 5-hour sliding rate limit window */
  fiveHour: UsageWindow | null;
  /** Weekly sliding rate limit window */
  weekly: UsageWindow | null;
  /** Additional spend / credit overage information */
  extraUsage?: ExtraUsageInfo | null;
  /** Subscription metadata */
  subscriptionType: string | null;
  rateLimitTier: string | null;
  /** Authentication status at time of fetch */
  auth: AuthStatus;
  /** Whether this snapshot is served from cache */
  isCached: boolean;
  /** Whether this snapshot is stale (refresh failed, previous data retained) */
  isStale: boolean;
  /** Any error message or warning from last refresh */
  errorMessage?: string;
  /** Raw response or provider identifier */
  providerName: string;
}

/**
 * Calculates used and remaining percentages accurately.
 * Anthropic APIs and headers may provide utilization either as:
 * - A float between 0.0 and 1.0 (e.g., 0.22 for 22%)
 * - A percentage number between 0 and 100 (e.g., 22 or 54)
 * - Exceeding 100% when over limit
 */
export function calculatePercentages(raw: number | null | undefined): {
  usedPercentage: number;
  remainingPercentage: number;
} {
  if (raw === null || raw === undefined || !Number.isFinite(raw)) {
    return { usedPercentage: 0, remainingPercentage: 100 };
  }

  // Determine if value is normalized (0.0 to 1.0) or already percent (0 to 100+)
  // Note: If raw is > 0 and <= 1.0, Anthropic unified headers provide it as a float fraction.
  // Exception: If raw is exactly 1, it could be 1% or 100%. Anthropic headers format: 0.01 for 1%.
  let used: number;
  if (raw >= 0 && raw <= 1.0) {
    used = raw * 100;
  } else {
    used = raw;
  }

  // Round used to 1 decimal place
  used = Math.round(used * 10) / 10;
  if (used < 0) {
    used = 0;
  }

  // Calculate remaining
  let remaining = Math.round((100 - used) * 10) / 10;
  if (remaining < 0) {
    remaining = 0;
  }
  if (remaining > 100) {
    remaining = 100;
  }

  return { usedPercentage: used, remainingPercentage: remaining };
}

/**
 * Evaluates the status based on remaining percentage and user thresholds
 */
export function evaluateUsageStatus(
  remainingPercentage: number,
  warningThreshold: number,
  criticalThreshold: number
): UsageStatus {
  if (remainingPercentage <= 0) {
    return 'exhausted';
  }
  if (remainingPercentage <= criticalThreshold) {
    return 'critical';
  }
  if (remainingPercentage <= warningThreshold) {
    return 'warning';
  }
  return 'normal';
}

/**
 * Parses and normalizes reset date from ISO string, Unix epoch seconds or ms.
 */
export function parseResetDate(raw: string | number | null | undefined): Date | null {
  if (!raw) {
    return null;
  }
  if (typeof raw === 'number') {
    // If < 10 billion, it's seconds; otherwise milliseconds
    const ms = raw < 10000000000 ? raw * 1000 : raw;
    const date = new Date(ms);
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof raw === 'string') {
    // Try numeric string
    const num = Number(raw);
    if (!isNaN(num) && num > 0) {
      const ms = num < 10000000000 ? num * 1000 : num;
      const date = new Date(ms);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    // Try ISO-8601 string
    const parsed = Date.parse(raw);
    if (!isNaN(parsed)) {
      return new Date(parsed);
    }
  }
  return null;
}

/**
 * Formats a Date object into a readable local time string.
 */
export function formatResetTime(date: Date | null): string {
  if (!date) {
    return 'Unknown';
  }

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  const timeStr = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return `Today at ${timeStr}`;
  }
  if (isTomorrow) {
    return `Tomorrow at ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  return `${dateStr}, ${timeStr}`;
}

/**
 * Formats duration between now and target date into human-readable countdown.
 */
export function formatDurationUntil(target: Date | null, fromTime: Date = new Date()): string {
  if (!target) {
    return 'N/A';
  }

  const diffMs = target.getTime() - fromTime.getTime();
  if (diffMs <= 0) {
    return 'Reset pending';
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return '< 1m';
}
