// Presenter mode for the 10-minute Round 2 slot: each step opens the right window,
// sets role/time, and shows the talking points on a caption bar.
import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open, closeAll, place, isOpen } from '../wm.js';
import { DAY, HOUR, showcaseChild, fmtDate } from '../common.js';
import { CAST_BY_KEY, portraitSvg } from '../../engine/story.js';
import { demoSteps } from '../demo.js';

// Helpers the guided demo uses to drive and point at the UI.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function findIn(spot) {
  if (!spot) return null;
  if (spot.sel) return document.querySelector(spot.sel);
  const root = spot.root ? document.querySelector(spot.root) : spot.app ? document.querySelector(`[data-app="${spot.app}"]`) : document.body;
  if (!root) return null;
  if (!spot.text) return root;
  let best = null, area = Infinity;
  for (const el of root.querySelectorAll('*')) {
    if (!(el.textContent || '').includes(spot.text)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (r.width * r.height < area) { best = el; area = r.width * r.height; }
  }
  for (let k = 0; best && k < (spot.up || 0); k++) best = best.parentElement || best;
  return best;
}
function clickIn(app, re) {
  const root = document.querySelector(`[data-app="${app}"]`);
  const b = root && [...root.querySelectorAll('button')].find((x) => re.test((x.textContent || '').trim()) && !x.disabled);
  b?.click();
  return !!b;
}
function scrollIn(app, text) { const el = findIn({ app, text }); el?.scrollIntoView({ block: 'center' }); }
const demoApi = { store, open, closeAll, full: (id, o) => full(id, o), place, desk: () => desk(), click: clickIn, scrollTo: scrollIn, sleep };

const desk = () => document.querySelector('.desktop');
const full = (id, opts) => { open(id, opts); const d = desk(); const top = (document.querySelector('.tourbar')?.offsetHeight || 60) + 22; place(id, 24, top, d.clientWidth - 48, d.clientHeight - top - 14); };

function steps() {
  const m = store.sim.metrics;
  return [
    { t: 'The gap', min: '0:00', say: `The Tracker holds growth data for 7+ crore children but lists a child from one reading. Paschimi Singhbhum: 60.6% stunting, 30.5% wasting, two-thirds ST. Action starts after the line is crossed.`, go: () => { if (!isOpen('landing')) { closeAll(); open('landing'); } } },
    { t: 'Who it is for', min: '0:40', say: 'ST children 0–59 months in Paschimi Singhbhum and the people who act for them: the AWW with 40 children and an offline app, the Sahiya with a feature phone, the Mukhya Sevika, the CDPO, and the mother who leaves for a kiln in December. Every design choice maps to one of their constraints.', go: () => { closeAll(); full('brief'); setTimeout(() => document.querySelectorAll('[data-app="brief"] .seg button')[2]?.click(), 30); } },
    { t: 'Architecture', min: '1:00', say: 'Four layers, left to right: capture dated events → analyse with WHO z-scores and explainable rules → act through tasks for AWW and ASHA → govern with a deadline clock, escalation and an audit chain. Three cross-cutting services: ABDM consent, migration, signed rule packs.', go: () => { closeAll(); full('arch'); } },
    { t: 'Riya, explained', min: '2:00', say: 'This is Riya, on Kamla Devi’s register. Every alert shows its reason and the rule-pack version. Growth is read as a direction: her WHZ falls toward MAM month after month, before any single reading crosses a line.', go: () => { closeAll(); const sc = showcaseChild(); store.setRole('AWW', sc ? sc.c.awcId : store.sim.district.awcs[0].id); const c = sc?.c || store.children()[0]; full('child', { childId: c.id }); } },
    { t: 'Riya: same child, two systems', min: '2:40', say: 'Riya’s readings, month by month. On the left, what the Tracker does today: nothing until a single reading crosses a line, then a list with no owner or deadline. On the right, PoshanSetu sees two monthly falls in a row and puts a task with a 7-day clock in front of the AWW and the Sahiya — months before SAM.', go: async () => { closeAll(); open('landing'); await new Promise((r) => setTimeout(r, 60)); const el = [...document.querySelectorAll('[data-app="landing"] div')].find((d) => d.textContent.startsWith('Riya.')); const bd = document.querySelector('[data-app="landing"] .body'); if (el && bd) bd.scrollTop = el.getBoundingClientRect().top - bd.getBoundingClientRect().top + bd.scrollTop - 130; const rb = [...document.querySelectorAll('[data-app="landing"] button')].find((b) => /Replay/.test(b.textContent)); setTimeout(() => rb?.click(), 300); } },
    { t: 'Silent trial result', min: '3:00', say: `Backtest on ${m.children} synthetic children: ${Math.round(m.shareEarlier * 100)}% of children who reached the Tracker SAM list were flagged AMBER first, a median ${Math.round(m.leadMedian)} days earlier; precision ${Math.round(m.precision * 100)}%. Stricter: ${Math.round(m.strict.share * 100)}% were flagged before the Tracker listed them at all — that is the trend rules; for the rest, the gain is a confirmed task with a deadline instead of a list. Phase 1 repeats this on anonymised Tracker data.`, go: () => { closeAll(); full('trial'); } },
    { t: 'A trade-off, not a magic number', min: '3:30', say: 'Every threshold was swept on three seeds. Each dot is a rule pack: earlier detection against precision and alerts per AWC. The shipped pack sits on the frontier; ideas that did not earn their place — a MUAC-trend rule, a lower weak-signal threshold — are switched off. Click a dot and it becomes a draft pack that both ministries must sign.', go: () => { closeAll(); full('trial', { view: 'tradeoffs' }); } },
    { t: 'Fix 01 — Real-time bridge', min: '4:00', say: 'The jury asked: how can a 24-hour clock run on weekly exports? It can\'t. Events now come through the Tracker Open API via API Setu, plus an SMS flash path for RED signs. The clock starts at measurement time; a late event escalates on arrival and is booked to the pipeline.', go: () => { closeAll(); store.setRole('CDPO', store.defaultScope('CDPO')); full('bridge'); } },
    { t: 'Fix 01 — live', min: '4:40', say: 'Watch: a RED-A oedema reading is captured… it crosses the SMS path in minutes, the task appears with its 24-hour deadline counted from the measurement.', go: async () => { const b = document.querySelector('[data-app="bridge"] .btn.hot'); b?.click(); await new Promise((r) => setTimeout(r, 400)); store.advance(HOUR); } },
    { t: 'Fix 01 — offline is normal', min: '5:00', say: 'In a forest village the AWW has no signal. Switch the phone to Offline, record an oedema case, advance six hours, go Online. The event syncs late, but its 24-hour clock started when the child was weighed — and if a deadline already passed, the task escalates on arrival and is booked to the pipeline, not to her.', go: () => { closeAll(); const d = desk(); open('awwphone'); place('awwphone', d.clientWidth / 2 - 220, (document.querySelector('.tourbar')?.offsetHeight || 60) + 22, 440, d.clientHeight - (document.querySelector('.tourbar')?.offsetHeight || 60) - 36); } },
    { t: 'Fix 02 — Async joint visit', min: '5:40', say: 'AWW and ASHA report to different ministries. They no longer need the same door at the same hour: either order within 7 days. The task closes only when the AWW app flag and the ASHA keypress 1 are both in. Half-closed tasks show exactly who is missing.', go: () => { closeAll(); const pending = (x) => x.required.includes('ASHA') && !x.closures.some((c) => c.by === 'ASHA') && store.esc(x).open && x.ingestedAt <= store.now; let t = store.scopedTasks().find(pending); if (!t) { t = store.tasks.find(pending); if (t) store.setRole('CDPO', store.awcById[t.awcId].blockId); } full('joint', t ? { taskId: t.id } : undefined); } },
    { t: 'Fix 03 — Kiln-proof migration', min: '6:30', say: 'Paper lost, phone dead, no signal. The token is Ed25519-signed and verifies offline. If the card is gone: IVR short code from any phone, or the mother\'s Aadhaar eKYC on the destination AWC tablet — face auth when brick-moulding has worn the fingerprints.', go: () => { closeAll(); full('migration'); } },
    { t: 'Fix 04 — Weighted R-score', min: '7:20', say: 'A broken scale is not a rounding habit. B (implausible values) now weighs 4, flat runs 1, digit preference 0.3 — and D only counts after three months running. Look at the red squares: sloppy AWCs that the old formula scored as reliable.', go: () => { closeAll(); store.setRole('DPO', 'DISTRICT'); full('reliability'); } },
    { t: 'Fix 05 — Honest cost', min: '8:10', say: 'Rs 12 lakh is the pilot MVP, not national DPI: two engineers for six months on reused building blocks — Sunbird RC, ABDM, Bhashini, API Setu. National rollout is its own MeitY/NIC capital line.', go: () => { closeAll(); full('budget'); } },
    { t: 'Governance', min: '8:50', say: 'Decision rights from Table 3 in code: names never leave the sector without logged break-glass; above block, small cells are suppressed; every access is hash-chained. Rule changes need both ministries\' signatures.', go: () => { closeAll(); store.setRole('CDPO', store.defaultScope('CDPO')); full('escalation'); } },
    { t: 'Close', min: '9:30', say: 'PoshanSetu does not replace the Tracker — it makes the data it already holds act in time. Watch which way the child is heading, and act while recovery is still simple.', go: () => { closeAll(); open('landing'); } },
  ];
}

// Riya's story: the same product, told through the people it serves. Each step has a speaker.
function storySteps() {
  const st = store.story;
  const riya = st && store.childById[st.childId];
  const awc = st && store.awcById[st.awcId];
  const m = store.sim.metrics;
  const asAww = () => store.setRole('AWW', store.defaultScope('AWW'));
  const openRiya = (tab) => { asAww(); if (riya) { store.selectChild(riya.id); full('child', { childId: riya.id, tab }); } };
  const liveTask = () => {
    const ok = (x) => x.required.includes('ASHA') && store.esc(x).open && x.ingestedAt <= store.now;
    const rank = (x) => (x.awcId === st?.awcId ? 0 : store.awcById[x.awcId].sectorId === st?.sectorId ? 1 : store.awcById[x.awcId].blockId === st?.blockId ? 2 : 3);
    return store.tasks.filter(ok).sort((a, b) => rank(a) - rank(b))[0];
  };
  const amberDate = st ? fmtDate(st.amberAt) : '', samDate = st ? fmtDate(st.samAt) : '';
  const village = awc?.village || 'the village';
  return [
    { who: 'kamla', t: 'Meet Kamla', min: '0:00', say: `Kamla Devi runs the Anganwadi in ${village}, Paschimi Singhbhum. Forty children, one growth day a month, and a Tracker app that is offline half the day. This is her list: every line has a reason, an owner and a deadline — and nothing on it is there without a reason she can read.`, go: () => { closeAll(); asAww(); full('worklist'); } },
    { who: 'riya', t: 'Meet Riya', min: '0:50', say: `Riya Hembrom is on Kamla’s register; her mother Sunita brings her every growth day. ${st?.flat ? `From ${fmtDate(st.flat.from)} to ${fmtDate(st.flat.to)}, ${st.flat.n} growth days in a row, her weight stayed at ${st.flat.lo === st.flat.hi ? st.flat.lo : `${st.flat.lo}–${st.flat.hi}`} kg. She grew ${st.flat.cm} cm taller in that time, but no heavier.` : 'Look at her line: a little lower each month.'} No single weighing crosses a line, so the Tracker, which reads one weighing at a time, says nothing.`, go: () => { closeAll(); openRiya(); } },
    { who: 'riya', t: 'Two systems, one child', min: '1:50', say: `The same readings, month by month. Left: the Tracker today — nothing, then a list with no owner and no deadline. Right: PoshanSetu sees two monthly falls in a row and raises AMBER on ${amberDate}. The Tracker put her on the SAM list on ${samDate}: ${st?.leadDays ?? '—'} days later.`, go: async () => { closeAll(); open('landing'); await new Promise((r) => setTimeout(r, 60)); const el = [...document.querySelectorAll('[data-app="landing"] div')].find((d) => d.textContent.startsWith('Riya.')); const bd = document.querySelector('[data-app="landing"] .body'); if (el && bd) bd.scrollTop = el.getBoundingClientRect().top - bd.getBoundingClientRect().top + bd.scrollTop - 130; const rb = [...document.querySelectorAll('[data-app="landing"] button')].find((b) => /Replay/.test(b.textContent)); setTimeout(() => rb?.click(), 300); } },
    { who: 'riya', t: 'Why AMBER — in words', min: '2:40', say: `Kamla never sees a score she cannot explain. Riya’s alert says what happened — “${st?.reason?.text || 'WHZ fell two months running'}” — which rule fired, and which signed rule-pack version fired it. The pink cone is the forecast: where her line is heading if nothing changes.`, go: () => { closeAll(); openRiya(); } },
    { who: 'riya', t: 'Riya was the silent trial', min: '3:20', say: `An honest detail: Riya’s AMBER came during the silent trial, so no one acted on it. That is how we measure: across ${m.children.toLocaleString('en-IN')} synthetic children, ${Math.round(m.shareEarlier * 100)}% of those who reached the SAM list were flagged first, a median ${Math.round(m.leadMedian)} days earlier. Pushing for more catches costs precision — this curve is where we chose to stop.`, go: () => { closeAll(); full('trial', { view: 'tradeoffs' }); } },
    { who: 'phulmani', t: 'Phulmani’s phone rings', min: '4:10', say: 'From go-live, the next Riya gets a task. Phulmani Hansda is the Sahiya: keypad phone, no data pack, a different ministry from Kamla. A Hindi voice call asks her to visit; she presses 1 when she has. Kamla ticks her visit in the app. Either order, within seven days — the task closes only when both are in.', go: () => { closeAll(); const t = liveTask(); if (t) store.setRole('CDPO', store.awcById[t.awcId].blockId); full('joint', t ? { taskId: t.id } : undefined); } },
    { who: 'kamla', t: 'When Kamla has no signal', min: '5:10', say: 'In the forest villages Kamla often has no signal. She records an oedema case offline; it syncs hours later. The 24-hour clock started when the child was weighed, not when the data arrived — and if a deadline passed on the way, it escalates on arrival and is booked to the pipeline, not to her.', go: () => { closeAll(); const d = desk(); open('awwphone'); const top = (document.querySelector('.tourbar')?.offsetHeight || 60) + 22; place('awwphone', d.clientWidth / 2 - 220, top, 440, d.clientHeight - top - 14); } },
    { who: 'sunita', t: 'Sunita leaves for the kiln', min: '5:50', say: 'In December many mothers in the block leave for brick kilns — Bihar, Odisha, Punjab. Sunita’s MCP card gets lost; her phone is off for days. The transfer token is signed and verifies offline at the kiln-side Anganwadi. No card? An IVR short code from any phone, or her thumb — or her face, when kiln work has worn her fingerprints.', go: () => { closeAll(); full('migration'); } },
    { who: 'sunita', t: 'Sunita decides what is shared', min: '6:40', say: 'Riya’s vaccines are in U-WIN; a diarrhoea episode is with the ASHA’s ministry. Those flags reach Kamla’s rules only under Sunita’s ABDM consent: one purpose, a set time, revocable. The exchange is encrypted end to end, and only the minimal flag is kept — the rest is discarded.', go: () => { closeAll(); store.setRole('CDPO', store.defaultScope('CDPO')); full('consent', { childId: riya?.id, view: 'hie' }); setTimeout(() => [...document.querySelectorAll('[data-app="consent"] button')].find((b) => /Run exchange/.test(b.textContent))?.click(), 250); } },
    { who: 'basanti', t: 'Basanti sees what is stuck', min: '7:30', say: 'Smt. Basanti Tiu supervises 25 Anganwadis. A task climbs one level each time its clock runs out — Kamla and Phulmani, then Basanti, then the CDPO and Block Medical Officer, then the district — counted from the weighing, not from when the data arrived. The tasks you see here are exactly the ones she should chase this week, and the right-hand lane shows who is missing on each.', go: () => { closeAll(); store.setRole('MS', store.defaultScope('MS')); full('escalation'); } },
    { who: 'anita', t: 'Anita asks: is the scale right?', min: '8:20', say: 'Smt. Anita Purty is the CDPO. A broken scale makes a village look healthy. The weighted reliability score catches decimal slips and copied-forward weights, so she sends a trainer — not a penalty — and the bad readings never trigger an alert.', go: () => { closeAll(); store.setRole('CDPO', store.defaultScope('CDPO')); full('reliability'); } },
    { who: 'riya', t: 'The point', min: '9:20', say: 'PoshanSetu does not make Riya’s line go up. Kamla, Phulmani and Sunita do. It makes sure they know months earlier, that each of them has one clear task, and that someone notices when a task is stuck. Watch which way the child is heading — and act while recovery is still simple.', go: () => { closeAll(); open('landing'); } },
  ];
}

export default {
  id: 'tour', persistent: true, title: 'Presenter', icon: ICONS.tour, dock: 'Jury tour', desk: 'Jury tour', size: [560, 200], key: 'j',
  mount(ctx, opts = {}) {
    let i = 0, auto = null;
    const story = opts.script === 'story', demo = opts.script === 'demo';
    const started = Date.now();
    const clk = h('span', { style: { fontSize: '16px' } });
    const tickClock = setInterval(() => { const el = Math.floor((Date.now() - started) / 1000); const behind = S[i + 1] && el > secs(S[i + 1].min); clk.textContent = `${Math.floor(el / 60)}:${String(el % 60).padStart(2, '0')}`; clk.style.color = behind ? '#fff' : ''; clk.style.background = behind ? 'var(--red-a)' : ''; }, 500);
    ctx.onCleanup(() => clearInterval(tickClock));
    const secs = (m) => { const [a, b] = m.split(':').map(Number); return a * 60 + b; };
    const S = demo ? demoSteps(demoApi) : story ? storySteps() : steps();
    const bar = h('div.tourbar', { style: { position: 'absolute', left: '24px', right: '24px', top: '10px', zIndex: 8800, background: 'var(--ink)', color: 'var(--white)', border: '2px solid var(--ink)', boxShadow: '4px 4px 0 var(--hot)', display: 'flex', alignItems: 'stretch' } });
    desk().appendChild(bar);
    ctx.onCleanup(() => bar.remove());
    ctx.win.el.classList.add('min');
    // Spotlight: a pink ring (and a soft dim) around whatever the current step talks about.
    const ring = h('div', { style: { position: 'fixed', zIndex: 8700, pointerEvents: 'none', border: '4px solid var(--hot)', boxShadow: '0 0 0 4px var(--ink), 0 0 0 9999px rgba(31,27,29,.22)', display: 'none', transition: 'all .25s ease' } });
    document.body.appendChild(ring);
    let target = null;
    const placeRing = () => {
      if (target && !target.isConnected) target = findIn(S[i]?.spot);
      if (!target) { ring.style.display = 'none'; return; }
      const r = target.getBoundingClientRect();
      if (r.width < 2) { ring.style.display = 'none'; return; }
      Object.assign(ring.style, { display: 'block', left: `${r.left - 8}px`, top: `${r.top - 8}px`, width: `${r.width + 16}px`, height: `${r.height + 16}px` });
    };
    const ringTimer = setInterval(placeRing, 400);
    ctx.onCleanup(() => { clearInterval(ringTimer); ring.remove(); });
    async function go(n) {
      i = Math.max(0, Math.min(S.length - 1, n));
      target = null; placeRing();
      await S[i].go();
      render();
      if (S[i].spot) { await sleep(450); target = findIn(S[i].spot); if (target && !S[i].spot.sel && !S[i].spot.root) target.scrollIntoView({ block: 'nearest' }); placeRing(); }
    }
    function render() {
      const st = S[i];
      mount(bar,
        h('div', { style: { background: 'var(--hot)', color: 'var(--ink)', padding: '6px 12px', fontFamily: 'var(--font-pixel)', fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' } }, `${i + 1}/${S.length}`, h('span', { style: { fontSize: '16px' } }, st.min), clk),
        st.who ? speaker(CAST_BY_KEY[st.who]) : null,
        demo
          ? h('div', { style: { padding: '8px 14px', flex: 1, minHeight: '104px', boxSizing: 'border-box' } },
              h('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--pink-2)' } }, `${st.sec} · step ${i + 1} of ${S.length}`),
              h('div', { style: { fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em', margin: '2px 0 4px' } }, st.t),
              h('div', { style: { fontSize: '16px', lineHeight: 1.45, color: '#f7e6ec', maxWidth: '1100px' } }, st.say),
              h('div', { style: { height: '4px', background: '#3a3236', marginTop: '8px' } }, h('div', { style: { height: '4px', width: `${((i + 1) / S.length) * 100}%`, background: 'var(--hot)' } })))
          : h('div', { style: { padding: '6px 12px', flex: 1 } }, h('div', { style: { fontWeight: 800, fontSize: '15px', letterSpacing: '-0.01em' } }, st.t), h('div', { style: { fontSize: '12.5px', lineHeight: 1.4, color: '#f2dce4' } }, st.say)),
        h('div.row', { style: { padding: '6px', gap: '6px' } },
          h('button.btn.ghost.sm', { onclick: toggleAuto, title: 'Rehearsal: advance on the slot timings' }, auto ? '❚❚ auto' : '▶ auto'),
          h('button.btn.ghost.sm', { onclick: () => go(i - 1) }, '◂ prev'),
          h('button.btn.hot.sm', { onclick: () => go(i + 1) }, 'next ▸'),
          h('button.btn.sm', { onclick: () => ctx.win.el.querySelector('.tb button:last-child').click() }, '× end')));
    }
    function speaker(m) {
      return h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRight: '1.5px solid #5b4c52', minWidth: '190px' } },
        h('div', { html: portraitSvg(m, 44), style: { border: '2px solid var(--white)', flex: '0 0 auto' } }),
        h('div', null, h('div', { style: { fontWeight: 800, fontSize: '13px' } }, m.name), h('div', { style: { fontSize: '11px', color: '#f2dce4', fontFamily: 'var(--font-mono)' } }, m.role)));
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
