# PoshanSetu — the 6-minute pitch, word for word

Spoken over the live prototype. About 885 words: 6 minutes at a natural 150 words a minute. Time two full run-throughs; if you run over, cut the scalability paragraph’s second sentence first. **[SCREEN]** lines are what to click; they are not read out. Each block is tagged with the Round 2 item it scores (the jury's list: problem validation and stakeholders, ecosystem, solution, roadmap, feasibility, scalability, impact).

**Before you start:** app open on Home, district at seed 71100 (Mode → Back to the reference district), Layout → Presenter zoom 115%. Every click below is one step of Riya's story (`s`), so pressing **→** does the work if you prefer.

The slot is 10 minutes. This script takes 6, which leaves room for a slow projector, a question during the demo, or the optional 2-minute block at the end.

---

## 0:00 — Riya `[Problem validation]`

**[SCREEN]** Press `s`. Step 2: Riya's record opens.

> This is Riya. She is two years old, and she lives in Bhoya, a village in Paschimi Singhbhum, Jharkhand.
>
> From February to July this year, Riya was weighed six times. Every time, she weighed nine point one kilos. She grew more than three centimetres taller — and not one gram heavier.
>
> Not one of those weighings crossed a line. So the Poshan Tracker, which judges a child one reading at a time, said nothing. On the twenty-fifth of August, Riya was put on the SAM list. Severe acute malnutrition.
>
> Riya is synthetic. Her pattern is not.

## 0:40 — The gap and who it hurts `[Problem, evidence, stakeholders]`

> Research in *Nature* found that twenty-nine percent of children have a wasting episode by their second birthday — but at any single moment, only five to six percent look wasted. A system that reads one weighing at a time misses most of them.
>
> Paschimi Singhbhum has the highest stunting in India: sixty point six percent. Wasting is thirty percent. Two in three people are Scheduled Tribe, and many families migrate to brick kilns every winter.
>
> The people who can act for Riya are already there. Kamla, the Anganwadi worker, with forty children and a phone that is offline half the day. Phulmani, the ASHA, with a keypad phone and a different ministry. Riya's mother, Sunita, who leaves for a kiln in December. Their supervisors, who see monthly counts — not stuck children.

## 1:20 — Why the gap persists `[Ecosystem]`

**[SCREEN]** Brief → 2 · Ecosystem (or just keep talking over Riya's record).

> India already has the pieces. The Poshan Tracker holds growth data for seven crore children. U-WIN has vaccines. ABDM has consent. SSBSK has home visits.
>
> But the Tracker lists a child from one reading. A missed vaccine or diarrhoea sits in another ministry's system. The ASHA works outside the Tracker. And a migrating child is found only if a worker at the kiln happens to look.
>
> The gap is not data. It is action. **PoshanSetu does not replace the Tracker. It makes the data it already holds act in time.**

## 1:50 — What PoshanSetu does `[Solution — live]`

**[SCREEN]** Step 3: "Riya. Two systems." replays.

> On the left, the Tracker today: nothing, then a list. On the right, PoshanSetu. It reads Riya's direction, not just her position. On the twenty-second of April, after two monthly falls, it raised AMBER — one hundred and twenty-five days before the SAM list.

**[SCREEN]** Step 4: Riya's record, "Why this tier".

> Every alert says why, in words: "weight-for-height fell two months running." It names the rule and the version of the rule pack that fired — and that pack is signed by both ministries. The pink cone is a forecast of where she is heading.

**[SCREEN]** Step 6: Joint visit.

> Then a person gets a task with a deadline. Kamla ticks her visit in the app. Phulmani gets a Hindi voice call and presses one. Either order, within seven days — the task closes only when both are in.

**[SCREEN]** Step 8: Migration.

> When Sunita leaves for the kiln, a signed transfer token goes with her. It verifies with no signal. Lost the card? A short code from any phone, or her thumb — or her face, when kiln work has worn her fingerprints.

**[SCREEN]** Step 10: Escalation.

> And if a task is stuck, it climbs: to the supervisor, the CDPO, the district — on a clock that starts when the child was weighed, not when the data arrived.

## 3:40 — Does it work? `[Impact assessment, evidence]`

**[SCREEN]** Step 5: Trial → Trade-off curve.

> We ran a silent trial on fourteen hundred and forty synthetic children, tuned to this district. Sixty-six percent of children who reached the SAM list were flagged first — a median of sixty-six days earlier. Across six simulated districts: sixty-one to seventy-five percent.
>
> Earlier is not free. Each dot here is a set of rules. Catch more, and more home visits find a child who was fine. We stopped where precision stays above fifty-five percent — and every rule had to prove it raised early detection to stay in. One did not, and it is switched off.
>
> The growth maths is checked against the WHO's own tables: four hundred and ninety published values, matched to within one gram.

## 4:20 — Can it be built? `[Feasibility, roadmap]`

**[SCREEN]** Budget window (key `5`).

> The pilot is two to three blocks, about two hundred and fifty Anganwadis, ten thousand children. Thirty-three lakh rupees — about three hundred and thirty rupees a child — and thirty rupees a child a year after that. We reuse what India already built: API Setu, ABDM, Bhashini. No new app for Kamla.
>
> Twelve months, three phases. Months one to three: repeat this trial on anonymised Tracker data and fix the thresholds. Months four to nine: pilot through one migration season — eight weeks silent, then live. Months ten to twelve: compare against matched blocks, and the State decides.

## 5:00 — How it scales `[Scalability, impact]`

> The rules live in a signed rule pack and the data travels as FHIR, so any state can adopt them without new development. Re-checking a child takes about thirty microseconds — the whole country is a server problem, not a research problem. It ships as a Tracker release, as the nutrition layer of SSBSK.
>
> What it changes: children caught while recovery is simple, at the Anganwadi instead of a hospital ward. Migrant families who keep their rations and check-ups. And scarce visits sent to the children most at risk first.

## 5:35 — Close

**[SCREEN]** Step 12: Home.

> PoshanSetu does not make Riya's line go up. Kamla, Phulmani and Sunita do. We make sure they know months earlier, that each of them has one clear task, and that someone notices when it is stuck.
>
> Don't wait for a child to cross a line. Watch which way she is heading — and act while recovery is still simple.
>
> Thank you.

---

## Optional: 2 more minutes, if the clock allows `[Solution depth]`

Use one or both, between "Does it work?" and "Can it be built?".

**Offline (step 7, AWW phone, ~50 s).** **[SCREEN]** Offline → tap a child → tick oedema → Save → +6 h → Online.
> In a forest village there is no signal. Kamla records a swollen-feet case offline. Six hours later it syncs. The twenty-four-hour clock started at the weighing — and if a deadline passed on the way, it escalates on arrival and is booked to the network, not to her.

**Consent (step 9, ABDM exchange, ~50 s).** **[SCREEN]** The exchange runs by itself.
> Riya's vaccine record lives with the health ministry. It reaches Kamla's rules only under Sunita's consent, through ABDM: one purpose, a set time, revocable. The data is encrypted end to end, and we keep only the one flag we need. Everything else is discarded.

---

## Delivery notes

- **Numbers to say exactly:** 125 days (Riya), 66% and 66 days (district), 61–75% (six districts), 55% (precision floor), 490 values within 1 g, Rs 33 lakh, 250 AWCs, Rs 330 a child.
- **Say "synthetic" once, early,** in your own words ("Riya is synthetic. Her pattern is not."). It disarms the first question.
- **Riya's 125 days is better than the median.** That is why the script gives the district median straight after. If asked, say she was chosen by a published rule, and that pressing Regenerate gives a different Riya.
- **Pause after "not one gram heavier."** It is the line the room remembers.
- **If a judge asks why Riya was "on track" in June:** she turned 24 months, where the WHO velocity standards end. It is a real gap we found ourselves, with two fixes going to Phase 1. Full answer in `docs/STORY.md`.
- **For the other questions,** `docs/JURY_QA.md`.
