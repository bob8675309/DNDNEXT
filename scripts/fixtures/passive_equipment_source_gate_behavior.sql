\set ON_ERROR_STOP on
-- Reuse draft #257 isolated schema and tests, then stage read-only source gate.
-- No production DB, characters or inventory are accessed.
insert into public.items_catalog(item_key,item_name,payload) values
('Ring of Protection|XDMG','Ring of Protection',
 '{"item_key":"Ring of Protection|XDMG","item_name":"Ring of Protection","type":"RG|XDMG","rarity":"rare","bonusAc":"+1","bonusSavingThrow":"+1"}'),
('Cloak of Protection|XDMG','Cloak of Protection',
 '{"item_key":"Cloak of Protection|XDMG","item_name":"Cloak of Protection","uiSubKind":"Cloak","rarity":"uncommon","bonusAc":"+1","bonusSavingThrow":"+1"}'),
('Staff of Power|XDMG','Staff of Power',
 '{"item_key":"Staff of Power|XDMG","item_name":"Staff of Power","type":"M|XPHB","rarity":"very rare","reqAttuneTags":[{"class":"sorcerer"},{"class":"warlock"},{"class":"wizard"}],"bonusAc":"+2","bonusSavingThrow":"+2"}'),
('Shield|XPHB','Shield',
 '{"item_key":"Shield|XPHB","item_name":"Shield","type":"S|XPHB","rarity":"none","item_rarity":"mundane","ac":2}'),
('Chain Mail|XPHB','Chain Mail',
 '{"item_key":"Chain Mail|XPHB","item_name":"Chain Mail","type":"HA|XPHB","rarity":"none","item_rarity":"mundane","ac":16}'),
('Explicit no-attune test|HOME','Explicit no-attune test',
 '{"item_key":"Explicit no-attune test|HOME","type":"RG|HOME","rarity":"uncommon","reqAttune":false,"bonusAc":"+1"}');
insert into public.inventory_items(id,item_id,item_name,owner_id,owner_type,is_equipped,equip_slot,card_payload)
values
('dddddddd-0000-4000-8000-000000000001','Ring of Protection|XDMG','Ring of Protection','bbbbbbbb-0000-4000-8000-000000000002','player',true,'ring_1','{}'),
('dddddddd-0000-4000-8000-000000000002','Staff of Power|XDMG','Staff of Power','aaaaaaaa-0000-4000-8000-000000000001','character',true,'weapon_1','{"reqAttune":false}'),
('dddddddd-0000-4000-8000-000000000003','Shield|XPHB','Shield','aaaaaaaa-0000-4000-8000-000000000001','character',true,'back','{}'),
('dddddddd-0000-4000-8000-000000000004','Chain Mail|XPHB','Chain Mail','aaaaaaaa-0000-4000-8000-000000000001','character',true,'body','{}'),
('dddddddd-0000-4000-8000-000000000005','Cloak of Protection|XDMG','Cloak of Protection','aaaaaaaa-0000-4000-8000-000000000001','character',true,'shoulders','{}'),
('dddddddd-0000-4000-8000-000000000006','Explicit no-attune test|HOME','Explicit no-attune test','aaaaaaaa-0000-4000-8000-000000000001','character',true,'ring_2','{}'),
('dddddddd-0000-4000-8000-000000000007','missing|XDMG','Ghost Item','aaaaaaaa-0000-4000-8000-000000000001','character',true,'weapon_2','{}'),
('dddddddd-0000-4000-8000-000000000008','Ring of Protection|XDMG','Ring of Protection','aaaaaaaa-0000-4000-8000-000000000001','character',false,null,'{}');
do $tests$
declare c uuid:='aaaaaaaa-0000-4000-8000-000000000001';
  alt uuid:='aaaaaaaa-0000-4000-8000-000000000002';
  v jsonb;
begin
  v:=private.passive_equipment_source_gate_v1(c,'dddddddd-0000-4000-8000-000000000001');
  if v->>'sourceStatus'<>'not_attuned'
      or v->>'attunementSource'<>'required'
      or v->>'attunementEvidence'<>'verified_br_2024_exact_item_key'
      or v->>'sourceKind'<>'ring'
      or v->>'slotStatus'<>'valid'
      or (v->>'eligibleForPassiveMagic')::boolean then
    raise exception 'Ring of Protection exact-source requirement not normalized: %',v;
  end if;

  v:=private.passive_equipment_source_gate_v1(c,'dddddddd-0000-4000-8000-000000000002');
  if v->>'sourceStatus'<>'not_attuned' or v->>'attunementSource'<>'required'
       or v->>'slotStatus'<>'valid'
       or (v->>'eligibleForPassiveMagic')::boolean then
    raise exception 'Staff of Power source requirement erased by instance false: %',v; end if;

  -- A bond is only state: no Short Rest/class prerequisite confirmation yet.
  insert into public.character_item_attunements(character_id,inventory_item_id)
    values(c,'dddddddd-0000-4000-8000-000000000002');
  v:=private.passive_equipment_source_gate_v1(c,'dddddddd-0000-4000-8000-000000000002');
  if v->>'sourceStatus'<>'rest_and_prerequisites_unverified'
       or v->>'bondPresent'<>'true'
       or v->>'eligibleForPassiveMagic'<>'false' then
    raise exception 'Recorded bond incorrectly treated as complete magic eligibility: %',v; end if;
  
  v:=private.passive_equipment_source_gate_v1(c,'dddddddd-0000-4000-8000-000000000003');
  if v->>'slotStatus'<>'invalid' or v->>'sourceStatus'<>'wrong_slot'
       or v->>'eligibleMundaneBaseAc'<>'false' then
    raise exception 'Shield in invalid back slot accepted: %',v; end if;
  update public.inventory_items set equip_slot='weapon_2'
  where id='dddddddd-0000-4000-8000-000000000003';
  v:=private.passive_equipment_source_gate_v1(c,'dddddddd-0000-4000-8000-000000000003');
  if v->>'slotStatus'<>'valid' or v->>'eligibleMundaneBaseAc'<>'true'
       or v->>'attunementSource'<>'not_required_mundane'
       or v->>'eligibleForPassiveMagic'<>'false' then
    raise exception 'Mundane shield eligibility or magical guard incorrect: %',v; end if;
  v:=private.passive_equipment_source_gate_v1(c,'dddddddd-0000-4000-8000-000000000004');
  if v->>'eligibleMundaneBaseAc'<>'true' or v->>'sourceKind'<>'armor' then
    raise exception 'Body slot mundane armor discarded: %',v; end if;
  update public.inventory_items set equip_slot='weapon_3'
  where id='dddddddd-0000-4000-8000-000000000004';
  v:=private.passive_equipment_source_gate_v1(c,'dddddddd-0000-4000-8000-000000000004');
  if v->>'eligibleMundaneBaseAc'<>'false' or v->>'sourceStatus'<>'wrong_slot' then
    raise exception 'Wrong-slot body armor accepted: %',v; end if;

  v:=private.passive_equipment_source_gate_v1(c,'dddddddd-0000-4000-8000-000000000005');
  if v->>'attunementSource'<>'required' or v->>'sourceStatus'<>'not_attuned'
       or v->>'attunementEvidence'<>'verified_br_2024_exact_item_key'
  then raise exception 'Cloak of Protection 2024 source requirement not normalized: %',v; end if;
  v:=private.passive_equipment_source_gate_v1(c,'dddddddd-0000-4000-8000-000000000006');
  if v->>'sourceStatus'<>'consumer_rule_unverified'
      or v->>'attunementSource'<>'explicitly_not_required'
      or v->>'eligibleForPassiveMagic'<>'false' then
    raise exception 'Explicit no-attune item bypassed final consumer gate: %',v; end if;
  v:=private.passive_equipment_source_gate_v1(c,'dddddddd-0000-4000-8000-000000000007');
  if v->>'sourceStatus'<>'unknown_source' then raise exception 'Unknown edition/source accepted: %',v; end if;
  v:=private.passive_equipment_source_gate_v1(c,'dddddddd-0000-4000-8000-000000000008');
  if v->>'sourceStatus'<>'not_equipped' then raise exception 'Carried item counted as passive gear: %',v; end if;
  v:=private.passive_equipment_source_gate_v1(alt,'dddddddd-0000-4000-8000-000000000002');
  if v->>'sourceStatus'<>'wrong_owner' then raise exception 'Foreign character accessed equipment: %',v; end if;

  -- Same player's two editable characters share owner ID but not necessarily
  -- ownership of the same equipped instance; magic must never grant to both.
  insert into public.character_permissions(character_id,user_id,can_edit)
  values(alt,'bbbbbbbb-0000-4000-8000-000000000002',true);
  v:=private.passive_equipment_source_gate_v1(c,'dddddddd-0000-4000-8000-000000000001');
  if v->>'sourceStatus'<>'ambiguous_player_owner'
      or v->>'playerOwnerAmbiguous'<>'true'
      or v->>'eligibleForPassiveMagic'<>'false' then
    raise exception 'Shared player owner granted magic to multiple characters: %',v; end if;
  v:=private.passive_equipment_source_gate_v1(alt,'dddddddd-0000-4000-8000-000000000001');
  if v->>'sourceStatus'<>'ambiguous_player_owner' or v->>'eligibleForPassiveMagic'<>'false' then
    raise exception 'Second character incorrectly granted first character item magic: %',v; end if;
  if has_function_privilege('authenticated','private.passive_equipment_source_gate_v1(uuid,uuid)','EXECUTE')
     or has_function_privilege('anon','private.passive_equipment_source_gate_v1(uuid,uuid)','EXECUTE') then
    raise exception 'Private eligibility probe executable by browser caller';
  end if;
end $tests$;
select 'Internal passive item source gate: fail-closed ownership/attunement/slots passed' as result;
