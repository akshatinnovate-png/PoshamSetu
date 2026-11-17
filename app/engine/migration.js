// Migration module (audit item 3): signed transfer tokens that verify OFFLINE, an IVR-readable
// short code, and an Aadhaar-eKYC biometric fallback when paper and phone are both gone.
import { signBytes, verifyBytes } from './signing.js';
import { canonical, b64url, fromB64url, sha256, sha256Bytes, crockford, checkChar, DAY } from './util.js';

const te = new TextEncoder(), td = new TextDecoder();
const yyyymmdd = (t) => Number(new Date(t).toISOString().slice(0, 10).replace(/-/g, ''));

/** Compact payload: growth history as [ageDays, weight dag, height mm, muac mm]. */
export function tokenPayload(child, visits, triage, { now, validityDays, destination, ration }) {
  const hist = visits.filter((v) => !v.biv.length).slice(-8).map((v) => [Math.round(v.ageDays), Math.round((v.weightKg || 0) * 100), Math.round((v.heightCm || 0) * 10), v.muacMm ?? 0]);
  return {
    v: 1,
    c: child.pseudoId,           // pseudonymous beneficiary reference — no name, no Aadhaar
    s: child.sex,
    b: yyyymmdd(child.dob),
    h: child.awcCode,            // home AWC code (for return + reactivation)
    d: destination || null,      // announced destination cluster, if known
    t: triage?.tier || 'GREEN',
    r: ration || 'THR-6-36',     // ration entitlement code
    g: hist,
    i: Math.floor(now / 1000),
    e: Math.floor((now + validityDays * DAY) / 1000),
    n: b64url(sha256Bytes(child.id + ':' + now)).slice(0, 8),
  };
}

export async function issueToken(payload) {
  const bytes = te.encode(canonical(payload));
  const sig = await signBytes('PoshanSetu-TokenIssuer', bytes);
  const qr = 'PS1:' + b64url(bytes) + '.' + b64url(sig);
  const short = shortCode(qr);
  return { payload, qr, short, bytes: qr.length };
}

export function shortCode(qr) {
  const body = crockford(sha256Bytes(qr), 9);
  const c = body + checkChar(body);
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}
export function validShortCode(code) {
  const c = code.replace(/[^0-9A-Z]/gi, '').toUpperCase();
  return c.length === 10 && checkChar(c.slice(0, 9)) === c[9];
}

/** Verify a scanned token with no network: signature, expiry, structure. */
export async function verifyToken(qr, now) {
  try {
    if (!qr.startsWith('PS1:')) return { ok: false, why: 'Not a PoshanSetu token' };
    const [p, s] = qr.slice(4).split('.');
    const bytes = fromB64url(p);
    const sigOk = await verifyBytes('PoshanSetu-TokenIssuer', bytes, fromB64url(s));
    const payload = JSON.parse(td.decode(bytes));
    if (!sigOk) return { ok: false, why: 'Signature does not match — token altered', payload };
    if (payload.e * 1000 < now) return { ok: false, why: 'Token expired — re-issue from registry', payload, expired: true };
    return { ok: true, payload, offline: true };
  } catch (e) {
    return { ok: false, why: 'Unreadable token' };
  }
}

/**
 * Registry lookups used when the paper token is lost.
 * Aadhaar numbers are never stored: only a salted hash of the UIDAI-issued UID token
 * (per Aadhaar Data Vault guidance) maps the mother to her children's tokens.
 */
export class MigrationRegistry {
  constructor(salt = 'ps-demo-salt') { this.salt = salt; this.byShort = new Map(); this.byUid = new Map(); this.log = []; }
  uidKey(uidToken) { return sha256(this.salt + ':' + uidToken).slice(0, 32); }
  register(token, motherUidToken) {
    this.byShort.set(token.short.replace(/-/g, ''), token);
    if (motherUidToken) {
      const k = this.uidKey(motherUidToken);
      if (!this.byUid.has(k)) this.byUid.set(k, []);
      this.byUid.get(k).push(token);
    }
  }
  lookupShort(code, by) {
    const t = validShortCode(code) ? this.byShort.get(code.replace(/[^0-9A-Z]/gi, '').toUpperCase()) : null;
    this.log.push({ kind: 'SHORT_CODE', by, ok: !!t, at: Date.now() });
    return t || null;
  }
  /** Simulated Aadhaar eKYC: the AUA device returns a UID token after biometric match. */
  lookupBiometric(ekyc, by) {
    if (!ekyc.match) { this.log.push({ kind: 'BIOMETRIC', by, ok: false, at: Date.now() }); return { ok: false, why: ekyc.why || 'No biometric match' }; }
    const list = this.byUid.get(this.uidKey(ekyc.uidToken)) || [];
    this.log.push({ kind: 'BIOMETRIC', by, ok: list.length > 0, modality: ekyc.modality, at: Date.now() });
    return { ok: list.length > 0, tokens: list };
  }
}

/** Fallback ladder shown to the destination AWW. */
export function recoveryPlan({ hasPaper, phoneAlive, network, awcDeviceOnline, fingerprintsWorn }) {
  const steps = [];
  steps.push({ id: 'QR', label: 'Scan paper / MCP-card QR', works: hasPaper, offline: true, note: 'Signature checks offline on the AWW app — no network needed.' });
  steps.push({ id: 'OTP', label: 'OTP to guardian phone', works: phoneAlive && network, offline: false, note: 'Needs a live SIM and signal at the kiln.' });
  steps.push({ id: 'IVR', label: 'Short code by voice call (any phone, incl. kiln munshi)', works: network, offline: false, note: '10-character code read aloud; check character catches mis-hearing.' });
  steps.push({ id: 'BIO_FP', label: 'Mother\'s fingerprint — Aadhaar eKYC on AWW tablet', works: awcDeviceOnline && !fingerprintsWorn, offline: false, note: 'Uses the destination AWC device\'s connection, not the family\'s.' });
  steps.push({ id: 'BIO_FACE', label: 'Aadhaar Face RD / iris (worn fingerprints from kiln work)', works: awcDeviceOnline, offline: false, note: 'Brick-moulding often wears ridges; face auth avoids false rejects.' });
  steps.push({ id: 'REENROL', label: 'Fresh enrolment + supervisor merge on return', works: true, offline: true, note: 'Last resort; home AWC merges the curve when the family returns.' });
  const first = steps.find((s) => s.works);
  return { steps, resolvedBy: first?.id };
}

/** Lost-to-follow-up: no measurement for `ltfuDays`. */
export function ltfu(lastMeasuredAt, now, pack) { return now - lastMeasuredAt >= pack.migration.ltfuDays * DAY; }

/** k-anonymous route counts for destination CDPOs (counts below k are suppressed). */
export function routeAggregates(migrations, k) {
  const m = new Map();
  for (const x of migrations) {
    const key = x.fromBlock + '→' + x.destination;
    m.set(key, (m.get(key) || 0) + 1);
  }
  return [...m.entries()].map(([key, n]) => {
    const [from, to] = key.split('→');
    return { from, to, n, shown: n >= k ? String(n) : `<${k}`, suppressed: n < k };
  }).sort((a, b) => b.n - a.n);
}
