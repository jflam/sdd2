# Safari Extension Setup Guide

This guide provides detailed instructions for packaging and installing the Safari Extension Unified Logging system as an actual Safari Web Extension.

## ⚠️ Important Prerequisites

- **macOS** (Safari extensions only work on macOS)
- **Xcode** (free from Mac App Store)
- **Apple Developer Account** (free tier is sufficient for local development)
- **Safari 14+**

## 🚀 Complete Setup Process

### Step 1: Prepare the Frontend Build

1. **Build the extension:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Verify the build:**
   ```bash
   ls -la dist/
   # Should contain: background.js, popup.html, popup.js, logger.js, etc.
   ```

### Step 2: Create Safari Extension Project

1. **Open Xcode**
2. **Create New Project:**
   - File → New → Project
   - Select **macOS** tab
   - Choose **Safari Extension**
   - Click **Next**

3. **Configure Project:**
   - **Product Name:** `Safari Extension Unified Logging`
   - **Team:** Select your Apple Developer team
   - **Organization Identifier:** `com.yourname.safari-extension-unified-logging`
   - **Bundle Identifier:** Will auto-populate
   - **Language:** Swift
   - **Use Core Data:** Unchecked
   - Click **Next** and choose location

### Step 3: Configure the Extension

1. **Copy Built Files:**
   ```bash
   # Navigate to your Xcode project directory
   cd "Safari Extension Unified Logging"
   
   # Copy all built files to the extension's Resources folder
   cp -r /path/to/your/project/frontend/dist/* "Safari Extension Unified Logging Extension/Resources/"
   ```

2. **Create/Update manifest.json:**
   Create this file in the Resources folder:
   ```json
   {
     "manifest_version": 3,
     "name": "Safari Extension Unified Logging",
     "version": "1.0.1",
     "description": "Unified logging system for Safari extension development",
     "permissions": [
       "activeTab",
       "storage"
     ],
     "host_permissions": [
       "http://localhost:8000/*",
       "https://your-api-domain.com/*"
     ],
     "background": {
       "scripts": ["background.js"],
       "persistent": false
     },
     "action": {
       "default_popup": "popup.html",
       "default_title": "Unified Logging",
       "default_icon": {
         "16": "icon-16.png",
         "32": "icon-32.png",
         "48": "icon-48.png",
         "128": "icon-128.png"
       }
     },
     "content_scripts": [
       {
         "matches": ["<all_urls>"],
         "js": ["logger.js"],
         "run_at": "document_start"
       }
     ],
     "web_accessible_resources": [
       {
         "resources": ["*.js", "*.css"],
         "matches": ["<all_urls>"]
       }
     ]
   }
   ```

3. **Configure App Transport Security:**
   In the main app's `Info.plist`, add:
   ```xml
   <key>NSAppTransportSecurity</key>
   <dict>
       <key>NSExceptionDomains</key>
       <dict>
           <key>localhost</key>
           <dict>
               <key>NSExceptionAllowsInsecureHTTPLoads</key>
               <true/>
               <key>NSExceptionMinimumTLSVersion</key>
               <string>TLSv1.0</string>
               <key>NSExceptionRequiresForwardSecrecy</key>
               <false/>
           </dict>
       </dict>
   </dict>
   ```

### Step 4: Build and Install

1. **Build the Project:**
   - Select the main app target (not the extension)
   - Press ⌘+B to build
   - Fix any build errors that appear

2. **Run the Project:**
   - Press ⌘+R to run
   - This will launch the container app and install the extension

3. **Enable in Safari:**
   - Open Safari
   - Safari → Preferences (⌘+,)
   - Go to **Extensions** tab
   - Find "Safari Extension Unified Logging"
   - Check the box to enable it
   - Click **Always Allow on Every Website** if prompted

### Step 5: Verify Installation

1. **Check Extension Icon:**
   - Look for the extension icon in Safari's toolbar
   - Click it to open the popup

2. **Test Logging:**
   - Start your backend: `./start-dev.sh`
   - Visit any website
   - Open browser console and run: `console.log("Test message")`
   - Check your unified log: `tail -f logs/unified.log`

## 🔄 Development Workflow

### Making Changes

1. **Update Frontend Code:**
   ```bash
   cd frontend
   # Make your changes to TypeScript files
   npm run build
   ```

2. **Update Safari Extension:**
   ```bash
   # Copy updated files
   cp -r frontend/dist/* "Safari Extension Unified Logging Extension/Resources/"
   ```

3. **Rebuild in Xcode:**
   - Press ⌘+B to build
   - Press ⌘+R to run and reinstall

4. **Reload Extension in Safari:**
   - Safari → Develop → Web Extension Background Pages → Your Extension
   - Or disable/re-enable the extension in Safari Preferences

### Debugging

1. **Extension Console:**
   - Safari → Develop → Web Extension Background Pages
   - Select your extension to see console output

2. **Content Script Debugging:**
   - Right-click on any webpage → Inspect Element
   - Console tab will show content script logs

3. **Network Requests:**
   - Use Safari's Web Inspector to monitor API calls to your backend

## 🚨 Common Issues

### Extension Not Appearing
- Ensure the main app is built and run at least once
- Check Safari → Preferences → Extensions
- Verify the extension is enabled

### API Calls Failing
- Check that backend is running on http://localhost:8000
- Verify App Transport Security settings in Info.plist
- Check browser console for CORS errors

### Content Scripts Not Loading
- Verify manifest.json content_scripts configuration
- Check file paths in the Resources folder
- Ensure scripts are properly built and copied

### Permission Issues
- Review manifest.json permissions
- Check host_permissions for your API domain
- Verify Safari has granted necessary permissions

## 📦 Distribution

### For Development Team
1. Archive the Xcode project
2. Export as macOS app
3. Share the .app bundle

### For App Store (Future)
1. Configure proper code signing
2. Create App Store Connect record
3. Submit for review following Apple's guidelines

## 🔧 Advanced Configuration

### Custom Icons
Add icon files to Resources folder:
- icon-16.png (16x16)
- icon-32.png (32x32)  
- icon-48.png (48x48)
- icon-128.png (128x128)

### Production API Endpoint
Update manifest.json host_permissions and frontend config:
```json
{
  "host_permissions": [
    "https://your-production-api.com/*"
  ]
}
```

### Content Security Policy
Add to manifest.json if needed:
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }
}
```

This guide should help you successfully package and install the Safari Extension Unified Logging system as a proper Safari Web Extension!