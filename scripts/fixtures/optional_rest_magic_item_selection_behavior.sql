\set ON_ERROR_STOP on
-- Extends the disposable 20261025_01 fixture; never write production.
create table public.characters(id uuid primary key);
create table public.character_permissions(character_id uuid,user_id uuid,can_edit boolean,can_inventory boolean);
create table public.items_catalog(item_key text,item_rarity text);
create table public.inventory_items(
 id uuid primary key,item_id text,item_name text,item_rarity text,
 card_payload jsonb not null default '{}'::jsonb,
 owner_type text,owner_id text,is_equipped boolean,equip_slot text
);
create table public.active_test_encounters(character_id uuid primary key);
create or replace function private.can_access_character_v1(c uuid,p text default 'read')
returns boolean language sql stable security definer as $f$
select private.current_user_is_admin() or exists(
 select 1 from public.character_permissions cp where cp.character_id=c
 and cp.user_id=auth.uid() and (cp.can_edit or cp.can_inventory))$f$;
create or replace function private.can_manage_character_progression_v1(c uuid)
returns boolean language sql stable security definer as $f$
select private.current_user_is_admin() or exists(
 select 1 from public.character_permissions cp where cp.character_id=c
 and cp.user_id=auth.uid() and cp.can_edit)$f$;
create or replace function private.assert_character_resource_not_active_v1(c uuid)
returns void language plpgsql stable security definer as $f$
begin if exists(select 1 from public.active_test_encounters where character_id=c)
 then raise exception 'Active encounter' using errcode='55000'; end if; end $f$;
insert into public.characters values
('cccccccc-0000-4000-8000-000000000001'),
('cccccccc-0000-4000-8000-000000000002');
insert into public.character_permissions values
('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002',true,true),
('cccccccc-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000002',true,true);
insert into public.items_catalog values
('Ring|XDMG','rare'),('Staff|XDMG','very rare'),
('Cloak|XDMG','uncommon'),('Boots|XDMG','uncommon'),
('Rapier|XPHB','mundane');
insert into public.inventory_items values
('eeeeeeee-0000-4000-8000-000000000001','Ring|XDMG','Ring','rare','{}','character','cccccccc-0000-4000-8000-000000000001',true,'ring_1'),
('eeeeeeee-0000-4000-8000-000000000002','Staff|XDMG','Staff','very rare','{}','character','cccccccc-0000-4000-8000-000000000001',true,'weapon_1'),
('eeeeeeee-0000-4000-8000-000000000003','Cloak|XDMG','Cloak','uncommon','{}','character','cccccccc-0000-4000-8000-000000000001',true,'shoulders'),
('eeeeeeee-0000-4000-8000-000000000004','Boots|XDMG','Boots','uncommon','{}','character','cccccccc-0000-4000-8000-000000000001',true,'feet'),
('eeeeeeee-0000-4000-8000-000000000005','VAR-12345','Variant Wand','rare','{"id":"VAR-12345","rarity":"rare"}','character','cccccccc-0000-4000-8000-000000000001',true,'weapon_2'),
('eeeeeeee-0000-4000-8000-000000000006','Rapier|XPHB','Rapier','mundane','{}','character','cccccccc-0000-4000-8000-000000000001',true,'weapon_3'),
('eeeeeeee-0000-4000-8000-000000000007','UNKNOWN','Unknown rare','rare','{}','character','cccccccc-0000-4000-8000-000000000001',true,'ring_2'),
('eeeeeeee-0000-4000-8000-000000000008','Cloak|XDMG','Unequipped Cloak','uncommon','{}','character','cccccccc-0000-4000-8000-000000000001',false,null),
('eeeeeeee-0000-4000-8000-000000000009','Cloak|XDMG','Shared Cloak','uncommon','{}','player','aaaaaaaa-0000-4000-8000-000000000002',true,'shoulders'),
('eeeeeeee-0000-4000-8000-000000000010','Ring|XDMG','Foreign Ring','rare','{}','character','cccccccc-0000-4000-8000-000000000002',true,'ring_1');
\i sql/20261025_02_optional_rest_magic_item_selection.sql
do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 other uuid:='cccccccc-0000-4000-8000-000000000002';
 a uuid:='eeeeeeee-0000-4000-8000-000000000001';
 b uuid:='eeeeeeee-0000-4000-8000-000000000002';
 d uuid:='eeeeeeee-0000-4000-8000-000000000003';
 e uuid:='eeeeeeee-0000-4000-8000-000000000004';
 variant uuid:='eeeeeeee-0000-4000-8000-000000000005';
 mundane uuid:='eeeeeeee-0000-4000-8000-000000000006';
 unknown_item uuid:='eeeeeeee-0000-4000-8000-000000000007';
 unequipped uuid:='eeeeeeee-0000-4000-8000-000000000008';
 shared uuid:='eeeeeeee-0000-4000-8000-000000000009';
 foreign_item uuid:='eeeeeeee-0000-4000-8000-000000000010';
 v jsonb;
 blocked boolean;
begin
 if has_function_privilege('anon','public.set_character_rest_magic_choices_v1(uuid,uuid[])','EXECUTE')
 or has_table_privilege('authenticated','public.character_magic_item_selections_v1','INSERT')
 then raise exception 'Selection direct ACL too permissive'; end if;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 v:=public.get_character_rest_magic_choices_v1(c);
 if v->>'enabled'<>'false' or v->>'effectsEnforced'<>'false'
 then raise exception 'OFF rule incorrectly enforces magic %',v; end if;
 blocked:=false;
 begin perform public.set_character_rest_magic_choices_v1(c,array[a]);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'OFF rule still allowed selection'; end if;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(true);
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 v:=public.get_character_rest_magic_choices_v1(c);
 if v->>'enabled'<>'true' or v->>'maxItems'<>'3'
 or jsonb_array_length(v->'items')<>8 then raise exception 'Item candidate list incorrect %',v; end if;
 if not private.optional_rest_item_is_magic_v1(variant)
 or private.optional_rest_item_is_magic_v1(mundane)
 or private.optional_rest_item_is_magic_v1(unknown_item)
 or private.optional_rest_item_is_magic_v1(unequipped)
 or private.optional_rest_item_owner_matches_v1(c,shared)
 or private.optional_rest_item_owner_matches_v1(c,foreign_item)
 then raise exception 'Source / shared owner / unequipped item classification failed'; end if;
 blocked:=false;
 begin perform public.set_character_rest_magic_choices_v1(c,array[a,b,d,e]);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Four magic items bypassed three cap'; end if;
 blocked:=false;
 begin perform public.set_character_rest_magic_choices_v1(c,array[a,a]);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Duplicate selected item bypassed cap'; end if;
 v:=public.set_character_rest_magic_choices_v1(c,array[a,b,d]);
 if v->>'count'<>'3' or v->>'effectsEnforced'<>'false'
 then raise exception 'Three item selection failed %',v; end if;
 v:=public.set_character_rest_magic_choices_v1(c,array[a,b,d]);
 if v->>'count'<>'3' then raise exception 'Same-selection replay failed'; end if;
 v:=public.set_character_rest_magic_choices_v1(c,array[a,b,variant]);
 if v->>'count'<>'3' or exists(select 1 from public.character_magic_item_selections_v1
 where inventory_item_id=d) then raise exception 'Replacing an attuned choice failed %',v; end if;
 blocked:=false;
 begin perform public.set_character_rest_magic_choices_v1(c,array[a,shared]);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Shared inventory selected ambiguously'; end if;
 blocked:=false;
 begin perform public.set_character_rest_magic_choices_v1(c,array[a,unknown_item]);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Unknown source selected as magic'; end if;
 blocked:=false;
 begin perform public.set_character_rest_magic_choices_v1(c,array[a,unequipped]);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Unequipped item selected'; end if;
 blocked:=false;
 begin perform public.set_character_rest_magic_choices_v1(c,array[foreign_item]);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Foreign-owned magic selected'; end if;
 insert into public.active_test_encounters values(c);
 blocked:=false;
 begin perform public.set_character_rest_magic_choices_v1(c,array[a]);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Active combat did not block magic rest selection'; end if;
 delete from public.active_test_encounters where character_id=c;
 if (select count(*) from public.inventory_items where is_equipped)<>9
 then raise exception 'Selector unexpectedly unequipped gear'; end if;
 update public.inventory_items set owner_id=other::text where id=a;
 if exists(select 1 from public.character_magic_item_selections_v1 where inventory_item_id=a)
 then raise exception 'Transfer failed to clear old selection'; end if;
 update public.inventory_items set owner_id=c::text where id=a;
 if exists(select 1 from public.character_magic_item_selections_v1 where inventory_item_id=a)
 then raise exception 'Transfer-out-and-back reactivated choice'; end if;
 update public.inventory_items set is_equipped=false where id=variant;
 if exists(select 1 from public.character_magic_item_selections_v1 where inventory_item_id=variant)
 then raise exception 'Unequip did not clear magic selection'; end if;
 -- Changing a selected item's source identity, rarity or source payload
 -- must revoke the saved choice without altering the equipped item.
 perform public.set_character_rest_magic_choices_v1(c,array[b,d]);
 update public.inventory_items set item_id='UNKNOWN' where id=b;
 if exists(select 1 from public.character_magic_item_selections_v1 where inventory_item_id=b)
 then raise exception 'Item identity edit retained stale magic selection'; end if;
 if (select is_equipped from public.inventory_items where id=b) is not true
 then raise exception 'Item identity edit unexpectedly unequipped gear'; end if;
 update public.inventory_items set item_rarity='mundane' where id=d;
 if exists(select 1 from public.character_magic_item_selections_v1 where inventory_item_id=d)
 then raise exception 'Item rarity edit retained stale magic selection'; end if;
 update public.inventory_items set is_equipped=true where id=variant;
 perform public.set_character_rest_magic_choices_v1(c,array[variant]);
 update public.inventory_items set card_payload='{"id":"VAR-12345","rarity":"uncommon"}'::jsonb where id=variant;
 if exists(select 1 from public.character_magic_item_selections_v1 where inventory_item_id=variant)
 then raise exception 'Item payload edit retained stale magic selection'; end if;
 perform set_config('fixture.uid','',true);
 blocked:=false;
 begin perform public.get_character_rest_magic_choices_v1(c);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Unauthenticated magic choices readable'; end if;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(false);
 v:=public.get_character_rest_magic_choices_v1(c);
 if v->>'enabled'<>'false' or v->>'effectsEnforced'<>'false'
 then raise exception 'OFF state lost effect parity %',v; end if;
end $test$;
select 'Optional rest item choices: OFF, cap, source, account ownership, transfer, combat passed' result;
