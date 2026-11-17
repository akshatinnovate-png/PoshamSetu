import { h, mount, svgFrom } from './dom.js';
import { store } from './store.js';
import { initWM, registerApp, getApps, open, toggle, isOpen, openIds, closeAll, place } from './wm.js';
import { drawDesktop } from './bg.js';
import { toast } from './modal.js';
import { ROLES } from '../engine/access.js';
import { fmtDateTime, DAY, HOUR } from '../engine/util.js';
import { TIER_LABEL } from '../engine/rulepack.js';
import { APPS } from './apps/index.js';

const native = window.psNative || null;
const GROUP = { bridge: 'fix', joint: 'fix', migration: 'fix', reliability: 'fix', budget: 'fix', escalation: 'gov', consent: 'gov', rulepack: 'gov', audit: 'gov', report: 'gov' };

async function boot() {
  const lines = h('div');
  const bar = h('i');
  const el = h('div.boot', null, h('div.hd', null, 'PS.OS1  ·  PoshanSetu'), lines, h('div.bar', null, bar));
  document.body.appendChild(el);
  const steps = [
    'BIOS  WHO Child Growth Standards 2006 · LMS tables loaded (wfa, lhfa, wfl, wfh)',
    'MOUNT rule pack PS-RP-JH-WSB@2.0.0',
  ];
  let n = 0;
  const log = (t, ok = true) => { lines.append(h('div.ln', null, `${String(++n).padStart(2, '0')}  ${t}  `, ok ? h('span.ok', null, '[ OK ]') : '')); bar.style.width = Math.min(100, n * 12) + '%'; };
  for (const s of steps) { log(s); await wait(90); }
  await store.init((msg) => log(msg));
  const m = store.sim.metrics;
  log(`silent-trial backtest · ${m.samKids} SAM cases · ${Math.round(m.shareEarlier * 100)}% flagged earlier · median lead ${Math.round(m.leadMedian)} d`);
  log(`audit chain head ${store.audit.head.slice(0, 16)}…`);
  log('bridge: API Setu webhook · SMS flash · batch export (reconciliation only)');
  bar.style.width = '100%';
  await wait(350);
  el.remove();
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function shell() {
  const root = document.getElementById('app');
  const desktop = h('div.desktop');
  const canvas = h('canvas.bg');
  const toasts = h('div.toasts');
  const dock = h('div.dock');
  const menubar = h('div.menubar');
  desktop.append(canvas, h('div.desk-frame'), h('div.desk-label', null, 'PS.OS1'), h('div.vtext', null, `${store.pack.id}@${store.pack.version} · sig ${store.signed.signatures[0].value.slice(0, 44)}`));
  root.append(menubar, desktop, dock, toasts);
  initWM(desktop, renderDock);
  for (const a of APPS) registerApp(a);

  // desktop icons
  const icons = h('div.desk-icons', null, getApps().filter((a) => a.desk).map((a) => h('div.desk-icon', { ondblclick: () => open(a.id), onclick: (e) => { if (e.detail === 1) setTimeout(() => {}, 0); } }, h('div.ic', null, svgFrom(a.icon)), h('span', null, a.desk))));
  desktop.append(icons);

  // desktop widgets (behind windows): Clock Tool + Pulse
  const clockW = h('div.widget', { style: { left: '60px', top: '46px', width: '250px' } });
  const pulseW = h('div.widget', { style: { left: '60px', bottom: '40px', width: '300px' } });
  desktop.append(clockW, pulseW);
  function renderWidgets() {
    const d = new Date(store.now + 5.5 * 3600000);
    mount(clockW, h('div.wt', null, 'Clock Tool 1.1'), h('div.wb', null,
      h('div', null, d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })),
      h('div', { style: { fontSize: '30px' } }, d.toISOString().slice(11, 19), h('span', { style: { fontSize: '16px' } }, ' IST')),
      h('div.row', { style: { gap: '4px', marginTop: '4px' } }, ['+1h', '+1d', '+7d'].map((l, i) => h('button.wbtn', { onclick: () => store.advance([3600000, 86400000, 7 * 86400000][i]) }, l)))));
    const ts = store.scopedTasks().map((t) => ({ t, e: store.esc(t) })).filter((x) => x.e.open);
    const next = ts.filter((x) => x.e.nextEscalationAt).sort((a, b) => a.e.nextEscalationAt - b.e.nextEscalationAt)[0];
    const cnt = (tier) => ts.filter((x) => x.t.tier === tier).length;
    mount(pulseW, h('div.wt', null, `Pulse · ${store.scopeLabel()}`), h('div.wb', null,
      h('div.row', { style: { gap: '10px' } }, [['RED_A', 'RA'], ['RED_B', 'RB'], ['AMBER', 'AM'], ['WATCH', 'WA']].map(([t, l]) => h('div', null, h('div', { style: { fontSize: '28px', lineHeight: 1 } }, cnt(t)), h('div', { style: { fontSize: '14px' } }, l)))),
      h('div', { style: { marginTop: '4px' } }, next ? `next escalation in ${Math.max(0, Math.round((next.e.nextEscalationAt - store.now) / 3600000))} h` : 'no escalation pending'),
      h('div', null, `in flight on the bridge: ${store.inflight.length}`)));
  }
  renderWidgets();
  store.on('tick', renderWidgets); store.on('role', renderWidgets); store.on('task', renderWidgets); store.on('inflight', renderWidgets); store.on('ingested', renderWidgets);

  const fitIcons = () => { icons.style.gridTemplateRows = `repeat(${Math.max(3, Math.floor((desktop.clientHeight - 80) / 84))}, 78px)`; };
  fitIcons();
  const redraw = () => { drawDesktop(canvas); fitIcons(); };
  redraw();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(redraw, 120); });

  // ---------- menubar ----------
  let openMenu = null;
  const clockEl = h('span');
  function menu(label, items) {
    const mi = h('div.mi', null, label);
    mi.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (openMenu) { openMenu.remove(); const was = openMenu.parentNode === mi; openMenu = null; document.querySelectorAll('.mi.open').forEach((x) => x.classList.remove('open')); if (was) return; }
      const dd = h('div.dropdown', null, (typeof items === 'function' ? items() : items).map((it) => it === '-' ? h('div.sep') : it.head ? h('div.dh', null, it.head) : h('div.di' + (it.on ? '.on' : ''), { onmousedown: (ev) => { ev.stopPropagation(); closeMenus(); it.fn(); } }, h('span', null, it.label), it.k ? h('span.k', null, it.k) : null)));
      mi.append(dd); mi.classList.add('open'); openMenu = dd;
    });
    return mi;
  }
  function closeMenus() { openMenu?.remove(); openMenu = null; document.querySelectorAll('.mi.open').forEach((x) => x.classList.remove('open')); }
  addEventListener('mousedown', closeMenus);

  const roleItems = () => {
    const d = store.sim.district;
    const items = [];
    for (const [k, r] of Object.entries(ROLES)) {
      items.push({ head: `${r.label} — ${r.cadence}` });
      const scopes = r.scope === 'awc' ? d.awcs.slice(0, 4).map((a) => [a.id, `AWC ${a.name}`]) : r.scope === 'sector' ? d.sectors.map((s) => [s.id, s.name]) : r.scope === 'block' ? d.blocks.map((b) => [b.id, `${b.name} block`]) : [['DISTRICT', 'Paschimi Singhbhum']];
      for (const [id, l] of scopes) items.push({ label: `${r.short} · ${l}`, on: store.role === k && store.scope === id, fn: () => store.setRole(k, id) });
    }
    return items;
  };

  mount(menubar,
    h('div.logo', null, h('span.mark'), 'PS.OS1'),
    menu('Apps', () => getApps().map((a) => ({ label: a.title, fn: () => open(a.id), k: a.key }))),
    menu('Role', roleItems),
    menu('Time', () => [
      { head: 'Simulation clock (IST)' },
      { label: '+1 hour', k: 'H', fn: () => store.advance(HOUR) },
      { label: '+6 hours', fn: () => store.advance(6 * HOUR) },
      { label: '+1 day', k: 'D', fn: () => store.advance(DAY) },
      { label: '+7 days', k: 'W', fn: () => store.advance(7 * DAY) },
      '-',
      { label: 'Reset to 17 Nov 2026 09:00', fn: () => store.resetClock() },
    ]),
    menu('Mode', () => [
      { head: 'Pilot phase' },
      { label: 'Live alerts (since 1 Oct 2026)', on: !store.silentMode, fn: () => { store.silentMode = false; store.emit('mode'); } },
      { label: 'Silent trial (alerts logged, not shown)', on: store.silentMode, fn: () => { store.silentMode = true; store.emit('mode'); } },
    ]),
    menu('Layout', () => [
      { label: 'Jury tour — presenter mode', k: 'J', fn: () => juryLayout() },
      { label: 'Tile the five audit fixes', fn: () => tileLayout() },
      { label: 'Field layout — AWW day view', fn: () => fieldLayout() },
      { label: 'Close all windows', fn: () => closeAll() },
    ]),
    menu('Help', () => [
      { label: 'Keyboard shortcuts', fn: () => showShortcuts() },
      { label: 'About PS.OS1', fn: () => showAbout() },
      '-',
      { label: 'Every window has a ? button', fn: () => {} },
    ]),
    h('div.spacer'),
    h('div.right', null,
      h('div.clock', null, h('span.pulse', { style: { width: '8px', height: '8px', background: 'var(--hot)', display: 'inline-block', border: '1.5px solid var(--ink)' } }), clockEl),
      native ? h('div.wc', null, h('button', { onclick: () => native.minimize() }, '–'), h('button', { onclick: () => native.maximize() }, '□'), h('button.x', { onclick: () => native.close() }, '×')) : null));

  const updClock = () => { clockEl.textContent = `${fmtDateTime(store.now)} IST${store.now !== store.startNow ? '  (+' + Math.round((store.now - store.startNow) / HOUR) + 'h)' : ''}`; };
  updClock();
  store.on('tick', updClock);

  // ---------- dock ----------
  function renderDock() {
    const open_ = new Set(openIds());
    const overdue = store.scopedTasks ? store.scopedTasks().filter((t) => { const e = store.esc(t); return e.open && e.breached; }).length : 0;
    mount(dock,
      getApps().filter((a) => a.dock).map((a) => h('div.app' + (open_.has(a.id) ? '.running' : '') + (GROUP[a.id] ? '.' + GROUP[a.id] : ''), { onclick: () => toggle(a.id), title: a.title },
        h('div.ic', null, svgFrom(a.icon)), h('span', null, a.dock), a.id === 'worklist' && overdue ? h('span.badge', null, overdue) : null)),
      h('div.rolecard', { onclick: (e) => { e.stopPropagation(); menubar.querySelectorAll('.mi')[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } },
        h('div', null, h('div.who', null, `${ROLES[store.role].label}`), h('div.scope', null, `${store.actorName()} · ${store.scopeLabel()}`)),
        h('span.tag.dark', null, `L${ROLES[store.role].level}`)));
  }
  store.on('role', renderDock);
  store.on('tick', renderDock);
  renderDock();

  // ---------- notifications ----------
  store.on('escalated', ({ task, esc }) => {
    if (!store.inScope(store.childById[task.childId]) || store.silentMode) return;
    toast(toasts, { title: `ESCALATED → L${esc.level}`, kind: task.tier.startsWith('RED') ? 'red' : 'amber', body: `${TIER_LABEL[task.tier]} ${task.id} at AWC ${store.awcById[task.awcId].name} passed its ${['', 'Mukhya Sevika', 'CDPO', 'DPO'][esc.level]} threshold.`, onClick: () => open('child', { childId: task.childId }) });
  });
  store.on('ingested', ({ rec, child, task }) => {
    toast(toasts, { title: `INGEST · ${rec.adapter.replace('_', ' ')}`, kind: task && task.tier.startsWith('RED') ? 'red' : '', body: `${child.pseudoId}: ${child.current?.tier} after ${Math.round((rec.receivedAt - rec.event.t) / 60000)} min in the bridge.${task ? ` Task ${task.id} due ${fmtDateTime(task.dueAt)} (clock from measurement time).` : ''}`, onClick: () => open('child', { childId: child.id }) });
  });

  // keyboard
  addEventListener('keydown', (e) => {
    if (e.target?.matches?.('input, textarea, select')) return;
    if (e.key === 'H') store.advance(HOUR);
    if (e.key === 'D') store.advance(DAY);
    if (e.key === 'W') store.advance(7 * DAY);
    const a = getApps().find((x) => x.key && x.key === e.key);
    if (a && !e.metaKey && !e.ctrlKey) open(a.id);
  });

  function juryLayout() { open('tour'); }
  function tileLayout() {
    closeAll();
    const W = desktop.clientWidth, H = desktop.clientHeight;
    const ids = ['bridge', 'joint', 'migration', 'reliability', 'budget'];
    const cols = 3, gw = (W - 60) / cols, gh = (H - 50) / 2;
    ids.forEach((id, i) => { open(id); place(id, 20 + (i % cols) * (gw + 10), 16 + Math.floor(i / cols) * (gh + 10), gw - 10, gh - 10); });
  }
  function fieldLayout() {
    closeAll();
    store.setRole('AWW', store.defaultScope('AWW'));
    const W = desktop.clientWidth, H = desktop.clientHeight;
    open('worklist'); place('worklist', 20, 16, W * 0.56, H - 40);
    open('capture'); place('capture', W * 0.56 + 34, 16, W * 0.44 - 60, H - 40);
  }
  function panel(title, rows) {
    const scrim = h('div.scrim', { onclick: (e) => { if (e.target === scrim) scrim.remove(); } }, h('div.win.focused', { style: { position: 'relative', width: '520px', minHeight: 0 } },
      h('div.tb', null, h('span.t', null, title), h('button', { onclick: () => scrim.remove() }, '×')),
      h('div', { style: { padding: '12px 14px', background: 'var(--white)' } }, h('table.grid', null, h('tbody', null, rows.map(([k, v]) => h('tr', null, h('td', null, h('b', null, k)), h('td', null, v))))))));
    document.body.appendChild(scrim);
  }
  function showShortcuts() {
    panel('Keyboard shortcuts', [['H / D / W', 'advance the clock 1 hour / 1 day / 7 days'], ['j', 'jury tour (← → to move)'], ['1 – 5', 'the five audit fixes'], ['b', 'brief'], ['m', 'map'], ['e', 'escalation ladder'], ['t', 'silent trial'], ['r', 'rule pack'], ['k', 'consent'], ['c', 'capture'], ['a', 'audit log'], ['p', 'convergence report'], ['A', 'architecture'], ['`', 'shell']]);
  }
  async function showAbout() {
    const info = native ? await native.info() : null;
    panel('About PS.OS1', [['Build', 'PoshanSetu Round 2 prototype · Team 7, Gulmohur High School, Jamshedpur'], ['Rule pack', `${store.pack.id}@${store.pack.version} · ${store.packVerified?.ok ? 'dual signature verified' : 'unverified'}`], ['Data', `${store.sim.district.children.length.toLocaleString('en-IN')} synthetic children · ${store.sim.district.history.events.length.toLocaleString('en-IN')} events · seed 71100`], ['Growth standard', 'WHO Child Growth Standards 2006 (LMS)'], ['Audit head', store.audit.head.slice(0, 32) + '…'], ['Runtime', info ? `Electron ${info.electron} · Chromium ${info.chrome} · ${info.platform}` : 'web build'], ['Offline', 'Everything runs locally; no network calls']]);
  }
  window.psLayout = { juryLayout, fieldLayout, tileLayout };

  // initial windows
  const hash = location.hash.replace('#', '');
  if (hash && getApps().some((a) => a.id === hash)) open(hash);
  else if (hash === 'jury') juryLayout();
  else { open('landing'); }
}

(async () => {
  try { await boot(); shell(); } catch (e) {
    console.error(e);
    document.body.innerHTML = `<pre style="padding:30px;font:13px monospace;color:#c8102e">PS.OS1 failed to start:\n${e.stack || e}</pre>`;
  }
})();
