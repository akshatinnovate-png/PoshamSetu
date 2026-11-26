// Guided demo: every feature and every chart, in simple words a presenter can read aloud.
// Each step: sec (chapter), t (title), say (words to read), go (what to open/click), spot (what to highlight).
// spot: { app, text, up } finds the smallest element in that window containing `text` (then `up` levels to its parent),
//       { sel } a CSS selector, or { root, text } inside another part of the screen (e.g. the menubar).

export function demoSteps(api) {
  const { store, open, closeAll, full, place, desk, click, scrollTo, sleep } = api;
  const riya = () => store.story && store.childById[store.story.childId];
  const as = (role) => store.setRole(role, store.defaultScope(role));
  const openRiya = (tab) => { as('AWW'); const c = riya(); if (c) { store.selectChild(c.id); full('child', { childId: c.id }); if (tab) setTimeout(() => click('child', tab), 120); } };
  const liveTask = () => {
    const st = store.story;
    const ok = (x) => x.required.includes('ASHA') && store.esc(x).open && x.ingestedAt <= store.now;
    const rank = (x) => (x.awcId === st?.awcId ? 0 : store.awcById[x.awcId].blockId === st?.blockId ? 1 : 2);
    return store.tasks.filter(ok).sort((a, b) => rank(a) - rank(b))[0];
  };
  const home = async (text) => { closeAll(); open('landing'); await sleep(80); if (text) scrollTo('landing', text); };
  const phone = () => { const d = desk(); open('awwphone'); const top = (document.querySelector('.tourbar')?.offsetHeight || 80) + 22; place('awwphone', d.clientWidth / 2 - 220, top, 440, d.clientHeight - top - 14); };

  const S = [];
  const step = (sec, t, say, go, spot) => S.push({ sec, t, say, go, spot });

  // 1 — Welcome
  step('Welcome', 'What PoshanSetu is', 'PoshanSetu helps Anganwadi workers spot children who are slowly getting weaker — months before they become severely malnourished. It works with the Poshan Tracker that India already uses. Press Next, or the → key, to move through the demo.', () => home(), { app: 'landing', text: 'ROUND 2 BUILD' });
  step('Welcome', 'The big idea', 'Today, a child gets help only after crossing a danger line. We watch which way the child is heading, so help comes earlier — while recovery is still simple.', () => home('Do Not Wait'), { app: 'landing', text: 'Do Not Wait', up: 1 });
  step('Welcome', 'The people', 'These are the people around one child, Riya: her mother Sunita, the Anganwadi worker Kamla, the ASHA Phulmani, and two supervisors. Every feature in this app helps one of them.', () => home('One child.'), { app: 'landing', text: 'One child.', up: 2 });
  step('Welcome', 'Same child, two systems', 'The same weighings, month by month. On the left, what happens today: nothing, then a list. On the right, PoshanSetu: an early warning, with a person, a task and a deadline.', async () => { await home('Riya.'); await sleep(250); click('landing', /^Replay/); }, { app: 'landing', text: 'Two systems.', up: 2 });
  step('Welcome', 'The headline result', 'In our test on 1,440 made-up but realistic children, most children who later became severely malnourished were flagged about two months earlier. Every number on this page has a “Proof” link.', () => home('Days Earlier'), { app: 'landing', text: 'Days Earlier', up: 1 });
  step('Welcome', 'Five answers', 'After Round 1 the judges gave us five tough questions. Each answer is a working window. We will open all five.', () => home('Five stress tests.'), { app: 'landing', text: 'Five stress tests.', up: 2 });
  step('Welcome', 'Then we made it smarter', 'Then we made it smarter: a forecast, official WHO growth tables, a smarter visit order, a phone app in Hindi, consent through ABDM, and tests on real survey data. Each card opens its proof.', () => home('Then we made it'), { app: 'landing', text: 'Then we made it', up: 1 });

  // 2 — The desktop
  step('The desktop', 'A desktop of tools', 'The app looks like a computer desktop. Each tool is a window. The dock at the bottom opens any window, and every window has a ? button that explains it.', () => { closeAll(); }, { sel: '.dock' });
  step('The desktop', 'Who is using it', 'The Role menu changes who is using the app. The Anganwadi worker sees names in her own centre. Senior officers see totals, not names. This protects children’s privacy.', () => { closeAll(); }, { root: '.menubar', text: 'Role' });
  step('The desktop', 'Moving time', 'The Time menu moves the clock forward, so you can see what happens when a task is not done in time.', () => { closeAll(); }, { root: '.menubar', text: 'Time' });

  // 3 — Kamla's to-do list
  step('Kamla’s to-do list', 'Her list for today', 'This is Kamla’s to-do list. Each card is one child who needs her. She does not need to read charts — the card tells her what to do.', () => { closeAll(); as('AWW'); full('worklist'); }, { app: 'worklist' });
  step('Kamla’s to-do list', 'What the colours mean', 'The colour says how urgent it is. RED-A: take the child to the health centre today. RED-B: severe, treat at the Anganwadi. AMBER: visit within 7 days. WATCH: weigh again.', () => {}, { app: 'worklist', text: 'All tiers', up: 1 });
  step('Kamla’s to-do list', 'Why, and how long', 'Every card says why, in plain words, and how much time is left. The clock starts when the child was weighed — not when the data reached the office.', () => {}, { sel: '[data-app="worklist"] .body .card' });
  step('Kamla’s to-do list', 'Filters', 'These buttons filter the list: open tasks, half-done tasks, overdue tasks, and finished ones.', () => {}, { app: 'worklist', text: 'Half-closed', up: 1 });
  step('Kamla’s to-do list', 'Who to visit first', 'Supervisors see a table. When there are more children than visits, the Risk column decides who goes first. The risk is made of small signs anyone can understand.', () => { closeAll(); as('CDPO'); full('worklist'); setTimeout(() => click('worklist', /^Table$/), 120); }, { app: 'worklist', text: 'Risk' });

  // 4 — Riya's record and charts
  step('Riya’s record', 'One child’s record', 'This is Riya’s record. At the top: her name, age, Anganwadi, and her colour today.', () => { closeAll(); openRiya(); }, { app: 'child', text: 'Riya Hembrom' });
  step('Riya’s record', 'Chart 1: weight as she grows', 'This chart shows her weight as she grows. The green line is a healthy average. The orange and red lines are danger lines. Each dot is one weighing, coloured by how worried we were that day.', () => {}, { app: 'child', text: 'Weight-for-age', up: 1 });
  step('Riya’s record', 'Flat line = warning', 'Look at the dots: they stay flat while the lines go up. Riya is growing taller, but not heavier. No single dot crosses a line — that is why the old system missed her.', () => {}, { app: 'child', text: 'Weight-for-age', up: 1 });
  step('Riya’s record', 'Chart 2: thin or not', 'This chart compares her weight with her height. Going down means getting thinner. The yellow band is moderate malnutrition; the pink band is severe.', () => scrollTo('child', 'Weight-for-height z-score'), { app: 'child', text: 'Weight-for-height z-score', up: 1 });
  step('Riya’s record', 'The forecast cone', 'The pink dashed line and shaded cone show where she is heading if nothing changes — like a weather forecast for her growth.', () => scrollTo('child', 'Weight-for-height z-score'), { app: 'child', text: 'Weight-for-height z-score', up: 1 });
  step('Riya’s record', 'Chart 3: arm size', 'This is MUAC — the coloured arm band workers already use. Below 115 millimetres is severe.', () => scrollTo('child', 'MUAC (6'), { app: 'child', text: 'MUAC (6', up: 1 });
  step('Riya’s record', 'Why this colour', 'On the right: why she has this colour, in words a worker understands — and which rule decided it. No black box.', () => {}, { app: 'child', text: 'Why this tier', up: 1 });
  step('Riya’s record', 'The chance of getting worse', 'The forecast gives a chance — for example 63% — that she falls below the danger line in the next 60 days.', () => {}, { app: 'child', text: 'Trajectory forecast (Kalman)', up: 1 });
  step('Riya’s record', 'Risk points', 'Risk points add up small warning signs: under two years old, a recent fall, the lean season, back from migration. More points means she is visited sooner.', () => {}, { app: 'child', text: 'Risk points', up: 1 });
  step('Riya’s record', 'Her story in order', 'The Timeline tab shows everything that happened to her, in order: weighings, alerts, visits and consent.', () => click('child', /^Timeline$/), { app: 'child', text: 'Timeline' });
  step('Riya’s record', 'Every weighing', 'The Visits tab lists every measurement, including when the data actually arrived.', () => click('child', /^Visits/), { app: 'child', text: 'Visits (' });
  step('Riya’s record', 'Health signals', 'Health signals come from the health system — a missed vaccine, or diarrhoea. They are used only if her mother agreed to share them.', () => click('child', /^Health signals/), { app: 'child', text: 'Health signals' });

  // 5 — Entering data
  step('Entering data', 'Quick entry', 'New: Quick entry. Type notes the way you would say them — name, age, weight, height — one child per line. No forms.', () => { closeAll(); as('AWW'); full('assist'); }, { sel: '[data-app="assist"] textarea' });
  step('Entering data', 'It reads and checks', 'Watch: it reads four children at once and checks every number against WHO growth standards.', () => click('assist', /^Try an example/), { app: 'assist', text: 'Rohan', up: 3 });
  step('Entering data', 'Impossible values are stopped', 'Rohan’s height says 300 centimetres — impossible for a one-year-old. It is stopped in red and asks to measure again. A wrong number is never saved.', () => scrollTo('assist', 'is not possible'), { app: 'assist', text: '300 cm is not possible', up: 1 });
  step('Entering data', 'One-click fixes', 'Rahul’s weight says 92 kilos — a slipped decimal. It offers 9.2 kilos with one click.', async () => { scrollTo('assist', 'Did you mean 9.2'); await sleep(900); click('assist', /^Use 9\.2/); }, { app: 'assist', text: 'Rahul', up: 3 });
  step('Entering data', 'Save', 'Press Save. The children go straight onto the to-do list, each with a colour and a reason. Somari has swelling in both feet, so she is RED-A: health centre today.', () => click('assist', /^Save \d/), { app: 'assist', text: 'Saved', up: 1 });
  step('Entering data', 'AI, but safe', 'With a Groq key, an AI reads messier notes. Without internet, the built-in reader still works. Either way, the same safety checks decide what gets saved.', () => {}, { sel: '[data-app="assist"] .toolbar' });
  step('Entering data', 'The full form', 'The full form has every field: weight, height, arm size, swelling and danger signs. Before saving, it shows what the colour will be.', () => { closeAll(); as('AWW'); full('capture'); }, { app: 'capture', text: 'Before you save', up: 1 });
  step('Entering data', 'Catching typing mistakes', 'If a weight is typed ten times too big, it warns before saving.', () => click('capture', /^Demo: decimal slip/), { app: 'capture', text: 'Implausible', up: 1 });

  // 6 — No signal
  step('No signal', 'The worker’s phone', 'This is the worker’s phone. In forest villages there is often no signal.', () => { closeAll(); as('AWW'); phone(); }, { app: 'awwphone' });
  step('No signal', 'Offline is normal', 'With no signal, records wait safely on the phone and send later. The deadline still counts from the weighing, so a bad network never hides an emergency — and the worker is not blamed for it. There is also a Hindi phone app that installs on any Android phone.', () => {}, { app: 'awwphone' });

  // 7 — Fix 1
  step('Fix 1 · Speed', 'Three ways data travels', 'Fix 1 is speed. Round 1 relied on weekly reports. This window compares weekly exports, a nightly file, and live events.', () => { closeAll(); as('CDPO'); full('bridge'); }, { app: 'bridge', text: 'Round 2: event bridge', up: 1 });
  step('Fix 1 · Speed', 'Can it keep a 24-hour promise?', 'This table checks each way: is it fast enough for a 24-hour deadline? Weekly reports: no. Live events: yes. Emergencies also go by SMS.', () => scrollTo('bridge', 'Clock-safety'), { app: 'bridge', text: 'Clock-safety', up: 1 });
  step('Fix 1 · Speed', 'Watch an emergency travel', 'We send a red emergency. It travels by SMS in minutes and creates a task with a 24-hour clock.', () => { click('bridge', /^Send RED-A/); }, { app: 'bridge', text: 'Try it', up: 1 });

  // 8 — Fix 2
  step('Fix 2 · Two workers', 'No need to visit together', 'Fix 2: the Anganwadi worker and the ASHA work for different ministries. They no longer have to visit together. Either can go first, within 7 days.', () => { closeAll(); const t = liveTask(); if (t) store.setRole('CDPO', store.awcById[t.awcId].blockId); full('joint', t ? { taskId: t.id } : undefined); }, { app: 'joint', text: 'Closure state machine', up: 1 });
  step('Fix 2 · Two workers', 'A keypad phone is enough', 'The ASHA has a basic keypad phone. She gets a voice call in Hindi and presses 1 when she has visited. No smartphone, no internet.', async () => { click('joint', /^☎$/); await sleep(1200); click('joint', /^1/); }, { app: 'joint', text: 'PoshanSetu IVR', up: 2 });
  step('Fix 2 · Two workers', 'Done only when both are done', 'The task closes only when both have reported. If only one has, the supervisor sees exactly who is missing.', () => {}, { app: 'joint', text: 'Visit window timeline', up: 1 });

  // 9 — Fix 3
  step('Fix 3 · Migration', 'A card that travels', 'Fix 3: many families go to brick kilns for months. Each child gets a digitally signed card with their health status.', () => { closeAll(); as('CDPO'); full('migration'); }, { app: 'migration', text: 'Signed transfer token', up: 1 });
  step('Fix 3 · Migration', 'Checked with no internet', 'The card can be checked with no internet at all. If anyone changes even one letter, the check fails.', () => click('migration', /^Verify offline/), { app: 'migration', text: 'Signed transfer token', up: 1 });
  step('Fix 3 · Migration', 'If the card is lost', 'If the card is lost: a short code over any phone call, or the mother’s thumbprint at the kiln’s Anganwadi — or her face, when kiln work has worn her fingerprints.', () => scrollTo('migration', 'Kiln scenario'), { app: 'migration', text: 'Kiln scenario', up: 1 });

  // 10 — Fix 4
  step('Fix 4 · Data quality', 'Is the scale right?', 'Fix 4: is the scale right? Each Anganwadi gets a data-quality score. A broken scale counts much more than a habit of rounding numbers.', () => { closeAll(); as('DPO'); full('reliability'); }, { app: 'reliability', text: 'Every AWC, both formulas', up: 1 });
  step('Fix 4 · Data quality', 'Spotting guesses', 'These bars show the last digit of recorded weights. Real weights end in any digit. Too many zeros or fives means guessing — so we send a trainer, not a punishment.', () => scrollTo('reliability', 'Terminal digit'), { app: 'reliability', text: 'Terminal digit', up: 1 });

  // 11 — Fix 5
  step('Fix 5 · Cost', 'An honest budget', 'Fix 5: honest cost. The pilot is 33 lakh rupees for 250 Anganwadis and about 10,000 children — around 330 rupees per child.', () => { closeAll(); full('budget'); }, { app: 'budget', text: 'Phase 2 pilot', up: 1 });
  step('Fix 5 · Cost', 'Reuse, don’t rebuild', 'We reuse what India already built — API Setu, ABDM, Bhashini — instead of building from scratch. That is what keeps it cheap.', () => scrollTo('budget', 'Reuse, not rebuild'), { app: 'budget', text: 'Reuse, not rebuild', up: 1 });

  // 12 — Does it work?
  step('Does it work?', 'The test', 'Does it work? This is our test on 1,440 made-up but realistic children over a year. The chart shows how many days earlier each child was flagged.', () => { closeAll(); full('trial'); }, { app: 'trial', text: 'Lead time:', up: 1 });
  step('Does it work?', 'Earlier is not free', 'Each dot is a different setting. Further right catches more children early. Lower means more visits to children who were fine. The pink square is the balance we chose.', () => click('trial', /^Trade-off curve$/), { app: 'trial', text: 'There is no free lunch', up: 1 });
  step('Does it work?', 'Every rule earned its place', 'Every rule had to prove it helps. One did not, so it is switched off — shown crossed out here.', () => click('trial', /^Ablation/), { app: 'trial', text: 'Every rule had to earn', up: 1 });
  step('Does it work?', 'Tested on real survey data', 'We also ran it on real public survey data, to check our maths and our data-quality checks. It reports exactly what a district would see on day one.', async () => { closeAll(); full('importer'); await sleep(150); click('importer', /^Run on real survey A/); }, { app: 'importer' });

  // 13 — Trust
  step('Trust and safety', 'Rules both ministries sign', 'Every rule and number lives here, signed by both ministries. One ministry alone cannot change it.', () => { closeAll(); full('rulepack'); }, { app: 'rulepack', text: 'Signatures on the live pack', up: 1 });
  step('Trust and safety', 'Sharing only with permission', 'Health data is shared only with the mother’s permission, through India’s ABDM system, encrypted end to end. Only the one fact we need is kept.', async () => { closeAll(); as('CDPO'); const c = riya(); full('consent', { childId: c?.id, view: 'hie' }); await sleep(200); click('consent', /^▶ Run exchange/); }, { app: 'consent', text: 'Run exchange', up: 2 });
  step('Trust and safety', 'Nothing gets stuck', 'If a task is not done in time, it moves up: to the supervisor, then the CDPO and medical officer, then the district.', async () => { closeAll(); as('MS'); full('escalation'); await sleep(150); click('escalation', /^\+7 days/); }, { app: 'escalation', text: 'Each level acts', up: 1 });
  step('Trust and safety', 'District view: totals only', 'District officers see a map with totals, not names. Small numbers are hidden so no child can be identified.', () => { closeAll(); as('DPO'); full('district'); }, { app: 'district' });
  step('Trust and safety', 'The monthly meeting', 'Each month, a one-page report for the district meeting, ready to print.', () => { closeAll(); full('report'); }, { app: 'report', text: 'Print / save PDF' });
  step('Trust and safety', 'A tamper-proof record', 'Every action is written in a log that cannot be secretly changed. Watch: we change one line, and the check fails immediately.', async () => { closeAll(); full('audit'); await sleep(150); click('audit', /^Tamper with an entry/); await sleep(300); click('audit', /^Verify chain/); }, { app: 'audit', text: 'Verify chain' });
  step('Trust and safety', 'The whole system', 'The whole system on one page: data comes in, is checked, becomes a task for a person, and is watched until it is done.', () => { click('audit', /^Undo tamper/); closeAll(); full('arch'); }, { app: 'arch', text: 'L1 Capture', up: 1 });

  // 14 — Close
  step('Close', 'Two more ways to present', 'Two more ways to present: press S for Riya’s story, or J for the short jury tour.', () => { closeAll(); }, { root: '.menubar', text: 'Layout' });
  step('Close', 'The point', 'PoshanSetu does not replace the Tracker — it makes its data act in time. Watch which way the child is heading, and act while recovery is still simple. Thank you.', () => home(), { app: 'landing', text: 'ROUND 2 BUILD' });

  // give each step a slot time so the rehearsal autoplay works (about 22 s each)
  S.forEach((s, i) => { const t = i * 22; s.min = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; });
  return S;
}
