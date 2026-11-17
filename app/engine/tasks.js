// Layer 3/4: tasks, asynchronous joint-visit closure (audit item 2), workload cap,
// and the event-time escalation clock (audit item 1).
import { DAY, HOUR } from './util.js';
import { TIER_RANK } from './rulepack.js';

const span = (w) => (w.hours ? w.hours * HOUR : 0) + (w.days ? w.days * DAY : 0);

/** Which roles must confirm before a task can close. */
export function requiredRoles(tier, ageMonths) {
  if (tier === 'RED_A') return ['AWW|ASHA'];     // referral done by either; supervisor auto-informed
  if (tier === 'RED_B') return ['AWW', 'ASHA'];   // AWW runs appetite test + CMAM; ASHA follows up
  if (tier === 'AMBER') return ['AWW', 'ASHA'];   // joint OR sequential visit within the window
  return ['AWW'];                                 // WATCH: re-measure + counselling at the AWC
}

export function primaryDeadline(tier, pack) {
  const T = pack.tiers;
  if (tier === 'RED_A') return T.RED_A.deadlineHours * HOUR;
  if (tier === 'RED_B') return T.RED_B.appetiteTestHours * HOUR;
  if (tier === 'AMBER') return pack.jointVisit.windowDays * DAY;
  return T.WATCH.deadlineDays * DAY;
}

let seq = 0;
export function makeTask({ child, result, pack, ingestedAt, id }) {
  const t0 = result.t; // EVENT TIME — the clock starts when the child was measured
  return {
    id: id || `T-${(++seq).toString(36).toUpperCase().padStart(5, '0')}`,
    childId: child.id, awcId: child.awcId,
    tier: result.tier, kind: result.kind,
    reasons: result.reasons.filter((r) => r.tier === result.tier).map((r) => r.text),
    packVersion: result.packVersion,
    measuredAt: t0,
    ingestedAt: ingestedAt ?? result.receivedAt ?? t0,
    dueAt: t0 + primaryDeadline(result.tier, pack),
    screeningDueAt: result.tier === 'RED_B' ? t0 + pack.tiers.RED_B.screeningDays * DAY : null,
    required: requiredRoles(result.tier, result.visit.ageMonths),
    closures: [],
    milestones: [],
    state: 'OPEN',
    ageMonths: result.visit.ageMonths,
    remeasureFirst: !!result.remeasureFirst,
    toPHC: result.toPHC,
  };
}

/** Record a closure from either worker. ASHA uses DTMF keys 1-4 on any phone. */
export function addClosure(task, { by, t, outcome, channel, dtmf }, pack) {
  if (dtmf != null) outcome = pack.jointVisit.dtmf[dtmf];
  task.closures.push({ by, t, outcome, channel: channel || (by === 'ASHA' ? 'IVR' : 'APP'), dtmf: dtmf ?? null });
  return task;
}
export function addMilestone(task, m) { task.milestones.push(m); return task; }

/**
 * Pure status function: the closure state machine.
 *   OPEN → PARTIAL (one role confirmed) → CLOSED (all roles confirmed, any order, within window)
 *   REFUSED / MIGRATED outcomes close the visit but open follow-on work.
 *   Conflicting outcomes (e.g., VISITED vs MIGRATED) → CONFLICT for supervisor review.
 */
export function closureState(task) {
  const roleOk = (role) => {
    const roles = role.split('|');
    return task.closures.find((c) => roles.includes(c.by));
  };
  const got = task.required.map((r) => ({ role: r, closure: roleOk(r) || null }));
  const outcomes = new Set(task.closures.map((c) => c.outcome));
  if (outcomes.has('MIGRATED') && (outcomes.has('VISITED') || outcomes.has('REFERRED'))) return { state: 'CONFLICT', got };
  if (outcomes.has('MIGRATED')) return { state: 'MIGRATED', got, closedAt: task.closures.find((c) => c.outcome === 'MIGRATED').t };
  if (outcomes.has('REFUSED')) return { state: 'REFUSED', got, closedAt: task.closures.find((c) => c.outcome === 'REFUSED').t };
  const done = got.filter((g) => g.closure);
  // RED-B (CMAM 2023): visits are not enough — the appetite test and the MO screening must be on record.
  const needMs = task.tier === 'RED_B' ? ['APPETITE_TEST', 'MO_SCREEN'] : [];
  const ms = needMs.map((k) => task.milestones.find((m) => m.kind === k) || null);
  const missing = needMs.filter((_, i) => !ms[i]);
  if (done.length === got.length && !missing.length) return { state: 'CLOSED', got, missing, closedAt: Math.max(...done.map((g) => g.closure.t), ...ms.map((m) => m.t)) };
  if (done.length || ms.some(Boolean)) return { state: 'PARTIAL', got, missing };
  return { state: 'OPEN', got, missing };
}

/**
 * Escalation on the event-time clock. Each level acts when the one below misses its deadline.
 * A task ingested after a threshold already passed escalates immediately and is marked lateArrival.
 */
export function escalation(task, now, pack) {
  const cs = closureState(task);
  const end = ['CLOSED', 'REFUSED', 'MIGRATED'].includes(cs.state) ? cs.closedAt : now;
  const elapsed = end - task.measuredAt;
  let level = 0;
  const steps = [];
  // Queued (over-cap) AMBER cases wait on the monthly AWC list: their ladder starts at day N, not day 7.
  const shift = task.queued ? Math.max(0, pack.workload.queuedEscalateDay - pack.jointVisit.windowDays) * DAY : 0;
  for (const L of pack.escalation) {
    if (!L.when) continue;
    const w = L.when[task.tier];
    if (!w) continue;
    const at = task.measuredAt + span(w) + shift;
    const hit = elapsed >= span(w) + shift;
    steps.push({ level: L.level, role: L.role, label: L.label, at, hit, late: hit && task.ingestedAt > at });
    if (hit) level = L.level;
  }
  const lateArrival = steps.some((s) => s.late);
  const open = !['CLOSED', 'REFUSED', 'MIGRATED'].includes(cs.state);
  const next = steps.find((s) => !s.hit);
  return {
    ...cs, level, steps, lateArrival, open,
    breached: open ? now > task.dueAt : (cs.closedAt > task.dueAt),
    msToDue: task.dueAt - now,
    nextEscalationAt: open && next ? next.at : null,
    ingestLagMs: task.ingestedAt - task.measuredAt,
  };
}

/**
 * Workload cap (Table 2 footnote): at most N new AMBER visits per AWC per month.
 * Excess cases are ranked by tier, then youngest, then days since last measurement,
 * and wait on the monthly AWC list; they escalate at day `queuedEscalateDay`.
 */
export function allocate(tasks, childrenById, pack, monthOf) {
  const cap = pack.workload.newAmberCapPerAwcPerMonth;
  const groups = new Map();
  for (const t of tasks) {
    if (t.tier !== 'AMBER' || !(t.kind === 'NEW' || t.kind === 'WORSENING')) continue;
    const k = t.awcId + '|' + monthOf(t.measuredAt);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  for (const [, g] of groups) {
    g.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.ageMonths - b.ageMonths || a.measuredAt - b.measuredAt);
    g.forEach((t, i) => {
      if (i >= cap) {
        t.queued = true;
        t.queueRank = i - cap + 1;
        t.dueAt = t.measuredAt + pack.workload.queuedEscalateDay * DAY;
        t.required = ['AWW'];
      }
    });
  }
  return tasks;
}
