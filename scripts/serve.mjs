// Static server for the web build (same layout as the Electron app:// scheme).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app');
const MODS = path.join(ROOT, 'node_modules', '@fontsource');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' };
const port = Number(process.env.PORT || 5173);

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
  const file = rel.startsWith('fontsource/') ? path.join(MODS, rel.slice(11)) : path.join(APP, rel);
  if (!file.startsWith(APP) && !file.startsWith(MODS)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log(`PoshanSetu web build on http://localhost:${port}`));
