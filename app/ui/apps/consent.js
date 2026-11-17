import { h, mount, s } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';
import { tierChip, nameOf, fmtDate, DAY } from '../common.js';
import { consentStatus, gateSignals, FLAG_DICTIONARY, MODES } from '../../engine/consent.js';
import { wellnessBundle } from '../../engine/fhir.js';
import { evaluate } from '../../engine/triage.js';

export function jsonView(obj) {
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = esc(JSON.stringify(obj, null, 2))
    .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span style="color:#e94fbf">$1</span>$2')
    .replace(/: ("(?:[^"\\]|\\.)*")/g, ': <span style="color:#9fe0b8">$1</span>')
    .replace(/: (-?\d+\.?\d*|true|false|null)/g, ': <span style="color:#ffd27a">$1</span>');
  return h('pre', { html, style: { margin: 0, padding: '10px', background: 'var(--ink)', color: '#f2eef0', fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: 1.45, overflow: 'auto', maxHeight: '100%' } });
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
    let childId = opts.childId || null, view = 'artefact', impact = null;
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
              h('div.seg', null, [['artefact', 'Consent artefact'], ['fhir', 'FHIR R4 bundle']].map(([k, l]) => h('button', { class: view === k ? 'on' : '', onclick: () => { view = k; render(); } }, l)))),
            c ? h('div.row.wrap', { style: { gap: '6px' } },
              tierChip(c.current?.tier || 'GREEN'), h('span.tag' + (cs.usable ? '.ok' : '.bad'), null, `consent ${cs.state.toLowerCase()}`), h('span.tag', null, `${c.signals.length} signals used · ${c.signalsWithheld.length} withheld`),
              h('div.grow'),
              c.consent && cs.usable ? h('button.btn.sm.ghost', { onclick: () => applyConsent(c, 'revoke') }, 'Guardian revokes') : null,
              c.consent && !cs.usable ? h('button.btn.sm', { onclick: () => applyConsent(c, 'renew') }, 'Renew at VHSND') : null,
              !c.consent ? h('button.btn.sm', { onclick: () => applyConsent(c, 'grant') }, 'Record OTP consent') : null,
              h('button.btn.sm.ghost', { onclick: () => open('child', { childId: c.id }) }, 'Open record')) : null,
            impact ? h('div.callout', null, h('b', null, 'Effect on triage: '), impact) : null,
            h('div.grow', { style: { minHeight: 0, overflow: 'auto', border: '2px solid var(--ink)' } }, right))));
    }

    function applyConsent(c, kind) {
      const before = c.current?.tier;
      if (kind === 'revoke') c.consent.revokedAt = store.now;
      if (kind === 'renew') { c.consent.revokedAt = null; c.consent.expiresAt = store.now + 180 * DAY; c.consent.reconfirmedAt = store.now; }
      if (kind === 'grant') c.consent = { id: `CA-${c.id}-N`, childId: c.id, guardian: c.mother, mode: 'OTP', purpose: { code: 'CAREMGT', text: 'Care management — early warning of child undernutrition' }, hiTypes: ['WellnessRecord', 'ImmunizationRecord'], hip: 'U-WIN / RCH (MoHFW)', hiu: 'PoshanSetu (MoWCD)', flags: Object.keys(FLAG_DICTIONARY), grantedAt: store.now - 400 * DAY, expiresAt: store.now + 180 * DAY, reconfirmBy: null, reconfirmedAt: null, revokedAt: null };
      const g = gateSignals(c.signalsRaw, c.consent, store.now);
      // revocation applies from now on: past signals used under valid consent stay in the audit trail, but new evaluations stop using them
      c.signals = kind === 'revoke' ? [] : g.allowed; c.signalsWithheld = kind === 'revoke' ? c.signalsRaw.map((x) => ({ ...x, why: 'Guardian revoked consent' })) : g.withheld;
      const ev = evaluate(c, c.events, c.signals, store.pack, { feedR: store.sim.feeds[c.awcId].R });
      c.eval = ev; c.current = ev.current;
      store.audit.append({ at: store.now, actor: store.actorName(), role: store.role, action: 'CONSENT_' + kind.toUpperCase(), subject: c.id, detail: c.consent?.id });
      impact = before === c.current?.tier ? `tier unchanged (${before}). Flags now ${kind === 'revoke' ? 'withheld' : 'available'} for future evaluations.` : `tier ${before} → ${c.current?.tier}. Rules re-ran without/with the consented flags.`;
      store.emit('child', c.id);
      render();
    }

    render();
    ctx.setRefresh((o) => { if (o?.childId) { childId = o.childId; impact = null; } render(); });
    ctx.onCleanup(store.on('role', () => { childId = null; render(); }));
  },
};
