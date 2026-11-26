// PoshanSetu desktop shell (Electron). Serves the app over a privileged app:// scheme so
// ES modules, fetch and WebCrypto behave exactly as on the web build.
const { app, BrowserWindow, protocol, net, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'app');
const MODULES = path.join(ROOT, 'node_modules');

// Chromium refuses to run as root without this (common in containers / CI).
if (process.platform === 'linux' && process.getuid?.() === 0) app.commandLine.appendSwitch('no-sandbox');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ogg': 'audio/ogg', '.csv': 'text/csv; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

function resolveAppPath(urlPath) {
  // /vendor/fontsource/... maps into node_modules/@fontsource for fonts.
  const clean = decodeURIComponent(urlPath).replace(/^\/+/, '');
  if (clean.startsWith('fontsource/')) return path.join(MODULES, '@fontsource', clean.slice('fontsource/'.length));
  const p = path.normalize(path.join(APP_DIR, clean || 'index.html'));
  if (!p.startsWith(APP_DIR)) return null;
  return p;
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1480, height: 920, minWidth: 1024, minHeight: 680,
    title: 'PoshanSetu', backgroundColor: '#f3879f',
    frame: false, titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    show: false,
    icon: path.join(APP_DIR, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL('app://poshansetu/index.html' + (process.env.PS_HASH ? '#' + process.env.PS_HASH : ''));
  win.on('maximize', () => win.webContents.send('win:state', { maximized: true }));
  win.on('unmaximize', () => win.webContents.send('win:state', { maximized: false }));
  win.webContents.setWindowOpenHandler(({ url }) => {
    // The AWW phone app (PWA) opens in its own phone-sized window; web links go to the browser.
    if (url.startsWith('app://poshansetu/pwa/')) return { action: 'allow', overrideBrowserWindowOptions: { width: 412, height: 860, autoHideMenuBar: true, title: 'PoshanSetu AWW', backgroundColor: '#f4d9e3' } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    const p = resolveAppPath(u.pathname);
    if (!p || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return new Response('not found', { status: 404 });
    // Always send an explicit type: on Windows, file:// types come from the registry, and some PCs map
    // .js to text/plain, which makes Chromium refuse ES modules (the app then shows only its pink desktop).
    const type = MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';
    return new Response(fs.readFileSync(p), { status: 200, headers: { 'content-type': type, 'cache-control': 'no-store' } });
  });
  ipcMain.on('win:minimize', () => win?.minimize());
  ipcMain.on('win:maximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
  ipcMain.on('win:close', () => win?.close());
  ipcMain.handle('file:save', async (_e, { name, data }) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: name });
    if (r.canceled || !r.filePath) return { ok: false };
    fs.writeFileSync(r.filePath, data);
    return { ok: true, path: r.filePath };
  });
  ipcMain.handle('print:pdf', async (_e, { name }) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: name, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (r.canceled || !r.filePath) return { ok: false };
    const data = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', landscape: true });
    fs.writeFileSync(r.filePath, data);
    return { ok: true, path: r.filePath };
  });
  const statePath = () => path.join(app.getPath('userData'), 'poshansetu-session.json');
  ipcMain.handle('state:load', () => { try { return JSON.parse(fs.readFileSync(statePath(), 'utf8')); } catch { return []; } });
  ipcMain.handle('state:save', (_e, ops) => { try { fs.mkdirSync(path.dirname(statePath()), { recursive: true }); fs.writeFileSync(statePath(), JSON.stringify(ops)); return true; } catch { return false; } });
  ipcMain.handle('app:info', () => ({ electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, platform: process.platform }));
  // Groq assistant (quick entry). The key lives only on this computer (GROQ_API_KEY or userData/groq.json)
  // and only this main process sends it; the page never sees it.
  const groqPath = () => path.join(app.getPath('userData'), 'groq.json');
  const groqConf = () => { try { return JSON.parse(fs.readFileSync(groqPath(), 'utf8')); } catch { return {}; } };
  const groqKey = () => process.env.GROQ_API_KEY || groqConf().key || '';
  ipcMain.handle('groq:status', () => ({ configured: !!groqKey(), fromEnv: !!process.env.GROQ_API_KEY, model: groqConf().model || 'openai/gpt-oss-120b' }));
  ipcMain.handle('groq:setKey', (_e, { key }) => { try { const c = groqConf(); if (key) c.key = String(key).trim(); else delete c.key; fs.mkdirSync(path.dirname(groqPath()), { recursive: true }); fs.writeFileSync(groqPath(), JSON.stringify(c)); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('groq:chat', async (_e, body) => {
    const key = groqKey();
    if (!key) return { ok: false, error: 'No Groq key set' };
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const call = (b) => fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify(b) });
      let r = await call(body), j = await r.json().catch(() => ({}));
      // If Groq rejects JSON mode or reasoning_effort for a model, retry once without them.
      if (!r.ok && r.status === 400 && /response_format|json|reasoning/i.test(j?.error?.message || '')) { const { response_format, reasoning_effort, ...plain } = body; r = await call(plain); j = await r.json().catch(() => ({})); }
      if (!r.ok) return { ok: false, error: j?.error?.message || `Groq HTTP ${r.status}` };
      return { ok: true, content: j?.choices?.[0]?.message?.content || '' };
    } catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'Groq did not answer in 20 s' : e.message }; } finally { clearTimeout(timer); }
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
