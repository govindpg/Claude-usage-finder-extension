/**
 * Claude Usage Monitor - Main Extension Entrypoint
 */
import * as vscode from 'vscode';
import { ConfigurationManager } from './config/configuration';
import { AuthService } from './services/authService';
import { ClaudeUsageProvider } from './providers/claudeUsageProvider';
import { UsageService } from './services/usageService';
import { StatusBarManager } from './ui/statusBarManager';
import { UsageWebviewManager } from './ui/usageWebview';

let statusBarManager: StatusBarManager | null = null;
let usageWebviewManager: UsageWebviewManager | null = null;
let usageService: UsageService | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Activating Claude Usage Monitor extension...');

  // 1. Initialize Configuration Manager
  const configManager = new ConfigurationManager();
  context.subscriptions.push(configManager);

  // 2. Initialize Authentication Service
  const authService = new AuthService(
    context.secrets,
    () => configManager.get().customCredentialsPath
  );

  // 3. Initialize Composite Claude Usage Provider
  const usageProvider = new ClaudeUsageProvider(authService, () => {
    const config = configManager.get();
    return {
      warning: config.warningThreshold,
      critical: config.criticalThreshold,
    };
  });

  // 4. Initialize Usage Service
  usageService = new UsageService(usageProvider, configManager);
  context.subscriptions.push(usageService);

  // 5. Initialize UI Managers
  statusBarManager = new StatusBarManager(usageService, configManager);
  context.subscriptions.push(statusBarManager);

  usageWebviewManager = new UsageWebviewManager(context, usageService, authService);
  context.subscriptions.push(usageWebviewManager);

  // 6. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeUsage.refresh', async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: 'Refreshing Claude Usage...',
        },
        async () => {
          await usageService?.refresh(true);
        }
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeUsage.showDetails', async () => {
      await usageWebviewManager?.showDetails();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeUsage.toggleStatusBar', () => {
      if (statusBarManager) {
        const isVisible = statusBarManager.toggle();
        vscode.window.showInformationMessage(
          `Claude Usage status bar indicators are now ${isVisible ? 'visible' : 'hidden'}.`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeUsage.openSettings', async () => {
      await configManager.openSettings();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeUsage.resetCache', async () => {
      await usageService?.resetCache();
      vscode.window.showInformationMessage('Claude Usage cache cleared and reloaded.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeUsage.signIn', async () => {
      await handleSignInFlow(authService, usageService, configManager);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeUsage.setToken', async () => {
      await handleSetTokenFlow(authService, usageService);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeUsage.clearToken', async () => {
      await authService.clearSecretToken();
      await usageService?.resetCache();
      vscode.window.showInformationMessage('Stored Claude token has been cleared.');
    })
  );

  // 7. Refresh when VS Code window regains focus (user might have used Claude CLI or web)
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused && configManager.get().autoRefresh) {
        usageService?.refresh(false).catch(() => {});
      }
    })
  );

  // 8. Trigger initial background fetch
  usageService.initialize().catch((err) => {
    console.error('Initial Claude usage fetch failed:', err);
  });

  console.log('Claude Usage Monitor extension activated successfully.');
}

export function deactivate(): void {
  // Clean disposal handled via context.subscriptions
}

/**
 * Interactive Sign-In & Guidance dialog
 */
async function handleSignInFlow(
  authService: AuthService,
  usageService: UsageService | null,
  configManager: ConfigurationManager
): Promise<void> {
  const activeToken = await authService.getActiveToken();

  const options: vscode.QuickPickItem[] = [];

  if (activeToken.token && !activeToken.isExpired) {
    options.push({
      label: '$(check) Account Connected',
      description: activeToken.sourceDescription,
      detail: 'Authentication is active. Click to view full usage dashboard.',
    });
  } else {
    options.push({
      label: '$(key) Enter OAuth / Session Token Manually',
      description: 'Paste your Claude session token (stored securely in VS Code SecretStorage)',
      detail: 'Recommended if not using Claude Code CLI or if running on remote/container',
    });

    options.push({
      label: '$(terminal) Run "claude auth login" in Terminal',
      description: 'Use the official Claude Code CLI login workflow',
      detail: 'Stores OAuth credentials in ~/.claude/.credentials.json for automatic discovery',
    });
  }

  options.push({
    label: '$(gear) Configure Custom Credentials Path',
    description: 'Set a custom path to your .credentials.json file in settings',
  });

  if (activeToken.token) {
    options.push({
      label: '$(trash) Clear Stored Token',
      description: 'Remove manually configured credentials',
    });
  }

  const selection = await vscode.window.showQuickPick(options, {
    title: 'Claude Usage Monitor - Authentication Setup',
    placeHolder: 'Select an authentication option',
  });

  if (!selection) {
    return;
  }

  if (selection.label.includes('Enter OAuth / Session Token')) {
    await handleSetTokenFlow(authService, usageService);
  } else if (selection.label.includes('Run "claude auth login"')) {
    const term = vscode.window.createTerminal('Claude Auth');
    term.show();
    term.sendText('claude auth login');
  } else if (selection.label.includes('Configure Custom Credentials Path')) {
    await configManager.openSettings();
  } else if (selection.label.includes('Account Connected')) {
    await vscode.commands.executeCommand('claudeUsage.showDetails');
  } else if (selection.label.includes('Clear Stored Token')) {
    await authService.clearSecretToken();
    await usageService?.resetCache();
    vscode.window.showInformationMessage('Stored Claude token removed.');
  }
}

/**
 * Prompts user to securely enter a token and stores it in SecretStorage
 */
async function handleSetTokenFlow(
  authService: AuthService,
  usageService: UsageService | null
): Promise<void> {
  const token = await vscode.window.showInputBox({
    title: 'Enter Claude OAuth / Session Token',
    prompt:
      'Enter your Claude session or OAuth access token. It will be encrypted and stored in VS Code SecretStorage.',
    password: true,
    placeHolder: 'sk-ant-api... or OAuth token',
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim().length < 8) {
        return 'Token must be at least 8 characters long.';
      }
      return null;
    },
  });

  if (!token) {
    return;
  }

  await authService.setSecretToken(token);
  vscode.window.showInformationMessage('Claude token securely saved. Refreshing usage...');
  await usageService?.resetCache();
}
