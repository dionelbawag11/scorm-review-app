/**
 * install-browsers.js
 * Automatically installs Playwright's Chromium browser after npm install.
 * Runs as a postinstall hook.
 */
'use strict';

const { execSync } = require('child_process');

console.log('\n[scorm-qa] Installing Playwright Chromium browser...');
try {
  execSync('npx playwright install chromium', { stdio: 'inherit' });
  console.log('[scorm-qa] Chromium installed successfully.\n');
} catch (e) {
  console.warn('[scorm-qa] Could not auto-install Chromium. Run manually: npx playwright install chromium\n');
}
