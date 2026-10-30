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
/**
 * Unit Tests - Usage Calculations & Formatting
 */
const assert = __importStar(require("assert"));
const usage_1 = require("../models/usage");
describe('Usage Calculation Tests', () => {
    it('should handle fractional utilization (0.0 to 1.0)', () => {
        // Anthropic headers send 0.22 for 22%
        const res = (0, usage_1.calculatePercentages)(0.22);
        assert.strictEqual(res.usedPercentage, 22);
        assert.strictEqual(res.remainingPercentage, 78);
        const res2 = (0, usage_1.calculatePercentages)(0.0);
        assert.strictEqual(res2.usedPercentage, 0);
        assert.strictEqual(res2.remainingPercentage, 100);
        const res3 = (0, usage_1.calculatePercentages)(1.0);
        assert.strictEqual(res3.usedPercentage, 100);
        assert.strictEqual(res3.remainingPercentage, 0);
    });
    it('should handle whole percent utilization (0 to 100)', () => {
        // Anthropic API bodies send 64 for 64%
        const res = (0, usage_1.calculatePercentages)(64);
        assert.strictEqual(res.usedPercentage, 64);
        assert.strictEqual(res.remainingPercentage, 36);
        const res2 = (0, usage_1.calculatePercentages)(78.4);
        assert.strictEqual(res2.usedPercentage, 78.4);
        assert.strictEqual(res2.remainingPercentage, 21.6);
    });
    it('should handle over-quota usage (> 100%)', () => {
        const res = (0, usage_1.calculatePercentages)(115);
        assert.strictEqual(res.usedPercentage, 115);
        assert.strictEqual(res.remainingPercentage, 0);
    });
    it('should gracefully handle null, undefined, or NaN inputs', () => {
        const resNull = (0, usage_1.calculatePercentages)(null);
        assert.strictEqual(resNull.usedPercentage, 0);
        assert.strictEqual(resNull.remainingPercentage, 100);
        const resUndef = (0, usage_1.calculatePercentages)(undefined);
        assert.strictEqual(resUndef.usedPercentage, 0);
        assert.strictEqual(resUndef.remainingPercentage, 100);
        const resNan = (0, usage_1.calculatePercentages)(NaN);
        assert.strictEqual(resNan.usedPercentage, 0);
        assert.strictEqual(resNan.remainingPercentage, 100);
    });
});
describe('Status Threshold Evaluation Tests', () => {
    const warning = 25;
    const critical = 10;
    it('should return normal when remaining > warningThreshold', () => {
        assert.strictEqual((0, usage_1.evaluateUsageStatus)(78, warning, critical), 'normal');
        assert.strictEqual((0, usage_1.evaluateUsageStatus)(26, warning, critical), 'normal');
    });
    it('should return warning when remaining <= warning and > critical', () => {
        assert.strictEqual((0, usage_1.evaluateUsageStatus)(25, warning, critical), 'warning');
        assert.strictEqual((0, usage_1.evaluateUsageStatus)(15, warning, critical), 'warning');
        assert.strictEqual((0, usage_1.evaluateUsageStatus)(11, warning, critical), 'warning');
    });
    it('should return critical when remaining <= critical and > 0', () => {
        assert.strictEqual((0, usage_1.evaluateUsageStatus)(10, warning, critical), 'critical');
        assert.strictEqual((0, usage_1.evaluateUsageStatus)(5, warning, critical), 'critical');
        assert.strictEqual((0, usage_1.evaluateUsageStatus)(1, warning, critical), 'critical');
    });
    it('should return exhausted when remaining <= 0', () => {
        assert.strictEqual((0, usage_1.evaluateUsageStatus)(0, warning, critical), 'exhausted');
        assert.strictEqual((0, usage_1.evaluateUsageStatus)(-5, warning, critical), 'exhausted');
    });
});
describe('Reset Time & Countdown Formatting Tests', () => {
    it('should format duration until future reset', () => {
        const now = new Date('2026-10-30T10:00:00Z');
        // 2 hours 15 mins later
        const future = new Date('2026-10-30T12:15:00Z');
        assert.strictEqual((0, usage_1.formatDurationUntil)(future, now), '2h 15m');
        // 4 days 3 hours later
        const futureDays = new Date('2026-11-03T13:00:00Z');
        assert.strictEqual((0, usage_1.formatDurationUntil)(futureDays, now), '4d 3h');
        // 45 minutes later
        const futureMins = new Date('2026-10-30T10:45:00Z');
        assert.strictEqual((0, usage_1.formatDurationUntil)(futureMins, now), '45m');
        // Past time
        const past = new Date('2026-10-30T09:00:00Z');
        assert.strictEqual((0, usage_1.formatDurationUntil)(past, now), 'Reset pending');
    });
    it('should parse various reset timestamp representations', () => {
        const iso = '2026-10-30T12:00:00.000Z';
        const parsedIso = (0, usage_1.parseResetDate)(iso);
        assert.ok(parsedIso !== null);
        assert.strictEqual(parsedIso.toISOString(), iso);
        // Unix epoch seconds
        const epochSec = 1793264400;
        const parsedSec = (0, usage_1.parseResetDate)(epochSec);
        assert.ok(parsedSec !== null);
        assert.strictEqual(Math.floor(parsedSec.getTime() / 1000), epochSec);
        // Invalid string
        assert.strictEqual((0, usage_1.parseResetDate)('invalid-date'), null);
        assert.strictEqual((0, usage_1.parseResetDate)(null), null);
    });
});
//# sourceMappingURL=usage.test.js.map