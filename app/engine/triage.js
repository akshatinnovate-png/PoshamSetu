// Layer 2/3 triage: explainable, versioned rules over a child's dated measurement events.
// Every tier carries the reasons that produced it and the rule-pack version.
import { indices, bivFlags, DAYS_PER_MONTH } from './growth.js';
import { TIER_RANK } from './rulepack.js';
import { DAY, round } from './util.js';

const IST = 5.5 * 3600000;
export const dayKey = (t) => Math.floor((t + IST) / DAY);

/** Group raw events into visits (one per calendar day), detect same-day discrepancies and BIVs. */
export function buildVisits(child, events, pack) {
  const A = pack.anthropometry;
  const byDay = new Map();
  for (const e of [...events].sort((a, b) => a.t - b.t)) {
    const k = dayKey(e.t);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(e);
  }
  const visits = [];
  for (const [, evs] of byDay) {
    const last = evs[evs.length - 1];
    const dq = [];
    const ws = evs.map((e) => e.weightKg).filter((v) => v != null);
    const hs = evs.map((e) => e.heightCm).filter((v) => v != null);
    if (ws.length > 1 && Math.max(...ws) - Math.min(...ws) > A.sameDayToleranceKg) dq.push({ code: 'SAME_DAY_WEIGHT', text: `Same-day weights differ by ${round(Math.max(...ws) - Math.min(...ws), 2)} kg (> ${A.sameDayToleranceKg} kg)` });
    if (hs.length > 1 && Math.max(...hs) - Math.min(...hs) > A.sameDayToleranceCm) dq.push({ code: 'SAME_DAY_HEIGHT', text: `Same-day heights differ by ${round(Math.max(...hs) - Math.min(...hs), 1)} cm` });
    const v = {
      t: last.t,
      eventIds: evs.map((e) => e.id),
      weightKg: ws.length ? ws[ws.length - 1] : null,
      heightCm: hs.length ? hs[hs.length - 1] : null,
      lying: last.lying,
      muacMm: evs.map((e) => e.muacMm).filter((x) => x != null).pop() ?? null,
      oedema: evs.some((e) => e.oedema),
      danger: [...new Set(evs.flatMap((e) => e.danger || []))],
      appetite: evs.map((e) => e.appetite).filter(Boolean).pop() || null,
      remeasure: evs.some((e) => e.remeasure),
      receivedAt: Math.max(...evs.map((e) => e.receivedAt ?? e.t)),
      dq,
    };
    v.ageDays = (v.t - child.dob) / DAY;
    v.ageMonths = v.ageDays / DAYS_PER_MONTH;
    v.ix = indices(child.sex, v.ageDays, v);
    v.biv = bivFlags(v.ix);
    if (v.biv.length) v.dq.push({ code: 'BIV', text: `Biologically implausible ${v.biv.map((k) => k.toUpperCase()).join(', ')} (WHO limits) — reading quarantined` });
    visits.push(v);
  }
  return visits;
}

function signalNear(signals, types, t, windowDays) {
  return signals.find((s) => types.includes(s.type) && s.t <= t && t - s.t <= windowDays * DAY);
}

/**
 * Evaluate a child's full history. Returns one result per visit plus the current state.
 * opts.feedR: reliability score of the AWC feed (alerts from unreliable feeds re-measure first).
 */
export function evaluate(child, events, signals, pack, opts = {}) {
  const A = pack.anthropometry, T = pack.trend, IV = pack.infantVelocity;
  const visits = buildVisits(child, events, pack);
  const results = [];
  let lowGainStreak = 0, watchStreak = 0;
  let pendingFall = null; // { refT, refWhz, refWaz, t }
  let lastValid = null, lastTier = 'GREEN', lastMam = null;
  let lastMonthly = null; // last valid visit that was not a within-window re-measure

  for (const v of visits) {
    const reasons = [];
    const add = (tier, code, rule, text, extra = {}) => reasons.push({ tier, code, rule, text, ...extra });
    const months = v.ageMonths;
    const muacValid = months >= A.muacMinAgeMonths && v.muacMm != null;
    const quarantined = v.biv.length > 0 && pack.reliability.quarantineBiv;
    let toPHC = months < 6;

    for (const d of v.dq) add('WATCH', 'DQ_' + d.code, 'Data quality', d.text);

    // --- RED-A: complicated SAM (acts even on a quarantined reading: danger signs are clinical) ---
    if (v.oedema) add('RED_A', 'OEDEMA', 'Table 2 RED-A', 'Bilateral pitting oedema');
    const dangerText = { VOMITING: 'vomits everything', LETHARGIC: 'unusually weak or sleepy', UNABLE_TO_FEED: 'too weak to feed', CONVULSIONS: 'convulsions' };
    for (const d of v.danger) add('RED_A', 'DANGER_' + d, 'Table 2 RED-A', `Danger sign: ${dangerText[d] || d}`);
    if (v.appetite === 'FAIL') add('RED_A', 'APPETITE_FAIL', 'CMAM 2023', 'Failed appetite test');

    if (!quarantined) {
      const { whz, waz } = v.ix;
      if (months < 6 && whz != null && whz < A.whzSam) add('RED_A', 'INFANT_WASTED', 'Table 2 RED-A', `Wasted infant under 6 months (WHZ ${whz})`);

      // --- RED-B: uncomplicated SAM (Rule 3) ---
      if (months >= 6 && v.appetite !== 'FAIL') {
        if (muacValid && v.muacMm < A.muacSamMm) add('RED_B', 'R3_MUAC_SAM', 'Rule 3', `MUAC ${v.muacMm} mm < ${A.muacSamMm} mm`);
        if (whz != null && whz < A.whzSam) add('RED_B', 'WHZ_SAM', 'Table 2 RED-B', `WHZ ${whz} < ${A.whzSam} SD`);
      }

      // --- MAM (Rule 1 for MUAC; WHZ -3 to -2), needs confirmation unless already in care ---
      const mamMuac = muacValid && v.muacMm >= A.muacSamMm && v.muacMm < A.muacMamMm;
      const mamWhz = whz != null && whz >= A.whzSam && whz < A.whzMam;
      if (mamMuac || mamWhz) {
        const what = [mamMuac && `MUAC ${v.muacMm} mm`, mamWhz && `WHZ ${whz}`].filter(Boolean).join(', ');
        const inCare = TIER_RANK[lastTier] <= TIER_RANK.AMBER;
        const confirmed = lastMam && v.t - lastMam.t <= 45 * DAY;
        if (inCare || confirmed) add('AMBER', 'MAM_CONFIRMED', mamMuac ? 'Rule 1' : 'Table 2 AMBER', `Confirmed MAM: ${what}`, { confirmedBy: lastMam ? lastMam.t : null });
        else add('WATCH', 'MAM_UNCONFIRMED', mamMuac ? 'Rule 1' : 'Table 2 WATCH', `MAM reading (${what}) — re-measure to confirm`, { remeasure: true });
        lastMam = { t: v.t };
      } else if (!quarantined) lastMam = null;

      // Reference = last valid visit at least 21 days earlier (monthly comparison, not a re-weigh).
      const ref = lastMonthly && v.t - lastMonthly.t >= 21 * DAY ? lastMonthly : null;
      const isRemeasure = pendingFall && v.t - pendingFall.t <= T.confirmWindowDays * DAY;

      // --- Rule 2 / WAZ line crossing (12 months and older) ---
      if (isRemeasure) {
        const stillDown = (whz != null && pendingFall.refWhz != null && whz <= pendingFall.refWhz - (T.whzDropSd - 0.1)) ||
          (waz != null && pendingFall.line != null && waz < pendingFall.line);
        if (stillDown) add('AMBER', 'R2_CONFIRMED', 'Rule 2', `Re-weigh confirms fall: WHZ ${pendingFall.refWhz} → ${whz}`, { confirmedBy: pendingFall.t });
        pendingFall = null;
      } else if (ref && months >= IV.maxAgeMonths) {
        const dWhz = whz != null && ref.ix.whz != null ? whz - ref.ix.whz : null;
        const crossed = T.wazLines.find((L) => ref.ix.waz != null && waz != null && ref.ix.waz >= L && waz < L);
        if ((dWhz != null && dWhz <= -T.whzDropSd) || crossed != null) {
          const txt = dWhz != null && dWhz <= -T.whzDropSd ? `WHZ fell ${round(-dWhz, 2)} SD in ${Math.round((v.t - ref.t) / DAY)} days (${ref.ix.whz} → ${whz})` : `Weight-for-age crossed the ${crossed} SD line (${ref.ix.waz} → ${waz})`;
          if (pendingFall && v.t - pendingFall.t <= 45 * DAY) {
            add('AMBER', 'R2_CONFIRMED', 'Rule 2', `${txt}; second consecutive fall`);
            pendingFall = null;
          } else {
            add('WATCH', 'R2_UNCONFIRMED', 'Rule 2', `${txt} — re-weigh to confirm`, { remeasure: true });
            pendingFall = { t: v.t, refWhz: ref.ix.whz, refWaz: ref.ix.waz, line: crossed ?? null };
          }
        } else if (pendingFall && v.t - pendingFall.t > T.confirmWindowDays * DAY) pendingFall = null;
      }

      // --- Infant velocity (under 12 months): two monthly gains in a row below WHO 15th centile ---
      if (ref && ref.ageMonths < IV.maxAgeMonths && v.weightKg != null && ref.weightKg != null) {
        const days = (v.t - ref.t) / DAY;
        if (days <= 45) {
          const mi = Math.min(11, Math.floor(ref.ageMonths));
          const gain = ((v.weightKg - ref.weightKg) * 1000) * (DAYS_PER_MONTH / days);
          const p15 = IV.p15g[child.sex === 'F' ? 'F' : 'M'][mi];
          if (gain < p15) {
            lowGainStreak++;
            const g = `${Math.round(gain)} g/month vs WHO 15th centile ${p15} g`;
            if (lowGainStreak >= IV.consecutiveLow) add('AMBER', 'INFANT_FALTERING', 'Table 2 AMBER', `Two monthly gains in a row below 15th centile (${g})`);
            else if (child.lbw && months < 6) add('AMBER', 'LBW_LOW_GAIN', 'Table 2 AMBER', `Low-birth-weight infant with low gain (${g})`);
            else add('WATCH', 'INFANT_LOW_GAIN', 'Table 2 WATCH', `Low gain: ${g}`);
          } else lowGainStreak = 0;
        }
      } else if (ref && ref.ageMonths >= IV.maxAgeMonths) lowGainStreak = 0;

      // --- Downward trend + consented health signal ---
      if (ref) {
        const dW = whz != null && ref.ix.whz != null ? whz - ref.ix.whz : 0;
        const dA = waz != null && ref.ix.waz != null ? waz - ref.ix.waz : 0;
        if (Math.min(dW, dA) <= -T.signalTrendDropSd) {
          const sig = signalNear(signals, ['VACCINE_OVERDUE', 'DIARRHOEA'], v.t, pack.signals.windowDays);
          if (sig) add('AMBER', 'TREND_PLUS_SIGNAL', 'Table 2 AMBER', `Downward trend (${round(Math.min(dW, dA), 2)} SD) with ${sig.type === 'DIARRHOEA' ? 'diarrhoea' : 'an overdue vaccine'} in 30 days`, { consentId: sig.consentId, signal: sig.type });
        }
      }
    }

    // --- choose tier ---
    let tier = 'GREEN';
    for (const r of reasons) if (TIER_RANK[r.tier] < TIER_RANK[tier]) tier = r.tier;
    // Quarantined readings never downgrade a child: keep the last tier and ask for a re-measure.
    if (quarantined && TIER_RANK[lastTier] < TIER_RANK[tier]) tier = lastTier;
    if (tier === 'WATCH') {
      watchStreak++;
      if (watchStreak >= T.watchRepeatsToAmber && !quarantined) {
        tier = 'AMBER';
        reasons.push({ tier: 'AMBER', code: 'WATCH_REPEAT', rule: 'Table 2 WATCH', text: `${watchStreak} WATCH results in a row` });
      }
    } else watchStreak = 0;

    let kind = 'NONE';
    if (tier !== 'GREEN') {
      // Episode logic: re-entering AMBER within 60 days of a previous AMBER+ result is the same
      // episode (monthly follow-up), not a new home-visit task — keeps the visit cap honest.
      const recent = results.some((r) => TIER_RANK[r.tier] <= TIER_RANK[tier] && v.t - r.t <= (pack.trend.episodeDays ?? 60) * DAY);
      if (TIER_RANK[tier] < TIER_RANK[lastTier]) kind = recent && tier === 'AMBER' ? 'RECURRENT' : lastTier === 'GREEN' ? 'NEW' : 'WORSENING';
      else if (tier === lastTier) kind = 'STABLE';
      else kind = 'IMPROVING';
    } else if (lastTier !== 'GREEN') kind = 'RESOLVED';

    const lowR = opts.feedR != null && opts.feedR < pack.reliability.cutoff;
    const res = {
      t: v.t, receivedAt: v.receivedAt, visit: v, tier, kind,
      reasons: reasons.filter((r) => r.tier === tier || r.code.startsWith('DQ_')).concat(reasons.filter((r) => r.tier !== tier && !r.code.startsWith('DQ_'))),
      remeasure: reasons.some((r) => r.remeasure) || quarantined || v.dq.length > 0 || (lowR && (tier === 'AMBER' || tier === 'WATCH')),
      remeasureFirst: lowR && (tier === 'AMBER' || tier === 'WATCH'),
      toPHC,
      quarantined,
      packVersion: pack.version,
    };
    results.push(res);
    if (!quarantined) {
      lastValid = v;
      const isWithinWindowRemeasure = lastMonthly && v.t - lastMonthly.t < 21 * DAY;
      if (!isWithinWindowRemeasure) lastMonthly = v;
    }
    lastTier = tier;
  }
  return { visits, results, current: results[results.length - 1] || null, lastValid };
}

/** What the Tracker does today: a list built from one reading. */
export function trackerSingleReading(child, v, pack) {
  const A = pack.anthropometry;
  const muacOk = v.ageMonths >= 6 && v.muacMm != null;
  if (v.oedema || (muacOk && v.muacMm < A.muacSamMm) || (v.ix.whz != null && v.ix.whz < A.whzSam)) return 'SAM';
  if ((muacOk && v.muacMm < A.muacMamMm) || (v.ix.whz != null && v.ix.whz < A.whzMam)) return 'MAM';
  return null;
}
