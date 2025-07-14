import { ConfigManager } from '../config-manager';
import { LoggingConfig, DEFAULT_CONFIG, LogLevel } from '../types/config';

describe('ConfigManager', () => {
  describe('constructor', () => {
    it('should use default config when no custom config provided', () => {
      const configManager = new ConfigManager();
      const config = configManager.getConfig();
      
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should merge custom config with defaults', () => {
      const customConfig: Partial<LoggingConfig> = {
        logLevel: 'debug',
        batchSize: 20
      };
      
      const configManager = new ConfigManager(customConfig);
      const config = configManager.getConfig();
      
      expect(config.logLevel).toBe('debug');
      expect(config.batchSize).toBe(20);
      expect(config.apiEndpoint).toBe(DEFAULT_CONFIG.apiEndpoint);
    });

    it('should validate config on construction', () => {
      expect(() => {
        new ConfigManager({ batchSize: -1 });
      }).toThrow('Batch size must be greater than 0');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration values', () => {
      const configManager = new ConfigManager();
      
      configManager.updateConfig({ logLevel: 'error', batchSize: 5 });
      const config = configManager.getConfig();
      
      expect(config.logLevel).toBe('error');
      expect(config.batchSize).toBe(5);
    });

    it('should validate updated config', () => {
      const configManager = new ConfigManager();
      
      expect(() => {
        configManager.updateConfig({ maxQueueSize: -1 });
      }).toThrow('Max queue size must be greater than 0');
    });
  });

  describe('isLogLevelEnabled', () => {
    it('should return true for enabled log levels', () => {
      const configManager = new ConfigManager({ logLevel: 'warn' });
      
      expect(configManager.isLogLevelEnabled('warn')).toBe(true);
      expect(configManager.isLogLevelEnabled('error')).toBe(true);
    });

    it('should return false for disabled log levels', () => {
      const configManager = new ConfigManager({ logLevel: 'warn' });
      
      expect(configManager.isLogLevelEnabled('debug')).toBe(false);
      expect(configManager.isLogLevelEnabled('info')).toBe(false);
    });
  });

  describe('shouldLog', () => {
    it('should return false when logging is disabled', () => {
      const configManager = new ConfigManager({ enabled: false });
      
      expect(configManager.shouldLog('error')).toBe(false);
    });

    it('should check log level when logging is enabled', () => {
      const configManager = new ConfigManager({ 
        enabled: true, 
        logLevel: 'warn' 
      });
      
      expect(configManager.shouldLog('error')).toBe(true);
      expect(configManager.shouldLog('info')).toBe(false);
    });
  });

  describe('validation', () => {
    it('should validate batch size', () => {
      expect(() => {
        new ConfigManager({ batchSize: 0 });
      }).toThrow('Batch size must be greater than 0');
    });

    it('should validate flush interval', () => {
      expect(() => {
        new ConfigManager({ flushInterval: -1 });
      }).toThrow('Flush interval must be greater than 0');
    });

    it('should validate max queue size', () => {
      expect(() => {
        new ConfigManager({ maxQueueSize: 0 });
      }).toThrow('Max queue size must be greater than 0');
    });

    it('should validate retry attempts', () => {
      expect(() => {
        new ConfigManager({ retryAttempts: -1 });
      }).toThrow('Retry attempts must be non-negative');
    });

    it('should validate retry delay', () => {
      expect(() => {
        new ConfigManager({ retryDelayMs: 0 });
      }).toThrow('Retry delay must be greater than 0');
    });

    it('should validate API endpoint', () => {
      expect(() => {
        new ConfigManager({ apiEndpoint: 'invalid-url' });
      }).toThrow('API endpoint must be a valid URL');
    });

    it('should validate log level', () => {
      expect(() => {
        new ConfigManager({ logLevel: 'invalid' as LogLevel });
      }).toThrow('Invalid log level: invalid');
    });
  });

  describe('getter methods', () => {
    it('should return correct configuration values', () => {
      const customConfig: Partial<LoggingConfig> = {
        apiEndpoint: 'http://test.com/api',
        batchSize: 15,
        flushInterval: 3000,
        maxQueueSize: 50,
        retryAttempts: 5,
        retryDelayMs: 2000,
        enabled: false
      };
      
      const configManager = new ConfigManager(customConfig);
      
      expect(configManager.getApiEndpoint()).toBe('http://test.com/api');
      expect(configManager.getBatchSize()).toBe(15);
      expect(configManager.getFlushInterval()).toBe(3000);
      expect(configManager.getMaxQueueSize()).toBe(50);
      expect(configManager.getRetryAttempts()).toBe(5);
      expect(configManager.getRetryDelayMs()).toBe(2000);
      expect(configManager.isEnabled()).toBe(false);
    });

    it('should return format options', () => {
      const configManager = new ConfigManager({
        formatOptions: {
          includeTimestamp: false,
          timestampFormat: 'unix',
          includeSource: false,
          includeContext: false,
          maxMessageLength: 500
        }
      });
      
      const formatOptions = configManager.getFormatOptions();
      
      expect(formatOptions.includeTimestamp).toBe(false);
      expect(formatOptions.timestampFormat).toBe('unix');
      expect(formatOptions.includeSource).toBe(false);
      expect(formatOptions.includeContext).toBe(false);
      expect(formatOptions.maxMessageLength).toBe(500);
    });
  });
});