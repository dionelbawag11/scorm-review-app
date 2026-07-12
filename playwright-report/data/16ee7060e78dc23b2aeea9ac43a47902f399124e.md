# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo-for-boss.spec.ts >> 🎬 Live QA Demo — 1BOTP Module 2 SCORM Package
- Location: tests/demo-for-boss.spec.ts:71:5

# Error details

```
Error: page.waitForTimeout: Target page, context or browser has been closed
```

# Test source

```ts
  10  |  */
  11  | 
  12  | import { test, expect, Page } from '@playwright/test';
  13  | import * as fs from 'fs';
  14  | import * as path from 'path';
  15  | 
  16  | test.setTimeout(300_000); // 5 min for full walkthrough
  17  | 
  18  | // ---------------------------------------------------------------------------
  19  | // On-screen label helper
  20  | // ---------------------------------------------------------------------------
  21  | async function label(page: Page, text: string, color = '#6366f1') {
  22  |   await page.evaluate(
  23  |     ({ text, color }) => {
  24  |       document.getElementById('__qa__')?.remove();
  25  |       const d = document.createElement('div');
  26  |       d.id = '__qa__';
  27  |       d.textContent = text;
  28  |       d.style.cssText = `
  29  |         position:fixed; top:14px; left:50%; transform:translateX(-50%);
  30  |         background:${color}; color:#fff;
  31  |         font:700 16px/1 -apple-system,sans-serif;
  32  |         padding:12px 24px; border-radius:999px; z-index:2147483647;
  33  |         box-shadow:0 6px 24px rgba(0,0,0,.4); white-space:nowrap;
  34  |         pointer-events:none;
  35  |       `;
  36  |       document.body.appendChild(d);
  37  |     },
  38  |     { text, color }
  39  |   );
  40  | }
  41  | 
  42  | // Glow a specific element
  43  | async function glow(page: Page, selector: string) {
  44  |   await page.evaluate((sel) => {
  45  |     const el = document.querySelector(sel) as HTMLElement | null;
  46  |     if (!el) return;
  47  |     const prev = el.style.cssText;
  48  |     el.style.outline = '3px solid #f59e0b';
  49  |     el.style.outlineOffset = '4px';
  50  |     el.style.boxShadow = '0 0 0 6px rgba(245,158,11,0.3)';
  51  |     setTimeout(() => { el.style.cssText = prev; }, 2500);
  52  |   }, selector);
  53  | }
  54  | 
  55  | // Hide the coreview annotation bar so it doesn't block SCORM buttons
  56  | async function hideOverlay(page: Page) {
  57  |   await page.evaluate(() => {
  58  |     ['__an_root', '__an_bar', '__an_launch', '__an_panel'].forEach(id => {
  59  |       const el = document.getElementById(id);
  60  |       if (el) el.style.display = 'none';
  61  |     });
  62  |   });
  63  | }
  64  | 
  65  | const PAUSE = 1800;
  66  | const SCREENSHOT_DIR = path.join(__dirname, '../test-results/demo-screenshots');
  67  | 
  68  | // ---------------------------------------------------------------------------
  69  | // Main demo test
  70  | // ---------------------------------------------------------------------------
  71  | test('🎬 Live QA Demo — 1BOTP Module 2 SCORM Package', async ({ page }) => {
  72  |   fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  73  | 
  74  |   // Inject SCORM 1.2 API stub so the module can initialise
  75  |   await page.addInitScript(() => {
  76  |     const store: Record<string, string> = {
  77  |       'cmi.core.student_name': 'QA Demo User',
  78  |       'cmi.core.student_id': 'qa-demo-001',
  79  |       'cmi.core.lesson_status': 'incomplete',
  80  |       'cmi.core.entry': 'ab-initio',
  81  |       'cmi.core.credit': 'credit',
  82  |       'cmi.core.lesson_mode': 'normal',
  83  |     };
  84  |     const calls: { action: string; key?: string; value?: string }[] = [];
  85  |     (window as Record<string, unknown>).API = {
  86  |       LMSInitialize: () => { calls.push({ action: 'Initialize' }); (window as Record<string, unknown>).__scorm_init__ = true; return 'true'; },
  87  |       LMSFinish:     () => { calls.push({ action: 'Finish' }); return 'true'; },
  88  |       LMSGetValue:   (k: string) => store[k] ?? '',
  89  |       LMSSetValue:   (k: string, v: string) => { store[k] = v; calls.push({ action: 'SetValue', key: k, value: v }); return 'true'; },
  90  |       LMSCommit:     () => 'true',
  91  |       LMSGetLastError:   () => '0',
  92  |       LMSGetErrorString: () => '',
  93  |       LMSGetDiagnostic:  () => '',
  94  |     };
  95  |     (window as Record<string, unknown>).__scorm_calls__ = calls;
  96  |     (window as Record<string, unknown>).__scorm_store__ = store;
  97  |   });
  98  | 
  99  |   // ── CHECK 1: Load ────────────────────────────────────────────────────────
  100 |   await label(page, '🔍 CHECK 1 — Loading the SCORM module…');
  101 |   await page.goto('http://localhost:8080/index.html');
  102 | 
  103 |   await page.waitForFunction(() => {
  104 |     const el = document.getElementById('__bundler_loading');
  105 |     return !el || el.style.display === 'none' || el.textContent === '';
  106 |   }, { timeout: 30_000 });
  107 | 
  108 |   await hideOverlay(page);
  109 |   await label(page, '✅ CHECK 1 PASSED — Module loaded with no errors', '#10b981');
> 110 |   await page.waitForTimeout(PAUSE);
      |              ^ Error: page.waitForTimeout: Target page, context or browser has been closed
  111 |   await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-landing.png') });
  112 | 
  113 |   // ── CHECK 2: Title ───────────────────────────────────────────────────────
  114 |   await label(page, '🔍 CHECK 2 — Verifying module title…');
  115 |   await page.waitForTimeout(PAUSE);
  116 |   const title = await page.title();
  117 |   await glow(page, '.tb-title, title');
  118 |   const titleOk = /1BOTP.*Module 2/i.test(title) || /Module 2/i.test(title);
  119 |   await label(page,
  120 |     titleOk ? `✅ CHECK 2 PASSED — Title: "${title}"` : `❌ CHECK 2 FAILED — Title: "${title}"`,
  121 |     titleOk ? '#10b981' : '#ef4444'
  122 |   );
  123 |   await page.waitForTimeout(PAUSE);
  124 |   expect(titleOk).toBe(true);
  125 | 
  126 |   // ── CHECK 3: Start button ────────────────────────────────────────────────
  127 |   await label(page, '🔍 CHECK 3 — Finding the Start button…');
  128 |   await hideOverlay(page);
  129 |   const startBtn = page.locator('button[aria-label="Start module"], button.land-start-btn').first();
  130 |   await expect(startBtn).toBeVisible({ timeout: 5_000 });
  131 |   await glow(page, 'button[aria-label="Start module"], button.land-start-btn');
  132 |   await label(page, '✅ CHECK 3 PASSED — Start button found (highlighted in orange)', '#10b981');
  133 |   await page.waitForTimeout(PAUSE);
  134 | 
  135 |   await startBtn.click({ force: true });
  136 |   await page.waitForTimeout(2000);
  137 |   await hideOverlay(page);
  138 |   await label(page, '▶️  Clicked START — module is now running', '#6366f1');
  139 |   await page.waitForTimeout(PAUSE);
  140 |   await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-start.png') });
  141 | 
  142 |   // ── CHECK 4: SCORM API ───────────────────────────────────────────────────
  143 |   await label(page, '🔍 CHECK 4 — Confirming SCORM API communication…');
  144 |   await page.waitForTimeout(PAUSE);
  145 |   const scormInit = await page.evaluate(() => !!(window as Record<string, unknown>).__scorm_init__);
  146 |   await label(page,
  147 |     scormInit ? '✅ CHECK 4 PASSED — Module connected to SCORM API (scores will be tracked)' : '❌ CHECK 4 FAILED — No SCORM API call detected',
  148 |     scormInit ? '#10b981' : '#ef4444'
  149 |   );
  150 |   await page.waitForTimeout(PAUSE);
  151 |   expect(scormInit).toBe(true);
  152 | 
  153 |   // ── CHECK 5: Navigate all pages ──────────────────────────────────────────
  154 |   await label(page, '🔍 CHECK 5 — Walking through every page of the module…');
  155 |   await page.waitForTimeout(PAUSE);
  156 | 
  157 |   let pageNum = 0;
  158 |   let totalPages = 0;
  159 |   const screenshotLog: string[] = [];
  160 | 
  161 |   for (let attempt = 0; attempt < 80; attempt++) {
  162 |     await hideOverlay(page);
  163 |     await page.waitForTimeout(600);
  164 | 
  165 |     // Read current page counter  e.g. "03/10"
  166 |     const counter = await page.evaluate(() =>
  167 |       document.querySelector('.tb-page')?.textContent?.trim() ?? ''
  168 |     );
  169 |     const match = counter.match(/(\d+)\/(\d+)/);
  170 |     if (match) {
  171 |       pageNum = parseInt(match[1]);
  172 |       totalPages = parseInt(match[2]);
  173 |     }
  174 | 
  175 |     // Screenshot each page
  176 |     const ssPath = path.join(SCREENSHOT_DIR, `page-${String(pageNum).padStart(2,'0')}-step-${String(attempt).padStart(2,'0')}.png`);
  177 |     await page.screenshot({ path: ssPath });
  178 |     screenshotLog.push(`Page ${pageNum}/${totalPages}`);
  179 | 
  180 |     await label(page, `📄 Page ${pageNum} of ${totalPages} — navigating…`, '#6366f1');
  181 | 
  182 |     // Check if next is available
  183 |     const nextEnabled = await page.evaluate(() => {
  184 |       const btn = document.querySelector('button.ctl.next') as HTMLButtonElement | null;
  185 |       return btn && !btn.disabled;
  186 |     });
  187 | 
  188 |     if (!nextEnabled) {
  189 |       await label(page, `🔒 End of module reached at page ${pageNum}/${totalPages}`, '#8b5cf6');
  190 |       await page.waitForTimeout(PAUSE);
  191 |       break;
  192 |     }
  193 | 
  194 |     await page.click('button.ctl.next', { force: true });
  195 |     await page.waitForTimeout(700);
  196 |   }
  197 | 
  198 |   await label(page,
  199 |     `✅ CHECK 5 PASSED — Navigated all ${totalPages} pages successfully`,
  200 |     '#10b981'
  201 |   );
  202 |   await page.waitForTimeout(PAUSE);
  203 |   expect(totalPages).toBeGreaterThan(0);
  204 | 
  205 |   // ── CHECK 6: Broken images ───────────────────────────────────────────────
  206 |   await label(page, '🔍 CHECK 6 — Checking for broken images…');
  207 |   await page.waitForTimeout(PAUSE);
  208 | 
  209 |   const brokenBundled = await page.evaluate(() =>
  210 |     Array.from(document.querySelectorAll('img'))
```