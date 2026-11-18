import { h, mount, s } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';
import { tierChip, nameOf, fmtDateTime, fmtDuration, closureDots, levelChip, dueChip, DAY, HOUR } from '../common.js';
import { closureState } from '../../engine/tasks.js';
import { promptTask, confirmKey, stop as stopAudio } from '../ivr.js';

const LANGS = {
  hi: { label: 'हिन्दी', font: 'Noto Sans Devanagari', prompt: (awc, ref) => `नमस्ते सहिया दीदी। आंगनवाड़ी ${awc} के बच्चे ${ref} के घर जाना है। भेंट हो गई — 1 दबाएँ। रेफर किया — 2। परिवार ने मना किया — 3। परिवार बाहर चला गया — 4।` },
  en: { label: 'English', font: 'var(--font-mono)', prompt: (awc, ref) => `Hello Sahiya. Child ${ref} at AWC ${awc} needs a home visit. Visited — press 1. Referred — 2. Family refused — 3. Family has migrated — 4.` },
  sat: { label: 'ᱥᱟᱱᱛᱟᱲᱤ Santali', font: 'Noto Sans Ol Chiki', prompt: () => 'Recorded Santali prompt (Bhashini TTS draft, reviewed by a Santali-speaking Sahiya). Keys are identical: 1 · 2 · 3 · 4.' },
  ho: { label: 'Ho', font: 'var(--font-mono)', prompt: () => 'Recorded Ho prompt (voice artist from Khuntpani; Warang Citi text card for the AWC wall). Keys are identical: 1 · 2 · 3 · 4.' },
  mun: { label: 'Mundari', font: 'var(--font-mono)', prompt: () => 'Recorded Mundari prompt. Keys are identical: 1 · 2 · 3 · 4.' },
};
const OUT = { 1: 'VISITED', 2: 'REFERRED', 3: 'REFUSED', 4: 'MIGRATED' };

export default {
  id: 'joint', title: 'Joint-visit desk — async closure', icon: ICONS.phone, dock: 'Joint visit', desk: 'Joint visit', size: [1020, 640], key: '2',
  mount(ctx, opts) {
    let audioMode = '';
    let sel = opts.taskId || null, lang = 'hi', filter = opts.taskId ? 'OPEN' : 'PARTIAL', calling = false, lastKey = null;
    function tasks() {
      return store.scopedTasks().filter((t) => t.required.includes('ASHA'))
        .map((t) => ({ t, e: store.esc(t) }))
        .filter((x) => filter === 'ALL' || (filter === 'PARTIAL' ? x.e.state === 'PARTIAL' : filter === 'OPEN' ? x.e.open : !x.e.open))
        .sort((a, b) => b.e.open - a.e.open || a.t.dueAt - b.t.dueAt);
    }
    function render() {
      if (store.role === 'DPO') { mount(ctx.body, h('div.empty', null, 'Joint-visit tasks are child-level: visible to AWW/ASHA, Mukhya Sevika and CDPO. District officers see half-closed counts in the Report.')); return; }
      const list = tasks();
      if (!sel || !store.tasks.find((t) => t.id === sel)) sel = list[0]?.t.id || store.scopedTasks().find((t) => t.required.includes('ASHA'))?.id;
      const task = store.tasks.find((t) => t.id === sel);
      mount(ctx.body,
        h('div.toolbar', null, h('span.fix', null, 'AUDIT FIX 02'), h('b', null, 'Same door, same hour is not required.'), h('span.small', null, 'AWW and ASHA may visit in either order within 7 days; the task closes only when both confirm.')),
        h('div.row', { style: { alignItems: 'stretch', gap: 0, height: 'calc(100% - 38px)' } },
          h('div', { style: { width: '300px', borderRight: '2px solid var(--ink)', overflow: 'auto', background: 'var(--white)' } },
            h('div.seg', { style: { margin: '8px' } }, [['PARTIAL', 'Half-closed'], ['OPEN', 'Open'], ['DONE', 'Closed'], ['ALL', 'All']].map(([k, l]) => h('button', { class: filter === k ? 'on' : '', onclick: () => { filter = k; render(); } }, l))),
            list.length ? list.map(({ t, e }) => h('div', { onclick: () => { sel = t.id; calling = false; render(); }, style: { padding: '8px 10px', borderTop: '1px dashed #bbb', cursor: 'pointer', background: t.id === sel ? 'var(--sky)' : '' } },
              h('div.row.between', null, tierChip(t.tier), h('span.mono.small', null, t.id)),
              h('div', { style: { marginTop: '4px', fontWeight: 600 } }, nameOf(store.childById[t.childId]), h('span.muted.small', null, ` · ${store.awcById[t.awcId].name}`)),
              h('div.row', { style: { marginTop: '4px', gap: '4px' } }, closureDots(t, e), dueChip(t, e)))) : h('div.empty', null, 'No tasks in this filter')),
          task ? detail(task) : h('div.empty.grow', null, 'Select a task')));
    }

    function detail(t) {
      const e = store.esc(t);
      const c = store.childById[t.childId], awc = store.awcById[t.awcId];
      const win0 = t.measuredAt, win1 = t.dueAt;
      // timeline
      const W = 520, H = 92, X = (x) => 20 + ((x - win0) / (Math.max(win1, store.now, ...t.closures.map((c) => c.t)) + DAY - win0)) * (W - 40);
      const tl = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'display:block;font-family:var(--font-mono);max-width:640px' });
      tl.append(s('rect', { x: X(win0), y: 30, width: X(win1) - X(win0), height: 26, fill: '#d3e8fb', stroke: '#1f1b1d', 'stroke-width': 1.5 }));
      tl.append(s('text', { x: X(win0) + 4, y: 46, 'font-size': 10 }, `${Math.round((win1 - win0) / DAY)}-day window`));
      tl.append(s('line', { x1: X(store.now), x2: X(store.now), y1: 18, y2: 70, stroke: '#e94fbf', 'stroke-width': 2 }), s('text', { x: X(store.now) + 3, y: 16, 'font-size': 9, fill: '#e94fbf' }, 'now'));
      for (const cl of t.closures) {
        const y = cl.by === 'AWW' ? 22 : 64;
        tl.append(s('rect', { x: X(cl.t) - 6, y: y - 6, width: 12, height: 12, fill: cl.by === 'AWW' ? '#1f1b1d' : '#e94fbf', stroke: '#1f1b1d', 'stroke-width': 1.5 }));
        tl.append(s('text', { x: X(cl.t) + 9, y: y + 4, 'font-size': 9.5 }, `${cl.by} ${cl.dtmf ? '[' + cl.dtmf + '] ' : ''}${cl.outcome.toLowerCase()}`));
      }
      tl.append(s('text', { x: 20, y: 88, 'font-size': 9, fill: '#6d6266' }, `measured ${fmtDateTime(win0)}  →  due ${fmtDateTime(win1)}`));

      // state machine
      const SM = s('svg', { viewBox: '0 0 520 110', width: '100%', style: 'display:block;font-family:var(--font-mono);max-width:620px' });
      const st = e.state;
      const aw = !!t.closures.find((x) => x.by === 'AWW'), as = !!t.closures.find((x) => x.by === 'ASHA');
      const node = (x, y, label, on, w = 100) => { SM.append(s('rect', { x: x + 3, y: y + 3, width: w, height: 30, fill: '#1f1b1d' }), s('rect', { x, y, width: w, height: 30, fill: on ? '#e94fbf' : '#fff', stroke: '#1f1b1d', 'stroke-width': 2 }), s('text', { x: x + w / 2, y: y + 19, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 700 }, label)); };
      const arrow = (x1, y1, x2, y2) => SM.append(s('line', { x1, y1, x2, y2, stroke: '#1f1b1d', 'stroke-width': 1.5, 'marker-end': 'url(#ah)' }));
      SM.append(s('defs', null, s('marker', { id: 'ah', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, s('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#1f1b1d' }))));
      node(10, 40, 'OPEN', st === 'OPEN');
      node(170, 8, 'AWW ✓ (app)', aw && !as, 120); node(170, 72, 'ASHA ✓ (key 1)', as && !aw, 120);
      node(350, 40, 'CLOSED', st === 'CLOSED', 80);
      node(440, 40, st === 'CONFLICT' ? 'CONFLICT' : st === 'MIGRATED' ? 'MIGRATED' : st === 'REFUSED' ? 'REFUSED' : 'L1 ↑', ['CONFLICT', 'MIGRATED', 'REFUSED'].includes(st) || (e.open && e.breached), 74);
      arrow(110, 50, 168, 26); arrow(110, 62, 168, 86); arrow(290, 24, 348, 50); arrow(290, 88, 348, 62); arrow(430, 55, 438, 55);

      const phone = phoneUI(t, c, awc);
      return h('div.grow', { style: { overflow: 'auto', padding: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' } },
        h('div.col.grow', { style: { gap: '10px' } },
          h('div.card', null, h('div.row.between', null, h('div.row', null, tierChip(t.tier), h('b', null, nameOf(c)), h('span.muted.small', null, `AWC ${awc.name}`)), h('div.row', null, levelChip(e.level), dueChip(t, e))),
            h('div.p', { style: { marginTop: '6px' } }, t.reasons.join(' · '))),
          h('div.card', null, h('div.kicker', null, 'Closure state machine — both roles, any order'), SM,
            h('div.small', { style: { marginTop: '4px' } }, h('b', null, `State: ${st}. `),
              st === 'PARTIAL' ? `${aw && as ? `Both visits confirmed; waiting for CMAM milestone(s): ${(e.missing || []).map((m) => m === 'APPETITE_TEST' ? 'appetite test' : 'MO screening').join(' + ')}.` : aw ? 'AWW confirmed; waiting for ASHA keypress.' : as ? 'ASHA confirmed by IVR; waiting for AWW app flag.' : 'A milestone is recorded; visits still pending.'} If the window closes half-done, the Mukhya Sevika sees exactly what is missing.`
                : st === 'CONFLICT' ? 'AWW says visited but ASHA says migrated (or vice-versa) — routed to the Mukhya Sevika to reconcile; a migration trace task opens.'
                  : st === 'CLOSED' ? `Closed at ${fmtDateTime(e.closedAt)} — ${e.closedAt <= t.dueAt ? 'inside' : 'after'} the window.`
                    : st === 'OPEN' ? 'Nobody has confirmed yet.' : `Closed with outcome ${st.toLowerCase()}; follow-on work opened.`)),
          h('div.card', null, h('div.kicker', null, 'Visit window timeline (black = AWW app, pink = ASHA IVR)'), tl),
          h('div.card', null, h('div.kicker', null, 'AWW — Tracker companion card'),
            h('div.row', { style: { gap: '6px', marginTop: '6px' } },
              ['VISITED', 'REFERRED', 'REFUSED', 'MIGRATED'].map((o) => h('button.btn.sm' + (o === 'VISITED' ? '' : '.ghost'), { disabled: !!t.closures.find((x) => x.by === 'AWW'), onclick: () => { store.close(t, { by: 'AWW', t: store.now, outcome: o, channel: 'APP' }); } }, o.toLowerCase()))),
            h('div.small.muted', { style: { marginTop: '6px' } }, 'The re-weigh itself is entered in the Tracker as today; this flag only records the visit.')),
          t.tier === 'RED_B' ? h('div.card', null, h('div.kicker', null, 'CMAM 2023 milestones — RED-B closes only when both are on record'),
            h('div.row', { style: { gap: '6px', marginTop: '6px', flexWrap: 'wrap' } },
              h('button.btn.sm', { disabled: !!t.milestones.find((m) => m.kind === 'APPETITE_TEST'), onclick: () => milestone(t, 'APPETITE_TEST', 'PASS') }, 'Appetite test: pass'),
              h('button.btn.sm.ghost', { disabled: !!t.milestones.find((m) => m.kind === 'APPETITE_TEST'), onclick: () => milestone(t, 'APPETITE_TEST', 'FAIL') }, 'Appetite test: fail → RED-A'),
              h('button.btn.sm', { disabled: !!t.milestones.find((m) => m.kind === 'MO_SCREEN'), onclick: () => milestone(t, 'MO_SCREEN', 'SCREENED') }, 'MO screened at PHC')),
            h('div.small', { style: { marginTop: '6px' } }, e.missing?.length ? `Still missing: ${e.missing.map((m) => m === 'APPETITE_TEST' ? 'appetite test (72 h)' : 'MO screening (day 5)').join(', ')}.` : 'Both milestones recorded.')) : null),
        phone);
    }

    function phoneUI(t, c, awc) {
      const L = LANGS[lang];
      const ref = c.pseudoId.slice(-4).split('').join(' ');
      const asha = t.closures.find((x) => x.by === 'ASHA');
      const screen = h('div', { style: { background: '#c9e2b3', border: '2px solid var(--ink)', height: '168px', padding: '8px', fontFamily: 'var(--font-pixel)', fontSize: '17px', lineHeight: 1.15, overflow: 'auto', boxShadow: 'inset 3px 3px 0 rgba(0,0,0,.15)' } },
        calling ? [h('div', null, '☎ PoshanSetu IVR  1800-XXX'), h('div', { style: { fontFamily: L.font, fontSize: lang === 'hi' ? '13px' : '15px', marginTop: '4px' } }, L.prompt(awc.name, ref)), lastKey ? h('div', { style: { marginTop: '6px' } }, `> key ${lastKey}: ${OUT[lastKey]} — logged`) : h('div.pulse', { style: { marginTop: '6px' } }, '_ awaiting key')]
          : asha ? [h('div', null, 'TASK CLOSED BY YOU'), h('div', null, `key ${asha.dtmf} · ${asha.outcome}`), h('div', null, fmtDateTime(asha.t))]
            : [h('div', null, `SMS from PoshanSetu`), h('div', { style: { marginTop: '4px' } }, `Ghar bhent: bachcha ${ref}, AWC ${awc.name}. ${Math.max(0, Math.round((t.dueAt - store.now) / DAY))} din baaki.`), h('div', { style: { marginTop: '6px' } }, '[CALL] to hear the task')]);
      const key = (k, sub) => h('button', { onclick: () => press(k), style: { height: '38px', border: '2px solid var(--ink)', background: k === 'call' ? '#7fd48a' : k === 'end' ? '#ff8b8b' : 'var(--white)', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', boxShadow: '2px 2px 0 var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 } }, k === 'call' ? '☎' : k === 'end' ? '✕' : k, sub ? h('span', { style: { fontSize: '8px', fontWeight: 400 } }, sub) : null);
      function press(k) {
        if (k === 'call') { calling = true; lastKey = null; const r = promptTask(lang, c.pseudoId.slice(-4)); audioMode = r.mode === 'os-voice' ? `OS voice: ${r.voice}` : (lang === 'hi' || lang === 'en' ? 'recorded clips' : 'recorded Hindi clips (Santali/Ho/Mundari recordings pending)'); render(); return; }
        if (k === 'end') { calling = false; stopAudio(); render(); return; }
        if (!calling || !OUT[k] || asha) return;
        lastKey = k;
        confirmKey(lang, Number(k));
        store.close(t, { by: 'ASHA', t: store.now, dtmf: Number(k), channel: 'IVR' });
      }
      return h('div', { style: { flex: '0 0 250px' } },
        h('div.kicker', { style: { marginBottom: '6px' } }, `ASHA phone · ${awc.asha}`),
        h('div', { style: { background: '#2b2427', border: '2px solid var(--ink)', borderRadius: '26px 26px 14px 14px', padding: '18px 14px 16px', boxShadow: 'var(--shadow)' } },
          h('div', { style: { color: '#f6a3b7', fontFamily: 'var(--font-pixel)', fontSize: '15px', textAlign: 'center', marginBottom: '6px' } }, '▪ ▪ ▪  NOKIA-ish 105  ▪ ▪ ▪'),
          screen,
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '7px', marginTop: '12px' } },
            key('call'), h('div'), key('end'),
            key('1', 'visited'), key('2', 'referred'), key('3', 'refused'), key('4', 'migrated'), key('5'), key('6'), key('7'), key('8'), key('9'), key('*'), key('0'), key('#'))),
        h('div.seg', { style: { marginTop: '10px', flexWrap: 'wrap' } }, Object.entries(LANGS).map(([k, v]) => h('button', { class: lang === k ? 'on' : '', style: { fontFamily: v.font }, onclick: () => { lang = k; render(); } }, v.label))),
        calling && audioMode ? h('div.small.mono', { style: { marginTop: '6px' } }, `🔊 ${audioMode}`) : null,
        h('div.small.muted', { style: { marginTop: '6px' } }, 'Works on any feature phone. No app, no data pack, no new payment. Missed call-back if the line drops.'));
    }

    function milestone(t, kind, result) {
      store.milestone(t.id, kind, result);
      if (kind === 'APPETITE_TEST' && result === 'FAIL') {
        // Failed appetite test = complicated SAM: same-day referral under a new RED-A task.
        store.capture(t.childId, { ...(() => { const v = store.childById[t.childId].eval.lastValid; return { weightKg: v.weightKg, heightCm: v.heightCm, lying: v.lying, muacMm: v.muacMm }; })(), appetite: 'FAIL', danger: [], oedema: false });
      }
      store.emit('task', t);
    }
    render();
    ctx.setRefresh((o) => { if (o?.taskId) { sel = o.taskId; filter = 'ALL'; } render(); });
    ctx.onCleanup(stopAudio);
    ctx.onCleanup(store.on('task', render));
    ctx.onCleanup(store.on('tick', render));
    ctx.onCleanup(store.on('role', () => { sel = null; render(); }));
  },
};
