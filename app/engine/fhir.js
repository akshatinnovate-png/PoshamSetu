// FHIR R4 mapping (ABDM WellnessRecord / flag exchange). PoshanSetu is HIP for growth data and
// HIU for minimal health flags. Codes: LOINC for anthropometry, a published PoshanSetu
// CodeSystem for derived flags (the NDGFP data dictionary).
import { isoDate } from './util.js';

const PS_CS = 'https://poshansetu.in/fhir/CodeSystem/ps-flags';
const obs = (id, pid, t, code, display, value, unit, ucum) => ({
  resourceType: 'Observation', id, status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
  code: { coding: [{ system: 'http://loinc.org', code, display }] },
  subject: { reference: `Patient/${pid}` },
  effectiveDateTime: new Date(t).toISOString(),
  valueQuantity: { value, unit, system: 'http://unitsofmeasure.org', code: ucum },
});

export function wellnessBundle(child, visits, triage, consent) {
  const pid = child.pseudoId;
  /** @type {import('./types.js').FhirResource[]} */
  const entries = [{
    resourceType: 'Patient', id: pid,
    identifier: [{ system: 'https://poshantracker.in/beneficiary', value: child.pseudoId }],
    gender: child.sex === 'F' ? 'female' : 'male', birthDate: isoDate(child.dob),
  }];
  visits.slice(-3).forEach((v, i) => {
    if (v.weightKg) entries.push(obs(`w${i}`, pid, v.t, '29463-7', 'Body weight', v.weightKg, 'kg', 'kg'));
    if (v.heightCm) entries.push(obs(`h${i}`, pid, v.t, '8302-2', 'Body height', v.heightCm, 'cm', 'cm'));
    if (v.muacMm) entries.push(obs(`m${i}`, pid, v.t, '56072-2', 'Mid upper arm circumference', v.muacMm, 'mm', 'mm'));
  });
  if (triage) {
    entries.push({
      resourceType: 'Flag', id: 'tier', status: triage.tier === 'GREEN' ? 'inactive' : 'active',
      category: [{ coding: [{ system: PS_CS, code: 'nutrition-risk' }] }],
      code: { coding: [{ system: PS_CS, code: triage.tier, display: `PoshanSetu tier ${triage.tier}` }], text: triage.reasons.filter((r) => r.tier === triage.tier).map((r) => r.text).join('; ') },
      subject: { reference: `Patient/${pid}` },
      period: { start: new Date(triage.t).toISOString() },
      meta: { tag: [{ system: PS_CS + '/rule-pack', code: triage.packVersion }] },
    });
  }
  if (consent) {
    entries.push({
      resourceType: 'Consent', id: consent.id, status: 'active',
      scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }] },
      category: [{ coding: [{ system: 'http://loinc.org', code: '59284-0' }] }],
      patient: { reference: `Patient/${pid}` },
      dateTime: new Date(consent.grantedAt).toISOString(),
      provision: {
        type: 'permit', period: { start: new Date(consent.grantedAt).toISOString(), end: new Date(consent.expiresAt).toISOString() },
        purpose: [{ system: 'https://abdm.gov.in/purpose', code: consent.purpose.code }],
        code: consent.flags.map((f) => ({ coding: [{ system: PS_CS, code: f }] })),
      },
    });
  }
  return {
    resourceType: 'Bundle', type: 'collection', timestamp: new Date().toISOString(),
    meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/WellnessRecord'] },
    entry: entries.map((r) => ({ fullUrl: `urn:uuid:${r.resourceType.toLowerCase()}-${r.id}`, resource: r })),
  };
}
