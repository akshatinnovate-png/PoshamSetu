// ABDM health-information exchange, in the gateway's v0.5 message shapes, with real cryptography.
//   HIU = PoshanSetu (MoWCD)   CM = ABDM consent manager   HIP = U-WIN / RCH (MoHFW)   PHR = guardian's app
// Flow: consent-requests/init → on-init → (guardian approves) → consents/hiu/notify → consents/fetch →
//       health-information/cm/request (X25519 public key + nonce) → HIP pushes an AES-GCM encrypted FHIR
//       bundle to dataPushUrl → HIU decrypts, extracts ONLY the consented minimal flags → health-information/notify.
// Simulated network, real payload shapes and real crypto (X25519 ECDH + HKDF-SHA256 + AES-256-GCM, as in ABDM's
// Fidelius scheme, where the salt is the XOR of the two parties' nonces).
import { sha256, b64url, fromB64url } from './util.js';

const subtle = globalThis.crypto.subtle;
const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const uuid = () => { const b = rand(16); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80; const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
const iso = (t) => new Date(t).toISOString();
const te = new TextEncoder(), td = new TextDecoder();

async function keyPair() {
  const kp = await subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const raw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  return { kp, pub: b64url(raw) };
}
async function sessionKey(myPriv, theirPubB64, myNonce, theirNonce) {
  const pub = await subtle.importKey('raw', fromB64url(theirPubB64), { name: 'X25519' }, false, []);
  const shared = await subtle.deriveBits({ name: 'X25519', public: pub }, myPriv, 256);
  const salt = myNonce.map((b, i) => b ^ theirNonce[i]);
  const ikm = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('ABDM-HIE') }, ikm, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * Run the whole exchange for one child. `approve` decides the guardian's answer (true/false).
 * Returns the message log (each with from, to, api, payload) and the flags the HIU extracted.
 */
export async function runHieFlow({ child, fhirBundle, now, approve = true, purpose = 'CAREMGT', hiTypes = ['ImmunizationRecord', 'WellnessRecord'], allowedFlags }) {
  const log = [];
  const send = (from, to, api, payload, note) => { log.push({ seq: log.length + 1, from, to, api, payload, note, at: iso(now + log.length * 1000) }); return payload; };
  const abha = child.abhaAddress || `${child.pseudoId.toLowerCase()}@sbx`;
  const from = iso(now - 365 * 86400000), to = iso(now);

  // 1. consent request
  const req = send('HIU', 'CM', 'POST /v0.5/consent-requests/init', {
    requestId: uuid(), timestamp: iso(now),
    consent: {
      purpose: { text: 'Care management — early warning of child undernutrition', code: purpose, refUri: 'http://terminology.hl7.org/ValueSet/v3-PurposeOfUse' },
      patient: { id: abha },
      hiu: { id: 'POSHANSETU-HIU-JH' },
      requester: { name: 'PoshanSetu (MoWCD) — Paschimi Singhbhum', identifier: { type: 'REGNO', value: 'MOWCD-PS-0001', system: 'https://www.mciindia.org' } },
      hiTypes,
      permission: { accessMode: 'VIEW', dateRange: { from, to }, dataEraseAt: iso(now + 180 * 86400000), frequency: { unit: 'HOUR', value: 1, repeats: 0 } },
    },
  }, 'Asks only for the minimal-flag purpose, one year back, erase after 180 days.');
  const consentRequestId = uuid();
  send('CM', 'HIU', 'POST /v0.5/consent-requests/on-init', { requestId: uuid(), timestamp: iso(now), consentRequest: { id: consentRequestId }, resp: { requestId: req.requestId } });
  send('CM', 'PHR', 'notification (PHR app / SMS)', { consentRequestId, requester: req.consent.requester.name, purpose: req.consent.purpose.text, hiTypes, dateRange: req.consent.permission.dateRange }, 'Guardian sees who is asking, why, for what, and for how long.');

  if (!approve) {
    send('PHR', 'CM', 'consent decision', { consentRequestId, status: 'DENIED' });
    send('CM', 'HIU', 'POST /v0.5/consents/hiu/notify', { requestId: uuid(), timestamp: iso(now), notification: { consentRequestId, status: 'DENIED', consentArtefacts: [] } }, 'No artefact — no data moves. Rules run on Tracker data only.');
    return { log, status: 'DENIED', flags: [] };
  }
  send('PHR', 'CM', 'consent decision', { consentRequestId, status: 'GRANTED' });
  const consentId = uuid();
  send('CM', 'HIU', 'POST /v0.5/consents/hiu/notify', { requestId: uuid(), timestamp: iso(now), notification: { consentRequestId, status: 'GRANTED', consentArtefacts: [{ id: consentId }] } });
  send('CM', 'HIP', 'POST /v0.5/consents/hip/notify', { requestId: uuid(), timestamp: iso(now), notification: { status: 'GRANTED', consentId, consentDetail: { consentId, patient: { id: abha }, hip: { id: 'UWIN-JH' }, hiTypes, permission: req.consent.permission } } });
  send('HIU', 'CM', 'POST /v0.5/consents/fetch', { requestId: uuid(), timestamp: iso(now), consentId });
  send('CM', 'HIU', 'POST /v0.5/consents/on-fetch', { requestId: uuid(), timestamp: iso(now), consent: { status: 'GRANTED', consentDetail: { consentId, createdAt: iso(now), purpose: req.consent.purpose, patient: { id: abha }, hip: { id: 'UWIN-JH' }, hiu: req.consent.hiu, hiTypes, permission: req.consent.permission }, signature: sha256(consentId + abha).slice(0, 64) } }, 'Signed artefact — the HIU keeps it as proof of lawful basis.');

  // 2. health-information request with HIU key material
  const hiu = await keyPair();
  const hiuNonce = rand(32);
  const transactionId = uuid();
  send('HIU', 'CM', 'POST /v0.5/health-information/cm/request', {
    requestId: uuid(), timestamp: iso(now),
    hiRequest: { consent: { id: consentId }, dateRange: { from, to }, dataPushUrl: 'https://poshansetu.example/v0.5/health-information/transfer',
      keyMaterial: { cryptoAlg: 'ECDH', curve: 'Curve25519', dhPublicKey: { expiry: iso(now + 3600000), parameters: 'Curve25519/32byte random key', keyValue: hiu.pub }, nonce: b64url(hiuNonce) } },
  });
  send('CM', 'HIU', 'POST /v0.5/health-information/cm/on-request', { requestId: uuid(), timestamp: iso(now), hiRequest: { transactionId, sessionStatus: 'REQUESTED' } });
  send('CM', 'HIP', 'POST /v0.5/health-information/hip/request', { requestId: uuid(), timestamp: iso(now), transactionId, hiRequest: { consent: { id: consentId }, dateRange: { from, to }, dataPushUrl: 'https://poshansetu.example/v0.5/health-information/transfer', keyMaterial: { cryptoAlg: 'ECDH', curve: 'Curve25519', dhPublicKey: { keyValue: hiu.pub }, nonce: b64url(hiuNonce) } } });

  // 3. HIP encrypts the FHIR bundle for the HIU and pushes it
  const hip = await keyPair();
  const hipNonce = rand(32);
  const hipKey = await sessionKey(hip.kp.privateKey, hiu.pub, hipNonce, hiuNonce);
  const iv = rand(12);
  const plain = te.encode(JSON.stringify(fhirBundle));
  const cipher = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, hipKey, plain));
  const content = b64url(iv) + '.' + b64url(cipher);
  const push = send('HIP', 'HIU', 'POST /v0.5/health-information/transfer (dataPushUrl)', {
    pageNumber: 1, pageCount: 1, transactionId,
    entries: [{ content, media: 'application/fhir+json', checksum: sha256(plain), careContextReference: `uwin-${child.pseudoId}` }],
    keyMaterial: { cryptoAlg: 'ECDH', curve: 'Curve25519', dhPublicKey: { expiry: iso(now + 3600000), parameters: 'Curve25519/32byte random key', keyValue: hip.pub }, nonce: b64url(hipNonce) },
  }, `${cipher.length} bytes of ciphertext — the CM never sees the records.`);

  // 4. HIU decrypts, verifies the checksum, and keeps only the consented minimal flags
  const hiuKey = await sessionKey(hiu.kp.privateKey, push.keyMaterial.dhPublicKey.keyValue, hiuNonce, fromB64url(push.keyMaterial.nonce));
  const [ivB, ctB] = push.entries[0].content.split('.');
  const decrypted = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(ivB) }, hiuKey, fromB64url(ctB)));
  const checksumOk = sha256(decrypted) === push.entries[0].checksum;
  const bundle = JSON.parse(td.decode(decrypted));
  const flags = extractFlags(bundle, allowedFlags);
  send('HIU', 'CM', 'POST /v0.5/health-information/notify', { requestId: uuid(), timestamp: iso(now), notification: { consentId, transactionId, doneAt: iso(now), notifier: { type: 'HIU', id: 'POSHANSETU-HIU-JH' }, statusNotification: { sessionStatus: 'TRANSFERRED', hipId: 'UWIN-JH', statusResponses: [{ careContextReference: `uwin-${child.pseudoId}`, hiStatus: checksumOk ? 'OK' : 'ERRORED', description: `${flags.length} minimal flag(s) retained; full record discarded` }] } } },
  'Minimisation: the decrypted bundle is reduced to flags and the bundle itself is discarded.');
  return { log, status: 'TRANSFERRED', checksumOk, flags, resourceCount: bundle.entry?.length || 0 };
}

/** Reduce a FHIR bundle to PoshanSetu's minimal flags (NDGFP data dictionary). */
export function extractFlags(bundle, allowed = ['VACCINE_OVERDUE', 'DIARRHOEA', 'LBW', 'HIGH_RISK_PREGNANCY']) {
  const out = [];
  for (const { resource: r } of bundle.entry || []) {
    if (r.resourceType === 'ImmunizationRecommendation') for (const rec of r.recommendation || []) if (rec.forecastStatus?.coding?.[0]?.code === 'overdue') out.push({ type: 'VACCINE_OVERDUE', antigen: rec.vaccineCode?.[0]?.text, t: Date.parse(rec.dateCriterion?.[0]?.value || r.date) });
    if (r.resourceType === 'Condition' && r.code?.coding?.some((c) => c.code === '62315008')) out.push({ type: 'DIARRHOEA', t: Date.parse(r.onsetDateTime) });
    if (r.resourceType === 'Observation' && r.code?.coding?.some((c) => c.code === '8339-4') && r.valueQuantity?.value < 2500) out.push({ type: 'LBW', t: Date.parse(r.effectiveDateTime) });
  }
  return out.filter((f) => allowed.includes(f.type));
}

/** What U-WIN / RCH would hold for this child (synthetic), as a FHIR R4 bundle. */
export function hipBundle(child, vaccines, signalsRaw) {
  const pid = child.pseudoId;
  const entry = [{ resource: { resourceType: 'Patient', id: pid, gender: child.sex === 'F' ? 'female' : 'male', birthDate: new Date(child.dob).toISOString().slice(0, 10) } }];
  for (const v of vaccines.filter((x) => x.given)) entry.push({ resource: { resourceType: 'Immunization', id: `imm-${v.antigen}`, status: 'completed', vaccineCode: { text: v.antigen }, patient: { reference: `Patient/${pid}` }, occurrenceDateTime: new Date(v.given).toISOString() } });
  const overdue = vaccines.filter((v) => !v.given || v.given - v.due > 28 * 86400000);
  if (overdue.length) entry.push({ resource: { resourceType: 'ImmunizationRecommendation', id: 'rec', patient: { reference: `Patient/${pid}` }, date: new Date().toISOString(), recommendation: overdue.map((v) => ({ vaccineCode: [{ text: v.antigen }], forecastStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/immunization-recommendation-status', code: 'overdue' }] }, dateCriterion: [{ code: { text: 'due' }, value: new Date(v.due + 28 * 86400000).toISOString() }] })) } });
  for (const s of signalsRaw.filter((x) => x.type === 'DIARRHOEA')) entry.push({ resource: { resourceType: 'Condition', id: `dia-${s.t}`, code: { coding: [{ system: 'http://snomed.info/sct', code: '62315008', display: 'Diarrhea' }] }, subject: { reference: `Patient/${pid}` }, onsetDateTime: new Date(s.t).toISOString() } });
  entry.push({ resource: { resourceType: 'Observation', id: 'bw', status: 'final', code: { coding: [{ system: 'http://loinc.org', code: '8339-4', display: 'Birth weight' }] }, subject: { reference: `Patient/${pid}` }, effectiveDateTime: new Date(child.dob).toISOString(), valueQuantity: { value: child.lbw ? 2300 : 2900, unit: 'g' } } });
  // Records PoshanSetu must NOT keep (they ride along in the HIP bundle and are discarded):
  entry.push({ resource: { resourceType: 'Condition', id: 'other', code: { text: 'Other clinical history (not requested)' }, subject: { reference: `Patient/${pid}` } } });
  return { resourceType: 'Bundle', type: 'collection', entry };
}
