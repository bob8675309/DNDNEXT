-- STAGED player rest-activity selection, dependent on 20261025_01.
-- Config OFF: no selection required, no equipment/effect suppression.
-- Config ON: at most three selected EQUIPPED magic items per character.
-- This deliberately DOES NOT gate any existing character/tactical effect consumer.
begin;

create table if not exists public.character_magic_item_selections_v1(
  character_id uuid not null references public.characters(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  selected_at timestamptz not null default timezone('utc',now()),
  primary key(character_id,inventory_item_id),
  unique(inventory_item_id)
);
alter table public.character_magic_item_selections_v1 enable row level security;
revoke all on public.character_magic_item_selections_v1
  from public,anon,authenticated;
grant select,insert,delete on public.character_magic_item_selections_v1
  to service_role;

-- No generic item-name inference. The item must be verified against the
-- canonical catalogue, OR carry a self-keyed VAR source card with matching
-- non-mundane rarity. The latter remains provisional until source provenance
-- is hardened for the future effects-engine consumer gate.
create or replace function private.optional_rest_item_is_magic_v1(p_item uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private
as $magic$
  select exists(
    select 1 from public.inventory_items i
    where i.id=p_item
      and i.is_equipped is true
      and lower(btrim(coalesce(i.item_rarity,'')))
        in ('common','uncommon','rare','very rare','legendary','artifact')
      and (
        exists(select 1 from public.items_catalog c
          where c.item_key=i.item_id
            and lower(btrim(coalesce(c.item_rarity,'')))
              in ('common','uncommon','rare','very rare','legendary','artifact'))
        or (
          i.item_id like 'VAR-%'
          and i.card_payload->>'id'=i.item_id
          and lower(btrim(coalesce(i.card_payload->>'rarity','')))
               =lower(btrim(coalesce(i.item_rarity,'')))
        )
      )
  );
$magic$;
revoke all on function private.optional_rest_item_is_magic_v1(uuid)
  from public,anon,authenticated;

-- Character-owned items have clear custody. An item assigned to a player
-- account may be in multiple editable characters' inventories; reject that
-- ambiguity until a per-character item allocation exists.
create or replace function private.optional_rest_item_owner_matches_v1(
  p_character uuid,p_item uuid
) returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private
as $own$
  select exists(
    select 1 from public.inventory_items i
    where i.id=p_item
      and (
        (lower(btrim(coalesce(i.owner_type,''))) in ('character','npc')
          and i.owner_id=p_character::text)
        or (
          lower(btrim(coalesce(i.owner_type,'')))='player'
          and exists(
            select 1 from public.character_permissions cp
            where cp.character_id=p_character
              and cp.user_id::text=i.owner_id and cp.can_edit
          )
          and not exists(
            select 1 from public.character_permissions cp
            where cp.character_id<>p_character
              and cp.user_id::text=i.owner_id and cp.can_edit
          )
        )
      )
  );
$own$;
revoke all on function private.optional_rest_item_owner_matches_v1(uuid,uuid)
  from public,anon,authenticated;

create or replace function public.get_character_rest_magic_choices_v1(
  p_character_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $get$
declare
  v_enabled boolean;
  v_cap smallint;
  v_items jsonb:='[]'::jsonb;
  v_count integer;
begin
  if p_character_id is null then
    raise exception 'Character required' using errcode='22023';
  end if;
  if auth.uid() is null
    or not coalesce(private.can_access_character_v1(p_character_id,'inventory'),false)
  then raise exception 'Not authorized to view magic item choices' using errcode='42501';
  end if;
  select s.attunement_enabled,s.attunement_max_items
    into v_enabled,v_cap
  from public.campaign_item_pool_settings s where s.id=1;
  if not found then raise exception 'Campaign settings missing' using errcode='P0002'; end if;
  select count(*) into v_count from public.character_magic_item_selections_v1
    where character_id=p_character_id;
  if v_enabled then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'itemId',i.id,'name',i.item_name,'rarity',i.item_rarity,
        'slot',i.equip_slot,'isEquipped',i.is_equipped,
        'isSelected',a.inventory_item_id is not null,
        'selectable',
          private.optional_rest_item_is_magic_v1(i.id)
          and private.optional_rest_item_owner_matches_v1(p_character_id,i.id),
        'reason',case
          when not i.is_equipped then 'Equip this item first'
          when not private.optional_rest_item_is_magic_v1(i.id)
             then 'Unverified magic item source or rarity'
          when not private.optional_rest_item_owner_matches_v1(p_character_id,i.id)
             then 'Shared inventory needs a character allocation'
          else null end
      ) order by i.item_name,i.id
    ),'[]'::jsonb) into v_items
    from public.inventory_items i
    left join public.character_magic_item_selections_v1 a
      on a.inventory_item_id=i.id and a.character_id=p_character_id
    where (
      (i.owner_id=p_character_id::text
        and lower(btrim(coalesce(i.owner_type,''))) in ('character','npc'))
      or (lower(btrim(coalesce(i.owner_type,'')))='player'
        and exists(select 1 from public.character_permissions cp
          where cp.character_id=p_character_id and cp.can_edit
            and cp.user_id::text=i.owner_id))
    )
      and lower(btrim(coalesce(i.item_rarity,'')))
        in ('common','uncommon','rare','very rare','legendary','artifact');
  end if;
  return jsonb_build_object(
    'enabled',v_enabled,'maxItems',v_cap,'count',v_count,
    'effectsEnforced',false,'items',v_items
  );
end
$get$;
revoke all on function public.get_character_rest_magic_choices_v1(uuid)
  from public,anon,authenticated;
grant execute on function public.get_character_rest_magic_choices_v1(uuid)
  to authenticated;

create or replace function public.set_character_rest_magic_choices_v1(
  p_character_id uuid,p_item_ids uuid[]
) returns jsonb
language plpgsql volatile security definer
set search_path=pg_catalog,public,private,auth
as $set$
declare
  v_enabled boolean;
  v_cap integer;
  v_item uuid;
  v_count integer;
begin
  if p_character_id is null or p_item_ids is null
    or array_position(p_item_ids,null) is not null then
    raise exception 'Character and complete item selection are required'
      using errcode='22023';
  end if;
  if auth.uid() is null
    or not coalesce(private.can_manage_character_progression_v1(p_character_id),false)
    or not coalesce(private.can_access_character_v1(p_character_id,'inventory'),false)
  then raise exception 'Not authorized to manage item choices' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('optional-rest-magic:'||p_character_id::text,0));
  select attunement_enabled,attunement_max_items
    into v_enabled,v_cap
  from public.campaign_item_pool_settings where id=1 for share;
  if not found or v_enabled is not true then
    raise exception 'Optional attunement is disabled'
      using errcode='23514';
  end if;
  -- Shared with the canonical Short/Long Rest combat safety barrier.
  perform private.assert_character_resource_not_active_v1(p_character_id);
  v_count:=cardinality(p_item_ids);
  if v_count>v_cap or v_count<>(
    select count(distinct u.item_id) from unnest(p_item_ids) as u(item_id)
  ) then
    raise exception 'Select at most % distinct magic items',v_cap
      using errcode='23514';
  end if;
  -- Row locks serialize transfers and unequips while selection is committed.
  for v_item in select distinct item_id from unnest(p_item_ids) as u(item_id)
    order by item_id
  loop
    perform 1 from public.inventory_items where id=v_item for update;
    if not found
      or not private.optional_rest_item_is_magic_v1(v_item)
      or not private.optional_rest_item_owner_matches_v1(p_character_id,v_item)
    then raise exception 'Selected item is not owned, equipped and source-verified magic'
      using errcode='23514';
    end if;
    if exists(select 1 from public.character_magic_item_selections_v1
       where inventory_item_id=v_item and character_id<>p_character_id) then
      raise exception 'Magic item selection belongs to another character'
        using errcode='23514';
    end if;
  end loop;
  delete from public.character_magic_item_selections_v1 s
    where s.character_id=p_character_id
      and not(s.inventory_item_id=any(p_item_ids));
  insert into public.character_magic_item_selections_v1(character_id,inventory_item_id)
    select p_character_id,u.item_id from unnest(p_item_ids) as u(item_id)
    on conflict (character_id,inventory_item_id) do nothing;
  return public.get_character_rest_magic_choices_v1(p_character_id);
end
$set$;
revoke all on function public.set_character_rest_magic_choices_v1(uuid,uuid[])
  from public,anon,authenticated;
grant execute on function public.set_character_rest_magic_choices_v1(uuid,uuid[])
  to authenticated;

-- Preserve normal equipment slot behavior: never auto-unequip or destroy
-- inventory. Only clear obsolete selections when a source is unequipped or
-- transferred to a different owner.
create or replace function private.clear_rest_magic_choice_on_item_change_v1()
returns trigger
language plpgsql volatile security definer
set search_path=pg_catalog,public,private
as $clear$
begin
  if old.owner_id is distinct from new.owner_id
    or old.owner_type is distinct from new.owner_type
    or (old.is_equipped is true and new.is_equipped is not true) then
    delete from public.character_magic_item_selections_v1
      where inventory_item_id=new.id;
  end if;
  return new;
end
$clear$;
drop trigger if exists clear_rest_magic_choice_on_item_change_v1
  on public.inventory_items;
create trigger clear_rest_magic_choice_on_item_change_v1
after update of owner_id,owner_type,is_equipped on public.inventory_items
for each row execute function private.clear_rest_magic_choice_on_item_change_v1();
revoke all on function private.clear_rest_magic_choice_on_item_change_v1()
  from public,anon,authenticated;

comment on table public.character_magic_item_selections_v1 is
'Optional rest-time selected equipped magic item identifiers. Does not currently authorize or suppress magic effect consumers.';
commit;
