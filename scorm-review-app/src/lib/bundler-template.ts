/**
 * bundler-template.ts
 * The JS runtime that unpacks assets from the embedded manifest at load time.
 * This is injected verbatim into the output HTML.
 */

export const UNPACKER_SCRIPT = `
document.addEventListener('DOMContentLoaded', async function() {
  var loading = document.getElementById('__bundler_loading');
  function setStatus(msg) { if (loading) loading.textContent = msg; }

  window.addEventListener('error', function(e) {
    var p = document.body || document.documentElement;
    var d = document.getElementById('__bundler_err') || p.appendChild(document.createElement('div'));
    d.id = '__bundler_err';
    d.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;font:12px/1.4 ui-monospace,monospace;background:#2a1215;color:#ff8a80;padding:10px 14px;border-radius:8px;border:1px solid #5c2b2e;z-index:99999;white-space:pre-wrap;max-height:40vh;overflow:auto';
    d.textContent = (d.textContent ? d.textContent + '\\n' : '') +
      '[bundle] ' + (e.message || e.type) +
      (e.filename ? ' (' + e.filename.slice(0,60) + ':' + e.lineno + ')' : '');
  }, true);

  try {
    var manifestEl = document.querySelector('script[type="__bundler/manifest"]');
    var templateEl = document.querySelector('script[type="__bundler/template"]');
    if (!manifestEl || !templateEl) {
      setStatus('Error: missing bundle data');
      return;
    }

    var manifest = JSON.parse(manifestEl.textContent);
    var template = JSON.parse(templateEl.textContent);

    var uuids = Object.keys(manifest);
    setStatus('Unpacking ' + uuids.length + ' assets...');

    var blobUrls = {};
    await Promise.all(uuids.map(async function(uuid) {
      var entry = manifest[uuid];
      try {
        var binaryStr = atob(entry.data);
        var bytes = new Uint8Array(binaryStr.length);
        for (var i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        var finalBytes = bytes;
        if (entry.compressed && typeof DecompressionStream !== 'undefined') {
          var ds = new DecompressionStream('gzip');
          var writer = ds.writable.getWriter();
          var reader = ds.readable.getReader();
          writer.write(bytes); writer.close();
          var chunks = [], totalLen = 0;
          while (true) {
            var res = await reader.read();
            if (res.done) break;
            chunks.push(res.value); totalLen += res.value.length;
          }
          finalBytes = new Uint8Array(totalLen);
          var offset = 0;
          for (var ci = 0; ci < chunks.length; ci++) { finalBytes.set(chunks[ci], offset); offset += chunks[ci].length; }
        }
        blobUrls[uuid] = URL.createObjectURL(new Blob([finalBytes], { type: entry.mime }));
      } catch(err) {
        console.error('Failed to decode asset ' + uuid + ':', err);
        blobUrls[uuid] = URL.createObjectURL(new Blob([], { type: entry.mime }));
      }
    }));

    setStatus('Rendering...');
    for (var uuid of uuids) template = template.split(uuid).join(blobUrls[uuid]);

    template = template.replace(/\\s+integrity="[^"]*"/gi, '').replace(/\\s+crossorigin="[^"]*"/gi, '');

    var resourceScript = '<script>window.__resources = ' +
      JSON.stringify({}).split('</' + 'script>').join('<\\\\/' + 'script>') +
      ';</' + 'script>';

    var headOpen = template.match(/<head[^>]*>/i);
    if (headOpen) {
      var hi = headOpen.index + headOpen[0].length;
      template = template.slice(0, hi) + resourceScript + template.slice(hi);
    }

    var doc = new DOMParser().parseFromString(template, 'text/html');
    document.documentElement.replaceWith(doc.documentElement);
    var dead = Array.from(document.scripts);
    for (var old of dead) {
      var s = document.createElement('script');
      for (var a of old.attributes) s.setAttribute(a.name, a.value);
      s.textContent = old.textContent;
      if ((s.type === 'text/babel' || s.type === 'text/jsx') && s.src) {
        var r = await fetch(s.src);
        s.textContent = await r.text();
        s.removeAttribute('src');
      }
      var p = s.src ? new Promise(function(resolve) { s.onload = s.onerror = resolve; }) : null;
      old.replaceWith(s);
      if (p) await p;
    }
    if (window.Babel && typeof window.Babel.transformScriptTags === 'function') {
      window.Babel.transformScriptTags();
    }

    // Inject annotate review tool
    window.AnnotateConfig = {
      project: document.title || 'scorm-review',
      note: 'Please review all slides. Check layout, wording, and content.',
      startOpen: false,
      theme: 'auto'
    };
    await new Promise(function(resolve) {
      var ann = document.createElement('script');
      ann.id = '__annotate_inline';
      ann.textContent = window.__ANNOTATE_SCRIPT__;
      document.head.appendChild(ann);
      resolve();
    });

  } catch(err) {
    setStatus('Error unpacking: ' + err.message);
    console.error('Bundle unpack error:', err);
  }
});
`;

export const THUMBNAIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#6366f1"></rect><text x="50" y="58" font-size="32" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#fff">▶</text></svg>`;
