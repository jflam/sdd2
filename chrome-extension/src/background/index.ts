// Chrome Extension Background Service Worker
import { UnifiedLogger } from '@shared/logger';
import { LoggerConfig, ExtensionMessage, VersionInfo } from '@shared/types';

class ChromeExtensionBackground {
  private logger: UnifiedLogger;
  private version: string;

  constructor() {
    this.version = this.getVersion();
    this.logger = new UnifiedLogger(this.getDefaultConfig(), this.version);
    this.initialize();
  }

  private initialize(): void {
    // Log extension startup
    this.logger.info(`Loading Chrome Extension Unified Logging ${this.version}`);

    // Set up event listeners
    this.setupEventListeners();

    // Report version on startup
    this.reportVersion();
  }

  private setupEventListeners(): void {
    // Extension installation/startup
    chrome.runtime.onInstalled.addListener((details) => {
      this.logger.info('Extension installed/updated', {
        reason: details.reason,
        version: this.version,
        previousVersion: details.previousVersion
      });
    });

    // Extension startup
    chrome.runtime.onStartup.addListener(() => {
      this.logger.info('Extension started', { version: this.version });
    });

    // Message handling from content scripts and popup
    chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Tab updates for content script injection
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        this.logger.debug('Tab updated, content script should be injected', {
          tabId,
          url: tab.url
        });
      }
    });

    // Handle extension errors
    chrome.runtime.onSuspend.addListener(() => {
      this.logger.info('Extension suspending');
      this.logger.destroy();
    });
  }

  private handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void): void {
    switch (message.type) {
      case 'LOG':
        // Forward log from content script or popup
        const logEntry = message.payload;
        this.logger.log(logEntry.level, logEntry.message, {
          ...logEntry.context,
          fromContentScript: !!sender.tab,
          tabId: sender.tab?.id,
          url: sender.tab?.url
        });
        sendResponse({ status: 'logged' });
        break;

      case 'VERSION_REPORT':
        sendResponse({
          version: this.version,
          timestamp: new Date().toISOString()
        });
        break;

      case 'HEALTH_CHECK':
        sendResponse({
          status: 'healthy',
          version: this.version,
          queueSize: this.logger.getQueueSize()
        });
        break;

      case 'CONFIG_UPDATE':
        this.logger.updateConfig(message.payload);
        this.logger.info('Configuration updated', message.payload);
        sendResponse({ status: 'updated' });
        break;

      default:
        this.logger.warn('Unknown message type', { type: message.type });
        sendResponse({ error: 'Unknown message type' });
    }
  }

  private getVersion(): string {
    return chrome.runtime.getManifest().version;
  }

  private getDefaultConfig(): LoggerConfig {
    return {
      apiEndpoint: 'http://localhost:8000/api/logs',
      batchSize: 10,
      flushInterval: 2000,
      maxQueueSize: 100,
      logLevel: 'debug',
      retryAttempts: 3,
      retryDelay: 1000,
      enableConsoleLogging: true
    };
  }

  private reportVersion(): void {
    const versionInfo: VersionInfo = {
      version: this.version,
      buildNumber: this.getBuildNumber(),
      timestamp: new Date().toISOString()
    };

    this.logger.info('Chrome Extension Version Report', versionInfo);

    // Also log to console for immediate visibility
    console.log(`🚀 Chrome Extension Unified Logging v${this.version} loaded`);
  }

  private getBuildNumber(): number {
    // Extract build number from version (e.g., "1.0.123" -> 123)
    const versionParts = this.version.split('.');
    return parseInt(versionParts[2] || '0', 10);
  }
}

// Initialize background service worker
new ChromeExtensionBackground();