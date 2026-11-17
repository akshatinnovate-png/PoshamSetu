import { h } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open, getApps } from '../wm.js';
import { fmtDateTime, fmtDuration, HOUR, DAY } from '../common.js';
import { verifyPack, TIER_LABEL } from '../../engine/rulepack.js';
import { ROLES } from '../../engine/access.js';
import { wellnessBundle } from '../../engine/fhir.js';

const HELP = `commands:
  help                     this list
  whoami                   current role and scope
  role <AWW|ASHA|MS|CDPO|DPO> [scope]
  stats                    silent-trial metrics
  triage <childId|PT…>     explain a child's tier
  tasks [open|late]        tasks in scope
  advance <n>h|d           move the sim clock
  verify pack|audit        check signatures / hash chain
  fhir <childId>           print the FHIR bundle summary
  open <app>               open a window (${'apps'})
  clear`;

export default {
  id: 'terminal', title: 'ps-shell', icon: ICONS.terminal, dock: 'Shell', size: [720, 440], key: '`',
  mount(ctx) {
    const out = h('div', { style: { whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.5 } });
    const input = h('input', { style: { flex: 1, background: 'transparent', border: 0, outline: 'none', color: '#f6c2d1', fontFamily: 'var(--font-mono)', fontSize: '12px' }, spellcheck: false });
    const hist = []; let hi = 0;
    ctx.body.style.background = 'var(--ink)';
    ctx.body.style.color = '#f2eef0';
    ctx.body.append(h('div', { style: { padding: '10px 12px' } }, out, h('div.row', { style: { gap: '6px' } }, h('span', { style: { color: 'var(--hot)', fontFamily: 'var(--font-mono)', fontSize: '12px' } }, 'ps$'), input)));
    const print = (t, color) => { out.append(h('div', { style: color ? { color } : null }, t)); ctx.body.scrollTop = ctx.body.scrollHeight; };
    print('PS.OS1 shell · type "help"', '#9fe0b8');
    ctx.body.addEventListener('click', () => input.focus());
    setTimeout(() => input.focus(), 50);
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); input.value = hist[hi] || ''; return; }
      if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; return; }
      if (e.key !== 'Enter') return;
      const line = input.value.trim(); input.value = '';
      if (!line) return;
      hist.push(line); hi = hist.length;
      print('ps$ ' + line, '#e94fbf');
      try { await run(line); } catch (err) { print('error: ' + err.message, '#ff8b8b'); }
    });
    const findChild = (q) => store.childById[q] || store.sim.district.children.find((c) => c.pseudoId === q || c.pseudoId.endsWith(q.replace(/\D/g, '')));
    async function run(line) {
      const [cmd, ...a] = line.split(/\s+/);
      switch (cmd) {
        case 'help': print(HELP); break;
        case 'clear': out.textContent = ''; break;
        case 'whoami': print(`${store.actorName()} · ${ROLES[store.role].label} · ${store.scopeLabel()} · clock ${fmtDateTime(store.now)}`); break;
        case 'role': {
          const r = (a[0] || '').toUpperCase();
          if (!ROLES[r]) throw new Error('unknown role');
          store.setRole(r, a[1] || store.defaultScope(r)); print(`now ${ROLES[r].label} · ${store.scopeLabel()}`); break;
        }
        case 'stats': { const m = store.sim.metrics; print(`children ${m.children} · SAM cases ${m.samKids} · flagged earlier ${Math.round(m.shareEarlier * 100)}% · median lead ${Math.round(m.leadMedian)} d · precision ${Math.round(m.precision * 100)}%`); break; }
        case 'triage': {
          const c = findChild(a[0] || '');
          if (!c) throw new Error('child not found');
          if (!store.inScope(c)) throw new Error('outside your scope (Table 3)');
          store.selectChild(c.id, 'VIEW_SHELL');
          const r = c.current;
          print(`${c.pseudoId} → ${TIER_LABEL[r.tier]} (${r.kind}) · pack v${r.packVersion}`);
          for (const x of r.reasons) print(`  [${x.tier}] ${x.text}  — ${x.rule}`);
          break;
        }
        case 'tasks': {
          let ts = store.scopedTasks().map((t) => ({ t, e: store.esc(t) }));
          if (a[0] === 'open') ts = ts.filter((x) => x.e.open);
          if (a[0] === 'late') ts = ts.filter((x) => x.e.open && x.e.breached);
          ts.slice(0, 30).forEach(({ t, e }) => print(`${t.id.padEnd(16)} ${TIER_LABEL[t.tier].padEnd(8)} L${e.level} ${e.state.padEnd(8)} due ${fmtDuration(t.dueAt - store.now)}`));
          print(`${ts.length} task(s)`);
          break;
        }
        case 'advance': {
          const m = /^(\d+)([hd])$/.exec(a[0] || '');
          if (!m) throw new Error('usage: advance 6h | advance 2d');
          store.advance(+m[1] * (m[2] === 'h' ? HOUR : DAY)); print(`clock → ${fmtDateTime(store.now)}`); break;
        }
        case 'verify': {
          if (a[0] === 'pack') { const v = await verifyPack(store.signed); print(v.ok ? '✓ MoWCD + MoHFW signatures valid' : '✗ invalid', v.ok ? '#9fe0b8' : '#ff8b8b'); }
          else { const v = store.audit.verify(); print(v.ok ? `✓ audit chain intact (${v.length})` : `✗ broken at #${v.brokenAt}`, v.ok ? '#9fe0b8' : '#ff8b8b'); }
          break;
        }
        case 'fhir': {
          const c = findChild(a[0] || '');
          if (!c) throw new Error('child not found');
          const b = wellnessBundle(c, c.eval.visits, c.current, c.consent);
          print(b.entry.map((e) => `${e.resource.resourceType}/${e.resource.id}`).join('  '));
          break;
        }
        case 'open': { const id = a[0]; if (!getApps().some((x) => x.id === id)) throw new Error('apps: ' + getApps().map((x) => x.id).join(', ')); open(id); break; }
        default: throw new Error(`unknown command "${cmd}" — try help`);
      }
    }
  },
};
