"use strict";
/**
 * Lightweight mock of the `vscode` module for standalone unit testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockVscode = exports.MockMarkdownString = exports.MockThemeColor = exports.MockEventEmitter = void 0;
class MockEventEmitter {
    listeners = [];
    event = (listener) => {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const idx = this.listeners.indexOf(listener);
                if (idx !== -1) {
                    this.listeners.splice(idx, 1);
                }
            },
        };
    };
    fire(data) {
        for (const l of this.listeners) {
            try {
                l(data);
            }
            catch (err) {
                console.error('Error in mock event listener:', err);
            }
        }
    }
    dispose() {
        this.listeners = [];
    }
}
exports.MockEventEmitter = MockEventEmitter;
class MockThemeColor {
    id;
    constructor(id) {
        this.id = id;
    }
}
exports.MockThemeColor = MockThemeColor;
class MockMarkdownString {
    value = '';
    isTrusted = false;
    supportThemeIcons = false;
    constructor(value = '') {
        this.value = value;
    }
    appendMarkdown(str) {
        this.value += str;
    }
}
exports.MockMarkdownString = MockMarkdownString;
exports.mockVscode = {
    EventEmitter: MockEventEmitter,
    ThemeColor: MockThemeColor,
    MarkdownString: MockMarkdownString,
    StatusBarAlignment: {
        Left: 1,
        Right: 2,
    },
    ViewColumn: {
        One: 1,
        Two: 2,
    },
    QuickPickItemKind: {
        Separator: -1,
        Default: 0,
    },
    workspace: {
        getConfiguration: () => ({
            get: (key, defVal) => defVal,
        }),
        onDidChangeConfiguration: () => ({ dispose: () => { } }),
    },
    window: {
        createStatusBarItem: () => {
            let isVisible = false;
            return {
                text: '',
                tooltip: '',
                command: '',
                color: undefined,
                backgroundColor: undefined,
                get isVisible() {
                    return isVisible;
                },
                show: () => {
                    isVisible = true;
                },
                hide: () => {
                    isVisible = false;
                },
                dispose: () => { },
            };
        },
        showInformationMessage: async () => undefined,
        showWarningMessage: async () => undefined,
        showErrorMessage: async () => undefined,
        showQuickPick: async () => undefined,
        showInputBox: async () => undefined,
        createTerminal: () => ({ show: () => { }, sendText: () => { } }),
        onDidChangeWindowState: () => ({ dispose: () => { } }),
    },
    commands: {
        registerCommand: () => ({ dispose: () => { } }),
        executeCommand: async () => undefined,
    },
};
//# sourceMappingURL=mockVscode.js.map