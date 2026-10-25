\set ON_ERROR_STOP on
-- Reuse genuine server-shape setting + selection tables and ownership guards
-- from the existing isolated SQL fixtures. They have no live DB connection.
\i scripts/fixtures/optional_attunement_setting_behavior.sql
\i scripts/fixtures/optional_rest_magic_item_selection_behavior.sql
\i sql/20261025_04_character_effect_source_gate_shadow.sql

do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 other uuid:='cccccccc-0000-4000-8000-000000000002';
 ring uuid:='eeeeeeee-0000-4000-8000-000000000001';
 boots uuid:='eeeeeeee-0000-4000-8000-000000000004';
 shared uuid:='eeeeeeee-0000-4000-8000-000000000009';
 rapier uuid:='eeeeeeee-0000-4000-8000-000000000006';
 unknown_item uuid:='eeeeeeee-0000-4000-8000-000000000007';
 foreign_item uuid:='eeeeeeee-0000-4000-8000-000000000010';
 held jsonb;
 other_held jsonb;
 one jsonb;
 blocked boolean;
begin
 if has_function_privilege('anon','private.character_magic_effect_source_gate_shadow_v1(uuid)','EXECUTE')
 or has_function_privilege('authenticated','private.character_magic_effect_source_gate_shadow_v1(uuid)','EXECUTE')
 or not has_function_privilege('service_role','private.character_magic_effect_source_gate_shadow_v1(uuid)','EXECUTE')
 then raise exception 'Trusted shadow projection was publicly callable'; end if;

 -- OFF must preserve the current source eligibility of every equipped
 -- item, even a source whose magic provenance is not verified yet.
 held:=private.character_magic_effect_source_gate_shadow_v1(c);
 if held->>'attunementEnabled'<>'false'
 or held->>'consumerEnforced'<>'false'
 or exists(select 1 from jsonb_array_elements(held->'items') x
    where x->>'magicRiderEligible'<>'true')
 then raise exception 'OFF lost legacy equipped-source eligibility %',held; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(true);
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);

 held:=private.character_magic_effect_source_gate_shadow_v1(c);
 if held->>'attunementEnabled'<>'true'
 or held->>'maxItems'<>'3'
 or held->>'consumerEnforced'<>'false'
 then raise exception 'ON gate status incorrectly claims enforcement %',held; end if;
 select x into one from jsonb_array_elements(held->'items') x
   where x->>'inventoryItemId'=ring::text;
 if one->>'magicRiderEligible'<>'false' or one->>'physicalEquipped'<>'true'
 or one->>'reason'<>'not_selected'
 then raise exception 'Unchosen magic ring was eligible or lost its equipped state %',one; end if;

 -- Genuine mundane physical equipment remains part of the source list.
 select x into one from jsonb_array_elements(held->'items') x
   where x->>'inventoryItemId'=rapier::text;
 if one->>'magicRiderEligible'<>'true' or one->>'reason'<>'mundane'
 then raise exception 'Mundane equipped source wrongly gated %',one; end if;

 select x into one from jsonb_array_elements(held->'items') x
   where x->>'inventoryItemId'=unknown_item::text;
 if one->>'magicRiderEligible'<>'false' or one->>'reason'<>'unverified_magic_source'
 then raise exception 'Unverified rare source was trusted for magic %',one; end if;

 -- A character must never import a different character's exclusive row.
 if exists(select 1 from jsonb_array_elements(held->'items') x
    where x->>'inventoryItemId'=foreign_item::text)
 then raise exception 'Foreign character inventory leaked into source projection'; end if;

 perform public.set_character_rest_magic_choices_v1(c,array[ring,boots,shared]);
 held:=private.character_magic_effect_source_gate_shadow_v1(c);
 if (select count(*) from jsonb_array_elements(held->'items') x
      where x->>'selectedForCharacter'='true')<>3
 then raise exception 'Three chosen sources not reflected by authoritative IDs %',held; end if;
 select x into one from jsonb_array_elements(held->'items') x
   where x->>'inventoryItemId'=shared::text;
 if one->>'magicRiderEligible'<>'true'
 or one->>'accountScopeAmbiguous'<>'true'
 or one->>'sourceMagicVerified'<>'true'
 then raise exception 'Shared account magic source not safely attributed %',one; end if;

 other_held:=private.character_magic_effect_source_gate_shadow_v1(other);
 select x into one from jsonb_array_elements(other_held->'items') x
   where x->>'inventoryItemId'=shared::text;
 if one->>'magicRiderEligible'<>'false'
 or one->>'claimedByAnotherCharacter'<>'true'
 or one->>'reason'<>'claimed_by_other_character'
 or one->>'accountScopeAmbiguous'<>'true'
 then raise exception 'Same account item leaked magic rider to second character %',one; end if;

 -- OFF is the explicit parity switch, never requiring bonds or unequips.
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(false);
 held:=private.character_magic_effect_source_gate_shadow_v1(other);
 if exists(select 1 from jsonb_array_elements(held->'items') x
    where x->>'magicRiderEligible'<>'true')
 then raise exception 'OFF suppressed existing equipment source %',held; end if;

 blocked:=false;
 begin
  perform private.character_magic_effect_source_gate_shadow_v1(null);
 exception when invalid_parameter_value then blocked:=true; end;
 if not blocked then raise exception 'Null character accepted'; end if;
 blocked:=false;
 begin
  perform private.character_magic_effect_source_gate_shadow_v1('cccccccc-0000-4000-8000-000000000099'::uuid);
 exception when no_data_found then blocked:=true; end;
 if not blocked then raise exception 'Missing character accepted'; end if;
end $test$;
select 'Real inventory source gate OFF/ON, exclusive selected identity, provenance, shared account, no cross-character leaks passed' as result;
