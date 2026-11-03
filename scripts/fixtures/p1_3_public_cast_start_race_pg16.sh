#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != "127.0.0.1" && "$PGHOST" != "localhost" ]] ||
 [[ "$PGDATABASE" != "p13_live_source_sandbox" ]] || [[ "$PGUSER" != "postgres" ]]; then
 echo "REFUSED: local disposable PG16 only" >&2;exit 1
fi
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT
psqlq(){ psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
check(){ psqlq -c "DO \$test\$ BEGIN IF NOT ($1) THEN RAISE EXCEPTION 'Public cast fixture failed: $2'; END IF; END \$test\$;"; }
start(){
 psqlq -c "SELECT public.admin_start_encounter_v1(public.fixture_uuid($1));" >"$2" 2>&1
}
cast(){
 psqlq -c "SELECT public.encounter_cast_spell_v13(public.fixture_uuid($1),public.fixture_uuid($2),public.fixture_uuid($1),1,public.fixture_uuid($3));" >"$4" 2>&1
}
echo "PUBLIC CAST CASE 19: exact Admin Start/activation refresh THEN exact public Healing Word v13, valid active turn"
start 920 "$tmp/sequential-start"
cast 5920 6914 7920 "$tmp/sequential-cast"
check "(SELECT status='active' AND active_participant_id=public.fixture_uuid(5920) FROM public.encounters WHERE id=public.fixture_uuid(920))
 AND (SELECT slots_remaining=0 FROM public.character_spell_slots WHERE character_id=public.fixture_uuid(14))
 AND (SELECT slots_remaining=0 FROM public.encounter_spell_slots WHERE participant_id=public.fixture_uuid(5920))
 AND (SELECT bonus_action_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5920))
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(920) AND event_type='spell_cast')
 AND (SELECT count(*)=1 FROM public.encounter_command_requests WHERE encounter_id=public.fixture_uuid(920) AND result IS NOT NULL)" "real public cast, snapshot refresh and persistent spend complete"
echo "PASS: fully active public Healing Word cast consumed exactly one canonical slot"
echo "PUBLIC CAST CASE 20: concurrent public Start E->P and public Healing Word v13 P->E"
start_held_e(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';SET LOCAL deadlock_timeout='150ms';
 SELECT id FROM public.encounters WHERE id=public.fixture_uuid(921) FOR UPDATE;
 SELECT pg_sleep(0.72);
 SELECT public.admin_start_encounter_v1(public.fixture_uuid(921));
 COMMIT;" >"$tmp/start-race" 2>&1
}
cast_held_p(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';SET LOCAL deadlock_timeout='150ms';
 SELECT public.encounter_cast_spell_v13(public.fixture_uuid(5921),public.fixture_uuid(6915),public.fixture_uuid(5921),1,public.fixture_uuid(7921));
 COMMIT;" >"$tmp/cast-race" 2>&1
}
set +e
start_held_e & pa=$!
sleep 0.17
cast_held_p & pb=$!
wait "$pa";ra=$?
wait "$pb";rb=$?
set -e
if [[ "$ra" == 0 && "$rb" == 0 ]] || ! grep -qi "deadlock detected" "$tmp/start-race" "$tmp/cast-race"; then
 echo "Expected actual PostgreSQL deadlock from original public Start and Cast row ordering"
 cat "$tmp/start-race" "$tmp/cast-race";exit 1
fi
check "(SELECT slots_remaining=1 FROM public.character_spell_slots WHERE character_id=public.fixture_uuid(15))
 AND (SELECT bonus_action_available=true FROM public.encounter_participants WHERE id=public.fixture_uuid(5921))
 AND (SELECT count(*)=0 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(921) AND event_type='spell_cast')
 AND (SELECT (status='draft' AND (SELECT count(*)=0 FROM public.encounter_spell_slots WHERE participant_id=public.fixture_uuid(5921))) OR
 (status='active' AND (SELECT count(*)=1 FROM public.encounter_spell_slots WHERE participant_id=public.fixture_uuid(5921) AND slots_remaining=1))
 FROM public.encounters WHERE id=public.fixture_uuid(921))" "deadlock abort cannot spend a slot or leave partial cast"
echo "PASS: original public Start E->P and public Cast P->E deadlocked under forced overlap; no half-cast"
echo "PUBLIC CAST CASE 21: paused->active public status RPC vs public Healing Word cast, valid turn AFTER resume"
resume_held_e(){
 psqlq -c "BEGIN;SET LOCAL lock_timeout='6s';
 SELECT id FROM public.encounters WHERE id=public.fixture_uuid(922) FOR UPDATE;
 SELECT pg_sleep(0.65);
 SELECT public.admin_set_encounter_status_v1(public.fixture_uuid(922),'active');
 COMMIT;" >"$tmp/resume" 2>&1
}
resume_held_e & pa=$!
sleep 0.16
cast 5922 6916 7922 "$tmp/resumed-cast" & pb=$!
wait "$pa";wait "$pb"
check "(SELECT status='active' AND active_participant_id=public.fixture_uuid(5922) FROM public.encounters WHERE id=public.fixture_uuid(922))
 AND (SELECT slots_remaining=0 FROM public.character_spell_slots WHERE character_id=public.fixture_uuid(16))
 AND (SELECT slots_remaining=0 FROM public.encounter_spell_slots WHERE participant_id=public.fixture_uuid(5922))
 AND (SELECT bonus_action_available=false FROM public.encounter_participants WHERE id=public.fixture_uuid(5922))
 AND (SELECT count(*)=1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(922) AND event_type='spell_cast')" "resume serialized before the cast's active-turn validation"
echo "PASS: resume E lock serialized cast; valid turn after resume, snapshot and C spend consistent"
echo "PASS exact public Start/Resume + Healing Word v13 integration cases 19-21; not real GoTrue auth."
