/**
 * Unit Tests - Usage Calculations & Formatting
 */
import * as assert from 'assert';
import {
  calculatePercentages,
  evaluateUsageStatus,
  formatDurationUntil,
  formatResetTime,
  parseResetDate,
} from '../models/usage';

describe('Usage Calculation Tests', () => {
  it('should handle fractional utilization (0.0 to 1.0)', () => {
    // Anthropic headers send 0.22 for 22%
    const res = calculatePercentages(0.22);
    assert.strictEqual(res.usedPercentage, 22);
    assert.strictEqual(res.remainingPercentage, 78);

    const res2 = calculatePercentages(0.0);
    assert.strictEqual(res2.usedPercentage, 0);
    assert.strictEqual(res2.remainingPercentage, 100);

    const res3 = calculatePercentages(1.0);
    assert.strictEqual(res3.usedPercentage, 100);
    assert.strictEqual(res3.remainingPercentage, 0);
  });

  it('should handle whole percent utilization (0 to 100)', () => {
    // Anthropic API bodies send 64 for 64%
    const res = calculatePercentages(64);
    assert.strictEqual(res.usedPercentage, 64);
    assert.strictEqual(res.remainingPercentage, 36);

    const res2 = calculatePercentages(78.4);
    assert.strictEqual(res2.usedPercentage, 78.4);
    assert.strictEqual(res2.remainingPercentage, 21.6);
  });

  it('should handle over-quota usage (> 100%)', () => {
    const res = calculatePercentages(115);
    assert.strictEqual(res.usedPercentage, 115);
    assert.strictEqual(res.remainingPercentage, 0);
  });

  it('should gracefully handle null, undefined, or NaN inputs', () => {
    const resNull = calculatePercentages(null);
    assert.strictEqual(resNull.usedPercentage, 0);
    assert.strictEqual(resNull.remainingPercentage, 100);

    const resUndef = calculatePercentages(undefined);
    assert.strictEqual(resUndef.usedPercentage, 0);
    assert.strictEqual(resUndef.remainingPercentage, 100);

    const resNan = calculatePercentages(NaN);
    assert.strictEqual(resNan.usedPercentage, 0);
    assert.strictEqual(resNan.remainingPercentage, 100);
  });
});

describe('Status Threshold Evaluation Tests', () => {
  const warning = 25;
  const critical = 10;

  it('should return normal when remaining > warningThreshold', () => {
    assert.strictEqual(evaluateUsageStatus(78, warning, critical), 'normal');
    assert.strictEqual(evaluateUsageStatus(26, warning, critical), 'normal');
  });

  it('should return warning when remaining <= warning and > critical', () => {
    assert.strictEqual(evaluateUsageStatus(25, warning, critical), 'warning');
    assert.strictEqual(evaluateUsageStatus(15, warning, critical), 'warning');
    assert.strictEqual(evaluateUsageStatus(11, warning, critical), 'warning');
  });

  it('should return critical when remaining <= critical and > 0', () => {
    assert.strictEqual(evaluateUsageStatus(10, warning, critical), 'critical');
    assert.strictEqual(evaluateUsageStatus(5, warning, critical), 'critical');
    assert.strictEqual(evaluateUsageStatus(1, warning, critical), 'critical');
  });

  it('should return exhausted when remaining <= 0', () => {
    assert.strictEqual(evaluateUsageStatus(0, warning, critical), 'exhausted');
    assert.strictEqual(evaluateUsageStatus(-5, warning, critical), 'exhausted');
  });
});

describe('Reset Time & Countdown Formatting Tests', () => {
  it('should format duration until future reset', () => {
    const now = new Date('2026-10-30T10:00:00Z');
    // 2 hours 15 mins later
    const future = new Date('2026-10-30T12:15:00Z');
    assert.strictEqual(formatDurationUntil(future, now), '2h 15m');

    // 4 days 3 hours later
    const futureDays = new Date('2026-11-03T13:00:00Z');
    assert.strictEqual(formatDurationUntil(futureDays, now), '4d 3h');

    // 45 minutes later
    const futureMins = new Date('2026-10-30T10:45:00Z');
    assert.strictEqual(formatDurationUntil(futureMins, now), '45m');

    // Past time
    const past = new Date('2026-10-30T09:00:00Z');
    assert.strictEqual(formatDurationUntil(past, now), 'Reset pending');
  });

  it('should parse various reset timestamp representations', () => {
    const iso = '2026-10-30T12:00:00.000Z';
    const parsedIso = parseResetDate(iso);
    assert.ok(parsedIso !== null);
    assert.strictEqual(parsedIso.toISOString(), iso);

    // Unix epoch seconds
    const epochSec = 1793264400;
    const parsedSec = parseResetDate(epochSec);
    assert.ok(parsedSec !== null);
    assert.strictEqual(Math.floor(parsedSec.getTime() / 1000), epochSec);

    // Invalid string
    assert.strictEqual(parseResetDate('invalid-date'), null);
    assert.strictEqual(parseResetDate(null), null);
  });
});
