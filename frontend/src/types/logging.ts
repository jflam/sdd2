export interface LogEntry {
  timestamp: string;        // ISO 8601 format
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: 'frontend' | 'backend';
  context?: object;         // Additional metadata
  stackTrace?: string;      // For exceptions
  component?: string;       // Specific component identifier
}

export interface LoggerService {
  debug(message: string, context?: object): void;
  info(message: string, context?: object): void;
  warn(message: string, context?: object): void;
  error(message: string, context?: object): void;
}

export interface ExceptionHandler {
  captureException(error: Error, context?: object): void;
  setupGlobalHandlers(): void;
}

export interface LogQueue {
  enqueue(logEntry: LogEntry): void;
  flush(): Promise<void>;
  startAutoFlush(intervalMs: number): void;
}

export interface LoggingConfig {
  apiEndpoint: string;
  batchSize: number;
  flushInterval: number;
  maxQueueSize: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  retryAttempts: number;
}