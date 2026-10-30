/**
 * Claude Usage Monitor - Provider Interface & Common Types
 */
import { ClaudeUsageSnapshot } from '../models/usage';

export interface IClaudeUsageProvider {
  /** Descriptive identifier of the provider */
  readonly id: string;
  readonly displayName: string;

  /**
   * Checks if this provider is currently configured and capable of fetching data.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Fetches the latest usage snapshot from the underlying source.
   */
  fetchUsage(): Promise<ClaudeUsageSnapshot>;
}
