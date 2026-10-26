-- DRAFT ONLY: separately record a character's intended main/off-hand loadout.
-- Existing Equipment Manager slots are weapon_1..3, not physical hands.
-- This is neither combat-time active hand proof nor magical-effect authority.
-- Requires the existing character permission/resource guards and inventory schema.
begin;

create table if not exists public.character_hand_loadout_staging_v1 (
  character_id uuid not null references public.characters(id) on delete cascade,
  hand text not null check(hand in ('main','off')),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  declared_by uuid not null,
  declared_at timestamptz not null default timezone('utc',now()),
  primary key(character_id,hand),
  unique(inventory_item_id)
);
create index if not exists character_hand_loadout_by_item_v1
  on public.character_hand_loadout_staging_v1(inventory_item_id);
alter table public.character_hand_loadout_staging_v1 enable row level security;
revoke all on public.character_hand_loadout_staging_v1
  from public,anon,authenticated;
grant select,insert,update,delete on public.character_hand_loadout_staging_v1
  to service_role;

-- Character-owned inventory has unambiguous custody. The shared player
-- account inventory is projected into ALL editable characters' inventories,
-- so it is not yet a safe source for per-character physical hand declaration.
create or replace function private.character_staged_hand_item_valid_v1(
 p_character_id uuid,p_inventory_item_id uuid
) returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private
as $valid$
 select exists(
   select 1 from public.inventory_items i
   where i.id=p_inventory_item_id
     and i.is_equipped is true
     and lower(btrim(coalesce(i.equip_slot,''))) in
       ('weapon_1','weapon_2','weapon_3')
     and (
       (lower(btrim(coalesce(i.owner_type,''))) in ('character','npc')
        and i.owner_id=p_character_id::text)
       or (
         lower(btrim(coalesce(i.owner_type,'')))='player'
         and exists(
           select 1 from public.character_permissions cp
           where cp.character_id=p_character_id
             and cp.user_id::text=i.owner_id and cp.can_edit
         )
         and (select count(distinct cp2.character_id)
           from public.character_permissions cp2
           where cp2.user_id::text=i.owner_id and cp2.can_edit)=1
       )
     )
 );
$valid$;
revoke all on function private.character_staged_hand_item_valid_v1(uuid,uuid)
 from public,anon,authenticated;
grant execute on function private.character_staged_hand_item_valid_v1(uuid,uuid)
 to service_role;

create or replace function public.get_character_hand_loadout_staging_v1(
 p_character_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $get$
declare
 v_rows jsonb:='[]'::jsonb;
begin
 if p_character_id is null then
   raise exception 'Character id required' using errcode='22023';
 end if;
 if auth.uid() is null
   or not coalesce(private.can_access_character_v1(p_character_id,'inventory'),false)
 then
   raise exception 'Not authorized to view the character hand loadout'
     using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'hand',h.hand,'inventoryItemId',h.inventory_item_id,
   'itemName',i.item_name,'equipSlot',i.equip_slot,
   'stillValid',private.character_staged_hand_item_valid_v1(
       p_character_id,h.inventory_item_id),
   'declaredAt',h.declared_at
 ) order by h.hand),'[]'::jsonb)
 into v_rows
 from public.character_hand_loadout_staging_v1 h
 join public.inventory_items i on i.id=h.inventory_item_id
 where h.character_id=p_character_id;
 return jsonb_build_object(
   'schemaVersion',1,'characterId',p_character_id,
   'staged',v_rows,
   'activeHoldVerified',false,
   'combatSnapshotVerified',false,
   'focusConsumerEnforced',false,
   'physicalInventoryChanged',false
 );
end;
$get$;
revoke all on function public.get_character_hand_loadout_staging_v1(uuid)
 from public,anon,authenticated;
grant execute on function public.get_character_hand_loadout_staging_v1(uuid)
 to authenticated;

create or replace function public.set_character_hand_loadout_staging_v1(
 p_character_id uuid,p_main_item_id uuid,p_off_item_id uuid
) returns jsonb
language plpgsql volatile security definer
set search_path=pg_catalog,public,private,auth
as $set$
declare
 v_id uuid;
 v_current uuid[];
begin
 if p_character_id is null then
   raise exception 'Character id required' using errcode='22023';
 end if;
 if auth.uid() is null
   or not coalesce(private.can_manage_character_progression_v1(p_character_id),false)
   or not coalesce(private.can_access_character_v1(p_character_id,'inventory'),false)
 then
   raise exception 'Not authorized to stage hands for this character'
     using errcode='42501';
 end if;
 if p_main_item_id is not null and p_main_item_id=p_off_item_id then
   raise exception 'One item cannot occupy both active-hand intentions'
     using errcode='23514';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(
   'character-hand-loadout:'||p_character_id::text,0));
 -- A new precombat staging choice cannot rewrite in-progress combat state.
 perform private.assert_character_resource_not_active_v1(p_character_id);
 v_current:=array_remove(array[p_main_item_id,p_off_item_id],null::uuid);
 for v_id in select unnest(v_current) order by 1
 loop
   perform 1 from public.inventory_items where id=v_id for update;
   if not found or not private.character_staged_hand_item_valid_v1(
     p_character_id,v_id) then
     raise exception 'Item must be exclusively character-owned, equipped and in weapon_1..3'
       using errcode='23514';
   end if;
   if exists(
     select 1 from public.character_hand_loadout_staging_v1 h
     where h.inventory_item_id=v_id and h.character_id<>p_character_id
   ) then
     raise exception 'The physical item is already staged by another character'
       using errcode='23514';
   end if;
 end loop;
 delete from public.character_hand_loadout_staging_v1
 where character_id=p_character_id;
 if p_main_item_id is not null then
   insert into public.character_hand_loadout_staging_v1(
     character_id,hand,inventory_item_id,declared_by
   ) values(p_character_id,'main',p_main_item_id,auth.uid());
 end if;
 if p_off_item_id is not null then
   insert into public.character_hand_loadout_staging_v1(
     character_id,hand,inventory_item_id,declared_by
   ) values(p_character_id,'off',p_off_item_id,auth.uid());
 end if;
 return public.get_character_hand_loadout_staging_v1(p_character_id);
end;
$set$;
revoke all on function public.set_character_hand_loadout_staging_v1(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.set_character_hand_loadout_staging_v1(uuid,uuid,uuid)
 to authenticated;

-- Invalidate obsolete *intentions* on any change to physical slot, equip
-- state, owner or item identity. Never unequip or move an inventory row.
create or replace function private.invalidate_staged_hand_item_v1()
returns trigger
language plpgsql volatile security definer
set search_path=pg_catalog,public,private
as $clear$
begin
 if old.owner_id is distinct from new.owner_id
 or old.owner_type is distinct from new.owner_type
 or old.is_equipped is distinct from new.is_equipped
 or old.equip_slot is distinct from new.equip_slot
 or old.item_id is distinct from new.item_id
 or old.item_rarity is distinct from new.item_rarity
 or old.card_payload is distinct from new.card_payload then
   delete from public.character_hand_loadout_staging_v1
    where inventory_item_id=new.id;
 end if;
 return new;
end;
$clear$;
drop trigger if exists invalidate_staged_hand_item_v1
 on public.inventory_items;
create trigger invalidate_staged_hand_item_v1
after update of owner_id,owner_type,is_equipped,equip_slot,item_id,item_rarity,card_payload
on public.inventory_items
for each row execute function private.invalidate_staged_hand_item_v1();
revoke all on function private.invalidate_staged_hand_item_v1()
 from public,anon,authenticated;

comment on table public.character_hand_loadout_staging_v1 is
'Draft-only exact-character hand intentions for equipped weapon_1..3 items, not combat-time active hands or magical focus eligibility. No consumer reads these choices.';
comment on function public.set_character_hand_loadout_staging_v1(uuid,uuid,uuid) is
'Authenticated character-owned precombat hand intention; rejects shared account custody, active combat, invalid items, and duplicates. Does not equip or cast.';
commit;
