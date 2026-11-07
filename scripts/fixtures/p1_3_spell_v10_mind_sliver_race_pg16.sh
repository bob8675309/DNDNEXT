#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != '127.0.0.1' && "$PGHOST" != 'localhost' ]] || [[ "$PGDATABASE" != 'p13_live_source_sandbox' ]] || [[ "$PGUSER" != 'postgres' ]]; then
 echo 'REFUSED: isolated local PG16 only' >&2;exit 1
fi
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
check(){ psqlq -c "DO \$test\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'Mind Sliver fixture failed: $2'; END IF; END \$test\$;"; }
cast(){ psqlq -c "SELECT public.encounter_cast_spell_v13(public.fixture_uuid($1),public.fixture_uuid($2),public.fixture_uuid($3),$4,public.fixture_uuid($5));" >"$6" 2>&1; }
endturn(){ psqlq -c "SELECT public.encounter_end_turn_v1(public.fixture_uuid($1),public.fixture_uuid($2));" >"$3" 2>&1; }
echo 'MIND SLIVER CASE 39: exact v13->v12->v11->pre->v10 valid Bard cantrip'
cast 5980 6980 5981 'NULL::integer' 8980 "$tmp/39.cast"
check "(SELECT action_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5980))
 AND (SELECT current_hp BETWEEN 14 AND 19 FROM public.encounter_participants WHERE id=public.fixture_uuid(5981))
 AND (SELECT count(*)=1 FROM public.encounter_timed_effects WHERE participant_id=public.fixture_uuid(5981) AND effect_key='mind_sliver_save_penalty' AND expiry_trigger='source_turn_end')
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(944) AND event_type='spell_cast')
 AND (SELECT result->>'spellKey'='mind-sliver|xphb' AND result->>'targetId'=public.fixture_uuid(5981)::text FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8980))
 AND (SELECT count(*)=0 FROM public.encounter_spell_slots WHERE participant_id=public.fixture_uuid(5980))" "Mind Sliver cast/target effect no spell slot"
echo 'PASS: original v10 Mind Sliver through v13 consumed Action, added source-end timed effect and used no slot'
echo 'MIND SLIVER CASE 40: original v10 duplicate replay uses prior result despite new target/slot'
res=$(psqlq -c "SELECT (public.encounter_cast_spell_v13(public.fixture_uuid(5980),public.fixture_uuid(6980),public.fixture_uuid(5982),0,public.fixture_uuid(8980))->>'targetId')=public.fixture_uuid(5981)::text")
[[ "$res" == 't' ]] || { echo "Unexpected replay $res";exit 1; }
check "(SELECT current_hp=20 FROM public.encounter_participants WHERE id=public.fixture_uuid(5982))
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(944) AND event_type='spell_cast')
 AND (SELECT count(*)=1 FROM public.encounter_command_requests WHERE encounter_id=public.fixture_uuid(944))" "legacy replay no mutation"
echo 'PASS: original Mind Sliver v10 cache accepted alternate target/slot with same request ID'
echo 'MIND SLIVER CASE 41: original v10 P->E versus End Turn P->E same actor'
cast_first(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';
 SELECT id FROM public.encounter_participants WHERE id=public.fixture_uuid(5983) FOR UPDATE;
 SELECT pg_sleep(0.60);
 SELECT public.encounter_cast_spell_v13(public.fixture_uuid(5983),public.fixture_uuid(6983),public.fixture_uuid(5984),NULL::integer,public.fixture_uuid(8983));
 COMMIT;" >"$tmp/41.cast" 2>&1
}
cast_first & pa=$!
sleep 0.15
endturn 5983 8984 "$tmp/41.end" & pb=$!
wait "$pa";wait "$pb"
check "(SELECT active_participant_id=public.fixture_uuid(5984) FROM public.encounters WHERE id=public.fixture_uuid(945))
 AND (SELECT action_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5983))
 AND (SELECT current_hp BETWEEN 14 AND 19 FROM public.encounter_participants WHERE id=public.fixture_uuid(5984))
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(945) AND event_type='spell_cast')
 AND (SELECT count(*)=2 FROM public.encounter_command_requests WHERE encounter_id=public.fixture_uuid(945) AND result IS NOT NULL)" "spell/turn serialized"
echo 'PASS: v10 Mind Sliver and End Turn serialized on actor P without deadlock in this schedule'
echo 'PASS: original v10 cases 39-41; real GoTrue, saving throws and damage not tested.'
