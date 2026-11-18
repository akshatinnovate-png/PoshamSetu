import { h, mount, s } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';
import { tierChip, nameOf, fmtDate, fmtDateTime, DAY } from '../common.js';
import { tokenPayload, issueToken, verifyToken, MigrationRegistry, recoveryPlan, routeAggregates, ltfu } from '../../engine/migration.js';
import { DESTINATIONS } from '../../engine/simulate.js';
import QR from '../../vendor/qrcode.js';

export function qrSvg(text, size = 220) {
  const q = QR.create(text, { errorCorrectionLevel: 'M' });
  const n = q.modules.size, d = q.modules.data;
  const m = 4, u = size / (n + m * 2);
  let p = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d[y * n + x]) p += `M${(x + m) * u},${(y + m) * u}h${u}v${u}h-${u}z`;
  return s('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, style: 'display:block;background:#fff', 'shape-rendering': 'crispEdges' }, s('path', { d: p, fill: '#1f1b1d' }));
}

let registry = null;
store.on('regenerated', () => { registry = null; });
async function ensureRegistry() {
  if (registry) return registry;
  registry = new MigrationRegistry();
  for (const c of store.sim.district.children.filter((c) => c.migration?.announced)) {
    const tok = await issueToken(tokenPayload(c, c.eval.visits, c.current, { now: c.migration.depAt, validityDays: store.pack.migration.tokenValidityDays, destination: c.migration.destination.id }));
    c.token = tok;
    registry.register(tok, c.uidToken);
  }
  return registry;
}

export default {
  id: 'migration', title: 'Migration — continuity for kiln families', icon: ICONS.migrate, dock: 'Migration', desk: 'Migration', size: [1080, 700], key: '3',
  mount(ctx, opts) {
    let sel = opts.childId || null, tampered = false, verify = null, scenario = { hasPaper: false, phoneAlive: false, network: false, awcDeviceOnline: true, fingerprintsWorn: false }, bio = null, tab = 'token';
    let busy = true;
    ensureRegistry().then(() => { busy = false; render(); });

    function people() {
      const kids = store.children();
      const mig = kids.filter((c) => c.migration).map((c) => ({ c, kind: c.migration.announced ? 'announced' : 'unannounced' }));
      const lost = kids.filter((c) => c.lastMeasuredAt && ltfu(c.lastMeasuredAt, store.now, store.pack) && !(c.migration?.announced && c.migration.depAt < store.now && (!c.migration.retAt || c.migration.retAt > store.now)));
      return { mig, lost };
    }

    async function render() {
      if (busy) { mount(ctx.body, h('div.empty', null, 'Signing transfer tokens for announced migrants…')); return; }
      if (store.role === 'DPO' && tab === 'token') tab = 'routes';
      const { mig, lost } = people();
      if (!sel) sel = mig.find((x) => x.c.token)?.c.id;
      const c = store.childById[sel];
      mount(ctx.body,
        h('div.toolbar', null, h('span.fix', null, 'AUDIT FIX 03'), h('b', null, 'Paper lost. Phone dead. No signal at the kiln. The chain still holds.'),
          h('div.grow'), h('div.seg', null, [['token', 'Token & recovery'], ['routes', 'Advance notice (routes)']].map(([k, l]) => h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; render(); } }, l)))),
        tab === 'routes' ? routes() : h('div.row', { style: { alignItems: 'stretch', gap: 0, height: 'calc(100% - 38px)' } },
          h('div', { style: { width: '270px', borderRight: '2px solid var(--ink)', overflow: 'auto', background: 'var(--white)' } },
            h('div.kicker', { style: { padding: '8px 10px' } }, `Migrating children in scope (${mig.length})`),
            mig.map(({ c: k, kind }) => h('div', { onclick: () => { sel = k.id; verify = null; tampered = false; bio = null; render(); }, style: { padding: '7px 10px', borderTop: '1px dashed #bbb', cursor: 'pointer', background: k.id === sel ? 'var(--sky)' : '' } },
              h('div.row.between', null, h('b', null, nameOf(k)), k.current ? tierChip(k.current.tier) : null),
              h('div.small.muted', null, `${k.migration.destination.label}`),
              h('div.row', { style: { gap: '4px', marginTop: '3px' } }, h('span.tag' + (kind === 'announced' ? '.ok' : '.warn'), null, kind), k.token ? h('span.tag.dark', null, 'token') : h('span.tag', null, 'LTFU trace')))),
            h('div.kicker', { style: { padding: '12px 10px 6px' } }, `Lost to follow-up ≥ ${store.pack.migration.ltfuDays} d (${lost.length})`),
            lost.slice(0, 40).map((k) => h('div', { style: { padding: '6px 10px', borderTop: '1px dashed #bbb', cursor: 'pointer' }, onclick: () => open('child', { childId: k.id }) },
              h('div.row.between', null, h('span', null, nameOf(k)), h('span.tag.bad', null, `${Math.round((store.now - k.lastMeasuredAt) / DAY)} d`)),
              h('div.small.muted', null, 'AWW + ASHA trace task')))),
          c ? detail(c) : h('div.empty.grow', null, 'Select a child')));
    }

    function detail(c) {
      const tok = c.token;
      if (!tok) return h('div.grow.col', { style: { padding: '14px' } }, h('div.callout', null, h('b', null, 'Unannounced migration. '), `No token was issued. The ${store.pack.migration.ltfuDays}-day lost-to-follow-up rule is the main signal: AWW and ASHA get a trace task; if the family is found at a destination AWC, the mother's Aadhaar eKYC (below) pulls the home record.`),
        h('button.btn', { style: { alignSelf: 'flex-start' }, onclick: async () => { const t = await issueToken(tokenPayload(c, c.eval.visits, c.current, { now: store.now, validityDays: store.pack.migration.tokenValidityDays })); c.token = t; registry.register(t, c.uidToken); render(); } }, 'Issue token now (family announces move)'));
      const qrText = tampered ? tok.qr.slice(0, 30) + (tok.qr[30] === 'A' ? 'B' : 'A') + tok.qr.slice(31) : tok.qr;
      const plan = recoveryPlan(scenario);
      const toggle = (k, label) => h('label.row', { style: { gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', cursor: 'pointer' } }, h('input', { type: 'checkbox', checked: scenario[k], onchange: (e) => { scenario[k] = e.target.checked; bio = null; render(); } }), label);
      return h('div.grow', { style: { overflow: 'auto', padding: '12px', display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(320px, 1fr)', gap: '12px', alignContent: 'start' } },
        h('div.card', null,
          h('div.kicker', null, 'Signed transfer token · printed on the MCP card'),
          h('div.row', { style: { alignItems: 'flex-start', gap: '12px', marginTop: '8px' } },
            h('div', { style: { border: '2px solid var(--ink)', padding: '4px', background: '#fff' } }, qrSvg(qrText, 190)),
            h('div.col', { style: { gap: '6px' } },
              h('div', null, h('div.kicker', null, 'IVR short code'), h('div', { style: { fontFamily: 'var(--font-pixel)', fontSize: '34px', letterSpacing: '.06em' } }, tok.short)),
              h('div.small.mono', null, `${tok.bytes} chars · Ed25519 · expires ${fmtDate(tok.payload.e * 1000)}`),
              h('div.small.mono', null, `home AWC ${tok.payload.h} → ${tok.payload.d || 'unknown'}`),
              h('div.small.mono', null, `tier ${tok.payload.t} · ration ${tok.payload.r} · ${tok.payload.g.length} growth points`),
              h('div.row', { style: { gap: '6px', marginTop: '4px' } },
                h('button.btn.sm', { onclick: async () => { verify = await verifyToken(qrText, store.now); render(); } }, 'Verify offline'),
                h('button.btn.sm.ghost', { onclick: () => { tampered = !tampered; verify = null; render(); } }, tampered ? 'Restore' : 'Tamper 1 byte')))),
          verify ? h('div.callout', { style: { marginTop: '10px', borderColor: verify.ok ? 'var(--green)' : 'var(--red-a)' } }, h('b', null, verify.ok ? '✓ Valid — verified with no network. ' : '✗ Rejected — '), verify.ok ? 'Signature checked on-device against the PoshanSetu issuer public key; the destination AWC can load the growth curve and ration entitlement immediately.' : verify.why) : null,
          h('div.small.muted', { style: { marginTop: '8px' } }, 'The token carries a pseudonymous beneficiary ref, never a name or Aadhaar number.')),
        h('div.card', null,
          h('div.kicker', null, 'Kiln scenario — what is still working?'),
          h('div.col', { style: { gap: '4px', margin: '8px 0' } },
            toggle('hasPaper', 'Paper MCP card / QR still with family'), toggle('phoneAlive', 'Guardian phone charged & SIM active'), toggle('network', 'Mobile signal at the kiln'),
            toggle('awcDeviceOnline', 'Destination AWC tablet has data'), toggle('fingerprintsWorn', 'Mother\'s fingerprints worn by brick moulding')),
          plan.steps.map((st) => h('div.row', { style: { padding: '5px 6px', border: '1.5px solid ' + (st.id === plan.resolvedBy ? 'var(--ink)' : 'transparent'), background: st.id === plan.resolvedBy ? 'var(--pink-2)' : '', opacity: st.works ? 1 : 0.45, gap: '8px' } },
            h('span.tag' + (st.works ? '.ok' : '.bad'), null, st.works ? 'works' : 'fails'), h('div.grow', null, h('div', { style: { fontWeight: 600, fontSize: '12px' } }, st.label), h('div.small.muted', null, st.note)))),
          ['BIO_FP', 'BIO_FACE'].includes(plan.resolvedBy) ? h('div', { style: { marginTop: '10px' } },
            h('button.btn.hot', { onclick: () => runBio(c, plan.resolvedBy) }, plan.resolvedBy === 'BIO_FP' ? 'Scan mother\'s thumb (eKYC)' : 'Face RD authentication'),
            bio ? h('div.callout', { style: { marginTop: '8px' } }, bio.ok ? [h('b', null, `✓ Matched ${bio.modality}. `), `Registry returned ${bio.tokens.length} child token(s) for this mother. `, h('a', { href: '#', onclick: (e) => { e.preventDefault(); open('child', { childId: c.id }); } }, 'Open growth curve'), h('div.small.muted', null, 'Stored: salted hash of the UIDAI UID token only. Access logged.')] : h('span', null, '✗ ', bio.why)) : null) : null));
    }

    function runBio(c, mode) {
      const ekyc = { match: true, uidToken: c.uidToken, modality: mode === 'BIO_FP' ? 'fingerprint' : 'face' };
      const r = registry.lookupBiometric(ekyc, store.actorName());
      store.audit.append({ at: store.now, actor: store.actorName(), role: store.role, action: 'EKYC_LOOKUP', subject: c.id, detail: ekyc.modality });
      bio = { ...r, modality: ekyc.modality };
      render();
    }

    function routes() {
      const all = store.sim.district.history.migrations;
      const k = store.pack.privacy.kAnonMin;
      const label = (id) => DESTINATIONS.find((d) => d.id === id).label;
      // What leaves the district: totals per destination (all pilot blocks combined), k-anonymous.
      const shared = routeAggregates(all.map((m) => ({ fromBlock: 'Paschimi Singhbhum', destination: label(m.destination) })), k);
      // Home-side detail: only the viewer's own block (never shared).
      const ownBlock = store.role === 'CDPO' ? store.scope : null;
      const own = ownBlock ? routeAggregates(all.filter((m) => m.fromBlock === ownBlock).map((m) => ({ fromBlock: store.blockById[m.fromBlock].name, destination: label(m.destination) })), 1) : [];
      const max = Math.max(1, ...shared.map((a) => a.n));
      const bar = (n, sup) => h('div', { style: { width: Math.max(8, (n / max) * 240) + 'px', height: '12px', background: sup ? 'repeating-linear-gradient(45deg,#1f1b1d 0 2px,#fff 2px 5px)' : 'var(--hot)', border: '1.5px solid var(--ink)', display: 'inline-block', verticalAlign: 'middle' } });
      return h('div.col', { style: { padding: '14px', gap: '12px' } },
        h('div.callout', null, h('b', null, 'Advance notice. '), `Before the season, each destination CDPO receives the number of children expected from this district, so AWCs near kilns can plan THR stock and Migrate Beneficiary slots. Only district totals leave the district, and totals below ${k} are suppressed — no child is identifiable from what is shared.`),
        h('div.card', null, h('div.kicker', null, 'Shared with destination CDPOs (district totals)'),
          h('table.grid', { style: { marginTop: '6px' } }, h('thead', null, h('tr', null, h('th', null, 'Destination'), h('th', null, 'Sent'), h('th', null, ''))),
            h('tbody', null, shared.map((a) => h('tr', null, h('td', null, a.to), h('td', null, h('span.tag' + (a.suppressed ? '.warn' : '.ok'), null, a.shown)), h('td', null, a.suppressed ? h('span.small.muted', null, 'suppressed — below k') : bar(a.n, false))))))),
        ownBlock ? h('div.card', null, h('div.kicker', null, `Home-side planning detail · ${store.blockById[ownBlock].name} block only · not shared`),
          h('table.grid', { style: { marginTop: '6px' } }, h('thead', null, h('tr', null, h('th', null, 'Destination'), h('th', null, 'Children from your block'))),
            h('tbody', null, own.map((a) => h('tr', null, h('td', null, a.to), h('td', null, h('span.mono', null, a.n))))))) : h('div.small.muted', null, 'Block-level detail is visible to each home CDPO for their own block only.'),
        h('div.small.muted', null, 'Cross-state ration reallocation (Bihar, Odisha, Punjab, West Bengal) needs MoWCD guidance — a stated dependency, not assumed.'));
    }

    render();
    ctx.setRefresh((o) => { if (o?.childId) { sel = o.childId; verify = null; bio = null; tab = 'token'; } render(); });
    ctx.onCleanup(store.on('role', () => { sel = null; render(); }));
  },
};
