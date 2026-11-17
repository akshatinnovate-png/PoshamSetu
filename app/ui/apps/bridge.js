import { h, mount, s } from '../dom.js';
import { store } from '../store.js';
import { open } from '../wm.js';
import { ICONS } from '../icons.js';
import { bars } from '../charts.js';
import { fmtDuration, HOUR, DAY, tierChip } from '../common.js';
import { ADAPTERS, clockSafety } from '../../engine/bridge.js';
import { TIER_LABEL } from '../../engine/rulepack.js';

const BINS = [[0, 0.25, '<15m'], [0.25, 1, '15m–1h'], [1, 3, '1–3h'], [3, 8, '3–8h'], [8, 24, '8–24h'], [24, 72, '1–3d'], [72, 168, '3–7d'], [168, 1e9, '>7d']];
const hist = (lags) => BINS.map(([a, b, l]) => ({ label: l, value: lags.filter((x) => x / HOUR >= a && x / HOUR < b).length }));

export default {
  id: 'bridge', title: 'Data Bridge — event-time clock', icon: ICONS.bridge, dock: 'Bridge', desk: 'Bridge', size: [980, 680], key: '1',
  mount(ctx) {
    let mode = 'ROUND2';
    const B = store.sim.bridge;
    const r1ById = Object.fromEntries(B.round1.arrivals.map((a) => [a.id, a]));
    const r2ById = Object.fromEntries(B.round2.arrivals.map((a) => [a.id, a]));
    const evById = new Map(store.sim.district.history.events.map((e) => [e.id, e]));

    // counterfactual: the same live tasks under each design
    function counterfactual(byId) {
      const out = { RED_A: [0, 0], RED_B: [0, 0], AMBER: [0, 0], WATCH: [0, 0] };
      for (const t of store.sim.tasks) {
        const res = store.childById[t.childId].eval.results.find((r) => r.t === t.measuredAt);
        if (!res) continue;
        const arr = Math.min(...res.visit.eventIds.map((id) => byId[id]?.receivedAt ?? Infinity));
        if (!Number.isFinite(arr)) continue;
        out[t.tier][0]++;
        if (arr > t.dueAt) out[t.tier][1]++;
      }
      return out;
    }
    const cf1 = counterfactual(r1ById), cf2 = counterfactual(r2ById);

    function pipeline() {
      const W = 900, H = 210;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'display:block;font-family:var(--font-mono);max-width:1000px;margin:0 auto' });
      const box = (x, y, w, hh, title, sub, fill = '#fff', dim = false) => {
        const g = s('g', { opacity: dim ? 0.35 : 1 });
        g.append(s('rect', { x: x + 3, y: y + 3, width: w, height: hh, fill: '#1f1b1d' }), s('rect', { x, y, width: w, height: hh, fill, stroke: '#1f1b1d', 'stroke-width': 2 }));
        g.append(s('text', { x: x + 8, y: y + 16, 'font-size': 11, 'font-weight': 700 }, title));
        sub.split('\n').forEach((ln, i) => g.append(s('text', { x: x + 8, y: y + 30 + i * 12, 'font-size': 9.5, fill: '#3a3236' }, ln)));
        svg.append(g);
      };
      const r2 = mode === 'ROUND2';
      box(10, 80, 150, 64, 'AWW device', 'Poshan Tracker app\noffline-first, dated events', '#fbd3e0');
      box(250, 14, 190, 52, 'API Setu webhook', `Tracker Open API · p95 ${fmtDuration(B.round2.stats.API_SETU.p95)}`, '#fff', !r2);
      box(250, 86, 190, 52, 'SMS / USSD flash', `RED signs on 2G · p95 ${fmtDuration(B.round2.stats.SMS_FLASH.p95)}`, '#fff', !r2);
      box(250, 158, 190, 46, 'Weekly CSV export', `p50 ${fmtDuration(B.round1.stats.BATCH_EXPORT.p50)} · reconcile only`, '#ececec', r2);
      box(520, 80, 160, 64, 'Event store', 'append-only · idempotent\nkey = hash(child,t,values)', '#d3e8fb');
      box(740, 30, 150, 52, 'Rules → tasks', 'tier + reasons + pack v', '#fff');
      box(740, 118, 150, 60, 'Deadline clock', 'starts at MEASURED time\nlate event ⇒ escalate now', '#1f1b1d');
      svg.lastChild.querySelectorAll('text').forEach((t) => t.setAttribute('fill', '#fff'));
      const path = (d, color, dim, dur) => {
        const p = s('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-dasharray': '5 4', opacity: dim ? 0.25 : 1 });
        svg.append(p);
        if (!dim) for (let k = 0; k < 3; k++) {
          const c = s('rect', { width: 7, height: 7, x: -3.5, y: -3.5, fill: color, stroke: '#1f1b1d' });
          c.append(s('animateMotion', { dur: dur + 's', repeatCount: 'indefinite', path: d, begin: (k * dur / 3) + 's' }));
          svg.append(c);
        }
      };
      path('M160,112 C200,112 210,40 250,40', '#e94fbf', !r2, 2.2);
      path('M160,112 L250,112', '#1f1b1d', !r2, 1.2);
      path('M160,120 C200,120 210,181 250,181', '#9c8f94', r2, 9);
      path('M440,40 C480,40 480,105 520,105', '#e94fbf', !r2, 2);
      path('M440,112 L520,112', '#1f1b1d', !r2, 1.2);
      path('M440,181 C480,181 480,125 520,125', '#9c8f94', r2, 9);
      path('M680,105 C710,105 710,56 740,56', '#1f1b1d', false, 1.8);
      path('M815,82 L815,118', '#1f1b1d', false, 1.4);
      return svg;
    }

    function render() {
      const stats = mode === 'ROUND2' ? B.round2.stats : B.round1.stats;
      const adapters = Object.keys(stats);
      const cf = mode === 'ROUND2' ? cf2 : cf1;
      const lags = (mode === 'ROUND2' ? B.round2 : B.round1).arrivals.map((a) => a.lagMs);
      const inflight = store.inflight;
      mount(ctx.body,
        h('div.toolbar', null, h('span.fix', null, 'AUDIT FIX 01'), h('b', null, 'Batch exports cannot run a 24-hour clock.'),
          h('div.grow'), h('div.seg', null, [['ROUND1', 'Round 1: dashboard export'], ['ROUND2', 'Round 2: event bridge']].map(([k, l]) => h('button', { class: mode === k ? 'on' : '', onclick: () => { mode = k; render(); } }, l)))),
        h('div.col', { style: { padding: '12px', gap: '12px' } },
          h('div.card', null, pipeline()),
          h('div.row.wrap', { style: { alignItems: 'stretch', gap: '12px' } },
            h('div.card.grow', { style: { minWidth: '420px' } }, h('div.kicker', null, 'Clock-safety: may this adapter drive the tier\'s clock? (p95 lag ≤ 10% of deadline)'),
              h('table.grid', { style: { marginTop: '6px' } },
                h('thead', null, h('tr', null, h('th', null, 'Adapter'), h('th.num', null, 'p50'), h('th.num', null, 'p95'), ...['RED_A', 'RED_B', 'AMBER', 'WATCH'].map((t) => h('th', null, TIER_LABEL[t])))),
                h('tbody', null, adapters.map((a) => {
                  const cs = clockSafety(stats[a], store.pack);
                  return h('tr', null, h('td', null, h('b', null, ADAPTERS[a].name)), h('td.num', null, fmtDuration(stats[a].p50)), h('td.num', null, fmtDuration(stats[a].p95)),
                    ...['RED_A', 'RED_B', 'AMBER', 'WATCH'].map((t) => h('td', null, h('span.tag' + (cs[t].safe ? '.ok' : '.bad'), { title: `budget ${fmtDuration(cs[t].budgetMs)}` }, cs[t].safe ? 'safe' : 'unsafe'))));
                }))),
              h('p.p.small', { style: { marginTop: '8px' } }, mode === 'ROUND2'
                ? 'RED signs travel on the SMS flash path, so RED-A/B clocks are safe even when the Tracker app has not synced. The API carries everything else; the CSV export is kept only to reconcile counts.'
                : 'Every adapter is unsafe for every tier: a child measured on Monday is not seen until the export lands days later.')),
            h('div.card', { style: { flex: '0 0 300px' } }, h('div.kicker', null, 'Same live tasks — arrived after their deadline'),
              ...['RED_A', 'RED_B', 'AMBER', 'WATCH'].map((t) => h('div.row.between', { style: { padding: '5px 0', borderBottom: '1px dashed #bbb' } }, tierChip(t), h('b.mono', null, `${cf[t][1]} / ${cf[t][0]}`), h('span.tag' + (cf[t][1] ? '.bad' : '.ok'), null, cf[t][0] ? Math.round((cf[t][1] / cf[t][0]) * 100) + '%' : '—'))),
              h('div.small.muted', { style: { marginTop: '6px' } }, 'Counterfactual replay of the 1 Oct – 17 Nov pilot events through each design.'))),
          h('div.row.wrap', { style: { alignItems: 'stretch', gap: '12px' } },
            h('div.card.grow', null, h('div.kicker', null, `Ingest lag distribution · ${lags.length.toLocaleString('en-IN')} events`), bars({ w: 520, h: 170, bars: hist(lags).map((b, i) => ({ ...b, color: i < 3 ? '#e94fbf' : i < 5 ? '#f2a20c' : '#1f1b1d' })), valueLabels: true })),
            h('div.card', { style: { flex: '0 0 300px' } }, h('div.kicker', null, 'Try it — events in flight'),
              h('p.p.small', null, 'Capture a RED-A (oedema) reading for a child in scope and watch it cross the bridge. Advance the clock with ', h('span.kbd', null, 'H'), ' / ', h('span.kbd', null, 'D'), '.'),
              h('div.row', { style: { gap: '6px', margin: '8px 0' } },
                h('button.btn.sm.hot', { onclick: () => sendTest('RED') }, 'Send RED-A'),
                h('button.btn.sm', { onclick: () => sendTest('AMBER') }, 'Send MAM reading'),
                h('button.btn.sm.ghost', { onclick: () => store.advance(HOUR) }, '+1h')),
              inflight.length ? inflight.map((x) => h('div.row.between', { style: { padding: '4px 0', borderBottom: '1px dashed #bbb', fontFamily: 'var(--font-mono)', fontSize: '11px' } },
                h('span', null, x.event.childId), h('span.tag', null, x.adapter.replace('_', ' ')), h('span', null, `ETA ${fmtDuration(x.receivedAt - store.now)}`)))
                : h('div.small.muted.mono', null, 'nothing in flight'),
              h('div.callout', { style: { marginTop: '8px' } }, h('b', null, 'Fair to workers: '), 'when an event lands after a deadline, the breach is booked to the pipeline, not to the AWW, and the task escalates on arrival.'))),
          h('div.card.dark', null, h('div.kicker', null, 'Integration contract (Phase 2 MoU with MoWCD / NeGD)'),
            h('div.mono.small', { style: { lineHeight: 1.6, marginTop: '4px' } },
              'GET  /poshantracker/v1/growth-events?awc={code}&since={watermark}   (OAuth2 client-credentials via API Setu, read-only scope)', h('br'),
              'POST /poshansetu/v1/hooks/growth-event   ← webhook, HMAC-signed, retried with back-off; idempotency key = sha256(child, t, values)', h('br'),
              'SMS  "PS RA <beneficiary-ref-4> <OED|DNG|MUC>"  → short code 5-digit; no names on the wire', h('br'),
              'CSV  weekly dashboard export → reconciliation job only (never starts or stops a clock)'))));
    }

    function sendTest(kind) {
      const kids = store.children().filter((c) => c.current && Math.floor((store.now - c.dob) / DAY / 30.44) >= 6);
      const c = kids[Math.floor(Math.random() * kids.length)];
      const v = c.eval.lastValid;
      if (!v) return;
      const m = kind === 'RED' ? { weightKg: v.weightKg, heightCm: v.heightCm, lying: v.lying, muacMm: v.muacMm, oedema: true, danger: [] }
        : { weightKg: Math.round((v.weightKg - 0.2) * 10) / 10, heightCm: v.heightCm, lying: v.lying, muacMm: 121, oedema: false, danger: [] };
      store.capture(c.id, m);
      render();
    }

    render();
    ctx.onCleanup(store.on('tick', render));
    ctx.onCleanup(store.on('inflight', render));
    ctx.onCleanup(store.on('role', render));
  },
};
