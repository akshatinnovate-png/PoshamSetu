import { h, mount, s } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';
import { bars, lineChart } from '../charts.js';
import { tierChip, nameOf, fmtDate, DAY, statCard, pct } from '../common.js';
import { trackerSingleReading } from '../../engine/triage.js';

export default {
  id: 'trial', title: 'Silent trial — does it flag earlier?', icon: ICONS.trial, dock: 'Trial', desk: 'Silent trial', size: [1060, 700], key: 't',
  mount(ctx) {
    function exampleChild() {
      let best = null;
      for (const c of store.sim.district.children) {
        const ev = c.eval;
        const sam = ev.visits.find((v) => trackerSingleReading(c, v, store.pack) === 'SAM' && !v.biv.length);
        if (!sam) continue;
        const first = ev.results.find((r) => r.tier === 'AMBER' && r.t < sam.t);
        if (!first) continue;
        const lead = (sam.t - first.t) / DAY;
        if (lead > 45 && lead < 120 && (!best || Math.abs(lead - 75) < Math.abs(best.lead - 75))) best = { c, sam, first, lead };
      }
      return best;
    }
    function render() {
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
        h('div.toolbar', null, h('b', null, 'Eight weeks of alerts logged, not shown.'), h('span.small', null, 'Lead time and false alerts are measured at no cost to staff (Table 5 indicators).')),
        h('div.col', { style: { padding: '12px', gap: '12px' } },
          h('div.row.wrap', { style: { gap: '10px' } },
            statCard(pct(m.shareEarlier), `SAM cases flagged earlier (target ≥ 50%)`, { cls: 'pinkc' }),
            statCard(`${Math.round(m.leadMedian)} d`, `median lead time (target ≥ 30 d)`, { cls: 'pinkc' }),
            statCard(`${Math.round(m.leadP25)}–${Math.round(m.leadP75)} d`, 'inter-quartile lead'),
            statCard(pct(m.precision), 'alert precision (truth-checked)'),
            statCard(m.samKids, 'children reaching Tracker SAM list'),
            statCard(`${m.amberPerAwcMonth.median}`, 'median new AMBER / AWC / month', { cls: 'dark' })),
          h('div.row', { style: { gap: '12px', alignItems: 'stretch' } },
            h('div.card.grow', null, h('div.kicker', null, 'Lead time: first AMBER → Tracker SAM listing (days)'), bars({ w: 520, h: 190, bars: hist, valueLabels: true })),
            h('div.card', { style: { flex: '0 0 360px' } }, h('div.kicker', null, 'How this was measured'),
              h('ol', { style: { margin: '6px 0 0 16px', padding: 0, fontSize: '12px', lineHeight: 1.5 } },
                h('li', null, 'Baseline = what the Tracker does today: list a child as SAM/MAM from one reading.'),
                h('li', null, 'PoshanSetu rules run over the same dated events, including the re-measures the rules ask for.'),
                h('li', null, 'Lead = days between the first confirmed AMBER and the first SAM listing (within 180 d).'),
                h('li', null, 'Precision = AMBER/RED alerts where the true child state was MAM/SAM, falling ≥ 0.4 SD, or became SAM within 90 d.')),
              h('div.callout', { style: { marginTop: '8px' } }, h('b', null, 'Honest caveat: '), 'these are synthetic children tuned to NFHS-5 / NITI-IFPRI district levels. Phase 1 repeats this on anonymised Tracker exports under a state agreement; thresholds are then fixed in a signed rule pack.'))),
          exView));
    }
    render();
  },
};
