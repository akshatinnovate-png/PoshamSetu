# Overnight build report

Branch: `claude/great-shannon-unb585` · all work committed and pushed · CI (engine + service tests) green on GitHub.

## What exists now

**PS.OS1** is a desktop app (Electron; it also runs as a web build). It is a working prototype of the Round 1 proposal, and each of the five Round 1 audit points is answered with running code, not slides.

| Audit point | Where it lives | Status |
|---|---|---|
| 1. Batch exports can't drive a 24 h clock | **Bridge** window; **AWW phone** offline demo; `engine/bridge.js`, `engine/tasks.js`, `server/index.mjs` | Event-time clock, late-arrival escalation, SMS flash path, clock-safety test, honest nightly-delta fallback |
| 2. AWW–ASHA joint-visit friction | **Joint visit** window (IVR phone) | Either order, closes only with both; half-closed and conflict states; CMAM milestones for RED-B |
| 3. QR lost at the kiln | **Migration** window | Ed25519 token verifies offline; IVR short code with check character; eKYC fingerprint / Face RD ladder; k-anonymous route notice |
| 4. Naive R-score | **R-score** window | Weighted formula, BIV quarantine, chronic-only digit preference with sample-size correction, calibration sliders |
| 5. Rs 12 L "enterprise DPI" | **Budget** window | MVP line items, reuse of DPI blocks, cost per child vs scale, separate Phase 3 capex |

Other pieces built:

- **Engine:** WHO 2006 z-scores, Rules 1–3 and the extras (trend + consent, infant velocity, sustained fall), versioned dual-signed rule pack, Table 3 escalation, consent gating, FHIR R4, and a hash-chained audit log.
- **Synthetic district:** Paschimi Singhbhum, 3 blocks, 36 AWCs, 1,440 children.
- **Windows:** silent-trial backtest with a strict baseline and a robustness check across 5 more districts; a Phase 1 CSV import tool; a DPO convergence report (PDF); the Brief (problem, ecosystem, stakeholders, roadmap, impact, references); a 15-step Jury tour presenter mode; the Shell.
- **Companion HTTP service:** HMAC webhook, SMS, IVR, tasks, FHIR and tokens.
- **Tests and packaging:** 44 tests, a Chromium smoke test across every window × role × tab, and packaging scripts for Windows, Linux and Mac (the Linux build was launched and verified).

## Honest findings worth knowing before the finals

- **Lead time:** about 69% of children who reached the Tracker's SAM list were flagged AMBER first, a median of about 87 days earlier. Across 5 more districts the range is 67–73% and 84–104 days.
- **Stricter test:** only 12–21% were flagged before the Tracker listed them *at all* (MAM or SAM). Most of the early warning is a confirmed MAM that the Tracker would also list, but without an owner, deadline or escalation. I added a "sustained fall" rule (two monthly falls adding up to 0.5 SD), which raised the strict figure from 12% to 21%. Both numbers are in the Trial window and the Q&A. Say this before a judge finds it.
- **Workload:** at 30% wasting, the "2 new AMBER visits per AWC per month" cap binds in about two-thirds of AWC-months. The ranked queue handles it, but cap calibration is a real Phase 1 question.
- **Nightly-delta fallback** (if no Tracker API): clock-safe for WATCH, borderline for AMBER (p95 about 17 h against a 16.8 h budget). RED stays safe through SMS.
- **Everything is synthetic.** The infant velocity centiles are approximations, flagged in the rule pack.

## How to use it

```bash
npm install
```

```bash
npm start
```

Then press `j` for the Jury tour. See `docs/DEMO_SCRIPT.md` for the 10-minute run-through and `docs/JURY_QA.md` for Q&A prep.

```bash
npm run dist:win
```

That produces a Windows build in `dist/`. It is not committed because it is about 360 MB.
