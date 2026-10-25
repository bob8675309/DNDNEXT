\set ON_ERROR_STOP on
create schema auth;
create schema private;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create table public.characters(id uuid primary key);
create table public.inventory_items(
  id uuid primary key, item_id text,item_name text not null,owner_id text,
  owner_type text,is_equipped boolean default false,equip_slot text,
  card_payload jsonb default '{}'::jsonb,updated_at timestamptz default now()
);
create table public.items_catalog(item_key text primary key,item_name text not null,payload jsonb);
create table public.character_permissions(character_id uuid,user_id uuid,can_edit boolean);
create table public.user_profiles(id uuid primary key,role text);
create table public.campaign_item_pool_settings(
  id smallint primary key default 1, future_tech_enabled boolean default false,
  updated_at timestamptz default now(),updated_by uuid
);
insert into public.campaign_item_pool_settings(id) values(1);
create function auth.uid() returns uuid language sql stable
as $$select nullif(current_setting('fixture.uid',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable
as $$select jsonb_build_object('role',coalesce(nullif(current_setting('fixture.role',true),''),'authenticated'))$$;
create function private.current_user_is_admin() returns boolean language sql stable
as $$select exists(select 1 from public.user_profiles where id=auth.uid() and role='admin')$$;
create function private.can_access_character_v1(p_character_id uuid,p_permission text)
returns boolean language sql stable as $$
select private.current_user_is_admin()
  or exists(select 1 from public.character_permissions cp
    where cp.character_id=p_character_id and cp.user_id=auth.uid()
      and (p_permission<>'inventory' or cp.can_edit))
$$;
insert into public.characters values
 ('aaaaaaaa-0000-4000-8000-000000000001'),
 ('aaaaaaaa-0000-4000-8000-000000000002');
insert into public.user_profiles values
 ('bbbbbbbb-0000-4000-8000-000000000001','admin'),
 ('bbbbbbbb-0000-4000-8000-000000000002','player'),
 ('bbbbbbbb-0000-4000-8000-000000000003','player');
insert into public.character_permissions values
 ('aaaaaaaa-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000002',true),
 ('aaaaaaaa-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000003',true);
insert into public.items_catalog values
 ('ring-1','Ring One','{"reqAttuneTags":[{"class":"wizard"}]}'::jsonb),
 ('ring-2','Ring Two','{"reqAttune":true}'::jsonb),
 ('ring-3','Ring Three','{"reqAttune":true}'::jsonb),
 ('ring-4','Ring Four','{"reqAttune":true}'::jsonb),
 ('mundane','Backpack','{}'::jsonb);
insert into public.inventory_items(id,item_id,item_name,owner_id,owner_type,is_equipped,equip_slot,card_payload) values
 ('cccccccc-0000-4000-8000-000000000001','ring-1','Ring One','bbbbbbbb-0000-4000-8000-000000000002','player',true,'ring_1','{}'),
 ('cccccccc-0000-4000-8000-000000000002','ring-2','Ring Two','bbbbbbbb-0000-4000-8000-000000000002','player',true,'ring_2','{}'),
 ('cccccccc-0000-4000-8000-000000000003','ring-3','Ring Three','bbbbbbbb-0000-4000-8000-000000000002','player',false,null,'{}'),
 ('cccccccc-0000-4000-8000-000000000004','ring-4','Ring Four','bbbbbbbb-0000-4000-8000-000000000002','player',false,null,'{}'),
 ('cccccccc-0000-4000-8000-000000000005','ring-1','Ring One','bbbbbbbb-0000-4000-8000-000000000002','player',false,null,'{}'),
 ('cccccccc-0000-4000-8000-000000000006','mundane','Backpack','bbbbbbbb-0000-4000-8000-000000000002','player',false,null,'{}'),
 ('cccccccc-0000-4000-8000-000000000007','ring-4','Ring Four','bbbbbbbb-0000-4000-8000-000000000003','player',false,null,'{}');
\i sql/20261024_02_campaign_attunement_policy.sql
do $t$
declare v jsonb; v_rejected boolean; v_i integer;
begin
 perform set_config('fixture.uid','bbbbbbbb-0000-4000-8000-000000000002',true);
 perform set_config('fixture.role','authenticated',true);
 if not private.item_requires_attunement_v1('cccccccc-0000-4000-8000-000000000001') then
   raise exception 'Catalog reqAttuneTags not recognized'; end if;
 if private.item_requires_attunement_v1('cccccccc-0000-4000-8000-000000000006') then
   raise exception 'Mundane inventory item requires attunement'; end if;
 for v_i in 1..3 loop
   v:=public.set_character_item_attunement_v1(
     'aaaaaaaa-0000-4000-8000-000000000001',
     ('cccccccc-0000-4000-8000-'||lpad(v_i::text,12,'0'))::uuid,true);
 end loop;
 if (v->>'attunedCount')::int <> 3 or v->>'limit'<>'3' then
   raise exception 'Standard three slot capacity failed: %',v; end if;
 v_rejected:=false;
 begin
  perform public.set_character_item_attunement_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    'cccccccc-0000-4000-8000-000000000004',true);
 exception when sqlstate '23514' then v_rejected:=true; end;
 if not v_rejected then raise exception 'Fourth bond allowed under standard rules'; end if;
 perform public.set_character_item_attunement_v1(
   'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000003',false);
 v_rejected:=false;
 begin
  perform public.set_character_item_attunement_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    'cccccccc-0000-4000-8000-000000000005',true);
 exception when sqlstate '23514' then v_rejected:=true; end;
 if not v_rejected then raise exception 'Duplicate named item allowed'; end if;
 v_rejected:=false;
 begin
  perform public.set_character_item_attunement_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    'cccccccc-0000-4000-8000-000000000007',true);
 exception when sqlstate '42501' then v_rejected:=true; end;
 if not v_rejected then raise exception 'Foreign item attunement allowed'; end if;
 v_rejected:=false;
 begin
  perform public.set_campaign_unlimited_attunement_v1(true);
 exception when sqlstate '42501' then v_rejected:=true; end;
 if not v_rejected then raise exception 'Non-admin changed campaign setting'; end if;
 perform set_config('fixture.uid','bbbbbbbb-0000-4000-8000-000000000001',true);
 if not public.set_campaign_unlimited_attunement_v1(true) then
   raise exception 'Admin unlimited mode failed'; end if;
 perform set_config('fixture.uid','bbbbbbbb-0000-4000-8000-000000000002',true);
 v:=public.set_character_item_attunement_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    'cccccccc-0000-4000-8000-000000000003',true);
 v:=public.set_character_item_attunement_v1(
    'aaaaaaaa-0000-4000-8000-000000000001',
    'cccccccc-0000-4000-8000-000000000004',true);
 if v->>'limit' is not null or (v->>'attunedCount')::int<>4 then
   raise exception 'Unlimited mode failed: %',v; end if;
 perform set_config('fixture.uid','bbbbbbbb-0000-4000-8000-000000000001',true);
 v_rejected:=false;
 begin
   perform public.set_campaign_unlimited_attunement_v1(false);
 exception when sqlstate '23514' then v_rejected:=true; end;
 if not v_rejected then raise exception 'Over-cap downgrade silently accepted'; end if;
 perform set_config('fixture.uid','bbbbbbbb-0000-4000-8000-000000000002',true);
 perform public.set_character_item_attunement_v1(
   'aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000004',false);
 if (select equip_slot from public.inventory_items where id='cccccccc-0000-4000-8000-000000000001')<>'ring_1' then
   raise exception 'Attunement modified equipment slot'; end if;
 update public.inventory_items set owner_id='bbbbbbbb-0000-4000-8000-000000000003'
 where id='cccccccc-0000-4000-8000-000000000001';
 if exists(select 1 from public.character_item_attunements
   where inventory_item_id='cccccccc-0000-4000-8000-000000000001') then
   raise exception 'Transfer retained old item bond'; end if;
 perform set_config('fixture.uid','bbbbbbbb-0000-4000-8000-000000000001',true);
 if public.set_campaign_unlimited_attunement_v1(false) then
   raise exception 'Downgrade unexpectedly returns unlimited'; end if;
 if has_table_privilege('authenticated','public.character_item_attunements','insert')
   or has_table_privilege('anon','public.character_item_attunements','select') then
   raise exception 'Attunement table exposed without authorization'; end if;
end
$t$;
select 'Attunement isolated PostgreSQL behavior and ACL checks passed' result;
