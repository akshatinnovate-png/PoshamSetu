// Monthly convergence report for the DPO (ICDS) + CMO meeting — the L3 artefact of Table 3.
// Aggregate only, small cells suppressed; prints to PDF.
import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { fmtDate, DAY, pct } from '../common.js';
import { kAnon } from '../../engine/access.js';
import { consentStatus } from '../../engine/consent.js';
import { TIER_LABEL } from '../../engine/rulepack.js';

export default {
  id: 'report', title: 'Convergence report — monthly (L3)', icon: ICONS.log, dock: 'Report', desk: 'Report', size: [900, 700], key: 'p',
  mount(ctx) {
    function render() {
      const d = store.sim.district, k = store.pack.privacy.kAnonMin;
      const from = store.now - 30 * DAY;
      const K = (n) => kAnon(n, 'DPO', k);
      const rows = d.blocks.map((b) => {
        const tasks = store.tasks.filter((t) => store.awcById[t.awcId].blockId === b.id && t.ingestedAt <= store.now && t.measuredAt >= from);
        const es = tasks.map((t) => ({ t, e: store.esc(t) }));
        const kids = d.children.filter((c) => store.awcById[c.awcId].blockId === b.id);
        const awcs = d.awcs.filter((a) => a.blockId === b.id);
        return {
          b, n: kids.length,
          tiers: ['RED_A', 'RED_B', 'AMBER'].map((tr) => tasks.filter((t) => t.tier === tr).length),
          breach: es.filter((x) => x.e.breached).length,
          late: es.filter((x) => x.e.lateArrival).length,
          partial: es.filter((x) => x.e.state === 'PARTIAL').length,
          conflict: es.filter((x) => x.e.state === 'CONFLICT').length,
          onTime: es.length ? es.filter((x) => !x.e.breached && !x.e.open).length / es.length : null,
          lowR: awcs.filter((a) => store.sim.feeds[a.id].R < store.pack.reliability.cutoff).length, awcs: awcs.length,
          migr: kids.filter((c) => c.migration && c.migration.depAt >= from - 60 * DAY && c.migration.depAt < store.now).length,
          consent: kids.filter((c) => consentStatus(c.consent, store.now).usable).length / kids.length,
        };
      });
      const sheet = h('div.print-area', { style: { background: '#fff', color: '#1f1b1d', padding: '28px 34px', maxWidth: '820px', margin: '0 auto', border: '2px solid var(--ink)', fontSize: '12.5px' } },
        h('div.row.between', { style: { borderBottom: '3px solid var(--ink)', paddingBottom: '8px' } },
          h('div', null, h('div.kicker', null, 'District convergence meeting · ICDS + Health'), h('div', { style: { fontWeight: 800, fontSize: '26px', letterSpacing: '-0.03em' } }, 'Paschimi Singhbhum — PoshanSetu monthly')),
          h('div.mono.small', { style: { textAlign: 'right' } }, `${fmtDate(from)} – ${fmtDate(store.now)}`, h('br'), `rule pack ${store.pack.version}`, h('br'), 'synthetic data')),
        h('p.p', { style: { margin: '10px 0' } }, `Aggregate view for the DPO (ICDS) and CMO. Child counts below ${k} are shown as "<${k}". Breach counts describe the system, not children, and are exact. The Collector reviews this monthly; the Programme Officer acts on any breach.`),
        h('table.grid', { style: { fontSize: '10.5px' } },
          h('thead', null, h('tr', null, ['Block', 'Children', 'RED-A', 'RED-B', 'AMBER', 'Past deadline', 'Late data', 'Half-closed', 'Conflicts', 'On-time closure', 'AWCs R<85', 'Departures', 'Consent'].map((x) => h('th', null, x)))),
          h('tbody', null, rows.map((r) => h('tr', null, h('td', null, h('b', null, r.b.name)), h('td.num', null, K(r.n)), ...r.tiers.map((n) => h('td.num', null, K(n))), h('td.num', null, h('b', null, r.breach)), h('td.num', null, r.late), h('td.num', null, r.partial), h('td.num', null, r.conflict), h('td.num', null, pct(r.onTime)), h('td.num', null, `${r.lowR}/${r.awcs}`), h('td.num', null, K(r.migr)), h('td.num', null, pct(r.consent)))))),
        h('div', { style: { marginTop: '14px' } }, h('div.kicker', null, 'Decisions for this meeting'),
          h('ol', { style: { margin: '6px 0 0 18px', padding: 0, lineHeight: 1.6 } },
            rows.filter((r) => r.breach).map((r) => h('li', null, `${r.b.name}: ${r.breach} task(s) past deadline — CDPO ${r.b.cdpo} and BMO ${r.b.bmo} to report actions by next week.`)),
            rows.filter((r) => r.lowR).map((r) => h('li', null, `${r.b.name}: ${r.lowR} AWC feed(s) below R ${store.pack.reliability.cutoff} — supportive supervision visit and scale check (not a penalty).`)),
            rows.some((r) => r.late) ? h('li', null, 'Late-arriving data: raise with NeGD / API Setu team (pipeline breach, not worker breach).') : null,
            h('li', null, `Pre-season migration notice: share route counts with destination CDPOs (k ≥ ${k}).`))),
        h('div.row.between', { style: { marginTop: '18px', borderTop: '1.5px dashed var(--ink)', paddingTop: '8px' } },
          h('div.mono.small', null, `generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · audit head ${store.audit.head.slice(0, 16)}`),
          h('div.mono.small', null, 'DPO (ICDS) ________   CMO ________')));
      mount(ctx.body,
        h('div.toolbar', null, h('b', null, 'L3 artefact of Table 3.'), h('span.small', null, 'Aggregate, k-anonymous, printable.'), h('div.grow'),
          h('button.btn.sm.hot', { onclick: () => { store.log({ at: store.now, actor: store.actorName(), role: store.role, action: 'REPORT_PRINT', subject: 'DISTRICT' }); if (window.psNative?.printPDF) window.psNative.printPDF(`PoshanSetu-convergence-${new Date(store.now).toISOString().slice(0, 7)}.pdf`); else window.print(); } }, 'Print / save PDF')),
        h('div', { style: { padding: '16px', background: 'var(--paper-2)' } }, sheet));
    }
    render();
    ctx.onCleanup(store.on('tick', render));
  },
};
