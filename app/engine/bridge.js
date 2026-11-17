// Real-time data bridge (audit item 1).
//
// Round 1 read weekly/monthly dashboard exports, which cannot drive a 24-hour RED-A clock.
// Round 2 ingests measurement EVENTS through three adapters, keeps an append-only,
// idempotent event store, runs the deadline clock on measurement time, and treats a
// late-arriving event as a pipeline breach (escalates on arrival) — never the worker's fault.
import { HOUR, DAY, quantile, median, sha256, canonical } from './util.js';

export const ADAPTERS = {
  API_SETU: {
    id: 'API_SETU', name: 'Poshan Tracker Open API via API Setu',
    detail: 'Event webhook (pull every 15 min as fallback) from the Tracker server once the AWW app syncs. OAuth2 client credentials, MoWCD-approved scopes: read-only growth events.',
    // lag = device offline time (lognormal) + API polling/webhook delay
    offlineMedianH: 1.2, offlineSigma: 1.1, apiDelayMin: [1, 15], availability: 0.985,
    color: '#ff4fa3',
  },
  SMS_FLASH: {
    id: 'SMS_FLASH', name: 'RED flash over SMS / USSD',
    detail: 'For danger signs and MUAC < 115 the AWW app (or a feature phone) sends a 1-line structured SMS that works on 2G without data, e.g. "PS RA 4821 OED". Carries no name — only beneficiary ref + code.',
    offlineMedianH: 0.05, offlineSigma: 0.9, apiDelayMin: [0, 2], availability: 0.995,
    color: '#1f1b1d',
  },
  STATE_DELTA: {
    id: 'STATE_DELTA', name: 'State ICDS mirror — nightly delta (fallback)',
    detail: 'If no Tracker API is available in time: a State data-sharing MoU gives a nightly delta at 02:00 IST of events synced that day.',
    offlineMedianH: 1.2, offlineSigma: 1.1, batchHourIST: 2, processingH: 1, availability: 0.99,
    color: '#3f7fe0',
  },
  BATCH_EXPORT: {
    id: 'BATCH_EXPORT', name: 'State dashboard export (Round 1 design)',
    detail: 'Weekly CSV export from the ICDS dashboard. Kept only as a reconciliation feed — it can never start or stop a clock.',
    batchDays: 7, processingH: 20, availability: 1,
    color: '#9c8f94',
  },
};

export function sampleLagMs(adapterId, rnd) {
  const a = ADAPTERS[adapterId];
  if (adapterId === 'BATCH_EXPORT') return rnd() * a.batchDays * DAY + a.processingH * HOUR;
  if (adapterId === 'STATE_DELTA') {
    // synced at t + offline; then waits for the next 02:00 IST cut. Uses a uniform time-of-day for the sync.
    const off = Math.exp(Math.log(a.offlineMedianH) + a.offlineSigma * rnd.normal()) * HOUR;
    const syncHour = (10 + rnd() * 6 + off / HOUR) % 24; // growth sessions run ~10:00-16:00 IST
    const wait = ((a.batchHourIST - syncHour + 24) % 24) * HOUR;
    return off + wait + a.processingH * HOUR + (rnd() > a.availability ? DAY : 0);
  }
  const off = Math.exp(Math.log(a.offlineMedianH) + a.offlineSigma * rnd.normal()) * HOUR;
  const api = (a.apiDelayMin[0] + rnd() * (a.apiDelayMin[1] - a.apiDelayMin[0])) * 60000;
  const outage = rnd() > a.availability ? (1 + rnd() * 5) * HOUR : 0;
  return off + api + outage;
}

/** Which adapter carries an event: RED signs go over SMS flash as well as the API. */
export function routeFor(event, mode) {
  if (mode === 'ROUND1') return ['BATCH_EXPORT'];
  if (mode === 'FALLBACK') return ['STATE_DELTA'].concat(event.oedema || (event.danger && event.danger.length) || (event.muacMm != null && event.muacMm < 115) || event.appetite === 'FAIL' ? ['SMS_FLASH'] : []);
  const red = event.oedema || (event.danger && event.danger.length) || (event.muacMm != null && event.muacMm < 115) || event.appetite === 'FAIL';
  return red ? ['SMS_FLASH', 'API_SETU'] : ['API_SETU'];
}

export function lagStats(lagsMs) {
  return {
    n: lagsMs.length,
    p50: median(lagsMs), p90: quantile(lagsMs, 0.9), p95: quantile(lagsMs, 0.95), max: lagsMs.length ? Math.max(...lagsMs) : null,
  };
}

/** Clock-safety: an adapter may drive a tier's clock only if p95 lag <= share x deadline. */
export function clockSafety(stats, pack) {
  const share = pack.bridge.maxLagShareOfDeadline;
  const deadlines = {
    RED_A: pack.tiers.RED_A.deadlineHours * HOUR,
    RED_B: pack.tiers.RED_B.appetiteTestHours * HOUR,
    AMBER: pack.jointVisit.windowDays * DAY,
    WATCH: pack.tiers.WATCH.deadlineDays * DAY,
  };
  const out = {};
  for (const [tier, d] of Object.entries(deadlines)) out[tier] = { budgetMs: d * share, safe: stats.p95 != null && stats.p95 <= d * share };
  return out;
}

/** Append-only, idempotent event store with per-AWC watermarks. */
export class EventStore {
  constructor() { this.events = []; this.keys = new Set(); this.dupes = 0; this.watermark = new Map(); this.late = []; }
  static key(e) { return sha256(canonical({ c: e.childId, t: e.t, w: e.weightKg, h: e.heightCm, m: e.muacMm, o: !!e.oedema })).slice(0, 20); }
  append(e, receivedAt, adapter) {
    const k = EventStore.key(e);
    if (this.keys.has(k)) { this.dupes++; return { accepted: false, duplicate: true, key: k }; }
    this.keys.add(k);
    const rec = { ...e, key: k, receivedAt, adapter, lagMs: receivedAt - e.t };
    this.events.push(rec);
    const wm = this.watermark.get(e.awcId) || 0;
    if (e.t > wm) this.watermark.set(e.awcId, e.t);
    else if (wm - e.t > DAY) this.late.push(rec); // out-of-order arrival
    return { accepted: true, key: k, record: rec };
  }
}

/**
 * Replay a set of measurement events through the bridge in a given mode.
 * Returns per-adapter lag statistics and, per event, the earliest arrival.
 */
export function replay(events, mode, rnd) {
  const store = new EventStore();
  const perAdapter = {};
  const arrivals = [];
  for (const e of events) {
    const routes = routeFor(e, mode);
    let first = Infinity, firstAdapter = null;
    for (const r of routes) {
      const lag = sampleLagMs(r, rnd);
      (perAdapter[r] ||= []).push(lag);
      const at = e.t + lag;
      store.append(e, at, r); // second copy of a RED flash is de-duplicated
      if (at < first) { first = at; firstAdapter = r; }
    }
    arrivals.push({ id: e.id, t: e.t, receivedAt: first, adapter: firstAdapter, lagMs: first - e.t });
  }
  const stats = Object.fromEntries(Object.entries(perAdapter).map(([k, v]) => [k, lagStats(v)]));
  return { stats, arrivals, dupes: store.dupes, store };
}
