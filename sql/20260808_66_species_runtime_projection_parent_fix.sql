-- jsonb_typeof() returns SQL NULL for a missing key. Migration 63 compared that
-- directly with 'object', which leaves the IF condition unknown and prevents a
-- missing runtimeProficiencies parent from being created. Normalize NULL before
-- the comparison so legacy/clean sheets receive the runtime projection.

create or replace function private.set_species_runtime_projection_v1(
  p_character_id uuid,
  p_projection_key text,
  p_state jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_sheet jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets
  where character_id=p_character_id
  for update;
  if v_sheet is null then return; end if;

  if coalesce(jsonb_typeof(v_sheet->'runtimeProficiencies'),'')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{runtimeProficiencies}','{}'::jsonb,true);
  end if;

  if p_state is null then
    v_sheet:=v_sheet #- array['runtimeProficiencies',p_projection_key];
  else
    v_sheet:=jsonb_set(v_sheet,array['runtimeProficiencies',p_projection_key],p_state,true);
  end if;

  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
end;
$$;

revoke all on function private.set_species_runtime_projection_v1(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.set_species_runtime_projection_v1(uuid,text,jsonb) to service_role;
