// Concatenative IVR player. Prefers an installed OS voice for the language (Web Speech API);
// otherwise plays the bundled recorded clips (app/assets/ivr), stitched like a telecom IVR.
const BASE = new URL('../assets/ivr/', import.meta.url);
let current = null;

export function stop() { current?.cancel(); current = null; try { speechSynthesis.cancel(); } catch {} }

function osVoice(lang) {
  try { return speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith(lang === 'hi' ? 'hi' : 'en')); } catch { return null; }
}

/** Play clips in order; returns a handle with cancel(). onPart(i) fires as each clip starts. */
export function playClips(names, onPart) {
  stop();
  let cancelled = false, audio = null;
  const handle = { cancel: () => { cancelled = true; audio?.pause(); } };
  current = handle;
  (async () => {
    for (let i = 0; i < names.length && !cancelled; i++) {
      onPart?.(i);
      audio = new Audio(new URL(names[i] + '.ogg', BASE).href);
      await new Promise((res) => { audio.onended = res; audio.onerror = res; audio.play().catch(res); });
    }
  })();
  return handle;
}

/** Speak a task prompt: intro, child number digit by digit, menu. */
export function promptTask(lang, ref4, onPart) {
  const L = lang === 'en' ? 'en' : 'hi';
  const voice = osVoice(L);
  if (voice && lang !== 'clips') {
    stop();
    const text = L === 'hi'
      ? `नमस्ते सहिया दीदी। पोषण सेतु से एक घर भेंट का काम है। बच्चे का नंबर है ${ref4.split('').join(' ')}। भेंट हो गई तो एक दबाएँ। रेफर किया तो दो। परिवार ने मना किया तो तीन। परिवार बाहर चला गया तो चार।`
      : `Hello Sahiya. You have a home visit task from Poshan Setu. The child's number is ${ref4.split('').join(' ')}. If you visited, press 1. If you referred, press 2. If the family refused, press 3. If the family has migrated, press 4.`;
    const u = new SpeechSynthesisUtterance(text); u.voice = voice; u.lang = voice.lang; u.rate = 0.95;
    speechSynthesis.speak(u);
    return { mode: 'os-voice', voice: voice.name };
  }
  playClips([`${L}_intro`, `${L}_child`, ...ref4.split('').map((d) => `${L}_d${d}`), `${L}_menu`], onPart);
  return { mode: 'clips' };
}
export function confirmKey(lang, key) { const L = lang === 'en' ? 'en' : 'hi'; if (key >= 1 && key <= 4) playClips([`${L}_ok${key}`]); }
