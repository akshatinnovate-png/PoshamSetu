// Hindi-first strings for the AWW app (English as the second language).
export const STR = {
  hi: {
    today: 'आज का काम', children: 'बच्चे', queue: 'भेजना बाकी', settings: 'सेटिंग',
    online: 'नेटवर्क है', offline: 'नेटवर्क नहीं', synced: 'सब भेज दिया', pending: (n) => `${n} नाप भेजना बाकी`,
    weigh: 'वज़न लें', save: 'सहेजें', back: 'वापस', why: 'क्यों', what: 'क्या करें', due: 'समय सीमा',
    weight: 'वज़न (kg)', height: 'लंबाई / ऊँचाई (cm)', muac: 'बाँह का घेरा MUAC (mm)', oedema: 'दोनों पैरों में सूजन',
    danger: 'खतरे के लक्षण', vomit: 'सब उल्टी कर देता है', weak: 'बहुत कमज़ोर / सुस्त', nofeed: 'दूध / खाना नहीं ले पा रहा',
    preview: 'सहेजने से पहले — नियम क्या कहते हैं', forecast: (p, d) => `इसी रफ़्तार से ${d} दिन में MAM होने की संभावना ${p}%`,
    risk: 'जोखिम अंक', allClear: 'आज कोई ज़रूरी काम नहीं', savedOffline: 'फ़ोन में सहेजा — नेटवर्क आने पर अपने आप जाएगा',
    savedOnline: 'भेज दिया', syncNow: 'अभी भेजें', server: 'सर्वर पता', awc: 'आंगनवाड़ी', lang: 'भाषा', install: 'फ़ोन पर इंस्टॉल करें',
    implausible: 'यह नाप असंभव लगता है — दोबारा नापें', didYouMean: (v) => `क्या ${v} kg था?`, age: 'उम्र', months: 'माह', years: 'साल',
    tiers: { RED_A: 'आज ही रेफर करें', RED_B: 'गंभीर — 72 घंटे में भूख जाँच', AMBER: '7 दिन में घर भेंट', WATCH: '14 दिन में दोबारा वज़न', GREEN: 'ठीक है' },
    searchPh: 'नाम खोजें', measuredAt: 'नापने का समय', clockNote: 'समय सीमा नापने के समय से गिनी जाती है, भेजने के समय से नहीं।',
  },
  en: {
    today: "Today's work", children: 'Children', queue: 'To send', settings: 'Settings',
    online: 'Online', offline: 'No signal', synced: 'All sent', pending: (n) => `${n} measurement(s) waiting`,
    weigh: 'Weigh', save: 'Save', back: 'Back', why: 'Why', what: 'What to do', due: 'Due',
    weight: 'Weight (kg)', height: 'Length / height (cm)', muac: 'MUAC (mm)', oedema: 'Swelling of both feet',
    danger: 'Danger signs', vomit: 'Vomits everything', weak: 'Unusually weak / sleepy', nofeed: 'Unable to feed',
    preview: 'Before you save — what the rules say', forecast: (p, d) => `${p}% chance of MAM within ${d} days at this rate`,
    risk: 'Risk points', allClear: 'Nothing urgent today', savedOffline: 'Saved on the phone — sends itself when signal returns',
    savedOnline: 'Sent', syncNow: 'Send now', server: 'Server address', awc: 'Anganwadi', lang: 'Language', install: 'Install on this phone',
    implausible: 'This reading looks impossible — measure again', didYouMean: (v) => `Did you mean ${v} kg?`, age: 'Age', months: 'mo', years: 'y',
    tiers: { RED_A: 'Refer today', RED_B: 'Severe — appetite test in 72 h', AMBER: 'Home visit in 7 days', WATCH: 'Re-weigh in 14 days', GREEN: 'On track' },
    searchPh: 'Search name', measuredAt: 'Measured', clockNote: 'Deadlines count from when you measured, not when it was sent.',
  },
};
