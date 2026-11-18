// Launches the real Electron app under xvfb and saves a screenshot: node scripts/electron-shot.cjs out.png [hash]
const { execSync } = require('node:child_process');
const req = require('node:module').createRequire(execSync('npm root -g').toString().trim() + '/');
const { _electron: electron } = req('playwright');
(async () => {
  const out = process.argv[2] || 'electron.png';
  const app = await electron.launch({ executablePath: require('electron'), args: ['.', '--no-sandbox'], cwd: require('node:path').join(__dirname, '..'), env: { ...process.env, PS_HASH: process.argv[3] || '' } });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push(e.message));
  win.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await win.waitForSelector('.menubar', { timeout: 30000 });
  await win.waitForTimeout(1500);
  await win.screenshot({ path: out });
  console.log('title:', await win.title(), errs.length ? '\nERR ' + errs.join('\n') : '\nno errors');
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
