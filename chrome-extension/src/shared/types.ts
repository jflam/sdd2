// Shared types for unified logging system
// Can be reused between Chrome and Safari extensions

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  source: 'chrome-extension' | 'safari-extension' | 'backend';
  context?: Record<string, any>;
  stackTrace?: string;
  component?: string;
  version?: string;
}

export interface LogBatch {
  entries: LogEntry[];
}

export interface LoggerConfig {
  apiEndpoint: string;
  batchSize: number;
  flushInterval: number;
  maxQueueSize: number;
  logLevel: LogLevel;
  retryAttempts: number;
  retryDelay: number;
  enableConsoleLogging: boolean;
}

export interface VersionInfo {
  version: string;
  buildNumber: number;
  timestamp: string;
}

export interface ExtensionMessage {
  type: 'LOG' | 'VERSION_REPORT' | 'CONFIG_UPDATE' | 'HEALTH_CHECK';
  payload: any;
}

export interface ApiResponse {
  status: 'success' | 'error';
  message?: string;
  processed_count?: number;
  error_details?: string;
}