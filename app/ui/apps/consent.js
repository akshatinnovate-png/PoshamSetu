import { h, mount, s } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';
import { tierChip, nameOf, fmtDate, DAY } from '../common.js';
import { consentStatus, gateSignals, FLAG_DICTIONARY, MODES } from '../../engine/consent.js';
import { wellnessBundle } from '../../engine/fhir.js';
import { evaluate } from '../../engine/triage.js';
import { runHieFlow, hipBundle } from '../../engine/abdm.js';

export function jsonView(obj) {
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = esc(JSON.stringify(obj, null, 2))
    .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span style="color:#e94fbf">$1</span>$2')
    .replace(/: ("(?:[^"\\]|\\.)*")/g, ': <span style="color:#9fe0b8">$1</span>')
    .replace(/: (-?\d+\.?\d*|true|false|null)/g, ': <span style="color:#ffd27a">$1</span>');
  return h('pre', { html, style: { margin: 0, padding: '10px', background: 'var(--ink)', color: '#f2eef0', fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: 1.45, overflow: 'auto', maxHeight: '100%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } });
}

const DPDP = [
  [Date.UTC(2023, 7, 11), 'DPDP Act 2023 assented'],
  [Date.UTC(2025, 10, 13), 'DPDP Rules notified'],
  [Date.UTC(2026, 10, 13), 'Consent-manager rules in force'],
  [Date.UTC(2027, 4, 13), 'Main duties incl. children\'s data'],
];

export default {
  id: 'consent', title: 'Consent & FHIR — share flags, not records', icon: ICONS.consent, dock: 'Consent', desk: 'Consent', size: [1080, 680], key: 'k',
  mount(ctx, opts) {
    let childId = opts.childId || null, view = opts.view || 'artefact', impact = null, hie = null, hieSel = null, hieBusy = false;
    function render() {
      const kids = store.children();
      if (!childId || !store.childById[childId] || !store.inScope(store.childById[childId])) childId = (kids.find((c) => c.signals.length && c.consent) || kids[0])?.id;
      const c = store.childById[childId];
      const stats = {};
      for (const k of kids) { const st = consentStatus(k.consent, store.now); const key = (k.consent?.mode || 'NONE') + '|' + st.state; stats[key] = (stats[key] || 0) + 1; }
      const modes = ['ABHA', 'OTP', 'ASSISTED', 'NONE'], states = ['ACTIVE', 'LAPSED', 'EXPIRED', 'REVOKED', 'NONE'];
      // DPDP timeline
      const t0 = DPDP[0][0], t1 = DPDP[3][0] + 120 * DAY, W = 480, X = (t) => 14 + ((t - t0) / (t1 - t0)) * (W - 28);
      const tl = s('svg', { viewBox: `0 0 ${W} 86`, width: '100%', style: 'display:block;max-width:560px;font-family:var(--font-mono)' });
      tl.append(s('line', { x1: 14, x2: W - 14, y1: 40, y2: 40, stroke: '#1f1b1d', 'stroke-width': 2 }));
      DPDP.forEach(([t, l], i) => { tl.append(s('rect', { x: X(t) - 5, y: 35, width: 10, height: 10, fill: t <= store.now ? '#1f1b1d' : '#fff', stroke: '#1f1b1d', 'stroke-width': 1.5 }), s('text', { x: X(t), y: i % 2 ? 66 : 24, 'text-anchor': 'middle', 'font-size': 9 }, l), s('text', { x: X(t), y: i % 2 ? 78 : 12, 'text-anchor': 'middle', 'font-size': 8.5, fill: '#6d6266' }, fmtDate(t))); });
      tl.append(s('line', { x1: X(store.now), x2: X(store.now), y1: 28, y2: 52, stroke: '#e94fbf', 'stroke-width': 3 }));

      const cs = c ? consentStatus(c.consent, store.now) : null;
      let right;
      if (!c) right = h('div.empty', null, 'No child');
      else if (view === 'artefact') right = c.consent ? jsonView({ consentArtefact: { ...c.consent, grantedAt: new Date(c.consent.grantedAt).toISOString(), expiresAt: new Date(c.consent.expiresAt).toISOString(), reconfirmBy: c.consent.reconfirmBy && new Date(c.consent.reconfirmBy).toISOString(), reconfirmedAt: c.consent.reconfirmedAt && new Date(c.consent.reconfirmedAt).toISOString(), revokedAt: c.consent.revokedAt && new Date(c.consent.revokedAt).toISOString() }, status: cs }) : h('div.empty', null, 'No consent artefact. Health flags are withheld; only Tracker data (DPDP s.7(b), State benefits) is used.');
      else if (view === 'hie') right = hieView(c);
      else right = jsonView(wellnessBundle(c, c.eval.visits, c.current, cs.usable ? c.consent : null));

      mount(ctx.body,
        h('div.toolbar', null, h('b', null, 'Share flags, not records.'), h('span.small', null, 'Cross-ministry signals pass only under an ABDM consent artefact: one purpose, set time, renewed at later contacts.')),
        h('div.row', { style: { alignItems: 'stretch', gap: 0, height: 'calc(100% - 38px)' } },
          h('div', { style: { width: '470px', borderRight: '2px solid var(--ink)', overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--white)' } },
            h('div.card.flat', null, h('div.kicker', null, `Consent ledger · ${store.scopeLabel()}`),
              h('table.grid', { style: { marginTop: '6px' } }, h('thead', null, h('tr', null, h('th', null, 'Mode'), ...states.map((x) => h('th.num', null, x.toLowerCase())))),
                h('tbody', null, modes.map((m) => h('tr', null, h('td', null, h('b', null, m), h('div.small.muted', null, MODES[m]?.label || 'no artefact — flags withheld')), ...states.map((st) => h('td.num', null, stats[m + '|' + st] || '·'))))))),
            h('div.card.flat', null, h('div.kicker', null, 'Published data dictionary (NDGFP) — the only flags that may cross'),
              Object.entries(FLAG_DICTIONARY).map(([k, v]) => h('div.reason', null, h('span.tag.dark', null, k), h('div', null, h('b', null, v.label), ` — ${v.minimal}`), h('div.rule', null, `${v.source} · FHIR ${v.fhir}`)))),
            h('div.card.flat', null, h('div.kicker', null, 'DPDP timeline — built to comply before duties start'), tl,
              h('div.small', { style: { marginTop: '4px' } }, 'Processing inside the Tracker: s.7(b) State benefits. Cross-ministry: ABDM consent. Rule 10 verifiable guardian consent and any s.9 exemption to be confirmed with MoWCD + NHA. Dashboards above block level suppress counts < 20; every child-level view is hash-chain logged.'))),
          h('div.grow.col', { style: { padding: '12px', gap: '10px', minWidth: 0 } },
            h('div.row', { style: { gap: '8px', flexWrap: 'wrap' } },
              h('select.input', { onchange: (e) => { childId = e.target.value; impact = null; render(); } }, kids.slice(0, 400).map((k) => h('option', { value: k.id, selected: k.id === childId }, `${nameOf(k)} · ${k.consent?.mode || 'no consent'} · ${k.current?.tier || '—'}`))),
              h('div.seg', null, [['artefact', 'Consent artefact'], ['fhir', 'FHIR R4 bundle'], ['hie', 'ABDM exchange (live)']].map(([k, l]) => h('button', { class: view === k ? 'on' : '', onclick: () => { view = k; render(); } }, l)))),
            c ? h('div.row.wrap', { style: { gap: '6px' } },
              tierChip(c.current?.tier || 'GREEN'), h('span.tag' + (cs.usable ? '.ok' : '.bad'), null, `consent ${cs.state.toLowerCase()}`), h('span.tag', null, `${c.signals.length} signals used · ${c.signalsWithheld.length} withheld`),
              h('div.grow'),
              c.consent && cs.usable ? h('button.btn.sm.ghost', { onclick: () => applyConsent(c, 'revoke') }, 'Guardian revokes') : null,
              c.consent && !cs.usable ? h('button.btn.sm', { onclick: () => applyConsent(c, 'renew') }, 'Renew at VHSND') : null,
              !c.consent || !cs.usable ? h('button.btn.sm.hot', { onclick: async () => { const mode = await consentFlow(c); if (mode) applyConsent(c, 'grant', mode); } }, 'Capture consent (guided)') : null,
              h('button.btn.sm.ghost', { onclick: () => open('child', { childId: c.id }) }, 'Open record')) : null,
            impact ? h('div.callout', null, h('b', null, 'Effect on triage: '), impact) : null,
            h('div.grow', { style: { minHeight: 0, overflow: 'auto', border: '2px solid var(--ink)' } }, right))));
    }

    async function runHie(c, approve) {
      hieBusy = true; render();
      const vaccines = store.sim.district.history.vaccines.filter((v) => v.childId === c.id);
      hie = { childId: c.id, ...(await runHieFlow({ child: c, fhirBundle: hipBundle(c, vaccines, c.signalsRaw), now: store.now, approve, allowedFlags: c.consent?.flags })) };
      hieSel = hie.log.length - 1; hieBusy = false;
      store.log({ at: store.now, actor: 'PoshanSetu HIU', role: 'HIU', action: 'ABDM_HIE', subject: c.id, detail: `${hie.status} · ${hie.flags.length} flags · checksum ${hie.checksumOk ? 'ok' : 'n/a'}` });
      render();
    }
    function hieView(c) {
      const lanes = ['HIU', 'CM', 'PHR', 'HIP'];
      const laneName = { HIU: 'PoshanSetu (HIU)', CM: 'ABDM consent manager', PHR: 'Guardian PHR app', HIP: 'U-WIN / RCH (HIP)' };
      const top = h('div.row.wrap', { style: { gap: '8px', padding: '10px', background: 'var(--white)', borderBottom: '2px solid var(--ink)' } },
        h('button.btn.sm.hot', { disabled: hieBusy, onclick: () => runHie(c, true) }, hieBusy ? 'running…' : '▶ Run exchange — guardian approves'),
        h('button.btn.sm.ghost', { disabled: hieBusy, onclick: () => runHie(c, false) }, 'Guardian denies'),
        h('span.small', null, 'v0.5 gateway shapes · X25519 ECDH + HKDF-SHA256 + AES-256-GCM (Fidelius-style) · simulated network, real crypto'));
      if (!hie || hie.childId !== c.id) return h('div', null, top, h('div.empty', null, 'Run the exchange to see every message between PoshanSetu, the consent manager, the guardian and U-WIN.'));
      const W = 600, rowH = 26, H = 50 + hie.log.length * rowH;
      const X = (l) => 66 + lanes.indexOf(l) * ((W - 132) / 3);
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'display:block;max-width:900px;font-family:var(--font-mono)' });
      svg.append(s('defs', null, s('marker', { id: 'ha', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, s('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#1f1b1d' }))));
      for (const l of lanes) { svg.append(s('rect', { x: X(l) - 62, y: 4, width: 124, height: 26, fill: l === 'HIU' ? '#e94fbf' : '#1f1b1d' }), s('text', { x: X(l), y: 21, 'text-anchor': 'middle', 'font-size': 9.5, fill: '#fff' }, laneName[l]), s('line', { x1: X(l), x2: X(l), y1: 30, y2: H, stroke: '#1f1b1d', 'stroke-dasharray': '3 3', 'stroke-opacity': 0.4 })); }
      hie.log.forEach((m, i) => {
        const y = 48 + i * rowH, x1 = X(m.from), x2 = X(m.to);
        const g = s('g', { style: 'cursor:pointer' });
        g.append(s('rect', { x: Math.min(x1, x2) - 4, y: y - 14, width: Math.abs(x2 - x1) + 8, height: 22, fill: i === hieSel ? '#d3e8fb' : 'transparent' }));
        g.append(s('line', { x1, x2: x2 + (x2 > x1 ? -4 : 4), y1: y, y2: y, stroke: m.api.includes('transfer') ? '#e94fbf' : '#1f1b1d', 'stroke-width': m.api.includes('transfer') ? 3 : 1.5, 'marker-end': 'url(#ha)' }));
        g.append(s('text', { x: Math.min(x1, x2) + 8, y: y - 4, 'text-anchor': 'start', 'font-size': 9.5, stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, `${m.seq}. ${m.api.replace('POST ', '')}`));
        g.addEventListener('click', () => { hieSel = i; render(); });
        svg.append(g);
      });
      const m = hie.log[hieSel];
      return h('div', null, top,
        h('div.row', { style: { alignItems: 'flex-start', gap: 0 } },
          h('div', { style: { flex: '1 1 60%', padding: '10px', background: 'var(--white)' } }, svg,
            h('div.callout', { style: { marginTop: '8px' } }, hie.status === 'TRANSFERRED'
              ? [h('b', null, `Transferred and decrypted (checksum ${hie.checksumOk ? 'OK' : 'FAILED'}). `), `${hie.resourceCount} FHIR resources arrived; ${hie.flags.length} minimal flag(s) kept: ${hie.flags.map((f) => f.type.toLowerCase() + (f.antigen ? ' ' + f.antigen : '')).join(', ') || 'none'}. Everything else was discarded.`]
              : [h('b', null, 'Denied. '), 'No artefact was issued, so nothing moved. PoshanSetu keeps working on Tracker data alone.'])),
          h('div', { style: { flex: '1 1 40%', minWidth: 0, borderLeft: '2px solid var(--ink)' } },
            h('div', { style: { padding: '6px 10px', background: 'var(--paper-2)', fontFamily: 'var(--font-mono)', fontSize: '11px' } }, h('b', null, `${m.seq}. ${m.from} → ${m.to}`), h('div', null, m.api), m.note ? h('div.muted', null, m.note) : null),
            h('div', { style: { maxHeight: '420px', overflow: 'auto' } }, jsonView(m.payload)))));
    }
    function applyConsent(c, kind, mode = 'OTP') {
      const r = store.applyConsent(c.id, kind, mode);
      impact = r.before === r.after ? `tier unchanged (${r.before}). Flags now ${kind === 'revoke' ? 'withheld' : 'available'} for future evaluations.` : `tier ${r.before} → ${r.after}. Rules re-ran without/with the consented flags.`;
      render();
    }


    render();
    ctx.setRefresh((o) => { if (o?.childId) { childId = o.childId; impact = null; } render(); });
    ctx.onCleanup(store.on('role', () => { childId = null; render(); }));
  },
};

const NOTICE_HI = [
  ['क्या लेंगे', 'सिर्फ़ चार संकेत: टीका छूटा है, 30 दिन में दस्त, जन्म के समय कम वज़न, माँ की जोखिम वाली गर्भावस्था। पूरा रिकॉर्ड नहीं।'],
  ['क्यों', 'आपके बच्चे का पोषण बिगड़ने से पहले आंगनवाड़ी दीदी और सहिया को समय पर बताने के लिए।'],
  ['कितने समय', '180 दिन, फिर अगली मुलाक़ात पर दोबारा पूछेंगे।'],
  ['आपका अधिकार', 'कभी भी मना कर सकते हैं — सेवाएँ और राशन बंद नहीं होंगे। शिकायत: ब्लॉक CDPO कार्यालय।'],
];
function consentFlow(c) {
  return new Promise((resolve) => {
    let step = 0, mode = c.abha ? 'ABHA' : c.phone ? 'OTP' : 'ASSISTED', code = String(100000 + Math.floor(Math.random() * 899999)), typed = '';
    const body = h('div', { style: { padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' } });
    const done = (v) => { scrim.remove(); resolve(v); };
    const scrim = h('div.scrim', null, h('div.win.focused', { style: { position: 'relative', width: '560px', minHeight: 0 } },
      h('div.tb', null, h('span.t', null, `Consent · ${c.mother} for ${c.pseudoId}`), h('button', { onclick: () => done(null) }, '×')), body));
    function draw() {
      const steps = ['Notice', 'Mode', mode === 'ASSISTED' ? 'Thumbprint' : 'Verify', 'Artefact'];
      body.replaceChildren(
        h('div.seg', null, steps.map((s2, i) => h('button', { class: i === step ? 'on' : '', disabled: true }, `${i + 1} ${s2}`))),
        ...(step === 0 ? [
          h('div.kicker', null, 'Itemised notice read aloud by the AWW (DPDP s.5) — Hindi; Ho / Santali / Mundari audio'),
          ...NOTICE_HI.map(([k, v]) => h('div.reason', { style: { gridTemplateColumns: '110px 1fr' } }, h('b', { style: { fontFamily: 'Noto Sans Devanagari' } }, k), h('div', { style: { fontFamily: 'Noto Sans Devanagari', fontSize: '13.5px' } }, v))),
          h('div.small.muted', null, 'Purpose: CAREMGT · flags only · HIU PoshanSetu (MoWCD) · HIP U-WIN / RCH (MoHFW)'),
          h('div.row', { style: { justifyContent: 'flex-end' } }, h('button.btn.ghost', { onclick: () => done(null) }, 'Guardian declines'), h('button.btn', { onclick: () => { step = 1; draw(); } }, 'Guardian agrees ▸'))]
        : step === 1 ? [
          h('div.kicker', null, 'How will the guardian confirm?'),
          ...[['ABHA', `Baal-ABHA via ABDM consent manager${c.abha ? '' : ' (no ABHA on record)'}`, c.abha], ['OTP', `OTP to guardian phone${c.phone ? ' ' + c.phone.slice(0, 6) + '•••••' : ' (no phone on record)'}`, !!c.phone], ['ASSISTED', 'Assisted: thumbprint on AWW device, reconfirm at next VHSND (Rule 10 check)', true]].map(([k, l, ok]) => h('label.row', { style: { gap: '8px', opacity: ok ? 1 : 0.4, fontSize: '13px' } }, h('input', { type: 'radio', name: 'm', checked: mode === k, disabled: !ok, onchange: () => { mode = k; } }), h('b', null, k), l)),
          h('div.row', { style: { justifyContent: 'flex-end' } }, h('button.btn', { onclick: () => { step = 2; draw(); } }, 'Next ▸'))]
        : step === 2 ? (mode === 'ASSISTED' ? [
          h('div.p', null, 'Guardian places thumb on the AWW device. A witness (ASHA or ward member) is recorded. This consent lapses unless reconfirmed at the next Village Health & Nutrition Day.'),
          h('div', { style: { width: '90px', height: '110px', border: '2px solid var(--ink)', borderRadius: '45px 45px 30px 30px', margin: '0 auto', background: 'repeating-radial-gradient(circle at 50% 60%, var(--ink) 0 2px, transparent 2px 6px)' } }),
          h('div.row', { style: { justifyContent: 'flex-end' } }, h('button.btn', { onclick: () => { step = 3; draw(); } }, 'Captured ▸'))]
          : [
          h('div.p', null, mode === 'ABHA' ? 'Consent request pushed to the guardian\'s ABHA app / PHR via the ABDM consent manager. Demo code:' : 'OTP sent by SMS. Demo code:'),
          h('div', { style: { fontFamily: 'var(--font-pixel)', fontSize: '34px', letterSpacing: '.2em', textAlign: 'center' } }, code),
          h('input.input', { placeholder: 'enter the 6-digit code', value: typed, oninput: (e) => { typed = e.target.value; } }),
          h('div.row', { style: { justifyContent: 'flex-end' } }, h('button.btn', { onclick: () => { if (typed.trim() === code) { step = 3; draw(); } else { typed = ''; draw(); body.querySelector('input').placeholder = 'wrong code — try again'; } } }, 'Verify ▸'))])
        : [
          h('div.callout', null, h('b', null, 'Artefact created. '), `${mode} · CAREMGT · 4 flags · 180 days${mode === 'ASSISTED' ? ' · reconfirm within 30 days' : ''}. Logged in the audit chain; the rules re-run with the newly permitted flags.`),
          h('div.row', { style: { justifyContent: 'flex-end' } }, h('button.btn.hot', { onclick: () => done(mode) }, 'Done'))]));
    }
    draw();
    document.body.appendChild(scrim);
  });
}
