// Presenter mode for the 10-minute Round 2 slot: each step opens the right window,
// sets role/time, and shows the talking points on a caption bar.
import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open, closeAll, place, isOpen } from '../wm.js';
import { DAY, HOUR, showcaseChild } from '../common.js';

const desk = () => document.querySelector('.desktop');
const full = (id, opts) => { open(id, opts); const d = desk(); const top = (document.querySelector('.tourbar')?.offsetHeight || 60) + 22; place(id, 24, top, d.clientWidth - 48, d.clientHeight - top - 14); };

function steps() {
  const m = store.sim.metrics;
  return [
    { t: 'The gap', min: '0:00', say: `The Tracker holds growth data for 7+ crore children but lists a child from one reading. Paschimi Singhbhum: 60.6% stunting, 30.5% wasting, two-thirds ST. Action starts after the line is crossed.`, go: () => { if (!isOpen('landing')) { closeAll(); open('landing'); } } },
    { t: 'Who it is for', min: '0:40', say: 'ST children 0–59 months in Paschimi Singhbhum and the people who act for them: the AWW with 40 children and an offline app, the Sahiya with a feature phone, the Mukhya Sevika, the CDPO, and the mother who leaves for a kiln in December. Every design choice maps to one of their constraints.', go: () => { closeAll(); full('brief'); setTimeout(() => document.querySelectorAll('[data-app="brief"] .seg button')[2]?.click(), 30); } },
    { t: 'Architecture', min: '1:00', say: 'Four layers, left to right: capture dated events → analyse with WHO z-scores and explainable rules → act through tasks for AWW and ASHA → govern with a deadline clock, escalation and an audit chain. Three cross-cutting services: ABDM consent, migration, signed rule packs.', go: () => { closeAll(); full('arch'); } },
    { t: 'A child, explained', min: '2:00', say: 'Every alert shows its reason and the rule-pack version. Growth is read as a direction: here the WHZ trajectory falls toward MAM before any single reading crosses −3.', go: () => { closeAll(); const sc = showcaseChild(); store.setRole('AWW', sc ? sc.c.awcId : store.sim.district.awcs[0].id); const c = sc?.c || store.children()[0]; full('child', { childId: c.id }); } },
    { t: 'Same child, two systems', min: '2:40', say: 'The same readings, month by month. On the left, what the Tracker does today: nothing until a single reading crosses a line, then a list with no owner or deadline. On the right, PoshanSetu sees two monthly falls in a row and puts a task with a 7-day clock in front of the AWW and the Sahiya — months before SAM.', go: async () => { closeAll(); open('landing'); await new Promise((r) => setTimeout(r, 60)); const el = [...document.querySelectorAll('[data-app="landing"] div')].find((d) => d.textContent.startsWith('Same child.')); const bd = document.querySelector('[data-app="landing"] .body'); if (el && bd) bd.scrollTop = el.getBoundingClientRect().top - bd.getBoundingClientRect().top + bd.scrollTop - 130; const rb = [...document.querySelectorAll('[data-app="landing"] button')].find((b) => /Replay/.test(b.textContent)); setTimeout(() => rb?.click(), 300); } },
    { t: 'Silent trial result', min: '3:00', say: `Backtest on ${m.children} synthetic children: ${Math.round(m.shareEarlier * 100)}% of children who reached the Tracker SAM list were flagged AMBER first, a median ${Math.round(m.leadMedian)} days earlier; precision ${Math.round(m.precision * 100)}%. Stricter: ${Math.round(m.strict.share * 100)}% were flagged before the Tracker listed them at all — that is the trend rules; for the rest, the gain is a confirmed task with a deadline instead of a list. Phase 1 repeats this on anonymised Tracker data.`, go: () => { closeAll(); full('trial'); } },
    { t: 'Fix 01 — Real-time bridge', min: '4:00', say: 'The jury asked: how can a 24-hour clock run on weekly exports? It can\'t. Events now come through the Tracker Open API via API Setu, plus an SMS flash path for RED signs. The clock starts at measurement time; a late event escalates on arrival and is booked to the pipeline.', go: () => { closeAll(); store.setRole('CDPO', 'KHU'); full('bridge'); } },
    { t: 'Fix 01 — live', min: '4:40', say: 'Watch: a RED-A oedema reading is captured… it crosses the SMS path in minutes, the task appears with its 24-hour deadline counted from the measurement.', go: async () => { const b = document.querySelector('[data-app="bridge"] .btn.hot'); b?.click(); await new Promise((r) => setTimeout(r, 400)); store.advance(HOUR); } },
    { t: 'Fix 01 — offline is normal', min: '5:00', say: 'In a forest village the AWW has no signal. Switch the phone to Offline, record an oedema case, advance six hours, go Online. The event syncs late, but its 24-hour clock started when the child was weighed — and if a deadline already passed, the task escalates on arrival and is booked to the pipeline, not to her.', go: () => { closeAll(); const d = desk(); open('awwphone'); place('awwphone', d.clientWidth / 2 - 220, (document.querySelector('.tourbar')?.offsetHeight || 60) + 22, 440, d.clientHeight - (document.querySelector('.tourbar')?.offsetHeight || 60) - 36); } },
    { t: 'Fix 02 — Async joint visit', min: '5:40', say: 'AWW and ASHA report to different ministries. They no longer need the same door at the same hour: either order within 7 days. The task closes only when the AWW app flag and the ASHA keypress 1 are both in. Half-closed tasks show exactly who is missing.', go: () => { closeAll(); const pending = (x) => x.required.includes('ASHA') && !x.closures.some((c) => c.by === 'ASHA') && store.esc(x).open && x.ingestedAt <= store.now; let t = store.scopedTasks().find(pending); if (!t) { t = store.tasks.find(pending); if (t) store.setRole('CDPO', store.awcById[t.awcId].blockId); } full('joint', t ? { taskId: t.id } : undefined); } },
    { t: 'Fix 03 — Kiln-proof migration', min: '6:30', say: 'Paper lost, phone dead, no signal. The token is Ed25519-signed and verifies offline. If the card is gone: IVR short code from any phone, or the mother\'s Aadhaar eKYC on the destination AWC tablet — face auth when brick-moulding has worn the fingerprints.', go: () => { closeAll(); full('migration'); } },
    { t: 'Fix 04 — Weighted R-score', min: '7:20', say: 'A broken scale is not a rounding habit. B (implausible values) now weighs 4, flat runs 1, digit preference 0.3 — and D only counts after three months running. Look at the red squares: sloppy AWCs that the old formula scored as reliable.', go: () => { closeAll(); store.setRole('DPO', 'DISTRICT'); full('reliability'); } },
    { t: 'Fix 05 — Honest cost', min: '8:10', say: 'Rs 12 lakh is the pilot MVP, not national DPI: two engineers for six months on reused building blocks — Sunbird RC, ABDM, Bhashini, API Setu. National rollout is its own MeitY/NIC capital line.', go: () => { closeAll(); full('budget'); } },
    { t: 'Governance', min: '8:50', say: 'Decision rights from Table 3 in code: names never leave the sector without logged break-glass; above block, small cells are suppressed; every access is hash-chained. Rule changes need both ministries\' signatures.', go: () => { closeAll(); store.setRole('CDPO', 'KHU'); full('escalation'); } },
    { t: 'Close', min: '9:30', say: 'PoshanSetu does not replace the Tracker — it makes the data it already holds act in time. Watch which way the child is heading, and act while recovery is still simple.', go: () => { closeAll(); open('landing'); } },
  ];
}

export default {
  id: 'tour', persistent: true, title: 'Jury tour — presenter', icon: ICONS.tour, dock: 'Jury tour', desk: 'Jury tour', size: [560, 200], key: 'j',
  mount(ctx) {
    let i = 0, auto = null;
    const secs = (m) => { const [a, b] = m.split(':').map(Number); return a * 60 + b; };
    const S = steps();
    const bar = h('div.tourbar', { style: { position: 'absolute', left: '24px', right: '24px', top: '10px', zIndex: 8800, background: 'var(--ink)', color: 'var(--white)', border: '2px solid var(--ink)', boxShadow: '4px 4px 0 var(--hot)', display: 'flex', alignItems: 'stretch' } });
    desk().appendChild(bar);
    ctx.onCleanup(() => bar.remove());
    ctx.win.el.classList.add('min');
    async function go(n) {
      i = Math.max(0, Math.min(S.length - 1, n));
      await S[i].go();
      render();
    }
    function render() {
      const st = S[i];
      mount(bar,
        h('div', { style: { background: 'var(--hot)', color: 'var(--ink)', padding: '6px 12px', fontFamily: 'var(--font-pixel)', fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' } }, `${i + 1}/${S.length}`, h('span', { style: { fontSize: '16px' } }, st.min)),
        h('div', { style: { padding: '6px 12px', flex: 1 } }, h('div', { style: { fontWeight: 800, fontSize: '15px', letterSpacing: '-0.01em' } }, st.t), h('div', { style: { fontSize: '12.5px', lineHeight: 1.4, color: '#f2dce4' } }, st.say)),
        h('div.row', { style: { padding: '6px', gap: '6px' } },
          h('button.btn.ghost.sm', { onclick: toggleAuto, title: 'Rehearsal: advance on the slot timings' }, auto ? '❚❚ auto' : '▶ auto'),
          h('button.btn.ghost.sm', { onclick: () => go(i - 1) }, '◂ prev'),
          h('button.btn.hot.sm', { onclick: () => go(i + 1) }, 'next ▸'),
          h('button.btn.sm', { onclick: () => ctx.win.el.querySelector('.tb button:last-child').click() }, '× end')));
    }
    function toggleAuto() {
      if (auto) { clearTimeout(auto); auto = null; render(); return; }
      const tickNext = () => { if (i >= S.length - 1) { auto = null; render(); return; } const dur = Math.max(10, secs(S[i + 1].min) - secs(S[i].min)) * 1000; auto = setTimeout(async () => { await go(i + 1); tickNext(); }, dur); render(); };
      tickNext();
    }
    ctx.onCleanup(() => clearTimeout(auto));
    const key = (e) => { if (e.target?.matches?.('input,textarea,select')) return; if (e.key === 'ArrowRight' || e.key === 'PageDown') go(i + 1); if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(i - 1); };
    addEventListener('keydown', key);
    ctx.onCleanup(() => removeEventListener('keydown', key));
    go(0);
  },
};
