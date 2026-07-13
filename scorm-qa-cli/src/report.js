'use strict';

function severityColor(s) {
  return { critical: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#16a34a' }[s] || '#6b7280';
}
function severityBg(s) {
  return { critical: '#fee2e2', high: '#fef3c7', medium: '#dbeafe', low: '#dcfce7' }[s] || '#f3f4f6';
}

function buildReport({ title, bugs, passes, screenshots, scormCalls, input }) {
  const now = new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' });
  const critical = bugs.filter(b => b.severity === 'critical').length;
  const high     = bugs.filter(b => b.severity === 'high').length;
  const medium   = bugs.filter(b => b.severity === 'medium').length;
  const total    = bugs.length;
  const passed   = passes.length;

  const statusCalls = scormCalls.filter(c => c.key === 'cmi.core.lesson_status');
  const scoreCalls  = scormCalls.filter(c => c.key === 'cmi.core.score.raw');
  const finalStatus = statusCalls.length ? statusCalls[statusCalls.length - 1].value : '—';
  const finalScore  = scoreCalls.length  ? scoreCalls[scoreCalls.length - 1].value  : '—';

  const fs = require('fs');

  function ssImg(key) {
    if (!screenshots[key]) return '';
    if (!fs.existsSync(screenshots[key])) return '';
    const data = 'data:image/png;base64,' + fs.readFileSync(screenshots[key]).toString('base64');
    return `<div class="screenshot"><img src="${data}" alt="screenshot"><div class="ss-cap">📸 Screenshot captured automatically by QA script</div></div>`;
  }

  const bugsHtml = bugs.map(b => `
    <div class="bug-card">
      <div class="bug-head">
        <span class="badge" style="background:${severityBg(b.severity)};color:${severityColor(b.severity)}">${b.severity.toUpperCase()}</span>
        <span class="bug-id">${b.id}</span>
        <span class="bug-title">${b.title}</span>
      </div>
      <div class="bug-body">
        <div class="section-label">Description</div>
        <p>${b.desc}</p>

        ${b.steps ? `
        <div class="section-label">Steps to Reproduce</div>
        <ol>${b.steps.map(s => `<li>${s}</li>`).join('')}</ol>
        ` : ''}

        ${b.urls ? `
        <div class="section-label">Affected URLs</div>
        <div class="code-block">${b.urls.map(u => `<div>❌ ${u}</div>`).join('')}</div>
        ` : ''}

        ${b.errors ? `
        <div class="section-label">Error Messages</div>
        <div class="code-block">${b.errors.map(e => `<div>${e}</div>`).join('')}</div>
        ` : ''}

        ${b.evidence ? `
        <div class="section-label">Evidence — Page counter after each Next click</div>
        <div class="code-block">${b.evidence.map((c, i) => `<div>Click ${i + 1}: "${c}"</div>`).join('')}</div>
        ` : ''}

        <div class="section-label">Impact</div>
        <div class="impact">${b.impact}</div>

        ${b.screenshot ? ssImg(b.screenshot) : ''}
      </div>
    </div>
  `).join('');

  const passesHtml = passes.map(p => `
    <div class="pass-row">
      <span class="pass-icon">✅</span>
      <span class="pass-id">${p.id}</span>
      <span>${p.title}</span>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>QA Report — ${title || 'SCORM Module'}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f5f7; color: #172b4d; }
.header { background: linear-gradient(135deg, #1e3a5f, #0052cc); color: white; padding: 36px 48px; }
.header h1 { font-size: 26px; font-weight: 800; margin-bottom: 6px; }
.header .sub { opacity: .8; font-size: 14px; margin-top: 4px; }
.summary { display: flex; gap: 16px; padding: 24px 48px; background: white; border-bottom: 2px solid #e1e4e8; flex-wrap: wrap; }
.stat { border-radius: 10px; padding: 16px 28px; text-align: center; min-width: 110px; }
.stat .num { font-size: 36px; font-weight: 900; line-height: 1; }
.stat .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; margin-top: 4px; opacity: .7; }
.stat.red   { background: #fee2e2; color: #dc2626; }
.stat.orange{ background: #fef3c7; color: #b45309; }
.stat.blue  { background: #dbeafe; color: #1d4ed8; }
.stat.green { background: #dcfce7; color: #16a34a; }
.stat.gray  { background: #f3f4f6; color: #374151; }
.content { max-width: 1000px; margin: 32px auto; padding: 0 24px 60px; }
h2 { font-size: 18px; font-weight: 700; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e1e4e8; }
.bug-card { background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.08); margin-bottom: 24px; overflow: hidden; }
.bug-head { padding: 18px 24px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #f0f0f0; background: #fafafa; }
.badge { padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: .04em; }
.bug-id { font: 700 13px/1 monospace; color: #6b7280; }
.bug-title { font-size: 15px; font-weight: 700; }
.bug-body { padding: 20px 24px; }
.bug-body p, .bug-body li { font-size: 14px; line-height: 1.7; }
.bug-body ol { padding-left: 20px; margin: 8px 0; }
.bug-body li { margin-bottom: 4px; }
.section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; margin: 16px 0 6px; }
.section-label:first-child { margin-top: 0; }
.code-block { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; background: #1e1e2e; color: #cdd6f4; padding: 12px 16px; border-radius: 8px; overflow-x: auto; line-height: 1.8; }
.code-block div { color: #f38ba8; }
.impact { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px 16px; font-size: 14px; color: #92400e; }
.screenshot { margin-top: 16px; border-radius: 10px; overflow: hidden; border: 1px solid #e1e4e8; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.screenshot img { width: 100%; display: block; }
.ss-cap { background: #f4f5f7; font-size: 12px; color: #6b7280; padding: 8px 14px; border-top: 1px solid #e1e4e8; }
.pass-row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: white; border-radius: 8px; margin-bottom: 8px; font-size: 14px; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
.pass-icon { font-size: 16px; }
.pass-id { font: 700 12px monospace; color: #6b7280; min-width: 70px; }
.scorm-table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
.scorm-table th { background: #f4f5f7; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; padding: 10px 16px; text-align: left; }
.scorm-table td { padding: 10px 16px; font-size: 13px; border-top: 1px solid #f0f0f0; font-family: monospace; }
.scorm-table tr:hover td { background: #fafafa; }
footer { text-align: center; padding: 24px; color: #9ca3af; font-size: 12px; border-top: 1px solid #e1e4e8; background: white; margin-top: 40px; }
</style>
</head>
<body>

<div class="header">
  <h1>🐛 SCORM QA Bug Report</h1>
  <div class="sub">Module: <strong>${title || 'Unknown'}</strong></div>
  <div class="sub">File: <strong>${input}</strong></div>
  <div class="sub">Tested: <strong>${now}</strong> &nbsp;·&nbsp; Tool: <strong>scorm-qa v1.0.0</strong></div>
</div>

<div class="summary">
  <div class="stat ${total > 0 ? 'red' : 'green'}"><div class="num">${total}</div><div class="lbl">Total Bugs</div></div>
  <div class="stat ${critical > 0 ? 'red' : 'gray'}"><div class="num">${critical}</div><div class="lbl">Critical</div></div>
  <div class="stat ${high > 0 ? 'orange' : 'gray'}"><div class="num">${high}</div><div class="lbl">High</div></div>
  <div class="stat ${medium > 0 ? 'blue' : 'gray'}"><div class="num">${medium}</div><div class="lbl">Medium</div></div>
  <div class="stat green"><div class="num">${passed}</div><div class="lbl">Passed</div></div>
  <div class="stat gray"><div class="num">${finalStatus}</div><div class="lbl">SCORM Status</div></div>
  <div class="stat gray"><div class="num">${finalScore}</div><div class="lbl">Score</div></div>
</div>

<div class="content">
  ${total > 0 ? `
  <h2>🔴 Bugs Found (${total})</h2>
  ${bugsHtml}
  ` : `<h2 style="color:#16a34a">🎉 No bugs found — all checks passed!</h2>`}

  <h2>✅ Checks Passed (${passed})</h2>
  ${passesHtml}

  ${scormCalls.length > 0 ? `
  <h2>📡 SCORM API Call Log</h2>
  <table class="scorm-table">
    <thead><tr><th>#</th><th>Function</th><th>Key</th><th>Value</th></tr></thead>
    <tbody>
      ${scormCalls.slice(0, 30).map((c, i) => `
        <tr><td>${i + 1}</td><td>${c.fn}</td><td>${c.key || '—'}</td><td>${c.value || '—'}</td></tr>
      `).join('')}
      ${scormCalls.length > 30 ? `<tr><td colspan="4" style="text-align:center;color:#6b7280">... and ${scormCalls.length - 30} more calls</td></tr>` : ''}
    </tbody>
  </table>
  ` : ''}
</div>

<footer>Generated by scorm-qa &nbsp;·&nbsp; ${now}</footer>
</body>
</html>`;
}

module.exports = { buildReport };
