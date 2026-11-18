import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { lineChart } from '../charts.js';
import { DAY } from '../common.js';

const L = (x) => `Rs ${x >= 100 ? (x / 100).toFixed(2) + ' cr' : x.toFixed(x < 10 ? 1 : 0) + ' L'}`; // input in lakh

const MVP = [
  ['Lead engineer (rules engine, bridge, FHIR) · 6 mo', 7.2],
  ['Developer fellow (UI, IVR flows) · 6 mo', 3.0],
  ['Third-party security & accessibility review', 1.2],
  ['ABDM sandbox certification + test devices', 0.6],
];
const REUSE = [
  ['Beneficiary registry & credentials', 'Sunbird RC (open source)', 'Build: ~Rs 40 L'],
  ['Consent manager & health-data exchange', 'ABDM gateway + HIU/HIP SDKs', 'Build: ~Rs 60 L'],
  ['IVR text-to-speech, Hindi/Santali/Ho/Mundari', 'Bhashini APIs', 'Build: ~Rs 35 L'],
  ['API gateway & OAuth', 'API Setu', 'Build: ~Rs 20 L'],
  ['Hosting (MeitY-empanelled)', 'MeghRaj / NIC cloud', 'Build: n/a'],
  ['SMS / IVR telecom', 'Empanelled CPaaS, pay per use', 'Build: n/a'],
  ['Biometric eKYC', 'UIDAI AUA via state KUA', 'Build: n/a'],
];
const PILOT = [['Development (MVP)', 12, '#1f1b1d'], ['Training (cascade via ICDS)', 9, '#e94fbf'], ['SMS/IVR, cloud, QR cards, MUAC tapes', 3, '#3f7fe0'], ['Independent evaluation', 6, '#f2a20c'], ['Contingency', 3, '#9c8f94']];

export default {
  id: 'budget', title: 'Cost model — MVP vs national capex', icon: ICONS.rupee, dock: 'Budget', desk: 'Budget', size: [1040, 680], key: '5',
  mount(ctx) {
    const sim = store.sim;
    const liveDays = (store.consts.NOW - store.consts.LIVE_FROM) / DAY;
    const tasksPerChildYear = (sim.tasks.length / sim.district.children.length) * (365 / liveDays);
    const P = { ivrMin: 1.5, ivrRate: 0.5, sms: 2, smsRate: 0.15, cloudBase: 2.5, cloudPerChild: 4, scale: 10000 };

    function recurring(children) {
      const telecom = children * tasksPerChildYear * (P.ivrMin * P.ivrRate + P.sms * P.smsRate) / 1e5; // lakh
      const cloud = P.cloudBase * Math.max(1, Math.log10(children / 1000)) + (children * P.cloudPerChild) / 1e5;
      return { telecom, cloud, total: telecom + cloud };
    }
    function render() {
      const pilot = recurring(10000);
      const pts = [1e4, 3e4, 1e5, 3e5, 1e6, 3e6, 1e7, 3e7, 7.3e7].map((n) => [Math.log10(n), (recurring(n).total * 1e5) / n]);
      const at = recurring(P.scale);
      const slider = (label, key, min, max, step, fmt = (v) => v) => h('label.field', null, h('span', null, `${label}: `, h('b', null, fmt(P[key]))), h('input', { type: 'range', min, max, step, value: P[key], oninput: (e) => { P[key] = +e.target.value; render(); } }));
      mount(ctx.body,
        h('div.toolbar', null, h('span.fix', null, 'AUDIT FIX 05'), h('b', null, 'Rs 12 lakh is the pilot MVP — not national DPI.'), h('span.small', null, 'Reuse open building blocks; cost Phase 3 as its own MeitY/NIC capex line.')),
        h('div', { style: { padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '12px' } },
          h('div.card', null, h('div.kicker', null, 'Phase 2 pilot · 250 AWCs · ~10,000 children · Rs 33 L'),
            h('div.row', { style: { gap: 0, height: '30px', border: '2px solid var(--ink)', margin: '10px 0' } }, PILOT.map(([l, v, c]) => h('div', { title: `${l}: Rs ${v} L`, style: { width: (v / 33) * 100 + '%', height: '100%', background: c, borderRight: '1.5px solid var(--ink)' } }))),
            PILOT.map(([l, v, c]) => h('div.row.between', { style: { padding: '3px 0', borderBottom: '1px dashed #bbb' } }, h('span.row', { style: { gap: '6px' } }, h('span', { style: { width: '10px', height: '10px', background: c, border: '1px solid #1f1b1d', display: 'inline-block' } }), l), h('b.mono', null, `Rs ${v} L`))),
            h('div.small.muted', { style: { marginTop: '6px' } }, `Recurring after build ≈ ${L(pilot.total)} / yr (≈ Rs ${Math.round((pilot.total * 1e5) / 10000)} per child) — telecom ${L(pilot.telecom)}, cloud ${L(pilot.cloud)}.`)),
          h('div.card', null, h('div.kicker', null, 'What the Rs 12 L development line actually buys'),
            MVP.map(([l, v]) => h('div.row.between', { style: { padding: '4px 0', borderBottom: '1px dashed #bbb' } }, h('span', null, l), h('b.mono', null, `Rs ${v} L`))),
            h('div.row.between', { style: { padding: '6px 0' } }, h('b', null, 'Total'), h('b.mono', null, `Rs ${MVP.reduce((a, b) => a + b[1], 0).toFixed(1)} L`)),
            h('div.callout', null, h('b', null, 'Scope: '), 'a sandboxed MVP for three blocks — the rules engine, event bridge, IVR flows and supervisor console you are looking at. It is affordable because it does not rebuild registries, consent, speech or gateways.')),
          h('div.card', { style: { gridColumn: '1 / -1' } }, h('div.kicker', null, 'Reuse, not rebuild — open DPI building blocks'),
            h('table.grid', { style: { marginTop: '6px' } }, h('thead', null, h('tr', null, h('th', null, 'Capability'), h('th', null, 'Reused from'), h('th', null, 'If built from scratch'))),
              h('tbody', null, REUSE.map((r) => h('tr', null, r.map((x, i) => h('td', null, i === 1 ? h('b', null, x) : x))))))),
          h('div.card', null, h('div.kicker', null, 'Recurring cost per child vs scale (log x)'),
            lineChart({ w: 470, h: 210, x: { min: 4, max: 7.9, ticks: [4, 5, 6, 7] }, y: { min: 0, max: Math.ceil(pts[0][1] / 10) * 10 + 10 }, xfmt: (v) => ['10k', '1 lakh', '10 lakh', '1 crore'][v - 4], yfmt: (v) => 'Rs ' + v, series: [{ points: pts, dots: true, r: 3, width: 2, color: '#e94fbf' }], vlines: [{ x: Math.log10(P.scale), label: `${(P.scale / 1e5).toFixed(1)} lakh children`, color: '#1f1b1d' }] }),
            h('div.small.muted', null, `Task rate from the simulation: ${tasksPerChildYear.toFixed(2)} tasks per child per year.`)),
          h('div.card', null, h('div.kicker', null, 'Assumptions (move them)'),
            h('div.col', { style: { gap: '6px', marginTop: '6px' } },
              slider('Scale', 'scale', 10000, 73000000, 10000, (v) => (v >= 1e7 ? (v / 1e7).toFixed(1) + ' crore' : (v / 1e5).toFixed(1) + ' lakh') + ' children'),
              slider('IVR minutes per task', 'ivrMin', 0.5, 4, 0.5), slider('IVR Rs/min', 'ivrRate', 0.2, 1.5, 0.05), slider('SMS per task', 'sms', 0, 6, 1), slider('Cloud Rs per child-year', 'cloudPerChild', 1, 12, 0.5)),
            h('div.row', { style: { marginTop: '10px', gap: '8px' } }, h('div.card.flat.grow', null, h('div.stat', null, h('div.v', null, L(at.total)), h('div.l', null, 'recurring / year'))), h('div.card.flat.grow', null, h('div.stat', null, h('div.v', null, `Rs ${((at.total * 1e5) / P.scale).toFixed(1)}`), h('div.l', null, 'per child / year'))))),
          h('div.card.dark', { style: { gridColumn: '1 / -1' } }, h('div.kicker', null, 'Phase 3 — national rollout is a separate capital line (order-of-magnitude, to be costed with NIC / NeGD)'),
            h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '8px' } },
              [['Rs 4–6 cr', 'Native Tracker integration & HA hardening (NIC team, ~18 mo)'], ['Rs 0.6–1 cr', 'CERT-In audit, load tests at 7 crore children'], ['Rs 15 L / language', 'IVR language packs beyond the pilot four'], ['ICDS cascade', 'Training rides existing Poshan Abhiyaan budgets — no new payment']].map(([v, l]) => h('div', null, h('div', { style: { fontWeight: 800, fontSize: '22px', letterSpacing: '-0.03em' } }, v), h('div.small', { style: { color: '#e6d8dd' } }, l)))))));
    }
    render();
  },
};
