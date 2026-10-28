#!/bin/bash
# Alle automatischen Tests der App laufen lassen (für Claude, in der Cloud-Umgebung).
# Aufruf im Projektordner: bash tests/run-all.sh
# Baut eine Testversion gegen einen Supabase-Nachbau und prüft die Bedienung mit Playwright
# (Handy-Format, zwei simulierte Handys mit gemeinsamem Haushalt).
cd "$(dirname "$0")/.." || exit 1
# Gleiche Zeitzone wie der Test-Browser (sonst stimmen Uhrzeiten nicht)
export TZ=Europe/Zurich
# Abhängigkeiten: in Cowork liegen sie fertig in /opt/npm-tools, sonst per npm holen
if [ -d /opt/npm-tools/node_modules ]; then
  ln -sfn /opt/npm-tools/node_modules node_modules
elif [ ! -d node_modules/esbuild ]; then
  npm install --no-audit --no-fund > /tmp/fp-npm.log 2>&1 || { echo "npm install fehlgeschlagen, siehe /tmp/fp-npm.log"; exit 1; }
fi
SUPABASE_URL=http://localhost:8766 OUT_DIR=docs-test node scripts/build.mjs | tail -1
node tests/mock-supabase.mjs > /tmp/fp-mock.log 2>&1 &
MOCK=$!
python3 -m http.server 8765 > /tmp/fp-web.log 2>&1 &
WEB=$!
sleep 1
fail=0
for t in ui-local start-page sync-two todo-link password calendar calendar-edit calendar-views; do
  echo "== $t"
  out=$(timeout 150 node tests/$t.mjs 2>&1 | grep -v "^\[{")
  echo "$out" | grep -E "^(OK|FAIL)" | sed 's/^OK   /  ok   /'
  echo "$out" | grep -E "FAIL|Error" > /dev/null && fail=1
  echo "$out" | grep -q "^OK" || { echo "  keine Ergebnisse:"; echo "$out" | head -8; fail=1; }
done
kill $MOCK $WEB 2>/dev/null
rm -rf docs-test
echo "== google-function"; node tests/google-function.mjs | grep -E "^(OK|FAIL)" | sed "s/^OK   /  ok   /"; node tests/google-function.mjs > /dev/null || fail=1
[ $fail = 0 ] && echo "ALLE TESTS OK" || echo "FEHLER GEFUNDEN"
exit $fail
