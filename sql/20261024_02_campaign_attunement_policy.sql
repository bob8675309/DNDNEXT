-- Campaign attunement capacity foundation. Staged only; do not deploy before
-- rest/attunement eligibility and consumer gates in docs are reviewed.
-- Intentionally does NOT alter is_equipped or equip_slot, and does NOT infer
-- permanent magic bonuses from a presentation-only ItemCard.
begin;
alter table public.campaign_item_pool_settings
  add column if not exists unlimited_attunement_enabled boolean not null default false;

create table if not exists public.character_item_attunements (
  character_id uuid not null references public.characters(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  attuned_at timestamptz not null default timezone('utc',now()),
  primary key(character_id,inventory_item_id),
  unique(inventory_item_id)
);
create index if not exists character_item_attunements_character_idx
  on public.character_item_attunements(character_id,attuned_at);
alter table public.character_item_attunements enable row level security;
revoke all on public.character_item_attunements from public,anon,authenticated;
grant select,insert,update,delete on public.character_item_attunements to service_role;

-- Identifies the structured item-source requirement, independent of equipment slots.
create or replace function private.item_requires_attunement_v1(p_item_id uuid)
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth as $f$
declare v_payload jsonb; v_catalog jsonb; v_item public.inventory_items%rowtype;
begin
  select * into v_item from public.inventory_items where id=p_item_id;
  if not found then return false; end if;
  select coalesce(ic.payload,'{}'::jsonb) into v_catalog
  from public.items_catalog ic
  where ic.item_key=coalesce(v_item.card_payload->>'item_key',v_item.card_payload->>'item_id',v_item.item_id)
     or ic.item_key=v_item.item_id
     or lower(ic.item_name)=lower(v_item.item_name)
  order by case when ic.item_key=coalesce(v_item.card_payload->>'item_key',v_item.card_payload->>'item_id',v_item.item_id) then 0 else 1 end,
           case when coalesce(ic.payload->>'edition','')='one' then 0 else 1 end
  limit 1;
  v_payload:=coalesce(v_catalog,'{}'::jsonb)||coalesce(v_item.card_payload,'{}'::jsonb);
  return case
    when v_payload->'reqAttune'='true'::jsonb then true
    when jsonb_typeof(v_payload->'reqAttune')='string'
       and lower(coalesce(v_payload->>'reqAttune','')) not in ('','false','no','none') then true
    when jsonb_typeof(v_payload->'reqAttuneTags')='array'
       and jsonb_array_length(v_payload->'reqAttuneTags')>0 then true
    when v_payload->'attunement'='true'::jsonb then true
    else false end;
end
$f$;
revoke all on function private.item_requires_attunement_v1(uuid) from public,anon,authenticated;

create or replace function public.set_campaign_unlimited_attunement_v1(p_enabled boolean)
returns boolean language plpgsql security definer
set search_path=pg_catalog,public,private,auth as $f$
declare v_uid uuid:=auth.uid(); v_service boolean:=coalesce(auth.jwt()->>'role','')='service_role';
begin
 if p_enabled is null then raise exception 'Choose an attunement mode' using errcode='22023'; end if;
 if not v_service and (v_uid is null or not coalesce(private.current_user_is_admin(),false))
 then raise exception 'Only admins can change attunement rules' using errcode='42501'; end if;
 -- Serialized with attunement writes; fail rather than silently remove bonds.
 perform pg_advisory_xact_lock(9072026,42424);
 if not p_enabled and exists(
   select 1 from public.character_item_attunements
   group by character_id having count(*)>3
 ) then
   raise exception 'Cannot enable standard limits while a character has more than three attuned items. Unattune the extras first.'
     using errcode='23514';
 end if;
 insert into public.campaign_item_pool_settings
   (id,unlimited_attunement_enabled,updated_at,updated_by)
 values (1,p_enabled,timezone('utc',now()),v_uid)
 on conflict(id) do update set
   unlimited_attunement_enabled=excluded.unlimited_attunement_enabled,
   updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 return p_enabled;
end
$f$;
revoke all on function public.set_campaign_unlimited_attunement_v1(boolean) from public,anon;
grant execute on function public.set_campaign_unlimited_attunement_v1(boolean) to authenticated,service_role;

create or replace function public.get_character_attunement_items_v1(p_character_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth as $f$
declare v_service boolean:=coalesce(auth.jwt()->>'role','')='service_role';
 v_unlimited boolean:=false; v_items jsonb:='[]'::jsonb; v_count integer:=0;
begin
 if p_character_id is null then raise exception 'Character required' using errcode='22023'; end if;
 if not v_service and (auth.uid() is null
    or not coalesce(private.can_access_character_v1(p_character_id,'read'),false))
 then raise exception 'Not authorized to view attunement' using errcode='42501'; end if;
 select coalesce(unlimited_attunement_enabled,false) into v_unlimited
 from public.campaign_item_pool_settings where id=1;
 select count(*) into v_count from public.character_item_attunements where character_id=p_character_id;
 select coalesce(jsonb_agg(jsonb_build_object(
   'itemId',i.id,'itemName',i.item_name,'isEquipped',i.is_equipped,
   'equipSlot',i.equip_slot,'requiresAttunement',private.item_requires_attunement_v1(i.id),
   'isAttuned',a.inventory_item_id is not null,'attunedAt',a.attuned_at
 ) order by i.item_name,i.id),'[]'::jsonb) into v_items
 from public.inventory_items i
 left join public.character_item_attunements a
   on a.inventory_item_id=i.id and a.character_id=p_character_id
 where (i.owner_id=p_character_id::text and lower(coalesce(i.owner_type,'')) in ('npc','merchant','character'))
    or (lower(coalesce(i.owner_type,''))='player' and exists(
      select 1 from public.character_permissions cp
      where cp.character_id=p_character_id and cp.can_edit=true and i.owner_id=cp.user_id::text
    ));
 return jsonb_build_object('unlimited',v_unlimited,'limit',case when v_unlimited then null else 3 end,
    'attunedCount',v_count,'items',v_items);
end
$f$;
revoke all on function public.get_character_attunement_items_v1(uuid) from public,anon;
grant execute on function public.get_character_attunement_items_v1(uuid) to authenticated,service_role;

create or replace function public.set_character_item_attunement_v1(
 p_character_id uuid,p_item_id uuid,p_attuned boolean
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private,auth as $f$
declare v_item public.inventory_items%rowtype; v_service boolean:=coalesce(auth.jwt()->>'role','')='service_role';
 v_unlimited boolean:=false; v_count integer; v_own boolean;
begin
 if p_character_id is null or p_item_id is null or p_attuned is null then
  raise exception 'Character, inventory item and attunement state are required' using errcode='22023';
 end if;
 if not v_service and (auth.uid() is null
    or not coalesce(private.can_access_character_v1(p_character_id,'inventory'),false))
 then raise exception 'Not authorized to manage attunement' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(9072026,42424);
 perform pg_advisory_xact_lock(hashtextextended(p_character_id::text,0));
 select * into v_item from public.inventory_items where id=p_item_id for update;
 if not found then raise exception 'Inventory item not found' using errcode='P0002'; end if;
 v_own:=(v_item.owner_id=p_character_id::text
     and lower(coalesce(v_item.owner_type,'')) in ('npc','merchant','character'))
     or (lower(coalesce(v_item.owner_type,''))='player' and exists(
       select 1 from public.character_permissions cp where cp.character_id=p_character_id
          and cp.can_edit=true and v_item.owner_id=cp.user_id::text));
 if not v_own then raise exception 'This item does not belong to this character' using errcode='42501'; end if;
 if not p_attuned then
   delete from public.character_item_attunements
   where character_id=p_character_id and inventory_item_id=p_item_id;
   return public.get_character_attunement_items_v1(p_character_id);
 end if;
 if not private.item_requires_attunement_v1(p_item_id) then
   raise exception 'This item does not require attunement' using errcode='22023';
 end if;
 if exists(select 1 from public.character_item_attunements where character_id=p_character_id and inventory_item_id=p_item_id)
 then return public.get_character_attunement_items_v1(p_character_id); end if;
 select coalesce(unlimited_attunement_enabled,false) into v_unlimited
 from public.campaign_item_pool_settings where id=1;
 select count(*) into v_count from public.character_item_attunements where character_id=p_character_id;
 if not v_unlimited and v_count>=3 then
    raise exception 'Three attunement slots are already occupied' using errcode='23514';
 end if;
 if exists(
   select 1 from public.character_item_attunements a
   join public.inventory_items other on other.id=a.inventory_item_id
   where a.character_id=p_character_id and lower(other.item_name)=lower(v_item.item_name)
 ) then
   raise exception 'Cannot attune to two copies of the same magic item' using errcode='23514';
 end if;
 insert into public.character_item_attunements(character_id,inventory_item_id)
 values(p_character_id,p_item_id);
 return public.get_character_attunement_items_v1(p_character_id);
end
$f$;
revoke all on function public.set_character_item_attunement_v1(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_character_item_attunement_v1(uuid,uuid,boolean) to authenticated,service_role;

-- An item moved to another inventory is no longer bound to its former owner.
create or replace function private.clear_transferred_item_attunement_v1()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private,auth as $f$
begin
 if old.owner_type is distinct from new.owner_type or old.owner_id is distinct from new.owner_id then
   delete from public.character_item_attunements where inventory_item_id=new.id;
 end if;
 return new;
end
$f$;
drop trigger if exists clear_transferred_item_attunement on public.inventory_items;
create trigger clear_transferred_item_attunement
after update of owner_type,owner_id on public.inventory_items
for each row execute function private.clear_transferred_item_attunement_v1();
revoke all on function private.clear_transferred_item_attunement_v1() from public,anon,authenticated;
commit;
