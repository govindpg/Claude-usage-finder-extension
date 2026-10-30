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
exports.activate = activate;
exports.deactivate = deactivate;
/**
 * Claude Usage Monitor - Main Extension Entrypoint
 */
const vscode = __importStar(require("vscode"));
const configuration_1 = require("./config/configuration");
const authService_1 = require("./services/authService");
const claudeUsageProvider_1 = require("./providers/claudeUsageProvider");
const usageService_1 = require("./services/usageService");
const statusBarManager_1 = require("./ui/statusBarManager");
const usageWebview_1 = require("./ui/usageWebview");
let statusBarManager = null;
let usageWebviewManager = null;
let usageService = null;
async function activate(context) {
    console.log('Activating Claude Usage Monitor extension...');
    // 1. Initialize Configuration Manager
    const configManager = new configuration_1.ConfigurationManager();
    context.subscriptions.push(configManager);
    // 2. Initialize Authentication Service
    const authService = new authService_1.AuthService(context.secrets, () => configManager.get().customCredentialsPath);
    // 3. Initialize Composite Claude Usage Provider
    const usageProvider = new claudeUsageProvider_1.ClaudeUsageProvider(authService, () => {
        const config = configManager.get();
        return {
            warning: config.warningThreshold,
            critical: config.criticalThreshold,
        };
    });
    // 4. Initialize Usage Service
    usageService = new usageService_1.UsageService(usageProvider, configManager);
    context.subscriptions.push(usageService);
    // 5. Initialize UI Managers
    statusBarManager = new statusBarManager_1.StatusBarManager(usageService, configManager);
    context.subscriptions.push(statusBarManager);
    usageWebviewManager = new usageWebview_1.UsageWebviewManager(context, usageService, authService);
    context.subscriptions.push(usageWebviewManager);
    // 6. Register Commands
    context.subscriptions.push(vscode.commands.registerCommand('claudeUsage.refresh', async () => {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: 'Refreshing Claude Usage...',
        }, async () => {
            await usageService?.refresh(true);
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('claudeUsage.showDetails', async () => {
        await usageWebviewManager?.showDetails();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('claudeUsage.toggleStatusBar', () => {
        if (statusBarManager) {
            const isVisible = statusBarManager.toggle();
            vscode.window.showInformationMessage(`Claude Usage status bar indicators are now ${isVisible ? 'visible' : 'hidden'}.`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('claudeUsage.openSettings', async () => {
        await configManager.openSettings();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('claudeUsage.resetCache', async () => {
        await usageService?.resetCache();
        vscode.window.showInformationMessage('Claude Usage cache cleared and reloaded.');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('claudeUsage.signIn', async () => {
        await handleSignInFlow(authService, usageService, configManager);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('claudeUsage.setToken', async () => {
        await handleSetTokenFlow(authService, usageService);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('claudeUsage.clearToken', async () => {
        await authService.clearSecretToken();
        await usageService?.resetCache();
        vscode.window.showInformationMessage('Stored Claude token has been cleared.');
    }));
    // 7. Refresh when VS Code window regains focus (user might have used Claude CLI or web)
    context.subscriptions.push(vscode.window.onDidChangeWindowState((state) => {
        if (state.focused && configManager.get().autoRefresh) {
            usageService?.refresh(false).catch(() => { });
        }
    }));
    // 8. Trigger initial background fetch
    usageService.initialize().catch((err) => {
        console.error('Initial Claude usage fetch failed:', err);
    });
    console.log('Claude Usage Monitor extension activated successfully.');
}
function deactivate() {
    // Clean disposal handled via context.subscriptions
}
/**
 * Interactive Sign-In & Guidance dialog
 */
async function handleSignInFlow(authService, usageService, configManager) {
    const activeToken = await authService.getActiveToken();
    const options = [];
    if (activeToken.token && !activeToken.isExpired) {
        options.push({
            label: '$(check) Account Connected',
            description: activeToken.sourceDescription,
            detail: 'Authentication is active. Click to view full usage dashboard.',
        });
    }
    else {
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
    }
    else if (selection.label.includes('Run "claude auth login"')) {
        const term = vscode.window.createTerminal('Claude Auth');
        term.show();
        term.sendText('claude auth login');
    }
    else if (selection.label.includes('Configure Custom Credentials Path')) {
        await configManager.openSettings();
    }
    else if (selection.label.includes('Account Connected')) {
        await vscode.commands.executeCommand('claudeUsage.showDetails');
    }
    else if (selection.label.includes('Clear Stored Token')) {
        await authService.clearSecretToken();
        await usageService?.resetCache();
        vscode.window.showInformationMessage('Stored Claude token removed.');
    }
}
/**
 * Prompts user to securely enter a token and stores it in SecretStorage
 */
async function handleSetTokenFlow(authService, usageService) {
    const token = await vscode.window.showInputBox({
        title: 'Enter Claude OAuth / Session Token',
        prompt: 'Enter your Claude session or OAuth access token. It will be encrypted and stored in VS Code SecretStorage.',
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
//# sourceMappingURL=extension.js.map