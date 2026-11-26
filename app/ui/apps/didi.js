// "Didi screen": the Anganwadi worker's own screen, for workers who read little.
// Hindi first (one tap for English), pictures and colours first, one question per screen, a big keypad,
// a purpose line under every number, and a speaker button that reads each screen aloud.
// Same engine and the same safety checks as everywhere else in PoshanSetu.
import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { ageAt, DAY } from '../common.js';
import { evaluate } from '../../engine/triage.js';
import { checkRow } from '../../engine/quickentry.js';

const LS = 'ps-didi-lang';
const DEVA = "'Noto Sans Devanagari', 'Inter Tight', sans-serif";
const COLOR = {
  RED_A: { bg: '#c8102e', fg: '#ffffff', icon: 'hospital', hi: 'आज ही अस्पताल ले जाएँ', en: 'Take to the hospital today', subHi: '24 घंटे के अंदर', subEn: 'within 24 hours' },
  RED_B: { bg: '#f0542d', fg: '#1f1b1d', icon: 'bowl', hi: 'आंगनवाड़ी में इलाज शुरू करें', en: 'Start treatment at the Anganwadi', subHi: '3 दिन में भूख जाँच, 5 दिन में डॉक्टर', subEn: 'appetite test in 3 days, doctor by day 5' },
  AMBER: { bg: '#f2a20c', fg: '#1f1b1d', icon: 'house', hi: '7 दिन में घर जाएँ — सहिया के साथ', en: 'Visit the home within 7 days, with the ASHA', subHi: 'साथ में या एक के बाद एक', subEn: 'together or one after the other' },
  WATCH: { bg: '#3f7fe0', fg: '#ffffff', icon: 'scale', hi: '15 दिन में फिर से वज़न करें', en: 'Weigh again in 2 weeks', subHi: 'पक्का करने के लिए', subEn: 'to make sure' },
  GREEN: { bg: '#1f9d6b', fg: '#ffffff', icon: 'check', hi: 'बच्चा ठीक बढ़ रहा है', en: 'The child is growing well', subHi: 'अगले महीने फिर वज़न', subEn: 'weigh again next month' },
};
const ORDER = ['RED_A', 'RED_B', 'AMBER', 'WATCH', 'GREEN'];

// Reasons in simple words (no WHZ / SD jargon).
const WHY = {
  OEDEMA: ['दोनों पैरों में सूजन', 'swelling of both feet'],
  DANGER_VOMITING: ['सब कुछ उल्टी कर देता है', 'vomits everything'], DANGER_LETHARGIC: ['बहुत कमज़ोर या सुस्त', 'very weak or sleepy'], DANGER_UNABLE_TO_FEED: ['खा-पी नहीं पा रहा', 'cannot eat or drink'],
  APPETITE_FAIL: ['भूख जाँच में खाना नहीं खाया', 'did not eat in the appetite test'],
  INFANT_WASTED: ['छोटा शिशु, बहुत दुबला', 'young baby, very thin'],
  R3_MUAC_SAM: ['बाँह का पट्टा लाल', 'arm band is red'], WHZ_SAM: ['लंबाई के हिसाब से वज़न बहुत कम', 'weight is far too low for the height'],
  MAM_CONFIRMED: ['बच्चा दुबला है (दोबारा नाप में भी)', 'the child is thin (confirmed)'], MAM_UNCONFIRMED: ['बच्चा दुबला लगता है — पक्का करने के लिए फिर नापें', 'looks thin: measure again to be sure'],
  R2_UNCONFIRMED: ['वज़न एक महीने में घटा', 'weight fell in one month'], R2_CONFIRMED: ['वज़न घट रहा है (पक्का)', 'weight is falling (confirmed)'], R2_SUSTAINED: ['दो महीने से वज़न घट रहा है', 'weight has fallen two months running'],
  INFANT_FALTERING: ['शिशु का वज़न ठीक से नहीं बढ़ रहा', 'the baby is not gaining enough weight'], INFANT_LOW_GAIN: ['शिशु का वज़न कम बढ़ा', 'the baby gained too little'], VELOCITY_2M: ['दो महीने से वज़न नहीं बढ़ा', 'no weight gain for two months'],
  TREND_PLUS_SIGNAL: ['वज़न घट रहा है और दस्त या टीका छूटा', 'weight falling plus diarrhoea or a missed vaccine'],
  FORECAST: ['ऐसे ही चला तो 2 महीने में बच्चा कमज़ोर हो जाएगा', 'at this rate the child will become thin within 2 months'],
  WEAK_SIGNALS: ['कई छोटे खतरे एक साथ', 'several small warning signs together'], WATCH_REPEAT: ['दो बार से निगरानी में', 'on watch twice in a row'],
};
const whyText = (r, lang) => { if (!r) return ''; if (typeof r === 'string') return r; const code = r.code || ''; const w = WHY[code]; return w ? w[lang === 'hi' ? 0 : 1] : code.startsWith('DQ_') ? (lang === 'hi' ? 'नाप में गड़बड़ — फिर से नापें' : 'measurement looks wrong: measure again') : (r.text || ''); };

// Pictures (simple, bold, readable at a glance).
const PIC = {
  scale: '<rect x="14" y="40" width="52" height="26" rx="4" fill="#fff" stroke="#1f1b1d" stroke-width="5"/><circle cx="40" cy="53" r="7" fill="#e94fbf"/><path d="M28 40 L34 22 H46 L52 40" fill="none" stroke="#1f1b1d" stroke-width="5"/>',
  house: '<path d="M12 40 L40 16 L68 40" fill="none" stroke="#1f1b1d" stroke-width="6" stroke-linejoin="round"/><rect x="20" y="38" width="40" height="30" fill="#fff" stroke="#1f1b1d" stroke-width="5"/><rect x="34" y="50" width="12" height="18" fill="#e94fbf"/>',
  kids: '<circle cx="28" cy="26" r="9" fill="#fff" stroke="#1f1b1d" stroke-width="5"/><circle cx="54" cy="30" r="7" fill="#fff" stroke="#1f1b1d" stroke-width="5"/><path d="M14 66 C14 46 42 46 42 66" fill="#f6a3b7" stroke="#1f1b1d" stroke-width="5"/><path d="M42 66 C42 50 66 50 66 66" fill="#d3e8fb" stroke="#1f1b1d" stroke-width="5"/>',
  ruler: '<rect x="30" y="8" width="20" height="64" fill="#fff" stroke="#1f1b1d" stroke-width="5"/><path d="M30 20 H40 M30 32 H44 M30 44 H40 M30 56 H44" stroke="#1f1b1d" stroke-width="4"/>',
  band: '<rect x="8" y="30" width="64" height="20" fill="#fff" stroke="#1f1b1d" stroke-width="5"/><rect x="11" y="33" width="20" height="14" fill="#c8102e"/><rect x="31" y="33" width="12" height="14" fill="#f2c80c"/><rect x="43" y="33" width="26" height="14" fill="#1f9d6b"/>',
  feet: '<ellipse cx="28" cy="44" rx="11" ry="20" fill="#f6a3b7" stroke="#1f1b1d" stroke-width="5"/><ellipse cx="54" cy="44" rx="11" ry="20" fill="#f6a3b7" stroke="#1f1b1d" stroke-width="5"/><circle cx="28" cy="50" r="4" fill="#1f1b1d"/><circle cx="54" cy="50" r="4" fill="#1f1b1d"/>',
  danger: '<path d="M40 10 L72 66 H8 Z" fill="#f2a20c" stroke="#1f1b1d" stroke-width="5" stroke-linejoin="round"/><rect x="36" y="28" width="8" height="20" fill="#1f1b1d"/><rect x="36" y="53" width="8" height="8" fill="#1f1b1d"/>',
  hospital: '<rect x="12" y="20" width="56" height="48" fill="#fff" stroke="#1f1b1d" stroke-width="5"/><rect x="34" y="28" width="12" height="32" fill="#c8102e"/><rect x="24" y="38" width="32" height="12" fill="#c8102e"/>',
  bowl: '<path d="M12 38 H68 C66 58 54 66 40 66 C26 66 14 58 12 38 Z" fill="#fff" stroke="#1f1b1d" stroke-width="5"/><path d="M26 30 C26 22 34 22 34 14 M44 30 C44 22 52 22 52 14" stroke="#1f1b1d" stroke-width="4" fill="none"/>',
  check: '<circle cx="40" cy="40" r="28" fill="#fff" stroke="#1f1b1d" stroke-width="5"/><path d="M26 41 L36 51 L56 30" fill="none" stroke="#1f9d6b" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
  plus: '<circle cx="40" cy="40" r="28" fill="#fff" stroke="#1f1b1d" stroke-width="5"/><path d="M40 26 V54 M26 40 H54" stroke="#e94fbf" stroke-width="8" stroke-linecap="round"/>',
  boy: '<circle cx="40" cy="28" r="14" fill="#c98b5f" stroke="#1f1b1d" stroke-width="4"/><path d="M26 22 C30 10 50 10 54 22" fill="#2a1d1a"/><path d="M16 72 C16 48 64 48 64 72" fill="#7fb8e6" stroke="#1f1b1d" stroke-width="4"/>',
  girl: '<circle cx="40" cy="28" r="14" fill="#c98b5f" stroke="#1f1b1d" stroke-width="4"/><path d="M24 30 C20 8 60 8 56 30 L58 40 L52 30 C50 18 30 18 28 30 L22 40 Z" fill="#2a1d1a"/><path d="M16 72 C16 48 64 48 64 72" fill="#f6a3b7" stroke="#1f1b1d" stroke-width="4"/>',
  vomit: '<circle cx="34" cy="32" r="16" fill="#c98b5f" stroke="#1f1b1d" stroke-width="4"/><path d="M46 38 C56 40 62 50 60 62" stroke="#1f9d6b" stroke-width="7" fill="none" stroke-linecap="round"/>',
  sleepy: '<circle cx="36" cy="40" r="18" fill="#c98b5f" stroke="#1f1b1d" stroke-width="4"/><path d="M26 38 H32 M40 38 H46" stroke="#1f1b1d" stroke-width="4"/><text x="54" y="26" font-size="16" font-weight="700" fill="#3f7fe0">z z</text>',
  noeat: '<path d="M14 40 H66 C64 58 54 64 40 64 C26 64 16 58 14 40 Z" fill="#fff" stroke="#1f1b1d" stroke-width="5"/><path d="M14 14 L66 66" stroke="#c8102e" stroke-width="7"/>',
};
const pic = (k, size = 80) => h('div', { html: `<svg viewBox="0 0 80 80" width="${size}" height="${size}" aria-hidden="true">${PIC[k] || ''}</svg>`, style: { flex: 'none', lineHeight: 0 } });

export default {
  id: 'didi', title: 'Didi screen — for the Anganwadi worker', icon: ICONS.phone, dock: 'Didi screen', desk: 'Didi screen', size: [1180, 800], key: 'd',
  mount(ctx) {
    ctx.win.el.classList.add('max');
    store.setRole('AWW', store.defaultScope('AWW'));
    let lang = (() => { try { return localStorage.getItem(LS) || 'hi'; } catch { return 'hi'; } })();
    let view = 'home', kidId = null, f = null, stepI = 0, done = null, sayNow = '';
    const T = (hi, en) => (lang === 'hi' ? hi : en);
    const awc = () => store.awcById[store.scope];
    const kids = () => store.children().filter((c) => c.awcId === store.scope).sort((a, b) => ORDER.indexOf(a.current?.tier || 'GREEN') - ORDER.indexOf(b.current?.tier || 'GREEN') || a.name.localeCompare(b.name));
    const openTasks = () => store.scopedTasks().filter((t) => store.esc(t).open).sort((a, b) => ORDER.indexOf(a.tier) - ORDER.indexOf(b.tier) || a.dueAt - b.dueAt);
    const firstName = (n) => String(n || '').split(' ')[0];

    function speak(text) {
      try {
        const ss = window.speechSynthesis; if (!ss || !text) return;
        ss.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voices = ss.getVoices();
        const v = lang === 'hi' ? voices.find((x) => /^hi/i.test(x.lang)) : voices.find((x) => /^en/i.test(x.lang));
        if (v) u.voice = v; u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; u.rate = 0.9;
        ss.speak(u);
      } catch { /* no speech on this computer */ }
    }
    ctx.onCleanup(() => { try { window.speechSynthesis?.cancel(); } catch { /* */ } });

    // ---------- shared pieces ----------
    const bigBtn = (label, onclick, opt = {}) => h('button', { onclick, disabled: opt.disabled, style: { fontFamily: DEVA, fontWeight: 800, fontSize: opt.size || '26px', padding: opt.pad || '16px 28px', background: opt.bg || 'var(--hot)', color: opt.fg || 'var(--ink)', border: '3px solid var(--ink)', boxShadow: '5px 5px 0 var(--ink)', cursor: 'pointer', opacity: opt.disabled ? 0.4 : 1 } }, label);
    const purpose = (hi, en) => h('div', { style: { fontSize: '19px', color: '#3a3236', background: '#fff8d6', borderLeft: '6px solid #f2a20c', padding: '8px 12px', maxWidth: '760px' } }, h('b', null, T('क्यों: ', 'Why: ')), T(hi, en));
    function header(title, back) {
      return h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 18px', background: 'var(--ink)', color: '#fff' } },
        back ? h('button', { onclick: back, style: { fontSize: '22px', fontWeight: 800, padding: '8px 18px', background: '#fff', color: 'var(--ink)', border: '3px solid #fff', cursor: 'pointer', fontFamily: DEVA } }, T('← वापस', '← Back')) : null,
        h('div', { style: { fontSize: '26px', fontWeight: 800, flex: 1, fontFamily: DEVA } }, title),
        h('button', { title: T('सुनें', 'Listen'), onclick: () => speak(sayNow), style: { fontSize: '26px', padding: '6px 16px', background: '#f2a20c', border: '3px solid #fff', cursor: 'pointer' } }, '🔊'),
        h('button', { onclick: () => { lang = lang === 'hi' ? 'en' : 'hi'; try { localStorage.setItem(LS, lang); } catch { /* */ } render(); }, style: { fontSize: '18px', fontWeight: 700, padding: '8px 14px', background: '#fff', color: 'var(--ink)', border: '3px solid #fff', cursor: 'pointer', fontFamily: DEVA } }, lang === 'hi' ? 'English' : 'हिंदी'));
    }
    const page = (...kids) => h('div', { style: { padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: '18px', fontFamily: DEVA, background: 'var(--paper)', minHeight: '100%', boxSizing: 'border-box' } }, ...kids);

    // ---------- home ----------
    function home() {
      const n = openTasks().length;
      sayNow = T(`नमस्ते ${firstName(awc()?.aww)} दीदी। आज ${n} बच्चों से मिलना है। बच्चे का वज़न लिखने के लिए बीच वाला बटन दबाएँ।`, `Hello ${firstName(awc()?.aww)}. You have ${n} children to visit today. To write a child's weight, press the middle button.`);
      const tile = (k, title, sub, why, onclick, badge) => h('button', { onclick, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '22px 16px', background: '#fff', border: '3px solid var(--ink)', boxShadow: '6px 6px 0 var(--ink)', cursor: 'pointer', fontFamily: DEVA, position: 'relative' } },
        badge != null ? h('span', { style: { position: 'absolute', top: '10px', right: '12px', fontSize: '28px', fontWeight: 800, background: badge ? '#c8102e' : '#1f9d6b', color: '#fff', minWidth: '48px', padding: '2px 10px' } }, String(badge)) : null,
        pic(k, 110),
        h('div', { style: { fontSize: '30px', fontWeight: 800, lineHeight: 1.15 } }, title),
        h('div', { style: { fontSize: '18px', color: '#3a3236' } }, sub),
        h('div', { style: { fontSize: '16px', color: '#6d6266', borderTop: '2px dashed #c9bfc3', paddingTop: '8px', width: '100%' } }, why));
      return [header(T(`नमस्ते, ${firstName(awc()?.aww)} दीदी`, `Hello, ${firstName(awc()?.aww)}`)), page(
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '22px' } },
          tile('house', T('आज किससे मिलना है', 'Who to visit today'), T(`${n} बच्चे`, `${n} children`), T('जिन बच्चों को आपकी ज़रूरत है', 'children who need you now'), () => go('visits'), n),
          tile('scale', T('वज़न लिखें', 'Write a weight'), T('एक-एक करके', 'one child at a time'), T('हर महीने वज़न से कमज़ोरी जल्दी पता चलती है', 'weighing every month catches weakness early'), () => go('pick')),
          tile('kids', T('मेरे सारे बच्चे', 'All my children'), T(`${kids().length} बच्चे`, `${kids().length} children`), T('हर बच्चे का रंग देखें', 'see each child’s colour'), () => go('kids'))),
        h('div', { style: { fontSize: '20px', fontWeight: 800, marginTop: '6px' } }, T('रंगों का मतलब', 'What the colours mean')),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' } }, ORDER.map((t) => h('div', { style: { background: COLOR[t].bg, color: COLOR[t].fg, border: '3px solid var(--ink)', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' } },
          h('div', { style: { background: '#fff', borderRadius: '50%', padding: '4px', lineHeight: 0 } }, pic(COLOR[t].icon, 48)),
          h('div', { style: { fontWeight: 800, fontSize: '17px', lineHeight: 1.2 } }, T(COLOR[t].hi, COLOR[t].en)))))) ];
    }

    // ---------- visits ----------
    function visits() {
      const list = openTasks();
      sayNow = list.length ? T(`आज ${list.length} बच्चों से मिलना है। सबसे ऊपर वाला सबसे ज़रूरी है।`, `${list.length} children to visit. The top one is the most urgent.`) : T('आज किसी से मिलना नहीं है। बहुत अच्छा!', 'No visits today. Well done!');
      return [header(T('आज किससे मिलना है', 'Who to visit today'), () => go('home')), page(
        purpose('सबसे ऊपर वाला बच्चा सबसे ज़रूरी है। मिलने के बाद हरा बटन दबाएँ।', 'The child at the top is the most urgent. After the visit, press the green button.'),
        !list.length ? h('div', { style: { fontSize: '28px', fontWeight: 800, textAlign: 'center', padding: '40px' } }, pic('check', 120), T('आज किसी से मिलना नहीं है ✓', 'No visits needed today ✓')) : null,
        ...list.map((t) => {
          const c = store.childById[t.childId], col = COLOR[t.tier], e = store.esc(t);
          const days = Math.ceil((t.dueAt - store.now) / DAY);
          const mine = t.closures.some((x) => x.by === 'AWW'), asha = t.closures.some((x) => x.by === 'ASHA');
          return h('div', { style: { display: 'flex', alignItems: 'stretch', border: '3px solid var(--ink)', boxShadow: '5px 5px 0 var(--ink)', background: '#fff' } },
            h('div', { style: { background: col.bg, padding: '12px', display: 'flex', alignItems: 'center' } }, h('div', { style: { background: '#fff', borderRadius: '50%', padding: '6px', lineHeight: 0 } }, pic(col.icon, 64))),
            h('div', { style: { flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '4px' } },
              h('div', { style: { fontSize: '28px', fontWeight: 800 } }, c.name, h('span', { style: { fontSize: '18px', fontWeight: 400, color: '#6d6266' } }, `  ${c.sex === 'F' ? T('लड़की', 'girl') : T('लड़का', 'boy')} · ${ageWords(ageAt(c, store.now))}`)),
              h('div', { style: { fontSize: '22px', fontWeight: 700 } }, T(col.hi, col.en)),
              h('div', { style: { fontSize: '18px', color: '#3a3236' } }, `${T('क्यों', 'Why')}: ${whyText((c.current?.reasons || []).find((r) => r.tier === t.tier) || (t.reasons || []).find((r) => r.tier === t.tier) || (t.reasons || [])[0], lang)}`),
              t.required.includes('ASHA') ? h('div', { style: { fontSize: '17px' } }, `${mine ? '✓' : '○'} ${T('आप', 'You')}   ${asha ? '✓' : '○'} ${T('सहिया', 'ASHA')}`) : null),
            h('div', { style: { width: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', padding: '10px', borderLeft: '3px solid var(--ink)' } },
              h('div', { style: { fontSize: '40px', fontWeight: 800, color: days < 0 || e.breached ? '#c8102e' : 'var(--ink)', lineHeight: 1 } }, days < 0 ? T('देर!', 'Late!') : String(days)),
              h('div', { style: { fontSize: '17px' } }, days < 0 ? T('समय निकल गया', 'past the deadline') : T('दिन बचे', 'days left')),
              mine ? h('div', { style: { fontSize: '20px', fontWeight: 800, color: '#1f9d6b' } }, T('✓ आप मिल आईं', '✓ You visited'))
                : bigBtn(T('मिल आई ✓', 'I visited ✓'), () => { store.close(t, { by: 'AWW', t: store.now, outcome: 'VISITED', channel: 'APP' }); render(); speak(T('बहुत अच्छा। दर्ज हो गया।', 'Well done. Saved.')); }, { bg: '#1f9d6b', fg: '#fff', size: '22px', pad: '10px 18px' })));
        }))];
    }

    // ---------- all children / one child ----------
    function kidsView() {
      const list = kids();
      sayNow = T('अपने सारे बच्चे। लाल वाले सबसे ज़रूरी हैं। किसी बच्चे पर दबाएँ।', 'All your children. Red ones are the most urgent. Press a child to see more.');
      return [header(T('मेरे सारे बच्चे', 'All my children'), () => go('home')), page(
        purpose('हर बच्चे का रंग बताता है कि क्या करना है।', 'Each child’s colour tells you what to do.'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' } }, list.map((c) => kidButton(c, () => { kidId = c.id; go('kid'); }))))];
    }
    const kidButton = (c, onclick) => {
      const col = COLOR[c.current?.tier || 'GREEN'];
      return h('button', { onclick, style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#fff', border: '3px solid var(--ink)', borderLeft: `14px solid ${col.bg}`, cursor: 'pointer', textAlign: 'left', fontFamily: DEVA } },
        pic(c.sex === 'F' ? 'girl' : 'boy', 54),
        h('div', null, h('div', { style: { fontSize: '21px', fontWeight: 800 } }, c.name.split(' ')[0]), h('div', { style: { fontSize: '15px', color: '#6d6266' } }, ageWords(ageAt(c, store.now)))));
    };
    function kidView() {
      const c = store.childById[kidId]; if (!c) return home();
      const cur = c.current, col = COLOR[cur?.tier || 'GREEN'];
      const vs = (c.eval?.visits || []).filter((v) => v.weightKg != null).slice(-6);
      const max = Math.max(...vs.map((v) => v.weightKg), 1);
      const last = vs[vs.length - 1];
      sayNow = `${c.name}. ${T(col.hi, col.en)}. ${cur ? whyText(cur.reasons.find((r) => r.tier === cur.tier), lang) : ''}`;
      return [header(c.name, () => go('kids')), page(
        h('div', { style: { display: 'flex', gap: '18px', alignItems: 'center', background: col.bg, color: col.fg, border: '3px solid var(--ink)', padding: '16px 20px' } },
          h('div', { style: { background: '#fff', borderRadius: '50%', padding: '8px', lineHeight: 0 } }, pic(col.icon, 80)),
          h('div', null, h('div', { style: { fontSize: '32px', fontWeight: 800 } }, T(col.hi, col.en)), h('div', { style: { fontSize: '20px' } }, cur && cur.tier !== 'GREEN' ? `${T('क्यों', 'Why')}: ${whyText(cur.reasons.find((r) => r.tier === cur.tier), lang)}` : T(col.subHi, col.subEn)))),
        h('div', { style: { display: 'flex', gap: '22px', flexWrap: 'wrap' } },
          fact(T('आख़िरी वज़न', 'Last weight'), last ? `${last.weightKg} ${T('किलो', 'kg')}` : '—', 'वज़न बढ़ना चाहिए। घटना या रुकना खतरे का निशान है।', 'Weight should go up. Falling or staying the same is a warning.'),
          fact(T('उम्र', 'Age'), ageWords(ageAt(c, store.now)), 'उम्र के हिसाब से ही वज़न और लंबाई देखी जाती है।', 'Weight and height are judged for the child’s age.'),
          last?.muacMm != null ? fact(T('बाँह का पट्टा', 'Arm band'), last.muacMm < 115 ? T('लाल', 'red') : last.muacMm < 125 ? T('पीला', 'yellow') : T('हरा', 'green'), 'लाल = बहुत कमज़ोर, पीला = कमज़ोर, हरा = ठीक।', 'Red = very weak, yellow = weak, green = fine.') : null),
        vs.length ? h('div', { style: { background: '#fff', border: '3px solid var(--ink)', padding: '14px 18px' } },
          h('div', { style: { fontSize: '22px', fontWeight: 800 } }, T('हर महीने का वज़न', 'Weight every month')),
          purpose('हर खंभा एक महीने का वज़न है। खंभे ऊँचे होते जाएँ तो अच्छा।', 'Each bar is one month’s weight. Bars getting taller is good.'),
          h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '18px', height: '170px', marginTop: '10px' } }, vs.map((v, i) => {
            const down = i > 0 && v.weightKg < vs[i - 1].weightKg, flat = i > 0 && Math.abs(v.weightKg - vs[i - 1].weightKg) < 0.05;
            return h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 } },
              h('div', { style: { fontSize: '18px', fontWeight: 800 } }, `${v.weightKg}`),
              h('div', { style: { width: '100%', height: `${Math.round((v.weightKg / max) * 120)}px`, background: down ? '#c8102e' : flat ? '#f2a20c' : '#1f9d6b', border: '2px solid var(--ink)' } }),
              h('div', { style: { fontSize: '15px' } }, new Date(v.t).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short' })));
          })),
          h('div', { style: { fontSize: '16px', marginTop: '8px' } }, T('हरा = बढ़ा · पीला = नहीं बढ़ा · लाल = घटा', 'green = went up · yellow = no change · red = went down'))) : null,
        h('div', null, bigBtn(T('इस बच्चे का वज़न लिखें', 'Write this child’s weight'), () => startWeigh(c))))];
    }
    const fact = (label, value, whyHi, whyEn) => h('div', { style: { background: '#fff', border: '3px solid var(--ink)', padding: '12px 16px', minWidth: '240px', flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '6px' } },
      h('div', { style: { fontSize: '18px', color: '#6d6266' } }, label), h('div', { style: { fontSize: '34px', fontWeight: 800 } }, value), h('div', { style: { fontSize: '16px', color: '#3a3236' } }, T(whyHi, whyEn)));

    // ---------- weighing: pick a child ----------
    function pick() {
      sayNow = T('किस बच्चे का वज़न लिखना है? उस पर दबाएँ। नया बच्चा हो तो प्लस वाला बटन दबाएँ।', 'Whose weight? Press the child. For a new child, press the plus button.');
      return [header(T('किसका वज़न?', 'Whose weight?'), () => go('home')), page(
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' } },
          h('button', { onclick: () => startNew(), style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#fff8d6', border: '3px dashed var(--ink)', cursor: 'pointer', fontFamily: DEVA, fontSize: '22px', fontWeight: 800 } }, pic('plus', 54), T('नया बच्चा', 'New child')),
          ...kids().map((c) => kidButton(c, () => startWeigh(c)))))];
    }
    function startWeigh(c) { f = { childId: c.id, name: c.name, sex: c.sex, ageMonths: ageAt(c, store.now), weightKg: null, heightCm: null, muac: null, oedema: false, danger: [], confirmed: false, entry: '' }; done = null; enterStep(0); go('step'); }
    function startNew() { f = { childId: null, name: '', sex: null, ageMonths: null, ageUnit: 'y', weightKg: null, heightCm: null, muac: null, oedema: false, danger: [], confirmed: false, entry: '' }; done = null; enterStep(0); go('step'); }

    // ---------- weighing: one question per screen ----------
    const MUAC = { green: 135, yellow: 120, red: 110 };
    function steps() {
      const s = [];
      if (!f.childId) {
        s.push({ id: 'name', pic: 'plus', q: T('बच्चे का नाम लिखें', 'Type the child’s name'), why: ['नाम से बच्चे को अगली बार पहचानेंगे।', 'The name finds the child next time.'], kind: 'name' });
        s.push({ id: 'sex', pic: 'kids', q: T('लड़का या लड़की?', 'Boy or girl?'), why: ['लड़के और लड़की का सही वज़न अलग होता है।', 'Healthy weight is different for boys and girls.'], kind: 'sex' });
        s.push({ id: 'age', pic: 'kids', q: T('उम्र कितनी है?', 'How old?'), why: ['उम्र के हिसाब से ही वज़न देखा जाता है।', 'Weight is judged for the child’s age.'], kind: 'age' });
      }
      s.push({ id: 'weight', pic: 'scale', q: T('वज़न कितना है?', 'What is the weight?'), unit: T('किलो', 'kg'), why: ['वज़न से पता चलता है कि बच्चा बढ़ रहा है या नहीं।', 'Weight shows whether the child is growing.'], kind: 'num', field: 'weightKg' });
      s.push({ id: 'height', pic: 'ruler', q: T('लंबाई कितनी है?', 'What is the height?'), unit: T('सेमी', 'cm'), why: ['लंबाई के हिसाब से वज़न देखकर पता चलता है कि बच्चा दुबला है या नहीं।', 'Weight for height shows whether the child is thin.'], kind: 'num', field: 'heightCm', skip: true });
      if ((f.ageMonths ?? 12) >= 6) s.push({ id: 'muac', pic: 'band', q: T('बाँह के पट्टे का रंग?', 'Arm band colour?'), why: ['लाल = बहुत कमज़ोर, पीला = कमज़ोर, हरा = ठीक।', 'Red = very weak, yellow = weak, green = fine.'], kind: 'muac', skip: true });
      s.push({ id: 'signs', pic: 'danger', q: T('क्या इनमें से कुछ है?', 'Any of these?'), why: ['इनमें से कोई भी हो तो बच्चा खतरे में है।', 'Any one of these means the child is in danger.'], kind: 'signs' });
      return s;
    }
    function row() { return { sex: f.sex, ageMonths: f.ageMonths, weightKg: f.weightKg, heightCm: f.heightCm, muacMm: f.muac ? MUAC[f.muac] : null, confirmed: f.confirmed }; }
    function fieldIssue(field) { return checkRow(row()).find((x) => x.level === 'block' && x.field === field); }

    function stepView() {
      const S = steps(), st = S[stepI];
      if (!st) return resultView();
      const lastV = f.childId ? store.childById[f.childId].eval?.lastValid : null;
      sayNow = `${st.q}. ${T(st.why[0], st.why[1])}`;
      const next = () => { enterStep(stepI + 1); render(); speak(steps()[stepI] ? `${steps()[stepI].q}` : ''); };
      let body, canNext = true, issue = null;
      if (st.kind === 'num') {
        const val = f.entry === '' ? null : Number(f.entry);
        f[st.field] = val;
        issue = val != null ? fieldIssue(st.field) : null;
        canNext = val != null && !issue;
        const prev = lastV ? (st.field === 'weightKg' ? lastV.weightKg : lastV.heightCm) : null;
        body = h('div', { style: { display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap' } },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            h('div', { style: { fontSize: '64px', fontWeight: 800, background: '#fff', border: '4px solid var(--ink)', padding: '8px 22px', minWidth: '320px', fontFamily: 'var(--font-mono)' } }, `${f.entry || '—'} `, h('span', { style: { fontSize: '30px' } }, st.unit)),
            prev != null ? h('div', { style: { fontSize: '20px' } }, `${T('पिछली बार', 'Last time')}: ${prev} ${st.unit}`) : null,
            issue ? h('div', { style: { fontSize: '20px', background: '#ffe9ee', borderLeft: '8px solid #c8102e', padding: '10px 14px', maxWidth: '460px' } },
              h('b', null, T('यह संख्या सही नहीं लगती। ', 'This number does not look right. ')), T('फिर से नापें।', 'Measure again.'),
              issue.fix ? h('div', { style: { marginTop: '8px' } }, bigBtn(T(`क्या ${issue.fix.value}?`, `Did you mean ${issue.fix.value}?`), () => { f.entry = String(issue.fix.value); render(); }, { size: '22px', pad: '8px 16px' })) : null) : null),
          keypad());
      } else if (st.kind === 'muac') {
        canNext = !!f.muac;
        body = h('div', { style: { display: 'flex', gap: '18px', flexWrap: 'wrap' } }, [['green', '#1f9d6b', '#fff', 'हरा', 'Green', 'ठीक', 'fine'], ['yellow', '#f2c80c', '#1f1b1d', 'पीला', 'Yellow', 'कमज़ोर', 'weak'], ['red', '#c8102e', '#fff', 'लाल', 'Red', 'बहुत कमज़ोर', 'very weak']].map(([k, bg, fg, hi, en, mhi, men]) =>
          h('button', { onclick: () => { f.muac = k; render(); }, style: { width: '220px', height: '170px', background: bg, color: fg, border: f.muac === k ? '8px solid var(--ink)' : '3px solid var(--ink)', boxShadow: '5px 5px 0 var(--ink)', cursor: 'pointer', fontFamily: DEVA, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' } },
            h('div', { style: { fontSize: '36px', fontWeight: 800 } }, (f.muac === k ? '✓ ' : '') + T(hi, en)), h('div', { style: { fontSize: '20px' } }, T(mhi, men)))));
      } else if (st.kind === 'signs') {
        const sign = (k, p, hi, en, on, toggle) => h('button', { onclick: toggle, style: { width: '230px', padding: '14px', background: on ? '#ffe9ee' : '#fff', border: on ? '6px solid #c8102e' : '3px solid var(--ink)', boxShadow: '5px 5px 0 var(--ink)', cursor: 'pointer', fontFamily: DEVA, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' } },
          pic(p, 90), h('div', { style: { fontSize: '21px', fontWeight: 800, textAlign: 'center' } }, T(hi, en)), h('div', { style: { fontSize: '20px', fontWeight: 800, color: on ? '#c8102e' : '#6d6266' } }, on ? T('हाँ ✓', 'Yes ✓') : T('नहीं', 'No')));
        const tog = (d) => () => { f.danger = f.danger.includes(d) ? f.danger.filter((x) => x !== d) : [...f.danger, d]; render(); };
        body = h('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap' } },
          sign('oedema', 'feet', 'दोनों पैरों में सूजन (दबाने पर गड्ढा)', 'Swelling of both feet (pit when pressed)', f.oedema, () => { f.oedema = !f.oedema; render(); }),
          sign('v', 'vomit', 'सब कुछ उल्टी कर देता है', 'Vomits everything', f.danger.includes('VOMITING'), tog('VOMITING')),
          sign('l', 'sleepy', 'बहुत कमज़ोर या सुस्त', 'Very weak or sleepy', f.danger.includes('LETHARGIC'), tog('LETHARGIC')),
          sign('n', 'noeat', 'खा-पी नहीं पा रहा', 'Cannot eat or drink', f.danger.includes('UNABLE_TO_FEED'), tog('UNABLE_TO_FEED')));
      } else if (st.kind === 'sex') {
        canNext = !!f.sex;
        body = h('div', { style: { display: 'flex', gap: '22px' } }, [['M', 'boy', 'लड़का', 'Boy'], ['F', 'girl', 'लड़की', 'Girl']].map(([k, p, hi, en]) =>
          h('button', { onclick: () => { f.sex = k; render(); }, style: { width: '240px', padding: '16px', background: '#fff', border: f.sex === k ? '8px solid var(--hot)' : '3px solid var(--ink)', boxShadow: '5px 5px 0 var(--ink)', cursor: 'pointer', fontFamily: DEVA, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' } }, pic(p, 120), h('div', { style: { fontSize: '30px', fontWeight: 800 } }, (f.sex === k ? '✓ ' : '') + T(hi, en)))));
      } else if (st.kind === 'age') {
        const val = f.entry === '' ? null : Number(f.entry);
        f.ageMonths = val == null ? null : f.ageUnit === 'y' ? Math.round(val * 12 * 10) / 10 : val;
        canNext = f.ageMonths != null && f.ageMonths >= 0 && f.ageMonths <= 60;
        body = h('div', { style: { display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap' } },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            h('div', { style: { fontSize: '64px', fontWeight: 800, background: '#fff', border: '4px solid var(--ink)', padding: '8px 22px', minWidth: '320px', fontFamily: 'var(--font-mono)' } }, f.entry || '—'),
            h('div', { style: { display: 'flex', gap: '12px' } }, [['y', 'साल', 'years'], ['m', 'महीने', 'months']].map(([k, hi, en]) => bigBtn((f.ageUnit === k ? '✓ ' : '') + T(hi, en), () => { f.ageUnit = k; render(); }, { bg: f.ageUnit === k ? 'var(--hot)' : '#fff', size: '24px', pad: '10px 20px' }))),
            f.ageMonths > 60 ? h('div', { style: { fontSize: '20px', color: '#c8102e', fontWeight: 700 } }, T('5 साल से छोटे बच्चे ही', 'Only children under 5')) : null),
          keypad());
      } else if (st.kind === 'name') {
        canNext = !!f.name.trim();
        body = h('input', { value: f.name, placeholder: T('नाम', 'Name'), oninput: (e) => { f.name = e.target.value; nextBtn.disabled = !f.name.trim(); nextBtn.style.opacity = f.name.trim() ? 1 : 0.4; }, style: { fontSize: '40px', padding: '12px 18px', border: '4px solid var(--ink)', width: '520px', fontFamily: DEVA } });
        setTimeout(() => body.focus(), 50);
      }
      const nextBtn = bigBtn(stepI === S.length - 1 ? T('देखें क्या करना है →', 'See what to do →') : T('आगे →', 'Next →'), next, { disabled: !canNext });
      return [header(`${f.name ? f.name.split(' ')[0] + ' · ' : ''}${T('सवाल', 'Question')} ${stepI + 1} / ${S.length}`, () => { if (stepI === 0) go('pick'); else { enterStep(stepI - 1); render(); } }), page(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '18px' } }, pic(st.pic, 96), h('div', { style: { fontSize: '40px', fontWeight: 800 } }, st.q)),
        purpose(st.why[0], st.why[1]),
        body,
        h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', marginTop: '6px' } }, nextBtn,
          st.skip ? bigBtn(T('छोड़ें (नहीं नापा)', 'Skip (not measured)'), () => { if (st.field) f[st.field] = null; if (st.kind === 'muac') f.muac = null; next(); }, { bg: '#fff', size: '20px', pad: '12px 18px' }) : null))];
    }
    // Entering a question: the keypad starts from the value already given (if any), so Back keeps answers.
    function enterStep(i) {
      stepI = i;
      const st = steps()[i];
      f.entry = st?.kind === 'num' && f[st.field] != null ? String(f[st.field]) : '';
      if (st?.kind === 'age' && f.ageMonths != null) f.entry = String(f.ageUnit === 'y' ? Math.round((f.ageMonths / 12) * 10) / 10 : f.ageMonths);
    }
    function keypad() {
      const key = (k) => h('button', { onclick: () => { if (k === '⌫') f.entry = f.entry.slice(0, -1); else if (k === '.') { if (!f.entry.includes('.')) f.entry = (f.entry || '0') + '.'; } else if (f.entry.length < 6) f.entry += k; render(); },
        style: { width: '96px', height: '80px', fontSize: '36px', fontWeight: 800, background: k === '⌫' ? '#ffe9ee' : '#fff', border: '3px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)', cursor: 'pointer', fontFamily: 'var(--font-mono)' } }, k);
      return h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 96px)', gap: '10px' } }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(key));
    }

    // ---------- result ----------
    function measurement() { return { confirmed: f.confirmed, weightKg: f.weightKg, heightCm: f.heightCm, muacMm: f.muac ? MUAC[f.muac] : null, lying: (f.ageMonths ?? 0) < 24, oedema: f.oedema, danger: f.danger, appetite: '' }; }
    function resultView() {
      const issues = checkRow(row());
      const confirm = issues.find((x) => x.level === 'confirm');
      const base = f.childId ? store.childById[f.childId] : { id: 'p', sex: f.sex, dob: store.now - f.ageMonths * 30.4375 * DAY, lbw: false, awcId: store.scope, events: [], signals: [] };
      const res = evaluate(base, [...(base.events || []), { id: 'p', t: store.now, ...measurement() }], base.signals || [], store.pack, { feedR: store.sim.feeds[base.awcId]?.R ?? 100 }).current;
      const col = COLOR[res.tier];
      const why = whyText(res.reasons.find((r) => r.tier === res.tier), lang);
      if (confirm && !f.confirmed) {
        sayNow = T('बच्चा बहुत ज़्यादा दुबला दिख रहा है। फिर से वज़न और लंबाई नापें। अगर यही है तो हाँ दबाएँ।', 'The child looks extremely thin. Weigh and measure again. If it is the same, press yes.');
        return [header(T('फिर से नापें', 'Measure again'), () => { enterStep(steps().length - 1); go('step'); }), page(
          h('div', { style: { display: 'flex', gap: '18px', alignItems: 'center', background: '#ffe9ee', border: '4px solid #c8102e', padding: '18px' } }, pic('danger', 96),
            h('div', { style: { fontSize: '30px', fontWeight: 800 } }, T('बच्चा बहुत ज़्यादा दुबला दिख रहा है।', 'The child looks extremely thin.'), h('div', { style: { fontSize: '22px', fontWeight: 400, marginTop: '6px' } }, T('फिर से वज़न और लंबाई नापें। अगर फिर भी यही आए तो नीचे दबाएँ।', 'Weigh and measure again. If it is still the same, press below.')))),
          h('div', { style: { display: 'flex', gap: '16px' } }, bigBtn(T('हाँ, फिर नापा — यही है', 'Yes, measured again — it is correct'), () => { f.confirmed = true; render(); }, { bg: '#c8102e', fg: '#fff' }), bigBtn(T('नंबर बदलें', 'Change the numbers'), () => { enterStep(steps().findIndex((s) => s.id === 'weight')); go('step'); }, { bg: '#fff' })))];
      }
      sayNow = `${T(col.hi, col.en)}. ${why}`;
      if (done) {
        return [header(T('सेव हो गया ✓', 'Saved ✓'), () => go('home')), page(
          h('div', { style: { display: 'flex', gap: '18px', alignItems: 'center', fontSize: '34px', fontWeight: 800 } }, pic('check', 110), T(`${f.name.split(' ')[0]} का वज़न सेव हो गया।`, `${f.name.split(' ')[0]}’s weight is saved.`)),
          h('div', { style: { display: 'flex', gap: '16px' } }, bigBtn(T('अगला बच्चा', 'Next child'), () => go('pick')), bigBtn(T('घर', 'Home'), () => go('home'), { bg: '#fff' })))];
      }
      return [header(T('क्या करना है', 'What to do'), () => { enterStep(steps().length - 1); go('step'); }), page(
        h('div', { style: { display: 'flex', gap: '22px', alignItems: 'center', background: col.bg, color: col.fg, border: '4px solid var(--ink)', boxShadow: '6px 6px 0 var(--ink)', padding: '22px 26px' } },
          h('div', { style: { background: '#fff', borderRadius: '50%', padding: '10px', lineHeight: 0 } }, pic(col.icon, 110)),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
            h('div', { style: { fontSize: '40px', fontWeight: 800, lineHeight: 1.1 } }, T(col.hi, col.en)),
            h('div', { style: { fontSize: '22px' } }, T(col.subHi, col.subEn)),
            res.tier !== 'GREEN' && why ? h('div', { style: { fontSize: '22px', fontWeight: 700 } }, `${T('क्यों', 'Why')}: ${why}`) : null)),
        h('div', { style: { fontSize: '20px' } }, `${f.name || ''} · ${f.weightKg ?? '—'} ${T('किलो', 'kg')}${f.heightCm ? ` · ${f.heightCm} ${T('सेमी', 'cm')}` : ''}${f.muac ? ` · ${T('पट्टा', 'band')} ${T({ green: 'हरा', yellow: 'पीला', red: 'लाल' }[f.muac], f.muac)}` : ''}`),
        h('div', { style: { display: 'flex', gap: '16px' } }, bigBtn(T('सेव करें ✓', 'Save ✓'), save, { bg: '#1f9d6b', fg: '#fff' }), bigBtn(T('नंबर बदलें', 'Change the numbers'), () => { enterStep(steps().findIndex((s) => s.id === 'weight')); go('step'); }, { bg: '#fff' })))];
    }
    function save() {
      let id = f.childId;
      if (!id) id = store.addChild({ name: f.name.trim(), sex: f.sex, ageMonths: f.ageMonths, awcId: store.scope }).id;
      store.capture(id, measurement(), 'DIRECT');
      done = id; render();
      speak(T('सेव हो गया।', 'Saved.'));
    }

    function go(v) { view = v; if (v !== 'step') f = v === 'pick' ? null : f; render(); }
    function render() {
      const parts = view === 'visits' ? visits() : view === 'kids' ? kidsView() : view === 'kid' ? kidView() : view === 'pick' ? pick() : view === 'step' ? stepView() : home();
      mount(ctx.body, h('div', { style: { minHeight: '100%', background: 'var(--paper)', display: 'flex', flexDirection: 'column' } }, ...parts));
    }
    render();
    ctx.onCleanup(store.on('role', () => render()));
  },
};

function ageWords(m) {
  const lang = (() => { try { return localStorage.getItem(LS) || 'hi'; } catch { return 'hi'; } })();
  if (m == null) return '';
  if (m < 24) return lang === 'hi' ? `${Math.round(m)} महीने` : `${Math.round(m)} months`;
  const y = Math.floor(m / 12), mo = Math.round(m % 12);
  return lang === 'hi' ? `${y} साल${mo ? ` ${mo} महीने` : ''}` : `${y} yr${mo ? ` ${mo} mo` : ''}`;
}
