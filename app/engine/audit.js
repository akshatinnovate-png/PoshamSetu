// Tamper-evident, hash-chained access & action log ("every access to child-level data is logged").
import { sha256, canonical } from './util.js';

export class AuditLog {
  constructor() { this.entries = []; this.head = '0'.repeat(64); }
  append(entry) {
    const e = { seq: this.entries.length, at: entry.at ?? Date.now(), actor: entry.actor, role: entry.role, action: entry.action, subject: entry.subject ?? null, detail: entry.detail ?? null, prev: this.head };
    e.hash = sha256(canonical(e));
    this.head = e.hash;
    this.entries.push(e);
    return e;
  }
  verify() {
    let prev = '0'.repeat(64);
    for (const e of this.entries) {
      const { hash, ...rest } = e;
      if (e.prev !== prev || sha256(canonical(rest)) !== hash) return { ok: false, brokenAt: e.seq };
      prev = hash;
    }
    return { ok: true, length: this.entries.length, head: prev };
  }
}
