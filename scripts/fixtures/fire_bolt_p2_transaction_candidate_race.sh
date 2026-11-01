#!/usr/bin/env bash
set -euo pipefail
# RESEARCH ONLY: two independent psql sessions using MOCK claims.
# No Supabase JWTs or live project; abort unless CI disposable PG fixture.
if [[ "${PGHOST:-}" != "localhost" && "${PGHOST:-}" != "127.0.0.1" ]] ||
   [[ "${PGDATABASE:-}" != "fire_bolt_p2" ]]; then
  echo "Refusing nonlocal or non-Fire-Bolt disposable database" >&2; exit 1
fi
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
psql -X -v ON_ERROR_STOP=1 -q -c "
  update public.character_progression set class_id=public.p2_id(71) where character_id=public.p2_id(31);
  update public.encounter_participants set action_available=true where id=public.p2_id(11);
  update public.encounter_participants set is_hidden=false where id=public.p2_id(21);
  update public.encounters set status='active', active_participant_id=public.p2_id(11) where id=public.p2_id(81);
"
before=$(psql -X -v ON_ERROR_STOP=1 -At -c "select version from public.encounters where id=public.p2_id(81);")
run_one(){
  local request="$1" logfile="$2"
  psql -X -v ON_ERROR_STOP=1 -qAt -c "
    select set_config('request.jwt.claim.role','authenticated',false);
    select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
    select set_config('fixture.attack_roll','1',false);
    set role authenticated;
    select private.encounter_cast_spell_v11_transaction_candidate_v1(
      public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id($request))::text;
  " >"$logfile" 2>&1
}
# Same request: exactly one commit; both return exactly the cached result.
run_one 200 "$tmp/dup1" & pid1=$!
run_one 200 "$tmp/dup2" & pid2=$!
wait "$pid1" || { cat "$tmp/dup1"; exit 1; }
wait "$pid2" || { cat "$tmp/dup2"; exit 1; }
tail -n1 "$tmp/dup1" >"$tmp/res1"
tail -n1 "$tmp/dup2" >"$tmp/res2"
cmp "$tmp/res1" "$tmp/res2"
psql -X -v ON_ERROR_STOP=1 -q -c "
do \$check\$
begin
  if (select count(*) from public.encounter_command_requests where request_id=public.p2_id(200))<>1
   or (select count(*) from public.encounter_combat_log
       where detail->>'requestId'=public.p2_id(200)::text)<>1
   or (select version from public.encounters where id=public.p2_id(81))<>$((before+1))
   or (select action_available from public.encounter_participants where id=public.p2_id(11))
  then raise exception 'Concurrent same-request cast double-mutated'; end if;
end \$check\$;"
echo "P2 same-request parallel calls: one action/log/version, identical response PASS"

# Different requests competing for the same Action: serialize on caster lock.
psql -X -v ON_ERROR_STOP=1 -q -c "
  update public.encounter_participants set action_available=true where id=public.p2_id(11);
"
before=$(psql -X -v ON_ERROR_STOP=1 -At -c "select version from public.encounters where id=public.p2_id(81);")
set +e
run_one 201 "$tmp/competitor1" & pid1=$!
run_one 202 "$tmp/competitor2" & pid2=$!
wait "$pid1"; rc1=$?
wait "$pid2"; rc2=$?
set -e
if [[ "$rc1" -eq "$rc2" ]]; then
  cat "$tmp/competitor1" "$tmp/competitor2"
  echo "Expected exactly one competing cast to succeed" >&2; exit 1
fi
if [[ "$rc1" -ne 0 ]] && ! grep -q 'Action already spent' "$tmp/competitor1"; then
  cat "$tmp/competitor1"; exit 1
fi
if [[ "$rc2" -ne 0 ]] && ! grep -q 'Action already spent' "$tmp/competitor2"; then
  cat "$tmp/competitor2"; exit 1
fi
psql -X -v ON_ERROR_STOP=1 -q -c "
do \$check\$
begin
  if (select count(*) from public.encounter_command_requests where request_id in (public.p2_id(201),public.p2_id(202)))<>1
   or (select count(*) from public.encounter_combat_log
       where detail->>'requestId' in (public.p2_id(201)::text,public.p2_id(202)::text))<>1
   or (select version from public.encounters where id=public.p2_id(81))<>$((before+1))
   or (select action_available from public.encounter_participants where id=public.p2_id(11))
  then raise exception 'Competing casts consumed more than one Action'; end if;
end \$check\$;"
echo "P2 competing different-request casts: exactly one Action/log/version PASS"
