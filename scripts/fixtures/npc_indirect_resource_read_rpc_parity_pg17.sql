-- P2 extra indirect resource-read RPCs: original READ-ONLY production source.
-- Local test environment ONLY, never deployed. Helpers execute when access
-- is authorized; delegated-only callers must be denied BEFORE those helpers.
alter table public.inventory_items
 add column owner_id text,
 add column owner_type text,
 add column created_at timestamptz not null default now();
update public.inventory_items
 set owner_id=public.p2_id(32)::text,owner_type='npc'
 where id=public.p2_id(1998);
create table public.character_currency(
 character_id uuid primary key, copper_value bigint not null,
 source_breakdown jsonb not null default '{}'::jsonb
);
insert into public.character_currency(character_id,copper_value,source_breakdown)
values(public.p2_id(32),100000,'{"gmOnly":"NPC_CURRENCY_SECRET"}'::jsonb);

-- exact live definition MD5 ac70e4ec033d86c4e0a254d50d429a45
CREATE OR REPLACE FUNCTION private.can_manage_character_progression_v1(p_character_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select private.current_user_is_admin()
    or exists (
      select 1 from public.character_permissions cp
      where cp.character_id = p_character_id
        and cp.user_id = auth.uid()
        and cp.can_edit
    );
$function$;

-- exact live definition MD5 5f459de66d5b429ddbd5ee629fbc9ef1
CREATE OR REPLACE FUNCTION public.character_equipment_effects_v1(p_character_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
begin
  if p_character_id is null then raise exception 'Character is required'; end if;
  if coalesce(auth.role(),'')<>'service_role'
     and not coalesce(private.current_user_is_admin(),false)
     and not coalesce(private.can_access_character_v1(p_character_id,'read'),false) then
    raise exception 'Not authorized to view character equipment effects' using errcode='42501';
  end if;
  return private.character_equipment_effects_v1(p_character_id);
end;
$function$;
revoke all on function public.character_equipment_effects_v1(uuid) from public,anon;
grant execute on function public.character_equipment_effects_v1(uuid) to authenticated;

-- exact live definition MD5 7f1fb0b71ec2ff91d0f2a213afa02ecf
CREATE OR REPLACE FUNCTION public.character_sheet_resource_profile_v1(p_character_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to manage this character''s resources.' using errcode='42501';
  end if;
  perform private.sync_character_spell_slots_v1(p_character_id);
  return private.character_sheet_resource_profile_json_v1(p_character_id);
end;
$function$;
revoke all on function public.character_sheet_resource_profile_v1(uuid) from public,anon;
grant execute on function public.character_sheet_resource_profile_v1(uuid) to authenticated;

-- exact live definition MD5 b846e3b2a2e94bfd905da6da64ea6e0d
CREATE OR REPLACE FUNCTION public.character_sheet_resource_profile_v2(p_character_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_profile jsonb;
  v_active jsonb;
  v_mastery jsonb;
begin
  v_profile:=public.character_sheet_resource_profile_v1(p_character_id);
  v_active:=private.character_active_encounter_v1(p_character_id);
  v_mastery:=private.character_spell_mastery_profile_v1(p_character_id);
  return coalesce(v_profile,'{}'::jsonb)||jsonb_build_object(
    'resourceBridgeVersion',1,
    'encounterLocked',v_active is not null,
    'activeEncounter',v_active,
    'spellMastery',v_mastery
  );
end;
$function$;
revoke all on function public.character_sheet_resource_profile_v2(uuid) from public,anon;
grant execute on function public.character_sheet_resource_profile_v2(uuid) to authenticated;

-- exact live definition MD5 3b6361dcdce22bb8cb4a0602d51c34d0
CREATE OR REPLACE FUNCTION public.get_character_currency_v1(p_character_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_row public.character_currency%rowtype;
begin
  if not private.can_access_character_v1(p_character_id,'inventory') then
    raise exception 'You do not have permission to view this character currency.' using errcode='42501';
  end if;
  select * into v_row from public.character_currency where character_id=p_character_id;
  if not found then
    return jsonb_build_object(
      'characterId',p_character_id,
      'hasBalance',false,
      'copperValue',0,
      'display','0 gp',
      'sourceBreakdown','{}'::jsonb
    );
  end if;
  return jsonb_build_object(
    'characterId',p_character_id,
    'hasBalance',true,
    'copperValue',v_row.copper_value,
    'display',private.format_copper_currency_v1(v_row.copper_value),
    'sourceBreakdown',coalesce(v_row.source_breakdown,'{}'::jsonb)
  );
end;
$function$;
revoke all on function public.get_character_currency_v1(uuid) from public,anon;
grant execute on function public.get_character_currency_v1(uuid) to authenticated;

-- exact live definition MD5 d958dc1b685836117421fea5b8749478
CREATE OR REPLACE FUNCTION public.get_character_inventory_v1(p_character_id uuid)
 RETURNS SETOF inventory_items
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_service_role boolean := coalesce(auth.jwt()->>'role', '') = 'service_role';
begin
  if p_character_id is null then
    raise exception 'Character is required';
  end if;
  if not v_service_role
     and (auth.uid() is null or not coalesce(private.can_access_character_v1(p_character_id, 'inventory'), false)) then
    raise exception 'Not authorized to view this character inventory' using errcode = '42501';
  end if;

  return query
    select i.*
    from public.inventory_items i
    where (
      i.owner_id = p_character_id::text
      and lower(coalesce(i.owner_type, '')) in ('npc', 'merchant', 'character')
    ) or (
      lower(coalesce(i.owner_type, '')) = 'player'
      and exists (
        select 1
        from public.character_permissions cp
        where cp.character_id = p_character_id
          and coalesce(cp.can_edit, false)
          and i.owner_id = cp.user_id::text
      )
    )
    order by i.created_at desc, i.id;
end;
$function$;
revoke all on function public.get_character_inventory_v1(uuid) from public,anon;
grant execute on function public.get_character_inventory_v1(uuid) to authenticated;
do $checks$
begin
 if has_function_privilege('anon','public.get_character_inventory_v1(uuid)','EXECUTE')
 or has_function_privilege('anon','public.get_character_currency_v1(uuid)','EXECUTE')
 or has_function_privilege('anon','public.character_equipment_effects_v1(uuid)','EXECUTE')
 or has_function_privilege('anon','public.character_sheet_resource_profile_v1(uuid)','EXECUTE')
 or has_function_privilege('anon','public.character_sheet_resource_profile_v2(uuid)','EXECUTE')
 then raise exception 'Anonymous sensitive resource read incorrectly exposed'; end if;
end $checks$;
notify pgrst,'reload schema';
