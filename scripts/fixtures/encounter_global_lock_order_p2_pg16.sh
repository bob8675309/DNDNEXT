#!/usr/bin/env bash
set -euo pipefail
# Disposable PostgreSQL CI illustration only, NOT a test of installed encounter RPCs.
# Every participating command must adopt the same order for this analogy to apply.
if [[ "$PGHOST" != "localhost" && "$PGHOST" != "127.0.0.1" ]] ||
   [[ "$PGDATABASE" != "fire_bolt_p2" ]]; then
  echo "Refusing: requires disposable local fire_bolt_p2 database" >&2; exit 1
fi
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
create schema p2_global_lock_demo;
create table p2_global_lock_demo.encounter (id integer primary key, revision integer not null default 0);
create table p2_global_lock_demo.participant (id integer primary key, encounter_id integer not null, revision integer not null default 0);
insert into p2_global_lock_demo.encounter(id) values(1);
insert into p2_global_lock_demo.participant(id,encounter_id) values(11,1),(12,1),(13,1);

-- Stand-in for the live turn-start trigger: updating the encounter may mutate
-- a DIFFERENT participant from the original actor. Each transaction must
-- acquire encounter lock before any participant row to avoid actor inversion.
create function p2_global_lock_demo.on_encounter_update() returns trigger
language plpgsql as $$
begin
  update p2_global_lock_demo.participant set revision=revision+1 where id=13;
  return new;
end $$;
create trigger turn_start_effect after update of revision on p2_global_lock_demo.encounter
for each row execute function p2_global_lock_demo.on_encounter_update();
SQL
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
run_one(){
  local actor="$1" output="$2"
  psql -X -v ON_ERROR_STOP=1 -qAt >"$output" 2>&1 <<SQL
begin;
set local lock_timeout='8s';
-- Proposed encounter-first order, unlike any current public RPC.
update p2_global_lock_demo.encounter set revision=revision+1 where id=1;
select pg_sleep(0.3);
update p2_global_lock_demo.participant set revision=revision+1 where id=$actor;
commit;
SQL
}
run_one 11 "$tmp/a" & pid_a=$!
run_one 12 "$tmp/b" & pid_b=$!
wait "$pid_a" || { cat "$tmp/a"; exit 1; }
wait "$pid_b" || { cat "$tmp/b"; exit 1; }
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
do $test$
begin
  if (select revision from p2_global_lock_demo.encounter where id=1)<>2
    or (select revision from p2_global_lock_demo.participant where id=11)<>1
    or (select revision from p2_global_lock_demo.participant where id=12)<>1
    or (select revision from p2_global_lock_demo.participant where id=13)<>2
  then raise exception 'Encounter-first demo failed: lost write or trigger side-effect'; end if;
  raise notice 'PASS: two independent encounter-first sessions and cross-actor trigger serialized without lost writes';
end $test$;
SQL
echo "PASS: miniature encounter-first lock-order demonstration; NOT proof that all legacy RPCs are safe"
