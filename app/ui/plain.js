// Simple mode: a plain-words strip at the top of every window (what it is, how to read it, what to try)
// and a word helper for the jargon. On by default; Mode → "Simple explanations" turns it off for experts.
import { h } from './dom.js';

const KEY = 'ps-simple';
export function isSimple() { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } }
export function setSimple(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ } }

export const WORDS = {
  'AWW': 'Anganwadi Worker. Runs the village child centre, weighs children every month.',
  'AWC': 'Anganwadi Centre: the village child-care centre.',
  'ASHA': 'The village health worker (called Sahiya in Jharkhand). Works for the Health ministry.',
  'SAM': 'Severe acute malnutrition: a child who is dangerously thin. Needs treatment now.',
  'MAM': 'Moderate acute malnutrition: a child who is too thin, not yet dangerous.',
  'RED-A': 'Most urgent. Take the child to the health centre today (24 hours).',
  'RED-B': 'Severe but stable. Start treatment at the Anganwadi; appetite test within 3 days.',
  'AMBER': 'Getting worse. A home visit by the AWW and the ASHA within 7 days.',
  'WATCH': 'Something looks off. Weigh the child again soon.',
  'Tier': 'The colour a child gets: RED-A, RED-B, AMBER, WATCH or ON TRACK.',
  'WHZ': 'Weight compared with height. 0 is average. Below −2 means too thin; below −3 means severely thin.',
  'WAZ': 'Weight compared with age. 0 is average. Below −2 means underweight.',
  'HAZ': 'Height compared with age. 0 is average. Below −2 means short for age (stunted).',
  'SD / z-score': 'How far a child is from the WHO average, in steps. −2 and −3 are the danger lines.',
  'MUAC': 'The arm band measurement around the upper arm, in mm. Below 115 mm is severe.',
  'Oedema': 'Swelling of both feet when pressed. Always an emergency in a thin child.',
  'Appetite test': 'The child is given a sachet of therapeutic food. If they will not eat it, they need hospital care.',
  'CMAM': 'The government’s 2023 steps for treating severe malnutrition in the community.',
  'Forecast': 'Where the child’s growth line is heading if nothing changes, with how sure we are.',
  'Risk points': 'Small warning signs added up (under 2 years, recent fall, lean season…). More points = visited sooner.',
  'Poshan Tracker': 'The government app where Anganwadi workers already record weights.',
  'ABDM': 'Ayushman Bharat Digital Mission: India’s system for sharing health records with permission.',
  'Consent': 'The mother’s permission to share a small piece of health information, for one purpose and a set time.',
  'FHIR': 'The standard format health systems use to exchange records.',
  'R-score': 'Data-quality score of an Anganwadi, out of 100. Low means its weights may be wrong.',
  'Quarantined': 'A reading that looks impossible is set aside and the child is weighed again.',
  'CDPO': 'Child Development Project Officer: runs all Anganwadis in a block.',
  'Mukhya Sevika': 'Supervisor of about 25 Anganwadis.',
  'DPO': 'District Programme Officer: in charge of the whole district.',
  'Silent trial': 'Running the alerts without showing them to anyone, to measure how early they would have come.',
  'Precision': 'Out of 100 alerts, how many were for a child who really was getting worse.',
  'Rule pack': 'The rulebook of numbers the app uses, signed by both ministries.',
  'IVR': 'An automatic phone call: listen and press a number on any phone.',
  'Token': 'A digitally signed card that proves a child’s record is genuine, even offline.',
  'Escalation': 'When a task is late, it moves up to the next officer.',
};

// Per window: one line, how to read it, what to try (button labels clicked inside that window), and its key words.
const P = {
  worklist: { what: 'Your to-do list: every child who needs something, most urgent first.', read: ['Colour = how urgent (see the words below).', 'The clock shows time left. It started when the child was weighed.', '“AWW ✓ / ASHA ✓” show who has already visited.'], tryIt: [['Only the most urgent', /^RED-A$/], ['Only late ones', /^Overdue$/], ['Everything', /^Every$/]], words: ['RED-A', 'RED-B', 'AMBER', 'WATCH', 'AWW', 'ASHA'] },
  child: { what: 'One child’s full record: how they are growing, and why they got their colour.', read: ['Chart 1: weight as they grow. Coloured lines are WHO healthy and danger lines; dots are weighings.', 'Chart 2 going down = getting thinner. The pink cone is where they are heading.', 'Right side: the reason in words, the forecast, and risk points.'], tryIt: [['Story in order', /^Timeline$/], ['Every weighing', /^Visits/], ['Add a weight', /^\+ Measurement/]], words: ['WHZ', 'MUAC', 'SD / z-score', 'Forecast', 'Risk points', 'Tier'] },
  capture: { what: 'The form an Anganwadi worker fills on weighing day.', read: ['Type weight, height and arm size; tick any danger signs.', 'The box below shows the child’s colour before you save.', 'A red warning means a number is probably mistyped.'], tryIt: [['Show a typing mistake', /^Demo: decimal slip/], ['Save', /^Save & sync/]], words: ['MUAC', 'Oedema', 'Appetite test', 'Quarantined'] },
  awwphone: { what: 'The worker’s phone, working with or without mobile signal.', read: ['Tap a child, enter the weight, Save.', 'With no signal, records wait on the phone and send later.', 'Deadlines count from the weighing, so a bad network never hides an emergency.'], tryIt: [['Turn signal off', /^Offline$/], ['Turn signal on', /^Online$/], ['Wait 6 hours', /^\+6 h$/]], words: ['AWW', 'Oedema'] },
  district: { what: 'A map of the district. Each small square is one Anganwadi.', read: ['Square colour = its most urgent open task.', '“!” = something is overdue. A white dot = its weights may be unreliable.', 'Senior officers see totals only, never children’s names.'], tryIt: [], words: ['AWC', 'R-score', 'DPO'] },
  escalation: { what: 'What happens when a task is not done in time.', read: ['Four lanes, from the Anganwadi up to the district.', 'A task moves one lane right each time its deadline passes.', 'Each card shows who has not done their part yet.'], tryIt: [['Move time 1 day', /^\+1 day$/], ['Move time 7 days', /^\+7 days$/]], words: ['Escalation', 'Mukhya Sevika', 'CDPO', 'DPO'] },
  bridge: { what: 'How fast a weighing reaches the system — and why speed matters.', read: ['Three ways data can travel: a weekly report, a nightly file, or live.', 'The table says which way is fast enough for a 24-hour deadline.', 'Emergencies also travel by SMS.'], tryIt: [['Old way (weekly)', /^Round 1/], ['New way (live)', /^Round 2/], ['Send an emergency', /^Send RED-A/]], words: ['Poshan Tracker', 'RED-A'] },
  joint: { what: 'Home visits that need both the Anganwadi worker and the ASHA.', read: ['Left: pick a task.', 'Either worker can go first. The task is done only when both have reported.', 'The ASHA reports from a keypad phone: press 1 = visited.'], tryIt: [['Call the ASHA’s phone', /^☎$/], ['Press 1 (visited)', /^1/]], words: ['ASHA', 'IVR', 'AWW', 'CMAM'] },
  migration: { what: 'Keeping track of children whose families go to brick kilns.', read: ['Each child gets a signed card that can be checked without internet.', 'If the card is lost, the right side shows other ways to find the child.', 'The receiving district sees totals, not names.'], tryIt: [['Check the card', /^Verify offline/], ['Fake it', /^Tamper 1 byte/], ['Find by thumbprint', /^Scan mother/]], words: ['Token', 'IVR'] },
  reliability: { what: 'How trustworthy each Anganwadi’s weights are: a score out of 100.', read: ['Higher is better. Below the cut-off, the worker is asked to weigh again.', 'A broken scale counts far more than rounding off numbers.', 'Digit chart: real weights end in any digit; too many 0s and 5s means guessing.'], tryIt: [], words: ['R-score', 'Quarantined'] },
  budget: { what: 'What it costs: ₹33 lakh for a pilot in 250 Anganwadis.', read: ['About ₹330 per child in the pilot year, ₹30 a year after that.', 'It reuses systems India already has instead of building new ones.', 'Rolling out to all of India is a separate budget line.'], tryIt: [], words: ['ABDM', 'Poshan Tracker'] },
  consent: { what: 'How a mother’s permission controls what health information is shared.', read: ['Left: how many families agreed, and how.', 'Only small flags are shared (like “vaccine overdue”), never full records.', 'The exchange tab shows the real ABDM steps, encrypted.'], tryIt: [['Show the exchange', /^ABDM exchange/], ['Run it', /^▶ Run exchange/], ['Mother says no', /^Guardian revokes/]], words: ['Consent', 'ABDM', 'FHIR'] },
  rulepack: { what: 'The rulebook: every number the app uses to decide a child’s colour.', read: ['Both ministries must sign before any change is used.', 'Move a slider to try a change, then re-run the test to see what it does.', 'Old alerts keep the rules that made them.'], tryIt: [['Re-run the test', /^Re-run silent-trial/]], words: ['Rule pack', 'Precision', 'Silent trial'] },
  trial: { what: 'Does it work? A test on 1,440 realistic made-up children over a year.', read: ['Top numbers: how many children were flagged early, and how many days early.', 'Trade-off: catching more children early means more visits that turn out unnecessary.', 'Ablation: every rule had to prove it helps.'], tryIt: [['Results', /^Results$/], ['Trade-off', /^Trade-off curve$/], ['Ablation', /^Ablation/]], words: ['Silent trial', 'Precision', 'SAM', 'MAM'] },
  importer: { what: 'Run the app on a real data file.', read: ['Load a spreadsheet (CSV) of weighings, or try the built-in samples.', 'It shows each child’s colour and how good the data is.', 'Real public survey data is included to try.'], tryIt: [['Try real survey data', /^Run on real survey A/], ['Try a sample', /^Try with a synthetic sample/]], words: ['R-score', 'WHZ'] },
  audit: { what: 'A record of every action that nobody can secretly change.', read: ['Each line: who did what, and when.', 'Every line is locked to the one before it, like links in a chain.', 'Change one line and the check shows exactly where.'], tryIt: [['Change a line', /^Tamper with an entry/], ['Check the chain', /^Verify chain/], ['Put it back', /^Undo tamper/]], words: [] },
  report: { what: 'The one-page monthly report for the district meeting.', read: ['Totals per block, no names.', 'Very small numbers are hidden so no child can be identified.', 'Print it or save it as a PDF.'], tryIt: [['Print / save', /^Print \/ save PDF/]], words: ['DPO', 'CDPO'] },
  arch: { what: 'The whole system on one page.', read: ['Left to right: data comes in → is checked → becomes a task for a person → is watched until done.', 'Click any box to see what it does.'], tryIt: [], words: ['Poshan Tracker', 'ABDM', 'Rule pack'] },
  brief: { what: 'The project summary in five short tabs.', read: ['The problem, what already exists, the people, the plan, and the expected impact.', 'Every number has its source.'], tryIt: [['Problem', /^1 · Problem/], ['People', /^3 · Stakeholders/], ['Plan', /^4 · Roadmap/]], words: ['SAM', 'MAM', 'AWW', 'ASHA'] },
  terminal: { what: 'A typing console for experts. Not needed for normal use.', read: ['Type help and press Enter to see the commands.'], tryIt: [], words: [] },
};

/** The strip for a window (or null). `el` is the window element, so the buttons can press things inside it. */
export function plainStrip(id, el) {
  const p = P[id];
  if (!p || !isSimple()) return null;
  let showWords = false;
  const strip = h('div.plain');
  const pressIn = (re) => { const b = [...el.querySelectorAll('.body button')].find((x) => re.test((x.textContent || '').trim()) && !x.disabled); b?.click(); };
  const draw = () => {
    strip.replaceChildren(...[
      h('div.plain-row', null,
        h('span.plain-kicker', null, 'In simple words'),
        h('span.plain-what', null, p.what),
        h('span', { style: { flex: 1 } }),
        p.words.length ? h('button.plain-btn', { onclick: () => { showWords = !showWords; draw(); } }, showWords ? 'Hide word meanings' : 'What do these words mean?') : null,
        h('button.plain-btn', { title: 'Hide this strip in this window', onclick: () => strip.remove() }, '×')),
      h('ul.plain-read', null, p.read.map((r) => h('li', null, r))),
      p.tryIt.length ? h('div.plain-row', null, h('span.plain-kicker', null, 'Try'), p.tryIt.map(([label, re]) => h('button.plain-try', { onclick: () => pressIn(re) }, `${label} ▸`))) : null,
      showWords ? h('div.plain-words', null, p.words.map((w) => h('div', null, h('b', null, w), ` — ${WORDS[w]}`))) : null].filter(Boolean));
  };
  draw();
  return strip;
}

/** All the words, for the Help → Word list panel. */
export function allWords() { return Object.entries(WORDS); }
