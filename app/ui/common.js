import { h, tierChip } from './dom.js';
import { store } from './store.js';
import { displayName, ROLES } from '../engine/access.js';
import { DAY, HOUR, fmtDate, fmtDateTime, fmtDuration } from '../engine/util.js';
import { DAYS_PER_MONTH } from '../engine/growth.js';

export { tierChip, fmtDate, fmtDateTime, fmtDuration, DAY, HOUR };

export const ageAt = (child, t) => (t - child.dob) / DAY / DAYS_PER_MONTH;
export function ageLabel(months) {
  if (months < 0) return 'unborn';
  if (months < 24) return `${Math.floor(months)} mo`;
  return `${Math.floor(months / 12)} y ${Math.floor(months % 12)} mo`;
}
export const nameOf = (child) => displayName(child, store.role, store.breakGlass);
export const canSeeNames = (child) => ROLES[store.role].names || store.breakGlass.has(child.id);

export function rel(t, now = store.now) {
  const d = t - now;
  const s = fmtDuration(Math.abs(d));
  return d >= 0 ? `in ${s}` : `${s} ago`;
}
export function dueChip(task, esc) {
  if (!esc.open) return h('span.tag.ok', null, esc.state === 'CLOSED' ? 'closed' : esc.state.toLowerCase());
  const ms = task.dueAt - store.now;
  if (ms < 0) return h('span.tag.bad', null, `overdue ${fmtDuration(-ms)}`);
  if (ms < 24 * HOUR) return h('span.tag.warn', null, `due ${fmtDuration(ms)}`);
  return h('span.tag', null, `due ${fmtDuration(ms)}`);
}
export function levelChip(level) {
  const labels = ['L0 AWW/ASHA', 'L1 Mukhya Sevika', 'L2 CDPO + BMO', 'L3 DPO + CMO'];
  const cls = ['', 'warn', 'bad', 'dark'][level] || '';
  return h('span.tag' + (cls ? '.' + cls : ''), null, labels[level]);
}
export function closureDots(task, esc) {
  const roles = ['AWW', 'ASHA'];
  const ms = task.tier === 'RED_B' ? [['APPETITE_TEST', 'RUTF'], ['MO_SCREEN', 'MO']].map(([k, l]) => { const m = task.milestones.find((x) => x.kind === k); return h('span.tag' + (m ? (m.result === 'FAIL' ? '.bad' : '.ok') : ''), { title: m ? `${k} ${m.result || ''} · ${fmtDateTime(m.t)}` : `${k} pending` }, m ? `${l} ${m.result === 'FAIL' ? '✗' : '✓'}` : l); }) : [];
  return h('span.row', { style: { gap: '4px', flexWrap: 'wrap' } }, ms, esc?.state === 'CONFLICT' ? h('span.tag.bad', { title: 'Outcomes disagree — Mukhya Sevika reconciles' }, 'conflict') : null, roles.map((r) => {
    const req = task.required.some((x) => x.split('|').includes(r));
    const c = task.closures.find((x) => x.by === r);
    const good = c && (c.outcome === 'VISITED' || c.outcome === 'REFERRED');
    const txt = c ? (good ? (c.dtmf ? `${r} ${c.dtmf}` : `${r} ✓`) : `${r} ${c.outcome.toLowerCase().slice(0, 7)}`) : r;
    return h('span.tag' + (c ? (good ? '.ok' : '.warn') : req ? '' : '.sky'), { title: c ? `${c.outcome} via ${c.channel} · ${fmtDateTime(c.t)}` : req ? 'Awaiting confirmation' : 'Not required' }, req || c ? txt : `${r} –`);
  }));
}

export function section(title, ...kids) {
  return h('div.col', { style: { gap: '6px' } }, h('div.kicker', null, title), ...kids);
}
export function statCard(v, l, opts = {}) {
  return h('div.card' + (opts.cls ? '.' + opts.cls : ''), { style: { flex: opts.flex || 1, minWidth: '110px' } }, h('div.stat', null, h('div.v', { style: opts.color ? { color: opts.color } : null }, v), h('div.l', null, l)));
}
export const pct = (x, d = 0) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`);

import { trackerSingleReading } from '../engine/triage.js';
/** The child used across Home, the tour and the trial: caught by a trend rule before any Tracker listing. */
/** Riya — the story child chosen by engine/story.js (an eventual-SAM child flagged AMBER first). */
export function showcaseChild() {
  const st = store.story;
  if (!st) return null;
  const c = store.childById[st.childId];
  return c ? { c, samI: st.samI, aI: st.aI } : null;
}

/** Save an on-screen SVG as a standalone vector file (for slides). */
export function downloadSvg(svg, name) {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('style', 'font-family: JetBrains Mono, Menlo, monospace; background: #fff');
  const vb = (clone.getAttribute('viewBox') || '0 0 800 400').split(' ').map(Number);
  clone.setAttribute('width', vb[2]); clone.setAttribute('height', vb[3]);
  const data = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  if (window.psNative?.saveFile) window.psNative.saveFile(name, data);
  else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml' })); a.download = name; a.click(); }
}
