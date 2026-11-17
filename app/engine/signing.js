// Ed25519 signatures over canonical JSON (WebCrypto — works in Node 20+, Chromium, Electron).
import { DEMO_KEYS } from './demo-keys.js';
import { canonical, b64url, fromB64url, sha256 } from './util.js';

const subtle = globalThis.crypto.subtle;
const cache = new Map();

async function key(signer, usage) {
  const id = signer + ':' + usage;
  if (cache.has(id)) return cache.get(id);
  const k = DEMO_KEYS[signer];
  if (!k) throw new Error('unknown signer ' + signer);
  const jwk = { kty: 'OKP', crv: 'Ed25519', x: k.x, ...(usage === 'sign' ? { d: k.d } : {}) };
  const p = subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, [usage]);
  cache.set(id, p);
  return p;
}

const te = new TextEncoder();

export async function signBytes(signer, bytes) {
  const sig = await subtle.sign({ name: 'Ed25519' }, await key(signer, 'sign'), bytes);
  return new Uint8Array(sig);
}
export async function verifyBytes(signer, bytes, sig) {
  try { return await subtle.verify({ name: 'Ed25519' }, await key(signer, 'verify'), sig, bytes); }
  catch { return false; }
}

/** Sign a JSON document; returns {payload, sig:{signer, alg, value}}. */
export async function signDoc(signer, payload) {
  const bytes = te.encode(canonical(payload));
  return { signer, alg: 'Ed25519', digest: sha256(bytes), value: b64url(await signBytes(signer, bytes)) };
}
export async function verifyDoc(payload, sig) {
  const bytes = te.encode(canonical(payload));
  const digestOk = sha256(bytes) === sig.digest;
  const ok = await verifyBytes(sig.signer, bytes, fromB64url(sig.value));
  return { ok: ok && digestOk, digestOk, signer: sig.signer };
}

export const publicKeyFingerprint = (signer) => sha256(DEMO_KEYS[signer].x).slice(0, 16).toUpperCase().match(/.{4}/g).join('-');
