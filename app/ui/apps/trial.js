import { h, mount, s } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';
import { bars, lineChart } from '../charts.js';
import { tierChip, nameOf, fmtDate, DAY, statCard, pct } from '../common.js';
import { trackerSingleReading } from '../../engine/triage.js';
import { generate } from '../../engine/simulate.js';

let seeds = null;

const TREND = ['R2_CONFIRMED', 'R2_SUSTAINED', 'INFANT_FALTERING', 'TREND_PLUS_SIGNAL', 'LBW_LOW_GAIN', 'WATCH_REPEAT', 'FORECAST', 'WEAK_SIGNALS', 'VELOCITY_2M', 'MUAC_TREND'];
let TRADE = null;
fetch(new URL('../../data/tradeoff.json', import.meta.url)).then((r) => r.json()).then((d) => { TRADE = d; }).catch(() => {});
const RULE_LABEL = { MAM_CONFIRMED: 'Confirmed MAM (Rule 1)', R2_CONFIRMED: 'WHZ fall, re-weighed (Rule 2)', R2_SUSTAINED: 'Sustained fall (Rule 2)', INFANT_FALTERING: 'Infant: 2 low gains', LBW_LOW_GAIN: 'LBW infant low gain', TREND_PLUS_SIGNAL: 'Trend + consented signal', WATCH_REPEAT: 'Two WATCH in a row', FORECAST: 'Kalman trajectory forecast', WEAK_SIGNALS: 'Combined weak signals (risk pts)', VELOCITY_2M: 'WHO 2-month velocity', MUAC_TREND: 'MUAC trend' };

export default {
  id: 'trial', title: 'Silent trial — does it flag earlier?', icon: ICONS.trial, dock: 'Trial', desk: 'Silent trial', size: [1060, 700], key: 't',
  mount(ctx) {
    let view = 'results';
    function exampleChild() {
      let best = null;
      for (const c of store.sim.district.children) {
        const ev = c.eval;
        const sam = ev.visits.find((v) => trackerSingleReading(c, v, store.pack) === 'SAM' && !v.biv.length);
        if (!sam) continue;
        const first = ev.results.find((r) => r.tier === 'AMBER' && r.t < sam.t);
        if (!first) continue;
        const lead = (sam.t - first.t) / DAY;
        const trend = first.reasons.some((r) => TREND.includes(r.code)) && first.visit.ix.whz > -2;
        const score = (trend ? 0 : 1000) + Math.abs(lead - 75);
        if (lead > 30 && lead < 150 && (!best || score < best.score)) best = { c, sam, first, lead, score };
      }
      return best;
    }
    function tradeoffs() {
      if (!TRADE) return h('div.empty', null, 'Trade-off data not built — run npm run build:tradeoff');
      const pts = TRADE.points;
      const W = 760, H = 420, pad = 56;
      const xMin = 0.1, xMax = 0.36, yMin = 0.44, yMax = 0.64;
      const X = (v) => pad + ((v - xMin) / (xMax - xMin)) * (W - pad - 20), Y = (v) => H - pad + 10 - ((v - yMin) / (yMax - yMin)) * (H - pad - 20);
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'display:block;max-width:900px;font-family:var(--font-mono)' });
      svg.append(s('rect', { x: pad, y: 10, width: W - pad - 20, height: H - pad - 10, fill: '#fff', stroke: '#1f1b1d', 'stroke-width': 1.5 }));
      svg.append(s('rect', { x: pad, y: Y(0.55), width: W - pad - 20, height: H - pad + 10 - Y(0.55), fill: '#ffd3da', opacity: 0.5 }));
      svg.append(s('text', { x: pad + 8, y: H - pad + 2, 'font-size': 10, fill: '#c8102e' }, 'below the 55% precision floor'));
      for (let v = 0.1; v <= 0.36; v += 0.05) { svg.append(s('line', { x1: X(v), x2: X(v), y1: 10, y2: H - pad + 10, stroke: '#1f1b1d', 'stroke-opacity': 0.08 }), s('text', { x: X(v), y: H - pad + 24, 'text-anchor': 'middle', 'font-size': 10 }, `${Math.round(v * 100)}%`)); }
      for (let v = 0.45; v <= 0.64; v += 0.05) { svg.append(s('line', { x1: pad, x2: W - 20, y1: Y(v), y2: Y(v), stroke: '#1f1b1d', 'stroke-opacity': 0.08 }), s('text', { x: pad - 6, y: Y(v) + 3, 'text-anchor': 'end', 'font-size': 10 }, `${Math.round(v * 100)}%`)); }
      svg.append(s('text', { x: (W + pad) / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': 11 }, 'eventual SAM cases flagged before ANY Tracker listing (strict) →'));
      svg.append(s('text', { x: 14, y: H / 2, 'text-anchor': 'middle', 'font-size': 11, transform: `rotate(-90 14 ${H / 2})` }, 'alert precision →'));
      const fr = pts.filter((p) => p.pareto).sort((a, b) => a.strict - b.strict);
      svg.append(s('path', { d: fr.map((p, i) => `${i ? 'L' : 'M'}${X(p.strict)},${Y(p.precision)}`).join(''), fill: 'none', stroke: '#e94fbf', 'stroke-width': 2.5, 'stroke-dasharray': '6 4' }));
      for (const p of pts) {
        const special = p.id === 'shipped' || p.id === 'round1';
        const r = 4 + (p.alerts - 1.25) * 30;
        const g = s('g', { style: 'cursor:pointer' });
        g.append(s(special ? 'rect' : 'circle', special ? { x: X(p.strict) - 8, y: Y(p.precision) - 8, width: 16, height: 16, fill: p.id === 'shipped' ? '#e94fbf' : '#9c8f94', stroke: '#1f1b1d', 'stroke-width': 2 } : { cx: X(p.strict), cy: Y(p.precision), r: Math.max(3, r), fill: p.pareto ? '#1f1b1d' : '#fff', stroke: '#1f1b1d', 'stroke-width': 1.5 }));
        if (special) g.append(s('text', { x: X(p.strict) + 12, y: Y(p.precision) + 4, 'font-size': 11, 'font-weight': 700 }, p.label));
        g.append(s('title', null, `${p.label}\nstrict ${pct(p.strict, 1)} · precision ${pct(p.precision, 1)} · ${p.alerts.toFixed(2)} alerts/child/yr · over cap ${pct(p.overCap)}\nclick → draft this as a rule pack`));
        g.addEventListener('click', () => { if (p.id !== 'round1') open('rulepack', { patch: p.patch, label: p.label }); });
        svg.append(g);
      }
      return h('div.col', { style: { gap: '12px' } },
        h('div.callout', null, h('b', null, 'There is no free lunch. '), `Each dot is a rule pack, averaged over ${TRADE.seeds.length} synthetic districts. Moving right catches more children before any Tracker listing; moving down costs precision (more home visits that turn out unnecessary). Dot size = alerts per child per year. The pink dashed line is the Pareto frontier. Click any dot to draft it as a rule pack for both ministries to sign.`),
        h('div.card', null, svg),
        h('table.grid', null, h('thead', null, h('tr', null, ['Operating point', 'Strict', 'Before SAM list', 'Precision', 'Alerts / child·yr', 'AWC-months over cap', ''].map((x) => h('th', null, x)))),
          h('tbody', null, pts.filter((p) => p.pareto).sort((a, b) => b.strict - a.strict).map((p) => h('tr', { style: p.id === 'shipped' ? { background: '#fff0f8' } : null }, h('td', null, h('b', null, p.label)), h('td.num', null, pct(p.strict, 1)), h('td.num', null, pct(p.earlier)), h('td.num', null, h('span', { style: { color: p.precision < 0.55 ? 'var(--red-a)' : '' } }, pct(p.precision, 1))), h('td.num', null, p.alerts.toFixed(2)), h('td.num', null, pct(p.overCap)), h('td', null, p.id !== 'round1' ? h('button.btn.sm.ghost', { onclick: () => open('rulepack', { patch: p.patch, label: p.label }) }, 'draft ▸') : null))))));
    }
    function ablation() {
      if (!TRADE?.ablation) return h('div.empty', null, 'Ablation not built — run npm run build:tradeoff');
      const rows = TRADE.ablation;
      const max = Math.max(...rows.map((r) => r.strict));
      return h('div.col', { style: { gap: '12px' } },
        h('div.callout', null, h('b', null, 'Every rule had to earn its place. '), 'Rules were switched on one at a time and kept only if they raised the strict metric without pushing precision below 55%. The MUAC-trend rule did not, so it ships switched off and goes to the Phase 1 real-data test.'),
        h('table.grid', null, h('thead', null, h('tr', null, ['Step', 'Strict (before any listing)', '', 'Before SAM list', 'Precision', 'Alerts / child·yr', 'Lead vs true SAM'].map((x) => h('th', null, x)))),
          h('tbody', null, rows.map((r, i) => h('tr', { style: /rejected/.test(r.label) ? { opacity: 0.55, textDecoration: 'line-through' } : /shipped/.test(r.label) ? { background: '#fff0f8' } : null },
            h('td', null, h('b', null, r.label)), h('td.num', null, pct(r.strict, 1)),
            h('td', null, h('div', { style: { width: (r.strict / max) * 160 + 'px', height: '10px', background: /shipped/.test(r.label) ? 'var(--hot)' : 'var(--ink)' } })),
            h('td.num', null, pct(r.earlier)), h('td.num', null, pct(r.precision, 1)), h('td.num', null, r.alerts.toFixed(2)), h('td.num', null, `${Math.round(r.truthLead)} d`))))),
        h('div.small.muted', null, `Seeds ${TRADE.seeds.join(', ')} · built ${TRADE.generatedAt.slice(0, 10)} · npm run build:tradeoff`));
    }
    function render() {
      if (view !== 'results') {
        mount(ctx.body, toolbarTabs(), h('div', { style: { padding: '12px' } }, view === 'tradeoffs' ? tradeoffs() : ablation()));
        return;
      }
      const m = store.sim.metrics;
      const bins = [[0, 15], [15, 30], [30, 45], [45, 60], [60, 90], [90, 120], [120, 150], [150, 181]];
      const hist = bins.map(([a, b]) => ({ label: `${a}–${b === 181 ? '180' : b}`, value: m.leads.filter((x) => x >= a && x < b).length, color: a >= 30 ? '#e94fbf' : '#1f1b1d' }));
      const ex = exampleChild();
      let exView = null;
      if (ex) {
        const { c, sam, first } = ex;
        const vs = c.eval.visits.filter((v) => v.ix.whz != null);
        const t0 = vs[0].t, t1 = vs[vs.length - 1].t;
        exView = h('div.card', null, h('div.kicker', null, `Worked example · ${nameOf(c)} (${c.sex === 'F' ? 'girl' : 'boy'}, AWC ${store.awcById[c.awcId].name})`),
          lineChart({ w: 900, h: 200, x: { min: t0 - 10 * DAY, max: t1 + 10 * DAY, ticks: vs.filter((_, i) => i % 2 === 0).map((v) => v.t) }, y: { min: -4.5, max: 1, ticks: [-4, -3, -2, -1, 0, 1] },
            xfmt: (t) => new Date(t).toLocaleDateString('en-IN', { month: 'short' }), yfmt: (v) => v,
            bands: [{ y0: -5, y1: -3, fill: '#ffd3da', label: 'SAM' }, { y0: -3, y1: -2, fill: '#ffeac2', label: 'MAM' }],
            vlines: [{ x: first.t, label: `PoshanSetu AMBER · ${fmtDate(first.t)}`, color: '#e94fbf', width: 2.5, dash: '' }, { x: sam.t, label: `Tracker lists SAM · ${fmtDate(sam.t)}`, color: '#c8102e', width: 2.5, dy: 14 }],
            series: [{ points: vs.map((v) => [v.t, v.ix.whz]), dots: true, r: 3.5, width: 2 }] }),
          h('div.row', { style: { gap: '8px', marginTop: '6px' } }, h('b', null, `${Math.round(ex.lead)} days of lead time.`), h('span.small', null, 'Reason at the first alert: '), h('span.small.mono', null, first.reasons.find((r) => r.tier === 'AMBER')?.text), h('div.grow'), h('button.btn.sm.ghost', { onclick: () => open('child', { childId: c.id }) }, 'Open record')));
      }
      mount(ctx.body,
        toolbarTabs(),
        h('div.toolbar', null, h('b', null, 'Eight weeks of alerts logged, not shown.'), h('span.small', null, 'Lead time and false alerts are measured at no cost to staff (Table 5 indicators).'), h('div.grow'),
          h('button.btn.sm', { onclick: runSeeds }, seeds === 'running' ? 'running…' : 'Robustness: 5 more districts')),
        Array.isArray(seeds) ? h('div', { style: { padding: '10px 12px 0' } }, h('div.card', null, h('div.kicker', null, 'Same rules on 5 independently generated districts (different seeds) — not a cherry-picked run'),
          h('table.grid', { style: { marginTop: '6px' } }, h('thead', null, h('tr', null, ['Seed', 'SAM cases', 'Flagged earlier', 'Median lead', 'Before any listing', 'Precision'].map((x) => h('th', null, x)))),
            h('tbody', null, seeds.map((r) => h('tr', null, h('td.mono', null, r.seed), h('td.num', null, r.m.samKids), h('td.num', null, pct(r.m.shareEarlier)), h('td.num', null, `${Math.round(r.m.leadMedian)} d`), h('td.num', null, pct(r.m.strict.share)), h('td.num', null, pct(r.m.precision)))),
              h('tr', null, h('td', null, h('b', null, 'range')), h('td'), ...[(x) => x.shareEarlier, (x) => x.leadMedian, (x) => x.strict.share, (x) => x.precision].map((f, i) => { const v = seeds.map((r) => f(r.m)); const fm = i === 1 ? (x) => `${Math.round(x)} d` : (x) => pct(x); return h('td.num', null, h('b', null, `${fm(Math.min(...v))}–${fm(Math.max(...v))}`)); })))))) : null,
        h('div.col', { style: { padding: '12px', gap: '12px' } },
          h('div.row.wrap', { style: { gap: '10px' } },
            statCard(pct(m.shareEarlier), `SAM cases flagged earlier (target ≥ 50%)`, { cls: 'pinkc' }),
            statCard(`${Math.round(m.leadMedian)} d`, `median lead time (target ≥ 30 d)`, { cls: 'pinkc' }),
            statCard(`${Math.round(m.leadP25)}–${Math.round(m.leadP75)} d`, 'inter-quartile lead'),
            statCard(pct(m.precision), 'alert precision (truth-checked)'),
            statCard(m.samKids, 'children reaching Tracker SAM list'),
            statCard(pct(m.strict.share), `flagged before ANY Tracker listing (median ${Math.round(m.strict.leadMedian || 0)} d)`, { cls: 'dark' })),
          h('div.row', { style: { gap: '12px', alignItems: 'stretch' } },
            h('div.card.grow', null, h('div.kicker', null, 'Lead time: first AMBER → Tracker SAM listing (days)'), bars({ w: 520, h: 190, bars: hist, valueLabels: true })),
            h('div.card', { style: { flex: '0 0 360px' } }, h('div.kicker', null, 'How this was measured'),
              h('ol', { style: { margin: '6px 0 0 16px', padding: 0, fontSize: '12px', lineHeight: 1.5 } },
                h('li', null, 'Baseline = what the Tracker does today: list a child as SAM/MAM from one reading.'),
                h('li', null, 'PoshanSetu rules run over the same dated events, including the re-measures the rules ask for.'),
                h('li', null, 'Lead = days between the first confirmed AMBER and the first SAM listing (within 180 d).'),
                h('li', null, 'Precision = AMBER/RED alerts where the true child state was MAM/SAM, falling ≥ 0.4 SD, or became SAM within 90 d.')),
              h('div.callout', { style: { marginTop: '8px' } }, h('b', null, 'Honest caveat: '), 'these are synthetic children tuned to NFHS-5 / NITI-IFPRI district levels. Phase 1 repeats this on anonymised Tracker exports under a state agreement; thresholds are then fixed in a signed rule pack.'))),
          h('div.row', { style: { gap: '12px', alignItems: 'stretch' } },
            h('div.card.grow', null, h('div.kicker', null, 'Which rule fired first (children flagged before SAM)'),
              (() => { const tot = Object.values(m.firstRule).reduce((a, b) => a + b, 0) || 1; return Object.entries(m.firstRule).sort((a, b) => b[1] - a[1]).map(([k, n]) => h('div.row', { style: { gap: '8px', padding: '3px 0' } }, h('span', { style: { width: '200px', fontSize: '12px' } }, RULE_LABEL[k] || k), h('div', { style: { height: '12px', width: (n / tot) * 260 + 'px', background: TREND.includes(k) ? 'var(--hot)' : 'var(--ink)', border: '1.5px solid var(--ink)' } }), h('span.mono.small', null, `${n}`))); })(),
              h('div.small.muted', { style: { marginTop: '6px' } }, 'Black: a MAM reading the Tracker would also list, but without an owner, deadline or escalation. Pink: trend rules that catch a child the Tracker does not list at all.')),
            h('div.card.grow', null, h('div.kicker', null, `New AMBER visits per AWC-month vs the cap of ${store.pack.workload.newAmberCapPerAwcPerMonth}`),
              bars({ w: 420, h: 150, bars: Array.from({ length: 10 }, (_, k) => ({ label: k === 9 ? '9+' : String(k + 1), value: m.amberLoads.filter((x) => (k === 9 ? x >= 10 : x === k + 1)).length, color: k + 1 > store.pack.workload.newAmberCapPerAwcPerMonth ? '#f2a20c' : '#1f1b1d' })), valueLabels: true, vline: store.pack.workload.newAmberCapPerAwcPerMonth }),
              h('div.small.muted', null, `The cap binds in ${m.amberPerAwcMonth.overCap} of ${m.amberPerAwcMonth.cells} AWC-months at this district's ~30% wasting. Excess cases are ranked (tier → youngest → longest unmeasured) and wait on the monthly list, escalating at day 10. Calibrating the cap is a Phase 1 decision.`))),
          exView));
    }
    async function runSeeds() {
      if (seeds === 'running') return;
      seeds = 'running'; render();
      const out = [];
      for (const seed of [1101, 2202, 3303, 4404, 5505]) { await new Promise((r) => setTimeout(r, 20)); out.push({ seed, m: generate({ pack: store.pack, seed }).metrics }); }
      seeds = out;
      store.audit.append({ at: store.now, actor: store.actorName(), role: store.role, action: 'BACKTEST_SEEDS', subject: store.pack.version, detail: out.map((r) => Math.round(r.m.shareEarlier * 100) + '%').join(' ') });
      render();
    }
    function toolbarTabs() { return h('div.toolbar', null, h('div.seg', null, [['results', 'Results'], ['tradeoffs', 'Trade-off curve'], ['ablation', 'Ablation — which rules earned their place']].map(([k, l]) => h('button', { class: view === k ? 'on' : '', onclick: () => { view = k; render(); } }, l)))); }
    render();
    setTimeout(render, 400);
  },
};
