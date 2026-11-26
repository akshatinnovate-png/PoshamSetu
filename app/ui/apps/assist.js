// Quick entry: write how each child is doing, one per line, the way you would say it. It reads as you type,
// answers in plain words ("Visit within 7 days"), and asks only for what is missing or impossible.
// Offline reader by default; Groq (an LLM) on request when a key is set, falling back offline if it fails.
import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';
import { nameOf, ageAt, DAY } from '../common.js';
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

// Plain-language answer for each tier: what to do, in the worker's words.
const PLAIN = {
  RED_A: { label: 'Urgent: take to the health centre today', bg: '#c8102e', fg: '#ffffff' },
  RED_B: { label: 'Severe: start treatment at the Anganwadi', bg: '#f0542d', fg: '#1f1b1d' },
  AMBER: { label: 'Needs a home visit within 7 days', bg: '#f2a20c', fg: '#1f1b1d' },
  WATCH: { label: 'Weigh again soon', bg: '#d3e8fb', fg: '#1f1b1d' },
  GREEN: { label: 'Growing well', bg: '#1f9d6b', fg: '#ffffff' },
};
const ageWords = (m) => (m == null ? 'age ?' : m < 24 ? `${Math.round(m)} months` : `${Math.floor(m / 12)} yr ${Math.round(m % 12)} mo`);

export default {
  id: 'assist', title: 'Type notes', icon: ICONS.capture, size: [980, 740],
  mount(ctx) {
    let text = '', rows = [], busy = false, note = '', saved = null, groq = { configured: false }, showSettings = false, timer = null;
    const visibleAwcs = () => store.sim.district.awcs.filter((a) => store.inScope({ awcId: a.id }));
    let awcId = null;
    const pickAwc = () => { const v = visibleAwcs(); if (!v.some((a) => a.id === awcId)) awcId = (v.find((a) => a.id === store.story?.awcId) || v[0])?.id || null; };
    groqStatus().then((s) => { groq = s; render(); });

    // Reads as you type (offline, instant). Keeps anything the worker already fixed on a line that did not change.
    function readLive() {
      const fresh = parseNotes(text).map(makeRow);
      rows = fresh.map((f) => { const old = rows.find((o) => o.raw === f.raw); return old || f; });
      saved = saved && rows.length ? null : saved;
      render();
    }
    async function readWithAI() {
      if (!text.trim()) return;
      busy = true; note = ''; render();
      const r = await groqRead(text);
      if (r.ok && r.rows.length) rows = r.rows.map(makeRow);
      else { note = `The AI could not read it (${r.error || 'no rows'}). The built-in reader is used instead, so nothing is lost.`; rows = parseNotes(text).map(makeRow); }
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
      if (!row.isNew && row.parsedAge != null && Math.abs(row.parsedAge - row.ageMonths) > 3) issues.push({ level: 'warn', field: 'ageMonths', text: `You wrote ${Math.round(row.parsedAge)} months; the register says ${Math.round(row.ageMonths)} months. The register is used.` });
      if (row.isNew && !row.name) issues.push({ level: 'block', field: 'name', text: 'Name is missing.' });
      return issues;
    }
    const isBlocked = (r, issues = check(r)) => issues.some((i) => i.level === 'block' || (i.level === 'confirm' && !r.confirmed));
    function mObj(row) {
      return { confirmed: !!row.confirmed, weightKg: row.weightKg, heightCm: row.heightCm, muacMm: row.ageMonths >= 6 ? row.muacMm : null, lying: row.ageMonths < 24, oedema: !!row.oedema, danger: row.danger || [], appetite: '' };
    }
    function preview(row) {
      const base = row.isNew ? { id: 'preview', sex: row.sex || 'F', dob: store.now - row.ageMonths * 30.4375 * DAY, lbw: false, awcId, events: [], signals: [] } : store.childById[row.childId];
      if (!base || row.ageMonths == null) return null;
      const m = mObj(row);
      const res = evaluate(base, [...(base.events || []), { id: 'preview', t: store.now, ...m }], base.signals || [], store.pack, { feedR: store.sim.feeds[base.awcId]?.R ?? 100 }).current;
      return { res, ix: indices(base.sex, (store.now - base.dob) / DAY, m) };
    }

    function saveAll() {
      const ok = rows.filter((r) => !isBlocked(r));
      const out = [];
      for (const r of ok) {
        let id = r.childId;
        if (r.isNew) id = store.addChild({ name: r.name, sex: r.sex, ageMonths: r.ageMonths, awcId }).id;
        store.capture(id, mObj(r), 'DIRECT');
        out.push({ id, name: r.name || nameOf(store.childById[id]), isNew: r.isNew, tier: store.childById[id].current?.tier });
      }
      saved = out;
      const keep = rows.filter((r) => !ok.includes(r));
      setText(keep.map((r) => r.raw).filter(Boolean).join('\n'));
      rows = keep;
      render();
    }

    // The text box is created once, so redrawing results never takes the cursor away while typing.
    const ta = h('textarea.input', {
        rows: 4, placeholder: 'Example:\nRohan, boy, 1 year, 8 kg, 74 cm\nPriya, girl, 18 months, 7.9 kg, 76 cm, arm 118',
        style: { width: '100%', fontSize: '18px', lineHeight: 1.5, padding: '12px 14px', resize: 'vertical', fontFamily: 'var(--font-display)' },
        oninput: (e) => { text = e.target.value; clearTimeout(timer); timer = setTimeout(readLive, 350); },
        onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); clearTimeout(timer); readLive(); } },
      });
    const topSlot = h('div'), ctrlSlot = h('div'), resultSlot = h('div.col', { style: { gap: '12px' } });
    mount(ctx.body, topSlot, h('div.col', { style: { padding: '14px', gap: '12px' } }, ta, ctrlSlot, resultSlot));
    const setText = (t) => { text = t; ta.value = t; };

    function render() {
      pickAwc();
      const awc = store.awcById[awcId];
      const checked = rows.map((r) => ({ r, issues: check(r), pv: preview(r) }));
      const blocked = checked.filter((x) => isBlocked(x.r, x.issues)).length;
      const ready = checked.length - blocked;
      if (ta.value !== text && document.activeElement !== ta) ta.value = text;
      mount(topSlot,
        h('div.toolbar', null,
          h('b', { style: { fontSize: '14px' } }, 'Write how each child is doing, one child per line.'),
          h('div.grow'),
          h('span.small.muted', null, groq.configured ? 'AI ready' : 'Works without internet'),
          h('button.btn.sm.ghost', { onclick: () => { showSettings = !showSettings; render(); } }, showSettings ? 'Close settings' : '⚙ Settings')),
        showSettings ? settings(awc) : null);
      mount(ctrlSlot,
          h('div.row', { style: { gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
            h('span.small', { style: { color: 'var(--muted)' } }, 'Any order, any words: “saal”, “mahine”, “kilo”, “sujan” all work.'),
            h('div.grow'),
            groq.configured ? h('button.btn.ghost', { disabled: busy || !text.trim(), onclick: readWithAI }, busy ? 'AI is reading…' : '✦ Read with AI') : null,
            h('button.btn.ghost', { onclick: () => { setText(EXAMPLE); rows = []; readLive(); } }, 'Try an example')));
      mount(resultSlot,
          note ? h('div.callout', { style: { borderColor: 'var(--amber)' } }, note) : null,
          saved ? savedBox() : null,
          !rows.length && !saved ? h('div', { style: { padding: '26px', textAlign: 'center', color: 'var(--muted)', border: '2px dashed #c9bfc3', fontSize: '15px' } }, 'Start typing above. Each child appears here with what to do.') : null,
          checked.map(({ r, issues, pv }, i) => card(r, issues, pv, i)),
          rows.length ? h('div.row', { style: { gap: '14px', alignItems: 'center', marginTop: '4px' } },
            h('button.btn.hot', { disabled: !ready, onclick: saveAll, style: { fontSize: '17px', padding: '12px 26px' } }, ready ? `Save ${ready} ${ready === 1 ? 'child' : 'children'} ✓` : 'Save'),
            blocked ? h('span', { style: { color: 'var(--red-a)', fontWeight: 700, fontSize: '14px' } }, `${blocked} ${blocked === 1 ? 'child needs' : 'children need'} one answer first (shown in red).`)
              : h('span.small.muted', null, `New children go to ${awc ? awc.name : 'your Anganwadi'}.`)) : null);
    }

    function savedBox() {
      return h('div', { style: { background: '#e6f6ee', border: '2px solid #1f9d6b', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' } },
        h('div', { style: { fontWeight: 800, fontSize: '17px' } }, `✓ Saved ${saved.length} ${saved.length === 1 ? 'child' : 'children'}. They are now on the to-do list.`),
        h('div.row', { style: { gap: '8px', flexWrap: 'wrap' } },
          saved.map((s) => h('button.btn.sm.ghost', { onclick: () => { store.selectChild(s.id); open('child', { childId: s.id }); } }, `${s.name}: ${PLAIN[s.tier]?.label || 'saved'} ▸`)),
          h('button.btn.sm', { onclick: () => open('worklist') }, 'Open the to-do list ▸')));
    }

    function card(r, issues, pv, i) {
      const c = r.childId ? store.childById[r.childId] : null;
      const stop = isBlocked(r, issues);
      const ans = !stop && pv?.res ? PLAIN[pv.res.tier] : null;
      const why = ans && pv.res.tier !== 'GREEN' ? pv.res.reasons.filter((x) => x.tier === pv.res.tier).map((x) => x.text).join('; ') : '';
      const meas = [r.weightKg != null ? `${r.weightKg} kg` : null, r.heightCm != null ? `${r.heightCm} cm` : null, r.muacMm != null ? `arm ${r.muacMm} mm` : null, r.oedema ? 'swelling of both feet' : null].filter(Boolean).join(' · ');
      return h('div', { style: { border: `2px solid ${stop ? 'var(--red-a)' : 'var(--ink)'}`, background: 'var(--white)', boxShadow: '4px 4px 0 var(--ink)' } },
        h('div.row', { style: { gap: '12px', alignItems: 'stretch' } },
          h('div', { style: { flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' } },
            h('div', { style: { fontWeight: 800, fontSize: '19px', letterSpacing: '-0.01em' } },
              r.isNew ? (r.name || 'Name?') : nameOf(c),
              h('span', { style: { fontWeight: 500, fontSize: '15px', color: 'var(--ink-2)' } }, `  ·  ${r.sex === 'M' ? 'boy' : r.sex === 'F' ? 'girl' : 'boy or girl?'} · ${ageWords(r.ageMonths)}`)),
            h('div', { style: { fontSize: '14px', color: 'var(--ink-2)' } }, meas || 'no measurements yet'),
            h('div.small', { style: { color: 'var(--muted)' } }, r.isNew ? `New child — will be added to ${store.awcById[awcId]?.name}` : `Already on the register · ${store.awcById[c.awcId].name}`)),
          h('div', { style: { width: '270px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px 14px', background: stop ? '#ffe9ee' : ans ? ans.bg : 'var(--paper)', color: stop ? 'var(--red-a)' : ans ? ans.fg : 'var(--ink)' } },
            h('div', { style: { fontWeight: 800, fontSize: '16px', lineHeight: 1.2 } }, stop ? 'Needs your answer ↓' : ans ? ans.label : '…'),
            why ? h('div', { style: { fontSize: '12px', marginTop: '4px', opacity: 0.9 } }, why) : null)),
        issues.length ? h('div', { style: { borderTop: '1.5px solid #e5dde0', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '8px' } }, issues.map((x) => problem(r, x))) : null,
        h('div.row', { style: { gap: '8px', padding: '0 14px 10px', justifyContent: 'flex-end' } },
          h('button.btn.sm.ghost', { onclick: () => { r.editing = !r.editing; render(); } }, r.editing ? 'Done editing' : 'Edit'),
          h('button.btn.sm.ghost', { onclick: () => { rows.splice(i, 1); setText(rows.map((x) => x.raw).filter(Boolean).join('\n')); render(); } }, 'Remove')),
        r.editing ? editor(r, c, pv) : null);
    }

    // One problem, one plain sentence, one obvious way to answer it.
    function problem(r, x) {
      const bad = x.level !== 'warn';
      const box = (...kids) => h('div.row', { style: { gap: '10px', alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', background: bad ? '#ffe9ee' : '#fff6e0', borderLeft: `5px solid ${bad ? 'var(--red-a)' : 'var(--amber)'}` } }, h('span', { style: { flex: '1 1 320px', fontSize: '14px' } }, x.text), ...kids);
      const big = { fontSize: '14px', padding: '8px 14px' };
      if (x.field === 'sex') return box(h('button.btn', { style: big, onclick: () => { r.sex = 'M'; render(); } }, 'Boy'), h('button.btn', { style: big, onclick: () => { r.sex = 'F'; render(); } }, 'Girl'));
      if (x.level === 'confirm') return box(h('button.btn' + (r.confirmed ? '' : '.hot'), { style: big, onclick: () => { r.confirmed = !r.confirmed; render(); } }, r.confirmed ? '✓ Re-measured, this is correct' : 'I re-measured: it is correct'));
      if (x.fix) return box(h('button.btn.hot', { style: big, onclick: () => { r[x.fix.field] = x.fix.value; render(); } }, `Yes, use ${x.fix.value}`), quickInput(r, x.field));
      if (['weightKg', 'heightCm', 'muacMm', 'ageMonths'].includes(x.field) && bad) return box(quickInput(r, x.field));
      if (x.field === 'name') return box(h('input.input', { placeholder: 'Type the name', style: { fontSize: '15px', width: '200px' }, onchange: (e) => { r.name = e.target.value.trim(); render(); } }));
      return box();
    }
    function quickInput(r, field) {
      const unit = { weightKg: 'kg', heightCm: 'cm', muacMm: 'mm', ageMonths: 'months' }[field];
      return h('span.row', { style: { gap: '6px', alignItems: 'center' } },
        h('input.input', { type: 'number', step: '0.1', placeholder: 'correct value', style: { width: '120px', fontSize: '15px' }, onchange: (e) => { if (e.target.value !== '') { r[field] = Number(e.target.value); render(); } } }),
        h('span.small', null, unit));
    }
    function editor(r, c, pv) {
      const field = (k, label, unit) => h('label.field', null, h('span', null, label), h('div.row', { style: { gap: '4px', alignItems: 'center' } },
        h('input.input', { type: 'number', step: '0.1', value: r[k] ?? '', disabled: k === 'ageMonths' && !r.isNew, style: { width: '90px' }, onchange: (e) => { r[k] = e.target.value === '' ? null : Number(e.target.value); render(); } }), h('span.small', null, unit)));
      return h('div', { style: { background: 'var(--paper)', borderTop: '1.5px solid var(--ink)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '10px' } },
        h('div.row', { style: { gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' } },
          r.isNew ? h('label.field', null, h('span', null, 'Name'), h('input.input', { value: r.name || '', style: { width: '160px' }, onchange: (e) => { r.name = e.target.value.trim(); render(); } })) : null,
          h('label.field', null, h('span', null, 'Boy / girl'), h('div.seg', null, [['M', 'Boy'], ['F', 'Girl']].map(([k, l]) => h('button', { class: r.sex === k ? 'on' : '', disabled: !r.isNew, onclick: () => { r.sex = k; render(); } }, l)))),
          field('ageMonths', 'Age', 'months'), field('weightKg', 'Weight', 'kg'), field('heightCm', 'Height', 'cm'), field('muacMm', 'Arm (MUAC)', 'mm'),
          h('label.row', { style: { gap: '6px', fontSize: '13px', cursor: 'pointer', paddingBottom: '8px' } }, h('input', { type: 'checkbox', checked: !!r.oedema, onchange: (e) => { r.oedema = e.target.checked; render(); } }), 'Swelling of both feet')),
        h('div.row', { style: { gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
          h('button.btn.sm.ghost', { onclick: () => { r.isNew = !r.isNew; if (r.isNew) { r.childId = null; r.ageMonths = r.parsedAge ?? r.ageMonths; } else { const m = matchChild(r.name, store.children()); if (m.match || m.candidates[0]) { r.childId = (m.match || m.candidates[0]).id; syncFromChild(r); } else r.isNew = true; } render(); } }, r.isNew ? 'It is a child already on the register' : 'No, this is a new child'),
          !r.isNew && r.candidates.length > 1 ? h('select.input', { onchange: (e) => { r.childId = e.target.value; syncFromChild(r); render(); } }, r.candidates.map((k) => h('option', { value: k.id, selected: k.id === r.childId }, `${nameOf(k)} · ${store.awcById[k.awcId].name}`))) : null,
          h('span.small.mono', { style: { color: 'var(--muted)' } }, `For experts: WAZ ${pv?.ix?.waz ?? '—'} · HAZ ${pv?.ix?.haz ?? '—'} · WHZ ${pv?.ix?.whz ?? '—'} · ${r.source === 'groq' ? 'read by AI' : 'read offline'} · “${r.raw}”`)));
    }

    function settings(awc) {
      let val = '';
      return h('div.callout', { style: { margin: '10px 14px 0', display: 'flex', flexDirection: 'column', gap: '10px' } },
        h('label.row', { style: { gap: '8px', alignItems: 'center', fontSize: '13px' } }, h('b', null, 'New children go to'),
          h('select.input', { onchange: (e) => { awcId = e.target.value; rows = rows.map((r) => makeRow(r)); render(); } }, visibleAwcs().map((a) => h('option', { value: a.id, selected: a.id === awc?.id }, `${a.name} · ${a.aww}`)))),
        window.psNative?.groqSetKey ? h('div', null,
          h('div', { style: { fontSize: '13px' } }, h('b', null, 'AI (optional). '), groq.configured ? `On: ${groq.model}. ` : 'Off. ', 'Paste a Groq key to let the AI read messy notes. The key stays on this computer.'),
          h('div.row', { style: { gap: '8px', marginTop: '6px' } },
            h('input.input', { type: 'password', placeholder: 'gsk_…', style: { flex: 1 }, oninput: (e) => { val = e.target.value; } }),
            h('button.btn.sm', { onclick: async () => { await groqSetKey(val); groq = await groqStatus(); render(); } }, 'Save key'),
            groq.configured && !groq.fromEnv ? h('button.btn.sm.ghost', { onclick: async () => { await groqSetKey(''); groq = await groqStatus(); render(); } }, 'Remove key') : null))
          : h('div.small', null, groq.configured ? `AI on: ${groq.model}.` : 'AI is off. In the browser version, start the server with GROQ_API_KEY set to turn it on.'));
    }

    render();
    ctx.onCleanup(() => clearTimeout(timer));
    ctx.onCleanup(store.on('role', () => { rows = rows.map((r) => makeRow(r)); render(); }));
  },
};
