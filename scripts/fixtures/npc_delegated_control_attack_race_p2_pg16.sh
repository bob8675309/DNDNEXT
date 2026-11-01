#!/usr/bin/env bash
set -euo pipefail
# Held SQL v11 + NPC permission candidate; two separate PostgreSQL clients
# with MOCK auth claims only. Local disposable CI database, NOT real GoTrue.
if [[ "$PGHOST" != "localhost" && "$PGHOST" != "127.0.0.1" ]] ||
   [[ "$PGDATABASE" != "fire_bolt_p2" ]]; then
  echo "Refusing non-local/non-disposable NPC battle control race" >&2
  exit 1
fi
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
insert into public.character_progression(character_id,class_id,class_level)
values(public.p2_id(32),public.p2_id(71),5);
insert into public.character_spells(
  id,character_id,spell_id,source_type,source_key,source_label,
  known,prepared,always_available,casting_stat
) values(public.p2_id(58),public.p2_id(32),public.p2_id(61),
  'class','wizard','wizard',true,false,false,'int');
update public.encounters
set status='active',active_participant_id=public.p2_id(33)
where id=public.p2_id(81);
update public.encounter_participants
set action_available=true,is_defeated=false
where id=public.p2_id(33);
update public.encounter_participants
set is_hidden=false,is_defeated=false,current_hp=100
where id=public.p2_id(21);
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub',public.p2_id(40)::text,false);
set role authenticated;
select public.admin_set_npc_control_v1(public.p2_id(32),public.p2_id(41),true);
reset role;
SQL
before=$(psql -X -v ON_ERROR_STOP=1 -At -c \
 "select version from public.encounters where id=public.p2_id(81);")
cast_for(){
  local user="$1" request="$2" log="$3"
  psql -X -v ON_ERROR_STOP=1 -qAt >"$log" 2>&1 <<SQL
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub',public.p2_id($user)::text,false);
select set_config('fixture.attack_roll','1',false);
set role authenticated;
select private.encounter_cast_spell_v11_transaction_candidate_v1(
  public.p2_id(33),public.p2_id(58),public.p2_id(21),null,public.p2_id($request))::text;
SQL
}
set +e
cast_for 41 310 "$tmp/one" & one_pid=$!
cast_for 43 311 "$tmp/two" & two_pid=$!
wait "$one_pid"; rc_one=$?
wait "$two_pid"; rc_two=$?
set -e
if [[ "$rc_one" -eq "$rc_two" ]]; then
  cat "$tmp/one" "$tmp/two"
  echo "Expected exactly one NPC controller to spend the Action" >&2; exit 1
fi
if [[ "$rc_one" -ne 0 ]] && ! grep -q 'Action already spent' "$tmp/one"; then
  cat "$tmp/one"; exit 1
fi
if [[ "$rc_two" -ne 0 ]] && ! grep -q 'Action already spent' "$tmp/two"; then
  cat "$tmp/two"; exit 1
fi
winner=41; request=310; loser=43
if [[ "$rc_one" -ne 0 ]]; then winner=43; request=311; loser=41; fi
psql -X -v ON_ERROR_STOP=1 -q <<SQL
do \$verify\$
begin
  if (select count(*) from public.encounter_command_requests
        where request_id in (public.p2_id(310),public.p2_id(311)))<>1
  or (select count(*) from public.encounter_combat_log
        where detail->>'requestId' in (public.p2_id(310)::text,public.p2_id(311)::text))<>1
  or (select version from public.encounters where id=public.p2_id(81))<>$((before+1))
  or (select action_available from public.encounter_participants
        where id=public.p2_id(33))
  or (select requested_by from public.encounter_command_requests
        where request_id=public.p2_id($request)) is distinct from public.p2_id($winner)
  then
    raise exception 'Two delegated controllers overspent one NPC Action, or ledger did not bind winner';
  end if;
end \$verify\$;
SQL
cast_for "$winner" "$request" "$tmp/retry"
set +e
cast_for "$loser" "$request" "$tmp/steal"
steal_rc=$?
set -e
if [[ "$steal_rc" -eq 0 ]] || ! grep -q 'Request belongs to another controller' "$tmp/steal"; then
  cat "$tmp/steal"; echo "Cross-user cached NPC result disclosure" >&2; exit 1
fi
psql -X -v ON_ERROR_STOP=1 -q <<SQL
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub',public.p2_id(40)::text,false);
set role authenticated;
select public.admin_set_npc_control_v1(public.p2_id(32),public.p2_id($winner),false);
reset role;
SQL
set +e
cast_for "$winner" "$request" "$tmp/revoked"
revoked_rc=$?
set -e
if [[ "$revoked_rc" -eq 0 ]] || ! grep -q 'Not authorized to control this participant' "$tmp/revoked"; then
  cat "$tmp/revoked"
  echo "Revoked NPC controller could replay cached result" >&2; exit 1
fi
psql -X -v ON_ERROR_STOP=1 -q <<SQL
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub',public.p2_id($loser)::text,false);
set role authenticated;
do \$verify\$
begin
  if not public.encounter_can_control_participant_v1(public.p2_id(33)) then
    raise exception 'Revoking one player incorrectly removed another controller'; end if;
end \$verify\$;
SQL
echo "PASS: delegated-player NPC race (one Action), owner-bound replay, revoked cached replay denied; actual held SQL, MOCK Auth, isolated PG16"
