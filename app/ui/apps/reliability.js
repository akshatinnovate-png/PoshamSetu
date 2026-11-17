import { h, mount, s } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { bars, spark, lineChart } from '../charts.js';
import { DAY } from '../common.js';
import { scoreFeed } from '../../engine/reliability.js';
import { deepClone } from '../../engine/rulepack.js';

const QCOL = { good: '#1f9d6b', heaping: '#f2a20c', copyforward: '#3f7fe0', sloppy: '#c8102e' };

export default {
  id: 'reliability', title: 'Reliability lab — weighted R-score', icon: ICONS.gauge, dock: 'R-score', desk: 'R-score', size: [1080, 700], key: '4',
  mount(ctx) {
    const pack = deepClone(store.pack);
    let sel = null;
    const vByAwc = {};
    for (const c of store.sim.district.children) (vByAwc[c.awcId] ||= []).push(c.eval.visits);

    function scoreAll() {
      return store.sim.district.awcs.filter((a) => store.role === 'DPO' || store.role === 'CDPO' || store.role === 'MS' ? (store.role === 'DPO' || (store.role === 'CDPO' ? a.blockId === store.scope : a.sectorId === store.scope)) : a.id === store.scope)
        .map((a) => {
          const monthly = store.sim.feeds[a.id].monthly;
          const recent = (vByAwc[a.id] || []).map((vs) => vs.filter((v) => v.t >= store.consts.NOW - 90 * DAY));
          const sc = scoreFeed(recent, pack, monthly.slice(-4, -1).map((m) => m.D));
          return { a, sc, monthly };
        }).sort((x, y) => x.sc.R - y.sc.R);
    }

    function render() {
      const rows = scoreAll();
      if (!sel || !rows.find((r) => r.a.id === sel)) sel = rows[0]?.a.id;
      const cur = rows.find((r) => r.a.id === sel);
      const W = pack.reliability.weights;
      const slider = (label, path, min, max, step) => {
        const [k1, k2] = path;
        const val = k2 ? pack.reliability[k1][k2] : pack.reliability[k1];
        return h('label.field', null, h('span', null, `${label}: `, h('b', null, val)), h('input', { type: 'range', min, max, step, value: val, oninput: (e) => { if (k2) pack.reliability[k1][k2] = +e.target.value; else pack.reliability[k1] = +e.target.value; render(); } }));
      };
      const below = rows.filter((r) => r.sc.R < pack.reliability.cutoff).length, belowLegacy = rows.filter((r) => r.sc.legacyR < pack.reliability.cutoff).length;
      // scatter legacy vs new
      const sc = s('svg', { viewBox: '0 0 300 220', width: '100%', style: 'display:block;font-family:var(--font-mono);max-width:380px' });
      const X = (v) => 36 + ((v - 50) / 50) * 250, Y = (v) => 196 - ((v - 50) / 50) * 180;
      sc.append(s('rect', { x: 36, y: 16, width: 250, height: 180, fill: '#fff', stroke: '#1f1b1d', 'stroke-width': 1.5 }));
      sc.append(s('line', { x1: X(50), y1: Y(50), x2: X(100), y2: Y(100), stroke: '#1f1b1d', 'stroke-dasharray': '3 3', opacity: 0.4 }));
      sc.append(s('line', { x1: X(pack.reliability.cutoff), x2: X(pack.reliability.cutoff), y1: 16, y2: 196, stroke: '#e94fbf', 'stroke-dasharray': '2 2' }), s('line', { y1: Y(pack.reliability.cutoff), y2: Y(pack.reliability.cutoff), x1: 36, x2: 286, stroke: '#e94fbf', 'stroke-dasharray': '2 2' }));
      for (const t of [50, 75, 100]) { sc.append(s('text', { x: X(t), y: 210, 'font-size': 9, 'text-anchor': 'middle' }, t), s('text', { x: 30, y: Y(t) + 3, 'font-size': 9, 'text-anchor': 'end' }, t)); }
      sc.append(s('text', { x: 160, y: 12, 'font-size': 9, 'text-anchor': 'middle' }, 'x: Round 1 equal-weight R  ·  y: Round 2 weighted R'));
      for (const r of rows) {
        const c = s('rect', { x: X(Math.max(50, r.sc.legacyR)) - 4, y: Y(Math.max(50, r.sc.R)) - 4, width: 8, height: 8, fill: QCOL[r.a.quality], stroke: '#1f1b1d', 'stroke-width': r.a.id === sel ? 3 : 1, style: 'cursor:pointer' });
        c.append(s('title', null, `${r.a.name}: legacy ${r.sc.legacyR} → ${r.sc.R} (${r.a.quality})`));
        c.addEventListener('click', () => { sel = r.a.id; render(); });
        sc.append(c);
      }

      mount(ctx.body,
        h('div.toolbar', null, h('span.fix', null, 'AUDIT FIX 04'), h('b', null, 'A broken scale is not a rounding habit.'), h('span.small.mono', null, `R = 100 × (1 − min(1, ${W.B}·B + ${W.F}·F + ${W.D}·D·chronic))`)),
        h('div.row', { style: { alignItems: 'stretch', gap: 0, height: 'calc(100% - 38px)' } },
          h('div', { style: { width: '430px', borderRight: '2px solid var(--ink)', overflow: 'auto', background: 'var(--white)' } },
            h('table.grid', null, h('thead', null, h('tr', null, ['AWC', 'R', 'R1', 'B', 'F', 'D', '12-mo R'].map((x) => h('th', null, x)))),
              h('tbody', null, rows.map((r) => h('tr.click' + (r.a.id === sel ? '.sel' : ''), { onclick: () => { sel = r.a.id; render(); } },
                h('td', null, r.a.name, h('div.small', null, r.sc.flags.map((f) => h('span.tag' + (f.severity === 'high' ? '.bad' : f.severity === 'med' ? '.warn' : ''), { title: f.text, style: { marginRight: '2px' } }, f.code.toLowerCase())))),
                h('td.num', null, h('b', { style: { color: r.sc.R < pack.reliability.cutoff ? 'var(--red-a)' : 'inherit' } }, r.sc.R)),
                h('td.num.muted', null, r.sc.legacyR),
                h('td.num', null, (r.sc.B * 100).toFixed(1) + '%'), h('td.num', null, (r.sc.F * 100).toFixed(0) + '%'), h('td.num', null, r.sc.D.toFixed(2) + (r.sc.chronic ? '*' : '')),
                h('td', null, spark(r.monthly.map((m) => m.R), { w: 70, h: 18, min: 50, max: 100 }))))))),
          h('div.grow', { style: { overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' } },
            h('div.row', { style: { alignItems: 'stretch', gap: '12px' } },
              h('div.card', { style: { flex: '1 1 300px' } }, h('div.kicker', null, 'Calibrate (Phase 1 sets the final values)'),
                h('div.col', { style: { gap: '8px', marginTop: '8px' } },
                  slider('wB · implausible values', ['weights', 'B'], 0, 8, 0.5), slider('wF · flat runs', ['weights', 'F'], 0, 3, 0.1), slider('wD · digit preference', ['weights', 'D'], 0, 1, 0.05),
                  slider('D counts after (months)', ['dChronicMonths'], 1, 6, 1), slider('Re-measure cutoff', ['cutoff'], 60, 95, 1)),
                h('div.row', { style: { marginTop: '10px', gap: '8px' } }, h('div.card.flat.grow', null, h('div.stat', null, h('div.v', null, below), h('div.l', null, 'AWCs below cutoff (new)'))), h('div.card.flat.grow', null, h('div.stat', null, h('div.v.muted', null, belowLegacy), h('div.l', null, 'below cutoff (Round 1)'))))),
              h('div.card', { style: { flex: '1 1 300px' } }, h('div.kicker', null, 'Every AWC, both formulas (colour = synthetic ground truth)'), sc,
                h('div.row.wrap', { style: { gap: '6px' } }, Object.entries(QCOL).map(([k, c]) => h('span.small.mono', null, h('span', { style: { display: 'inline-block', width: '9px', height: '9px', background: c, border: '1px solid #1f1b1d', marginRight: '3px' } }), k))))),
            cur ? detail(cur) : null)));
    }

    function detail({ a, sc, monthly }) {
      const exp = sc.hist.reduce((x, y) => x + y, 0) / 10;
      const comp = (label, v, color) => h('div', { style: { width: Math.max(0, v) + '%', background: color, borderRight: v ? '1.5px solid var(--ink)' : 0, height: '100%' }, title: `${label}: −${v} pts` });
      const legacyParts = [sc.B, sc.D, sc.F].map((x) => (x / 3) * 100);
      return h('div.card', null,
        h('div.row.between', null, h('div', null, h('div.kicker', null, `AWC ${a.code}`), h('div.h2', null, a.name)), h('div.row', null, h('div.stat', null, h('div.v', null, sc.R), h('div.l', null, 'R (new)')), h('div.stat', null, h('div.v.muted', null, sc.legacyR), h('div.l', null, 'R (Round 1)')))),
        h('div.kicker', { style: { marginTop: '10px' } }, 'Penalty points — new vs Round 1'),
        h('div.col', { style: { gap: '4px', marginTop: '4px' } },
          h('div.row', null, h('span.mono.small', { style: { width: '70px' } }, 'new'), h('div.row.grow', { style: { gap: 0, height: '16px', border: '1.5px solid var(--ink)', background: '#fff' } }, comp('B', sc.contributions.B, '#c8102e'), comp('F', sc.contributions.F, '#3f7fe0'), comp('D', sc.contributions.D, '#f2a20c'))),
          h('div.row', null, h('span.mono.small', { style: { width: '70px' } }, 'Round 1'), h('div.row.grow', { style: { gap: 0, height: '16px', border: '1.5px solid var(--ink)', background: '#fff' } }, comp('B', +legacyParts[0].toFixed(1), '#c8102e'), comp('D', +legacyParts[1].toFixed(1), '#f2a20c'), comp('F', +legacyParts[2].toFixed(1), '#3f7fe0'))),
          h('div.small.muted', null, h('span', { style: { color: '#c8102e' } }, '■ B implausible '), h('span', { style: { color: '#3f7fe0' } }, '■ F flat runs '), h('span', { style: { color: '#f2a20c' } }, '■ D digit preference'))),
        h('div.row', { style: { gap: '12px', marginTop: '10px', alignItems: 'flex-start' } },
          h('div.grow', null, h('div.kicker', null, 'Terminal digit of weights (last 90 days) — flat = unbiased'), bars({ w: 330, h: 150, bars: sc.hist.map((v, i) => ({ label: '.' + i, value: v, color: i === 0 || i === 5 ? '#f2a20c' : '#1f1b1d' })), valueLabels: false }), h('div.small.muted', null, `expected ≈ ${exp.toFixed(0)} per digit; heaping on .0 / .5 is the classic AWC habit`)),
          h('div.grow', null, h('div.kicker', null, 'Monthly D — counts in R only when chronic'), lineChart({ w: 330, h: 150, x: { min: 0, max: monthly.length - 1, ticks: monthly.map((_, i) => i).filter((i) => i % 2 === 0) }, y: { min: 0, max: Math.max(0.6, ...monthly.map((m) => m.D)) }, xfmt: (i) => new Date(monthly[i].month).toLocaleDateString('en-IN', { month: 'short' }), yfmt: (v) => v.toFixed(1), hlines: [{ y: pack.reliability.dAuditThreshold, color: '#e94fbf', dash: '4 3', label: 'audit flag' }], series: [{ points: monthly.map((m, i) => [i, m.D]), dots: true, r: 3, width: 1.8 }] }))),
        h('div.callout', { style: { marginTop: '8px' } }, h('b', null, 'Why: '), 'one implausible reading (a decimal slip — 82 kg for 8.2 kg) is a hard failure, so B carries a weight of 4 and the reading itself is quarantined and never used in triage. Digit preference is a low-grade habit: it only raises a supportive-supervision audit flag until it has persisted for the set number of months. RED alerts always act at once, whatever R is.'));
    }

    render();
    ctx.onCleanup(store.on('role', render));
  },
};
