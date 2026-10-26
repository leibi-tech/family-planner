#!/bin/bash
# Alle automatischen Tests der App laufen lassen (für Claude, in der Cloud-Umgebung).
# Aufruf im Projektordner: bash tests/run-all.sh
# Baut eine Testversion gegen einen Supabase-Nachbau und prüft die Bedienung mit Playwright
# (Handy-Format, zwei simulierte Handys mit gemeinsamem Haushalt).
cd "$(dirname "$0")/.." || exit 1
ln -sfn /opt/npm-tools/node_modules node_modules
SUPABASE_URL=http://localhost:8766 OUT_DIR=docs-test node scripts/build.mjs | tail -1
node tests/mock-supabase.mjs > /tmp/fp-mock.log 2>&1 &
MOCK=$!
python3 -m http.server 8765 > /tmp/fp-web.log 2>&1 &
WEB=$!
sleep 1
fail=0
for t in ui-local start-page sync-two todo-link password; do
  echo "== $t"
  out=$(node tests/$t.mjs 2>&1 | grep -v '^\[{')
  echo "$out" | grep -E "^(OK|FAIL)" | sed 's/^OK   /  ok   /'
  echo "$out" | grep -E "FAIL|Error" > /dev/null && fail=1
done
kill $MOCK $WEB 2>/dev/null
rm -rf docs-test
[ $fail = 0 ] && echo "ALLE TESTS OK" || echo "FEHLER GEFUNDEN"
exit $fail
