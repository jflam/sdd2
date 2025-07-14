export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggingConfig {
  apiEndpoint: string;
  batchSize: number;
  flushInterval: number;
  maxQueueSize: number;
  logLevel: LogLevel;
  retryAttempts: number;
  retryDelayMs: number;
  enabled: boolean;
  formatOptions: LogFormatOptions;
}

export interface LogFormatOptions {
  includeTimestamp: boolean;
  timestampFormat: 'iso' | 'local' | 'unix';
  includeSource: boolean;
  includeContext: boolean;
  maxMessageLength?: number;
}

export const DEFAULT_CONFIG: LoggingConfig = {
  apiEndpoint: 'http://localhost:8000/api/logs',
  batchSize: 10,
  flushInterval: 5000,
  maxQueueSize: 100,
  logLevel: 'info',
  retryAttempts: 3,
  retryDelayMs: 1000,
  enabled: true,
  formatOptions: {
    includeTimestamp: true,
    timestampFormat: 'iso',
    includeSource: true,
    includeContext: true,
    maxMessageLength: 1000
  }
};

export const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};