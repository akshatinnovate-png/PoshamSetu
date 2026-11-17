// ABDM-style consent artefacts for cross-ministry flags ("share flags, not records").
import { DAY } from './util.js';

export const FLAG_DICTIONARY = {
  VACCINE_OVERDUE: { label: 'Vaccine overdue', source: 'U-WIN (MoHFW)', fhir: 'Immunization / ImmunizationRecommendation', minimal: 'antigen code + days overdue' },
  DIARRHOEA: { label: 'Diarrhoea in last 30 days', source: 'ASHA / HMIS (MoHFW) or AWW entry', fhir: 'Condition (SNOMED 62315008)', minimal: 'episode date' },
  LBW: { label: 'Low birth weight (< 2.5 kg)', source: 'RCH portal (MoHFW)', fhir: 'Observation (LOINC 8339-4)', minimal: 'flag only, no weight' },
  HIGH_RISK_PREGNANCY: { label: 'High-risk pregnancy (mother)', source: 'RCH portal (MoHFW)', fhir: 'Flag', minimal: 'flag only, no diagnosis' },
};

export const MODES = {
  ABHA: { label: 'Baal-ABHA via ABDM consent manager', verifiable: true },
  OTP: { label: 'Tracker beneficiary ID + OTP to guardian', verifiable: true },
  ASSISTED: { label: 'Assisted consent (thumbprint) — reconfirm at next VHSND', verifiable: false },
};

export function makeConsent({ id, childId, guardian, mode, grantedAt, days = 180, flags, reconfirmDays = 30 }) {
  return {
    id, childId, guardian, mode,
    purpose: { code: 'CAREMGT', text: 'Care management — early warning of child undernutrition' },
    hiTypes: ['WellnessRecord', 'ImmunizationRecord'],
    hip: 'U-WIN / RCH (MoHFW)', hiu: 'PoshanSetu (MoWCD)',
    flags: flags || Object.keys(FLAG_DICTIONARY),
    grantedAt, expiresAt: grantedAt + days * DAY,
    reconfirmBy: mode === 'ASSISTED' ? grantedAt + reconfirmDays * DAY : null,
    reconfirmedAt: null,
    revokedAt: null,
  };
}

export function consentStatus(c, now) {
  if (!c) return { state: 'NONE', usable: false, why: 'No consent artefact' };
  if (c.revokedAt && c.revokedAt <= now) return { state: 'REVOKED', usable: false, why: 'Guardian revoked consent' };
  if (now > c.expiresAt) return { state: 'EXPIRED', usable: false, why: 'Consent expired — renew at next contact' };
  if (c.mode === 'ASSISTED' && !c.reconfirmedAt && c.reconfirmBy && now > c.reconfirmBy) return { state: 'LAPSED', usable: false, why: 'Assisted consent not reconfirmed at VHSND' };
  return { state: 'ACTIVE', usable: true, why: MODES[c.mode].label };
}

/** Only signals covered by an active artefact reach the rules; the rest are withheld (and logged). */
export function gateSignals(signals, consent, at) {
  const allowed = [], withheld = [];
  for (const s of signals) {
    const st = consentStatus(consent, s.t <= at ? at : s.t);
    const covered = st.usable && consent.flags.includes(s.type) && s.t >= consent.grantedAt - 365 * DAY;
    if (covered) allowed.push({ ...s, consentId: consent.id });
    else withheld.push({ ...s, why: st.usable ? 'Flag type not in consent' : st.why });
  }
  return { allowed, withheld };
}
