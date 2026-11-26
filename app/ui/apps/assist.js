// Quick entry assistant: type notes the way you speak ("Rohan, 1.2 yrs, 8 kg, 74 cm"), check, save.
// Reads offline by default; uses Groq (an LLM) when a key is set, and falls back to offline if it fails.
import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';
import { tierChip, nameOf, ageAt, DAY } from '../common.js';
import { evaluate } from '../../engine/triage.js';
import { indices } from '../../engine/growth.js';
import { parseNotes, checkRow, matchChild, guessSex } from '../../engine/quickentry.js';
import { groqStatus, groqSetKey, groqRead } from '../groq.js';

const EXAMPLE = [
  'Rohan, boy, 1.2 yrs, weight 8 kg, height 300 cm',
  'Priya 18 months 7.9kg 76cm muac 11.8 cm',
  'Somari, girl, 3 saal, wajan 11.2, lambai 88, sujan both feet',
  'Rahul 2 yr 3 months 92 kg 84 cm',
].join('\n');

export default {
  id: 'assist', title: 'Quick entry — type it, check it, save it', icon: ICONS.capture, dock: 'Quick entry', desk: 'Quick entry', size: [1000, 720], key: 'q',
  mount(ctx) {
    let text = '', rows = [], busy = false, note = '', saved = null, groq = { configured: false }, showKey = false;
    const visibleAwcs = () => store.sim.district.awcs.filter((a) => store.inScope({ awcId: a.id }));
    let awcId = null;
    const pickAwc = () => { const v = visibleAwcs(); if (!v.some((a) => a.id === awcId)) awcId = (v.find((a) => a.id === store.story?.awcId) || v[0])?.id || null; };
    groqStatus().then((s) => { groq = s; render(); });

    async function read(useGroq) {
      if (!text.trim()) return;
      busy = true; note = ''; saved = null; render();
      let parsed = null;
      if (useGroq && groq.configured) {
        const r = await groqRead(text);
        if (r.ok && r.rows.length) parsed = r.rows;
        else note = `Groq could not read it (${r.error || 'no rows'}), so the offline reader was used instead.`;
      }
      if (!parsed) parsed = parseNotes(text);
      rows = parsed.map(makeRow);
      busy = false; render();
    }

    function makeRow(p) {
      pickAwc();
      const pool = store.children().filter((k) => k.awcId === awcId);
      let { match, candidates } = matchChild(p.name, pool);
      if (!match && !candidates.length) ({ match, candidates } = matchChild(p.name, store.children()));
      const row = { ...p, childId: match?.id || null, candidates, isNew: !match };
      if (match) syncFromChild(row);
      if (!row.sex) row.sex = guessSex(row.name);
      return row;
    }
    function syncFromChild(row) {
      const c = store.childById[row.childId];
      row.parsedAge = row.parsedAge ?? row.ageMonths;
      row.sex = c.sex;
      row.ageMonths = Math.round(ageAt(c, store.now) * 10) / 10;
    }

    function check(row) {
      const issues = checkRow(row);
      if (!row.isNew && row.parsedAge != null && Math.abs(row.parsedAge - row.ageMonths) > 3) issues.push({ level: 'warn', field: 'ageMonths', text: `You wrote ${Math.round(row.parsedAge)} months; the register says ${Math.round(row.ageMonths)} months. The register's date of birth is used.` });
      if (row.isNew && !row.name) issues.push({ level: 'block', field: 'name', text: 'Name is missing.' });
      return issues;
    }
    function mObj(row) {
      return { weightKg: row.weightKg, heightCm: row.heightCm, muacMm: row.ageMonths >= 6 ? row.muacMm : null, lying: row.ageMonths < 24, oedema: !!row.oedema, danger: row.danger || [], appetite: '' };
    }
    function preview(row) {
      const base = row.isNew ? { id: 'preview', sex: row.sex || 'F', dob: store.now - row.ageMonths * 30.4375 * DAY, lbw: false, awcId, events: [], signals: [] } : store.childById[row.childId];
      if (!base || row.ageMonths == null) return null;
      const m = mObj(row);
      const res = evaluate(base, [...(base.events || []), { id: 'preview', t: store.now, ...m }], base.signals || [], store.pack, { feedR: store.sim.feeds[base.awcId]?.R ?? 100 }).current;
      const ix = indices(base.sex, (store.now - base.dob) / DAY, m);
      return { res, ix };
    }

    function saveAll() {
      const ok = rows.filter((r) => !check(r).some((i) => i.level === 'block'));
      const out = [];
      for (const r of ok) {
        let id = r.childId;
        if (r.isNew) id = store.addChild({ name: r.name, sex: r.sex, ageMonths: r.ageMonths, awcId }).id;
        store.capture(id, mObj(r), 'DIRECT');
        out.push({ id, name: r.name, isNew: r.isNew });
      }
      saved = out; rows = rows.filter((r) => !ok.includes(r));
      if (!rows.length) text = '';
      render();
    }

    function render() {
      pickAwc();
      const awc = store.awcById[awcId];
      const checked = rows.map((r) => ({ r, issues: check(r), pv: preview(r) }));
      const blocked = checked.filter((x) => x.issues.some((i) => i.level === 'block')).length;
      const ready = checked.length - blocked;
      const engine = groq.configured ? h('span.tag.ok', { title: groq.fromEnv ? 'Key from GROQ_API_KEY' : 'Key saved on this computer' }, `Groq · ${groq.model || 'llama-3.3-70b'}`) : h('span.tag', { title: 'Works with no internet' }, 'Offline reader');
      const ta = h('textarea.input', { rows: 6, value: text, placeholder: 'One child per line, the way you would say it:\nRohan, boy, 1.2 yrs, 8 kg, 74 cm\nPriya 18 months 7.9kg 76cm muac 11.8 cm', style: { width: '100%', fontFamily: 'var(--font-mono)', fontSize: '14px', lineHeight: 1.5, resize: 'vertical' },
        oninput: (e) => { text = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); read(true); } } });
      ta.value = text;
      mount(ctx.body,
        h('div.toolbar', null, h('b', null, 'Type notes → check → save'), engine,
          h('div.grow'),
          awc ? h('label.row', { style: { gap: '6px', fontSize: '12px' } }, 'New children go to',
            h('select.input', { onchange: (e) => { awcId = e.target.value; rows = rows.map((r) => makeRow(r)); render(); } }, visibleAwcs().map((a) => h('option', { value: a.id, selected: a.id === awcId }, `${a.name} · ${a.aww}`)))) : null,
          window.psNative?.groqSetKey ? h('button.btn.sm.ghost', { onclick: () => { showKey = !showKey; render(); } }, 'Groq key') : null),
        showKey ? keyForm() : null,
        h('div.col', { style: { padding: '12px', gap: '10px' } },
          ta,
          h('div.row', { style: { gap: '8px', alignItems: 'center' } },
            h('button.btn.hot', { disabled: busy, onclick: () => read(true) }, busy ? 'Reading…' : 'Read notes ▸'),
            groq.configured ? h('button.btn.ghost', { disabled: busy, onclick: () => read(false) }, 'Read offline') : null,
            h('button.btn.ghost', { onclick: () => { text = EXAMPLE; read(true); } }, 'Try an example'),
            h('span.small.muted', null, 'Ctrl+Enter reads. Nothing is saved until you press Save.')),
          note ? h('div.callout', { style: { borderColor: 'var(--amber)' } }, note) : null,
          saved ? h('div.callout', null, h('b', null, `Saved ${saved.length} ${saved.length === 1 ? 'child' : 'children'}. `), 'Each one is now on the worklist with its tier. ',
            saved.map((s) => h('button.btn.sm.ghost', { style: { margin: '4px 6px 0 0' }, onclick: () => { store.selectChild(s.id); open('child', { childId: s.id }); } }, `${s.name}${s.isNew ? ' (new)' : ''} ▸`))) : null,
          checked.map(({ r, issues, pv }, i) => rowCard(r, issues, pv, i)),
          rows.length ? h('div.row', { style: { gap: '10px', alignItems: 'center' } },
            h('button.btn.hot', { disabled: !ready, onclick: saveAll }, `Save ${ready} ${ready === 1 ? 'child' : 'children'} ▸`),
            blocked ? h('span.small', { style: { color: 'var(--red-a)', fontWeight: 700 } }, `${blocked} need a fix first (shown in red).`) : h('span.small.muted', null, 'All look right.')) : null));
    }

    function rowCard(r, issues, pv, i) {
      const bad = (f) => issues.some((x) => x.level === 'block' && x.field === f);
      const field = (k, label, unit, step) => h('label.field', { style: { minWidth: '110px' } }, h('span', null, label),
        h('div.row', { style: { gap: '4px', alignItems: 'center' } }, h('input.input', { type: 'number', step, value: r[k] ?? '', style: { width: '90px', borderColor: bad(k) ? 'var(--red-a)' : '', background: bad(k) ? '#ffe9ee' : '' }, disabled: k === 'ageMonths' && !r.isNew,
          onchange: (e) => { r[k] = e.target.value === '' ? null : Number(e.target.value); render(); } }), h('span.small', null, unit)));
      const c = r.childId ? store.childById[r.childId] : null;
      const blockedRow = issues.some((x) => x.level === 'block');
      return h('div.card', { style: { borderColor: issues.some((x) => x.level === 'block') ? 'var(--red-a)' : '', borderWidth: '2px' } },
        h('div.row.between', { style: { alignItems: 'flex-start', gap: '10px' } },
          h('div.col', { style: { gap: '4px' } },
            r.isNew ? h('input.input', { value: r.name || '', placeholder: 'Name', style: { fontWeight: 800, fontSize: '16px', width: '220px', borderColor: bad('name') ? 'var(--red-a)' : '' }, onchange: (e) => { r.name = e.target.value.trim(); render(); } })
              : h('div', { style: { fontWeight: 800, fontSize: '16px' } }, nameOf(c)),
            h('div.small.mono', { style: { color: 'var(--muted)' } }, r.raw ? `“${r.raw}”` : ''),
            h('div.row', { style: { gap: '6px', alignItems: 'center', flexWrap: 'wrap' } },
              r.isNew ? h('span.tag.sky', null, `New child → ${store.awcById[awcId]?.name}`) : h('span.tag.ok', null, `On the register · ${store.awcById[c.awcId].name}`),
              r.candidates.length > 1 && !r.isNew ? h('select.input', { style: { fontSize: '11px' }, onchange: (e) => { r.childId = e.target.value; syncFromChild(r); render(); } }, r.candidates.map((k) => h('option', { value: k.id, selected: k.id === r.childId }, `${nameOf(k)} · ${store.awcById[k.awcId].name}`))) : null,
              h('button.btn.sm.ghost', { onclick: () => { r.isNew = !r.isNew; if (r.isNew) { r.childId = null; r.ageMonths = r.parsedAge ?? r.ageMonths; } else { const m = matchChild(r.name, store.children()); if (m.match || m.candidates[0]) { r.childId = (m.match || m.candidates[0]).id; syncFromChild(r); } else r.isNew = true; } render(); } }, r.isNew ? 'It is an existing child' : 'No, a new child'),
              h('span.tag', { title: r.source === 'groq' ? 'Read by Groq' : 'Read by the offline reader' }, r.source === 'groq' ? 'read by Groq' : 'read offline'))),
          h('div.col', { style: { alignItems: 'flex-end', gap: '6px' } },
            blockedRow ? h('span.tag.bad', null, 'fix first') : pv?.res ? tierChip(pv.res.tier) : h('span.tag', null, 'no tier yet'),
            !blockedRow && pv?.ix ? h('div.small.mono', null, `WAZ ${pv.ix.waz ?? '—'} · HAZ ${pv.ix.haz ?? '—'} · WHZ ${pv.ix.whz ?? '—'}`) : null,
            h('button.btn.sm.ghost', { onclick: () => { rows.splice(i, 1); render(); } }, 'Remove ×'))),
        h('div.row', { style: { gap: '12px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'flex-end' } },
          h('label.field', null, h('span', null, 'Boy / girl'), h('div.seg', null, [['M', 'Boy'], ['F', 'Girl']].map(([k, l]) => h('button', { class: r.sex === k ? 'on' : '', disabled: !r.isNew, style: bad('sex') ? { outline: '2px solid var(--red-a)' } : null, onclick: () => { r.sex = k; render(); } }, l)))),
          field('ageMonths', 'Age', 'months', '0.1'), field('weightKg', 'Weight', 'kg', '0.1'), field('heightCm', 'Height', 'cm', '0.1'), field('muacMm', 'MUAC', 'mm', '1'),
          h('label.row', { style: { gap: '6px', fontSize: '12px', cursor: 'pointer', paddingBottom: '8px' } }, h('input', { type: 'checkbox', checked: !!r.oedema, onchange: (e) => { r.oedema = e.target.checked; render(); } }), 'Swelling of both feet')),
        issues.map((x) => h('div.row', { style: { gap: '8px', alignItems: 'center', marginTop: '6px', padding: '6px 8px', background: x.level === 'block' ? '#ffe9ee' : '#fff6e0', borderLeft: `4px solid ${x.level === 'block' ? 'var(--red-a)' : 'var(--amber)'}` } },
          h('span.small', { style: { flex: 1 } }, x.text),
          x.fix ? h('button.btn.sm', { onclick: () => { r[x.fix.field] = x.fix.value; render(); } }, `Use ${x.fix.value} ▸`) : null)),
        !blockedRow && pv?.res && pv.res.tier !== 'GREEN' ? h('div.small', { style: { marginTop: '6px' } }, h('b', null, 'Why: '), pv.res.reasons.filter((x) => x.tier === pv.res.tier).map((x) => x.text).join('; ')) : null);
    }

    function keyForm() {
      let val = '';
      return h('div.callout', { style: { margin: '10px 12px 0' } },
        h('div', null, h('b', null, 'Groq key. '), 'Optional. Without it, the offline reader is used. The key is saved only on this computer and sent only to Groq.'),
        h('div.row', { style: { gap: '8px', marginTop: '8px' } },
          h('input.input', { type: 'password', placeholder: 'gsk_…', style: { flex: 1 }, oninput: (e) => { val = e.target.value; } }),
          h('button.btn.sm', { onclick: async () => { await groqSetKey(val); groq = await groqStatus(); showKey = false; render(); } }, 'Save key'),
          groq.configured && !groq.fromEnv ? h('button.btn.sm.ghost', { onclick: async () => { await groqSetKey(''); groq = await groqStatus(); render(); } }, 'Remove key') : null));
    }

    render();
    ctx.onCleanup(store.on('role', () => { rows = rows.map((r) => makeRow(r)); render(); }));
  },
};
