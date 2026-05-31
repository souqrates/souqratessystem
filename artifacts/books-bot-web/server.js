import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 23758);
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/$/, '');
const PUBLIC = path.join(__dirname, 'dist/public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

function serveIndex(res) {
  fs.readFile(path.join(PUBLIC, 'index.html'), (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  let url = (req.url ?? '/').split('?')[0];
  if (BASE && url.startsWith(BASE)) url = url.slice(BASE.length) || '/';
  if (!url.startsWith('/')) url = '/' + url;
  if (url === '/' || url === '') { serveIndex(res); return; }

  const filePath = path.join(PUBLIC, url);
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { serveIndex(res); return; }
    const ext = path.extname(filePath).toLowerCase();
    const ct = MIME[ext] ?? 'application/octet-stream';
    const isAsset = url.startsWith('/assets/');
    res.writeHead(200, {
      'Content-Type': ct,
      'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`books-bot-web serving ${BASE || '/'} on port ${PORT}`);
});
