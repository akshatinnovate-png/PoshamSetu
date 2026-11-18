#!/usr/bin/env bash
# Builds the IVR prompt clips (concatenative IVR: intro + digits + menu + confirmations) with espeak-ng.
# Production would use recorded voice artists / Bhashini TTS; these are offline placeholders that work.
set -euo pipefail
OUT=app/assets/ivr
mkdir -p "$OUT"
say() { # lang name text
  espeak-ng -v "$1" -s 135 -p 45 -w "/tmp/ivr_$2.wav" "$3"
  ffmpeg -loglevel error -y -i "/tmp/ivr_$2.wav" -ac 1 -ar 16000 -c:a libopus -b:a 24k "$OUT/$2.ogg"
}
# Hindi
say hi hi_intro "नमस्ते सहिया दीदी। पोषण सेतु से एक घर भेंट का काम है।"
say hi hi_child "बच्चे का नंबर है"
say hi hi_menu "भेंट हो गई तो एक दबाएँ। रेफर किया तो दो। परिवार ने मना किया तो तीन। परिवार बाहर चला गया तो चार।"
say hi hi_ok1 "धन्यवाद। भेंट दर्ज हो गई।"
say hi hi_ok2 "धन्यवाद। रेफरल दर्ज हो गया।"
say hi hi_ok3 "ठीक है। मना करना दर्ज हुआ। मुख्य सेविका को सूचना जाएगी।"
say hi hi_ok4 "ठीक है। पलायन दर्ज हुआ। पता लगाने का काम खुल गया है।"
for d in 0 1 2 3 4 5 6 7 8 9; do say hi "hi_d$d" "$d"; done
# English
say en en_intro "Hello Sahiya. You have a home visit task from Poshan Setu."
say en en_child "The child's number is"
say en en_menu "If you visited, press 1. If you referred, press 2. If the family refused, press 3. If the family has migrated, press 4."
say en en_ok1 "Thank you. The visit is recorded."
say en en_ok2 "Thank you. The referral is recorded."
say en en_ok3 "Noted. The refusal is recorded and the supervisor will be told."
say en en_ok4 "Noted. Migration recorded. A trace task is open."
for d in 0 1 2 3 4 5 6 7 8 9; do say en "en_d$d" "$d"; done
rm -f /tmp/ivr_*.wav
ls "$OUT" | wc -l
