import { h, mount, s } from '../dom.js';
import { store } from '../store.js';
import { open } from '../wm.js';
import { ICONS } from '../icons.js';
import { lineChart } from '../charts.js';
import { tierChip, nameOf, canSeeNames, ageLabel, ageAt, dueChip, levelChip, closureDots, fmtDate, fmtDateTime, fmtDuration, section, DAY } from '../common.js';
import { wfaCurve } from '../../engine/growth.js';
import { consentStatus, FLAG_DICTIONARY } from '../../engine/consent.js';
import { ROLES } from '../../engine/access.js';
import { ADAPTERS } from '../../engine/bridge.js';
import { ask } from '../modal.js';

const TIER_COLOR = { RED_A: '#c8102e', RED_B: '#f0542d', AMBER: '#f2a20c', WATCH: '#3f7fe0', GREEN: '#1f9d6b' };

export default {
  id: 'child', title: 'Child record', icon: ICONS.child, dock: 'Child', size: [1000, 680],
  mount(ctx, opts) {
    let childId = opts.childId || store.selectedChildId || store.children().find((c) => c.current && c.current.tier === 'AMBER')?.id;
    let tab = 'growth';
    function render() {
      const c = store.childById[childId];
      if (!c) { mount(ctx.body, h('div.empty', null, 'Pick a child from the Worklist or District map.')); return; }
      if (!store.inScope(c)) { mount(ctx.body, h('div.empty', null, `Outside your scope (${store.scopeLabel()}). Decision rights: Table 3.`)); return; }
      if (store.role === 'DPO' && !store.breakGlass.has(c.id)) {
        mount(ctx.body, h('div.empty', null, h('div.h2', null, 'District officers see aggregates, not child records.'), h('p.p', { style: { margin: '8px auto', maxWidth: '460px' } }, 'Table 3: the DPO (ICDS) and CMO act on block breach counts. A child-level record opens only through break-glass, with a reason that is written to the audit chain and reviewed.'),
          h('button.btn.hot', { onclick: async () => { const r = await ask({ title: 'Break-glass access', label: 'Reason for opening a child-level record at district level (logged):', value: 'RED-A escalated to L3 — verifying referral', ok: 'Open & log' }); if (r) store.grantBreakGlass(c.id, r); } }, 'Break-glass (logged)')));
        return;
      }
      ctx.setTitle(`Child record — ${nameOf(c)}`);
      const ev = c.eval, cur = c.current, awc = store.awcById[c.awcId];
      const cs = consentStatus(c.consent, store.now);
      const ageNow = ageAt(c, store.now);
      const tasks = store.tasks.filter((t) => t.childId === c.id);

      const head = h('div.row', { style: { padding: '12px 14px', background: 'var(--white)', borderBottom: '2px solid var(--ink)', gap: '16px', alignItems: 'flex-start' } },
        h('div.col.grow', { style: { gap: '4px' } },
          h('div.row', { style: { gap: '10px' } }, h('h1.h1', null, nameOf(c)), cur ? tierChip(cur.tier) : null, cur && cur.kind !== 'NONE' ? h('span.tag', null, cur.kind.toLowerCase()) : null),
          h('div.row.wrap', { style: { gap: '6px' } },
            h('span.tag.dark', null, c.pseudoId), h('span.tag', null, c.sex === 'F' ? 'girl' : 'boy'), h('span.tag', null, ageLabel(ageNow)),
            h('span.tag', null, `AWC ${awc.name} · ${awc.code}`), c.st ? h('span.tag.pink', null, 'ST household') : null,
            c.lbw ? h('span.tag.warn', null, 'LBW (RCH flag)') : null,
            c.migration ? h('span.tag.sky', null, `migrates · ${c.migration.destination.label}`) : null,
            h('span.tag' + (cs.usable ? '.ok' : '.bad'), { title: cs.why }, `consent: ${cs.state.toLowerCase()}${c.consent ? ' · ' + c.consent.mode : ''}`)),
          !canSeeNames(c) ? h('div.row', { style: { gap: '8px', marginTop: '4px' } }, h('span.small.muted', null, `Name masked for ${ROLES[store.role].label}.`),
            h('button.btn.sm.ghost', { onclick: async () => { const r = await ask({ title: 'Break-glass access', label: 'State why you need this child\'s identity. The reason is written to the hash-chained audit log and shown in the weekly review.', value: 'RED-A follow-up — AWW unreachable by phone', ok: 'Unmask & log' }); if (r) store.grantBreakGlass(c.id, r); } }, 'Break-glass (logged)')) : null),
        h('div.col', { style: { gap: '6px', alignItems: 'flex-end' } },
          h('div.row', { style: { gap: '6px' } },
            h('button.btn.sm', { onclick: () => open('capture', { childId: c.id }) }, '+ Measurement'),
            h('button.btn.sm.ghost', { onclick: () => open('migration', { childId: c.id }) }, 'Transfer token'),
            h('button.btn.sm.ghost', { onclick: () => open('consent', { childId: c.id }) }, 'Consent · FHIR')),
          h('div.small.muted.mono', null, `rule pack ${store.pack.id}@${cur?.packVersion || store.pack.version}`)));

      const why = h('div.card', { style: { flex: '0 0 300px' } },
        h('div.kicker', null, 'Why this tier — every alert shows its reason'),
        cur ? h('div', null,
          cur.reasons.length ? cur.reasons.map((r) => h('div.reason', null, tierChip(r.tier), h('div', null, r.text), h('div.rule', null, `${r.rule}${r.consentId ? ' · consent ' + r.consentId : ''}`))) : h('p.p', null, 'No rule fired at the last visit — on track.'),
          cur.remeasure ? h('div.callout', { style: { marginTop: '8px' } }, h('b', null, 'Re-measure requested. '), cur.remeasureFirst ? `AWC feed reliability R=${store.sim.feeds[c.awcId].R} is below ${store.pack.reliability.cutoff}: re-weigh before acting.` : 'Confirmation needed before the tier escalates.') : null,
          cur.toPHC ? h('div.callout', { style: { marginTop: '8px' } }, h('b', null, 'Under 6 months. '), 'MUAC not used; weight-for-length + feeding check; flags route to the PHC.') : null)
          : h('p.p', null, 'No measurements yet.'));

      const tabs = h('div.seg', null, [['growth', 'Growth'], ['visits', `Visits (${ev.visits.length})`], ['signals', 'Health signals'], ['tasks', `Tasks (${tasks.length})`]].map(([k, l]) => h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; render(); } }, l)));
      let pane;
      if (tab === 'growth') pane = growthPane(c, ev);
      else if (tab === 'visits') pane = visitsPane(c, ev);
      else if (tab === 'signals') pane = signalsPane(c);
      else pane = tasksPane(c, tasks);

      mount(ctx.body, head, h('div.row', { style: { padding: '12px 14px', gap: '12px', alignItems: 'flex-start' } },
        h('div.col.grow', { style: { gap: '10px' } }, tabs, pane), why));
    }

    function growthPane(c, ev) {
      const vs = ev.visits;
      if (!vs.length) return h('div.empty', null, 'No visits');
      const res = ev.results;
      const ages = vs.map((v) => v.ageMonths);
      const amin = Math.max(0, Math.floor(Math.min(...ages)) - 1), amax = Math.min(60, Math.ceil(Math.max(...ages, amin + 10)) + 1);
      const curves = [0, -1, -2, -3].map((z) => wfaCurve(c.sex, z, amin, amax, 0.5));
      const allW = vs.filter((v) => !v.biv.length).map((v) => v.weightKg);
      const ymin = Math.max(1, Math.floor(Math.min(...curves[3].map((p) => p[1]), ...allW) - 0.5)), ymax = Math.ceil(Math.max(...curves[0].map((p) => p[1]), ...allW) + 0.5);
      const wfa = lineChart({
        w: 620, h: 250, x: { min: amin, max: amax }, y: { min: ymin, max: ymax }, xfmt: (v) => v + 'm', yfmt: (v) => v + '', xlabel: 'age (months)', ylabel: 'weight (kg)',
        series: [
          { points: curves[0], color: '#1f9d6b', width: 1.4, label: 'median' },
          { points: curves[1], color: '#9c8f94', width: 1, dash: '3 3', label: '−1' },
          { points: curves[2], color: '#f2a20c', width: 1.4, label: '−2 SD' },
          { points: curves[3], color: '#c8102e', width: 1.4, label: '−3 SD' },
          { points: vs.map((v, i) => [v.ageMonths, v.biv.length ? null : v.weightKg, { fill: TIER_COLOR[res[i].tier], title: `${fmtDate(v.t)} · ${v.weightKg} kg · ${res[i].tier}` }]), color: '#1f1b1d', width: 2, dots: true, r: 4.5 },
        ],
      });
      const t0 = vs[0].t, t1 = Math.max(vs[vs.length - 1].t, store.now);
      const whzPts = vs.map((v, i) => [v.t, v.ix.whz, { fill: TIER_COLOR[res[i].tier], title: `${fmtDate(v.t)} · WHZ ${v.ix.whz}${v.remeasure ? ' (re-weigh)' : ''}` }]).filter((p) => p[1] != null && !Number.isNaN(p[1]));
      const months = []; for (let t = t0; t <= t1; t += 61 * DAY) months.push(t);
      const whz = lineChart({
        w: 620, h: 190, x: { min: t0 - 5 * DAY, max: t1 + 5 * DAY, ticks: months }, y: { min: -5, max: 2, ticks: [-5, -4, -3, -2, -1, 0, 1, 2] },
        xfmt: (t) => new Date(t).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), yfmt: (v) => v,
        bands: [{ y0: -5, y1: -3, fill: '#ffd3da', label: 'SAM' }, { y0: -3, y1: -2, fill: '#ffeac2', label: 'MAM' }],
        vlines: [{ x: store.now, label: 'now', color: '#e94fbf' }],
        ylabel: 'WHZ',
        series: [{ points: whzPts, color: '#1f1b1d', width: 2, dots: true, r: 4 }],
      });
      const mu = vs.filter((v) => v.muacMm != null && v.ageMonths >= 6);
      const muac = mu.length ? lineChart({
        w: 620, h: 150, x: { min: t0 - 5 * DAY, max: t1 + 5 * DAY, ticks: months }, y: { min: 100, max: 160, ticks: [100, 115, 125, 140, 160] },
        xfmt: (t) => new Date(t).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), yfmt: (v) => v,
        bands: [{ y0: 100, y1: 115, fill: '#ffd3da', label: '< 115 mm' }, { y0: 115, y1: 125, fill: '#ffeac2', label: '115–125' }],
        ylabel: 'MUAC mm',
        series: [{ points: mu.map((v) => [v.t, v.muacMm, { title: `${fmtDate(v.t)} · ${v.muacMm} mm` }]), color: '#1f1b1d', width: 2, dots: true, r: 3.5 }],
      }) : h('div.small.muted', null, 'No MUAC (under 6 months or not recorded).');
      return h('div.col', { style: { gap: '10px' } },
        h('div.card.flat', null, h('div.kicker', null, 'Weight-for-age · WHO Child Growth Standards (dots coloured by tier at that visit)'), wfa),
        h('div.card.flat', null, h('div.kicker', null, 'Weight-for-height z-score trajectory — direction, not just the line'), whz),
        h('div.card.flat', null, h('div.kicker', null, 'MUAC (6–59 months)'), muac));
    }

    function visitsPane(c, ev) {
      return h('div.card.flat', { style: { padding: 0, overflow: 'auto', maxHeight: '520px' } }, h('table.grid', null,
        h('thead', null, h('tr', null, ['Measured', 'Age', 'Wt kg', 'Ht cm', 'MUAC', 'WAZ', 'WHZ', 'Tier', 'Arrived via', 'Flags'].map((x) => h('th', null, x)))),
        h('tbody', null, ev.visits.slice().reverse().map((v, ri) => {
          const i = ev.visits.length - 1 - ri;
          const r = ev.results[i];
          const evs = c.events.filter((e) => v.eventIds.includes(e.id));
          const ad = evs[evs.length - 1]?.adapter;
          const lag = evs[evs.length - 1]?.receivedAt ? evs[evs.length - 1].receivedAt - v.t : null;
          return h('tr', null,
            h('td', null, fmtDateTime(v.t), v.remeasure ? h('div', null, h('span.tag.sky', null, 're-weigh')) : null),
            h('td', null, ageLabel(v.ageMonths)), h('td.num', null, v.weightKg), h('td.num', null, v.heightCm), h('td.num', null, v.muacMm ?? '—'),
            h('td.num', null, v.ix.waz ?? '—'), h('td.num', null, v.ix.whz ?? '—'),
            h('td', null, tierChip(r.tier)),
            h('td', null, ad ? h('span', null, ADAPTERS[ad]?.id.replace('_', ' ').toLowerCase(), h('div.small.muted', null, lag != null ? `+${fmtDuration(lag)}` : '')) : h('span.muted', null, 'history')),
            h('td', null, v.dq.map((d) => h('div', null, h('span.tag.bad', { title: d.text }, d.code.toLowerCase())))));
        }))));
    }

    function signalsPane(c) {
      const cs = consentStatus(c.consent, store.now);
      return h('div.col', null,
        h('div.callout', null, h('b', null, 'Share flags, not records. '), 'Only minimal flags from MoHFW systems reach the rules, and only under an active ABDM consent artefact. Withheld flags are shown here (with why) but never used.'),
        h('div.row', { style: { alignItems: 'flex-start' } },
          h('div.card.flat.grow', null, h('div.kicker', null, `Used by the rules (${c.signals.length})`),
            c.signals.length ? c.signals.slice().reverse().map((sg) => h('div.reason', null, h('span.tag.ok', null, sg.type.toLowerCase()), h('div', null, FLAG_DICTIONARY[sg.type]?.label, sg.antigen ? ` · ${sg.antigen}` : ''), h('div.rule', null, `${fmtDate(sg.t)} · ${sg.source} · ${sg.consentId}`))) : h('p.p.muted', null, 'None.')),
          h('div.card.flat.grow', null, h('div.kicker', null, `Withheld (${c.signalsWithheld.length})`),
            c.signalsWithheld.length ? c.signalsWithheld.slice().reverse().map((sg) => h('div.reason', null, h('span.tag.bad', null, sg.type.toLowerCase()), h('div', null, FLAG_DICTIONARY[sg.type]?.label), h('div.rule', null, `${fmtDate(sg.t)} · ${sg.why}`))) : h('p.p.muted', null, 'None — consent covers all flags.'))),
        h('div.small.muted', null, `Consent: ${cs.state} — ${cs.why}`));
    }

    function tasksPane(c, tasks) {
      if (!tasks.length) return h('div.empty', null, 'No tasks during the live period.');
      return h('div.col', null, tasks.map((t) => {
        const e = store.esc(t);
        return h('div.card.flat', null,
          h('div.row.between', null, h('div.row', null, tierChip(t.tier), h('b.mono', null, t.id), levelChip(e.level), dueChip(t, e)), closureDots(t, e)),
          h('div.p', { style: { marginTop: '6px' } }, t.reasons.join(' · ')),
          h('div.small.muted.mono', { style: { marginTop: '4px' } }, `measured ${fmtDateTime(t.measuredAt)} · ingested ${fmtDateTime(t.ingestedAt)} (+${fmtDuration(t.ingestedAt - t.measuredAt)}) · state ${e.state}`),
          t.closures.length ? h('div.small.mono', { style: { marginTop: '4px' } }, t.closures.map((cl) => `${cl.by} ${cl.outcome} via ${cl.channel}${cl.dtmf ? ' [key ' + cl.dtmf + ']' : ''} @ ${fmtDateTime(cl.t)}`).join('  ·  ')) : null,
          h('div.row', { style: { marginTop: '6px', gap: '6px' } }, h('button.btn.sm.ghost', { onclick: () => open('joint', { taskId: t.id }) }, 'Open in Joint-visit desk')));
      }));
    }

    render();
    ctx.setRefresh((o) => { if (o?.childId) childId = o.childId; render(); });
    ctx.onCleanup(store.on('child', (id) => { childId = id; render(); }));
    ctx.onCleanup(store.on('role', render));
    ctx.onCleanup(store.on('tick', () => { if (tab === 'tasks') render(); }));
    ctx.onCleanup(store.on('ingested', ({ child }) => { if (child.id === childId) render(); }));
    ctx.onCleanup(store.on('task', render));
  },
};
