/**
 * Lightweight mock of the `vscode` module for standalone unit testing
 */

export class MockEventEmitter<T = any> {
  private listeners: ((e: T) => any)[] = [];

  public event = (listener: (e: T) => any) => {
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

  public fire(data: T): void {
    for (const l of this.listeners) {
      try {
        l(data);
      } catch (err) {
        console.error('Error in mock event listener:', err);
      }
    }
  }

  public dispose(): void {
    this.listeners = [];
  }
}

export class MockThemeColor {
  constructor(public id: string) {}
}

export class MockMarkdownString {
  public value = '';
  public isTrusted = false;
  public supportThemeIcons = false;

  constructor(value: string = '') {
    this.value = value;
  }

  public appendMarkdown(str: string): void {
    this.value += str;
  }
}

export const mockVscode = {
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
      get: (key: string, defVal: any) => defVal,
    }),
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
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
        dispose: () => {},
      };
    },
    showInformationMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showQuickPick: async () => undefined,
    showInputBox: async () => undefined,
    createTerminal: () => ({ show: () => {}, sendText: () => {} }),
    onDidChangeWindowState: () => ({ dispose: () => {} }),
  },
  commands: {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: async () => undefined,
  },
};
