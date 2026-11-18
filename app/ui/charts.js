// Hand-rolled SVG charts in the PS.OS1 style (crisp ink lines, mono labels).
import { s } from './dom.js';

const INK = '#1f1b1d';
const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);

export function niceTicks(min, max, n = 5) {
  const span = max - min || 1;
  const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => span / st <= n) || mag * 10;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

/**
 * series: [{ points:[[x,y,meta]], color, width, dash, dots, area, label, onDot }]
 * bands:  [{ y0, y1, fill, label }]   polys: [{ points:[[x,y]], fill, opacity }] (e.g. forecast cones)   vlines: [{ x, label, color, dash }]
 */
export function lineChart({ w = 560, h = 260, pad = [16, 14, 30, 44], x, y, series = [], bands = [], polys = [], vlines = [], hlines = [], xfmt = String, yfmt = String, xlabel, ylabel, onHover }) {
  const [pt, pr, pb, pl] = pad;
  const X = scale(x.min, x.max, pl, w - pr), Y = scale(y.min, y.max, h - pb, pt);
  const svg = s('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', class: 'chart', style: `display:block;font-family:var(--font-mono);overflow:visible;max-width:${Math.round(w * 1.15)}px` });
  svg.append(s('rect', { x: pl, y: pt, width: w - pl - pr, height: h - pt - pb, fill: '#fff' }));
  for (const b of bands) {
    const y0 = Math.max(y.min, Math.min(y.max, b.y0)), y1 = Math.max(y.min, Math.min(y.max, b.y1));
    svg.append(s('rect', { x: pl, y: Y(y1), width: w - pl - pr, height: Math.max(0, Y(y0) - Y(y1)), fill: b.fill, opacity: b.opacity ?? 1 }));
    if (b.label) svg.append(s('text', { x: w - pr - 4, y: Y(y1) + 11, 'text-anchor': 'end', 'font-size': 9, fill: b.labelColor || INK, opacity: 0.75 }, b.label));
  }
  for (const t of x.ticks || niceTicks(x.min, x.max, 6)) {
    svg.append(s('line', { x1: X(t), x2: X(t), y1: pt, y2: h - pb, stroke: INK, 'stroke-opacity': 0.08 }));
    svg.append(s('text', { x: X(t), y: h - pb + 13, 'text-anchor': 'middle', 'font-size': 9.5, fill: INK }, xfmt(t)));
  }
  for (const t of y.ticks || niceTicks(y.min, y.max, 5)) {
    svg.append(s('line', { x1: pl, x2: w - pr, y1: Y(t), y2: Y(t), stroke: INK, 'stroke-opacity': 0.1, 'stroke-dasharray': '2 3' }));
    svg.append(s('text', { x: pl - 6, y: Y(t) + 3, 'text-anchor': 'end', 'font-size': 9.5, fill: INK }, yfmt(t)));
  }
  for (const l of hlines) {
    svg.append(s('line', { x1: pl, x2: w - pr, y1: Y(l.y), y2: Y(l.y), stroke: l.color || INK, 'stroke-width': l.width || 1.2, 'stroke-dasharray': l.dash || '' }));
    if (l.label) svg.append(s('text', { x: pl + 4, y: Y(l.y) - 3, 'font-size': 9, fill: l.color || INK }, l.label));
  }
  for (const pg of polys) if (pg.points.length > 2) svg.append(s('path', { d: 'M' + pg.points.map((p) => `${X(p[0])},${Y(Math.max(y.min, Math.min(y.max, p[1])))}`).join('L') + 'Z', fill: pg.fill, opacity: pg.opacity ?? 0.25, stroke: 'none' }));
  svg.append(s('rect', { x: pl, y: pt, width: w - pl - pr, height: h - pt - pb, fill: 'none', stroke: INK, 'stroke-width': 1.5 }));
  for (const v of vlines) {
    svg.append(s('line', { x1: X(v.x), x2: X(v.x), y1: pt, y2: h - pb, stroke: v.color || INK, 'stroke-width': v.width || 1.2, 'stroke-dasharray': v.dash || '3 3' }));
    if (v.label) svg.append(s('text', { x: X(v.x) + 3, y: pt + 10 + (v.dy || 0), 'font-size': 9, fill: v.color || INK }, v.label));
  }
  for (const se of series) {
    const pts = se.points.filter((p) => p[1] != null && Number.isFinite(p[1]));
    if (!pts.length) continue;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    if (se.area) svg.append(s('path', { d: d + `L${X(pts[pts.length - 1][0])},${Y(y.min)}L${X(pts[0][0])},${Y(y.min)}Z`, fill: se.area, opacity: 0.35 }));
    if (se.width !== 0) svg.append(s('path', { d, fill: 'none', stroke: se.color || INK, 'stroke-width': se.width ?? 1.5, 'stroke-dasharray': se.dash || '', 'stroke-linejoin': 'round' }));
    if (se.label && se.labelEnd !== false) {
      const lp = pts[pts.length - 1];
      svg.append(s('text', { x: X(lp[0]) + 4, y: Y(lp[1]) + 3, 'font-size': 9, fill: se.color || INK }, se.label));
    }
    if (se.dots) for (const p of pts) {
      const meta = p[2] || {};
      const r = meta.r || se.r || 3.5;
      const dot = s(meta.shape === 'square' ? 'rect' : 'circle', meta.shape === 'square'
        ? { x: X(p[0]) - r, y: Y(p[1]) - r, width: r * 2, height: r * 2, fill: meta.fill || se.color || INK, stroke: INK, 'stroke-width': 1.5 }
        : { cx: X(p[0]), cy: Y(p[1]), r, fill: meta.fill || '#fff', stroke: meta.stroke || se.color || INK, 'stroke-width': 1.8, style: se.onDot ? 'cursor:pointer' : '' });
      if (meta.title) dot.append(s('title', null, meta.title));
      if (se.onDot) dot.addEventListener('click', () => se.onDot(p));
      svg.append(dot);
    }
  }
  if (xlabel) svg.append(s('text', { x: (pl + w - pr) / 2, y: h - 2, 'text-anchor': 'middle', 'font-size': 9.5, fill: INK, opacity: 0.7 }, xlabel));
  if (ylabel) svg.append(s('text', { x: 10, y: (pt + h - pb) / 2, 'text-anchor': 'middle', 'font-size': 9.5, fill: INK, opacity: 0.7, transform: `rotate(-90 10 ${(pt + h - pb) / 2})` }, ylabel));
  if (onHover) {
    const cross = s('line', { y1: pt, y2: h - pb, stroke: INK, 'stroke-dasharray': '2 2', visibility: 'hidden' });
    svg.append(cross);
    svg.addEventListener('mousemove', (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * w;
      if (px < pl || px > w - pr) { cross.setAttribute('visibility', 'hidden'); return; }
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
      onHover(x.min + ((px - pl) / (w - pl - pr)) * (x.max - x.min));
    });
    svg.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); onHover(null); });
  }
  return svg;
}

/** Histogram / bar chart. bars: [{ label, value, color, hatch }] */
export function bars({ w = 520, h = 200, bars: data, max, pad = [12, 10, 26, 34], yfmt = String, vline, title, labelEvery = 1, valueLabels = false }) {
  const [pt, pr, pb, pl] = pad;
  const M = max ?? Math.max(1, ...data.map((d) => d.value));
  const svg = s('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', style: `display:block;font-family:var(--font-mono);max-width:${Math.round(w * 1.15)}px` });
  const bw = (w - pl - pr) / data.length;
  const Y = scale(0, M, h - pb, pt);
  const defs = s('defs', null, s('pattern', { id: 'hatch', width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, s('rect', { width: 4, height: 4, fill: '#fff' }), s('line', { x1: 0, y1: 0, x2: 0, y2: 4, stroke: INK, 'stroke-width': 2 })));
  svg.append(defs);
  svg.append(s('rect', { x: pl, y: pt, width: w - pl - pr, height: h - pt - pb, fill: '#fff' }));
  for (const t of niceTicks(0, M, 4)) {
    svg.append(s('line', { x1: pl, x2: w - pr, y1: Y(t), y2: Y(t), stroke: INK, 'stroke-opacity': 0.12, 'stroke-dasharray': '2 3' }));
    svg.append(s('text', { x: pl - 5, y: Y(t) + 3, 'text-anchor': 'end', 'font-size': 9, fill: INK }, yfmt(t)));
  }
  data.forEach((d, i) => {
    const x = pl + i * bw + bw * 0.12, bh = Y(0) - Y(d.value);
    const r = s('rect', { x, y: Y(d.value), width: bw * 0.76, height: Math.max(0, bh), fill: d.hatch ? 'url(#hatch)' : d.color || INK, stroke: INK, 'stroke-width': 1.2 });
    if (d.title) r.append(s('title', null, d.title));
    svg.append(r);
    if (valueLabels && d.value) svg.append(s('text', { x: x + bw * 0.38, y: Y(d.value) - 3, 'text-anchor': 'middle', 'font-size': 9, fill: INK }, yfmt(d.value)));
    if (i % labelEvery === 0) svg.append(s('text', { x: x + bw * 0.38, y: h - pb + 12, 'text-anchor': 'middle', 'font-size': 9, fill: INK }, d.label));
  });
  if (vline != null) {
    const vx = pl + vline * bw;
    svg.append(s('line', { x1: vx, x2: vx, y1: pt, y2: h - pb, stroke: '#e94fbf', 'stroke-width': 2, 'stroke-dasharray': '4 3' }));
  }
  svg.append(s('rect', { x: pl, y: pt, width: w - pl - pr, height: h - pt - pb, fill: 'none', stroke: INK, 'stroke-width': 1.5 }));
  if (title) svg.append(s('text', { x: pl + 6, y: pt + 12, 'font-size': 10, fill: INK }, title));
  return svg;
}

export function spark(values, { w = 90, h = 22, color = INK, min, max } = {}) {
  const v = values.filter((x) => x != null);
  if (!v.length) return s('svg', { width: w, height: h });
  const lo = min ?? Math.min(...v), hi = max ?? Math.max(...v);
  const X = scale(0, values.length - 1, 1, w - 1), Y = scale(lo, hi === lo ? lo + 1 : hi, h - 2, 2);
  const d = values.map((y, i) => (y == null ? '' : `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(y).toFixed(1)}`)).join('');
  return s('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, style: 'display:block' },
    s('path', { d, fill: 'none', stroke: color, 'stroke-width': 1.5 }),
    s('circle', { cx: X(values.length - 1), cy: Y(v[v.length - 1]), r: 2.2, fill: color }));
}

/** Horizontal meter with threshold mark. */
export function meter(value, { max = 100, mark, w = 200, h = 14, color = INK } = {}) {
  const svg = s('svg', { width: '100%', height: h, viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', style: 'display:block' });
  svg.append(s('rect', { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, fill: '#fff', stroke: INK, 'stroke-width': 1.5 }));
  svg.append(s('rect', { x: 2.5, y: 2.5, width: Math.max(0, (w - 5) * Math.min(1, value / max)), height: h - 5, fill: color }));
  if (mark != null) svg.append(s('line', { x1: (w * mark) / max, x2: (w * mark) / max, y1: 0, y2: h, stroke: '#e94fbf', 'stroke-width': 2.5 }));
  return svg;
}
