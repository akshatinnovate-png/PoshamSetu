// Window manager for PS.OS1: drag, resize, focus/z-order, minimise to dock, maximise.
import { h } from './dom.js';
import { HELP } from './help.js';
import { plainStrip, isSimple, setSimple } from './plain.js';

const apps = new Map();     // id -> app definition
const wins = new Map();     // id -> { el, body, app, cleanup }
let z = 10;
let desktop, onChange = () => {};

export function registerApp(app) { apps.set(app.id, app); }
/** Simple mode on/off: add or remove the plain-words strip on every open window. */
export function setSimpleMode(on) {
  setSimple(on);
  for (const [id, w] of wins) { w.el.querySelector(':scope > .plain')?.remove(); const s = plainStrip(id, w.el); if (s) w.el.insertBefore(s, w.body); }
}
export { isSimple };
export function getApps() { return [...apps.values()]; }
export function isOpen(id) { return wins.has(id); }
export function initWM(el, changed) { desktop = el; onChange = changed || onChange; }

export function open(id, opts = {}) {
  const app = apps.get(id);
  if (!app) throw new Error('no app ' + id);
  if (wins.has(id)) {
    const w = wins.get(id);
    w.el.classList.remove('min');
    focus(id);
    if (opts.refresh !== false && w.refresh) w.refresh(opts);
    return w;
  }
  const dw = desktop.clientWidth, dh = desktop.clientHeight;
  const size = app.size || [720, 520];
  const W = Math.min(size[0], dw - 40), H = Math.min(size[1], dh - 30);
  const pos = opts.pos || app.pos || [Math.max(20, (dw - W) / 2 + (wins.size % 5) * 26 - 50), Math.max(14, (dh - H) / 2 + (wins.size % 5) * 22 - 40)];
  const body = h('div.body');
  const title = h('span.t', null, app.title);
  const el = h('div.win.opening', { style: { left: pos[0] + 'px', top: pos[1] + 'px', width: W + 'px', height: H + 'px' }, 'data-app': id },
    h('div.tb', null,
      title,
      app.version ? h('span.ver', null, app.version) : null,
      HELP[id] ? h('button', { title: 'What am I looking at?', onclick: (e) => { e.stopPropagation(); const ex = el.querySelector('.helpov'); if (ex) ex.remove(); else body.prepend(h('div.helpov', null, h('b', null, 'What to look at: '), HELP[id])); } }, '?') : null,
      h('button', { title: 'Minimise', onclick: (e) => { e.stopPropagation(); minimise(id); } }, '_'),
      h('button', { title: 'Maximise', onclick: (e) => { e.stopPropagation(); el.classList.toggle('max'); w.onResize?.(); } }, '□'),
      h('button', { title: 'Close', onclick: (e) => { e.stopPropagation(); close(id); } }, '×')),
    body,
    h('div.rs'));
  const strip = plainStrip(id, el);
  if (strip) el.insertBefore(strip, body);
  desktop.appendChild(el);
  const w = { el, body, app, title, cleanup: [] };
  wins.set(id, w);
  dragify(el, el.querySelector('.tb'), w);
  resizify(el, el.querySelector('.rs'), w);
  el.addEventListener('mousedown', () => focus(id));
  el.addEventListener('animationend', () => el.classList.remove('opening'), { once: true });
  focus(id);
  const ctx = {
    body, win: w,
    setTitle: (t) => { title.textContent = t; },
    onCleanup: (fn) => w.cleanup.push(fn),
    onResize: (fn) => { w.onResize = fn; },
    setRefresh: (fn) => { w.refresh = fn; },
  };
  try { app.mount(ctx, opts); } catch (e) { console.error(e); body.textContent = 'Error: ' + e.message; }
  onChange();
  return w;
}

export function close(id) {
  const w = wins.get(id);
  if (!w) return;
  w.cleanup.forEach((fn) => { try { fn(); } catch {} });
  w.el.remove();
  wins.delete(id);
  onChange();
}
export function minimise(id) { wins.get(id)?.el.classList.add('min'); onChange(); }
export function toggle(id) {
  const w = wins.get(id);
  if (!w) return open(id);
  if (w.el.classList.contains('min') || !w.el.classList.contains('focused')) { w.el.classList.remove('min'); focus(id); }
  else minimise(id);
  onChange();
}
export function focus(id) {
  for (const [k, w] of wins) w.el.classList.toggle('focused', k === id);
  const w = wins.get(id);
  if (w) w.el.style.zIndex = ++z;
}
export function closeAll() { for (const [id, w] of [...wins]) if (!w.app.persistent) close(id); }
export function openIds() { return [...wins.keys()]; }
export function place(id, x, y, wdt, hgt) {
  const w = wins.get(id); if (!w) return;
  Object.assign(w.el.style, { left: x + 'px', top: y + 'px', width: wdt + 'px', height: hgt + 'px' });
  w.onResize?.();
}

function dragify(el, handle, w) {
  handle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON' || el.classList.contains('max')) return;
    const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
    const mv = (ev) => {
      const maxX = desktop.clientWidth - 60, maxY = desktop.clientHeight - 26;
      el.style.left = Math.min(maxX, Math.max(-el.offsetWidth + 80, ox + ev.clientX - sx)) + 'px';
      el.style.top = Math.min(maxY, Math.max(0, oy + ev.clientY - sy)) + 'px';
    };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  });
  handle.addEventListener('dblclick', () => { el.classList.toggle('max'); w.onResize?.(); });
}
function resizify(el, grip, w) {
  grip.addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, ow = el.offsetWidth, oh = el.offsetHeight;
    let raf = 0;
    const mv = (ev) => {
      el.style.width = Math.max(280, ow + ev.clientX - sx) + 'px';
      el.style.height = Math.max(160, oh + ev.clientY - sy) + 'px';
      cancelAnimationFrame(raf); raf = requestAnimationFrame(() => w.onResize?.());
    };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); w.onResize?.(); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  });
}
