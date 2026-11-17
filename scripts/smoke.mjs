// End-to-end smoke test of the web build: every app × every role, plus key interactions.
// Usage: npm run serve (in another shell) && node scripts/smoke.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERROR ' + (e.stack || e.message).split('\n').slice(0, 4).join(' | ')));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://localhost:${process.env.PORT || 5173}/#worklist`);
await p.waitForSelector('.menubar', { timeout: 30000 });
const res = await p.evaluate(async () => {
  const wm = await import('/ui/wm.js'); const { store } = await import('/ui/store.js');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  const apps = wm.getApps().map((a) => a.id).filter((id) => id !== 'tour');
  for (const role of ['AWW', 'ASHA', 'MS', 'CDPO', 'DPO']) {
    store.setRole(role, store.defaultScope(role));
    for (const id of apps) { wm.open(id); await sleep(30); const w = document.querySelector(`[data-app="${id}"] .body`); if (!w || /Error:/.test(w.textContent.slice(0, 200))) log.push(`${role}/${id} error`); }
    wm.closeAll(); await sleep(10);
  }
  // interactions
  store.setRole('CDPO', 'KHU');
  wm.open('bridge'); await sleep(50); document.querySelector('[data-app="bridge"] .btn.hot').click(); await sleep(50);
  store.advance(3600000); store.advance(86400000); store.advance(7 * 86400000);
  wm.open('migration'); await sleep(800);
  const v = [...document.querySelectorAll('[data-app="migration"] button')].find((x) => /Verify offline/.test(x.textContent)); v?.click(); await sleep(200);
  wm.open('terminal'); await sleep(50);
  wm.open('rulepack'); await sleep(50);
  wm.open('audit'); await sleep(50);
  const ver = store.audit.verify(); if (!ver.ok) log.push('audit chain broken');
  wm.open('tour'); await sleep(100);
  for (let i = 0; i < 12; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); await sleep(120); }
  return { log, tasks: store.tasks.length, audit: store.audit.entries.length };
});
console.log(JSON.stringify(res));
console.log(errs.length ? errs.join('\n') : 'no page errors');
await b.close();
process.exit(errs.length || res.log.length ? 1 : 0);
