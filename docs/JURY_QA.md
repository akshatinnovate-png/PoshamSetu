# Round 2 — jury Q&A preparation

Each answer is short enough to say in the 5-minute interaction, and each points to a window you can open live in PS.OS1.

## The five stress-tests from the Round 1 audit

### 1. "Batch exports can't drive a 24-hour RED-A clock." → open **Bridge**
- We agree, and we dropped exports as a clock source. Events now come in through the Poshan Tracker Open API via API Setu (webhook, with polling as a fallback). That is a read-only scope under an MoU with MoWCD/NeGD.
- RED signs (oedema, danger signs, MUAC < 115) also go out as a one-line structured SMS that works on 2G without data. In the prototype its p95 lag is about 15 minutes, against an API p95 of about 7 hours, which is dominated by AWW devices being offline.
- The clock starts at **measurement time**, not arrival. If an event arrives after a deadline, the task escalates on arrival and the breach is booked to the pipeline, not the worker.
- Clock-safety rule: an adapter may drive a tier's clock only if its p95 lag is at most 10% of that tier's deadline. The batch export fails this for every tier, and the window shows it.
- Counterfactual replay of the same pilot period (1 Oct – 17 Nov): with weekly exports, 13 of 21 RED tasks and 5 of 42 AMBER tasks would have reached PoshanSetu after their deadline had already passed. With the bridge, none did.

### 2. "AWW and ASHA can't coordinate a joint visit." → open **Joint visit**
- They don't have to. The visit can be joint or sequential, in either order, within the 7-day window.
- The task closes only when both confirmations are in: the AWW app flag and the ASHA pressing 1 on any phone (IVR or DTMF, no app, no data pack).
- A half-closed task shows exactly who is missing. Conflicting outcomes (visited vs migrated) go to the Mukhya Sevika as CONFLICT, and a trace task opens.
- No new payment is created. ASHAs reach the task through the call or SMS, and through the ANM / ASHA facilitator.

### 3. "QR cards get lost at the kiln; there is no signal for an OTP." → open **Migration**
- The token is signed (Ed25519) and verifies **offline** on the destination AWW's device. Signal is needed only to fetch a lost token.
- Recovery ladder: QR (offline) → OTP → a 10-character IVR short code with a check character, dialled from any phone (including the kiln munshi's) → the mother's Aadhaar eKYC on the **destination AWC tablet**, which uses that tablet's connection, not the family's → Face RD or iris, because brick-moulding wears down fingerprints → fresh enrolment and a supervisor merge on return.
- We never store Aadhaar numbers. We store only a salted hash of the UIDAI UID token, following Aadhaar Data Vault guidance.
- Unannounced migration is caught by the 45-day lost-to-follow-up rule. Destination CDPOs get k-anonymous route counts before the season.

### 4. "Your R-score weights a broken scale like a rounding habit." → open **R-score**
- New formula: `R = 100 × (1 − min(1, 4·B + 1·F + 0.3·D·chronic))`.
- Each implausible reading (B) is also **quarantined individually**. It never drives triage and it triggers a re-measure.
- Digit preference (D) raises a supportive-supervision audit flag only. It enters R after 3 consecutive months above threshold. It is also corrected for sample size: with 120 readings, an unbiased AWC still shows about 0.11 dissimilarity.
- In the synthetic district, the "sloppy" AWCs (decimal slips) score 94–98 under the Round 1 formula but 75–87 under the new one, which is the scatter plot in the R-score window. RED alerts always act whatever R is.
- The weights are starting values. Phase 1 calibrates them, and the sliders show the effect live.

### 5. "Rs 12 lakh can't build enterprise DPI." → open **Budget**
- Correct, and that was never the claim. Rs 12 L is the **pilot MVP** for three blocks: a lead engineer and a developer fellow for six months, a security and accessibility review, and ABDM sandbox certification.
- It is affordable because we reuse open building blocks instead of rebuilding them: Sunbird RC, the ABDM gateway and SDKs, Bhashini (IVR speech), API Setu, MeghRaj/NIC hosting, and empanelled CPaaS.
- National rollout is a **separate MeitY/NIC capital line**: about Rs 4–6 cr for native integration and hardening, plus a CERT-In audit and language packs. Recurring cost per child falls with scale (see the chart).

## Other likely questions

**Why rules and not machine learning?** Every alert has to be explainable to an AWW and defensible to a CDPO, and no public child-level training data exist. Rules live in a signed, versioned pack, and every alert shows its reason and pack version. ML can be tested later inside the silent trial, but it never runs live without both ministries signing.

**Won't this flood AWWs with alerts?** There are three guards. Confirmation by re-weigh is needed before AMBER. Episode logic means a recurring dip within 60 days is follow-up, not a new visit. And there is a cap of 2 new AMBER visits per AWC per month, with a ranked queue that escalates at day 10. The backtest is honest that the cap binds in many AWC-months at 30% wasting. That is exactly why we rank the queue, and it is a Phase 1 calibration point.

**What is the evidence it works?** The silent-trial backtest (Trial window) runs on synthetic data tuned to district levels. Quote it honestly, in two parts:
- *Against the Tracker's SAM list:* about 69% of children who reached it were flagged AMBER first, a median of about 87 days earlier, with precision of about 60%. The Table 5 hypotheses were at least 50% and a median of at least 30 days.
- *Against the Tracker's first listing of any kind (MAM or SAM):* 12–21% were flagged before the Tracker listed them at all (about 55 days earlier in the main run). That is the pure value of the trend rules (Rule 2, sustained fall, infant velocity, trend plus signal). For the rest, the gain is not detection but **action**: a MAM listing in the Tracker today has no owner, deadline or escalation, and in PoshanSetu it becomes a confirmed task with a clock.
- Robustness: across 6 independently generated districts (Trial → Robustness) the figures stay within 67–73% flagged earlier, a median of 84–104 days, and 59–63% precision. It is not one lucky run.
- Phase 1 repeats both on anonymised real data, and the first 8 live weeks run silent.

**Couldn't the Tracker just add a MAM alert and get most of this?** It would get the list, not the loop. The loop is confirmation by re-weigh (fewer false alerts), a named AWW and ASHA task, a deadline counted from measurement, escalation to people who can act, and closure that needs both workers. The trend rules add children who are not on any list yet.

**Who owns the thresholds?** MoWCD and MoHFW jointly. The Rule pack window shows that a draft needs both signatures. One ministry alone cannot change a cut-off.

**DPDP compliance?** Processing inside the Tracker rests on s.7(b) (State benefits). Cross-ministry flags pass only under an ABDM consent artefact: one purpose, a set time, renewed at later contacts, with assisted consent reconfirmed at the VHSND. Consent-manager rules have applied since 13 Nov 2026, and main duties apply from 13 May 2027. Names are masked above the sector, break-glass is logged, counts under 20 are suppressed above block level, and the audit chain is tamper-evident.

**How does RED-B follow the CMAM protocol?** A RED-B task closes only when the AWW and ASHA visits *and* the two protocol milestones are on record: the appetite test within 72 hours and the Medical Officer screening by day 5. A failed appetite test raises a new RED-A task (complicated SAM, same-day referral).

**What about children under 6 months?** MUAC is not used. They get a weight-for-length and feeding check, flags route to the PHC, and a wasted infant is RED-A.

**Why not wait for SSBSK?** SSBSK stops at 36 months and has no public rule for when poor growth makes a child at-risk. PoshanSetu is designed to be its nutrition layer, and its AMBER list feeds the SSBSK at-risk visit schedule for children under 36 months.

**Scalability?** Rule packs and FHIR mappings are state-agnostic. The engine has no dependencies and runs the whole 1,440-child district plus the backtest in under a second on a laptop. Scale is a hosting question, not an algorithm question.

**What if MoWCD does not expose a Tracker API in time?** The bridge is a ladder, not a bet:
1. The Tracker Open API via API Setu (the target).
2. A State data-sharing MoU for a nightly delta from the State ICDS mirror. That is safe for AMBER and WATCH clocks (p95 well under 16.8 h and 33.6 h).
3. The SMS flash for RED signs, which does not depend on either. So RED clocks stay safe in every case.

The Bridge window's clock-safety matrix is how we decide which path may drive which clock. A path that fails the test can still feed data, but it never starts or stops a deadline.

**Why would an AWW use this — isn't it one more app?** It isn't an app for her. She keeps recording in the Tracker. PoshanSetu gives her at most two new AMBER visits a month (ranked), a bilingual card that says what to do and why, and a breach record that is never booked to her when the data pipeline was late. Reliability flags lead to supportive supervision, never penalties.

**Who runs it after the pilot?** The State ICDS directorate owns operations, with NIC hosting under the Phase 3 capex line. Rule packs are owned jointly by MoWCD and MoHFW. Recurring cost is about Rs 30 per child per year at pilot scale, and it falls with scale (Budget window).

**Is the data secure?** The prototype includes Ed25519-signed rule packs and tokens, names masked above the sector, logged break-glass, k-anonymity above block level, a hash-chained audit log, pseudonymous exports, a strict Content-Security-Policy, and no network calls at all. Production adds an HSM or eSign for keys, CERT-In audit, and MeitY-empanelled hosting.

**How do you know the WHO z-scores are right?** The engine uses the published WHO 2006 LMS tables directly, with WHO's restricted method beyond ±3 SD and the 0.7 cm length/height adjustment. Tests check medians, the SD lines and continuity at the 24-month switch (`npm test`).
