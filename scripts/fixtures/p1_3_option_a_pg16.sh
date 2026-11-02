#!/usr/bin/env bash
set -euo pipefail
# CI-only scratch PostgreSQL. Refuse remote or non-disposable targets.
if [[ "$PGHOST" != "127.0.0.1" && "$PGHOST" != "localhost" ]] ||
   [[ "$PGDATABASE" != "p13_lock_sandbox" ]] || [[ "$PGUSER" != "postgres" ]]; then
  echo 'REFUSED: disposable local p13_lock_sandbox required' >&2;exit 1
fi
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
activate(){ psqlq -c "SELECT p13_sandbox.activate($1,$3)" >"$2" 2>&1; }
assert_sql(){ psqlq -c "DO \$t\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'fixture assertion: $2'; END IF; END \$t\$;"; }
race(){
  local e1="$1" e2="$2" tag="$3"
  set +e
  activate "$e1" "$tmp/$tag.a" 400 & a=$!
  activate "$e2" "$tmp/$tag.b" 400 & b=$!
  wait "$a";ra=$?
  wait "$b";rb=$?
  set -e
  if [[ "$ra" == "$rb" ]]; then cat "$tmp/$tag.a" "$tmp/$tag.b";exit 1;fi
  if [[ "$ra" == 0 ]]; then ok="$tmp/$tag.a";bad="$tmp/$tag.b";
  else ok="$tmp/$tag.b";bad="$tmp/$tag.a";fi
  grep -qx ACTIVATED "$ok"
  grep -q TC1_CONFLICT "$bad"
  echo "PASS: $tag exactly one activation and conflict"
}
echo 'case 1: two GM activations of same canonical character'
race 101 102 same-character
assert_sql "(SELECT count(*) FROM p13_sandbox.encounters WHERE id IN (101,102) AND status='active')=1 AND (SELECT sum(revision) FROM p13_sandbox.encounters WHERE id IN (101,102))=1" "one winner and no partial loser"
echo 'case 2: independent characters both activate'
activate 201 "$tmp/ind.a" 250 & a=$!
activate 202 "$tmp/ind.b" 250 & b=$!
wait "$a";wait "$b"
grep -qx ACTIVATED "$tmp/ind.a";grep -qx ACTIVATED "$tmp/ind.b"
assert_sql "(SELECT count(*) FROM p13_sandbox.encounters WHERE id IN (201,202) AND status='active')=2" "independent activation"
echo 'case 3: two characters in reversed participant insertion order'
race 301 302 reverse-order
assert_sql "(SELECT count(*) FROM p13_sandbox.encounters WHERE id IN (301,302) AND status='active')=1" "sorted locking"
echo 'case 4: historic active overlap preserved'
set +e; activate 403 "$tmp/historic" 0;rc=$?;set -e
[[ "$rc" != 0 ]];grep -q TC1_CONFLICT "$tmp/historic"
assert_sql "(SELECT count(*) FROM p13_sandbox.encounters WHERE id IN (401,402) AND status='active' AND revision=0)=2 AND (SELECT status FROM p13_sandbox.encounters WHERE id=403)='draft'" "no historic mutation"
echo 'case 5: exception after status UPDATE rolls back'
set +e;psqlq -c "SELECT p13_sandbox.activate(501,0,true)" >"$tmp/rollback" 2>&1;rc=$?;set -e
[[ "$rc" != 0 ]];grep -q FIXTURE_ROLLBACK "$tmp/rollback"
assert_sql "(SELECT status='draft' AND revision=0 FROM p13_sandbox.encounters WHERE id=501)" "rollback"
[[ "$(psqlq -c 'SELECT p13_sandbox.activate(501)')" == "ACTIVATED" ]]
echo 'case 6: idempotent repeat'
[[ "$(psqlq -c 'SELECT p13_sandbox.activate(501)')" == "ALREADY_ACTIVE" ]]
assert_sql "(SELECT status='active' AND revision=1 FROM p13_sandbox.encounters WHERE id=501)" "no duplicate"
echo 'case 7: synthetic opposite ledger/encounter lock order -> expected PG deadlock'
opposed(){
  if [[ "$1" == L ]]; then
    psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';UPDATE p13_sandbox.lock_l SET revision=revision+1 WHERE id=1;SELECT pg_sleep(0.65);UPDATE p13_sandbox.lock_e SET revision=revision+1 WHERE id=1;COMMIT;" >"$2" 2>&1
  else
    psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';UPDATE p13_sandbox.lock_e SET revision=revision+1 WHERE id=1;SELECT pg_sleep(0.65);UPDATE p13_sandbox.lock_l SET revision=revision+1 WHERE id=1;COMMIT;" >"$2" 2>&1
  fi
}
set +e
opposed L "$tmp/dead.a" & a=$!
opposed E "$tmp/dead.b" & b=$!
wait "$a";ra=$?
wait "$b";rb=$?
set -e
if [[ "$ra" == "$rb" ]] || ! grep -qi 'deadlock detected' "$tmp/dead.a" "$tmp/dead.b"; then
  cat "$tmp/dead.a" "$tmp/dead.b";echo 'expected synthetic deadlock victim' >&2;exit 1
fi
echo 'PASS: real PostgreSQL deadlock observed in synthetic scratch tables, NOT live DnDNext'
echo 'case 8: uniform E then L order commits twice'
psqlq -c "UPDATE p13_sandbox.lock_e SET revision=0;UPDATE p13_sandbox.lock_l SET revision=0;"
ordered(){ psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';UPDATE p13_sandbox.lock_e SET revision=revision+1 WHERE id=1;SELECT pg_sleep(0.25);UPDATE p13_sandbox.lock_l SET revision=revision+1 WHERE id=1;COMMIT;" >/dev/null; }
ordered & a=$!;ordered & b=$!;wait "$a";wait "$b"
assert_sql "(SELECT revision=2 FROM p13_sandbox.lock_e WHERE id=1) AND (SELECT revision=2 FROM p13_sandbox.lock_l WHERE id=1)" "uniform order"
echo 'PASS PG16 synthetic 8-case TC1 and lock-order suite; not deployed SQL.'
