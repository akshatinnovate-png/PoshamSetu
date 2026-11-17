// Tiny DOM helpers: h() for HTML, s() for SVG.
export function h(tag, attrs, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (attrs) for (const [k, v] of Object.entries(attrs)) setAttr(el, k, v);
  append(el, kids);
  return el;
}
const SVGNS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) setAttr(el, k, v, true);
  append(el, kids);
  return el;
}
function setAttr(el, k, v, svg) {
  if (v == null || v === false) return;
  if (k === 'class') { if (svg) el.setAttribute('class', v); else el.className = (el.className ? el.className + ' ' : '') + v; }
  else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
  else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
  else if (k === 'html') el.innerHTML = v;
  else if (k === 'text') el.textContent = v;
  else if (k in el && !svg && typeof v !== 'string') el[k] = v;
  else el.setAttribute(k, v === true ? '' : v);
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.appendChild(typeof k === 'object' ? k : document.createTextNode(String(k)));
  }
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const mount = (el, ...kids) => { clear(el); append(el, kids); return el; };

import { TIER_LABEL } from '../engine/rulepack.js';
export const tierChip = (tier) => h('span.tier.' + tier, null, TIER_LABEL[tier] || tier);

export function svgFrom(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstChild;
}
