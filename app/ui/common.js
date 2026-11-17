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
let showcase;
/** The child used across Home, the tour and the trial: caught by a trend rule before any Tracker listing. */
export function showcaseChild() {
  if (showcase !== undefined) return showcase;
  const TREND = ['R2_CONFIRMED', 'R2_SUSTAINED', 'INFANT_FALTERING', 'TREND_PLUS_SIGNAL'];
  let pick = null;
  for (const c of store.sim.district.children) {
    const ev = c.eval;
    const samI = ev.visits.findIndex((v) => trackerSingleReading(c, v, store.pack) === 'SAM' && !v.biv.length);
    if (samI < 3) continue;
    const firstAnyI = ev.visits.findIndex((v) => trackerSingleReading(c, v, store.pack) && !v.biv.length);
    const aI = ev.results.findIndex((r) => r.tier === 'AMBER');
    if (aI < 0 || aI >= firstAnyI) continue;
    const trend = ev.results[aI].reasons.some((r) => TREND.includes(r.code));
    const score = (trend ? 0 : 100) + Math.abs(samI - 6);
    if (!pick || score < pick.score) pick = { c, samI, aI, score };
  }
  showcase = pick;
  return pick;
}
