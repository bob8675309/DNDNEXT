-- Player character inventory access and class-aware unarmored AC.
--
-- Character records remain the canonical owner for linked player characters.
-- These RPCs expose only an assigned character's inventory and restrict equip
-- writes to equipment state. Existing inventory RLS policies remain unchanged.

begin;

create or replace function public.get_character_inventory_v1(p_character_id uuid)
returns setof public.inventory_items
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
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

create or replace function public.set_character_inventory_equipment_v1(
  p_character_id uuid,
  p_item_id uuid,
  p_is_equipped boolean,
  p_equip_slot text default null
)
returns public.inventory_items
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_service_role boolean := coalesce(auth.jwt()->>'role', '') = 'service_role';
  v_item public.inventory_items%rowtype;
  v_slot text := lower(nullif(btrim(coalesce(p_equip_slot, '')), ''));
  v_allowed_slots constant text[] := array[
    'face','throat','body','waist','hands','feet','head','shoulders','arms',
    'ring_1','ring_2','misc_1','misc_2','weapon_1','weapon_2','weapon_3'
  ];
begin
  if p_character_id is null or p_item_id is null then
    raise exception 'Character and inventory item are required';
  end if;
  if not v_service_role
     and (auth.uid() is null or not coalesce(private.can_access_character_v1(p_character_id, 'inventory'), false)) then
    raise exception 'Not authorized to equip this character inventory' using errcode = '42501';
  end if;
  if coalesce(p_is_equipped, false) and (v_slot is null or not (v_slot = any(v_allowed_slots))) then
    raise exception 'Choose a valid equipment slot';
  end if;

  select i.*
  into v_item
  from public.inventory_items i
  where i.id = p_item_id
    and (
      (
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
    )
  for update;

  if not found then
    raise exception 'Inventory item was not found for this character' using errcode = 'P0002';
  end if;

  update public.inventory_items
  set is_equipped = coalesce(p_is_equipped, false),
      equip_slot = case when coalesce(p_is_equipped, false) then v_slot else null end,
      updated_at = timezone('utc', now())
  where id = v_item.id
  returning * into v_item;

  return v_item;
end;
$function$;

revoke all on function public.get_character_inventory_v1(uuid) from public, anon;
revoke all on function public.set_character_inventory_equipment_v1(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.get_character_inventory_v1(uuid) to authenticated, service_role;
grant execute on function public.set_character_inventory_equipment_v1(uuid, uuid, boolean, text) to authenticated, service_role;

comment on function public.get_character_inventory_v1(uuid) is
'Returns inventory for a character only when the caller has character inventory permission or service authority.';
comment on function public.set_character_inventory_equipment_v1(uuid, uuid, boolean, text) is
'Changes only is_equipped and equip_slot for inventory owned by an authorized character.';

-- The shared numeric resolver already owns canonical sheet and encounter AC.
-- Patch its unarmored fallback to apply the 2024 class formulas dynamically.
do $patch_character_unarmored_defense_v1$
declare
  v_definition text;
  v_old text := '  v_base_ac := coalesce(v_sheet_ac,10+v_dex_mod);';
  v_new text := $replacement$  v_base_ac := coalesce(
    v_sheet_ac,
    case lower(coalesce(v_sheet#>>'{meta,classKey}',v_sheet->>'classKey',v_sheet->>'className',v_sheet->>'class',''))
      when 'barbarian' then 10+v_dex_mod+coalesce((v_effective_mods->>'con')::integer,0)
      when 'monk' then 10+v_dex_mod+coalesce((v_effective_mods->>'wis')::integer,0)
      else 10+v_dex_mod
    end
  );$replacement$;
begin
  select pg_get_functiondef('private.character_equipment_effects_v1(uuid)'::regprocedure)
  into v_definition;

  if position(v_old in v_definition) > 0 then
    v_definition := replace(v_definition, v_old, v_new);
    execute v_definition;
  elsif position('when ''barbarian'' then 10+v_dex_mod' in v_definition) = 0 then
    raise exception 'Could not safely patch private.character_equipment_effects_v1 unarmored AC formula';
  end if;
end;
$patch_character_unarmored_defense_v1$;

commit;
