/**
 * Claude Usage Monitor - Claude CLI Diagnostic Provider
 *
 * Inspects local Claude Code CLI installation and runs `claude auth status`
 * to detect whether Claude Code is installed and authenticated.
 */
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { IClaudeUsageProvider } from './types';
import { ClaudeUsageSnapshot } from '../models/usage';

export interface CliAuthStatusResult {
  isInstalled: boolean;
  cliPath?: string;
  loggedIn?: boolean;
  authMethod?: string;
  configDirectory?: string;
  rawOutput?: string;
  error?: string;
}

export class CliUsageProvider implements IClaudeUsageProvider {
  public readonly id = 'claude-cli-provider';
  public readonly displayName = 'Claude Code CLI';

  public async isAvailable(): Promise<boolean> {
    const status = await this.getCliStatus();
    return status.isInstalled;
  }

  public async getCliStatus(): Promise<CliAuthStatusResult> {
    const binPath = await this.locateClaudeBinary();
    if (!binPath) {
      return {
        isInstalled: false,
        error: 'Claude Code CLI binary not found in standard system PATH or known directories.',
      };
    }

    return new Promise<CliAuthStatusResult>((resolve) => {
      exec(`"${binPath}" auth status`, { timeout: 5000 }, (err, stdout, stderr) => {
        if (err) {
          resolve({
            isInstalled: true,
            cliPath: binPath,
            loggedIn: false,
            error: err.message || stderr,
          });
          return;
        }

        try {
          // Attempt to extract JSON from stdout
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            resolve({
              isInstalled: true,
              cliPath: binPath,
              loggedIn: Boolean(parsed.loggedIn),
              authMethod: parsed.authMethod,
              configDirectory: parsed.configDirectory,
              rawOutput: stdout,
            });
            return;
          }

          resolve({
            isInstalled: true,
            cliPath: binPath,
            loggedIn: stdout.toLowerCase().includes('logged in'),
            rawOutput: stdout,
          });
        } catch (parseErr) {
          resolve({
            isInstalled: true,
            cliPath: binPath,
            loggedIn: false,
            rawOutput: stdout,
          });
        }
      });
    });
  }

  public async fetchUsage(): Promise<ClaudeUsageSnapshot> {
    const status = await this.getCliStatus();

    const snapshot: ClaudeUsageSnapshot = {
      timestamp: new Date(),
      fiveHour: null,
      weekly: null,
      extraUsage: null,
      subscriptionType: null,
      rateLimitTier: null,
      auth: {
        isAuthenticated: Boolean(status.loggedIn),
        authMethod: 'cli',
        details: status.isInstalled
          ? `Claude CLI found at ${status.cliPath} (Status: ${status.loggedIn ? 'Logged in' : 'Not logged in'})`
          : 'Claude Code CLI is not installed.',
      },
      isCached: false,
      isStale: false,
      errorMessage: status.loggedIn
        ? 'Claude CLI is logged in, but usage data must be retrieved through the OAuth Usage API.'
        : 'Claude CLI is not authenticated. Run `claude auth login` in your terminal.',
      providerName: this.displayName,
    };

    return snapshot;
  }

  /**
   * Searches for `claude` executable in PATH and known Claude Code directories.
   */
  private async locateClaudeBinary(): Promise<string | null> {
    return new Promise((resolve) => {
      exec(process.platform === 'win32' ? 'where claude' : 'which claude', (err, stdout) => {
        if (!err && stdout.trim().length > 0) {
          const first = stdout.trim().split(/\r?\n/)[0];
          if (fs.existsSync(first)) {
            resolve(first);
            return;
          }
        }

        // Check common Claude Code install locations
        const home = os.homedir();
        const candidateLocations = [
          path.join(home, '.claude', 'bin', 'claude'),
          path.join(home, '.local', 'bin', 'claude'),
          path.join('/usr', 'local', 'bin', 'claude'),
        ];

        // Also search in ~/.config/Claude*/claude-code/...
        try {
          const configClaudeDirs = [
            path.join(home, '.config', 'Claude', 'claude-code'),
            path.join(home, '.config', 'Claude-3p', 'claude-code'),
          ];

          for (const baseDir of configClaudeDirs) {
            if (fs.existsSync(baseDir)) {
              const versions = fs.readdirSync(baseDir);
              for (const ver of versions) {
                const verDir = path.join(baseDir, ver);
                if (fs.statSync(verDir).isDirectory()) {
                  const subdirs = fs.readdirSync(verDir);
                  for (const sub of subdirs) {
                    const candidate = path.join(verDir, sub, 'claude');
                    if (fs.existsSync(candidate)) {
                      candidateLocations.push(candidate);
                    }
                  }
                }
              }
            }
          }
        } catch {
          // Ignore directory traversal errors
        }

        for (const loc of candidateLocations) {
          if (fs.existsSync(loc)) {
            resolve(loc);
            return;
          }
        }

        resolve(null);
      });
    });
  }
}
