// Dithered / halftone backgrounds in the spirit of the reference: ordered-dither (Bayer)
// renderings of soft blobs and fractal clouds, drawn at low resolution and scaled up.
const BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);

function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

/** Desktop: pink field with dithered dark blobs (like halftone planets). */
export function drawDesktop(canvas, seed = 7) {
  const scale = 3;
  const W = Math.ceil(canvas.clientWidth / scale), H = Math.ceil(canvas.clientHeight / scale);
  if (!W || !H) return;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const bg = hexRgb('#f3879f'), ink = hexRgb('#2a2024');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const blobs = [
    { x: 0.86, y: 0.78, r: 0.42, k: 0.95 },
    { x: 0.1, y: 1.05, r: 0.38, k: 0.85 },
    { x: 0.55, y: -0.1, r: 0.18, k: 0.35 },
  ];
  const stars = Array.from({ length: 90 }, () => [rnd() * W, rnd() * H * 0.7, rnd()]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (const b of blobs) {
        const dx = x / W - b.x, dy = (y / H - b.y) * (H / W);
        const d = Math.sqrt(dx * dx + dy * dy) / (b.r);
        if (d < 1) v = Math.max(v, b.k * Math.pow(1 - d, 0.55) * (0.7 + 0.3 * Math.sin(x * 0.05 + y * 0.03)));
      }
      const th = BAYER[(y & 7) * 8 + (x & 7)];
      const on = v * 0.9 > th;
      const i = (y * W + x) * 4;
      const c = on ? ink : bg;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
  }
  for (const [sx, sy, k] of stars) {
    const i = ((Math.floor(sy) * W) + Math.floor(sx)) * 4;
    if (k > 0.5) { img.data[i] = ink[0]; img.data[i + 1] = ink[1]; img.data[i + 2] = ink[2]; }
  }
  ctx.putImageData(img, 0, 0);
}

// value noise for clouds
function noise2(seed) {
  const perm = new Uint8Array(512);
  let s = seed;
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const g = (i) => perm[i & 511] / 255;
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = g(perm[xi & 255] + (yi & 255)), b = g(perm[(xi + 1) & 255] + (yi & 255));
    const c = g(perm[xi & 255] + ((yi + 1) & 255)), d = g(perm[(xi + 1) & 255] + ((yi + 1) & 255));
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Landing: sky-blue with magenta/pink dithered clouds. */
export function drawClouds(canvas, t = 0, seed = 11) {
  const scale = 3;
  const W = Math.ceil(canvas.clientWidth / scale), H = Math.ceil(canvas.clientHeight / scale);
  if (!W || !H) return;
  if (canvas.width !== W) { canvas.width = W; canvas.height = H; }
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const n = noise2(seed);
  const sky = hexRgb('#d3e8fb'), pinkL = hexRgb('#fbb6e6'), hot = hexRgb('#f75fd6'), white = [255, 255, 255];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / 70 + t * 0.02, ny = y / 70;
      let v = 0, amp = 1, f = 1, tot = 0;
      for (let o = 0; o < 5; o++) { v += amp * n(nx * f, ny * f); tot += amp; amp *= 0.5; f *= 2; }
      v /= tot;
      // clouds heavier at edges, clear sky in the middle top
      const cx = Math.abs(x / W - 0.5) * 2;
      const fade = Math.min(1, y / H * 1.4);
      v = v * (0.55 + 0.6 * cx) + (1 - fade) * -0.05;
      const bottomWhite = Math.max(0, (y / H - 0.55) / 0.45);
      const th = BAYER[(y & 7) * 8 + (x & 7)];
      let c = sky;
      if (v > 0.5) c = (v - 0.5) * 3.2 > th ? hot : pinkL;
      else if (v > 0.42) c = (v - 0.42) * 12 > th ? pinkL : sky;
      if (bottomWhite * 1.3 > th + 0.1) c = white;
      const i = (y * W + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
