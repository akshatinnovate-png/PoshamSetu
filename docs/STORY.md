# Riya's story — the demo told through people

Press **`s`** in the app (or **Layout → Riya's story**) to run it. Each of the 12 steps opens the right window, sets the right role, and shows who is speaking and what to say on the caption bar. **→ / ←** move between steps; **▶ auto** runs it on the timings below.

The jury tour (`j`) tells the same product as five audit fixes. Riya's story tells it as one child and the people who can act for her. Use the story when the room needs to *feel* the problem; use the jury tour when it wants the checklist. The audit fixes are all still in the story: Fix 01 is step 7, Fix 02 is step 6, Fix 03 is step 8, Fix 04 is step 11, and the trade-off is step 5.

## The cast

| | Who | Their constraint | What PoshanSetu changes for them | Window |
|---|---|---|---|---|
| ![](screens/cast-riya.svg) | **Riya Hembrom**, the child | A slow fall is invisible to a system that reads one weighing at a time. | Her *direction* is read: AMBER with a reason, months before the SAM list. | Child record |
| ![](screens/cast-sunita.svg) | **Sunita Hembrom**, Riya's mother | Leaves for a brick kiln in December; the MCP card gets lost; the phone is off for days. | A signed token verifies offline; IVR short code, thumb or face finds Riya's record at the kiln AWC. Her consent decides which flags cross ministries. | Migration, Consent |
| ![](screens/cast-kamla.svg) | **Kamla Devi**, Anganwadi Worker | 40 children, one growth day a month, a Tracker app offline half the day; blamed for late data. | A short Hindi day-card: who, why, by when. Re-weigh only when asked; at most two new AMBER visits a month, ranked by risk. Late data is booked to the pipeline, not to her. | Worklist, AWW phone, AWW app |
| ![](screens/cast-phulmani.svg) | **Phulmani Hansda**, Sahiya (ASHA) | Keypad phone, no data pack, a different ministry from Kamla. | A Hindi voice call: press 1 when visited. Her visit and Kamla's close the task in either order within 7 days. | Joint visit |
| ![](screens/cast-basanti.svg) | **Smt. Basanti Tiu**, Mukhya Sevika | 25 Anganwadis; cannot see which tasks are stuck. | Half-closed and overdue tasks per AWC; reliability flags that call for training, not a penalty. | Escalation |
| ![](screens/cast-anita.svg) | **Smt. Anita Purty**, CDPO (with the Block MO) | Block counts arrive monthly; a broken scale looks like a healthy village. | Weekly overdue RED/AMBER; weighted reliability per AWC; names only through logged break-glass. | R-score |

The cast are **composite personas**, built from the proposal's ecosystem analysis, to be validated in Phase 1 interviews. Riya is a **synthetic child chosen by the engine** (`app/engine/story.js`): a girl whom the Tracker would have put on the SAM list, and whom PoshanSetu flagged before the Tracker listed her at all. Only display names change; no reading, rule or metric does (`test/story.test.js` checks this).

## Riya's record (reference district, seed 71100)

Bhoya Anganwadi, Tonto block. Riya's weight-for-height (WHZ), month by month:

| Date | Age | Weight | Height | MUAC | WHZ | PoshanSetu | Tracker today |
|---|---|---|---|---|---|---|---|
| 22 Nov 2025 | 17 m | 8.9 kg | 75.6 cm | 135 mm | −0.44 | on track | — |
| 22 Jan 2026 | 19 m | 9.0 | 77.7 | 133 | −0.78 | on track | — |
| 22 Feb 2026 | 20 m | 9.1 | 77.7 | 135 | −0.66 | on track | — |
| 22 Mar 2026 | 21 m | 9.1 | 79.3 | 138 | −1.02 | on track | — |
| **22 Apr 2026** | 22 m | 9.1 | 80.5 | — | −1.30 | **AMBER** — WHZ fell two months running (−0.66 → −1.02 → −1.30) | — |
| 22 May 2026 | 23 m | 9.1 | 80.7 | 129 | −1.34 | AMBER — 0 g gained in two months (WHO 2009 15th centile: 53 g) | — |
| 22 Jun 2026 | 24 m | 9.1 | 80.5 | 130 | −1.47 | on track — she turned 24 months; see below | — |
| 22 Jul 2026 | 25 m | 9.1 | 81.0 | 129 | −1.59 | WATCH — weight-for-age crossed −2 SD; re-weigh to confirm | — |
| 22 Aug 2026 | 26 m | 8.8 | 82.4 | 123 | −2.35 | AMBER | MAM list |
| **25 Aug 2026** | 26 m | 8.9 | 81.9 | 114 | −2.08 | RED-B | **SAM list** |

**The line to remember:** from January to July, seven growth days in a row, Riya's weight stayed at 9.0–9.1 kg. She grew 3.3 cm taller and no heavier. No single weighing crossed a line, so a system that reads one weighing at a time saw nothing. PoshanSetu read the direction and flagged her on **22 April**. The Tracker listed her as SAM on **25 August: 125 days later**.

## The script (10 minutes)

| Time | Step | Speaker | On screen | Say (the caption has the full text) |
|---|---|---|---|---|
| 0:00 | Meet Kamla | Kamla | Kamla's worklist (AWW role, Bhoya) | Forty children, one growth day, an app that is offline half the day. Every line here has a reason, an owner and a deadline. |
| 0:50 | Meet Riya | Riya | Riya's record | 9.1 kg, seven months running; taller, not heavier. No line crossed, so the Tracker says nothing. |
| 1:50 | Two systems, one child | Riya | Home → "Riya. Two systems." replays | Left: the Tracker — nothing, then a list. Right: AMBER on 22 April. SAM list on 25 August. 125 days. |
| 2:40 | Why AMBER — in words | Riya | Riya's record, "Why this tier" | The reason in words, the rule, the signed pack version. The pink cone is where she is heading. |
| 3:20 | Riya was the silent trial | Riya | Trial → Trade-off curve | Honest: no one acted on Riya, because it was the silent trial. Across all children, 66% flagged first, median 66 days. More catches cost precision; this is where we stopped. |
| 4:10 | Phulmani's phone rings | Phulmani | Joint visit (a live task in Bhoya) | Keypad phone, Hindi call, press 1. Kamla's tick and Phulmani's 1, either order, 7 days. |
| 5:10 | When Kamla has no signal | Kamla | AWW phone | Offline oedema case; the 24-hour clock started at the weighing; a late sync escalates on arrival and is not her fault. |
| 5:50 | Sunita leaves for the kiln | Sunita | Migration | Card lost, phone off. Signed token verifies offline; IVR short code; thumb or face at the kiln AWC. |
| 6:40 | Sunita decides what is shared | Sunita | Consent → ABDM exchange runs live | Vaccine and diarrhoea flags reach the rules only under her consent; encrypted; only the minimal flag is kept. |
| 7:30 | Basanti sees what is stuck | Basanti | Escalation ladder (her sector) | Tasks climb a level each time a clock runs out, counted from the weighing. These are the ones to chase this week. |
| 8:20 | Anita asks: is the scale right? | Anita | R-score (her block) | A broken scale makes a village look healthy. She sends a trainer, not a penalty; bad readings never raise alerts. |
| 9:20 | The point | Riya | Home | PoshanSetu does not make Riya's line go up — Kamla, Phulmani and Sunita do. It makes sure they know months earlier, each has one clear task, and someone notices when it is stuck. |

## Questions the story invites

**"Did you pick Riya to look good?"** Yes, she is an illustration, and the engine chose her by a published rule (`pickStoryChild`): an eventual-SAM girl flagged before any Tracker listing, with a lead close to four months. Her 125 days is better than the median of 66; quote the median when you quote the district. Press **Mode → Regenerate district** and a different Riya appears in a different village, chosen by the same rule.

**"Why did Riya still become SAM?"** Because the silent trial measures what PoshanSetu *would* have flagged without changing what anyone did. That is how lead time is measured honestly. Whether 125 days of warning changes her outcome is the Phase 2 question, measured against matched non-pilot blocks.

**"In June she went back to 'on track'. Why?"** Because she turned 24 months. The WHO 2009 weight-velocity standards stop at 24 months, so the velocity rule that flagged her in May could no longer fire — while her weight was still flat. Her WHZ fell only 0.13 SD that month, too little for the trend rule, so the episode closed. **This is a real gap, and we say so:** after 24 months only the WHZ trend rules and the Kalman forecast watch a flat weight (her forecast rose from 20% in May to 39% in July). Two fixes go to Phase 1: keep an open AMBER episode alive across the 24-month boundary, and test a weight-for-age velocity rule for 24–59 months. Riya was re-flagged in July (WATCH) and August (AMBER), so she was never lost — but she had a quiet month she should not have had.

**"Are these real people?"** No. They are composite personas with common names from the district. Every child record is synthetic.

**"What happens in the phone app?"** Open the AWW app (Home → "Then we made it smarter" → Open the AWW app, or `npm run pwa`). It opens on Kamla's Anganwadi in Hindi: "नमस्ते, Kamla दीदी", with her day's visits.
