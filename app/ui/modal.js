import { h } from './dom.js';

/** Promise-based prompt (window.prompt is unavailable in Electron). */
export function ask({ title, label, value = '', ok = 'Confirm', placeholder = '' }) {
  return new Promise((resolve) => {
    const input = h('input.input', { value, placeholder, style: { width: '100%' } });
    const done = (v) => { scrim.remove(); resolve(v); };
    const scrim = h('div.scrim', { onclick: (e) => { if (e.target === scrim) done(null); } },
      h('div.win.focused', { style: { position: 'relative', width: '440px', minHeight: '0' } },
        h('div.tb', null, h('span.t', null, title), h('button', { onclick: () => done(null) }, '×')),
        h('div.body', { style: { padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' } },
          h('div.p', null, label), input,
          h('div.row', { style: { justifyContent: 'flex-end' } }, h('button.btn.ghost', { onclick: () => done(null) }, 'Cancel'), h('button.btn', { onclick: () => done(input.value) }, ok)))));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(input.value); if (e.key === 'Escape') done(null); });
    document.body.appendChild(scrim);
    setTimeout(() => input.focus(), 20);
  });
}

export function toast(container, { title, body, kind = '', ms = 6000, onClick }) {
  const el = h('div.toast' + (kind ? '.' + kind : ''), { onclick: () => { onClick?.(); el.remove(); }, style: onClick ? { cursor: 'pointer' } : null },
    h('div.th', null, h('span', null, title), h('span', null, '×')), h('div.tbd', null, body));
  container.appendChild(el);
  while (container.children.length > 4) container.firstChild.remove();
  setTimeout(() => el.remove(), ms);
  return el;
}
