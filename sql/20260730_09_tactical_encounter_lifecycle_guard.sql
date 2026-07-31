begin;

create or replace function public.admin_set_encounter_status_v1(
  p_encounter_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_current text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  if p_status not in ('draft','ready','initiative','active','paused','resolved','archived') then raise exception 'Invalid encounter status'; end if;

  select status into v_current from public.encounters where id=p_encounter_id for update;
  if not found then raise exception 'Encounter not found'; end if;
  if v_current='archived' and p_status <> 'archived' then raise exception 'Archived encounters cannot be reopened'; end if;

  -- Preserve the v1 compatibility entry point, but staged -> active must use
  -- the same atomic authority as the Milestone 2 Start Encounter command.
  if p_status='active' and v_current in ('draft','ready','initiative') then
    perform public.admin_start_encounter_v1(p_encounter_id);
    return;
  end if;

  if p_status='active' and not exists(select 1 from public.encounter_participants where encounter_id=p_encounter_id) then raise exception 'Add at least one participant before activation'; end if;

  update public.encounters
  set status=p_status,
      phase=case p_status when 'draft' then 'staging' when 'ready' then 'staging' when 'initiative' then 'initiative' when 'active' then 'turns' when 'paused' then 'paused' when 'resolved' then 'resolved' else 'archived' end,
      round=case when p_status='active' and round=0 then 1 else round end,
      started_at=case when p_status='active' then coalesce(started_at,timezone('utc',now())) else started_at end,
      resolved_at=case when p_status='resolved' then timezone('utc',now()) when p_status not in ('resolved','archived') then null else resolved_at end,
      version=version+1,
      updated_at=timezone('utc',now())
  where id=p_encounter_id;
end;
$function$;

revoke all on function public.admin_set_encounter_status_v1(uuid,text) from public, anon;
grant execute on function public.admin_set_encounter_status_v1(uuid,text) to authenticated, service_role;

do $validation$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.admin_set_encounter_status_v1(uuid,text)'::regprocedure)
    into v_definition;
  if position('admin_start_encounter_v1' in v_definition) = 0 then
    raise exception 'Legacy status RPC must delegate staged activation to durable start authority';
  end if;
  if has_function_privilege('anon','public.admin_set_encounter_status_v1(uuid,text)','EXECUTE') then
    raise exception 'anon must not invoke encounter status RPC';
  end if;
  if not has_function_privilege('authenticated','public.admin_set_encounter_status_v1(uuid,text)','EXECUTE') then
    raise exception 'authenticated role must be able to invoke guarded encounter status RPC';
  end if;
end;
$validation$;

commit;
