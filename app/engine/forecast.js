// Trajectory forecast: a local-linear-trend Kalman filter over a child's WHZ readings.
// State = [level, slope per month]. Measurement noise reflects real scale/board error;
// process noise lets the trend bend. Output: probability of being below a line in N days.
// Explainable to an AWW: "at this rate she reaches −2 SD around <date>".

const PHI = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
function erf(x) { // Abramowitz-Stegun 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

/**
 * @param {{t:number, z:number}[]} obs  readings oldest-first (t in ms)
 * @param {{measSd:number, levelSd:number, slopeSd:number}} cfg  noise (SD units, per month)
 */
export function kalmanTrend(obs, cfg = { measSd: 0.22, levelSd: 0.12, slopeSd: 0.08 }) {
  const MONTH = 30.4375 * 86400000;
  if (!obs.length) return null;
  // state x = [level, slope]; covariance P (2x2)
  let x = [obs[0].z, 0];
  let P = [[cfg.measSd ** 2, 0], [0, 0.15 ** 2]];
  let tPrev = obs[0].t;
  const R = cfg.measSd ** 2;
  for (let i = 1; i < obs.length; i++) {
    const dt = Math.max(0.05, (obs[i].t - tPrev) / MONTH);
    // predict: level += slope*dt
    x = [x[0] + x[1] * dt, x[1]];
    const q1 = cfg.levelSd ** 2 * dt, q2 = cfg.slopeSd ** 2 * dt;
    P = [
      [P[0][0] + dt * (P[1][0] + P[0][1]) + dt * dt * P[1][1] + q1, P[0][1] + dt * P[1][1]],
      [P[1][0] + dt * P[1][1], P[1][1] + q2],
    ];
    // update with z
    const y = obs[i].z - x[0];
    const S = P[0][0] + R;
    const K = [P[0][0] / S, P[1][0] / S];
    x = [x[0] + K[0] * y, x[1] + K[1] * y];
    P = [[(1 - K[0]) * P[0][0], (1 - K[0]) * P[0][1]], [P[1][0] - K[1] * P[0][0], P[1][1] - K[1] * P[0][1]]];
    tPrev = obs[i].t;
  }
  return { level: x[0], slope: x[1], P, t: tPrev };
}

/** Probability the true WHZ is below `line` after `days`, and the date the trend line crosses it. */
export function forecastCross(state, line, days) {
  if (!state) return null;
  const MONTH = 30.4375;
  const h = days / MONTH;
  const mean = state.level + state.slope * h;
  const varr = state.P[0][0] + 2 * h * state.P[0][1] + h * h * state.P[1][1];
  const prob = PHI((line - mean) / Math.sqrt(Math.max(1e-6, varr)));
  const crossInDays = state.slope < -1e-3 && state.level > line ? ((state.level - line) / -state.slope) * MONTH : null;
  return { mean, sd: Math.sqrt(varr), prob, crossInDays, slope: state.slope, level: state.level };
}
