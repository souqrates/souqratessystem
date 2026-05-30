const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 17321);
const BASE = (process.env.BASE_PATH || '/mother-bot-web/').replace(/\/$/, '');
const PUBLIC = path.join(__dirname, 'dist/public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function serveIndex(res) {
  fs.readFile(path.join(PUBLIC, 'index.html'), (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  let url = (req.url || '/').split('?')[0];

  if (url === BASE || url === BASE + '/') {
    serveIndex(res); return;
  }
  if (url.startsWith(BASE + '/')) {
    url = url.slice(BASE.length);
  }

  const filePath = path.join(PUBLIC, url);

  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { serveIndex(res); return; }
    const ext = path.extname(filePath).toLowerCase();
    const ct = MIME[ext] || 'application/octet-stream';
    const isAsset = url.startsWith('/assets/');
    res.writeHead(200, {
      'Content-Type': ct,
      'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`mother-bot-web listening on port ${PORT} (base: ${BASE})`);
});
