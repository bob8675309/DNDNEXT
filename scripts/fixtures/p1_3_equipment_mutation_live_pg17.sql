-- Exact source snapshots from live DnDWeb, read-only, 2026-11-03.
-- Test environment only. Explicit helper/role/table mocks are declared in runner fixture.

-- private.can_access_character_v1 live MD5 97b5e6b059e6467e24c4283fe420c83e
CREATE OR REPLACE FUNCTION private.can_access_character_v1(p_character_id uuid, p_permission text DEFAULT 'read'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select
    private.current_user_is_admin()
    or exists (
      select 1
      from public.character_permissions cp
      where cp.character_id = p_character_id
        and cp.user_id = auth.uid()
        and case lower(coalesce(p_permission, 'read'))
          when 'inventory' then cp.can_inventory or cp.can_edit
          when 'convert' then cp.can_convert or cp.can_edit
          when 'edit' then cp.can_edit
          else cp.can_inventory or cp.can_edit or cp.can_convert
        end
    );
$function$;


-- public.set_character_inventory_equipment_v1 live MD5 84331beab3ab8a19883b2b8747a24bea
CREATE OR REPLACE FUNCTION public.set_character_inventory_equipment_v1(p_character_id uuid, p_item_id uuid, p_is_equipped boolean, p_equip_slot text DEFAULT NULL::text)
 RETURNS inventory_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
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


-- public.transfer_inventory_item_v1 live MD5 8c373a9d6438cb12baabeb375fd35305
CREATE OR REPLACE FUNCTION public.transfer_inventory_item_v1(p_item_id uuid, p_target_type text, p_target_id text)
 RETURNS inventory_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
declare
  caller uuid := auth.uid();
  v_admin boolean := false;
  v_item public.inventory_items%rowtype;
  v_source_type text;
  v_target_type text := lower(trim(coalesce(p_target_type, '')));
  v_target_uuid uuid;
  v_result public.inventory_items%rowtype;
begin
  if caller is null then
    raise exception 'Not signed in';
  end if;

  if p_item_id is null then
    raise exception 'Missing item id';
  end if;

  if v_target_type not in ('player', 'npc', 'merchant') then
    raise exception 'Invalid target type: %', p_target_type;
  end if;

  v_admin := coalesce(public.is_admin(caller), false);

  select *
  into v_item
  from public.inventory_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found';
  end if;

  v_source_type := coalesce(nullif(v_item.owner_type, ''), 'player');

  if not (
    v_admin
    or (v_source_type = 'player' and v_item.user_id = caller)
    or (
      v_source_type = 'npc'
      and exists (
        select 1
        from public.character_permissions cp
        where cp.character_id = v_item.owner_id::uuid
          and cp.user_id = caller
          and (coalesce(cp.can_inventory, false) or coalesce(cp.can_edit, false))
      )
    )
  ) then
    raise exception 'Not authorized to transfer this item';
  end if;

  if v_target_type = 'player' then
    begin
      v_target_uuid := p_target_id::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid player target id';
    end;

    if not exists (select 1 from public.players p where p.user_id = v_target_uuid) then
      raise exception 'Player target not found';
    end if;
  else
    begin
      v_target_uuid := p_target_id::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid character target id';
    end;

    if not exists (
      select 1
      from public.characters c
      where c.id = v_target_uuid
        and c.kind = v_target_type
    ) then
      raise exception 'Character target not found';
    end if;

    if v_target_type = 'merchant' and not v_admin then
      raise exception 'Only admins can send items directly to merchants';
    end if;
  end if;

  update public.inventory_items
  set owner_type = v_target_type,
      owner_id = p_target_id,
      user_id = case when v_target_type = 'player' then v_target_uuid else null end,
      is_equipped = false,
      equip_slot = null,
      updated_at = now()
  where id = p_item_id
  returning * into v_result;

  return v_result;
end;
$function$;
