import { LoggingConfig, DEFAULT_CONFIG, LogLevel, LOG_LEVELS } from './types/config';

export class ConfigManager {
  private config: LoggingConfig;

  constructor(customConfig?: Partial<LoggingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...customConfig };
    this.validateConfig();
  }

  public getConfig(): LoggingConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<LoggingConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfig();
  }

  public isLogLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.logLevel];
  }

  public shouldLog(level: LogLevel): boolean {
    return this.config.enabled && this.isLogLevelEnabled(level);
  }

  public getApiEndpoint(): string {
    return this.config.apiEndpoint;
  }

  public getBatchSize(): number {
    return this.config.batchSize;
  }

  public getFlushInterval(): number {
    return this.config.flushInterval;
  }

  public getMaxQueueSize(): number {
    return this.config.maxQueueSize;
  }

  public getRetryAttempts(): number {
    return this.config.retryAttempts;
  }

  public getRetryDelayMs(): number {
    return this.config.retryDelayMs;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public getFormatOptions() {
    return { ...this.config.formatOptions };
  }

  private validateConfig(): void {
    if (this.config.batchSize <= 0) {
      throw new Error('Batch size must be greater than 0');
    }
    
    if (this.config.flushInterval <= 0) {
      throw new Error('Flush interval must be greater than 0');
    }
    
    if (this.config.maxQueueSize <= 0) {
      throw new Error('Max queue size must be greater than 0');
    }
    
    if (this.config.retryAttempts < 0) {
      throw new Error('Retry attempts must be non-negative');
    }
    
    if (this.config.retryDelayMs <= 0) {
      throw new Error('Retry delay must be greater than 0');
    }
    
    if (!this.config.apiEndpoint || !this.isValidUrl(this.config.apiEndpoint)) {
      throw new Error('API endpoint must be a valid URL');
    }
    
    if (!Object.keys(LOG_LEVELS).includes(this.config.logLevel)) {
      throw new Error(`Invalid log level: ${this.config.logLevel}`);
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}