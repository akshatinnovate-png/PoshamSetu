// Dithered / halftone backgrounds in the spirit of the reference: ordered-dither (Bayer)
// renderings of soft blobs and fractal clouds, drawn at low resolution and scaled up.
const BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);

function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

/** Desktop: pink field with halftone "planets" (dot radius follows a soft falloff), like the reference. */
export function drawDesktop(canvas, seed = 7) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#f3879f'; ctx.fillRect(0, 0, W, H);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const blobs = [
    { x: W * 0.9, y: H * 0.95, r: Math.max(W, H) * 0.42 },
    { x: W * 0.06, y: H * 1.1, r: Math.max(W, H) * 0.3 },
    { x: W * 0.5, y: -H * 0.25, r: Math.max(W, H) * 0.22 },
  ];
  const cell = 7;
  ctx.fillStyle = '#2a2024';
  for (let y = cell / 2; y < H; y += cell) {
    for (let x = cell / 2; x < W; x += cell) {
      let v = 0;
      for (const b of blobs) {
        const d = Math.hypot(x - b.x, y - b.y) / b.r;
        if (d < 1) v = Math.max(v, Math.pow(1 - d, 0.9));
      }
      const r = v > 0.02 ? Math.min(cell * 0.62, 0.6 + v * cell * 0.75) : 0.55;
      ctx.globalAlpha = v > 0.02 ? 1 : 0.28;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 70; i++) { const x = rnd() * W, y = rnd() * H * 0.75, r = rnd() < 0.2 ? 2 : 1.2; ctx.fillRect(x, y, r * 1.5, r * 1.5); }
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
