/**
 * bundler.ts
 * Core bundling logic: reads all assets from the zip, base64-encodes them,
 * replaces references in the HTML template, and produces the final output HTML.
 */

import JSZip from 'jszip';
import path from 'path';
import { UNPACKER_SCRIPT, THUMBNAIL_SVG } from './bundler-template';

// ─── MIME types ───────────────────────────────────────────────────────────────
const MIME_MAP: Record<string, string> = {
  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  avif: 'image/avif',
  // Audio / Video
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  ogg: 'audio/ogg',
  ogv: 'video/ogg',
  wav: 'audio/wav',
  webm: 'video/webm',
  m4a: 'audio/m4a',
  // Fonts
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  // Scripts / Styles
  js: 'application/javascript',
  mjs: 'application/javascript',
  css: 'text/css',
  json: 'application/json',
  xml: 'application/xml',
  // Docs
  pdf: 'application/pdf',
};

function getMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

// ─── UUID generator (server-safe, no crypto.randomUUID needed) ───────────────
function makeUUID(): string {
  const hex = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `${hex()}-${hex().slice(0, 4)}-4${hex().slice(0, 3)}-${hex().slice(0, 4)}-${hex()}${hex().slice(0, 4)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ManifestEntry {
  mime: string;
  data: string; // base64
  compressed: boolean;
}

type Manifest = Record<string, ManifestEntry>;

// ─── Escape a string for safe embedding in a JSON string ─────────────────────
function escapeForJsonString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// ─── Main bundler ─────────────────────────────────────────────────────────────

/**
 * Takes a zip Buffer (SCORM package) and returns a self-contained HTML string.
 */
export async function bundleScormZip(
  zipBuffer: Buffer,
  annotateScript: string,
): Promise<string> {
  const zip = await JSZip.loadAsync(zipBuffer);

  // Find the entry HTML file (prefer index.html at root, fall back to first .html)
  let entryPath = findEntryHtml(zip);
  if (!entryPath) throw new Error('No HTML entry point found in the zip file.');

  const entryFile = zip.file(entryPath);
  if (!entryFile) throw new Error(`Entry file "${entryPath}" could not be read.`);

  let templateHtml = await entryFile.async('string');

  // Determine the root folder (the folder containing the entry html)
  const entryDir = entryPath.includes('/') ? entryPath.slice(0, entryPath.lastIndexOf('/') + 1) : '';

  // Collect all non-HTML assets
  const manifest: Manifest = {};
  const uuidMap: Record<string, string> = {}; // relative path -> uuid

  const files = Object.values(zip.files).filter(f => !f.dir);

  for (const file of files) {
    // Skip the entry HTML itself and SCORM metadata
    if (file.name === entryPath) continue;
    if (file.name.endsWith('imsmanifest.xml')) continue;
    if (file.name.endsWith('.bat')) continue;

    const mime = getMime(file.name);
    const data = await file.async('base64');
    const uuid = makeUUID();

    manifest[uuid] = { mime, data, compressed: false };

    // Build reference keys: full path and path relative to entry dir
    const relPath = entryDir && file.name.startsWith(entryDir)
      ? file.name.slice(entryDir.length)
      : file.name;

    uuidMap[relPath] = uuid;
    if (relPath !== file.name) uuidMap[file.name] = uuid;
  }

  // Replace all asset references in the HTML with UUIDs
  let processedHtml = replaceAssetRefs(templateHtml, uuidMap);

  // If this HTML already has bundled manifest data (re-bundling), strip it
  processedHtml = stripExistingBundle(processedHtml);

  // Wrap the HTML in the bundler shell
  return buildOutputHtml(processedHtml, manifest, annotateScript);
}

/**
 * Takes a plain HTML file buffer and injects the annotate tool.
 * No asset bundling needed — just inject the script.
 */
export function bundlePlainHtml(
  htmlBuffer: Buffer,
  annotateScript: string,
): string {
  let html = htmlBuffer.toString('utf-8');
  html = stripExistingBundle(html);
  return injectAnnotate(html, annotateScript);
}

// ─── Find entry HTML ─────────────────────────────────────────────────────────
function findEntryHtml(zip: JSZip): string | null {
  const files = Object.keys(zip.files);

  // Priority 1: index.html at root
  if (zip.files['index.html']) return 'index.html';
  if (zip.files['Index.html']) return 'Index.html';

  // Priority 2: imsmanifest.xml href attribute
  const manifest = zip.files['imsmanifest.xml'];
  if (manifest) {
    // We can't await here easily, so we return a sync check below
  }

  // Priority 3: index.html one level deep
  const nested = files.find(f => /^[^/]+\/index\.html$/i.test(f));
  if (nested) return nested;

  // Priority 4: any .html file
  const anyHtml = files.find(f => /\.html?$/i.test(f) && !zip.files[f].dir);
  return anyHtml ?? null;
}

// ─── Replace asset refs in HTML ──────────────────────────────────────────────
function replaceAssetRefs(html: string, uuidMap: Record<string, string>): string {
  // Sort paths longest-first to avoid partial replacements
  const paths = Object.keys(uuidMap).sort((a, b) => b.length - a.length);

  for (const refPath of paths) {
    const uuid = uuidMap[refPath];
    // Escape special regex chars in the path
    const escaped = refPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Replace occurrences inside attribute values and CSS url()
    html = html.replace(new RegExp(escaped, 'g'), uuid);
  }
  return html;
}

// ─── Strip existing bundle markers (for re-bundling) ─────────────────────────
function stripExistingBundle(html: string): string {
  // Remove existing bundler script tags
  html = html.replace(/<script[^>]*type="__bundler\/manifest"[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script[^>]*type="__bundler\/template"[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script[^>]*type="__bundler\/ext_resources"[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<div[^>]*id="__bundler_thumbnail"[^>]*>[\s\S]*?<\/div>/gi, '');
  html = html.replace(/<div[^>]*id="__bundler_loading"[^>]*>[^<]*<\/div>/gi, '');
  // Remove existing annotate injections
  html = html.replace(/<script[^>]*id="__annotate_inline"[^>]*>[\s\S]*?<\/script>/gi, '');
  return html;
}

// ─── Inject annotate into a plain HTML document ──────────────────────────────
function injectAnnotate(html: string, annotateScript: string): string {
  const annotateTag = `
<script id="__annotate_inline">
window.AnnotateConfig = {
  project: document.title || 'review',
  note: 'Please review this document. Check layout, wording, and content.',
  startOpen: false,
  theme: 'auto'
};
${annotateScript}
</script>`;

  // Inject before </body> if it exists, otherwise append
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${annotateTag}\n</body>`);
  }
  return html + annotateTag;
}

// ─── Build the final output HTML shell ───────────────────────────────────────
function buildOutputHtml(
  templateHtml: string,
  manifest: Manifest,
  annotateScript: string,
): string {
  // Derive a title from the template
  const titleMatch = templateHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'SCORM Review';

  // Safely serialize the template and manifest for embedding
  const manifestJson = JSON.stringify(manifest);
  const templateJson = JSON.stringify(templateHtml);

  // Annotate script is embedded as a JS string assigned to window.__ANNOTATE_SCRIPT__
  // so the unpacker can inject it after the template is rendered
  const annotateEscaped = escapeForJsonString(annotateScript);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #faf9f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    #__bundler_loading { position: fixed; bottom: 20px; right: 20px; font: 13px/1.4 -apple-system, BlinkMacSystemFont, sans-serif; color: #666; background: #fff; padding: 8px 14px; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.12); z-index: 10000; }
    #__bundler_thumbnail { position: fixed; inset: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #faf9f5; z-index: 9999; }
    #__bundler_thumbnail svg { width: 120px; height: 120px; }
    #__bundler_placeholder { color: #999; font-size: 14px; }
  </style>
</head>
<body>
  <div id="__bundler_thumbnail">
    ${THUMBNAIL_SVG}
  </div>
  <div id="__bundler_loading">Unpacking...</div>

  <script>window.__ANNOTATE_SCRIPT__ = "${annotateEscaped}";</script>
  <script>${UNPACKER_SCRIPT}</script>

  <script type="__bundler/manifest">${manifestJson}</script>
  <script type="__bundler/template">${templateJson}</script>
</body>
</html>`;
}
