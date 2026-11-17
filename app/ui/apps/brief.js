// The Round 2 presentation checklist in one window: problem validation, ecosystem, stakeholders,
// roadmap, feasibility, scalability, impact. Figures are the proposal's cited sources.
import { h, mount, s } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';
import { pct } from '../common.js';
import { impactScenario } from '../../engine/impact.js';

const SC = { effect: 0.15, compliance: 0.8 };

const GAPS = [
  ['G1 Detection', '29.2%', 'of children had a wasting episode by 24 months, but only 5.6% were wasted at one time — one reading misses most of them.', '[6] Mertens et al., Nature 2023'],
  ['G2 Reporting', '5.2% vs 19.3%', 'wasting in Tracker data vs NFHS-5 (22.4% in Jharkhand). Not directly comparable — calls for a data-quality audit, not a claim of under-detection.', '[2], [5], [12]'],
  ['G3 Continuity', '43% vs 34%', 'wasting among interstate vs intrastate migrant children at Bihar brick kilns; fully immunised 39% vs 62%.', '[9] Roshania et al.'],
];
const DISTRICT = [['60.6%', 'stunting (highest in India)', '[4]'], ['62.4%', 'underweight (highest in India)', '[4]'], ['30.5%', 'wasting (NITI–IFPRI profile)', '[21]'], ['~2/3', 'population Scheduled Tribe (1.01 of 1.50 million)', '[15]'], ['52/100', 'SDG 2 Zero Hunger score vs 71 overall', '[1]']];
const ECOSYSTEM = [
  ['Poshan Tracker', 'Growth chart; SAM/underweight lists; home-visit & referral registers; Migrate Beneficiary', 'Lists from single readings; no trend rule, deadline task or reliability score; migration starts with the destination worker', 'Reads its events (API Setu); adds rules, tasks, clock'],
  ['U-WIN · RCH · ABDM', 'Vaccine registry; mother & child records; consent manager; ABHA', 'Vaccine data unused in nutrition risk; no cross-ministry consent design', 'Minimal flags under consent artefacts (FHIR R4)'],
  ['SSBSK (29 Jun 2026)', 'Home care 0–36 mo; up to 8 visits for at-risk children; Baal-ABHA alerts planned', 'Stops at 36 mo; no public at-risk growth rule; no consent / quality / escalation design', 'AMBER list feeds the SSBSK at-risk visit schedule'],
  ['CMAM protocol (Oct 2023)', 'Appetite test; AWC vs NRC care; MO screening in 3–5 days', 'Steps on paper only: no shared list, clock or escalation', 'RED-B 72 h appetite test + day-5 screening as tracked milestones'],
];
const PERSONAS = [
  ['AWW', 'Anganwadi Worker', '~40 children, growth day once a month, Tracker app offline most of the day, many registers already.', 'Day cards in Hindi; no new app; re-weigh only when asked; visit cap 2/month; breaches from late data are not hers.', 'worklist'],
  ['ASHA', 'Sahiya (ASHA)', 'Feature phone, reports to MoHFW, outside the Tracker, paid per incentive item.', 'IVR in Hindi/Ho/Santali/Mundari; keys 1–4; no data pack; sequential visit allowed; no new payment.', 'joint'],
  ['MS', 'Mukhya Sevika', 'Supervises ~25 AWCs; weekly rhythm; little visibility of which tasks are stuck.', 'Half-closed and overdue tasks per AWC, reliability flags for supportive (not punitive) supervision.', 'escalation'],
  ['CDPO', 'CDPO + Block MO', 'Block-level counts arrive monthly; migration inflow invisible.', 'Weekly overdue RED/AMBER, transfers, route notice before the season; names only via logged break-glass.', 'district'],
  ['FAM', 'Migrant mother', 'Leaves for a kiln in Nov–Jan; MCP card often lost; phone off for days; fingerprints worn.', 'Signed token verifies offline; IVR short code; eKYC on the AWC tablet incl. face auth; ration entitlement travels.', 'migration'],
];
const REFS = ['NITI Aayog, SDG India Index 2023-24.', 'MoHFW, NFHS-5 2019-21; Economic Survey 2021-22.', 'Rajya Sabha reply, MoHFW, 11 March 2025.', 'PIB, Malnutrition among Children, March 2022.', 'Rajya Sabha reply, 4 Dec 2024 (7.31 crore children).', 'Mertens A, et al., Nature 2023;621:558-67.', 'Mertens A, et al., Nature 2023 (growth faltering).', 'Onyango AW, et al., J Nutr 2015;145:2725-31.', 'Roshania R, et al., PMC8818295.', "Scroll.in, India's migrant children fall through the cracks.", 'MoWCD, Poshan Tracker FAQ and release notes.', "Jaacks L, et al., on India's Poshan Tracker.", 'PIB, Launch of SSBSK, 29 June 2026 (ID 2279075).', 'MoWCD and MoHFW, Protocol for Management of Malnutrition in Children, 2023; MoHFW, Facility Based Management of SAM, 2011.', 'Census of India 2011.', 'DPDP Act 2023; DPDP Rules 2025; NDGFP 2022.', 'NHA, ABDM FHIR profiles.', 'WHO Child Growth Standards.', 'MoWCD, Tracker migration module, 2023.', 'PIB, Poshan Tracker factsheet, July 2026.', 'NITI Aayog and IFPRI, District Nutrition Profile: Pashchimi Singhbhum, 2022.'];
const PHASES = [
  { n: 'Phase 1', m: [1, 3], t: 'Calibrate', what: 'Tracker baselines; interviews with AWWs, Sahiyas, supervisors; backtest on anonymised data (fallback NGO/synthetic); FHIR mapping in NHA sandbox; DPDP basis & MUAC completeness', exit: 'Lead time and alert accuracy measured; thresholds fixed in signed pack 2.x' },
  { n: 'Phase 2', m: [4, 9], t: 'Pilot', what: '2–3 blocks, ~250 AWCs, one migration season. Weeks 1–8 silent, then live alerts; staff training through ICDS cascade', exit: 'Deadlines met; workload and alert fatigue assessed' },
  { n: 'Phase 3', m: [10, 12], t: 'Decide', what: 'Evaluation vs matched non-pilot blocks; evidence to MoWCD, MoHFW, NeGD and the State; native Tracker integration plan (NIC capex)', exit: 'State adoption decision' },
];

export default {
  id: 'brief', title: 'Brief — Round 2 storyline', icon: ICONS.brief, dock: 'Brief', desk: 'Brief', size: [1100, 700], key: 'b',
  mount(ctx) {
    let tab = 'problem';
    const TABS = [['problem', '1 · Problem'], ['ecosystem', '2 · Ecosystem'], ['people', '3 · Stakeholders'], ['roadmap', '4 · Roadmap & feasibility'], ['impact', '5 · Impact & scale'], ['refs', 'References']];
    function render() {
      let body;
      if (tab === 'problem') body = h('div.col', { style: { gap: '12px' } },
        h('div', { style: { fontWeight: 800, fontSize: '40px', letterSpacing: '-0.04em', lineHeight: 0.95 } }, 'India scores 71. Zero Hunger scores 52.', h('br'), h('span', { style: { color: 'var(--hot)' } }, 'Paschimi Singhbhum is where the gap is widest.')),
        h('div.row.wrap', { style: { gap: '10px' } }, DISTRICT.map(([v, l, r]) => h('div.card', { style: { flex: '1 1 160px' } }, h('div.stat', null, h('div.v', null, v), h('div.l', null, l)), h('div.small.muted.mono', { style: { marginTop: '4px' } }, r)))),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' } }, GAPS.map(([g, v, t, r]) => h('div.card', null, h('span.tag.dark', null, g), h('div', { style: { fontWeight: 800, fontSize: '30px', letterSpacing: '-0.03em', margin: '6px 0' } }, v), h('p.p', null, t), h('div.small.muted.mono', { style: { marginTop: '6px' } }, r)))),
        h('div.callout', null, h('b', null, 'The gap is not data, it is action. '), 'The Tracker flags a child from one reading; signals that come before wasting (missed vaccine, diarrhoea) are shown but not used; ASHAs work outside the Tracker; a migrating child is followed only if a worker at the new place finds her. Who is affected: ST children aged 0–59 months, including children of seasonal migrants, whose records stay at the home AWC.'));
      else if (tab === 'ecosystem') body = h('div.col', null,
        h('table.grid', null, h('thead', null, h('tr', null, ['System', 'What exists (public sources)', 'Remaining gap', 'What PoshanSetu adds'].map((x) => h('th', null, x)))),
          h('tbody', null, ECOSYSTEM.map((r) => h('tr', null, r.map((x, i) => h('td', null, i === 0 ? h('b', null, x) : i === 3 ? h('span', { style: { color: 'var(--hot)', fontWeight: 600 } }, x) : x)))))),
        h('div.callout', null, h('b', null, 'Why the gap persists: '), 'nutrition and health data sit with separate ministries and ID systems; DPDP 2023, its 2025 Rules and NDGFP set norms but give no working design for child data; and indicators reward coverage over timely action. PoshanSetu strengthens what exists — it never replaces the Tracker.'));
      else if (tab === 'people') body = h('div.col', { style: { gap: '10px' } },
        h('div.callout', null, h('b', null, 'Composite design personas. '), 'Built from the proposal\'s ecosystem analysis and public sources — to be validated in Phase 1 interviews with AWWs, Sahiyas and supervisors. Each constraint maps to a working module.'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' } }, PERSONAS.map(([k, t, c, d, app]) => h('div.win.focused', { style: { position: 'relative', minHeight: 0 } },
          h('div.tb', null, h('span.t', null, t)),
          h('div', { style: { background: 'var(--white)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 } },
            h('div.kicker', null, 'Constraint'), h('p.p', null, c), h('div.kicker', null, 'Design response'), h('p.p', null, d),
            h('button.btn.sm', { style: { alignSelf: 'flex-start', marginTop: 'auto' }, onclick: () => open(app) }, `See it: ${app} ▸`))))));
      else if (tab === 'roadmap') {
        const W = 980, X = (m) => 150 + ((m - 1) / 12) * (W - 170);
        const g = s('svg', { viewBox: `0 0 ${W} 190`, width: '100%', style: 'display:block;max-width:1100px;font-family:var(--font-mono)' });
        for (let m = 1; m <= 13; m++) { g.append(s('line', { x1: X(m), x2: X(m), y1: 20, y2: 170, stroke: '#1f1b1d', 'stroke-opacity': 0.12 })); if (m <= 12) g.append(s('text', { x: X(m) + 4, y: 14, 'font-size': 9.5 }, `M${m}`)); }
        PHASES.forEach((p, i) => { const y = 30 + i * 46; g.append(s('text', { x: 6, y: y + 22, 'font-size': 12, 'font-weight': 700 }, `${p.n} · ${p.t}`)); g.append(s('rect', { x: X(p.m[0]) + 3, y: y + 3, width: X(p.m[1] + 1) - X(p.m[0]), height: 32, fill: '#1f1b1d' }), s('rect', { x: X(p.m[0]), y, width: X(p.m[1] + 1) - X(p.m[0]), height: 32, fill: ['#d3e8fb', '#f6a3b7', '#fff'][i], stroke: '#1f1b1d', 'stroke-width': 2 })); g.append(s('text', { x: X(p.m[0]) + 8, y: y + 20, 'font-size': 10.5 }, p.exit)); });
        g.append(s('rect', { x: X(4), y: 178, width: X(6) - X(4), height: 8, fill: '#e94fbf' }), s('text', { x: X(6) + 6, y: 186, 'font-size': 9.5 }, 'silent weeks 1–8'));
        body = h('div.col', { style: { gap: '12px' } }, h('div.card', null, g),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' } }, PHASES.map((p) => h('div.card', null, h('div.kicker', null, `${p.n} · months ${p.m[0]}–${p.m[1]}`), h('p.p', { style: { marginTop: '4px' } }, p.what), h('div.small', { style: { marginTop: '6px' } }, h('b', null, 'Exit test: '), p.exit)))),
          h('div.card', null, h('div.kicker', null, 'Feasibility — the four assumptions Phase 1 tests'),
            h('ol', { style: { margin: '6px 0 0 18px', padding: 0, fontSize: '12.5px', lineHeight: 1.55 } },
              h('li', null, 'Weight and MUAC records are complete enough for trend rules (fallback: re-measure prompts raise completeness).'),
              h('li', null, 'Past data can be accessed under a State agreement (fallback: NGO or synthetic data; results provisional).'),
              h('li', null, 'Trend rules give a median lead of ≥ 30 days within the visit limit (prototype backtest: see Trial).'),
              h('li', null, 'Sahiyas can act on voice tasks (IVR pilot in one sector first).')),
            h('div.row', { style: { gap: '6px', marginTop: '8px' } }, h('button.btn.sm.ghost', { onclick: () => open('budget') }, 'Costs ▸'), h('button.btn.sm.ghost', { onclick: () => open('trial') }, 'Backtest ▸'), h('button.btn.sm.ghost', { onclick: () => open('rulepack') }, 'Calibration ▸'))));
      } else if (tab === 'refs') {
        body = h('div.card', null, h('div.kicker', null, 'Round 1 proposal references (as submitted)'), h('ol', { style: { margin: '8px 0 0 22px', padding: 0, fontSize: '12.5px', lineHeight: 1.7 } }, REFS.map((r) => h('li', null, r))), h('div.small.muted', { style: { marginTop: '8px' } }, 'Prototype-only sources: WHO 2006 LMS tables (via pygrowup, BSD); WHO 2009 velocity standards (approximated, flagged in the rule pack).'));
      } else {
        const m = store.sim.metrics;
        const closedIn = (() => { const am = store.tasks.filter((t) => t.tier === 'AMBER' && (t.kind === 'NEW' || t.kind === 'WORSENING') && !t.queued); const ok = am.filter((t) => { const e = store.esc(t); return e.state === 'CLOSED' && e.closedAt <= t.dueAt; }); return am.length ? ok.length / am.length : null; })();
        const migr = store.sim.district.children.filter((c) => c.migration && c.migration.depAt < store.now);
        const traced = migr.filter((c) => c.migration.measuredAtDest || (c.migration.retAt && c.migration.retAt < store.now)).length;
        const rows = [
          ['Detection lead time', 'Days from first AMBER to SAM', 'Median ≥ 30 days', `${Math.round(m.leadMedian)} d (strict: ${Math.round(m.strict.leadMedian || 0)} d before any listing)`],
          ['Sensitivity, precision', 'SAM cases flagged earlier; alerts confirmed on re-weighing', '≥ half flagged earlier', `${pct(m.shareEarlier)} earlier · precision ${pct(m.precision)}`],
          ['MAM → SAM', 'MAM children entering SAM in 90 days', 'Lower than comparison blocks', 'Needs live pilot + comparison blocks'],
          ['Frontline action', 'At-risk children visited in 7 days', '≥ 80% of new AMBER tasks', closedIn == null ? '—' : `Measured live per task (Worklist). Simulated workers: ${pct(closedIn)}`],
          ['Migrant continuity', 'Migrants measured within 60 days', '≥ 85% traced or transferred', `Tracked via tokens + LTFU rule. Simulated: ${pct(migr.length ? traced / migr.length : 0)}`],
        ];
        const base = impactScenario(store.sim.district.children, store.pack, { effect: 0, compliance: SC.compliance });
        const sc = impactScenario(store.sim.district.children, store.pack, SC);
        const attributable = Math.max(0, sc.averted - base.averted);
        const sl = (label, k, min, max, step, fmt) => h('label.field', { style: { flex: '1 1 200px' } }, h('span', null, `${label}: `, h('b', null, fmt(SC[k]))), h('input', { type: 'range', min, max, step, value: SC[k], oninput: (e) => { SC[k] = +e.target.value; render(); } }));
        const scenario = h('div.card', null, h('div.kicker', null, 'Impact SCENARIO — an assumption, not a result'),
          h('div.row.wrap', { style: { gap: '14px', marginTop: '8px' } }, sl('If a visit + ration review lifts WHZ by', 'effect', 0, 0.3, 0.01, (v) => `${v.toFixed(2)} SD/month for 3 months`), sl('and this share of alerts is acted on', 'compliance', 0.3, 1, 0.05, (v) => pct(v))),
          h('div.row.wrap', { style: { gap: '10px', marginTop: '10px' } },
            h('div.card.flat', { style: { flex: '1 1 150px' } }, h('div.stat', null, h('div.v', null, sc.samKids), h('div.l', null, 'true SAM episodes (simulated truth)'))),
            h('div.card.flat', { style: { flex: '1 1 150px' } }, h('div.stat', null, h('div.v', null, pct(sc.samKids ? sc.flagged / sc.samKids : 0)), h('div.l', null, 'had an AMBER alert first (≤ 180 d)'))),
            h('div.card.flat.pinkc', { style: { flex: '1 1 150px' } }, h('div.stat', null, h('div.v', null, attributable), h('div.l', null, `episodes averted by acting (${pct(sc.samKids ? attributable / sc.samKids : 0)})`)))),
          h('div.small.muted', { style: { marginTop: '6px' } }, 'Averted = with the assumed uplift applied from the first AMBER, true WHZ never crosses −3, minus the cases that would not have crossed anyway. The effect size must come from CMAM / SSBSK evidence and the pilot\'s comparison blocks — this card only shows why lead time matters.'));
        body = h('div.col', { style: { gap: '12px' } },
          scenario,
          h('table.grid', null, h('thead', null, h('tr', null, ['Indicator (Table 5)', 'Baseline (Phase 1)', 'Pilot hypothesis', 'Prototype shows'].map((x) => h('th', null, x)))),
            h('tbody', null, rows.map((r) => h('tr', null, r.map((x, i) => h('td', null, i === 0 ? h('b', null, x) : i === 3 ? h('span', { style: { color: 'var(--hot)', fontWeight: 600 } }, x) : x)))))),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' } },
            h('div.card', null, h('div.kicker', null, 'Beneficiaries'), h('p.p', null, 'ST children aged 0–59 months in the pilot blocks (≈10,000), their AWWs, Sahiyas and block officers. Earlier detection means community care while recovery is simpler; migrant families keep rations and checks; scarce visits go to the children most at risk.')),
            h('div.card', null, h('div.kicker', null, 'Evaluation'), h('p.p', null, 'Matched non-pilot blocks using routine Tracker data form the comparison. Scale-up requires deadlines met, precision held and visits within the limit.')),
            h('div.card.dark', null, h('div.kicker', null, 'Scalability'), h('p.p', null, 'Rule packs and FHIR mappings are state-agnostic: a new district is a new signed pack, not new code. The module scales through a Tracker release as SSBSK\'s nutrition layer to other tribal and high-migration districts — without repeating one-time development.'))));
      }
      mount(ctx.body,
        h('div.toolbar', null, h('div.seg', null, TABS.map(([k, l]) => h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; render(); } }, l))), h('div.grow'), h('span.small.muted', null, 'Sources: Round 1 proposal references [1]–[21]')),
        h('div', { style: { padding: '14px' } }, body));
    }
    render();
  },
};
