import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';

type Status = 'idle' | 'processing' | 'done' | 'error';

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    const allowed = ['.zip', '.html', '.htm'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowed.includes(ext)) {
      setStatus('error');
      setMessage('Please upload a .zip SCORM package or an .html file.');
      return;
    }

    setFileName(file.name);
    setStatus('processing');
    setMessage('Packing assets and injecting review tools…');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      // Get output filename from header or build it
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const baseName = file.name.replace(/\.(zip|html|htm)$/i, '');
      const outName = match ? match[1] : `${baseName}_review_file.html`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outName;
      a.click();
      URL.revokeObjectURL(url);

      setStatus('done');
      setMessage(`Downloaded as: ${outName}`);
    } catch (e: unknown) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'An unexpected error occurred.');
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const reset = () => {
    setStatus('idle');
    setMessage('');
    setFileName('');
  };

  return (
    <>
      <Head>
        <title>SCORM → Review File Converter</title>
        <meta name="description" content="Convert your SCORM package into a self-contained review HTML file with annotation tools." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={styles.main}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.badge}>SCORM CONVERTER</div>
          <h1 style={styles.title}>
            Turn any SCORM package into a<br />
            <span style={styles.titleAccent}>shareable review file</span>
          </h1>
          <p style={styles.subtitle}>
            Upload a <strong>.zip</strong> SCORM package or <strong>.html</strong> file.
            We bundle all assets into one self-contained HTML with built-in annotation tools — ready to share with your boss.
          </p>
        </div>

        {/* Upload card */}
        <div
          style={{
            ...styles.dropzone,
            ...(dragging ? styles.dropzoneDragging : {}),
            ...(status === 'error' ? styles.dropzoneError : {}),
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => status === 'idle' && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.html,.htm"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />

          {status === 'idle' && (
            <>
              <div style={styles.uploadIcon}>
                <svg width="48" height="48" fill="none" viewBox="0 0 24 24">
                  <path d="M12 3v13M7 8l5-5 5 5" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M20 17v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <p style={styles.dropText}>
                <span style={styles.dropHighlight}>Click to upload</span> or drag &amp; drop
              </p>
              <p style={styles.dropSub}>ZIP (SCORM package) · HTML file — up to 100 MB</p>
            </>
          )}

          {status === 'processing' && (
            <div style={styles.processingWrap}>
              <div style={styles.spinner} />
              <p style={styles.processingText}>{message}</p>
              {fileName && <p style={styles.fileNameText}>{fileName}</p>}
            </div>
          )}

          {status === 'done' && (
            <div style={styles.doneWrap}>
              <div style={styles.checkIcon}>
                <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="#22c55e" opacity="0.15" />
                  <path d="M7 12.5l3.5 3.5L17 9" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={styles.doneText}>Review file ready!</p>
              <p style={styles.doneFile}>{message}</p>
              <button style={styles.resetBtn} onClick={(e) => { e.stopPropagation(); reset(); }}>
                Convert another file
              </button>
            </div>
          )}

          {status === 'error' && (
            <div style={styles.errorWrap}>
              <div>
                <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="#ef4444" opacity="0.15" />
                  <path d="M12 8v4M12 16h.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <p style={styles.errorText}>Something went wrong</p>
              <p style={styles.errorMsg}>{message}</p>
              <button style={styles.resetBtn} onClick={(e) => { e.stopPropagation(); reset(); }}>
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Features */}
        <div style={styles.features}>
          {[
            { icon: '📦', title: 'Accepts ZIP or HTML', desc: 'SCORM packages or plain HTML — we handle both' },
            { icon: '🔗', title: 'Self-contained output', desc: 'All images, audio & scripts bundled — no server needed' },
            { icon: '✏️', title: 'Annotation tools built-in', desc: 'Reviewers can highlight, pin, draw and comment directly' },
            { icon: '⬇️', title: 'One-click download', desc: 'Downloads as filename_review_file.html instantly' },
          ].map((f) => (
            <div key={f.title} style={styles.featureCard}>
              <span style={styles.featureIcon}>{f.icon}</span>
              <h3 style={styles.featureTitle}>{f.title}</h3>
              <p style={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>

        <p style={styles.footer}>
          Files are processed in memory and never stored on the server.
        </p>
      </main>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px 60px',
    gap: '40px',
    background: 'linear-gradient(145deg, #0f0f13 0%, #13131a 50%, #0d0d11 100%)',
  },
  header: {
    textAlign: 'center',
    maxWidth: '600px',
  },
  badge: {
    display: 'inline-block',
    background: 'rgba(99,102,241,0.15)',
    color: '#818cf8',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '4px 14px',
    marginBottom: '18px',
    textTransform: 'uppercase' as const,
  },
  title: {
    fontSize: 'clamp(28px, 5vw, 42px)',
    fontWeight: 800,
    lineHeight: 1.2,
    color: '#f0f0f5',
    marginBottom: '16px',
  },
  titleAccent: {
    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '15px',
    lineHeight: 1.7,
    color: '#9ca3af',
  },
  dropzone: {
    width: '100%',
    maxWidth: '560px',
    minHeight: '220px',
    border: '2px dashed rgba(99,102,241,0.35)',
    borderRadius: '18px',
    background: 'rgba(99,102,241,0.04)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: '40px 32px',
    transition: 'all 0.2s ease',
    gap: '10px',
  },
  dropzoneDragging: {
    borderColor: '#6366f1',
    background: 'rgba(99,102,241,0.1)',
    transform: 'scale(1.01)',
  },
  dropzoneError: {
    borderColor: 'rgba(239,68,68,0.5)',
    background: 'rgba(239,68,68,0.04)',
    cursor: 'default',
  },
  uploadIcon: {
    marginBottom: '8px',
  },
  dropText: {
    fontSize: '15px',
    color: '#d1d5db',
    fontWeight: 500,
  },
  dropHighlight: {
    color: '#818cf8',
    fontWeight: 700,
  },
  dropSub: {
    fontSize: '13px',
    color: '#6b7280',
  },
  processingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  spinner: {
    width: '42px',
    height: '42px',
    border: '3px solid rgba(99,102,241,0.2)',
    borderTop: '3px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  processingText: {
    fontSize: '15px',
    color: '#d1d5db',
    fontWeight: 500,
  },
  fileNameText: {
    fontSize: '13px',
    color: '#6b7280',
  },
  doneWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  checkIcon: {},
  doneText: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#22c55e',
  },
  doneFile: {
    fontSize: '13px',
    color: '#6b7280',
    textAlign: 'center',
  },
  errorWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  errorText: {
    fontSize: '17px',
    fontWeight: 700,
    color: '#ef4444',
  },
  errorMsg: {
    fontSize: '13px',
    color: '#9ca3af',
    textAlign: 'center',
    maxWidth: '380px',
  },
  resetBtn: {
    marginTop: '6px',
    padding: '9px 22px',
    borderRadius: '8px',
    border: 'none',
    background: 'rgba(99,102,241,0.15)',
    color: '#818cf8',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    width: '100%',
    maxWidth: '780px',
  },
  featureCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px',
    padding: '20px 18px',
  },
  featureIcon: {
    fontSize: '24px',
    display: 'block',
    marginBottom: '10px',
  },
  featureTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#e5e7eb',
    marginBottom: '6px',
  },
  featureDesc: {
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: 1.5,
  },
  footer: {
    fontSize: '12px',
    color: '#4b5563',
    textAlign: 'center',
  },
};
