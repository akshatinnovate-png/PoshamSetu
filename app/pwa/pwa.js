// PoshanSetu AWW companion (PWA): offline-first, Hindi-first, same signed engine as the console.
import { generate, NOW } from '../engine/simulate.js';
import { DEFAULT_PACK } from '../engine/rulepack.js';
import { evaluate } from '../engine/triage.js';
import { indices, bivFlags, DAYS_PER_MONTH } from '../engine/growth.js';
import { STR } from './i18n.js';

const $ = (sel) => document.querySelector(sel);
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const COL = { RED_A: '#c8102e', RED_B: '#f0542d', AMBER: '#f2a20c', WATCH: '#3f7fe0', GREEN: '#1f9d6b' };
const RANK = { RED_A: 0, RED_B: 1, AMBER: 2, WATCH: 3, GREEN: 4 };

const S = {
  lang: LS.get('ps-lang', 'hi'),
  awcId: LS.get('ps-awc', null),
  server: LS.get('ps-server', location.origin),
  forceOffline: LS.get('ps-force-offline', false),
  journal: LS.get('ps-journal', []), // { id, childId, m, synced }
  view: 'today', childId: null, q: '', toast: '',
  sim: null, now: NOW,
};
const t = () => STR[S.lang];
const online = () => navigator.onLine && !S.forceOffline;

// ---------- tiny DOM helper ----------
function h(tag, attrs, ...kids) {
  const [n, ...cls] = tag.split('.');
  const el = document.createElement(n || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
}

// ---------- data ----------
function boot() {
  S.sim = generate({ pack: DEFAULT_PACK });
  if (!S.awcId) S.awcId = S.sim.district.awcs[0].id;
  // Replay the on-device journal: measurements taken on this phone survive restarts.
  for (const j of S.journal) applyMeasurement(j.childId, j.m, false);
  render();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js').catch(() => {});
  addEventListener('online', () => { sync(); render(); });
  addEventListener('offline', render);
  setInterval(() => { if (online() && pending().length) sync(); }, 15000);
}
const awc = () => S.sim.awcById[S.awcId];
const kids = () => S.sim.district.children.filter((c) => c.awcId === S.awcId && c.current && (S.now - c.dob) / 86400000 / DAYS_PER_MONTH < 60);
const pending = () => S.journal.filter((j) => !j.synced);
const name = (c) => c.name;
function ageText(c) { const m = (S.now - c.dob) / 86400000 / DAYS_PER_MONTH; return m < 24 ? `${Math.floor(m)} ${t().months}` : `${Math.floor(m / 12)} ${t().years} ${Math.floor(m % 12)} ${t().months}`; }

function applyMeasurement(childId, m, journal = true) {
  const c = S.sim.district.children.find((x) => x.id === childId);
  if (!c) return null;
  const e = { id: `P${Date.now()}${Math.floor(Math.random() * 1e4)}`, childId, awcId: c.awcId, by: 'AWW', ...m };
  c.events = [...c.events, e];
  const ev = evaluate(c, c.events, c.signals, DEFAULT_PACK, { feedR: S.sim.feeds[c.awcId].R });
  c.eval = ev; c.current = ev.current;
  if (journal) { S.journal.push({ id: e.id, childId, m, synced: false }); LS.set('ps-journal', S.journal); }
  return c;
}

async function sync() {
  const list = pending();
  if (!list.length || !online()) return;
  try {
    const body = list.map((j) => { const c = S.sim.district.children.find((x) => x.id === j.childId); return { id: j.id, beneficiaryRef: c.pseudoId, measuredAt: new Date(j.m.t).toISOString(), weightKg: j.m.weightKg, heightCm: j.m.heightCm, muacMm: j.m.muacMm, oedema: j.m.oedema, danger: j.m.danger, lying: j.m.lying }; });
    const r = await fetch(`${S.server.replace(/\/$/, '')}/v1/device/events`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ps-device': awc().code }, body: JSON.stringify({ events: body }) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const res = await r.json();
    const okIds = new Set((res.results || []).filter((x) => x.accepted || x.duplicate).map((x) => x.id));
    for (const j of S.journal) if (okIds.has(j.id)) j.synced = true;
    LS.set('ps-journal', S.journal);
    flash(`${okIds.size} ${t().savedOnline}`);
  } catch (e) {
    flash(`${t().offline}: ${e.message}`);
  }
  render();
}
function flash(msg) { S.toast = msg; render(); setTimeout(() => { S.toast = ''; render(); }, 3500); }

// ---------- views ----------
function header() {
  const p = pending().length;
  return h('header', null,
    h('div.brand', null, h('span.mark'), 'पोषण सेतु'),
    h('button.net' + (online() ? '.on' : '.off'), { onclick: () => { S.forceOffline = !S.forceOffline; LS.set('ps-force-offline', S.forceOffline); if (online()) sync(); render(); }, title: 'tap to simulate no signal' }, online() ? `▂▄▆ ${t().online}` : `✕ ${t().offline}`),
    p ? h('span.pending', null, t().pending(p)) : h('span.ok', null, `✓ ${t().synced}`));
}
function nav() {
  const b = (id, label, icon) => h('button' + (S.view === id ? '.on' : ''), { onclick: () => { S.view = id; S.childId = null; render(); } }, h('span.i', null, icon), label);
  return h('nav', null, b('today', t().today, '◉'), b('children', t().children, '☰'), b('queue', `${t().queue}${pending().length ? ` (${pending().length})` : ''}`, '⇅'), b('settings', t().settings, '⚙'));
}
function tierBadge(tier) { return h('span.tier', { style: { background: COL[tier], color: tier === 'AMBER' ? '#1f1b1d' : '#fff' } }, t().tiers[tier]); }
function reasonText(x, v) {
  if (!x) return '';
  if (S.lang !== 'hi') return x.text;
  const muac = v?.muacMm, whz = v?.ix?.whz;
  const HI = {
    OEDEMA: 'दोनों पैरों में दबाने पर गड्ढा बनने वाली सूजन',
    DANGER_VOMITING: 'खतरे का लक्षण: सब उल्टी कर देता है', DANGER_LETHARGIC: 'खतरे का लक्षण: बहुत कमज़ोर / सुस्त', DANGER_UNABLE_TO_FEED: 'खतरे का लक्षण: खा-पी नहीं पा रहा',
    APPETITE_FAIL: 'भूख जाँच में फेल', INFANT_WASTED: `6 माह से कम उम्र, बहुत दुबला (WHZ ${whz})`,
    R3_MUAC_SAM: `MUAC ${muac} mm — 115 से कम`, WHZ_SAM: `WHZ ${whz} — -3 से कम`,
    MAM_CONFIRMED: `दोबारा नाप में भी MAM पक्का (MUAC ${muac ?? '—'} mm, WHZ ${whz})`, MAM_UNCONFIRMED: 'MAM नाप — पक्का करने के लिए दोबारा नापें',
    R2_UNCONFIRMED: 'एक महीने में तेज़ गिरावट — दोबारा वज़न लें', R2_CONFIRMED: 'दोबारा वज़न में गिरावट पक्की', R2_SUSTAINED: 'लगातार दो महीने गिरावट',
    INFANT_FALTERING: 'लगातार दो महीने वज़न WHO के 15वें सेंटाइल से कम बढ़ा', VELOCITY_2M: 'दो महीने में वज़न WHO के 15वें सेंटाइल से कम बढ़ा (दो बार)',
    TREND_PLUS_SIGNAL: 'गिरता वज़न + 30 दिन में दस्त / टीका छूटा', WATCH_REPEAT: 'लगातार दो बार निगरानी', FORECAST: 'इसी रफ़्तार से 60 दिन में MAM होने की आशंका',
    WEAK_SIGNALS: 'कई छोटे जोखिम एक साथ (जोखिम अंक)', LBW_LOW_GAIN: 'कम जन्म-वज़न वाला शिशु, वज़न कम बढ़ा',
  };
  return HI[x.code] || (x.code.startsWith('DQ_') ? 'नाप में गड़बड़ — दोबारा नापें' : x.text);
}
function riskText(f) {
  if (S.lang !== 'hi') return f.text;
  const HI = { WHZ_NEAR_MAM: 'WHZ MAM रेखा के पास', WHZ_LOW: 'WHZ कम', WHZ_FALL: 'एक महीने में WHZ गिरा', WHZ_FALL_BIG: 'एक महीने में WHZ तेज़ गिरा', MUAC_LOW: 'MUAC 130 mm से कम', MUAC_FALL: 'MUAC घटा', VELOCITY_LOW: 'वज़न WHO के 15वें सेंटाइल से कम बढ़ा', SIGNAL: 'दस्त / टीका छूटा (सहमति से)', LBW: 'कम जन्म-वज़न, 12 माह से कम', UNDER_2: '2 साल से कम', PRIOR_EPISODE: 'पिछले 6 माह में AMBER/RED', LEAN_SEASON: 'बरसात / कमी का मौसम', RETURNED_MIGRANT: 'पलायन से हाल में लौटे' };
  return HI[f.code] || f.text;
}
function reasonOf(c) { const r = c.current; return reasonText(r.reasons.find((x) => x.tier === r.tier), r.visit); }

function card(c) {
  const r = c.current;
  return h('div.card', { onclick: () => { S.childId = c.id; S.view = 'child'; render(); }, style: { borderLeftColor: COL[r.tier] } },
    h('div.row', null, h('b.nm', null, name(c)), h('span.age', null, ageText(c))),
    h('div.act', null, t().tiers[r.tier]),
    h('div.why', null, reasonOf(c)),
    h('div.row', null, r.risk ? h('span.chip', null, `${t().risk} ${r.risk.score}`) : null, r.forecast && r.forecast.prob >= 0.3 && r.visit.ix.whz > -2 && r.tier !== 'RED_A' && r.tier !== 'RED_B' ? h('span.chip.warn', null, t().forecast(Math.round(r.forecast.prob * 100), DEFAULT_PACK.forecast.horizonDays)) : null));
}
function viewToday() {
  const list = kids().filter((c) => c.current.tier !== 'GREEN').sort((a, b) => RANK[a.current.tier] - RANK[b.current.tier] || (b.current.risk?.score || 0) - (a.current.risk?.score || 0));
  return h('main', null, h('h1', null, t().today, h('span.sub', null, ` · ${awc().name}`)), list.length ? list.map(card) : h('div.empty', null, t().allClear));
}
function viewChildren() {
  const list = kids().filter((c) => !S.q || name(c).toLowerCase().includes(S.q.toLowerCase())).sort((a, b) => name(a).localeCompare(name(b)));
  const inp = h('input.search', { placeholder: t().searchPh, value: S.q, oninput: (e) => { S.q = e.target.value; const pos = e.target.selectionStart; render(); const n = $('.search'); n.focus(); n.setSelectionRange(pos, pos); } });
  return h('main', null, h('h1', null, t().children, h('span.sub', null, ` · ${list.length}`)), inp,
    list.map((c) => h('div.li', { onclick: () => { S.childId = c.id; S.view = 'child'; render(); } }, h('span.dot', { style: { background: COL[c.current.tier] } }), h('span.nm', null, name(c)), h('span.age', null, ageText(c)))));
}
function spark(c) {
  const vs = c.eval.visits.filter((v) => v.ix.whz != null && !v.biv.length).slice(-10);
  if (vs.length < 2) return null;
  const W = 320, H = 110, x0 = vs[0].t, x1 = vs[vs.length - 1].t + 60 * 86400000;
  const X = (x) => 28 + ((x - x0) / (x1 - x0)) * (W - 36), Y = (z) => 8 + ((1 - z) / 5) * (H - 16);
  const ns = 'http://www.w3.org/2000/svg';
  const s = (tag, a) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' });
  svg.append(s('rect', { x: 28, y: Y(-2), width: W - 36, height: Y(-3) - Y(-2), fill: '#ffeac2' }), s('rect', { x: 28, y: Y(-3), width: W - 36, height: Y(-4) - Y(-3), fill: '#ffd3da' }));
  for (const z of [0, -2, -3]) { const tx = s('text', { x: 2, y: Y(z) + 3, 'font-size': 9 }); tx.textContent = z; svg.append(tx); }
  svg.append(s('path', { d: vs.map((v, i) => `${i ? 'L' : 'M'}${X(v.t)},${Y(v.ix.whz)}`).join(''), fill: 'none', stroke: '#1f1b1d', 'stroke-width': 2 }));
  for (const v of vs) svg.append(s('circle', { cx: X(v.t), cy: Y(v.ix.whz), r: 3.5, fill: '#fff', stroke: '#1f1b1d', 'stroke-width': 1.5 }));
  const f = c.current.forecast;
  if (f) { const last = vs[vs.length - 1]; svg.append(s('path', { d: `M${X(last.t)},${Y(f.level)} L${X(last.t + 60 * 86400000)},${Y(f.level + f.slope * 60 / 30.4375)}`, stroke: '#e94fbf', 'stroke-width': 2, 'stroke-dasharray': '5 4', fill: 'none' })); }
  return svg;
}
function viewChild() {
  const c = S.sim.district.children.find((x) => x.id === S.childId);
  const r = c.current;
  return h('main', null,
    h('button.back', { onclick: () => { S.view = 'today'; render(); } }, `← ${t().back}`),
    h('h1', null, name(c)), h('div.meta', null, `${c.sex === 'F' ? '♀' : '♂'} · ${ageText(c)} · ${c.pseudoId}`),
    tierBadge(r.tier),
    h('section', null, h('h3', null, t().why), r.reasons.slice(0, 3).map((x) => h('p', null, reasonText(x, r.visit))), S.lang === 'hi' ? h('p.small', null, r.reasons[0]?.text) : null, h('p.small', null, `rule pack v${r.packVersion}`)),
    r.forecast ? h('section', null, h('h3', null, 'WHZ'), spark(c), r.visit.ix.whz > -2 ? h('p', null, t().forecast(Math.round(r.forecast.prob * 100), DEFAULT_PACK.forecast.horizonDays)) : null) : null,
    r.risk && r.risk.factors.length ? h('section', null, h('h3', null, `${t().risk}: ${r.risk.score}`), r.risk.factors.map((f) => h('p.small', null, `+${f.points} ${riskText(f)}`))) : null,
    h('button.primary', { onclick: () => { S.view = 'weigh'; render(); } }, `⚖ ${t().weigh}`));
}
function viewWeigh() {
  const c = S.sim.district.children.find((x) => x.id === S.childId);
  const last = c.eval.lastValid || {};
  const f = S.form && S.form.id === c.id ? S.form : (S.form = { id: c.id, w: last.weightKg ?? '', h: last.heightCm ?? '', m: last.muacMm ?? '', oed: false, danger: [] });
  const ageDays = (S.now - c.dob) / 86400000;
  const m = () => ({ t: S.now, weightKg: f.w === '' ? null : +f.w, heightCm: f.h === '' ? null : +f.h, muacMm: f.m === '' ? null : +f.m, oedema: f.oed, danger: f.danger, lying: ageDays / DAYS_PER_MONTH < 24 });
  const preview = h('section.preview');
  const upd = () => {
    const mm = m();
    const ix = indices(c.sex, ageDays, mm); const biv = bivFlags(ix);
    const dry = evaluate(c, [...c.events, { id: 'dry', ...mm }], c.signals, DEFAULT_PACK).current;
    preview.replaceChildren(...[h('h3', null, t().preview), tierBadge(dry.tier), h('p', null, reasonText(dry.reasons.find((x) => x.tier === dry.tier), dry.visit)), h('p.small', null, `WHZ ${ix.whz ?? '—'} · WAZ ${ix.waz ?? '—'}`),
      biv.length ? h('p.bad', null, `${t().implausible}${mm.weightKg > 30 ? ' ' + t().didYouMean((mm.weightKg / 10).toFixed(1)) : ''}`) : null].filter(Boolean));
  };
  const num = (k, label, step) => h('label', null, label, h('input', { type: 'number', inputmode: 'decimal', step, value: f[k], oninput: (e) => { f[k] = e.target.value; upd(); } }));
  const chk = (label, on, fn) => h('label.chk', null, h('input', { type: 'checkbox', ...(on ? { checked: true } : {}), onchange: (e) => { fn(e.target.checked); upd(); } }), label);
  const dz = (k) => (on) => { f.danger = on ? [...new Set([...f.danger, k])] : f.danger.filter((x) => x !== k); };
  const el = h('main', null,
    h('button.back', { onclick: () => { S.view = 'child'; render(); } }, `← ${t().back}`),
    h('h1', null, `${t().weigh} · ${name(c)}`),
    num('w', t().weight, '0.1'), num('h', t().height, '0.1'), num('m', t().muac, '1'),
    chk(t().oedema, f.oed, (v) => (f.oed = v)),
    h('div.dz', null, h('b', null, t().danger), chk(t().vomit, f.danger.includes('VOMITING'), dz('VOMITING')), chk(t().weak, f.danger.includes('LETHARGIC'), dz('LETHARGIC')), chk(t().nofeed, f.danger.includes('UNABLE_TO_FEED'), dz('UNABLE_TO_FEED'))),
    preview,
    h('p.small', null, t().clockNote),
    h('button.primary', { onclick: async () => { applyMeasurement(c.id, m()); S.form = null; S.view = 'child'; flash(online() ? t().savedOnline : t().savedOffline); if (online()) await sync(); render(); } }, `✓ ${t().save}`));
  upd();
  return el;
}
function viewQueue() {
  return h('main', null, h('h1', null, t().queue),
    h('p.small', null, t().clockNote),
    S.journal.length ? S.journal.slice().reverse().map((j) => { const c = S.sim.district.children.find((x) => x.id === j.childId); return h('div.li', null, h('span.dot', { style: { background: j.synced ? '#1f9d6b' : '#f2a20c' } }), h('span.nm', null, name(c)), h('span.age', null, `${new Date(j.m.t).toISOString().slice(5, 16).replace('T', ' ')} · ${j.m.weightKg} kg${j.synced ? ' ✓' : ''}`)); }) : h('div.empty', null, '—'),
    h('button.primary', { onclick: sync, disabled: !online() || !pending().length }, `⇅ ${t().syncNow}`));
}
function viewSettings() {
  return h('main', null, h('h1', null, t().settings),
    h('label', null, t().lang, h('select', { onchange: (e) => { S.lang = e.target.value; LS.set('ps-lang', S.lang); document.documentElement.lang = S.lang; render(); } }, h('option', { value: 'hi', ...(S.lang === 'hi' ? { selected: true } : {}) }, 'हिन्दी'), h('option', { value: 'en', ...(S.lang === 'en' ? { selected: true } : {}) }, 'English'))),
    h('label', null, t().awc, h('select', { onchange: (e) => { S.awcId = e.target.value; LS.set('ps-awc', S.awcId); render(); } }, S.sim.district.awcs.map((a) => h('option', { value: a.id, ...(a.id === S.awcId ? { selected: true } : {}) }, `${a.name} · ${a.code}`)))),
    h('label', null, t().server, h('input', { value: S.server, onchange: (e) => { S.server = e.target.value; LS.set('ps-server', S.server); } })),
    h('p.small', null, 'All rules run on this phone. Synthetic data. Measurements are stored on the device until the companion service confirms them.'));
}

function render() {
  const app = $('#app');
  const v = S.view === 'today' ? viewToday() : S.view === 'children' ? viewChildren() : S.view === 'child' ? viewChild() : S.view === 'weigh' ? viewWeigh() : S.view === 'queue' ? viewQueue() : viewSettings();
  app.replaceChildren(header(), v, nav(), S.toast ? h('div.toast', null, S.toast) : '');
}

setTimeout(boot, 30);
