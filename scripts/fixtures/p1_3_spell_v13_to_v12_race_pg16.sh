#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != '127.0.0.1' && "$PGHOST" != 'localhost' ]] || [[ "$PGDATABASE" != 'p13_live_source_sandbox' ]] || [[ "$PGUSER" != 'postgres' ]];then
 echo 'REFUSED: only local disposable PostgreSQL 16' >&2;exit 1
fi
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
check(){ psqlq -c "DO \$test\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'delegated spell fixture failed: $2'; END IF; END \$test\$;"; }
cast(){ local actor="$1" assignment="$2" target="$3" slot="$4" req="$5" output="$6"; psqlq -c "SELECT public.encounter_cast_spell_v13(public.fixture_uuid($actor),public.fixture_uuid($assignment),public.fixture_uuid($target),$slot,public.fixture_uuid($req));" >"$output" 2>&1; }
endturn(){ local actor="$1" req="$2" output="$3";psqlq -c "SELECT public.encounter_end_turn_v1(public.fixture_uuid($actor),public.fixture_uuid($req));" >"$output" 2>&1; }
echo 'DELEGATED CAST CASE 33: original v13 delegates valid XPHB Bard Vicious Mockery to original v12'
cast 5960 6960 5961 'NULL::integer' 8960 "$tmp/33.cast"
check "(SELECT action_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5960))
 AND (SELECT current_hp<10 AND current_hp>=4 FROM public.encounter_participants WHERE id=public.fixture_uuid(5961))
 AND (SELECT count(*)=1 FROM public.encounter_timed_effects WHERE participant_id=public.fixture_uuid(5961) AND effect_key='vicious_mockery_next_attack_disadvantage' AND expiry_trigger='target_turn_end')
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(940) AND event_type='spell_cast')
 AND (SELECT result->>'spellKey'='vicious-mockery|xphb' AND result->>'targetId'=public.fixture_uuid(5961)::text
 FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8960))
 AND (SELECT count(*)=0 FROM public.encounter_spell_slots WHERE participant_id=public.fixture_uuid(5960))" "delegation produced one action/effect and no slot charge"
echo 'PASS: exact v13->v12 delegation performed valid Bard cantrip and timed effect'
echo 'DELEGATED CAST CASE 34: cached request permits changed target and slot argument'
replayed=$(psqlq -c "SELECT (public.encounter_cast_spell_v13(public.fixture_uuid(5960),public.fixture_uuid(6960),public.fixture_uuid(5964),0,public.fixture_uuid(8960))->>'targetId')=public.fixture_uuid(5961)::text")
[[ "$replayed" == 't' ]] || { echo "Unexpected delegated replay $replayed";exit 1; }
check "(SELECT current_hp=10 FROM public.encounter_participants WHERE id=public.fixture_uuid(5964))
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(940) AND event_type='spell_cast')
 AND (SELECT participant_id=public.fixture_uuid(5960) AND result->>'targetId'=public.fixture_uuid(5961)::text
 FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8960))" "changed target replay leaves target unchanged"
echo 'PASS: original delegated v12 cached result ignores changed target/slot; no additional spell'
echo 'DELEGATED CAST CASE 35: competing exact delegated cast and End Turn serialize actor P'
cast_first(){
 psqlq -c "BEGIN; SET LOCAL lock_timeout='6s';
 SELECT id FROM public.encounter_participants WHERE id=public.fixture_uuid(5962) FOR UPDATE;
 SELECT pg_sleep(0.62);
 SELECT public.encounter_cast_spell_v13(public.fixture_uuid(5962),public.fixture_uuid(6962),public.fixture_uuid(5963),NULL::integer,public.fixture_uuid(8962));
 COMMIT;" >"$tmp/35.cast" 2>&1
}
cast_first & pa=$!
sleep 0.15
endturn 5962 8963 "$tmp/35.end" & pb=$!
wait "$pa";wait "$pb"
check "(SELECT active_participant_id=public.fixture_uuid(5963) FROM public.encounters WHERE id=public.fixture_uuid(941))
 AND (SELECT action_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5962))
 AND (SELECT current_hp<10 FROM public.encounter_participants WHERE id=public.fixture_uuid(5963))
 AND (SELECT count(*)=1 FROM public.encounter_timed_effects WHERE participant_id=public.fixture_uuid(5963) AND effect_key='vicious_mockery_next_attack_disadvantage')
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(941) AND event_type='spell_cast')
 AND (SELECT count(*)=2 FROM public.encounter_command_requests WHERE encounter_id=public.fixture_uuid(941) AND result IS NOT NULL)" "delegated cantrip then End Turn serialized"
echo 'PASS: exact v13->v12 delegated cast serialized before End Turn and logged once'
echo 'PASS: delegated Vicious Mockery cases 33-35, mocked saving throws and damage only.'
