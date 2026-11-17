import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { jsonView } from './consent.js';
import { verifyPack, diffPacks, deepClone, setPath } from '../../engine/rulepack.js';
import { signDoc } from '../../engine/signing.js';
import { publicKeyFingerprint } from '../../engine/signing.js';
import { generate } from '../../engine/simulate.js';

const KNOBS = [
  ['trend.whzDropSd', 'Rule 2 · WHZ drop that triggers (SD)', 0.3, 0.8, 0.05],
  ['anthropometry.muacMamMm', 'MAM MUAC upper cut-off (mm)', 120, 130, 1],
  ['trend.signalTrendDropSd', 'Trend needed with a health signal (SD)', 0.1, 0.5, 0.05],
  ['workload.newAmberCapPerAwcPerMonth', 'New AMBER visit cap per AWC / month', 1, 6, 1],
  ['migration.ltfuDays', 'Lost-to-follow-up after (days)', 30, 75, 5],
  ['reliability.cutoff', 'Re-measure-first cutoff (R)', 70, 95, 1],
];
const get = (o, p) => p.split('.').reduce((a, k) => a[k], o);

export default {
  id: 'rulepack', title: 'Rule pack — versioned, dual-signed', icon: ICONS.pack, dock: 'Rule pack', desk: 'Rule pack', size: [1100, 700], key: 'r',
  mount(ctx) {
    let draft = null, draftSigs = [], verify = null, bt = null, running = false, view = 'diff';
    verifyPack(store.signed).then((v) => { verify = v; render(); });
    function render() {
      const live = store.signed;
      const base = live.pack;
      const d = draft ? diffPacks(base, draft) : [];
      const signedBy = new Set(draftSigs.map((s) => s.signer));
      const m0 = store.sim.metrics;
      mount(ctx.body,
        h('div.toolbar', null, h('b', null, `${base.id}@${base.version}`), h('span.small', null, `effective ${base.effectiveFrom} · owners MoWCD + MoHFW · every alert carries this version`), h('div.grow'),
          verify ? h('span.tag' + (verify.ok ? '.ok' : '.bad'), null, verify.ok ? '✓ both signatures valid' : '✗ signature invalid') : h('span.tag', null, 'verifying…')),
        h('div.row', { style: { alignItems: 'stretch', gap: 0, height: 'calc(100% - 38px)' } },
          h('div', { style: { width: '440px', borderRight: '2px solid var(--ink)', overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--white)' } },
            h('div.card.flat', null, h('div.kicker', null, 'Signatures on the live pack'),
              live.signatures.map((sg) => h('div.reason', null, h('span.tag.dark', null, sg.signer), h('div.mono.small', null, `${sg.alg} · key ${publicKeyFingerprint(sg.signer)}`), h('div.rule', null, `digest ${sg.digest.slice(0, 32)}…`))),
              h('div.small.muted', null, 'Demo keys. In production: CCA-licensed eSign / HSM; public keys published so any AWC device can verify offline.')),
            h('div.card.flat', null, h('div.kicker', null, 'Changelog 1.0.0 → 2.0.0 (the Round 2 fixes)'), base.changelog.map((c) => h('div.p.small', { style: { padding: '3px 0', borderBottom: '1px dashed #ccc' } }, '▸ ', c))),
            h('div.card', null, h('div.kicker', null, 'Propose a calibration (Phase 1 workflow)'),
              h('div.col', { style: { gap: '8px', marginTop: '8px' } }, KNOBS.map(([p, label, min, max, step]) => {
                const v = get(draft || base, p);
                return h('label.field', null, h('span', null, `${label}: `, h('b', null, v), draft && v !== get(base, p) ? h('span', { style: { color: 'var(--hot)' } }, ` (was ${get(base, p)})`) : null),
                  h('input', { type: 'range', min, max, step, value: v, oninput: (e) => { if (!draft) { draft = deepClone(base); draft.version = base.version.split('.').map((x, i) => (i === 1 ? +x + 1 : i === 2 ? 0 : x)).join('.'); draft.supersedes = base.version; draft.changelog = ['Calibration proposal from Phase 1 backtest.']; } setPath(draft, p, +e.target.value); draftSigs = []; bt = null; render(); } }));
              })),
              draft ? h('div.row.wrap', { style: { gap: '6px', marginTop: '10px' } },
                h('button.btn.sm.hot', { disabled: running, onclick: runBacktest }, running ? 'Running…' : 'Re-run silent-trial backtest'),
                h('button.btn.sm' + (signedBy.has('MoWCD') ? '.ghost' : ''), { disabled: signedBy.has('MoWCD'), onclick: () => sign('MoWCD') }, signedBy.has('MoWCD') ? 'MoWCD ✓' : 'Sign as MoWCD'),
                h('button.btn.sm' + (signedBy.has('MoHFW') ? '.ghost' : ''), { disabled: signedBy.has('MoHFW'), onclick: () => sign('MoHFW') }, signedBy.has('MoHFW') ? 'MoHFW ✓' : 'Sign as MoHFW'),
                h('button.btn.sm.ghost', { onclick: () => { draft = null; draftSigs = []; bt = null; render(); } }, 'Discard')) : null,
              draft ? h('div.small', { style: { marginTop: '6px' } }, signedBy.size === 2 ? h('b', { style: { color: 'var(--green)' } }, 'Both ministries signed — the pack can be activated.') : `Needs ${2 - signedBy.size} more signature(s). One ministry alone cannot change a threshold.`) : null,
              draft && signedBy.size === 2 ? h('button.btn.hot', { style: { marginTop: '8px' }, onclick: async () => { await store.activatePack({ pack: draft, signatures: draftSigs }); draft = null; draftSigs = []; bt = null; verify = await verifyPack(store.signed); render(); } }, `Activate ${draft.version} ▸`) : null)),
          h('div.grow.col', { style: { padding: '12px', gap: '10px', minWidth: 0 } },
            h('div.seg', { style: { alignSelf: 'flex-start' } }, [['diff', 'Diff & impact'], ['json', 'Pack JSON']].map(([k, l]) => h('button', { class: view === k ? 'on' : '', onclick: () => { view = k; render(); } }, l))),
            view === 'json' ? h('div.grow', { style: { minHeight: 0, overflow: 'auto', border: '2px solid var(--ink)' } }, jsonView(draft || base)) :
              h('div.col', { style: { gap: '10px' } },
                h('div.card', null, h('div.kicker', null, draft ? `Diff ${base.version} → ${draft.version} (draft)` : 'No draft — move a slider to propose a change'),
                  d.filter((x) => !['version', 'supersedes', 'changelog'].includes(x.path)).map((x) => h('div.row', { style: { gap: '10px', padding: '4px 0', borderBottom: '1px dashed #ccc', fontFamily: 'var(--font-mono)', fontSize: '12px' } }, h('b', { style: { width: '260px' } }, x.path), h('span', { style: { textDecoration: 'line-through', color: 'var(--muted)' } }, JSON.stringify(x.from)), '→', h('b', { style: { color: 'var(--hot)' } }, JSON.stringify(x.to))))),
                h('div.card', null, h('div.kicker', null, 'Backtest impact (same synthetic district, 12 months, alerts silent)'),
                  h('table.grid', { style: { marginTop: '6px' } }, h('thead', null, h('tr', null, h('th', null, 'Metric'), h('th.num', null, `live ${base.version}`), h('th.num', null, 'draft'))),
                    h('tbody', null, [
                      ['SAM cases flagged earlier', (m) => `${Math.round(m.shareEarlier * 100)}%`],
                      ['Median lead time (days)', (m) => Math.round(m.leadMedian)],
                      ['Alert precision', (m) => `${Math.round(m.precision * 100)}%`],
                      ['AMBER+RED alerts / year', (m) => m.alerts.toLocaleString('en-IN')],
                      ['AWC-months over visit cap', (m) => `${m.amberPerAwcMonth.overCap} / ${m.amberPerAwcMonth.cells}`],
                    ].map(([l, f]) => h('tr', null, h('td', null, l), h('td.num', null, f(m0)), h('td.num', null, bt ? h('b', null, f(bt)) : '—')))))),
                h('div.callout', null, h('b', null, 'Why rules, not ML: '), 'every alert must be explainable to an AWW and defensible to a CDPO, and no public child-level training data exist. Calibration changes thresholds in a signed, versioned pack — never code — and every alert shows the version that produced it.')))));
    }
    async function runBacktest() {
      running = true; render();
      await new Promise((r) => setTimeout(r, 30));
      bt = generate({ pack: draft }).metrics;
      running = false;
      store.audit.append({ at: store.now, actor: store.actorName(), role: store.role, action: 'BACKTEST', subject: draft.version, detail: `earlier ${Math.round(bt.shareEarlier * 100)}% · lead ${Math.round(bt.leadMedian)} d` });
      render();
    }
    async function sign(who) {
      draftSigs.push(await signDoc(who, draft));
      store.audit.append({ at: store.now, actor: who, role: 'MINISTRY', action: 'SIGN_PACK', subject: draft.version });
      render();
    }
    render();
    ctx.onCleanup(store.on('pack', render));
  },
};
