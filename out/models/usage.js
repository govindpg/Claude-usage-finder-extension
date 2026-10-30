"use strict";
/**
 * Claude Usage Monitor - Data Models & Calculation Utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePercentages = calculatePercentages;
exports.evaluateUsageStatus = evaluateUsageStatus;
exports.parseResetDate = parseResetDate;
exports.formatResetTime = formatResetTime;
exports.formatDurationUntil = formatDurationUntil;
/**
 * Calculates used and remaining percentages accurately.
 * Anthropic APIs and headers may provide utilization either as:
 * - A float between 0.0 and 1.0 (e.g., 0.22 for 22%)
 * - A percentage number between 0 and 100 (e.g., 22 or 54)
 * - Exceeding 100% when over limit
 */
function calculatePercentages(raw) {
    if (raw === null || raw === undefined || !Number.isFinite(raw)) {
        return { usedPercentage: 0, remainingPercentage: 100 };
    }
    // Determine if value is normalized (0.0 to 1.0) or already percent (0 to 100+)
    // Note: If raw is > 0 and <= 1.0, Anthropic unified headers provide it as a float fraction.
    // Exception: If raw is exactly 1, it could be 1% or 100%. Anthropic headers format: 0.01 for 1%.
    let used;
    if (raw >= 0 && raw <= 1.0) {
        used = raw * 100;
    }
    else {
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
function evaluateUsageStatus(remainingPercentage, warningThreshold, criticalThreshold) {
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
function parseResetDate(raw) {
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
function formatResetTime(date) {
    if (!date) {
        return 'Unknown';
    }
    const now = new Date();
    const isToday = date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = date.getDate() === tomorrow.getDate() &&
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
function formatDurationUntil(target, fromTime = new Date()) {
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
//# sourceMappingURL=usage.js.map