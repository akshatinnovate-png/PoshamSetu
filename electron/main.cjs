// PoshanSetu desktop shell (Electron). Serves the app over a privileged app:// scheme so
// ES modules, fetch and WebCrypto behave exactly as on the web build.
const { app, BrowserWindow, protocol, net, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'app');
const MODULES = path.join(ROOT, 'node_modules');

// Chromium refuses to run as root without this (common in containers / CI).
if (process.platform === 'linux' && process.getuid?.() === 0) app.commandLine.appendSwitch('no-sandbox');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

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
    if (!p || !fs.existsSync(p)) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(p).toString());
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
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
