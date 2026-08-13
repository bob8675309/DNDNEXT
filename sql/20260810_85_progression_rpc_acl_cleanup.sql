-- Harden the legacy level-class-choice compatibility getter without removing it.
-- Current clients still reference v1/v2/v3 as compatibility/fallback surfaces.
-- v2 was the only character-scoped progression RPC in this family that still
-- inherited anonymous execute. Preserve authenticated/service-role compatibility.

do $acl$
declare
  r record;
  v_found boolean:=false;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='get_character_level_class_choice_options_v2'
      and p.prokind='f'
  loop
    v_found:=true;
    execute format('revoke execute on function %s from public',r.signature);
    execute format('revoke execute on function %s from anon',r.signature);
    execute format('grant execute on function %s to authenticated',r.signature);
    execute format('grant execute on function %s to service_role',r.signature);
  end loop;

  if not v_found then
    raise exception 'Expected get_character_level_class_choice_options_v2 compatibility function is missing';
  end if;
end;
$acl$;
