#!/usr/bin/env bash
set -euo pipefail
# P2 synthetic MODEL. Only PG16 local disposable 'fire_bolt_p2'.
# Not real DnDNext RPCs, not Supabase Auth, no writes to any real project.
if [[ "$PGDATABASE" != "fire_bolt_p2" ||
      ( "$PGHOST" != "localhost" && "$PGHOST" != "127.0.0.1" ) ]]; then
  echo "Refusing nonlocal/non-disposable PostgreSQL target" >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
create schema p2_shared_slot_demo;
create table p2_shared_slot_demo.character_slot (
  character_id integer primary key,
  remaining integer not null check(remaining between 0 and 2)
);
create table p2_shared_slot_demo.encounter_slot (
  encounter_id integer primary key,
  character_id integer not null,
  remaining integer not null check(remaining between 0 and 2)
);
insert into p2_shared_slot_demo.character_slot values(1,1);
insert into p2_shared_slot_demo.encounter_slot values(10,1,1),(20,1,1);
create function p2_shared_slot_demo.spend_one() returns trigger
language plpgsql as $body$
declare persistent_remaining integer;
begin
  if new.remaining >= old.remaining then return new; end if;
  select remaining into persistent_remaining
  from p2_shared_slot_demo.character_slot
  where character_id=new.character_id for update;
  if persistent_remaining < old.remaining-new.remaining then
    raise exception 'Synthetic persistent spell slots exhausted' using errcode='22023';
  end if;
  update p2_shared_slot_demo.character_slot
  set remaining=remaining-(old.remaining-new.remaining)
  where character_id=new.character_id;
  return new;
end $body$;
create trigger decrement_persistent
after update of remaining on p2_shared_slot_demo.encounter_slot
for each row execute function p2_shared_slot_demo.spend_one();
SQL
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
spend(){
  local encounter_id="$1" log="$2"
  psql -X -v ON_ERROR_STOP=1 -qAt >"$log" 2>&1 <<SQL
begin;
set local lock_timeout='8s';
-- Independent encounter-snapshot rows contend on one character row via trigger.
update p2_shared_slot_demo.encounter_slot
set remaining=remaining-1
where encounter_id=$encounter_id and remaining>0;
select pg_sleep(0.2);
commit;
SQL
}
set +e
spend 10 "$tmp/a" & pid_a=$!
spend 20 "$tmp/b" & pid_b=$!
wait "$pid_a"; rc_a=$?
wait "$pid_b"; rc_b=$?
set -e
if [[ "$rc_a" -eq "$rc_b" ]]; then
  cat "$tmp/a" "$tmp/b"
  echo "Expected exactly one success and one persistent-resource denial" >&2
  exit 1
fi
if [[ "$rc_a" -ne 0 ]] && ! grep -q 'Synthetic persistent spell slots exhausted' "$tmp/a"; then
  cat "$tmp/a"; exit 1
fi
if [[ "$rc_b" -ne 0 ]] && ! grep -q 'Synthetic persistent spell slots exhausted' "$tmp/b"; then
  cat "$tmp/b"; exit 1
fi
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
do $verify$
declare
  available integer;
  snapshot_sum integer;
  exhausted_count integer;
begin
  select remaining into available from p2_shared_slot_demo.character_slot where character_id=1;
  select sum(remaining),count(*) filter(where remaining=0)
    into snapshot_sum,exhausted_count from p2_shared_slot_demo.encounter_slot;
  if available<>0 or snapshot_sum<>1 or exhausted_count<>1 then
    raise exception 'Shared-slot spend failed atomic rollback: persistent %, snapshots total %, consumed %',
      available,snapshot_sum,exhausted_count;
  end if;
  raise notice 'PASS: exactly one cross-encounter spend committed, loser rolled back its snapshot; old independent snapshot remains stale';
end $verify$;
SQL
echo "P2 cross-encounter shared-resource trigger MODEL PASS (not live DnDNext auth/SQL)"
