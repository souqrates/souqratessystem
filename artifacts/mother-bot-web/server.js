const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 17321);
const PUBLIC = path.join(__dirname, 'dist/public');

// The Replit reverse proxy routes /mother-bot-web/* → this server WITHOUT rewriting paths.
// Strip the prefix so /mother-bot-web/assets/foo.js → dist/public/assets/foo.js.
// Falls back to no-strip if SERVE_BASE is explicitly set to empty string.
const SERVE_BASE = (process.env.SERVE_BASE !== undefined
  ? process.env.SERVE_BASE
  : '/mother-bot-web'
).replace(/\/$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// Security headers applied to every response.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function serveIndex(res) {
  fs.readFile(path.join(PUBLIC, 'index.html'), (err, data) => {
    if (err) { res.writeHead(404, SECURITY_HEADERS); res.end('Not found'); return; }
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      // no-store: never cache HTML — always fetch fresh copy from server.
      // Prevents stale shell from loading after a deploy.
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

http.createServer((req, res) => {
  let url = (req.url || '/').split('?')[0];

  // Strip the proxy prefix (e.g. /mother-bot-web) from the URL.
  // Replit path-based routing sends the full path to the service.
  if (SERVE_BASE && url.startsWith(SERVE_BASE + '/')) {
    url = url.slice(SERVE_BASE.length);
  } else if (SERVE_BASE && url === SERVE_BASE) {
    url = '/';
  }

  if (url === '/' || url === '') { serveIndex(res); return; }

  // Serve bots hub page at /bots
  if (url === '/bots' || url === '/bots/') {
    fs.readFile(path.join(PUBLIC, 'bots.html'), (err, data) => {
      if (err) { res.writeHead(404, SECURITY_HEADERS); res.end('Not found'); return; }
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    });
    return;
  }

  const filePath = path.join(PUBLIC, url);

  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403, SECURITY_HEADERS); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { serveIndex(res); return; }
    const ext = path.extname(filePath).toLowerCase();
    const ct = MIME[ext] || 'application/octet-stream';
    // Vite hashes all files under /assets/ — safe to cache forever.
    // Everything else (favicon, manifest, robots.txt, etc.) uses no-store.
    const isHashedAsset = url.startsWith('/assets/');
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': ct,
      'Cache-Control': isHashedAsset
        ? 'public, max-age=31536000, immutable'
        : 'no-store',
    });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`mother-bot-web serving on port ${PORT} — stripping base "${SERVE_BASE}"`);
});
