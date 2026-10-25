\set ON_ERROR_STOP on
-- Source-cited 2024 requirements use EXACT catalogue item keys.
-- This fixture reuses #257+#260 synthetic state in the same isolated Postgres DB.
insert into public.items_catalog(item_key,item_name,payload)
values
 ('Boots of Speed|XDMG','Boots of Speed',
  '{"item_key":"Boots of Speed|XDMG","item_name":"Boots of Speed","uiSubKind":"Boots","rarity":"rare","modifySpeed":{"multiply":{"walk":2}}}'),
 ('Ring of Fire Resistance|XDMG','Ring of Fire Resistance',
  '{"item_key":"Ring of Fire Resistance|XDMG","item_name":"Ring of Fire Resistance","type":"RG|XDMG","rarity":"uncommon","resist":["fire"]}');
insert into public.inventory_items(id,item_id,item_name,owner_id,owner_type,is_equipped,equip_slot,card_payload)
values
('eeeeeeee-0000-4000-8000-000000000001','Boots of Speed|XDMG','Boots of Speed','aaaaaaaa-0000-4000-8000-000000000001','character',true,'feet','{}'),
('eeeeeeee-0000-4000-8000-000000000002','Ring of Fire Resistance|XDMG','Ring of Fire Resistance','aaaaaaaa-0000-4000-8000-000000000001','character',true,'ring_1','{}'),
('eeeeeeee-0000-4000-8000-000000000003','Ring of Protection|XDMG','Ring of Protection','aaaaaaaa-0000-4000-8000-000000000001','character',true,'ring_2','{"reqAttune":false}'),
('eeeeeeee-0000-4000-8000-000000000004','Cloak of Protection|XDMG','Cloak of Protection','aaaaaaaa-0000-4000-8000-000000000001','character',true,'shoulders','{}');

do $checks$
declare c uuid := 'aaaaaaaa-0000-4000-8000-000000000001'; r jsonb;
begin
  r:=private.verified_item_attunement_rule_v1('Ring of Protection|XDMG');
  if r->>'attunement'<>'required' or r->>'heading'<>'Ring of Protection'
  then raise exception 'Ring 2024 source registry mismatch: %',r; end if;
  r:=private.verified_item_attunement_rule_v1('Cloak of Protection|XDMG');
  if r->>'attunement'<>'required' then raise exception 'Cloak source registry mismatch %',r; end if;
  r:=private.verified_item_attunement_rule_v1('Boots of Speed|XDMG');
  if r->>'attunement'<>'required' then raise exception 'Boots source registry mismatch %',r; end if;
  r:=private.verified_item_attunement_rule_v1('Staff of Power|XDMG');
  if r->'classKeys'<>'["sorcerer","warlock","wizard"]'::jsonb
  then raise exception 'Staff class prerequisites lost %',r; end if;
  -- Exact source keys avoid accidentally propagating 2014 attunement rules
  -- into 2024 typed rings or mixing DMG/XDMG.
  r:=private.verified_item_attunement_rule_v1('Ring of Fire Resistance|XDMG');
  if r->>'attunement'<>'unknown' then raise exception 'Variant ring wrong edition mapping %',r; end if;
  r:=private.verified_item_attunement_rule_v1('Ring of Protection|DMG');
  if r->>'attunement'<>'unknown' then raise exception 'Legacy source key inferred %',r; end if;
  r:=private.passive_equipment_source_gate_v1(c,'eeeeeeee-0000-4000-8000-000000000001');
  if r->>'attunementSource'<>'required' or r->>'sourceStatus'<>'not_attuned'
     or r->>'attunementEvidence'<>'verified_br_2024_exact_item_key'
     or r->>'eligibleForPassiveMagic'<>'false'
  then raise exception 'Boots attunement missing or wrongly active %',r; end if;
  r:=private.passive_equipment_source_gate_v1(c,'eeeeeeee-0000-4000-8000-000000000002');
  if r->>'attunementSource'<>'unknown' or r->>'sourceStatus'<>'unknown_source_attunement'
     or r->>'eligibleForPassiveMagic'<>'false'
  then raise exception '2024 resistance-ring variant assumed 2014 attunement %',r; end if;
  r:=private.passive_equipment_source_gate_v1(c,'eeeeeeee-0000-4000-8000-000000000003');
  if r->>'attunementSource'<>'required' or r->>'sourceStatus'<>'not_attuned'
     or r->>'attunementEvidence'<>'verified_br_2024_exact_item_key'
  then raise exception 'Instance reqAttune:false erased verified protection ring requirement %',r; end if;
  r:=private.passive_equipment_source_gate_v1(c,'eeeeeeee-0000-4000-8000-000000000004');
  if r->>'attunementSource'<>'required' or r->>'sourceStatus'<>'not_attuned'
  then raise exception 'Cloak source fact not applied %',r; end if;
  -- A real attunement bond alone never proves Short Rest completion.
  insert into public.character_item_attunements(character_id,inventory_item_id)
  values(c,'eeeeeeee-0000-4000-8000-000000000001');
  r:=private.passive_equipment_source_gate_v1(c,'eeeeeeee-0000-4000-8000-000000000001');
  if r->>'sourceStatus'<>'rest_and_prerequisites_unverified'
    or r->>'restAndPrerequisitesVerified'<>'false'
    or r->>'eligibleForPassiveMagic'<>'false'
  then raise exception 'Boots bonded before valid rest grants magic %',r; end if;
  -- An explicit (contradictory) negative catalogue field is an unresolved
  -- source import conflict, not a reason to grant or suppress magic silently.
  update public.items_catalog
  set payload=payload||'{"reqAttune":false}'::jsonb
  where item_key='Ring of Protection|XDMG';
  r:=private.passive_equipment_source_gate_v1(c,'eeeeeeee-0000-4000-8000-000000000003');
  if r->>'sourceStatus'<>'source_metadata_conflict'
     or r->>'attunementSource'<>'source_conflict'
     or r->>'eligibleForPassiveMagic'<>'false'
  then raise exception 'Verified source/catalogue contradictory attunement not isolated %',r; end if;
  -- Both helper functions are internal and not executable by web users.
  if has_function_privilege('authenticated','private.verified_item_attunement_rule_v1(text)','EXECUTE')
    or has_function_privilege('anon','private.verified_item_attunement_rule_v1(text)','EXECUTE')
  then raise exception 'Curated source registry exposed publicly'; end if;
end $checks$;
select 'Verified 2024 source attunement rules and edition-conflict guards passed' as result;
