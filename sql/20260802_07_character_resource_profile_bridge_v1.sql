begin;

-- Preserve the existing public name used by Sheet & Rolls while enriching the profile
-- with active battle-board ownership metadata. Mutation guards remain trigger-owned.
create or replace function public.character_sheet_resource_profile_v1(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_profile jsonb;
  v_active jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to manage this character''s resources.' using errcode='42501';
  end if;
  perform private.sync_character_spell_slots_v1(p_character_id);
  v_profile:=private.character_sheet_resource_profile_json_v1(p_character_id);
  v_active:=private.character_active_encounter_v1(p_character_id);
  return coalesce(v_profile,'{}'::jsonb)||jsonb_build_object(
    'resourceBridgeVersion',1,
    'encounterLocked',v_active is not null,
    'activeEncounter',v_active
  );
end;
$function$;

revoke all on function public.character_sheet_resource_profile_v1(uuid) from public, anon;
grant execute on function public.character_sheet_resource_profile_v1(uuid) to authenticated, service_role;

comment on function public.character_sheet_resource_profile_v1(uuid) is
  'Returns persistent character resources plus active battle-board ownership metadata.';

do $postconditions$
begin
  if not has_function_privilege('authenticated','public.character_sheet_resource_profile_v1(uuid)','EXECUTE') then
    raise exception 'character resource profile v1 grant missing';
  end if;
  if has_function_privilege('anon','public.character_sheet_resource_profile_v1(uuid)','EXECUTE') then
    raise exception 'anon must not read character resource profile v1';
  end if;
end;
$postconditions$;

commit;
