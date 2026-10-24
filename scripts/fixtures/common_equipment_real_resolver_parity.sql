-- Isolated test: load the real legacy SQL resolver after stub schema setup.
\set ON_ERROR_STOP on
create schema auth;
create table public.character_sheets(character_id uuid primary key,sheet jsonb);
create table public.inventory_items(id uuid primary key,owner_id text,owner_type text,is_equipped boolean,updated_at timestamptz,card_payload jsonb,item_id text,item_name text,item_type text,equip_slot text);
create table public.items_catalog(item_key text primary key,item_name text,payload jsonb);
create table public.character_permissions(character_id uuid,user_id uuid,can_edit boolean);
create function public.craft_payload_inferred_ac(text) returns integer language sql immutable as $$select null::integer$$;
create function private.current_user_is_admin() returns boolean language sql stable as $$select false$$;
create function private.can_access_character_v1(uuid,text) returns boolean language sql stable as $$select false$$;
create function auth.role() returns text language sql stable as $$select 'service_role'::text$$;
insert into public.character_sheets values ('10000000-0000-4000-8000-000000000001','{"abilities":{"dex":{"score":8}}}');
insert into public.items_catalog values
 ('ring','Ring of Protection','{"bonusAc":"+1","bonusSavingThrow":"+1"}'),
 ('charm','Training Charm','{"modifiers":{"saves":{"dex":"+2"},"checks":{"all":"+1","athletics":"+3","acrobatics":"-2"},"initiative":"+4"}}'),
 ('leather','Leather Armor','{"type":"LA","ac":"11"}'),
 ('scale','Scale Mail','{"type":"MA","ac":"14"}'),
 ('chain','Chain Mail','{"type":"HA","ac":"16"}'),
 ('shield','Shield','{"type":"S","ac":"2"}');
insert into public.inventory_items values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','character',true,now(),'{"item_key":"ring"}','ring','Ring of Protection',null,'finger'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','character',true,now(),'{"item_key":"charm"}','charm','Training Charm',null,'neck'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','character',false,now(),'{"item_key":"ring","bonusSavingThrow":"+99"}','ring','Ring of Protection',null,'finger'),
 ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','character',true,now(),'{"item_key":"ring"}','ring','Ring of Protection',null,'finger');
do $test$
declare c uuid:='10000000-0000-4000-8000-000000000001'; e jsonb; x jsonb; r jsonb; case_row jsonb;
begin
 e:=private.character_equipment_effects_v1(c);
 if e#>>'{ac,total}'<>'10' or e->>'savesAll'<>'1' or e#>>'{saves,dex}'<>'2' or e->>'initiative'<>'4'
 or e->>'skillsAll'<>'1' or e#>>'{skills,athletics}'<>'3' or e#>>'{skills,acrobatics}'<>'-2'
 or jsonb_array_length(e->'equippedItemIds')<>2
 then raise exception 'Legacy aggregation, unequipped or foreign owner mismatch %',e; end if;
 for case_row in select value from jsonb_array_elements(
 '[{"context":{"event":"saving_throw","ability":"dex"},"target":"saving_throw_bonus","expected":3},
 {"context":{"event":"saving_throw","ability":"str"},"target":"saving_throw_bonus","expected":1},
 {"context":{"event":"ability_check","skill":"athletics"},"target":"athletics_check","expected":4},
 {"context":{"event":"ability_check","skill":"acrobatics"},"target":"acrobatics_check","expected":-1},
 {"context":{"event":"initiative"},"target":"initiative","expected":4}]'::jsonb)
 loop
   x:=private.normalize_equipment_bonus_effects_v1(e,case_row->'context');
   r:=private.resolve_effect_bundle_v1(jsonb_build_object(case_row->>'target',7),x);
   if (r->'stats'->>(case_row->>'target'))::numeric <> 7+(case_row->>'expected')::numeric
   then raise exception 'Actual resolver/adapter parity failed %, %, %',case_row,e,r; end if;
 end loop;
 update public.inventory_items set card_payload='{"item_key":"ring","bonusAc":"+2","bonusSavingThrow":"+3"}'
 where id='20000000-0000-4000-8000-000000000001';
 e:=private.character_equipment_effects_v1(c);
 if e->>'savesAll'<>'3' or e#>>'{ac,total}'<>'11' then raise exception 'Instance override failed %',e; end if;
 insert into public.inventory_items values
 ('20000000-0000-4000-8000-000000000005',c::text,'character',true,now(),'{"item_key":"ring"}','ring','Ring of Protection',null,'finger');
 e:=private.character_equipment_effects_v1(c);
 if e->>'savesAll'<>'4' or e#>>'{ac,total}'<>'12' then raise exception 'Duplicate instance aggregation failed %',e; end if;
 insert into public.inventory_items values
 ('20000000-0000-4000-8000-000000000006',c::text,'character',true,now(),'{"item_key":"leather"}','leather','Leather Armor',null,'body'),
 ('20000000-0000-4000-8000-000000000007',c::text,'character',true,now(),'{"item_key":"shield"}','shield','Shield',null,'offhand');
 e:=private.character_equipment_effects_v1(c);
 if e#>>'{ac,total}'<>'14' or e#>>'{ac,dexApplied}'<>'-1' then raise exception 'Light AC failed %',e; end if;
 update public.inventory_items set card_payload='{"item_key":"scale"}',item_id='scale',item_name='Scale Mail'
 where id='20000000-0000-4000-8000-000000000006';
 e:=private.character_equipment_effects_v1(c);
 if e#>>'{ac,total}'<>'17' or e#>>'{ac,dexApplied}'<>'-1' then raise exception 'Medium AC failed %',e; end if;
 update public.inventory_items set card_payload='{"item_key":"chain"}',item_id='chain',item_name='Chain Mail'
 where id='20000000-0000-4000-8000-000000000006';
 e:=private.character_equipment_effects_v1(c);
 if e#>>'{ac,total}'<>'20' or e#>>'{ac,dexApplied}'<>'0' then raise exception 'Heavy AC failed %',e; end if;
 update public.inventory_items set equip_slot='back'
 where id='20000000-0000-4000-8000-000000000006';
 e:=private.character_equipment_effects_v1(c);
 if e#>>'{ac,total}'<>'14' then raise exception 'Non-body armor applied %',e; end if;
end $test$;
select 'Real equipment resolver parity fixture passed' as result;
