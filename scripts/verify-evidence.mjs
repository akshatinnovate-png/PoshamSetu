// Independently verify an evidence pack exported from PS.OS1 (Help → Export evidence pack).
// Usage: node scripts/verify-evidence.mjs poshansetu-evidence-YYYY-MM-DD.json
import fs from 'node:fs';
import { verifyPack } from '../app/engine/rulepack.js';
import { AuditLog } from '../app/engine/audit.js';

const file = process.argv[2];
if (!file) { console.error('usage: verify-evidence.mjs <file.json>'); process.exit(2); }
const ev = JSON.parse(fs.readFileSync(file, 'utf8'));
const pack = await verifyPack(ev.rulePack);
const log = new AuditLog(); log.entries = ev.audit.entries;
const chain = log.verify();
console.log(`rule pack ${ev.rulePack.pack.id}@${ev.rulePack.pack.version}: ${pack.ok ? 'both signatures VALID' : 'INVALID'} (${pack.results.map((r) => `${r.signer}:${r.ok ? 'ok' : 'bad'}`).join(', ')})`);
console.log(`audit chain: ${chain.ok ? `INTACT (${chain.length} entries, head ${chain.head.slice(0, 16)})` : `BROKEN at #${chain.brokenAt}`}`);
console.log(`backtest: ${Math.round(ev.backtest.shareEarlier * 100)}% flagged earlier, median lead ${Math.round(ev.backtest.leadMedianDays)} d, precision ${Math.round(ev.backtest.precision * 100)}% (synthetic, seed ${ev.backtest.seed})`);
process.exit(pack.ok && chain.ok ? 0 : 1);
