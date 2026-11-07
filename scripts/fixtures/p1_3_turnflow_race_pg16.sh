#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != '127.0.0.1' && "$PGHOST" != 'localhost' ]] || [[ "$PGDATABASE" != 'p13_live_source_sandbox' ]] || [[ "$PGUSER" != 'postgres' ]];then
 echo 'REFUSED: scratch local PostgreSQL 16 only' >&2;exit 1
fi
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
check(){ psqlq -c "DO \$test\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'turn flow fixture failed: $2'; END IF; END \$test\$;"; }
move(){ local actor="$1" dest="$2" req="$3" out="$4";psqlq -c "SELECT public.encounter_move_active_participant_v1(public.fixture_uuid($actor),('[{\"q\":$dest,\"r\":0}]')::jsonb,public.fixture_uuid($req));" >"$out" 2>&1; }
endturn(){ local actor="$1" req="$2" out="$3";psqlq -c "SELECT public.encounter_end_turn_v1(public.fixture_uuid($actor),public.fixture_uuid($req));" >"$out" 2>&1; }
react(){ local wid="$1" req="$2" out="$3";psqlq -c "SELECT public.encounter_resolve_opportunity_reaction_v1('$wid'::uuid,'pass',NULL::uuid,public.fixture_uuid($req));" >"$out" 2>&1; }
echo 'TURN-FLOW CASE 22: exact public Move then End Turn'
move 5930 1 8930 "$tmp/22.move"
endturn 5930 8931 "$tmp/22.end"
check "(SELECT q=1 AND r=0 AND movement_spent_ft=5 FROM public.encounter_participants WHERE id=public.fixture_uuid(5930))
 AND (SELECT active_participant_id=public.fixture_uuid(5931) FROM public.encounters WHERE id=public.fixture_uuid(930))
 AND (SELECT count(*)=2 FROM public.encounter_command_requests WHERE encounter_id=public.fixture_uuid(930) AND result IS NOT NULL)
 AND (SELECT count(*)=0 FROM public.encounter_reaction_windows WHERE encounter_id=public.fixture_uuid(930))" "committed move/end"
echo 'PASS: Move advanced a hex; End Turn advanced actor once'
echo 'TURN-FLOW CASE 23: real Dodge versus real End Turn on same actor'
core_first(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';
 SELECT id FROM public.encounter_participants WHERE id=public.fixture_uuid(5932) FOR UPDATE;
 SELECT pg_sleep(0.60);
 SELECT public.encounter_use_core_action_v1(public.fixture_uuid(5932),'dodge',public.fixture_uuid(8932));
 COMMIT;" >"$tmp/23.core" 2>&1
}
core_first & pa=$!
sleep 0.14
endturn 5932 8933 "$tmp/23.end" & pb=$!
wait "$pa";wait "$pb"
check "(SELECT active_participant_id=public.fixture_uuid(5933) FROM public.encounters WHERE id=public.fixture_uuid(931))
 AND (SELECT action_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5932))
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(931) AND event_type='core_action')
 AND (SELECT count(*)=2 FROM public.encounter_command_requests WHERE encounter_id=public.fixture_uuid(931) AND result IS NOT NULL)" "core/turn serialized"
echo 'PASS: P lock serialized Dodge then End Turn'
echo 'TURN-FLOW CASE 24: actual Move opens reaction; End Turn blocked until real Reaction Pass'
move 5934 -1 8934 "$tmp/24.move"
window24=$(psqlq -c "SELECT id FROM public.encounter_reaction_windows WHERE encounter_id=public.fixture_uuid(932) AND status='pending'")
[[ -n "$window24" ]] || { echo 'missing real movement reaction window';cat "$tmp/24.move";exit 1; }
check "(SELECT result->>'reactionRequired'='true' FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8934))
 AND (SELECT q=0 AND r=0 FROM public.encounter_participants WHERE id=public.fixture_uuid(5934))" "pending window blocks departing hex"
set +e
endturn 5934 8935 "$tmp/24.blocked";blocked_rc=$?
set -e
[[ "$blocked_rc" != 0 ]] && grep -q 'Resolve the pending reaction before ending the turn' "$tmp/24.blocked" || { cat "$tmp/24.blocked";exit 1; }
check "(SELECT count(*)=0 FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8935))
 AND (SELECT active_participant_id=public.fixture_uuid(5934) FROM public.encounters WHERE id=public.fixture_uuid(932))" "blocked request rolled back"
react "$window24" 8936 "$tmp/24.pass"
endturn 5934 8937 "$tmp/24.end"
check "(SELECT active_participant_id=public.fixture_uuid(5935) FROM public.encounters WHERE id=public.fixture_uuid(932))
 AND (SELECT status='resolved' AND choice='pass' FROM public.encounter_reaction_windows WHERE id='$window24'::uuid)
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(932) AND event_type='reaction_pass')" "reaction pass/end"
echo 'PASS: real Move opened OA window; End Turn waited for original Reaction Pass'
echo 'TURN-FLOW CASE 25: concurrent original Reaction Pass and End Turn serialize over W/P'
move 5936 -1 8938 "$tmp/25.move"
window25=$(psqlq -c "SELECT id FROM public.encounter_reaction_windows WHERE encounter_id=public.fixture_uuid(933) AND status='pending'")
[[ -n "$window25" ]] || { echo 'missing pending OA window';cat "$tmp/25.move";exit 1; }
reaction_first(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';
 SELECT id FROM public.encounter_reaction_windows WHERE id='$window25'::uuid FOR UPDATE;
 SELECT id FROM public.encounter_participants WHERE id=public.fixture_uuid(5937) FOR UPDATE;
 SELECT id FROM public.encounter_participants WHERE id=public.fixture_uuid(5936) FOR UPDATE;
 SELECT pg_sleep(0.60);
 SELECT public.encounter_resolve_opportunity_reaction_v1('$window25'::uuid,'pass',NULL::uuid,public.fixture_uuid(8939));
 COMMIT;" >"$tmp/25.react" 2>&1
}
reaction_first & pa=$!
sleep 0.14
endturn 5936 8940 "$tmp/25.end" & pb=$!
wait "$pa";wait "$pb"
check "(SELECT active_participant_id=public.fixture_uuid(5937) FROM public.encounters WHERE id=public.fixture_uuid(933))
 AND (SELECT status='resolved' AND choice='pass' FROM public.encounter_reaction_windows WHERE id='$window25'::uuid)
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(933) AND event_type='reaction_pass')
 AND (SELECT count(*)=2 FROM public.encounter_command_requests WHERE encounter_id=public.fixture_uuid(933) AND command_type IN ('end_turn','reaction') AND result IS NOT NULL)" "reaction and end ordered"
echo 'PASS: same-row W/P locks serialized reaction before end'
echo 'TURN-FLOW CASE 26: cross-actor end-turn replay returns original result'
replay_other=$(psqlq -c "SELECT (public.encounter_end_turn_v1(public.fixture_uuid(5937),public.fixture_uuid(8931))->>'nextParticipantId')=public.fixture_uuid(5931)::text")
[[ "$replay_other" == 't' ]] || { echo "Unexpected cached replay $replay_other";exit 1; }
check "(SELECT participant_id=public.fixture_uuid(5930) AND result->>'nextParticipantId'=public.fixture_uuid(5931)::text FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8931))
 AND (SELECT count(*)=0 FROM public.encounter_command_requests WHERE participant_id=public.fixture_uuid(5937) AND command_type='end_turn')" "request ID reused without participant binding"
echo 'PASS: original end-turn replay lacks actor binding; mock auth, not a tested signed-in exploit'
echo 'PASS: source-derived Move/Core/End/Reaction/replay cases 22-26, local scratch PG only.'
