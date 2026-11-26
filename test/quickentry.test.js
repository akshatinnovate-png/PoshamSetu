import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotes, checkRow, matchChild, fromGroq, groqRequest } from '../app/engine/quickentry.js';

test('offline reader understands everyday notes (English, Hinglish, units)', () => {
  const [a, b, c, d] = parseNotes('rohan: age 1.2 yrs, weight 8 kgs, height 74 cm\nPriya 18 months 7.9kg 76cm muac 11.8 cm\nSomari, girl, 3 saal, wajan 11.2, lambai 88, sujan both feet\nbaby Mungli 10 mahine 6800 g 0.68 m vomiting');
  assert.deepEqual([a.name, a.sex, a.ageMonths, a.weightKg, a.heightCm], ['Rohan', 'M', 14.4, 8, 74]);
  assert.deepEqual([b.name, b.sex, b.ageMonths, b.muacMm, b.heightCm], ['Priya', 'F', 18, 118, 76]);
  assert.deepEqual([c.sex, c.ageMonths, c.weightKg, c.heightCm, c.oedema], ['F', 36, 11.2, 88, true]);
  assert.deepEqual([d.ageMonths, d.weightKg, d.heightCm, d.danger], [10, 6.8, 68, ['VOMITING']]);
});

test('impossible values block saving, with a one-click fix when a unit slip explains them', () => {
  const tall = checkRow({ sex: 'M', ageMonths: 14.4, weightKg: 8, heightCm: 300, muacMm: null });
  assert.ok(tall.some((i) => i.level === 'block' && i.field === 'heightCm' && /not possible/.test(i.text)));
  const heavy = checkRow({ sex: 'M', ageMonths: 27, weightKg: 92, heightCm: 84, muacMm: null });
  assert.equal(heavy.find((i) => i.field === 'weightKg').fix.value, 9.2);
  const muac = checkRow({ sex: 'F', ageMonths: 18, weightKg: 7.9, heightCm: 76, muacMm: 11.8 });
  assert.equal(muac.find((i) => i.field === 'muacMm').fix.value, 118);
  assert.deepEqual(checkRow({ sex: 'F', ageMonths: 18, weightKg: 7.9, heightCm: 76, muacMm: 118 }), []);
  assert.ok(checkRow({ sex: null, ageMonths: 18, weightKg: 7.9, heightCm: 76, muacMm: null }).some((i) => i.field === 'sex'));
});

test('names match the register; Groq replies are normalised and never trusted blindly', () => {
  const kids = [{ id: 'C1', name: 'Rohan Sundi' }, { id: 'C2', name: 'Priya Hansda' }, { id: 'C3', name: 'Priya Bage' }];
  assert.equal(matchChild('rohan', kids).match.id, 'C1');
  assert.equal(matchChild('priya', kids).match, null);
  assert.equal(matchChild('priya', kids).candidates.length, 2);
  const rows = fromGroq({ children: [{ name: 'Rohan', sex: 'boy', ageMonths: '14', weightKg: 8, heightCm: 'x', danger: ['VOMITING', 'rm -rf'] }] }, 'Rohan 14 mo 8 kg');
  assert.deepEqual([rows[0].sex, rows[0].ageMonths, rows[0].heightCm, rows[0].danger], [null, 14, null, ['VOMITING']]);
  const req = groqRequest('x');
  assert.equal(req.response_format.type, 'json_object');
  assert.ok(!JSON.stringify(req).includes('Bearer'));
});

test('a gravely wasted child (WHZ below −5) is confirmable, then flagged RED — never quarantined after a re-measure', async () => {
  const { evaluate } = await import('../app/engine/triage.js');
  const { DEFAULT_PACK } = await import('../app/engine/rulepack.js');
  const [r] = parseNotes('rohan, male, 6 kgs,78.7 cm cm sam, 1.2 yrs.. muac 130');
  assert.deepEqual([r.name, r.sex, r.ageMonths, r.weightKg, r.heightCm, r.muacMm], ['Rohan', 'M', 14.4, 6, 78.7, 130]);
  const issues = checkRow(r);
  assert.ok(!issues.some((i) => i.level === 'block'), 'not blocked outright');
  assert.ok(issues.some((i) => i.level === 'confirm'), 'asks for a re-measure');
  const now = Date.UTC(2026, 10, 17);
  const child = { id: 'N1', sex: 'M', dob: now - 14.4 * 30.4375 * 864e5, lbw: false, awcId: 'X' };
  const ev = (confirmed) => evaluate(child, [{ id: 'e', t: now, weightKg: 6, heightCm: 78.7, muacMm: 130, lying: true, confirmed }], [], DEFAULT_PACK, { feedR: 100 }).current;
  assert.equal(ev(false).tier, 'WATCH', 'unconfirmed: quarantined, re-measure');
  assert.match(ev(true).tier, /^RED/, 'confirmed: urgent care');
  assert.equal(checkRow({ sex: 'M', ageMonths: 27, weightKg: 92, heightCm: 84 }).find((i) => i.field === 'weightKg').level, 'block', 'typos still blocked');
});
