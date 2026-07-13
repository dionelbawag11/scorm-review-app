/**
 * build.mjs
 * Build script for scorm-review CLI.
 *
 * Steps:
 * 1. Reads coreview.js from the Next.js app's public folder
 * 2. Uses esbuild to bundle src/cli.ts into a single dist/cli.js
 * 3. Replaces the __COREVIEW_SCRIPT__ placeholder with the actual script content
 * 4. Prepends the Node.js shebang line
 */

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load coreview.js ─────────────────────────────────────────────────────────
const coreviewPath = resolve(__dirname, '../scorm-review-app/public/coreview.js');
let coreviewScript;
try {
  coreviewScript = readFileSync(coreviewPath, 'utf-8');
  console.log(`✓ Loaded coreview.js (${(coreviewScript.length / 1024).toFixed(0)} KB)`);
} catch {
  console.error(`ERROR: Could not read coreview.js from:\n  ${coreviewPath}`);
  console.error('Make sure the scorm-review-app folder is alongside scorm-review-cli.');
  process.exit(1);
}

// ─── Ensure dist/ exists ──────────────────────────────────────────────────────
mkdirSync(resolve(__dirname, 'dist'), { recursive: true });

// ─── Bundle with esbuild ──────────────────────────────────────────────────────
console.log('Bundling...');

await build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/cli.js',
  // Inject the coreview script content as a define so TypeScript's
  // "declare const __COREVIEW_SCRIPT__" resolves at build time
  define: {
    __COREVIEW_SCRIPT__: JSON.stringify(coreviewScript),
  },
  // Keep node built-ins external
  external: [],
  minify: false,
  sourcemap: false,
});

// ─── Prepend shebang ──────────────────────────────────────────────────────────
const outPath = resolve(__dirname, 'dist/cli.js');
const content = readFileSync(outPath, 'utf-8');
if (!content.startsWith('#!/usr/bin/env node')) {
  writeFileSync(outPath, '#!/usr/bin/env node\n' + content, 'utf-8');
}

console.log('✓ Built dist/cli.js');
console.log('\nTo test locally:');
console.log('  node dist/cli.js --help');
console.log('  node dist/cli.js ./path/to/course.zip');
