"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Claude Usage Monitor - Lightweight Test Runner
 */
const mockVscode_1 = require("./mockVscode");
// Intercept `require('vscode')` before test modules load
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'vscode') {
        return mockVscode_1.mockVscode;
    }
    return originalLoad.apply(this, arguments);
};
const suites = [];
let currentSuite = null;
global.describe = function (name, fn) {
    const suite = { name, tests: [] };
    suites.push(suite);
    currentSuite = suite;
    fn();
    currentSuite = null;
};
global.it = function (name, fn) {
    if (currentSuite) {
        currentSuite.tests.push({ name, fn });
    }
};
async function run() {
    console.log('\n========================================');
    console.log('Running Claude Usage Monitor Unit Tests');
    console.log('========================================\n');
    // Load test suites
    require('./usage.test');
    require('./service.test');
    require('./statusBar.test');
    let passed = 0;
    let failed = 0;
    for (const suite of suites) {
        console.log(`\n● Suite: ${suite.name}`);
        for (const test of suite.tests) {
            try {
                await test.fn();
                console.log(`  ✓ ${test.name}`);
                passed++;
            }
            catch (err) {
                console.error(`  ✗ ${test.name}`);
                console.error('    ', err instanceof Error ? err.stack : err);
                failed++;
            }
        }
    }
    console.log('\n----------------------------------------');
    console.log(`Summary: ${passed} passed, ${failed} failed (${passed + failed} total)`);
    console.log('----------------------------------------\n');
    if (failed > 0) {
        process.exit(1);
    }
}
run().catch((err) => {
    console.error('Fatal error running tests:', err);
    process.exit(1);
});
//# sourceMappingURL=runTests.js.map