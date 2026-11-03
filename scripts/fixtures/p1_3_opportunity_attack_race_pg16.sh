#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != '127.0.0.1' && "$PGHOST" != 'localhost' ]] || [[ "$PGDATABASE" != 'p13_live_source_sandbox' ]] || [[ "$PGUSER" != 'postgres' ]]; then
 echo 'REFUSED: disposable scratch PostgreSQL 16 only' >&2; exit 1
fi
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
check(){ psqlq -c "DO \$test\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'OA fixture check failed: $2'; END IF; END \$test\$;"; }
move(){ local mover="$1" req="$2" output="$3"; psqlq -c "SELECT public.encounter_move_active_participant_v1(public.fixture_uuid($mover),'[{\"q\":-1,\"r\":0}]'::jsonb,public.fixture_uuid($req));" >"$output" 2>&1; }
attack(){ local window="$1" req="$2" output="$3"; psqlq -c "SELECT public.encounter_resolve_opportunity_reaction_v1('$window'::uuid,'attack',public.fixture_uuid(6999),public.fixture_uuid($req));" >"$output" 2>&1; }
endturn(){ local actor="$1" req="$2" output="$3";psqlq -c "SELECT public.encounter_end_turn_v1(public.fixture_uuid($actor),public.fixture_uuid($req));" >"$output" 2>&1; }
echo 'REACTION ATTACK CASE 30: public Move opens actual window, exact Attack resolves, End Turn succeeds'
move 5950 8950 "$tmp/30.move"
window30=$(psqlq -c "SELECT id FROM public.encounter_reaction_windows WHERE encounter_id=public.fixture_uuid(937) AND status='pending'")
[[ -n "$window30" ]] || { cat "$tmp/30.move";exit 1; }
attack "$window30" 8951 "$tmp/30.attack"
endturn 5950 8952 "$tmp/30.end"
check "(SELECT status='resolved' AND choice='attack' AND (result->'attack'->>'hit')::boolean=true FROM public.encounter_reaction_windows WHERE id='$window30'::uuid)
 AND (SELECT reaction_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5951))
 AND (SELECT current_hp=9 FROM public.encounter_participants WHERE id=public.fixture_uuid(5950))
 AND (SELECT active_participant_id=public.fixture_uuid(5951) FROM public.encounters WHERE id=public.fixture_uuid(937))
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(937) AND event_type='opportunity_attack')
 AND (SELECT count(*)=3 FROM public.encounter_command_requests WHERE encounter_id=public.fixture_uuid(937) AND result IS NOT NULL)" "actual OA attack and turn must commit once"
echo 'PASS: original opportunity Attack consumed Reaction and applied deterministic damage once'
echo 'REACTION ATTACK CASE 31: concurrent Attack W->P and End Turn P->E'
move 5952 8953 "$tmp/31.move"
window31=$(psqlq -c "SELECT id FROM public.encounter_reaction_windows WHERE encounter_id=public.fixture_uuid(938) AND status='pending'")
[[ -n "$window31" ]] || { cat "$tmp/31.move";exit 1; }
attack_first(){
 psqlq -c "BEGIN; SET LOCAL lock_timeout='6s';
 SELECT id FROM public.encounter_reaction_windows WHERE id='$window31'::uuid FOR UPDATE;
 SELECT id FROM public.encounter_participants WHERE id=public.fixture_uuid(5953) FOR UPDATE;
 SELECT id FROM public.encounter_participants WHERE id=public.fixture_uuid(5952) FOR UPDATE;
 SELECT pg_sleep(0.60);
 SELECT public.encounter_resolve_opportunity_reaction_v1('$window31'::uuid,'attack',public.fixture_uuid(6999),public.fixture_uuid(8954));
 COMMIT;" >"$tmp/31.attack" 2>&1
}
attack_first & pa=$!
sleep 0.14
endturn 5952 8955 "$tmp/31.end" & pb=$!
wait "$pa";wait "$pb"
check "(SELECT status='resolved' AND choice='attack' FROM public.encounter_reaction_windows WHERE id='$window31'::uuid)
 AND (SELECT current_hp=9 FROM public.encounter_participants WHERE id=public.fixture_uuid(5952))
 AND (SELECT reaction_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5953))
 AND (SELECT active_participant_id=public.fixture_uuid(5953) FROM public.encounters WHERE id=public.fixture_uuid(938))
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(938) AND event_type='opportunity_attack')
 AND (SELECT count(*)=3 FROM public.encounter_command_requests WHERE encounter_id=public.fixture_uuid(938) AND result IS NOT NULL)" "attack and end race must serialize"
echo 'PASS: original reaction Attack serialized before End Turn on shared W/P'
echo 'REACTION ATTACK CASE 32: resolved result returned on changed choice, request id and mock caller'
psqlq -c "BEGIN;
 SET LOCAL dndnext.fixture_user_id='00000000-0000-0000-0000-000000000998';
 DO \$verify\$
 DECLARE v_result jsonb;
 BEGIN
 v_result:=public.encounter_resolve_opportunity_reaction_v1('$window30'::uuid,'pass',NULL::uuid,public.fixture_uuid(8956));
 IF v_result->>'choice'<>'attack' OR v_result->'attack' IS NULL THEN
  RAISE EXCEPTION 'resolved result not returned from alternate caller/choice';
 END IF;
 END \$verify\$;
 COMMIT;" >"$tmp/32.replay" 2>&1
check "(SELECT status='resolved' AND choice='attack' FROM public.encounter_reaction_windows WHERE id='$window30'::uuid)
 AND (SELECT count(*)=0 FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8956))
 AND (SELECT current_hp=9 FROM public.encounter_participants WHERE id=public.fixture_uuid(5950))
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(937) AND event_type='opportunity_attack')" "replay must not mutate anything"
echo 'PASS: resolved OA result returned for altered choice/request/mock identity before auth check; signed-in exploit NOT tested'
echo 'PASS: exact opportunity attack source cases 30-32. All data isolated from production.'
