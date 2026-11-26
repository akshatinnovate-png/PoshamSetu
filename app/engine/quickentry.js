// Quick entry: turn an Anganwadi worker's free-text notes ("Rohan, 1.2 yrs, 8 kg, 74 cm") into
// measurement records. Two readers produce the same row shape:
//   - parseNotes(): an offline reader (no network, works on stage with no signal);
//   - Groq (an LLM), via groqRequest()/fromGroq(), for messier notes.
// Every row then goes through checkRow(), which never "fixes" a value silently: an impossible value
// blocks saving and the worker is shown what is typical and, where a unit slip explains it, a one-click fix.
import { lmsWfa, lmsLhfa, indices, bivFlags } from './growth.js';
import { GIRL, BOY } from './sim/constants.js';

const DPM = 30.4375;
const NUM = '(\\d+(?:[.,]\\d+)?)';
const num = (s) => Number(String(s).replace(',', '.'));
const GIRLS = new Set([...GIRL, 'Riya', 'Priya', 'Ananya', 'Diya', 'Pooja', 'Sita', 'Gita', 'Neha', 'Kavya', 'Isha', 'Aditi', 'Khushi', 'Meera', 'Radha', 'Soni', 'Puja', 'Kajal', 'Nisha', 'Shreya', 'Sneha', 'Aarohi', 'Saanvi', 'Anika'].map((x) => x.toLowerCase()));
const BOYS = new Set([...BOY, 'Rohan', 'Rahul', 'Aarav', 'Arjun', 'Vivaan', 'Aditya', 'Krishna', 'Ram', 'Shyam', 'Amit', 'Vikas', 'Ankit', 'Manish', 'Deepak', 'Sahil', 'Aryan', 'Ishaan', 'Kabir', 'Vihaan', 'Ayaan', 'Rudra', 'Om'].map((x) => x.toLowerCase()));

/** Guess sex from a first name; null when unsure. */
export function guessSex(name) {
  const f = String(name || '').trim().split(/\s+/)[0].toLowerCase();
  if (GIRLS.has(f)) return 'F';
  if (BOYS.has(f)) return 'M';
  return null;
}

/**
 * Offline reader. One child per line (or separated by ';').
 * @param {string} text
 * @returns {{ raw: string, name: string|null, sex: 'M'|'F'|null, ageMonths: number|null, weightKg: number|null, heightCm: number|null, muacMm: number|null, oedema: boolean, danger: string[], source: string }[]}
 */
export function parseNotes(text) {
  return String(text || '').split(/\n|;/).map((s) => s.trim()).filter(Boolean).map(parseLine).filter((r) => r.name || r.weightKg != null || r.heightCm != null);
}

function parseLine(raw) {
  let s = ' ' + raw.replace(/\s+/g, ' ') + ' ';
  const low = s.toLowerCase();
  const r = { raw, name: null, sex: null, ageMonths: null, weightKg: null, heightCm: null, muacMm: null, oedema: false, danger: [], source: 'offline' };
  // name: the words before the first ':' ',' '-' or digit, minus filler words
  const head = raw.split(/[:,\-–(]|\d/)[0].replace(/\b(name|child|baby|bachcha|बच्चा)\b/gi, '').trim();
  if (head && /[a-zA-Zऀ-ॿ]/.test(head)) r.name = head.split(/\s+/).slice(0, 3).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  // sex
  if (/(^|[\s,(])(girl|female|beti|ladki|लड़की|बेटी|f)(?=[\s,).]|$)/i.test(low)) r.sex = 'F';
  else if (/(^|[\s,(])(boy|male|beta|ladka|लड़का|बेटा)(?=[\s,).]|$)/i.test(low)) r.sex = 'M';
  // age: "1 yr 3 months", "1.2 yrs", "14 months", "age 2"
  const y = low.match(new RegExp(NUM + '\\s*(?:y|yr|yrs|year|years|saal|sal|varsh|वर्ष|साल)(?![a-z])'));
  const mo = low.match(new RegExp(NUM + '\\s*(?:mo|mos|mon|month|months|mahina|mahine|maah|महीने|महीना|माह)(?![a-z])'));
  if (y || mo) r.ageMonths = Math.round(((y ? num(y[1]) * 12 : 0) + (mo ? num(mo[1]) : 0)) * 10) / 10;
  else { const a = low.match(new RegExp('(?:age|aayu|umar|उम्र)\\s*[:=]?\\s*' + NUM)); if (a) { const v = num(a[1]); r.ageMonths = v <= 5 ? Math.round(v * 120) / 10 : v; } }
  // weight
  let w = low.match(new RegExp(NUM + '\\s*(?:kg|kgs|kilo|kilos|kilogram|kilograms|किलो)(?![a-z])'));
  if (w) r.weightKg = num(w[1]);
  else if ((w = low.match(new RegExp(NUM + '\\s*(?:g|gm|gms|gram|grams|ग्राम)(?![a-z])')))) r.weightKg = num(w[1]) / 1000;
  else if ((w = low.match(new RegExp(NUM + '\\s*(?:lb|lbs|pound|pounds)(?![a-z])')))) r.weightKg = Math.round(num(w[1]) * 0.4536 * 100) / 100;
  else if ((w = low.match(new RegExp('(?:weight|wt|wajan|vajan|वजन)\\s*[:=]?\\s*' + NUM)))) r.weightKg = num(w[1]);
  // MUAC (read before height so "muac 12 cm" is not taken as height)
  const mu = low.match(new RegExp('(?:muac|arm)\\s*[:=]?\\s*' + NUM + '\\s*(mm|cm)?'));
  if (mu) { const v = num(mu[1]); r.muacMm = mu[2] === 'cm' || (!mu[2] && v < 30) ? Math.round(v * 10) : v; s = s.replace(new RegExp(mu[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' '); }
  const low2 = s.toLowerCase();
  // height / length
  let ht = low2.match(new RegExp(NUM + '\\s*(?:cm|cms|centimet(?:er|re)s?|सेमी)(?![a-z])'));
  if (ht) r.heightCm = num(ht[1]);
  else if ((ht = low2.match(new RegExp(NUM + '\\s*mm(?![a-z])')))) r.heightCm = num(ht[1]) / 10;
  else if ((ht = low2.match(/(\d(?:[.,]\d+)?)\s*(?:m|metre|meter|metres|meters)(?![a-z])/))) r.heightCm = Math.round(num(ht[1]) * 1000) / 10;
  else if ((ht = low2.match(new RegExp(NUM + '\\s*(?:in|inch|inches)(?![a-z])')))) r.heightCm = Math.round(num(ht[1]) * 25.4) / 10;
  else if ((ht = low2.match(new RegExp('(?:height|ht|length|lambai|लंबाई)\\s*[:=]?\\s*' + NUM)))) r.heightCm = num(ht[1]);
  // oedema and danger signs
  if (/(oedema|edema|swelling|swollen|sujan|soojan|सूजन)/.test(low) && !/(no|without|nahi|नहीं)\s+(oedema|edema|swelling|sujan)/.test(low)) r.oedema = true;
  if (/vomit|ulti|उल्टी/.test(low)) r.danger.push('VOMITING');
  if (/(very weak|lethargic|sleepy|sust|सुस्त)/.test(low)) r.danger.push('LETHARGIC');
  if (/(not eating|unable to feed|can'?t feed|nahi kha|नहीं खा)/.test(low)) r.danger.push('UNABLE_TO_FEED');
  if (!r.sex) r.sex = guessSex(r.name);
  return r;
}

/** The request body for Groq's OpenAI-compatible chat API (the key is added by the caller, never here). */
export function groqRequest(text, model = 'llama-3.3-70b-versatile') {
  return {
    model, temperature: 0, response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You turn an Indian Anganwadi worker\'s notes (English, Hindi or Hinglish) into JSON. Return exactly {"children":[{"name":string|null,"sex":"M"|"F"|null,"ageMonths":number|null,"weightKg":number|null,"heightCm":number|null,"muacMm":number|null,"oedema":boolean,"danger":string[]}]}, one object per child in the order written. Convert units only: years to months (x12), grams to kg, metres to cm, inches to cm, MUAC in cm to mm. Never invent a value that is not written: use null. Never correct a value that looks impossible: copy it in the requested unit, a human will review it. sex: only if stated, or if the first name is clearly a boy\'s or girl\'s name. danger may contain VOMITING, LETHARGIC, UNABLE_TO_FEED when the note says so. oedema is true only for swelling of both feet.' },
      { role: 'user', content: String(text).slice(0, 4000) },
    ],
  };
}

/** Normalise Groq's JSON reply into rows; anything malformed is dropped, never trusted blindly. */
export function fromGroq(json, text) {
  const lines = String(text || '').split(/\n|;/).map((s) => s.trim()).filter(Boolean);
  const list = Array.isArray(json?.children) ? json.children : [];
  const n = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
  return list.slice(0, 50).map((c, i) => ({
    raw: lines[i] || '', name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 60) : null,
    sex: c.sex === 'M' || c.sex === 'F' ? c.sex : null, ageMonths: n(c.ageMonths), weightKg: n(c.weightKg), heightCm: n(c.heightCm), muacMm: n(c.muacMm),
    oedema: c.oedema === true, danger: Array.isArray(c.danger) ? c.danger.filter((d) => ['VOMITING', 'LETHARGIC', 'UNABLE_TO_FEED'].includes(d)) : [],
    source: 'groq',
  }));
}

/** Find the child a note refers to, among the children the user may see. */
export function matchChild(name, kids) {
  if (!name) return { match: null, candidates: [] };
  const q = name.toLowerCase().trim(), first = q.split(/\s+/)[0];
  const exact = kids.filter((k) => k.name.toLowerCase() === q);
  if (exact.length === 1) return { match: exact[0], candidates: exact };
  const byFirst = kids.filter((k) => k.name.toLowerCase().split(/\s+/)[0] === first);
  if (byFirst.length === 1) return { match: byFirst[0], candidates: byFirst };
  return { match: null, candidates: byFirst.slice(0, 5) };
}

/**
 * Check one row. Returns issues; any issue with level 'block' must be fixed before saving.
 * @param {{ sex: 'M'|'F'|null, ageMonths: number|null, weightKg: number|null, heightCm: number|null, muacMm: number|null }} r
 */
export function checkRow(r) {
  const issues = [];
  const block = (field, text, fix) => issues.push({ level: 'block', field, text, fix });
  const warn = (field, text, fix) => issues.push({ level: 'warn', field, text, fix });
  if (r.ageMonths == null) block('ageMonths', 'Age is missing. Type it like “1.2 yrs” or “14 months”.');
  else if (r.ageMonths < 0 || r.ageMonths > 60) block('ageMonths', `Age ${fmt(r.ageMonths)} months is outside 0–5 years. PoshanSetu is for children under five.`);
  if (r.weightKg == null && r.heightCm == null && r.muacMm == null) block('weightKg', 'No measurement found. Add weight (kg), height (cm) or MUAC.');
  if (!r.sex) block('sex', 'Boy or girl? Growth standards differ, so choose one.');
  if (r.ageMonths == null || r.ageMonths < 0 || r.ageMonths > 60) return issues;
  const sex = r.sex || 'F';
  const days = r.ageMonths * DPM;
  const wM = lmsWfa(sex, days)?.M, hM = lmsLhfa(sex, days)?.M;
  const ix = indices(sex, days, { weightKg: r.weightKg, heightCm: r.heightCm, lying: r.ageMonths < 24 });
  const okW = (v) => { const z = indices(sex, days, { weightKg: v }).waz; return z != null && z >= -5 && z <= 4; };
  const okH = (v) => { const z = indices(sex, days, { heightCm: v }).haz; return z != null && z >= -5 && z <= 5; };
  if (r.weightKg != null && (ix.waz == null || ix.waz < -6 || ix.waz > 5)) {
    const fix = [r.weightKg / 10, r.weightKg / 1000, r.weightKg * 10].map((v) => Math.round(v * 10) / 10).find(okW);
    block('weightKg', `${fmt(r.weightKg)} kg is not possible at ${ageText(r.ageMonths)} (typical: about ${fmt(wM)} kg).${fix ? ` Did you mean ${fix} kg?` : ' Please weigh again.'}`, fix ? { field: 'weightKg', value: fix } : undefined);
  }
  if (r.heightCm != null && (ix.haz == null || ix.haz < -6 || ix.haz > 6)) {
    const fix = [r.heightCm / 10, r.heightCm * 100, r.heightCm * 2.54].map((v) => Math.round(v * 10) / 10).find(okH);
    block('heightCm', `${fmt(r.heightCm)} cm is not possible at ${ageText(r.ageMonths)} (typical: about ${fmt(hM)} cm).${fix ? ` Did you mean ${fix} cm?` : ' Please measure again.'}`, fix ? { field: 'heightCm', value: fix } : undefined);
  }
  if (r.muacMm != null && (r.muacMm < 70 || r.muacMm > 250)) {
    const fix = r.muacMm * 10 >= 70 && r.muacMm * 10 <= 250 ? r.muacMm * 10 : undefined;
    block('muacMm', `MUAC ${fmt(r.muacMm)} mm is not possible (normal range about 110–170 mm).${fix ? ` Did you mean ${fix} mm (${r.muacMm} cm)?` : ''}`, fix ? { field: 'muacMm', value: fix } : undefined);
  }
  if (r.muacMm != null && r.ageMonths < 6) warn('muacMm', 'MUAC is not used under 6 months; it will be stored but not used by the rules.');
  if (!issues.some((i) => i.level === 'block') && bivFlags(ix).includes('whz')) block('heightCm', 'Weight and height together are not possible. Check both, then save.');
  return issues;
}

const fmt = (v) => (v == null ? '—' : Math.round(v * 10) / 10);
const ageText = (m) => (m < 24 ? `${Math.round(m)} months` : `${Math.round((m / 12) * 10) / 10} years`);
