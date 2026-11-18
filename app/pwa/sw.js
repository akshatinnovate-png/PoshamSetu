// Service worker: cache the app shell and the whole engine so the AWW app works with no signal.
const CACHE = 'poshansetu-aww-v2';
const SHELL = [
  './', './index.html', './pwa.css', './pwa.js', './i18n.js', './manifest.webmanifest',
  '../assets/icon.png',
  '../engine/util.js', '../engine/growth.js', '../engine/who-lms.js', '../engine/who-velocity.js', '../engine/velocity.js',
  '../engine/triage.js', '../engine/rulepack.js', '../engine/signing.js', '../engine/demo-keys.js', '../engine/risk.js', '../engine/forecast.js',
  '../engine/simulate.js', '../engine/sim/constants.js', '../engine/sim/population.js', '../engine/sim/history.js', '../engine/sim/analyse.js', '../engine/sim/metrics.js', '../engine/access.js', '../engine/consent.js', '../engine/tasks.js', '../engine/bridge.js', '../engine/reliability.js',
  '../vendor/fonts/inter-tight-latin-400-normal.woff2', '../vendor/fonts/inter-tight-latin-700-normal.woff2', '../vendor/fonts/inter-tight-latin-800-normal.woff2',
  '../vendor/fonts/jetbrains-mono-latin-400-normal.woff2', '../vendor/fonts/noto-sans-devanagari-devanagari-400-normal.woff2', '../vendor/fonts/noto-sans-devanagari-devanagari-700-normal.woff2',
  '../assets/ivr/hi_intro.ogg',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // sync calls go to the network
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })));
});
