// Decision rights (Table 3): who sees what. Child names never leave the AWC/sector
// unless a supervisor uses logged "break-glass" access with a stated reason.
export const ROLES = {
  AWW: { label: 'Anganwadi Worker', short: 'AWW', scope: 'awc', names: true, cadence: 'Daily, offline', level: 0 },
  ASHA: { label: 'ASHA (Sahiya)', short: 'ASHA', scope: 'awc', names: true, cadence: 'IVR / SMS tasks', level: 0 },
  MS: { label: 'Mukhya Sevika', short: 'MS', scope: 'sector', names: false, cadence: 'Weekly; RED-A at once', level: 1 },
  CDPO: { label: 'CDPO + Block MO', short: 'CDPO', scope: 'block', names: false, cadence: 'Weekly', level: 2 },
  DPO: { label: 'DPO (ICDS) + CMO', short: 'DPO', scope: 'district', names: false, cadence: 'Monthly convergence', level: 3, kAnon: true },
};

export function inScope(role, scopeId, child, awcById) {
  const awc = awcById[child.awcId];
  if (!awc) return false;
  switch (ROLES[role].scope) {
    case 'awc': return awc.id === scopeId;
    case 'sector': return awc.sectorId === scopeId;
    case 'block': return awc.blockId === scopeId;
    default: return true;
  }
}

export function displayName(child, role, breakGlass) {
  if (ROLES[role].names || breakGlass?.has(child.id)) return child.name;
  return maskId(child.pseudoId);
}
export const maskId = (pid) => `PT··${pid.slice(-4)}`;

/** Small-cell suppression for views above block level. */
export function kAnon(n, role, k = 20) {
  if (!ROLES[role].kAnon) return String(n);
  return n > 0 && n < k ? `<${k}` : String(n);
}
