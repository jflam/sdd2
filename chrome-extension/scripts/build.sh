#!/bin/bash

# Chrome Extension Build Script
set -e

echo "🚀 Building Chrome Extension..."

# Clean previous build
rm -rf dist

# Build with Vite directly
npx vite build

# Copy manifest.json to dist
cp manifest.json dist/

# Copy popup.html to root of dist (Vite puts it in src subdirectory)
if [ -f "dist/src/popup/popup.html" ]; then
    cp dist/src/popup/popup.html dist/popup.html
    rm -rf dist/src
fi

# Create icons directory and add placeholder icons if they don't exist
mkdir -p dist/icons

# Create simple placeholder icons if they don't exist
if [ ! -f "icons/icon16.png" ]; then
    echo "📝 Creating placeholder icons..."
    mkdir -p icons
    
    # Create simple colored squares as placeholders
    # These would be replaced with actual icons in a real project
    convert -size 16x16 xc:#4285f4 icons/icon16.png 2>/dev/null || echo "⚠️  ImageMagick not found - skipping icon generation"
    convert -size 32x32 xc:#4285f4 icons/icon32.png 2>/dev/null || echo "⚠️  ImageMagick not found - skipping icon generation"
    convert -size 48x48 xc:#4285f4 icons/icon48.png 2>/dev/null || echo "⚠️  ImageMagick not found - skipping icon generation"
    convert -size 128x128 xc:#4285f4 icons/icon128.png 2>/dev/null || echo "⚠️  ImageMagick not found - skipping icon generation"
fi

# Copy icons to dist
cp -r icons/* dist/icons/ 2>/dev/null || echo "⚠️  No icons to copy"

echo "✅ Build complete!"
echo "📁 Extension files are in: dist/"
echo "🔧 Load in Chrome: chrome://extensions/ -> Load unpacked -> select dist/"

# Show build contents
echo ""
echo "📋 Build contents:"
ls -la dist/