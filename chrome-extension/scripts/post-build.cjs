#!/usr/bin/env node

// Post-build script for Chrome extension
const fs = require('fs');
const path = require('path');

function postBuild() {
  console.log('📦 Running post-build tasks...');

  try {
    // Copy manifest.json to dist
    const manifestSrc = path.join(__dirname, '..', 'manifest.json');
    const manifestDest = path.join(__dirname, '..', 'dist', 'manifest.json');
    fs.copyFileSync(manifestSrc, manifestDest);
    console.log('✅ Copied manifest.json');

    // Handle popup.html - Vite might put it in a subdirectory
    const popupInSrc = path.join(__dirname, '..', 'dist', 'src', 'popup', 'popup.html');
    const popupDest = path.join(__dirname, '..', 'dist', 'popup.html');
    
    if (fs.existsSync(popupInSrc)) {
      fs.copyFileSync(popupInSrc, popupDest);
      console.log('✅ Moved popup.html to root');
      
      // Clean up src directory
      const srcDir = path.join(__dirname, '..', 'dist', 'src');
      if (fs.existsSync(srcDir)) {
        fs.rmSync(srcDir, { recursive: true, force: true });
        console.log('✅ Cleaned up src directory');
      }
    }

    // Create icons directory
    const iconsDir = path.join(__dirname, '..', 'dist', 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    // Copy icons if they exist
    const sourceIconsDir = path.join(__dirname, '..', 'icons');
    if (fs.existsSync(sourceIconsDir)) {
      const iconFiles = fs.readdirSync(sourceIconsDir).filter(file => file.endsWith('.png'));
      iconFiles.forEach(file => {
        const src = path.join(sourceIconsDir, file);
        const dest = path.join(iconsDir, file);
        fs.copyFileSync(src, dest);
      });
      if (iconFiles.length > 0) {
        console.log(`✅ Copied ${iconFiles.length} icon files`);
      }
    }

    // Create placeholder icons if none exist
    const requiredIcons = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'];
    const missingIcons = requiredIcons.filter(icon => 
      !fs.existsSync(path.join(iconsDir, icon))
    );

    if (missingIcons.length > 0) {
      console.log('⚠️  Creating placeholder icon files...');
      missingIcons.forEach(icon => {
        const placeholderPath = path.join(iconsDir, icon);
        // Create a minimal placeholder file (not a real PNG, but Chrome will handle it)
        fs.writeFileSync(placeholderPath, 'PNG_PLACEHOLDER');
      });
      console.log(`📝 Created ${missingIcons.length} placeholder icons`);
    }

    console.log('✅ Post-build complete!');
    console.log('📁 Extension ready in: dist/');
    console.log('🔧 Load in Chrome: chrome://extensions/ -> Load unpacked -> select dist/');

    // Show build contents
    console.log('\n📋 Build contents:');
    const distDir = path.join(__dirname, '..', 'dist');
    const files = fs.readdirSync(distDir, { withFileTypes: true });
    files.forEach(file => {
      const type = file.isDirectory() ? 'DIR ' : 'FILE';
      console.log(`  ${type} ${file.name}`);
    });

  } catch (error) {
    console.error('❌ Post-build failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  postBuild();
}

module.exports = { postBuild };