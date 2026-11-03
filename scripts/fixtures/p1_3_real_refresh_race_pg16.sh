#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != "127.0.0.1" && "$PGHOST" != "localhost" ]] ||
 [[ "$PGDATABASE" != "p13_live_source_sandbox" ]] || [[ "$PGUSER" != "postgres" ]]; then
 echo "REFUSED: local disposable PG16 sandbox only" >&2;exit 1
fi
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
assert_sql(){ psqlq -c "DO \$a\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'fixture assertion: $2';END IF;END \$a\$;"; }
echo "REFRESH CASE 17: deployed refresh C->S versus deployed spend S->C on SAME character and slot"
refresh_c_first(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';SET LOCAL deadlock_timeout='150ms';
 SELECT slots_remaining FROM public.character_spell_slots WHERE
 character_id=public.fixture_uuid(12) AND pool_key='spellcasting' AND slot_level=1 FOR UPDATE;
 SELECT pg_sleep(0.72);
 SELECT private.refresh_encounter_spell_slots_from_characters_v1(public.fixture_uuid(912));COMMIT;" >"$tmp/cfirst" 2>&1
}
spend_s_first(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';SET LOCAL deadlock_timeout='150ms';
 UPDATE public.encounter_spell_slots SET slots_remaining=slots_remaining-1
 WHERE id=public.fixture_uuid(4912) AND slots_remaining>0;COMMIT;" >"$tmp/sfirst" 2>&1
}
set +e
refresh_c_first & pa=$!
sleep 0.18
spend_s_first & pb=$!
wait "$pa";ra=$?
wait "$pb";rb=$?
set -e
if [[ "$ra" == "$rb" ]] || ! grep -qi 'deadlock detected' "$tmp/cfirst" "$tmp/sfirst";then
 echo "FAIL: expected source-derived PostgreSQL deadlock with one transaction aborted"
 cat "$tmp/cfirst" "$tmp/sfirst";exit 1
fi
assert_sql "(SELECT slots_remaining FROM public.character_spell_slots WHERE character_id=public.fixture_uuid(12)) =
 (SELECT slots_remaining FROM public.encounter_spell_slots WHERE id=public.fixture_uuid(4912))" "refresh/spend rollback keeps S and C equal"
echo "PASS: original refresh C->S and spend bridge S->C deadlocked in scratch PG16, rollback consistent"
echo "REFRESH CASE 18: snapshot-first prelock serializes this exact refresh/spend pairing"
scoped_s_first_refresh(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';
 SELECT slots_remaining FROM public.encounter_spell_slots WHERE id=public.fixture_uuid(4913) FOR UPDATE;
 SELECT pg_sleep(0.60);
 SELECT private.refresh_encounter_spell_slots_from_characters_v1(public.fixture_uuid(913));COMMIT;" >"$tmp/ordered-refresh" 2>&1
}
scoped_s_first_spend(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';
 UPDATE public.encounter_spell_slots SET slots_remaining=slots_remaining-1
 WHERE id=public.fixture_uuid(4913) AND slots_remaining>0;COMMIT;" >"$tmp/ordered-spend" 2>&1
}
scoped_s_first_refresh & pa=$!
sleep 0.15
scoped_s_first_spend & pb=$!
wait "$pa";wait "$pb"
assert_sql "(SELECT slots_remaining=0 FROM public.character_spell_slots WHERE character_id=public.fixture_uuid(13)) AND
 (SELECT slots_remaining=0 FROM public.encounter_spell_slots WHERE id=public.fixture_uuid(4913))" "two serialized operations ended with canonical and snapshot zero"
echo "PASS: scoped S-first prelock serialized this single pair; NOT a global lock order"
echo "PASS: two real-source C-to-S vs S-to-C research cases, no deployed SQL executed."
