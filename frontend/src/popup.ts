// Popup script for Safari extension
import { getLogger } from './logger';
import { getVersionString, EXTENSION_NAME } from './version';

const logger = getLogger();

// Log popup initialization
logger.info('Popup opened');

// Update version display
document.addEventListener('DOMContentLoaded', () => {
    const versionElement = document.getElementById('version');
    if (versionElement) {
        versionElement.textContent = `Version: ${getVersionString()}`;
    }

    // Test backend connection
    testBackendConnection();
    
    // Log user interaction
    logger.debug('Popup DOM loaded', {
        url: window.location.href,
        timestamp: Date.now()
    });
});

async function testBackendConnection(): Promise<void> {
    const statusElement = document.getElementById('status');
    if (!statusElement) return;

    try {
        logger.debug('Testing backend connection');
        
        const response = await fetch('http://localhost:8000/health');
        
        if (response.ok) {
            const data = await response.json();
            statusElement.textContent = 'Connected to backend';
            statusElement.className = 'status connected';
            
            logger.info('Backend connection successful', {
                status: data.status,
                service: data.service
            });
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        statusElement.textContent = 'Backend unavailable';
        statusElement.className = 'status disconnected';
        
        logger.warn('Backend connection failed', {
            error: (error as Error).message
        });
    }
}

// Example of logging user interactions
document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    logger.debug('User clicked element', {
        tagName: target.tagName,
        id: target.id,
        className: target.className
    });
});

// Example error handling
window.addEventListener('error', (event) => {
    logger.error('Unhandled error in popup', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

// Log when popup is closed
window.addEventListener('beforeunload', () => {
    logger.info('Popup closing');
});