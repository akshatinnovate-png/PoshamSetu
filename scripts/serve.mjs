// Static server for the web build (same layout as the Electron app:// scheme).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app');
const MODS = path.join(ROOT, 'node_modules', '@fontsource');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.ogg': 'audio/ogg', '.webmanifest': 'application/manifest+json' };
const port = Number(process.env.PORT || 5173);

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  // Groq proxy for the quick-entry assistant in the web build. Key from GROQ_API_KEY only; never sent to the page.
  if (u.pathname === '/api/groq/status') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ configured: !!process.env.GROQ_API_KEY, fromEnv: true, model: 'openai/gpt-oss-120b' })); }
  if (u.pathname === '/api/groq/chat' && req.method === 'POST') {
    let body = ''; req.on('data', (d) => { body += d; if (body.length > 64000) req.destroy(); });
    req.on('end', async () => {
      const send = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (!process.env.GROQ_API_KEY) return send({ ok: false, error: 'No Groq key set (start with GROQ_API_KEY=...)' });
      try {
        const call = (b) => fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(20000), headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: b });
        let r = await call(body), j = await r.json().catch(() => ({}));
        // If Groq rejects JSON mode or reasoning_effort for a model, retry once without them.
        if (!r.ok && r.status === 400 && /response_format|json|reasoning/i.test(j?.error?.message || '')) { const { response_format, reasoning_effort, ...plain } = JSON.parse(body); r = await call(JSON.stringify(plain)); j = await r.json().catch(() => ({})); }
        send(r.ok ? { ok: true, content: j?.choices?.[0]?.message?.content || '' } : { ok: false, error: j?.error?.message || `Groq HTTP ${r.status}` });
      } catch (e) { send({ ok: false, error: e.message }); }
    });
    return;
  }
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
  const file = rel.startsWith('fontsource/') ? path.join(MODS, rel.slice(11)) : path.join(APP, rel);
  if (!file.startsWith(APP) && !file.startsWith(MODS)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log(`PoshanSetu web build on http://localhost:${port}`));
