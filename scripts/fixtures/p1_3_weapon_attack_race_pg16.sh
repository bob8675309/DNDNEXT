#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != '127.0.0.1' && "$PGHOST" != 'localhost' ]] || [[ "$PGDATABASE" != 'p13_live_source_sandbox' ]] || [[ "$PGUSER" != 'postgres' ]];then
 echo 'REFUSED: scratch local PostgreSQL 16 only' >&2;exit 1
fi
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
check(){ psqlq -c "DO \$test\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'weapon fixture failed: $2'; END IF; END \$test\$;"; }
attack(){ local actor="$1" target="$2" req="$3" output="$4";psqlq -c "SELECT public.encounter_weapon_attack_v1(public.fixture_uuid($actor),public.fixture_uuid($target),public.fixture_uuid(6999),public.fixture_uuid($req));" >"$output" 2>&1; }
endturn(){ local actor="$1" req="$2" output="$3";psqlq -c "SELECT public.encounter_end_turn_v1(public.fixture_uuid($actor),public.fixture_uuid($req));" >"$output" 2>&1; }
echo 'WEAPON CASE 27: exact public Weapon Attack then public End Turn on valid active turn'
attack 5940 5941 8941 "$tmp/27.attack"
endturn 5940 8942 "$tmp/27.end"
check "(SELECT current_hp=9 FROM public.encounter_participants WHERE id=public.fixture_uuid(5941))
 AND (SELECT action_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5940))
 AND (SELECT active_participant_id=public.fixture_uuid(5941) FROM public.encounters WHERE id=public.fixture_uuid(934))
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(934) AND event_type='weapon_attack')
 AND (SELECT count(*)=2 FROM public.encounter_command_requests WHERE encounter_id=public.fixture_uuid(934) AND result IS NOT NULL)" "hit applied once and turn moved"
echo 'PASS: original weapon attack dealt deterministic damage and End Turn advanced'
echo 'WEAPON CASE 28: weapon attacker P lock precedes concurrent End Turn'
attack_first(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';
 SELECT id FROM public.encounter_participants WHERE id=public.fixture_uuid(5942) FOR UPDATE;
 SELECT pg_sleep(0.62);
 SELECT public.encounter_weapon_attack_v1(public.fixture_uuid(5942),public.fixture_uuid(5943),public.fixture_uuid(6999),public.fixture_uuid(8943));
 COMMIT;" >"$tmp/28.attack" 2>&1
}
attack_first & a=$!
sleep 0.15
endturn 5942 8944 "$tmp/28.end" & b=$!
wait "$a";wait "$b"
check "(SELECT current_hp=9 FROM public.encounter_participants WHERE id=public.fixture_uuid(5943))
 AND (SELECT active_participant_id=public.fixture_uuid(5943) FROM public.encounters WHERE id=public.fixture_uuid(935))
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(935) AND event_type='weapon_attack')
 AND (SELECT count(*)=2 FROM public.encounter_command_requests WHERE encounter_id=public.fixture_uuid(935) AND result IS NOT NULL)" "attack then end serialized, no duplicate"
echo 'PASS: original Weapon Attack before End Turn serialized at acting P'
echo 'WEAPON CASE 29: Weapon Attack versus Dodge consumes one Action, losing RPC rolls back request'
attack_first_action(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';
 SELECT id FROM public.encounter_participants WHERE id=public.fixture_uuid(5944) FOR UPDATE;
 SELECT pg_sleep(0.62);
 SELECT public.encounter_weapon_attack_v1(public.fixture_uuid(5944),public.fixture_uuid(5945),public.fixture_uuid(6999),public.fixture_uuid(8945));
 COMMIT;" >"$tmp/29.attack" 2>&1
}
dodge_second(){
 psqlq -c "SELECT public.encounter_use_core_action_v1(public.fixture_uuid(5944),'dodge',public.fixture_uuid(8946));" >"$tmp/29.dodge" 2>&1
}
set +e
attack_first_action & a=$!
sleep 0.15
dodge_second & b=$!
wait "$a";ra=$?
wait "$b";rb=$?
set -e
[[ "$ra" == 0 && "$rb" != 0 ]] || { cat "$tmp/29.attack" "$tmp/29.dodge";exit 1; }
grep -q 'Action already spent' "$tmp/29.dodge" || { cat "$tmp/29.dodge";exit 1; }
check "(SELECT current_hp=9 FROM public.encounter_participants WHERE id=public.fixture_uuid(5945))
 AND (SELECT action_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5944))
 AND (SELECT active_participant_id=public.fixture_uuid(5944) FROM public.encounters WHERE id=public.fixture_uuid(936))
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(936) AND event_type='weapon_attack')
 AND (SELECT count(*)=0 FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8946))" "second competing action rolled back"
echo 'PASS: competing public Action rejected and ledger insertion rolled back'
echo 'PASS: real weapon-attack function cases 27-29 with mocked attack/damage helpers; no live SQL.'
