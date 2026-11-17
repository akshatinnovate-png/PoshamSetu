// Phase 1 tool: run the engine on an anonymised export (CSV) — locally, nothing leaves the machine.
// Columns: beneficiary_ref, sex (M/F), dob (YYYY-MM-DD), awc_code, measured_at (ISO), weight_kg, height_cm, muac_mm, oedema (0/1)
import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { bars } from '../charts.js';
import { tierChip, pct, statCard } from '../common.js';
import { COLS, parseCsv, analyseRows } from '../../engine/importcsv.js';

export default {
  id: 'importer', title: 'Import — run on your own data (Phase 1)', icon: ICONS.capture, dock: 'Import', desk: 'Import data', size: [980, 680], key: 'i',
  mount(ctx) {
    let out = null, name = '';
    function template() {
      const kids = store.sim.district.children.filter((c) => store.sim.district.awcs.slice(0, 3).some((a) => a.id === c.awcId));
      const lines = [COLS.join(',')];
      for (const c of kids) for (const e of c.events) lines.push([c.pseudoId, c.sex, new Date(c.dob).toISOString().slice(0, 10), c.awcCode, new Date(e.t).toISOString(), e.weightKg, e.heightCm, e.muacMm ?? '', e.oedema ? 1 : 0].join(','));
      const csv = lines.join('\n');
      if (window.psNative?.saveFile) window.psNative.saveFile('poshansetu-import-template.csv', csv);
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'poshansetu-import-template.csv'; a.click(); }
    }
    function run(text, n) {
      name = n;
      out = analyseRows(parseCsv(text), store.pack);
      store.audit.append({ at: store.now, actor: store.actorName(), role: store.role, action: 'IMPORT_LOCAL', subject: n, detail: out.error || `${out.children} children, processed locally` });
      render();
    }
    function render() {
      const file = h('input', { type: 'file', accept: '.csv,text/csv', onchange: async (e) => { const f = e.target.files[0]; if (f) run(await f.text(), f.name); } });
      let body;
      if (!out) body = h('div.col', { style: { gap: '10px' } },
        h('div.callout', null, h('b', null, 'Phase 1, made concrete. '), 'Load an anonymised export (State agreement or NGO data). The same signed rules run on this machine; nothing is uploaded. You get tiers, data reliability per AWC, and how often trend rules fire before a single-reading list would.'),
        h('div.card', null, h('div.kicker', null, 'Expected columns'), h('div.mono.small', { style: { marginTop: '4px' } }, COLS.join(' · ')), h('div.small.muted', { style: { marginTop: '4px' } }, 'One row per measurement. muac_mm and oedema are optional. Dates ISO (YYYY-MM-DD or full timestamp).')),
        h('div.row', { style: { gap: '8px' } }, h('button.btn.ghost', { onclick: template }, 'Download a template (synthetic, 3 AWCs)'), h('button.btn', { onclick: () => { const kids = store.sim.district.children.slice(0, 120); const lines = [COLS.join(',')]; for (const c of kids) for (const e of c.events) lines.push([c.pseudoId, c.sex, new Date(c.dob).toISOString().slice(0, 10), c.awcCode, new Date(e.t).toISOString(), e.weightKg, e.heightCm, e.muacMm ?? '', e.oedema ? 1 : 0].join(',')); run(lines.join('\n'), 'synthetic-sample.csv'); } }, 'Try with a synthetic sample')));
      else if (out.error) body = h('div.callout', { style: { borderColor: 'var(--red-a)' } }, h('b', null, 'Could not read the file. '), out.error);
      else body = h('div.col', { style: { gap: '12px' } },
        h('div.row.wrap', { style: { gap: '10px' } },
          statCard(out.children.toLocaleString('en-IN'), `children · ${out.events.toLocaleString('en-IN')} measurements`),
          statCard(out.samKids ? pct(out.earlier / out.samKids) : '—', `of ${out.samKids} reaching a SAM list had AMBER first`, { cls: 'pinkc' }),
          statCard(out.leadMedian != null ? `${Math.round(out.leadMedian)} d` : '—', 'median lead before SAM list', { cls: 'pinkc' }),
          statCard(out.strictKids ? pct(out.strictEarlier / out.strictKids) : '—', 'AMBER before ANY single-reading listing', { cls: 'dark' })),
        h('div.row', { style: { gap: '12px', alignItems: 'stretch', flexWrap: 'wrap' } },
          h('div.card', { style: { flex: '1 1 300px' } }, h('div.kicker', null, 'Current tier distribution'), bars({ w: 360, h: 160, bars: Object.entries(out.tiers).map(([t, n]) => ({ label: t.replace('_', '-'), value: n, color: { RED_A: '#c8102e', RED_B: '#f0542d', AMBER: '#f2a20c', WATCH: '#3f7fe0', GREEN: '#1f9d6b' }[t] })), valueLabels: true })),
          h('div.card', { style: { flex: '1 1 360px', maxHeight: '260px', overflow: 'auto' } }, h('div.kicker', null, 'Data reliability by AWC (lowest first)'),
            h('table.grid', null, h('thead', null, h('tr', null, ['AWC', 'R', 'B', 'F', 'D', 'flags'].map((x) => h('th', null, x)))),
              h('tbody', null, out.feeds.map((f) => h('tr', null, h('td.mono', null, f.awc), h('td.num', null, h('b', { style: { color: f.belowCutoff ? 'var(--red-a)' : '' } }, f.R)), h('td.num', null, (f.B * 100).toFixed(1) + '%'), h('td.num', null, (f.F * 100).toFixed(0) + '%'), h('td.num', null, f.D.toFixed(2)), h('td.small', null, f.flags.map((x) => x.code.toLowerCase()).join(', ')))))))),
        out.problems.length ? h('div.callout', null, `${out.problems.length} row(s) skipped: ${out.problems.slice(0, 3).join('; ')}${out.problems.length > 3 ? '…' : ''}`) : null,
        h('div.small.muted', null, 'Without ground truth, precision cannot be computed here; Phase 1 checks alerts against re-weighing at the AWC. Rule pack ' + store.pack.version + '.'));
      mount(ctx.body, h('div.toolbar', null, h('b', null, name || 'No file loaded'), h('div.grow'), file, out ? h('button.btn.sm.ghost', { onclick: () => { out = null; name = ''; render(); } }, 'Clear') : null), h('div', { style: { padding: '12px' } }, body));
    }
    render();
  },
};
