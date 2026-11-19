// Phase 1 tool: run the engine on an anonymised export (CSV) — locally, nothing leaves the machine.
// Columns: beneficiary_ref, sex (M/F), dob (YYYY-MM-DD), awc_code, measured_at (ISO), weight_kg, height_cm, muac_mm, oedema (0/1)
import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { bars } from '../charts.js';
import { tierChip, pct, statCard } from '../common.js';
import { COLS, parseCsv, analyseRows, isSmartSurvey, smartReport } from '../../engine/importcsv.js';

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
      const rows = parseCsv(text);
      out = isSmartSurvey(rows) ? smartReport(rows, store.pack) : analyseRows(rows, store.pack);
      store.log({ at: store.now, actor: store.actorName(), role: store.role, action: 'IMPORT_LOCAL', subject: n, detail: out.error || `${out.children} children, processed locally` });
      render();
    }
    async function loadReal(f) { const t = await (await fetch(new URL('../../data/real/' + f, import.meta.url))).text(); run(t, f + ' (real survey, nipnTK)'); }
    function surveyView(o) {
      const g = { excellent: 'ok', good: 'ok', acceptable: 'warn', check: 'warn', problematic: 'bad' };
      return h('div.col', { style: { gap: '12px' } },
        h('div.row.wrap', { style: { gap: '10px' } },
          statCard(o.n, 'children measured (real)'),
          statCard(pct(o.wasting, 1), 'wasting WHZ < −2'),
          statCard(pct(o.sam, 1), 'severe WHZ < −3'),
          statCard(o.meanWhz.toFixed(2), 'mean WHZ', { cls: 'dark' })),
        h('div.row', { style: { gap: '12px', alignItems: 'stretch', flexWrap: 'wrap' } },
          h('div.card', { style: { flex: '1 1 380px' } }, h('div.kicker', null, 'Data-quality checks (SMART plausibility style) — PoshanSetu engine'),
            h('table.grid', { style: { marginTop: '6px' } }, h('tbody', null, o.checks.map(([k, v, gr]) => h('tr', null, h('td', null, k), h('td.num', null, h('b', null, v)), h('td', null, h('span.tag.' + (g[gr] || 'warn'), null, gr))))))),
          h('div.card', { style: { flex: '1 1 300px' } }, h('div.kicker', null, 'If these children were on the Tracker today (single reading)'),
            bars({ w: 340, h: 160, bars: Object.entries(o.tiers).map(([t, n]) => ({ label: t.replace('_', '-'), value: n, color: { RED_A: '#c8102e', RED_B: '#f0542d', AMBER: '#f2a20c', GREEN: '#1f9d6b' }[t] })), valueLabels: true }),
            h('div.small.muted', null, 'Cross-sectional data can only be triaged from one reading; the trend rules need repeat visits — exactly the gap PoshanSetu closes.'))),
        h('div.callout', null, h('b', null, 'Validation on these surveys: '), 'WAZ and HAZ from the PoshanSetu engine match the survey software exactly (100% of children); WHZ matches for ~94%, the rest differing only where the measurement position (lying / standing) is not recorded. See test/zscore-validation.test.js and scripts/validate-zscores.mjs.'));
    }
    function render() {
      const file = h('input', { type: 'file', accept: '.csv,text/csv', onchange: async (e) => { const f = e.target.files[0]; if (f) run(await f.text(), f.name); } });
      let body;
      if (!out) body = h('div.col', { style: { gap: '10px' } },
        h('div.callout', null, h('b', null, 'Phase 1, made concrete. '), 'Load an anonymised export (State agreement or NGO data). The same signed rules run on this machine; nothing is uploaded. You get tiers, data reliability per AWC, and how often trend rules fire before a single-reading list would.'),
        h('div.card', null, h('div.kicker', null, 'Expected columns'), h('div.mono.small', { style: { marginTop: '4px' } }, COLS.join(' · ')), h('div.small.muted', { style: { marginTop: '4px' } }, 'One row per measurement. muac_mm and oedema are optional. Dates ISO (YYYY-MM-DD or full timestamp).')),
        h('div.row', { style: { gap: '8px' } }, h('button.btn.ghost', { onclick: template }, 'Download a template (synthetic, 3 AWCs)'), h('button.btn', { onclick: () => { const kids = store.sim.district.children.slice(0, 120); const lines = [COLS.join(',')]; for (const c of kids) for (const e of c.events) lines.push([c.pseudoId, c.sex, new Date(c.dob).toISOString().slice(0, 10), c.awcCode, new Date(e.t).toISOString(), e.weightKg, e.heightCm, e.muacMm ?? '', e.oedema ? 1 : 0].join(',')); run(lines.join('\n'), 'synthetic-sample.csv'); } }, 'Try with a synthetic sample')),
        h('div.card', null, h('div.kicker', null, 'Real data — two real anthropometric surveys (nipnTK example datasets, GPL-3)'),
          h('p.p.small', { style: { margin: '4px 0 8px' } }, 'Cross-sectional SMART-format surveys: the same z-score engine, WHO flags and SMART data-quality checks run on real children. (No public longitudinal under-5 dataset is available without registration; Phase 1 brings Tracker exports.)'),
          h('div.row', { style: { gap: '8px' } }, h('button.btn.hot', { onclick: () => loadReal('smart-survey-a.csv') }, 'Run on real survey A (873 children)'), h('button.btn', { onclick: () => loadReal('smart-survey-b.csv') }, 'Run on real survey B (785 children)'))));
      else if (out.mode === 'survey') body = surveyView(out);
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
