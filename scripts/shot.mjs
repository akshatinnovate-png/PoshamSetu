// Screenshot helper: node scripts/shot.mjs <hash> <out.png> [w] [h] [js-to-run]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const [hash = '', out = 'shot.png', w = '1480', hgt = '920', js = ''] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +hgt }, deviceScaleFactor: 1 });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await p.goto(`http://localhost:${process.env.PORT || 5173}/#${hash}`);
await p.waitForSelector('.menubar', { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(1200);
if (js) { await p.evaluate(js); await p.waitForTimeout(800); }
await p.screenshot({ path: out });
console.log(errs.length ? errs.join('\n') : 'no errors');
await b.close();
