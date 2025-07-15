#!/usr/bin/env node

// Automatic version bumping script for Chrome extension
const fs = require('fs');
const path = require('path');

function bumpVersion() {
  const manifestPath = path.join(__dirname, '..', 'manifest.json');
  const packagePath = path.join(__dirname, '..', 'package.json');

  try {
    // Read current manifest
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    // Parse current version
    const versionParts = manifest.version.split('.').map(Number);
    const [major, minor, build] = versionParts;

    // Increment build number
    const newBuild = build + 1;
    const newVersion = `${major}.${minor}.${newBuild}`;

    // Update manifest
    manifest.version = newVersion;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Update package.json
    packageJson.version = newVersion;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

    console.log(`🚀 Version bumped: ${versionParts.join('.')} → ${newVersion}`);
    console.log(`📝 Updated manifest.json and package.json`);

    return newVersion;
  } catch (error) {
    console.error('❌ Failed to bump version:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  bumpVersion();
}

module.exports = { bumpVersion };