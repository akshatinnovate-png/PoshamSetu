import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { open } from '../wm.js';
import { ICONS } from '../icons.js';
import { tierChip, nameOf, ageLabel, dueChip, levelChip, closureDots, statCard, fmtDateTime, fmtDuration } from '../common.js';
import { TIER_RANK } from '../../engine/rulepack.js';
import { ROLES } from '../../engine/access.js';
import { ask } from '../modal.js';

const DO = {
  RED_A: ['आज ही PHC / NRC भेजें', 'Refer to PHC / NRC today — supervisor already told'],
  RED_B: ['72 घंटे में भूख-जाँच (RUTF), दिन 5 तक MO जाँच', 'Appetite test within 72 h; Medical Officer screening by day 5'],
  AMBER: ['7 दिन में सहिया के साथ (या बारी-बारी) घर-भेंट', 'Home visit with the Sahiya — together or one after the other — within 7 days'],
  WATCH: ['14 दिन में दोबारा वज़न और सलाह', 'Re-weigh and counsel within 14 days'],
};
const TCOL = { RED_A: '#c8102e', RED_B: '#f0542d', AMBER: '#f2a20c', WATCH: '#3f7fe0' };

export default {
  id: 'worklist', title: 'Worklist — tasks & deadlines', icon: ICONS.worklist, dock: 'Worklist', size: [940, 600],
  mount(ctx) {
    let tierF = 'ALL', stateF = 'OPEN', q = '', view = null;
    const top = h('div.row.wrap', { style: { padding: '10px', gap: '8px' } });
    const tb = h('div.toolbar');
    const list = h('div', { style: { padding: '0 0 10px' } });
    const foot = h('div.statusbar');
    ctx.body.append(h('div.col', { style: { gap: 0, minHeight: '100%' } }, top, tb, list, foot));
    const seg = (opts, get, set) => h('div.seg', null, opts.map(([k, l]) => h('button', { class: get() === k ? 'on' : '', onclick: () => { set(k); render(); } }, l)));

    function render() {
      const all = store.scopedTasks().map((t) => ({ t, e: store.esc(t), c: store.childById[t.childId] }));
      const open_ = all.filter((x) => x.e.open);
      mount(top,
        statCard(open_.filter((x) => x.t.tier === 'RED_A').length, 'Open RED-A · 24 h', { color: 'var(--red-a)' }),
        statCard(open_.filter((x) => x.t.tier === 'RED_B').length, 'Open RED-B · 72 h', { color: 'var(--red-b)' }),
        statCard(open_.filter((x) => x.t.tier === 'AMBER' && !x.t.queued).length, 'Open AMBER · 7 d'),
        statCard(open_.filter((x) => x.t.queued).length, 'Queued (cap 2/AWC/mo)'),
        statCard(open_.filter((x) => x.e.state === 'PARTIAL').length, 'Half-closed (1 of 2)'),
        statCard(open_.filter((x) => x.e.breached).length, 'Past deadline', { cls: 'dark' }));
      mount(tb,
        seg([['ALL', 'All tiers'], ['RED_A', 'RED-A'], ['RED_B', 'RED-B'], ['AMBER', 'AMBER'], ['WATCH', 'WATCH']], () => tierF, (v) => (tierF = v)),
        seg([['OPEN', 'Open'], ['PARTIAL', 'Half-closed'], ['BREACHED', 'Overdue'], ['QUEUED', 'Queued'], ['DONE', 'Closed'], ['EVERY', 'Every']], () => stateF, (v) => (stateF = v)),
        h('div.seg', null, [['cards', 'Cards'], ['table', 'Table']].map(([k, l]) => h('button', { class: (view ?? (ROLES[store.role].scope === 'awc' ? 'cards' : 'table')) === k ? 'on' : '', onclick: () => { view = k; render(); } }, l))),
        h('button.btn.sm.ghost', { onclick: exportCsv, title: 'Pseudonymous IDs only' }, 'Export CSV'),
        h('input.input', { placeholder: 'search child / AWC / ID', value: q, style: { width: '200px' }, oninput: (e) => { q = e.target.value.toLowerCase(); renderList(); } }));
      renderList();

      function renderList() {
        let rows = all;
        if (tierF !== 'ALL') rows = rows.filter((x) => x.t.tier === tierF);
        if (stateF === 'OPEN') rows = rows.filter((x) => x.e.open);
        if (stateF === 'PARTIAL') rows = rows.filter((x) => x.e.state === 'PARTIAL');
        if (stateF === 'BREACHED') rows = rows.filter((x) => x.e.open && x.e.breached);
        if (stateF === 'QUEUED') rows = rows.filter((x) => x.t.queued && x.e.open);
        if (stateF === 'DONE') rows = rows.filter((x) => !x.e.open);
        if (q) rows = rows.filter((x) => (nameOf(x.c) + x.c.pseudoId + store.awcById[x.c.awcId].name + x.t.id).toLowerCase().includes(q));
        rows.sort((a, b) => (b.e.open - a.e.open) || TIER_RANK[a.t.tier] - TIER_RANK[b.t.tier] || a.t.dueAt - b.t.dueAt);
        if (store.role === 'DPO') {
          const blocks = store.sim.district.blocks.map((b) => { const xs = all.filter((x) => store.awcById[x.t.awcId].blockId === b.id); return { b, open: xs.filter((x) => x.e.open).length, breach: xs.filter((x) => x.e.open && x.e.breached).length, late: xs.filter((x) => x.e.lateArrival).length, partial: xs.filter((x) => x.e.state === 'PARTIAL').length }; });
          mount(list, h('div', { style: { padding: '12px' } }, h('div.callout', null, h('b', null, 'District view — aggregates only (Table 3). '), 'The DPO (ICDS) and CMO see block breach counts, not child-level tasks. Use the Report window for the monthly convergence meeting; child-level access needs logged break-glass.'),
            h('table.grid', { style: { marginTop: '10px' } }, h('thead', null, h('tr', null, ['Block', 'CDPO', 'Open tasks', 'Past deadline', 'Half-closed', 'Late data'].map((x) => h('th', null, x)))),
              h('tbody', null, blocks.map((r) => h('tr', null, h('td', null, h('b', null, r.b.name)), h('td', null, r.b.cdpo), h('td.num', null, r.open), h('td.num', null, h('b', null, r.breach)), h('td.num', null, r.partial), h('td.num', null, r.late))))),
            h('button.btn.sm', { style: { marginTop: '10px' }, onclick: () => open('report') }, 'Open convergence report ▸')));
          foot.textContent = ''; foot.append(h('span', null, 'aggregate view'), h('span', null, `scope: ${store.scopeLabel()}`));
          return;
        }
        const cards = (view ?? (ROLES[store.role].scope === 'awc' ? 'cards' : 'table')) === 'cards';
        if (!store.silentMode && cards && rows.length) {
          mount(list, h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', padding: '12px' } },
            rows.slice(0, 60).map(({ t, e, c }) => {
              const [hi, en] = DO[t.tier] || ['', ''];
              const mine = store.role === 'ASHA' ? 'ASHA' : 'AWW';
              const done = t.closures.some((x) => x.by === mine);
              return h('div', { style: { background: 'var(--white)', border: '2px solid var(--ink)', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' } },
                h('div', { style: { background: TCOL[t.tier], color: t.tier === 'AMBER' ? 'var(--ink)' : '#fff', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--ink)' } },
                  h('b', { style: { fontSize: '16px', letterSpacing: '-0.01em' } }, nameOf(c)), h('span.mono.small', null, ageLabel(t.ageMonths))),
                h('div', { style: { padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 } },
                  h('div', { style: { fontFamily: 'Noto Sans Devanagari, var(--font-display)', fontSize: '15px', fontWeight: 700, lineHeight: 1.3 } }, hi),
                  h('div.small', null, en),
                  h('div.small.muted', null, 'क्यों / why: ', t.reasons[0] || ''),
                  h('div.row', { style: { gap: '6px', flexWrap: 'wrap', marginTop: 'auto' } }, dueChip(t, e), closureDots(t, e))),
                h('div.row', { style: { borderTop: '2px solid var(--ink)', gap: 0 } },
                  h('button', { disabled: done || !e.open, onclick: () => store.close(t, mine === 'ASHA' ? { by: 'ASHA', t: store.now, dtmf: t.tier === 'RED_A' ? 2 : 1, channel: 'IVR' } : { by: 'AWW', t: store.now, outcome: t.tier === 'RED_A' ? 'REFERRED' : 'VISITED', channel: 'APP' }), style: { flex: 1, border: 0, borderRight: '2px solid var(--ink)', padding: '8px', background: done ? 'var(--paper-2)' : 'var(--hot)', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700 } }, done ? '✓ हो गया · done' : t.tier === 'RED_A' ? 'भेजा · referred' : 'मिल आए · visited'),
                  h('button', { onclick: () => open('capture', { childId: c.id }), style: { flex: 1, border: 0, padding: '8px', background: 'var(--white)', fontFamily: 'var(--font-mono)', fontSize: '12px' } }, 'वज़न · weigh'),
                  h('button', { onclick: () => { store.selectChild(c.id); open('child', { childId: c.id }); }, style: { border: 0, borderLeft: '2px solid var(--ink)', padding: '8px 10px', background: 'var(--white)', fontFamily: 'var(--font-mono)', fontSize: '12px' } }, '›')));
            })));
        } else if (store.silentMode) {
          mount(list, h('div.empty', null, h('div.h2', null, 'Silent trial in progress'), h('p.p', null, `${rows.length} alerts logged for lead-time and false-alert measurement — not shown to staff.`)));
        } else if (!rows.length) mount(list, h('div.empty', null, 'Nothing here. ', h('span.kbd', null, 'All clear')));
        else mount(list, h('table.grid', null,
          h('thead', null, h('tr', null, ['Tier', 'Child', 'AWC', 'Why', 'Clock', 'Escalation', 'Closure', 'Flags'].map((x) => h('th', null, x)))),
          h('tbody', null, rows.slice(0, 400).map(({ t, e, c }) => h('tr.click', { onclick: () => { store.selectChild(c.id); open('child', { childId: c.id, taskId: t.id }); } },
            h('td', null, tierChip(t.tier), h('div.small.muted', { style: { marginTop: '3px' } }, t.kind.toLowerCase())),
            h('td', null, h('b', null, nameOf(c)), h('div.small.muted', null, `${c.sex} · ${ageLabel(t.ageMonths)}`)),
            h('td', null, store.awcById[c.awcId].name, h('div.small.muted', null, store.awcById[c.awcId].code)),
            h('td', { style: { maxWidth: '260px' } }, t.reasons[0] || '—', t.reasons.length > 1 ? h('div.small.muted', null, `+${t.reasons.length - 1} more`) : null),
            h('td', null, dueChip(t, e), h('div.small.muted', { style: { marginTop: '3px' } }, `measured ${fmtDateTime(t.measuredAt)}`)),
            h('td', null, levelChip(e.level), e.nextEscalationAt ? h('div.small.muted', { style: { marginTop: '3px' } }, `next ${fmtDuration(e.nextEscalationAt - store.now)}`) : null),
            h('td', null, closureDots(t, e), h('div.small.muted', { style: { marginTop: '3px' } }, e.state.toLowerCase())),
            h('td', null, h('div.row.wrap', { style: { gap: '3px' } },
              t.queued ? h('span.tag.sky', { title: 'Over the 2-per-AWC monthly cap: on the monthly list, escalates at day 10' }, `queued #${t.queueRank}`) : null,
              t.queued && e.open && (store.role === 'MS' || store.role === 'CDPO') ? h('button.btn.sm.ghost', { style: { padding: '0 5px', fontSize: '10px' }, onclick: async (ev) => { ev.stopPropagation(); const r = await ask({ title: 'Promote queued case', label: 'Supervisor override of the visit cap. Reason (logged):', value: 'Youngest child, second fall this season', ok: 'Promote & log' }); if (!r) return; t.queued = false; t.dueAt = t.measuredAt + store.pack.jointVisit.windowDays * 86400000; t.required = ['AWW', 'ASHA']; store.audit.append({ at: store.now, actor: store.actorName(), role: store.role, action: 'CAP_OVERRIDE', subject: t.id, detail: r }); store.emit('task', t); } }, 'promote') : null,
              e.lateArrival ? h('span.tag.bad', { title: 'Event reached PoshanSetu after a deadline had passed — pipeline breach, not worker breach' }, 'late arrival') : null,
              t.remeasureFirst ? h('span.tag.warn', { title: 'Feed reliability below cutoff — re-measure before acting' }, 're-measure first') : null,
              t.toPHC ? h('span.tag', null, '→ PHC') : null,
              t.route === 'SSBSK' ? h('span.tag.pink', { title: 'Under 36 months: joins the SSBSK at-risk home-visit list (ASHA / ANM / CHO / AWW team)' }, 'SSBSK list') : t.route === 'JOINT' ? h('span.tag.pink', { title: '36–59 months: AWW + ASHA visit, together or in sequence' }, 'joint visit') : null,
              h('span.tag', { title: 'Rule pack version' }, 'v' + t.packVersion))))))));
        foot.textContent = '';
        foot.append(h('span', null, `${rows.length} tasks`), h('span', null, `scope: ${store.scopeLabel()}`), h('span', null, `clock: event time (measurement), not ingestion time`));
      }
    }
    function exportCsv() {
      const rows = store.scopedTasks().map((t) => ({ t, e: store.esc(t), c: store.childById[t.childId] }));
      const head = ['task_id', 'beneficiary_ref', 'awc_code', 'tier', 'kind', 'measured_at', 'ingested_at', 'due_at', 'state', 'escalation_level', 'late_arrival', 'queued', 'pack_version', 'reason'];
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [head.join(','), ...rows.map(({ t, e, c }) => [t.id, c.pseudoId, c.awcCode, t.tier, t.kind, new Date(t.measuredAt).toISOString(), new Date(t.ingestedAt).toISOString(), new Date(t.dueAt).toISOString(), e.state, e.level, e.lateArrival, !!t.queued, t.packVersion, t.reasons[0]].map(esc).join(','))].join('\n');
      const name = `poshansetu-tasks-${store.scope}-${new Date(store.now).toISOString().slice(0, 10)}.csv`;
      store.audit.append({ at: store.now, actor: store.actorName(), role: store.role, action: 'EXPORT', subject: store.scope, detail: `${rows.length} tasks, pseudonymous` });
      if (window.psNative?.saveFile) window.psNative.saveFile(name, csv);
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click(); }
    }
    render();
    ctx.onCleanup(store.on('tick', render));
    ctx.onCleanup(store.on('role', render));
    ctx.onCleanup(store.on('task', render));
    ctx.onCleanup(store.on('ingested', render));
    ctx.onCleanup(store.on('mode', render));
    ctx.setRefresh(render);
  },
};
