/**
 * bundler.ts
 * Core logic: takes a SCORM package (zip or folder), injects the coreview.js
 * review tool into the HTML entry point, adds coreview.js as a file, and
 * returns the result as a zip Buffer.
 *
 * For plain HTML files, injects the script inline and returns the HTML string.
 */

import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

// ─── Find the HTML entry point in a list of file paths ───────────────────────
function findEntryHtml(files: string[]): string | null {
  // Normalize to forward slashes
  const norm = files.map(f => f.replace(/\\/g, '/'));

  // Priority 1: index.html at root
  if (norm.includes('index.html')) return 'index.html';
  if (norm.includes('Index.html')) return 'Index.html';

  // Priority 2: index.html one level deep (e.g. scorm_package/index.html)
  const nested = norm.find(f => /^[^/]+\/index\.html$/i.test(f));
  if (nested) return nested;

  // Priority 3: any .html file
  const anyHtml = norm.find(f => /\.html?$/i.test(f));
  return anyHtml ?? null;
}

// ─── Inject coreview script tag into an HTML string ──────────────────────────
function injectCoreviewTag(html: string): string {
  const scriptTag = `<script src="./coreview.js" data-project="scorm-review" data-note="Please review all slides. Check layout, wording, and content." data-start-open="false"></script>`;

  // Remove any existing coreview injection
  html = html.replace(/<script[^>]*src="[^"]*coreview\.js"[^>]*><\/script>\s*/gi, '');

  // Inject before </body> if it exists, otherwise append
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${scriptTag}\n</body>`);
  }
  return html + '\n' + scriptTag;
}

// ─── Bundle a SCORM zip ───────────────────────────────────────────────────────
/**
 * Takes a zip Buffer (SCORM package), injects coreview.js into the entry HTML,
 * adds coreview.js to the zip, and returns the new zip as a Buffer.
 */
export async function bundleScormZip(
  zipBuffer: Buffer,
  coreviewScript: string,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(zipBuffer);

  const fileNames = Object.keys(zip.files).filter(f => !zip.files[f].dir);
  const entryPath = findEntryHtml(fileNames);
  if (!entryPath) throw new Error('No HTML entry point found in the zip file.');

  // Determine the folder prefix (e.g. "scorm_package/") where index.html lives
  const entryDir = entryPath.includes('/')
    ? entryPath.slice(0, entryPath.lastIndexOf('/') + 1)
    : '';

  // Read and modify the entry HTML
  const entryFile = zip.file(entryPath);
  if (!entryFile) throw new Error(`Could not read entry file: ${entryPath}`);
  const originalHtml = await entryFile.async('string');
  const modifiedHtml = injectCoreviewTag(originalHtml);

  // Replace the entry HTML in the zip
  zip.file(entryPath, modifiedHtml);

  // Add coreview.js next to index.html
  zip.file(`${entryDir}coreview.js`, coreviewScript);

  // Return new zip buffer
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

// ─── Bundle a SCORM folder ────────────────────────────────────────────────────
/**
 * Takes a folder path (SCORM package directory), injects coreview.js into the
 * entry HTML, adds coreview.js as a file, and returns the result as a zip Buffer.
 */
export async function bundleScormFolder(
  folderPath: string,
  coreviewScript: string,
): Promise<Buffer> {
  // Recursively collect all files
  function collectFiles(dir: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...collectFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
    return results;
  }

  const allFiles = collectFiles(folderPath);
  const relFiles = allFiles.map(f => path.relative(folderPath, f).replace(/\\/g, '/'));

  // Find entry HTML
  const entryRelPath = findEntryHtml(relFiles);
  if (!entryRelPath) throw new Error('No HTML entry point found in the folder.');

  // Build a new zip from the folder contents
  const zip = new JSZip();

  for (const relFile of relFiles) {
    // Skip .DS_Store and other junk
    if (path.basename(relFile) === '.DS_Store') continue;

    const absPath = path.join(folderPath, relFile);

    if (relFile === entryRelPath) {
      // Inject coreview tag into entry HTML
      const originalHtml = fs.readFileSync(absPath, 'utf-8');
      const modifiedHtml = injectCoreviewTag(originalHtml);
      zip.file(relFile, modifiedHtml);
    } else {
      // Add file as-is
      zip.file(relFile, fs.readFileSync(absPath));
    }
  }

  // Add coreview.js next to index.html
  const entryDir = entryRelPath.includes('/')
    ? entryRelPath.slice(0, entryRelPath.lastIndexOf('/') + 1)
    : '';
  zip.file(`${entryDir}coreview.js`, coreviewScript);

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

// ─── Bundle a plain HTML file ─────────────────────────────────────────────────
/**
 * Takes a plain HTML buffer, injects the coreview script inline, and returns
 * the modified HTML string.
 */
export function bundlePlainHtml(
  htmlBuffer: Buffer,
  coreviewScript: string,
): string {
  const html = htmlBuffer.toString('utf-8');
  // For plain HTML, embed the script inline since there's no package context
  const scriptTag = `<script id="__coreview_inline">\nwindow.AnnotateConfig = { project: document.title || 'review', note: 'Please review this document.', startOpen: false, theme: 'auto' };\n${coreviewScript}\n</script>`;
  const cleaned = html.replace(/<script[^>]*id="__coreview_inline"[^>]*>[\s\S]*?<\/script>\s*/gi, '');
  if (/<\/body>/i.test(cleaned)) {
    return cleaned.replace(/<\/body>/i, `${scriptTag}\n</body>`);
  }
  return cleaned + '\n' + scriptTag;
}
