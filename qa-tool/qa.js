#!/usr/bin/env node
/**
 * qa.js — SCORM QA Tool
 *
 * Usage:
 *   node qa-tool/qa.js <path-to-scorm-folder-or-zip>
 *
 * Examples:
 *   node qa-tool/qa.js sample2/w/scorm-package
 *   node qa-tool/qa.js my-module.zip
 *
 * Output:
 *   QA-Report-<modulename>-<date>.html  (saved next to the input)
 */

'use strict';

const { chromium } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const { buildReport } = require('./report');

// ─── CLI arg ─────────────────────────────────────────────────────────────────
const input = process.argv[2];
if (!input) {
  console.error('Usage: node qa-tool/qa.js <scorm-folder-or-zip>');
  process.exit(1);
}

const absInput = path.resolve(input);
if (!fs.existsSync(absInput)) {
  console.error('Path not found:', absInput);
  process.exit(1);
}

// ─── Resolve serve directory ──────────────────────────────────────────────────
let serveDir = absInput;
let tmpDir   = null;

if (absInput.endsWith('.zip')) {
  // Unzip to a temp directory
  tmpDir   = absInput.replace(/\.zip$/, '_qa_tmp');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    execSync(`unzip -q "${absInput}" -d "${tmpDir}"`);
  } catch (e) {
    console.error('Failed to unzip:', e.message);
    process.exit(1);
  }
  // Find folder containing index.html
  const findIndex = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (f.toLowerCase() === 'index.html') return dir;
      if (fs.statSync(full).isDirectory()) {
        const found = findIndex(full);
        if (found) return found;
      }
    }
    return null;
  };
  serveDir = findIndex(tmpDir) || tmpDir;
}

// ─── Start local HTTP server ──────────────────────────────────────────────────
const PORT = 18765;

function serveFile(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(serveDir, urlPath === '/' ? 'index.html' : urlPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // try index.html inside
    const idx = path.join(filePath, 'index.html');
    if (fs.existsSync(idx)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(idx));
      return;
    }
    res.writeHead(404); res.end('Not found'); return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.html': 'text/html', '.js': 'application/javascript',
    '.css': 'text/css',   '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',  '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
    '.woff': 'font/woff', '.woff2': 'font/woff2',
    '.json': 'application/json', '.xml': 'application/xml',
  }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  res.end(fs.readFileSync(filePath));
}

const server = http.createServer(serveFile);
server.listen(PORT);
const BASE_URL = `http://localhost:${PORT}`;

// ─── Screenshot helper ────────────────────────────────────────────────────────
const SS_DIR = path.join(__dirname, '_screenshots');
fs.mkdirSync(SS_DIR, { recursive: true });

async function screenshot(page, name) {
  const file = path.join(SS_DIR, name + '.png');
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

function toDataUrl(file) {
  if (!file || !fs.existsSync(file)) return '';
  return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔍 SCORM QA Tool');
  console.log('   Serving:', serveDir);
  console.log('   URL:', BASE_URL);
  console.log('   Starting browser...\n');

  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // Inject SCORM 1.2 API stub
  await page.addInitScript(() => {
    const store = {
      'cmi.core.student_name': 'QA Tester',
      'cmi.core.student_id':   'qa-001',
      'cmi.core.lesson_status':'incomplete',
      'cmi.core.entry':        'ab-initio',
      'cmi.core.credit':       'credit',
      'cmi.core.lesson_mode':  'normal',
    };
    const calls = [];
    window.__scorm__ = { store, calls, initialized: false };
    window.API = {
      LMSInitialize:     () => { window.__scorm__.initialized = true; calls.push({ fn: 'Initialize' }); return 'true'; },
      LMSFinish:         () => { calls.push({ fn: 'Finish' }); return 'true'; },
      LMSGetValue:       (k) => store[k] ?? '',
      LMSSetValue:       (k, v) => { store[k] = v; calls.push({ fn: 'SetValue', key: k, value: v }); return 'true'; },
      LMSCommit:         () => 'true',
      LMSGetLastError:   () => '0',
      LMSGetErrorString: () => '',
      LMSGetDiagnostic:  () => '',
    };
    window.__jsErrors__ = [];
    window.addEventListener('error', e => window.__jsErrors__.push(e.message));
  });

  const bugs   = [];
  const passes = [];
  const screenshots = {};

  // ── CHECK 1: Load ───────────────────────────────────────────────────────────
  process.stdout.write('  [1/7] Loading module... ');
  await page.goto(BASE_URL + '/index.html');
  try {
    await page.waitForFunction(() => {
      const el = document.getElementById('__bundler_loading');
      return !el || el.style.display === 'none' || el.textContent === '';
    }, { timeout: 20_000 });
    passes.push({ id: 'CHK-001', title: 'Module loads without fatal errors' });
    console.log('✅ PASS');
  } catch {
    bugs.push({ id: 'BUG-001', severity: 'critical', title: 'Module failed to load', desc: 'The module did not finish loading within 20 seconds. The bundler loading indicator never disappeared.', steps: ['Open index.html in a browser', 'Wait — the loading spinner never goes away'], impact: 'Learner cannot start the module at all.' });
    console.log('❌ FAIL');
  }
  screenshots.landing = await screenshot(page, '01-landing');

  // ── CHECK 2: Title ──────────────────────────────────────────────────────────
  process.stdout.write('  [2/7] Checking title... ');
  const title = await page.title();
  if (title && title.trim().length > 0) {
    passes.push({ id: 'CHK-002', title: `Page title is set: "${title}"` });
    console.log('✅ PASS —', title);
  } else {
    bugs.push({ id: 'BUG-002', severity: 'medium', title: 'Page title is missing or empty', desc: 'The <title> tag is empty. LMS systems use this to identify the module.', steps: ['Open index.html', 'Check the browser tab — it shows no title'], impact: 'LMS may display the module with no name.' });
    console.log('❌ FAIL');
  }

  // ── CHECK 3: SCORM API ──────────────────────────────────────────────────────
  process.stdout.write('  [3/7] Checking SCORM API... ');
  await page.waitForTimeout(3000);
  const scormInit = await page.evaluate(() => window.__scorm__?.initialized ?? false);
  if (scormInit) {
    passes.push({ id: 'CHK-003', title: 'SCORM API connected — LMSInitialize called' });
    console.log('✅ PASS');
  } else {
    bugs.push({ id: 'BUG-003', severity: 'critical', title: 'Module never calls LMSInitialize — no SCORM connection', desc: 'The module did not call LMSInitialize on load. Without this, the LMS cannot track the learner\'s progress, score, or completion.', steps: ['Open index.html inside an LMS', 'Check SCORM debug logs — LMSInitialize is never called'], impact: 'Score, completion status and time will NOT be recorded in any LMS.' });
    console.log('❌ FAIL');
  }

  // ── CHECK 4: JS errors ──────────────────────────────────────────────────────
  process.stdout.write('  [4/7] Checking for JS errors... ');
  const jsErrors = await page.evaluate(() => window.__jsErrors__ || []);
  const errOverlay = await page.evaluate(() => {
    const el = document.getElementById('__bundler_err');
    return el?.textContent?.trim() || '';
  });
  const allErrors = [...new Set([...jsErrors, ...(errOverlay ? [errOverlay.slice(0,200)] : [])])];

  if (allErrors.length === 0) {
    passes.push({ id: 'CHK-004', title: 'No JavaScript errors detected' });
    console.log('✅ PASS');
  } else {
    // Annotate screenshot
    await page.evaluate(() => {
      const el = document.getElementById('__bundler_err');
      if (el) { el.style.outline = '4px solid red'; }
      const lbl = document.createElement('div');
      lbl.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:white;font:bold 14px sans-serif;padding:8px 16px;z-index:2147483647;text-align:center;';
      lbl.textContent = '⚠️  BUG FOUND: JavaScript Error Detected';
      document.body.prepend(lbl);
    });
    screenshots.jsError = await screenshot(page, '04-js-error');
    bugs.push({ id: 'BUG-004', severity: 'high', title: `JavaScript errors detected (${allErrors.length} error${allErrors.length > 1 ? 's' : ''})`, desc: `The module has ${allErrors.length} JavaScript error(s) running in the background. This can cause silent failures in quiz scoring, animations, or SCORM data reporting.`, errors: allErrors, steps: ['Open index.html in Chrome', 'Press F12 → Console tab', 'Observe red error messages on load'], impact: 'May cause unexpected behaviour, broken interactions, or incorrect score reporting.', screenshot: 'jsError' });
    console.log('❌ FAIL —', allErrors.length, 'error(s)');
  }

  // ── CHECK 5: Broken images ──────────────────────────────────────────────────
  process.stdout.write('  [5/7] Checking images... ');
  await page.evaluate(() => { ['__an_root','__an_bar','__an_launch'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display='none'; }); });

  const imgResult = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return {
      total: imgs.length,
      brokenBundled: imgs.filter(i => (i.src.startsWith('blob:') || i.src.startsWith('data:')) && i.naturalWidth === 0).map(i => i.src.slice(0,80)),
      brokenExternal: imgs.filter(i => i.src.startsWith('http') && !i.src.includes('localhost') && i.naturalWidth === 0).map(i => i.src),
    };
  });

  if (imgResult.brokenBundled.length === 0 && imgResult.brokenExternal.length === 0) {
    passes.push({ id: 'CHK-005', title: `All ${imgResult.total} images loaded correctly` });
    console.log('✅ PASS —', imgResult.total, 'images OK');
  } else {
    // Highlight broken images
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('img'))
        .filter(img => img.naturalWidth === 0 && img.src.length > 0)
        .forEach(img => {
          const r = img.getBoundingClientRect();
          if (r.width === 0) return;
          const box = document.createElement('div');
          box.style.cssText = `position:fixed;border:3px solid red;background:rgba(220,38,38,0.15);z-index:2147483647;pointer-events:none;display:flex;align-items:center;justify-content:center;font:bold 11px sans-serif;color:red;text-align:center;`;
          box.style.left=r.left+'px'; box.style.top=r.top+'px';
          box.style.width=Math.max(r.width,60)+'px'; box.style.height=Math.max(r.height,40)+'px';
          box.textContent='❌ Broken';
          document.body.appendChild(box);
        });
    });
    screenshots.brokenImages = await screenshot(page, '05-broken-images');

    if (imgResult.brokenBundled.length > 0) {
      bugs.push({ id: 'BUG-005', severity: 'critical', title: `${imgResult.brokenBundled.length} bundled image(s) are broken`, desc: 'Images that are part of the SCORM package itself are not loading. This means the assets were not properly included in the ZIP.', steps: ['Open index.html', 'Look for blank/empty spaces where images should be'], impact: 'Core visual content is missing for all learners.', screenshot: 'brokenImages' });
    }
    if (imgResult.brokenExternal.length > 0) {
      bugs.push({ id: 'BUG-006', severity: 'high', title: `${imgResult.brokenExternal.length} external image(s) failed to load`, desc: `The module links to ${imgResult.brokenExternal.length} image(s) hosted on external servers (e.g. Google Drive). These images are either private, deleted, or the sharing permission has expired.`, urls: imgResult.brokenExternal, steps: ['Open index.html', 'Observe blank spaces where images should appear', 'Check browser console for 403/404 errors on external URLs'], impact: 'Visual content is missing. SCORM packages should never depend on external URLs — all assets must be bundled inside the ZIP.', screenshot: 'brokenImages' });
    }
    console.log('❌ FAIL —', imgResult.brokenBundled.length, 'bundled broken,', imgResult.brokenExternal.length, 'external broken');
  }

  // ── CHECK 6: Navigation / page progression ──────────────────────────────────
  process.stdout.write('  [6/7] Checking navigation... ');

  // Click start if present
  const hasStart = await page.evaluate(() => !!document.querySelector('button[aria-label="Start module"], button.land-start-btn'));
  if (hasStart) {
    await page.click('button[aria-label="Start module"], button.land-start-btn', { force: true }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  await page.evaluate(() => { ['__an_root','__an_bar','__an_launch'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display='none'; }); });

  const beforeCounter = await page.evaluate(() => document.querySelector('.tb-page, [class*="page-num"], [class*="counter"]')?.textContent?.trim() || '');
  const clicksToAdvance = [];
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => { ['__an_root','__an_bar','__an_launch'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display='none'; }); });
    const c = await page.evaluate(() => document.querySelector('.tb-page, [class*="page-num"], [class*="counter"]')?.textContent?.trim() || '');
    clicksToAdvance.push(c);
    await page.evaluate(() => {
      const btn = document.querySelector('button.ctl.next, button[aria-label*="next" i]:not([aria-label*="review" i])');
      if (btn && !btn.disabled) btn.click();
    });
    await page.waitForTimeout(700);
  }
  const afterCounter = await page.evaluate(() => document.querySelector('.tb-page, [class*="page-num"], [class*="counter"]')?.textContent?.trim() || '');
  const allSame = clicksToAdvance.every(c => c === clicksToAdvance[0]);

  if (!beforeCounter) {
    passes.push({ id: 'CHK-006', title: 'Navigation — no page counter found (single-page module or custom nav)' });
    console.log('✅ PASS (no counter)');
  } else if (!allSame) {
    passes.push({ id: 'CHK-006', title: `Navigation works — page counter advanced from ${clicksToAdvance[0]} to ${afterCounter}` });
    console.log('✅ PASS —', clicksToAdvance[0], '→', afterCounter);
  } else {
    await page.evaluate((counters) => {
      const pg = document.querySelector('.tb-page');
      if (pg) { pg.style.background='red'; pg.style.color='white'; pg.style.padding='2px 8px'; pg.style.borderRadius='4px'; }
      const lbl = document.createElement('div');
      lbl.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:white;font:bold 13px sans-serif;padding:8px 16px;z-index:2147483647;';
      lbl.textContent = `BUG: Clicked Next 5 times — page counter stuck at "${counters[0]}" the whole time`;
      document.body.prepend(lbl);
    }, clicksToAdvance);
    screenshots.stuck = await screenshot(page, '06-stuck-navigation');
    bugs.push({ id: 'BUG-007', severity: 'critical', title: `Module is stuck — cannot progress past page ${clicksToAdvance[0]}`, desc: `After clicking the Next button 5 times, the page counter never changed. It stayed at "${clicksToAdvance[0]}" for every click. The learner has no way to reach later pages.`, evidence: clicksToAdvance, steps: ['Open index.html', 'Click Start', 'Click the Next button repeatedly', 'Observe: page counter never advances'], impact: 'Learner is completely blocked. The module is uncompletable as-is. This is a blocker — do not publish.', screenshot: 'stuck' });
    console.log('❌ FAIL — stuck at', clicksToAdvance[0]);
  }

  // ── CHECK 7: SCORM completion ───────────────────────────────────────────────
  process.stdout.write('  [7/7] Checking SCORM completion status... ');
  const scormCalls = await page.evaluate(() => window.__scorm__?.calls || []);
  const statusCalls = scormCalls.filter(c => c.key === 'cmi.core.lesson_status');
  const scoreCalls  = scormCalls.filter(c => c.key === 'cmi.core.score.raw');
  const finalStatus = statusCalls.length ? statusCalls[statusCalls.length - 1].value : null;
  const finalScore  = scoreCalls.length  ? scoreCalls[scoreCalls.length - 1].value  : null;

  if (finalStatus) {
    passes.push({ id: 'CHK-007', title: `SCORM status reported: "${finalStatus}"${finalScore ? ` | Score: ${finalScore}` : ''}` });
    console.log('✅ PASS — status:', finalStatus, finalScore ? '| score: ' + finalScore : '');
  } else {
    passes.push({ id: 'CHK-007', title: 'SCORM status not yet set (may require full module completion)' });
    console.log('ℹ️  Not yet set');
  }

  screenshots.final = await screenshot(page, '07-final');
  await browser.close();
  server.close();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true });

  // ── Build report ────────────────────────────────────────────────────────────
  console.log('\n📄 Building report...');
  const report = buildReport({ title, bugs, passes, screenshots, scormCalls, input: absInput });

  const baseName = path.basename(absInput).replace(/\.(zip)$/i, '');
  const dateStr  = new Date().toISOString().slice(0,10);
  const outFile  = path.join(path.dirname(absInput), `QA-Report-${baseName}-${dateStr}.html`);
  fs.writeFileSync(outFile, report);

  console.log('\n✅ Done!');
  console.log('   Bugs found:  ', bugs.length);
  console.log('   Checks passed:', passes.length);
  console.log('   Report saved:', outFile);
  console.log('');

  // Open in browser
  try { execSync(`open "${outFile}"`); } catch {}
}

main().catch(e => { console.error(e); process.exit(1); });
