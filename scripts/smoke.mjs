// End-to-end smoke test of the web build: every app × every role, plus key interactions.
// Usage: npm run serve (in another shell) && node scripts/smoke.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
// Local install (CI) first, then the global one (dev containers with a pre-installed browser).
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { ({ chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright')); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERROR ' + (e.stack || e.message).split('\n').slice(0, 4).join(' | ')));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://localhost:${process.env.PORT || 5173}/#worklist`);
await p.waitForSelector('.menubar', { timeout: 90000 }).catch((e) => { console.error(errs.join('\n') || 'no page errors before timeout'); throw e; });
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
  // click every tab / segmented button in every window, for a frontline and a supervisory role
  for (const role of ['AWW', 'CDPO', 'DPO']) {
    store.setRole(role, store.defaultScope(role));
    for (const id of apps.filter((x) => x !== 'landing')) {
      wm.open(id); await sleep(30);
      const n = document.querySelectorAll(`[data-app="${id}"] .seg button`).length;
      for (let i = 0; i < n; i++) { const b = document.querySelectorAll(`[data-app="${id}"] .seg button`)[i]; if (b && !b.disabled) { b.click(); await sleep(15); } }
      wm.close(id);
    }
  }
  // interactions
  store.setRole('CDPO', store.defaultScope('CDPO'));
  wm.open('bridge'); await sleep(50); document.querySelector('[data-app="bridge"] .btn.hot').click(); await sleep(50);
  store.advance(3600000); store.advance(86400000); store.advance(7 * 86400000);
  wm.open('migration'); await sleep(800);
  const v = [...document.querySelectorAll('[data-app="migration"] button')].find((x) => /Verify offline/.test(x.textContent)); v?.click(); await sleep(200);
  wm.open('terminal'); await sleep(50);
  wm.open('rulepack'); await sleep(50);
  wm.open('audit'); await sleep(50);
  const ver = store.audit.verify(); if (!ver.ok) log.push('audit chain broken');
  store.regenerate(4242); await sleep(50); for (const id of ['trial', 'worklist', 'migration', 'district']) { wm.open(id); await sleep(80); } wm.closeAll(); store.regenerate(71100); await sleep(50);
  wm.open('tour'); await sleep(100);
  for (let i = 0; i < 12; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); await sleep(120); }
  // Riya's story: every step runs, with Riya, Kamla and Phulmani on screen
  window.psLayout.storyLayout(); await sleep(200);
  for (let i = 0; i < 12; i++) { const cap = document.querySelector('.tourbar')?.textContent || ''; if (!cap) log.push(`story step ${i + 1}: no caption`); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); await sleep(250); }
  if (!store.story || store.childById[store.story.childId].name !== 'Riya Hembrom') log.push('story child missing');
  // Guided demo: every one of its steps runs without an error
  window.psLayout.demoLayout(); await sleep(300);
  const demoN = Number((document.querySelector('.tourbar')?.textContent.match(/of (\d+)/) || [])[1] || 0);
  if (demoN < 50) log.push(`guided demo has ${demoN} steps`);
  for (let i = 0; i < demoN; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); await sleep(350); }
  wm.closeAll();
  wm.closeAll();
  return { log, tasks: store.tasks.length, audit: store.audit.entries.length };
});
// persistence: the journal survives a reload and replays to the same audit-chain head
const head1 = await p.evaluate(async () => { const { store } = await import('/ui/store.js'); await new Promise((r) => setTimeout(r, 400)); return { head: store.audit.head, n: store.journal.length }; });
await p.reload(); await p.waitForSelector('.menubar', { timeout: 60000 }); await p.waitForTimeout(800);
const head2 = await p.evaluate(async () => { const { store } = await import('/ui/store.js'); const h = store.audit.head; store.clearSaved(); return { head: h }; });
if (head1.head !== head2.head) res.log.push(`persistence mismatch after ${head1.n} actions`);
res.persisted = head1.n;
console.log(JSON.stringify(res));
console.log(errs.length ? errs.join('\n') : 'no page errors');
await b.close();
process.exit(errs.length || res.log.length ? 1 : 0);
