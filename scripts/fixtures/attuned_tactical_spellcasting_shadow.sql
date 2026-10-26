\set ON_ERROR_STOP on
-- Disposable Postgres16. Compose all existing account/item/effects/weapon
-- sources without touching the real DnDWeb Supabase project.
\i scripts/fixtures/attuned_weapon_profile_shadow.sql

-- Preserve source-level tactical profile behavior without importing its
-- slot-writing trigger and backfill migrations.
create or replace function auth.role()
returns text language sql stable as $f$
select coalesce(nullif(current_setting('fixture.role',true),''),'service_role') $f$;
create or replace function public.encounter_can_control_participant_v1(p uuid)
returns boolean language sql stable as $f$
select auth.uid() is not null and exists(
 select 1 from public.encounter_participants ep
 join public.character_permissions cp on cp.character_id=ep.character_id
 where ep.id=p and cp.user_id=auth.uid() and cp.can_edit
) $f$;

create table public.class_catalog(
 id uuid primary key,
 class_key text,class_name text,source text,ruleset text,
 spellcasting_ability text,caster_progression text,prepared_spells_formula text
);
create table public.character_progression(
 character_id uuid primary key,class_id uuid,class_level integer
);
create table public.class_level_progression(
 class_id uuid,class_level integer,proficiency_bonus integer,spell_slots jsonb
);
create table public.encounter_spell_slots(
 participant_id uuid,pool_key text,slot_level integer,
 slots_max integer,slots_remaining integer,recharge_key text,
 source_class_key text,source_book text,source_ruleset text,source_class_level integer
);
create table public.spells_catalog(
 id uuid primary key,spell_key text,name text,source text,level integer,school text,
 casting_time text,range_text text,concentration boolean,
 attack_type text,saving_throw_abilities jsonb,
 damage_dice text,damage_types jsonb,healing_dice text
);
create table public.character_spells(
 id uuid primary key,character_id uuid,spell_id uuid,source_type text,source_label text,
 prepared boolean,always_available boolean,uses_max integer,uses_remaining integer,
 recharge text,casting_stat text,save_dc_override integer,
 attack_bonus_override integer,created_at timestamptz default now()
);
insert into public.class_catalog values
 ('eeeeeeee-aaaa-4000-8000-000000000001','warlock','Warlock','XPHB','2024','cha','pact','class+cha'),
 ('eeeeeeee-aaaa-4000-8000-000000000002','wizard','Wizard','XPHB','2024','int','full','class+int');
insert into public.character_progression values
 ('cccccccc-0000-4000-8000-000000000001','eeeeeeee-aaaa-4000-8000-000000000001',6),
 ('cccccccc-0000-4000-8000-000000000002','eeeeeeee-aaaa-4000-8000-000000000001',6);
insert into public.class_level_progression values
 ('eeeeeeee-aaaa-4000-8000-000000000001',6,3,'[0,0,2,0,0,0,0,0,0]'::jsonb);
insert into public.encounter_spell_slots values
 ('dddddddd-0000-4000-8000-000000000001','pact_magic',3,2,1,'short_rest','warlock','XPHB','2024',6);
insert into public.spells_catalog values
 ('eeeeeeee-bbbb-4000-8000-000000000001','eldritch-blast|xphb','Eldritch Blast','XPHB',0,'evocation','action','120 feet',false,'ranged','[]'::jsonb,'1d10','["force"]',null),
 ('eeeeeeee-bbbb-4000-8000-000000000002','witch-bolt|xphb','Witch Bolt','XPHB',1,'evocation','action','60 feet',true,'ranged','[]'::jsonb,'2d12','["lightning"]',null);
insert into public.character_spells(
 id,character_id,spell_id,source_type,source_label,prepared,always_available,
 uses_max,uses_remaining,recharge,casting_stat,save_dc_override,attack_bonus_override
) values
 ('eeeeeeee-cccc-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001',
  'eeeeeeee-bbbb-4000-8000-000000000001','class','Warlock',false,true,null,null,null,'cha',null,null),
 ('eeeeeeee-cccc-4000-8000-000000000002','cccccccc-0000-4000-8000-000000000001',
  'eeeeeeee-bbbb-4000-8000-000000000002','class','Warlock',true,false,3,2,'long_rest','cha',19,11);

-- Original tactical helper reads raw sheet ability score, unlike the
-- canonical equipment-effects resolver. Staff contributes +4 CHA score,
-- which must be selected to appear in the ON diagnostic candidate.
update public.character_sheets set sheet=
 '{"abilities":{"str":{"score":14},"dex":{"score":18},"cha":{"score":16}},"meta":{"classKey":"warlock"},"proficiencyBonus":3}'::jsonb
where character_id in (
 'cccccccc-0000-4000-8000-000000000001',
 'cccccccc-0000-4000-8000-000000000002');
update public.inventory_items
 set card_payload=jsonb_set(card_payload,'{modifiers}',
   coalesce(card_payload->'modifiers','{}'::jsonb) || '{"abilities":{"cha":4}}'::jsonb,true)
where id='eeeeeeee-0000-4000-8000-000000000002';

-- Real catalogue field shapes: Rod has +1 attack/DC, Wand only +1
-- attack. Their class/spell/stacking applicability remains unverified.
insert into public.items_catalog(item_key,item_rarity,item_name,payload) values
 ('+1 Rod of the Pact Keeper|XDMG','uncommon','+1 Rod of the Pact Keeper',
  '{"type":"RD|XDMG","bonusSpellAttack":"+1","bonusSpellSaveDc":"+1"}'::jsonb),
 ('+1 Wand of the War Mage|XDMG','uncommon','+1 Wand of the War Mage',
  '{"type":"WD|XDMG","bonusSpellAttack":"+1"}'::jsonb);
insert into public.inventory_items(
 id,item_id,item_name,item_rarity,card_payload,owner_type,owner_id,is_equipped,equip_slot,item_type
) values
 ('eeeeeeee-0000-4000-8000-000000000030','+1 Rod of the Pact Keeper|XDMG',
 '+1 Rod of the Pact Keeper','uncommon','{}'::jsonb,
 'character','cccccccc-0000-4000-8000-000000000001',true,'main_hand','rod'),
 ('eeeeeeee-0000-4000-8000-000000000031','+1 Wand of the War Mage|XDMG',
 '+1 Wand of the War Mage','uncommon','{}'::jsonb,
 'character','cccccccc-0000-4000-8000-000000000001',true,'off_hand','wand');
-- Unverified rare item claims +9 spell bonuses, but source gate must deny.
update public.inventory_items set
 card_payload=card_payload || '{"bonusSpellAttack":"+9","bonusSpellSaveDc":"+9"}'::jsonb
where id='eeeeeeee-0000-4000-8000-000000000007';

-- Exact source-controlled baseline, without installing any trigger/
-- backfill or allowing active encounter slots to be reinitialized.
\i scripts/fixtures/legacy_tactical_spellcasting_profile_v1.sql
\i sql/20261026_01_attuned_tactical_spellcasting_shadow.sql

do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 other uuid:='cccccccc-0000-4000-8000-000000000002';
 p uuid:='dddddddd-0000-4000-8000-000000000001';
 other_p uuid:='dddddddd-0000-4000-8000-000000000002';
 staff uuid:='eeeeeeee-0000-4000-8000-000000000002';
 rod uuid:='eeeeeeee-0000-4000-8000-000000000030';
 wand uuid:='eeeeeeee-0000-4000-8000-000000000031';
 unknown_item uuid:='eeeeeeee-0000-4000-8000-000000000007';
 shared uuid:='eeeeeeee-0000-4000-8000-000000000009';
 r jsonb;
 base jsonb;
 projected jsonb;
 entry jsonb;
begin
 perform set_config('fixture.role','service_role',true);
 if has_function_privilege('anon','private.encounter_attuned_spellcasting_shadow_v1(uuid)','EXECUTE')
    or has_function_privilege('authenticated','private.encounter_attuned_spellcasting_shadow_v1(uuid)','EXECUTE')
    or not has_function_privilege('service_role','private.encounter_attuned_spellcasting_shadow_v1(uuid)','EXECUTE')
 then raise exception 'Tactical spell shadow incorrectly callable from public roles'; end if;

 r:=private.encounter_attuned_spellcasting_shadow_v1(p);
 base:=public.encounter_spellcasting_profile_v1(p);
 if r->'shadow' is distinct from base or r->'baseline' is distinct from base
 or r->>'wouldChange'<>'false' or r->>'consumerEnforced'<>'false'
 or (base->>'spellAttackBonus')::integer<>6 or (base->>'spellSaveDc')::integer<>14
 or (base->>'castingAbilityScore')::integer<>16
 or (base->'slotSnapshot'->0->>'remaining')::integer<>1
 or jsonb_array_length(base->'knownSpells')<>2
 then raise exception 'Tactical spell OFF original profile or slot parity failed %',r; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(true);
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 perform public.set_character_rest_magic_choices_v1(c,array[]::uuid[]);

 r:=private.encounter_attuned_spellcasting_shadow_v1(p);
 projected:=r->'shadow';
 if (projected->>'spellAttackBonus')::integer<>6
 or (projected->>'spellSaveDc')::integer<>14
 or projected->'slotSnapshot' is distinct from r->'baseline'->'slotSnapshot'
 or projected->'knownSpells' is distinct from r->'baseline'->'knownSpells'
 or r->>'slotsAndKnownSpellsPreserved'<>'true'
 or r->>'focusBonusApplicabilityVerified'<>'false'
 or r->>'tacticalSpellParityReady'<>'false'
 or r->>'consumerEnforced'<>'false'
 then raise exception 'ON without chosen focus/ability changed tactical spell state %',r; end if;
 if (select count(*) from jsonb_array_elements(r->'focusSourceAudit'))<>3 then
   raise exception 'Focus catalogue fields missing from trusted inventory audit %',r; end if;
 select value into entry from jsonb_array_elements(r->'focusSourceAudit')
 where value->>'inventoryItemId'=unknown_item::text;
 if entry->>'sourceMagicVerified'<>'false'
 or entry->>'magicRiderEligible'<>'false'
 or entry->>'appliedToShadow'<>'false'
 then raise exception 'Unverified rare +9 focus payload was applied %',entry; end if;
 select value into entry from jsonb_array_elements(r->'focusSourceAudit')
 where value->>'inventoryItemId'=wand::text;
 if entry->>'bonusSpellAttackRaw'<>'+1'
 or entry->>'bonusSpellSaveDcRaw' is not null
 then raise exception 'Wand attack-only focus field incorrectly created save bonus %',entry; end if;
 if not (r->'unresolvedSources' ? 'tactical_raw_vs_equipment_ability_baseline_diverges')
 or not (r->'unresolvedSources' ? 'per_spell_override_origins_unverified')
 or not (r->'unresolvedSources' ? 'focus_bonus_application_unverified')
 then raise exception 'Tactical source divergence not reported %',r; end if;

 perform public.set_character_rest_magic_choices_v1(c,array[staff,rod]);
 r:=private.encounter_attuned_spellcasting_shadow_v1(p);
 projected:=r->'shadow';
 if (projected->>'castingAbilityModifier')::integer<>5
 or (projected->>'spellAttackBonus')::integer<>8
 or (projected->>'spellSaveDc')::integer<>16
 or (r->'baseline'->>'spellAttackBonus')::integer<>6
 or projected->'slotSnapshot' is distinct from r->'baseline'->'slotSnapshot'
 or projected->'knownSpells' is distinct from r->'baseline'->'knownSpells'
 then raise exception 'Chosen Staff CHA ability source or slot snapshot mismatch %',r; end if;
 select value into entry from jsonb_array_elements(r->'focusSourceAudit')
 where value->>'inventoryItemId'=rod::text;
 if entry->>'magicRiderEligible'<>'true'
 or entry->>'selectedForCharacter'<>'true'
 or entry->>'bonusSpellAttackRaw'<>'+1'
 or entry->>'bonusSpellSaveDcRaw'<>'+1'
 or entry->>'appliedToShadow'<>'false'
 then raise exception 'Selected Rod +1 bonuses were incorrectly automatically stacked %',entry; end if;

 -- Both Rod and Wand selectable; even together, class-specific focus
 -- bonuses MUST NOT be auto-added until applicability/stacking is proven.
 perform public.set_character_rest_magic_choices_v1(c,array[staff,rod,wand]);
 r:=private.encounter_attuned_spellcasting_shadow_v1(p);
 if (r->'shadow'->>'spellAttackBonus')::integer<>8
 or (r->'shadow'->>'spellSaveDc')::integer<>16
 then raise exception 'Two selected focus bonuses wrongly stacked %',r; end if;

 -- The other player character may see the same account shared inventory,
 -- but item selection does not authorize this character's spells.
 update public.inventory_items set
   card_payload=card_payload || '{"bonusSpellAttack":"+7"}'::jsonb
 where id=shared;
 perform public.set_character_rest_magic_choices_v1(c,array[shared]);
 r:=private.encounter_attuned_spellcasting_shadow_v1(other_p);
 select value into entry from jsonb_array_elements(r->'focusSourceAudit')
 where value->>'inventoryItemId'=shared::text;
 if entry->>'claimedByAnotherCharacter'<>'true'
 or entry->>'magicRiderEligible'<>'false'
 or entry->>'appliedToShadow'<>'false'
 then raise exception 'Shared account focus source leaked to other character %',entry; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(false);
 r:=private.encounter_attuned_spellcasting_shadow_v1(p);
 base:=public.encounter_spellcasting_profile_v1(p);
 if r->'shadow' is distinct from base or r->'baseline' is distinct from base
 or r->>'wouldChange'<>'false'
 then raise exception 'OFF after ON changed canonical tactical spell/slot output %',r; end if;

 -- Authenticated users still obey canonical per-participant control; never
 -- grant them access to the private comparison function.
 perform set_config('fixture.role','authenticated',true);
 perform set_config('fixture.uid','',true);
 begin
   perform public.encounter_spellcasting_profile_v1(p);
   raise exception 'Unauthorized tactical profile read unexpectedly succeeded';
 exception when others then
   if sqlerrm='Unauthorized tactical profile read unexpectedly succeeded' then raise; end if;
 end;
end $test$;
select 'Tactical spell shadow OFF exact parity, CHA attunement, focus provenance, cross-character isolation and unchanged slot snapshots passed' as result;
