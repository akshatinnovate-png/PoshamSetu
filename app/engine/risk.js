// Explainable risk points ("combined weak signals"). Each factor is a published risk factor for
// wasting / growth faltering; each adds whole points and is shown to the worker by name.
// The score drives (a) the WEAK_SIGNALS rule and (b) workload-aware ranking of the visit queue.
import { DAY } from './util.js';

/**
 * @param {import('./types.js').RiskContext} ctx
 * @returns {{ score: number, factors: {code:string, points:number, text:string}[] }}
 */
export function riskPoints(ctx) {
  const { child, visit: v, ref, velocity, signals, priorEpisodes, pack } = ctx;
  const P = pack.risk.points;
  const f = [];
  const add = (code, points, text) => { if (points) f.push({ code, points, text }); };
  const whz = v.ix.whz;
  if (whz != null) {
    if (whz < -1.75) add('WHZ_NEAR_MAM', P.whzNearMam, `WHZ ${whz} — close to the MAM line`);
    else if (whz < -1.25) add('WHZ_LOW', P.whzLow, `WHZ ${whz} — low`);
  }
  if (ref && whz != null && ref.ix.whz != null) {
    const d = whz - ref.ix.whz;
    if (d <= -0.4) add('WHZ_FALL_BIG', P.whzFallBig, `WHZ fell ${(-d).toFixed(2)} SD in a month`);
    else if (d <= -0.2) add('WHZ_FALL', P.whzFall, `WHZ fell ${(-d).toFixed(2)} SD in a month`);
  }
  if (v.muacMm != null && v.ageMonths >= 6) {
    if (v.muacMm < 130) add('MUAC_LOW', P.muacLow, `MUAC ${v.muacMm} mm (< 130)`);
    if (ref && ref.muacMm != null && v.muacMm - ref.muacMm <= -3) add('MUAC_FALL', P.muacFall, `MUAC down ${ref.muacMm - v.muacMm} mm`);
  }
  if (velocity && velocity.z < -1.04) add('VELOCITY_LOW', P.velocityLow, `Weight gain below WHO 15th centile (${velocity.grams} g over ${velocity.interval})`);
  const sig = signals.find((s) => (s.type === 'DIARRHOEA' || s.type === 'VACCINE_OVERDUE') && s.t <= v.t && v.t - s.t <= pack.signals.windowDays * DAY);
  if (sig) add('SIGNAL', P.signal, sig.type === 'DIARRHOEA' ? 'Diarrhoea in the last 30 days (consented)' : 'Vaccine overdue (consented)');
  if (child.lbw && v.ageMonths < 12) add('LBW', P.lbw, 'Low birth weight, under 12 months');
  if (v.ageMonths < 24) add('UNDER_2', P.under2, 'Under 2 years');
  if (priorEpisodes > 0) add('PRIOR_EPISODE', P.priorEpisode, 'AMBER/RED episode in the last 6 months');
  const m = new Date(v.t).getUTCMonth();
  if (m >= 5 && m <= 8) add('LEAN_SEASON', P.leanSeason, 'Lean / monsoon season (Jun–Sep)');
  const mig = child.migration;
  if (mig && mig.retAt && v.t >= mig.retAt && v.t - mig.retAt <= 60 * DAY) add('RETURNED_MIGRANT', P.returnedMigrant, 'Back from seasonal migration in the last 60 days');
  return { score: f.reduce((s, x) => s + x.points, 0), factors: f };
}
