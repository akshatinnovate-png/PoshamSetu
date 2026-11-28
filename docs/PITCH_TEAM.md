# PoshanSetu — team pitch for Techfest IIT Bombay (10 minutes)

| Part | Who | Time | Covers (judging criteria) |
|---|---|---|---|
| 1. Problem + solution | Soumya | 0:00–2:00 | Problem, evidence, stakeholders, ecosystem, solution |
| 2. Live demo | Akshat | 2:00–8:30 | Detailed solution, every feature |
| 3. Plan + close | Soumya | 8:30–10:00 | Roadmap, feasibility, scale, impact |

Before you start: app open on Start here, Layout → Presenter zoom 115%. Click **◆ The missing piece** so it fills the screen while Soumya speaks (or press **w**).

## Part 1 — Soumya: problem and solution (2:00)

Good morning. We are PoshanSetu.

This is Riya, a two-year-old in Paschimi Singhbhum, Jharkhand. From February to July she was weighed six times, and every time she weighed 9.1 kilos. She grew three centimetres taller and not one gram heavier. No single weighing crossed a danger line, so the Poshan Tracker — which judges one reading at a time — said nothing. In August she was listed as severely malnourished.

Riya is from our test data, but her pattern is common. Research in Nature found that 29% of children have a wasting episode by age two, but only about 6% look wasted at any single moment. One reading at a time misses most of them. And this district has India's highest stunting: 60.6%.

*(Screen: The missing piece.)* Our name means it: Poshan Setu — the nutrition bridge. India already weighs every child — the Poshan Tracker, 7 crore children. India already treats severe malnutrition — CMAM, nutrition centres, doctors. But look at what's in between. *(Point at the red boxes.)* Nobody spots the danger early. Nobody gets a task with a deadline. Nobody makes sure it happens. Health data sits in another ministry. That's where Riya fell through.

*(Click **Fill the gaps with PoshanSetu**.)* PoshanSetu is that bridge. It sits on top of the Tracker and does three things. One — it reads the direction of a child's growth, not just one number, and warns months earlier. Two — it turns every warning into a task: a named worker, a reason in plain words, and a deadline. Three — it makes sure the task gets done: the Anganwadi worker and the ASHA both report, late tasks move up to supervisors, and health data is shared only with the mother's consent.

*(Point at the table.)* In our test district, 93 of 140 children who became severely malnourished got a task first — a median of 66 days earlier. Riya: 125 days. Akshat will now show you every part of it, live.

## Part 2 — Akshat: live demo (6:30)

About 20–30 seconds per step.

1. **One app for everyone (0:10).** Start here → Anganwadi worker. "One app for everyone. I pick who I am, and it opens what that person needs. I'm Kamla, the Anganwadi worker."
2. **To-do list (0:25).** "Kamla's to-do list, most urgent first. RED-A: hospital today; RED-B: treat at the Anganwadi; AMBER: home visit within 7 days; WATCH: weigh again. Each card says why, in plain words, and how much time is left. The clock starts when the child was weighed. These ticks show whether Kamla and the ASHA have each visited."
3. **Type notes (0:50).** Try an example. "Adding data is like writing a note. It reads four children at once and checks every number against WHO standards." Rohan: "300 cm is impossible for a one-year-old — it's stopped; nothing wrong is ever saved." Rahul → Yes, use 9.2: "a slipped decimal, one tap fixes it." Save: "Each child now has a colour. Somari has swollen feet — RED-A, hospital today. With a Groq key an AI reads messier notes, but the same WHO checks decide what's saved."
4. **Form (0:15).** Fill a form. "For one child: arm band by colour, danger signs, appetite test; it shows the result before saving."
5. **Riya's record (1:00).** Dock → Child → Choose a child → Riya Hembrom. "Chart one: the dots stay flat while the WHO lines rise — the warning the old system missed. Chart two: weight for height; the pink cone is a Kalman-filter forecast of where she's heading. On the right: why she's AMBER in plain words, the signed rule-pack version, the chance she gets worse in 60 days, and risk points that decide who's visited first." Timeline: "everything that happened, in order." Health signals: "vaccines and diarrhoea from the health system, only with the mother's consent."
6. **No signal (0:20).** Dock → AWW phone. "Records wait on the phone and sync later. The deadline still counts from the weighing, so a bad network never hides an emergency and the worker isn't blamed."
7. **Fix 1, speed (0:25).** Key 1. "A 24-hour clock can't run on weekly reports. Data now arrives live through API Setu, with an SMS path for emergencies; this table proves which paths are fast enough." Send RED-A: "an emergency travels by SMS in minutes and gets a 24-hour task."
8. **Fix 2, two workers (0:25).** Key 2. "Different ministries — no need to visit together. Either goes first, within 7 days." ☎ then 1: "a Hindi voice call on a keypad phone; press 1. The task closes only when both have reported."
9. **Fix 3, migration (0:25).** Key 3. Verify offline, Tamper 1 byte. "A signed card checked with no internet; change one character and it fails. Lost card: a phone code, or the mother's thumbprint or face."
10. **Fix 4, data quality (0:20).** Key 4. "A data-quality score per Anganwadi. A broken scale counts far more than rounding. Too many zeros and fives means guessing — we send a trainer, not a penalty."
11. **Fix 5, cost (0:15).** Key 5. "₹33 lakh for 250 Anganwadis, about ₹330 per child, because we reuse API Setu, ABDM and Bhashini."
12. **Does it work? (0:35).** Key t. "1,440 realistic synthetic children: 66% of severe cases flagged first, a median of 66 days earlier, 57% precision." Trade-off curve: "catching more costs precision; we chose the best point above 55%." Ablation: "every rule had to prove it helps; one didn't, so it's off."
13. **Trust (0:45).** Key r: "every threshold signed by both ministries." Key k → ABDM exchange → Run: "data moves only with the mother's consent, through ABDM, encrypted; only a single flag is kept." Key e → +7 days: "late tasks climb to supervisor, block, district." Key a → Tamper → Verify: "a tamper-proof log; change one line and the check fails."
14. **Hand over (0:05).** "That's PoshanSetu, working today. Soumya."

If you're running late, skip steps 4, 6 and 11, then the Rule pack and Audit in step 13.

## Part 3 — Soumya: plan and close (1:30)

Here's how it gets to children.

Twelve months, three phases. Months 1 to 3: run this same test on real, anonymised Tracker data and fix the thresholds. Months 4 to 9: a pilot in 2–3 blocks, about 250 Anganwadis and 10,000 children, through one migration season — eight weeks silent, then live. Months 10 to 12: compare with similar blocks, and the State decides.

It's feasible because it reuses what India already built — the Tracker, API Setu, ABDM, Bhashini — so it's ₹330 per child in the pilot and ₹30 a year after that. No new app for workers.

It scales because the rules live in a signed rule pack: a new state needs a new pack, not new code. Re-checking a child takes about 28 microseconds — all 7.3 crore children in about 35 minutes. It ships as a Tracker update and as the nutrition layer for SSBSK.

We'll measure success by four numbers: at least half of severe cases flagged early, at least 30 days of warning, at-risk children visited within 7 days, and fewer moderate cases becoming severe than in comparison blocks.

PoshanSetu doesn't replace the doctor or the worker. It makes sure they know months earlier, that each has one clear task, and that someone notices when it's stuck.

Don't wait for a child to cross a line. Watch which way she's heading — and act while recovery is still simple. Thank you.

## Q&A — who answers what

| Question about | Answer |
|---|---|
| The problem, the people, why it's needed, the doctor question, cost, the pilot | Soumya |
| How it works, data, accuracy, AI, security, offline, scale | Akshat |
| "Is this real data?" | Akshat: "Synthetic, matched to the district's real statistics, and tested on real public survey data. Phase 1 repeats it on real Tracker data." |

Coaching for Soumya: say the problem once, in Part 1 only. In Part 3, look forward — plan, cost, scale, impact.
Coaching for Akshat: practise the clicks until they're automatic. One full timed run-through together is the most valuable preparation.
