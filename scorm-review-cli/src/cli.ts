#!/usr/bin/env node
/**
 * cli.ts
 * Entry point for the scorm-review CLI tool.
 *
 * Usage:
 *   scorm-review <input.zip>          Convert a SCORM zip
 *   scorm-review <input-folder/>      Convert a SCORM folder
 *   scorm-review <input.html>         Inject review tool into a plain HTML file
 *   scorm-review <input> -o <output>  Specify output file path
 *
 * Output:
 *   For .zip or folder: <name>_review.zip  (original package + coreview.js injected)
 *   For .html:          <name>_review.html (HTML with coreview injected inline)
 */

import fs from 'fs';
import path from 'path';
import { bundleScormZip, bundleScormFolder, bundlePlainHtml } from './bundler';

// ─── Inline coreview.js at build time ────────────────────────────────────────
declare const __COREVIEW_SCRIPT__: string;
const COREVIEW_SCRIPT: string = __COREVIEW_SCRIPT__;

// ─── CLI helpers ──────────────────────────────────────────────────────────────
function printHelp(): void {
  console.log(`
scorm-review — Inject the coreview review tool into SCORM packages

Usage:
  scorm-review <input>              Convert a .zip, folder, or .html file
  scorm-review <input> -o <output>  Specify output file path
  scorm-review --help               Show this help message

Examples:
  scorm-review ./my-course.zip
  scorm-review ./my-course/
  scorm-review ./page.html
  scorm-review ./my-course.zip -o ./output/my-course_review.zip

Output:
  .zip or folder input  →  <name>_review.zip   (SCORM package with coreview.js added)
  .html input           →  <name>_review.html  (HTML with coreview injected inline)
`);
}

function resolveOutputPath(inputPath: string, isFolder: boolean, ext: string, outputFlag?: string): string {
  if (outputFlag) return path.resolve(outputFlag);
  const resolved = path.resolve(inputPath.replace(/[\\/]+$/, ''));
  const dir = path.dirname(resolved);
  const base = path.basename(resolved, isFolder ? '' : ext);
  if (ext === '.html' || ext === '.htm') {
    return path.join(dir, base + '_review.html');
  }
  return path.join(dir, base + '_review.zip');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  let inputPath: string | undefined;
  let outputFlag: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o' || args[i] === '--output') {
      outputFlag = args[i + 1];
      i++;
    } else {
      inputPath = args[i];
    }
  }

  if (!inputPath) {
    console.error('Error: No input specified.\n');
    printHelp();
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath.replace(/[\\/]+$/, ''));

  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: Path not found: ${resolvedInput}`);
    process.exit(1);
  }

  const stat = fs.statSync(resolvedInput);
  const isFolder = stat.isDirectory();
  const ext = isFolder ? '' : path.extname(resolvedInput).toLowerCase();

  if (!isFolder && !['.zip', '.html', '.htm'].includes(ext)) {
    console.error(`Error: Unsupported file type "${ext}". Only .zip, .html, .htm, or a folder are supported.`);
    process.exit(1);
  }

  const outputPath = resolveOutputPath(inputPath, isFolder, ext, outputFlag);

  console.log(`Input:  ${path.basename(resolvedInput)}${isFolder ? '/' : ''}`);
  console.log(`Output: ${outputPath}`);
  console.log('');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  try {
    if (isFolder) {
      process.stdout.write('Processing SCORM folder...');
      const zipBuffer = await bundleScormFolder(resolvedInput, COREVIEW_SCRIPT);
      console.log(' done.');
      fs.writeFileSync(outputPath, zipBuffer);
      const sizeMb = (zipBuffer.length / 1024 / 1024).toFixed(1);
      console.log(`\n✓ Created: ${outputPath} (${sizeMb} MB)`);

    } else if (ext === '.zip') {
      process.stdout.write('Processing SCORM zip...');
      const fileBuffer = fs.readFileSync(resolvedInput);
      const zipBuffer = await bundleScormZip(fileBuffer, COREVIEW_SCRIPT);
      console.log(' done.');
      fs.writeFileSync(outputPath, zipBuffer);
      const sizeMb = (zipBuffer.length / 1024 / 1024).toFixed(1);
      console.log(`\n✓ Created: ${outputPath} (${sizeMb} MB)`);

    } else {
      process.stdout.write('Processing HTML file...');
      const fileBuffer = fs.readFileSync(resolvedInput);
      const outputHtml = bundlePlainHtml(fileBuffer, COREVIEW_SCRIPT);
      console.log(' done.');
      fs.writeFileSync(outputPath, outputHtml, 'utf-8');
      const sizeMb = (Buffer.byteLength(outputHtml, 'utf-8') / 1024 / 1024).toFixed(1);
      console.log(`\n✓ Created: ${outputPath} (${sizeMb} MB)`);
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\nError: ${msg}`);
    process.exit(1);
  }
}

main();
