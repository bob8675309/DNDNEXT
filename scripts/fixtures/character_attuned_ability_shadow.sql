\set ON_ERROR_STOP on
-- Actual legacy equipment resolver + vetted source gate fixtures, disposable DB.
\i scripts/fixtures/character_attuned_ac_saves_shadow.sql
\i sql/20261025_07_character_attuned_ability_shadow.sql

-- Existing trusted catalogue-backed Boots supply +4 DEX score and +1
-- DEX modifier. The Staff adds +2 STR score and +1 STR modifier, while
-- retaining earlier +3 AC / +2 global saves / +1 DEX save.
update public.inventory_items
set card_payload='{"modifiers":{"abilities":{"dex":4},"abilityMods":{"dex":1}}}'::jsonb
where id='eeeeeeee-0000-4000-8000-000000000004';
update public.inventory_items
set card_payload='{"bonusAc":3,"bonusSavingThrow":2,"modifiers":{"saves":{"dex":1},"abilityScores":{"str":2},"abilityModifiers":{"str":1}}}'::jsonb
where id='eeeeeeee-0000-4000-8000-000000000002';

do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 cloak uuid:='eeeeeeee-0000-4000-8000-000000000013';
 shield uuid:='eeeeeeee-0000-4000-8000-000000000012';
 staff uuid:='eeeeeeee-0000-4000-8000-000000000002';
 boots uuid:='eeeeeeee-0000-4000-8000-000000000004';
 breastplate uuid:='eeeeeeee-0000-4000-8000-000000000011';
 unknown_item uuid:='eeeeeeee-0000-4000-8000-000000000007';
 res jsonb;
 base jsonb;
 shadow jsonb;
begin
 if has_function_privilege('anon','private.character_attuned_ability_shadow_v1(uuid)','EXECUTE')
    or has_function_privilege('authenticated','private.character_attuned_ability_shadow_v1(uuid)','EXECUTE')
    or not has_function_privilege('service_role','private.character_attuned_ability_shadow_v1(uuid)','EXECUTE')
 then raise exception 'Ability shadow can be called from public credentials'; end if;

 res:=private.character_attuned_ability_shadow_v1(c);
 base:=private.character_equipment_effects_v1(c);
 if res->'shadow' is distinct from base or res->'baseline' is distinct from base
    or res->>'wouldChange'<>'false' or res->>'consumerEnforced'<>'false'
 then raise exception 'Ability shadow OFF changed canonical effects %',res; end if;
 if (base#>>'{abilities,dex,effectiveScore}')::integer<>20
    or (base#>>'{abilities,dex,effectiveMod}')::integer<>6
    or (base#>>'{abilities,str,effectiveScore}')::integer<>14
    or (base#>>'{abilities,str,effectiveMod}')::integer<>3
 then raise exception 'Baseline abilities did not use real modifier alias precedence %',base; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(true);
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 perform public.set_character_rest_magic_choices_v1(c,array[cloak]);

 -- Medium armor caps DEX at +2 even though equipped unselected Boots
 -- provide +4 score and +1 direct modifier on the legacy path.
 res:=private.character_attuned_ability_shadow_v1(c);
 base:=res->'baseline'; shadow:=res->'shadow';
 if (base#>>'{abilities,dex,effectiveScore}')::integer<>20
    or (base#>>'{abilities,dex,effectiveMod}')::integer<>6
    or (shadow#>>'{abilities,dex,effectiveScore}')::integer<>16
    or (shadow#>>'{abilities,dex,effectiveMod}')::integer<>3
    or (base#>>'{abilities,str,effectiveScore}')::integer<>14
    or (shadow#>>'{abilities,str,effectiveScore}')::integer<>12
    or (shadow#>>'{abilities,str,effectiveMod}')::integer<>1
    or (shadow#>>'{ac,base}')::integer<>16
    or (shadow#>>'{ac,total}')::integer<>20
    or (shadow#>>'{ac,dexApplied}')::integer<>2
    or (shadow#>>'{ac,shieldBonus}')::integer<>2
    or (shadow#>>'{ac,shieldItemId}')<>shield::text
    or (shadow->>'savesAll')::integer<>1
    or res->>'abilityComparisonComplete'<>'true'
    or res->>'acDexRecalculationComplete'<>'true'
    or res->>'consumerEnforced'<>'false'
    or res->>'fullEffectConsumerParityReady'<>'false'
 then raise exception 'Medium armor DEX cap or source-specific ability projection failed %',res; end if;

 -- Chosen Staff + Boots keep original score/modifier contributions;
 -- unknown rare, magic shield and other unchosen bonus riders stay suppressed.
 perform public.set_character_rest_magic_choices_v1(c,array[cloak,staff,boots]);
 res:=private.character_attuned_ability_shadow_v1(c);
 if (res->'shadow'#>>'{abilities,dex,effectiveScore}')::integer<>20
    or (res->'shadow'#>>'{abilities,dex,effectiveMod}')::integer<>6
    or (res->'shadow'#>>'{abilities,str,effectiveScore}')::integer<>14
    or (res->'shadow'#>>'{abilities,str,effectiveMod}')::integer<>3
    or (res->'shadow'#>>'{ac,total}')::integer<>23
    or (res->'shadow'->>'savesAll')::integer<>3
 then raise exception 'Selected ability sources failed to match canonical resolver %',res; end if;

 -- Switch the same mundane body item into Light Armor. DEX is no longer
 -- capped; the shadow must reconcile AC base + total, not just ability cards.
 update public.inventory_items
 set item_id='Leather|XPHB',item_name='Leather Armor',
     card_payload='{"ac":11,"type":"LA|XPHB"}'::jsonb
 where id=breastplate;
 perform public.set_character_rest_magic_choices_v1(c,array[cloak]);
 res:=private.character_attuned_ability_shadow_v1(c);
 if (res->'baseline'#>>'{ac,base}')::integer<>17
    or (res->'shadow'#>>'{ac,base}')::integer<>14
    or (res->'shadow'#>>'{ac,total}')::integer<>18
    or (res->'shadow'#>>'{ac,dexApplied}')::integer<>3
    or (res->'shadow'#>>'{ac,armorCategory}')<>'light'
 then raise exception 'Light armor DEX decrease did not reconcile physical AC %',res; end if;

 -- Custom manual sheet AC takes precedence over unarmored 10+DEX.
 -- A future source-specific adapter must not silently rewrite that value.
 update public.inventory_items set is_equipped=false where id=breastplate;
 update public.character_sheets set sheet=sheet||'{"ac":17}'::jsonb
 where character_id=c;
 res:=private.character_attuned_ability_shadow_v1(c);
 if res->>'acDexRecalculationComplete'<>'false'
    or res->>'unresolvedAcRule'<>'manual_sheet_ac_override'
    or (res->'shadow'#>>'{ac,base}')::integer<>17
    or (res->'shadow'#>>'{ac,total}')::integer<>21
 then raise exception 'Manual sheet AC must be explicitly unresolved %',res; end if;

 update public.character_sheets set sheet=sheet-'ac' where character_id=c;
 res:=private.character_attuned_ability_shadow_v1(c);
 if res->>'acDexRecalculationComplete'<>'true'
    or (res->'shadow'#>>'{ac,base}')::integer<>13
    or (res->'shadow'#>>'{ac,total}')::integer<>17
 then raise exception 'Standard unarmored 10+DEX recalculation failed %',res; end if;

 -- Non-source-verified rarity should not inject ability score or modifier.
 update public.inventory_items
 set card_payload='{"bonusAc":4,"bonusSavingThrow":5,"modifiers":{"abilities":{"dex":2},"abilityMods":{"dex":2}}}'::jsonb
 where id=unknown_item;
 res:=private.character_attuned_ability_shadow_v1(c);
 if (res->'baseline'#>>'{abilities,dex,effectiveScore}')::integer<>22
    or (res->'shadow'#>>'{abilities,dex,effectiveScore}')::integer<>16
    or (res->'shadow'#>>'{abilities,dex,effectiveMod}')::integer<>3
    or (res->'shadow'#>>'{ac,total}')::integer<>17
 then raise exception 'Unverified abilities bypassed source eligibility %',res; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(false);
 res:=private.character_attuned_ability_shadow_v1(c);
 base:=private.character_equipment_effects_v1(c);
 if res->'shadow' is distinct from base or res->'baseline' is distinct from base
    or res->>'wouldChange'<>'false'
 then raise exception 'Ability shadow OFF could not restore exact baseline %',res; end if;
end $test$;
select 'Read-only ability-score/modifier and medium/light/unarmored AC parity passed' as result;
