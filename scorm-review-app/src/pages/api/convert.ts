import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File as FormidableFile } from 'formidable';
import fs from 'fs';
import path from 'path';
import { bundleScormZip, bundlePlainHtml } from '../../lib/bundler';

// Tell Next.js not to parse the body — formidable handles it
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '150mb',
  },
};

// ─── Load the annotate script once at module level ───────────────────────────
// The file lives in public/coreview.js so it's available both
// during local dev and after Vercel deployment.
function loadAnnotateScript(): string {
  // Try multiple paths to support both local dev and Vercel
  // turbopackIgnore comments suppress the NFT trace warning for process.cwd() calls
  const candidates = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'coreview.js'),
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'src', 'public', 'coreview.js'),
    path.join(__dirname, '..', '..', '..', 'public', 'coreview.js'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  }
  // Fallback: minimal stub so the page still loads
  console.error('[convert] coreview.js not found in:', candidates);
  return '/* coreview script not found */';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse multipart form
  const form = new IncomingForm({
    maxFileSize: 150 * 1024 * 1024, // 150 MB
    keepExtensions: true,
  });

  let fields: Record<string, string | string[]>;
  let files: Record<string, FormidableFile | FormidableFile[]>;

  try {
    [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, f, fi) => {
        if (err) reject(err);
        else resolve([f as Record<string, string | string[]>, fi as Record<string, FormidableFile | FormidableFile[]>]);
      });
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ error: `Failed to parse upload: ${msg}` });
  }

  // Get the uploaded file
  const rawFile = files['file'];
  const uploadedFile: FormidableFile | null = Array.isArray(rawFile)
    ? (rawFile[0] ?? null)
    : (rawFile ?? null);

  if (!uploadedFile) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const originalName: string = uploadedFile.originalFilename ?? 'upload';
  const ext = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();

  if (!['.zip', '.html', '.htm'].includes(ext)) {
    fs.unlinkSync(uploadedFile.filepath);
    return res.status(400).json({ error: 'Only .zip, .html, or .htm files are accepted.' });
  }

  // Build output filename: strip extension, append _review_file.html
  const baseName = originalName.replace(/\.(zip|html|htm)$/i, '');
  const outName = `${baseName}_review_file.html`;

  try {
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);
    const annotateScript = loadAnnotateScript();

    let outputHtml: string;

    if (ext === '.zip') {
      outputHtml = await bundleScormZip(fileBuffer, annotateScript);
    } else {
      outputHtml = bundlePlainHtml(fileBuffer, annotateScript);
    }

    // Clean up temp file
    fs.unlinkSync(uploadedFile.filepath);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(outputHtml);
  } catch (err: unknown) {
    // Clean up on error
    try { fs.unlinkSync(uploadedFile.filepath); } catch {}
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[convert] error:', err);
    return res.status(500).json({ error: msg });
  }
}
