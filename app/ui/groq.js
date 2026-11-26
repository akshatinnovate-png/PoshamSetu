// Groq client for the quick-entry assistant. Desktop: via the Electron main process (key stays there).
// Web build: via the local server's /api/groq proxy. Either way the page never holds the key.
import { groqRequest, fromGroq } from '../engine/quickentry.js';

const native = () => window.psNative?.groqChat ? window.psNative : null;

export async function groqStatus() {
  try {
    if (native()) return await native().groqStatus();
    const r = await fetch('/api/groq/status'); return r.ok ? await r.json() : { configured: false };
  } catch { return { configured: false }; }
}

export async function groqSetKey(key) { return native() ? native().groqSetKey(key) : { ok: false, error: 'In the browser version, start the server with GROQ_API_KEY set.' }; }

/** Read notes with Groq. Resolves { ok, rows } or { ok:false, error }. */
export async function groqRead(text) {
  const body = groqRequest(text);
  let res;
  try {
    res = native() ? await native().groqChat(body) : await (await fetch('/api/groq/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  } catch (e) { return { ok: false, error: e.message }; }
  if (!res?.ok) return { ok: false, error: res?.error || 'Groq failed' };
  try { return { ok: true, rows: fromGroq(JSON.parse(res.content), text) }; } catch { return { ok: false, error: 'Groq replied with something that is not JSON' }; }
}
