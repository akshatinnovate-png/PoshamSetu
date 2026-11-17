import { h, svgFrom } from '../dom.js';
import { store } from '../store.js';
import { open, close } from '../wm.js';
import { ICONS } from '../icons.js';
import { drawClouds } from '../bg.js';
import { fmtDate, tierChip, showcaseChild } from '../common.js';
import { trackerSingleReading } from '../../engine/triage.js';

const FIXES = [
  { n: '01', app: 'bridge', t: 'Real-time data bridge', was: 'Round 1 read weekly dashboard exports — a 24-hour RED-A clock could not run on that.', now: 'Events arrive through the Poshan Tracker Open API (API Setu) plus an SMS flash path for RED signs. The clock starts at measurement time; a late event is a pipeline breach, escalated on arrival.' },
  { n: '02', app: 'joint', t: 'Asynchronous joint visit', was: 'AMBER demanded AWW and ASHA at the same door at the same time.', now: 'Either order within 7 days. The task closes only when the AWW app flag and the ASHA keypress (1) are both in. Half-closed tasks are visible and escalate.' },
  { n: '03', app: 'migration', t: 'Kiln-proof transfer', was: 'A lost QR card and a dead phone broke the chain.', now: 'Tokens are Ed25519-signed and verify offline. Fallbacks: IVR short code from any phone, mother’s Aadhaar eKYC on the destination AWC tablet, face/iris when kiln work wears fingerprints.' },
  { n: '04', app: 'reliability', t: 'Risk-weighted R-score', was: 'R = 100 × (1 − (B + D + F)/3) weighted a broken scale like a rounding habit.', now: 'R = 100 × (1 − min(1, 4·B + 1·F + 0.3·D·chronic)). Implausible readings are quarantined one by one; digit preference only counts after 3 months running.' },
  { n: '05', app: 'budget', t: 'Honest cost model', was: '“Rs 12 lakh one-time development” read as enterprise DPI.', now: 'Rs 12 lakh buys the pilot MVP on open DPI blocks (Sunbird RC, Bhashini, ABDM sandbox). National Phase 3 is a separate MeitY/NIC capex line, costed here.' },
];

export default {
  id: 'landing', title: 'Home — poshansetu.in', icon: ICONS.tour, desk: 'Home', size: [4000, 4000], pos: [0, 0],
  mount(ctx) {
    ctx.win.el.classList.add('max');
    const m = store.sim.metrics;
    const canvas = h('canvas', { style: { position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' } });
    const lead = Math.round(m.leadMedian), share = Math.round(m.shareEarlier * 100);
    const news = (date, head, body, btn, fn) => h('div', { style: { width: '540px', maxWidth: '90%', border: '2px solid var(--ink)', background: 'var(--paper-2)', boxShadow: 'inset 0 0 0 2px var(--paper)', fontFamily: 'var(--font-pixel)' } },
      h('div', { style: { background: 'var(--ink)', color: 'var(--white)', padding: '2px 8px', fontSize: '20px' } }, `${date} ▪ PoshanSetu News`),
      h('div', { style: { padding: '12px 16px', textAlign: 'center', fontSize: '22px', lineHeight: 1.25 } }, h('div', null, head), h('div', null, body),
        btn ? h('button', { onclick: fn, style: { marginTop: '12px', background: 'var(--ink)', color: '#fff', border: 0, fontFamily: 'var(--font-pixel)', fontSize: '22px', padding: '8px 22px' } }, btn) : null));
    const hero = h('div', { style: { position: 'relative', minHeight: '640px', overflow: 'hidden', borderBottom: '2px solid var(--ink)' } }, canvas,
      h('div', { style: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', paddingTop: '90px' } },
        news(fmtDate(store.now), 'ROUND 2 BUILD · WORKING PROTOTYPE', 'Five stress-tests from Round 1, answered in code', 'Start the jury tour ▸', () => enter('jury')),
        news(fmtDate(store.consts.LIVE_FROM), `Silent trial (synthetic): ${share}% of SAM cases`, `flagged a median ${lead} days earlier`, null),
        h('div', { style: { marginTop: '30px', fontSize: '22px', fontWeight: 600, letterSpacing: '-0.01em' } }, 'Introducing PoshanSetu ', h('span', { style: { letterSpacing: '0.2em' } }, '......................'), ' early warning beyond the line')));
    let raf, t = 0, last = 0;
    const loop = (ts) => { const visible = !document.hidden && ctx.body.scrollTop < 640 && !ctx.win.el.classList.contains('min'); if (visible && ts - last > 120) { drawClouds(canvas, t += 1); last = ts; } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    ctx.onCleanup(() => cancelAnimationFrame(raf));

    const huge = (txt, extra = {}) => h('div', { style: { fontWeight: 800, fontSize: 'clamp(54px, 10.5vw, 168px)', letterSpacing: '-0.055em', lineHeight: 0.86, textAlign: 'center', ...extra } }, txt);
    const manifesto = h('div', { style: { background: 'var(--white)', padding: '70px 20px 80px', position: 'relative' } },
      h('div.vtext', { style: { left: '24px', bottom: '40px' } }, store.signed.signatures[1].value.slice(0, 64)),
      huge('Do Not Wait'), huge('For A Child'), huge('To Cross'), huge('A Line.', { color: 'var(--hot)' }),
      h('p', { style: { textAlign: 'center', fontSize: '20px', maxWidth: '760px', margin: '36px auto 0', lineHeight: 1.4 } }, 'PoshanSetu is the early-warning, consent and continuity layer for the Poshan Tracker. It watches which way each child is heading and puts a named task, a deadline and an escalation path behind every alert.'));

    const numbers = h('div', { style: { background: 'var(--pink)', padding: '60px 26px', position: 'relative' } },
      h('div', { style: { fontWeight: 800, fontSize: 'clamp(48px, 8.5vw, 140px)', letterSpacing: '-0.05em', lineHeight: 0.88, color: '#3a2a30' } }, `${lead} Days Earlier,`),
      h('div', { style: { fontWeight: 800, fontSize: 'clamp(48px, 8.5vw, 140px)', letterSpacing: '-0.05em', lineHeight: 0.88, color: '#3a2a30' } }, `${share}% Flagged Before The SAM List.`),
      h('div.mono', { style: { marginTop: '14px', fontSize: '12px' } }, `*Silent-trial backtest on ${m.children.toLocaleString('en-IN')} synthetic children, 36 AWCs, 12 months. Median lead time vs. the Tracker's single-reading SAM list. Precision ${Math.round(m.precision * 100)}%. `, h('a', { href: '#', onclick: (e) => { e.preventDefault(); open('trial'); }, style: { color: 'inherit' } }, '(Proof)')),
      h('div.row.wrap', { style: { marginTop: '34px', gap: '14px' } },
        [['1,440', 'children simulated'], ['36', 'Anganwadi centres'], [String(store.tasks.length), 'tasks since go-live'], ['0', 'batch exports on the clock'], ['2', 'ministry signatures per rule']].map(([v, l]) => h('div.card', { style: { minWidth: '170px', boxShadow: 'var(--shadow)' } }, h('div.stat', null, h('div.v', null, v), h('div.l', null, l))))));

    const fixes = h('div', { style: { background: 'var(--paper)', padding: '50px 26px 60px', borderTop: '2px solid var(--ink)' } },
      h('div.row.between', { style: { alignItems: 'flex-end', marginBottom: '20px' } },
        h('div', { style: { fontWeight: 800, fontSize: '56px', letterSpacing: '-0.045em', lineHeight: 0.9 } }, 'Five stress tests.', h('br'), 'Five answers in code.'),
        h('div.row', null, h('button.btn.ghost', { onclick: () => enter('tile') }, 'Tile all five'), h('button.btn.hot', { onclick: () => enter('jury') }, 'Jury tour ▸'))),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' } },
        FIXES.map((f) => h('div.win.focused', { style: { position: 'relative', minHeight: '0' } },
          h('div.tb', null, h('span.t', null, `FIX ${f.n} · ${f.t}`)),
          h('div', { style: { padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--white)', flex: 1 } },
            h('div.small', { style: { textDecoration: 'line-through', color: 'var(--muted)' } }, f.was),
            h('div.p', null, f.now),
            h('button.btn.sm', { style: { alignSelf: 'flex-start' }, onclick: () => enter(f.app) }, `Open ${f.app} ▸`))))));

    const footer = h('div', { style: { background: 'var(--ink)', color: 'var(--white)', padding: '26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' } },
      h('div.mono.small', null, `PoshanSetu · Team 7 · Gulmohur High School, Jamshedpur · Techfest 2026-27 · Round 2 prototype · all child data synthetic`),
      h('div.row', null, h('button.btn.hot', { onclick: () => enter('worklist') }, 'Open the console ▸')));

    ctx.body.style.background = 'var(--white)';
    ctx.body.append(hero, manifesto, numbers, versus(), fixes, footer);

    // "Same child, two systems": readings appear month by month in both panels.
    function versus() {
      const pick = showcaseChild();
      if (!pick) return h('div');
      const { c, samI } = pick;
      const vs = c.eval.visits.slice(0, samI + 1), rs = c.eval.results.slice(0, samI + 1);
      const left = h('div.col', { style: { gap: 0 } }), right = h('div.col', { style: { gap: 0 } });
      const row = (v, a, b) => h('div.row', { style: { padding: '7px 10px', borderBottom: '1px dashed #9c8f94', gap: '10px', fontFamily: 'var(--font-mono)', fontSize: '12px', animation: 'toastIn .2s steps(3)' } }, h('span', { style: { width: '78px' } }, new Date(v.t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })), h('span', { style: { width: '74px' } }, `WHZ ${v.ix.whz ?? '—'}`), a, b ? h('span.small', { style: { flex: 1 } }, b) : null);
      const pane = (title, dark, body) => h('div.win.focused', { style: { position: 'relative', minHeight: '0', flex: '1 1 420px' } }, h('div.tb', { style: dark ? null : { background: '#6d6266' } }, h('span.t', null, title)), h('div', { style: { background: dark ? 'var(--white)' : '#c9c6c7', minHeight: '330px', flex: 1 } }, body));
      let i = 0, timer = null;
      const step = () => {
        if (i > samI) { clearInterval(timer); timer = null; return; }
        const v = vs[i], r = rs[i];
        const tr = trackerSingleReading(c, v, store.pack);
        left.append(row(v, tr ? h('span.tag' + (tr === 'SAM' ? '.bad' : '.warn'), null, `${tr} list`) : h('span.muted', null, '— not listed'), tr ? (tr === 'SAM' ? 'listed; action starts now' : 'on a list; no owner, no deadline') : ''));
        const task = r.tier !== 'GREEN' && (r.kind === 'NEW' || r.kind === 'WORSENING');
        right.append(row(v, tierChip(r.tier), task ? `${r.reasons.find((x) => x.tier === r.tier)?.text || ''} → ${r.tier === 'AMBER' ? 'AWW + ASHA task, 7 d' : r.tier === 'WATCH' ? 're-weigh' : r.tier === 'RED_B' ? 'CMAM at AWC, appetite test in 72 h' : 'same-day referral, 24 h clock'}` : r.tier === 'GREEN' ? 'on track' : r.kind.toLowerCase()));
        i++;
      };
      const replay = () => { left.replaceChildren(); right.replaceChildren(); i = 0; if (timer) clearInterval(timer); timer = setInterval(step, 650); };
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting) && i === 0 && !timer) replay(); });
      setTimeout(() => io.observe(wrap), 50);
      ctx.onCleanup(() => { io.disconnect(); if (timer) clearInterval(timer); });
      const lead = Math.round((vs[samI].t - rs[pick.aI].t) / 86400000);
      const wrap = h('div', { style: { background: 'var(--sky)', padding: '50px 26px', borderTop: '2px solid var(--ink)' } },
        h('div.row.between', { style: { alignItems: 'flex-end', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' } },
          h('div', { style: { fontWeight: 800, fontSize: '56px', letterSpacing: '-0.045em', lineHeight: 0.9 } }, 'Same child.', h('br'), 'Two systems.'),
          h('div.col', { style: { alignItems: 'flex-end', gap: '6px' } }, h('div.mono', null, `${c.sex === 'F' ? 'girl' : 'boy'} · AWC ${store.awcById[c.awcId].name} · synthetic`), h('div', { style: { fontWeight: 800, fontSize: '28px', letterSpacing: '-0.03em' } }, `${lead} days of warning`), h('button.btn.sm', { onclick: replay }, 'Replay ▸'))),
        h('div.row', { style: { gap: '18px', alignItems: 'stretch', flexWrap: 'wrap' } }, pane('Poshan Tracker today — one reading at a time', false, left), pane('PoshanSetu — direction, task, deadline', true, right)));
      return wrap;
    }

    function enter(target) {
      if (target === 'jury') return window.psLayout.juryLayout();
      close('landing');
      if (target === 'tile') window.psLayout.tileLayout();
      else open(target);
    }
  },
};
