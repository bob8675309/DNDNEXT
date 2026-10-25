\set ON_ERROR_STOP on
-- Disposable PG16 integration. Use the actual seeded item/attunement schema,
-- not free-floating fixture-supplied selection IDs.
\i scripts/fixtures/character_magic_source_gate_shadow.sql

-- The archived mitigation migration also defines an unused encounter writer;
-- this local-only stub exists for compilation, but the test NEVER calls it.
create table public.encounter_participants (
  id uuid primary key, character_id uuid, current_hp integer, temp_hp integer,
  damage_resistances text[],damage_immunities text[],
  damage_vulnerabilities text[],is_defeated boolean,updated_at timestamptz
);
alter table public.items_catalog
  add column item_name text,
  add column payload jsonb not null default '{}'::jsonb;

-- Source catalog inheritance: an inventory item with stale/empty card payload
-- must still inherit the current structured Resistance Ring rules.
update public.items_catalog
set item_name='Ring of Fire Resistance',
    payload='{"resist":["fire"],"damageReductionByType":{"fire":10}}'::jsonb
where item_key='Ring|XDMG';

-- Character/account-shared item instance riders; same physical item is
-- in both legacy character inventory projections.
update public.inventory_items
set card_payload='{"resist":["fire"],"damageReductionByType":{"fire":4}}'::jsonb
where id='eeeeeeee-0000-4000-8000-000000000009';
-- A rare item whose identity is NOT verified cannot gain ON magic effects.
update public.inventory_items
set card_payload='{"resist":["cold"],"damageReductionByType":{"cold":30}}'::jsonb
where id='eeeeeeee-0000-4000-8000-000000000007';
-- Unequipped items must never contribute even if they have a huge modifier.
update public.inventory_items
set card_payload='{"resist":["fire"],"damageReductionByType":{"fire":100}}'::jsonb
where id='eeeeeeee-0000-4000-8000-000000000008';

-- Exact existing canonical mitigation helper, unchanged. The old public
-- encounter writer is created but never invoked. The authoritative Oct16_08
-- Resistance-before-flat order is verified in code, not overwritten here.
\i sql/20261016_07_equipped_item_damage_mitigation.sql
\i sql/20261025_05_tactical_attuned_mitigation_shadow.sql

do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 other uuid:='cccccccc-0000-4000-8000-000000000002';
 ring uuid:='eeeeeeee-0000-4000-8000-000000000001';
 shared uuid:='eeeeeeee-0000-4000-8000-000000000009';
 foreign_ring uuid:='eeeeeeee-0000-4000-8000-000000000010';
 result jsonb;
 base jsonb;
 projected jsonb;
begin
 if has_function_privilege('anon','private.encounter_attuned_damage_mitigation_shadow_v1(uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','private.encounter_attuned_damage_mitigation_shadow_v1(uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','private.encounter_attuned_damage_mitigation_shadow_v1(uuid,text)','EXECUTE')
 then raise exception 'Read-only mitigation shadow leaked execute grants'; end if;

 -- OFF must equal the exact currently deployed legacy helper return JSON
 -- including source names, irrespective of stored attunement choices.
 result:=private.encounter_attuned_damage_mitigation_shadow_v1(c,'fire');
 base:=private.encounter_equipped_damage_mitigation_v1(c,'fire');
 if result->'baseline' is distinct from base
    or result->'shadow' is distinct from base
    or result->>'wouldChange'<>'false'
    or result->>'consumerEnforced'<>'false'
    or (base->>'flatReduction')::integer<>10
    or base->>'resistant'<>'true'
 then raise exception 'OFF legacy ring parity failed %',result; end if;

 -- Existing campaign damage order: 30 Fire -> 15 resisted -> 5 after DR10.
 if greatest(0,floor(30/2.0)::integer-(base->>'flatReduction')::integer)<>5
 then raise exception 'Resistance-before-reduction damage order diverged'; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(true);
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 perform public.set_character_rest_magic_choices_v1(c,array[ring,shared]);
 result:=private.encounter_attuned_damage_mitigation_shadow_v1(c,'fire');
 if result->>'attunementEnabled'<>'true'
    or result->>'consumerEnforced'<>'false'
    or result->'shadow' is distinct from result->'baseline'
    or result->>'wouldChange'<>'false'
 then raise exception 'Selected ring and shared item changed Fire resistance parity %',result; end if;

 -- Unselected ring no longer supplies its Fire DR10, but the selected
 -- shared item may still contribute Fire Resistance and DR4.
 perform public.set_character_rest_magic_choices_v1(c,array[shared]);
 result:=private.encounter_attuned_damage_mitigation_shadow_v1(c,'fire');
 projected:=result->'shadow';
 if result->>'wouldChange'<>'true'
    or projected->>'resistant'<>'true'
    or (projected->>'flatReduction')::integer<>4
    or (result->'baseline'->>'flatReduction')::integer<>10
 then raise exception 'Unselected Ring Fire DR still leaked into candidate %',result; end if;
 if greatest(0,floor(30/2.0)::integer-(projected->>'flatReduction')::integer)<>11
 then raise exception 'Selected-only Fire DR ordering changed'; end if;

 -- A shared item selected by character C must NOT give its magic riders to
 -- other character; the same account's physical gear custody is unresolved.
 result:=private.encounter_attuned_damage_mitigation_shadow_v1(other,'fire');
 if result->>'wouldChange'<>'true'
    or result->'shadow'->>'resistant'<>'false'
    or (result->'shadow'->>'flatReduction')::integer<>0
    or result->'baseline'->>'resistant'<>'true'
    or (result->'baseline'->>'flatReduction')::integer<>10
 then raise exception 'Shared account magic mitigation leaked across characters %',result; end if;
 -- The second character may select its OWN ring independently; the
 -- shared cloak selected by character C must still be excluded.
 perform public.set_character_rest_magic_choices_v1(other,array[foreign_ring]);
 result:=private.encounter_attuned_damage_mitigation_shadow_v1(other,'fire');
 if result->'shadow'->>'resistant'<>'true'
    or (result->'shadow'->>'flatReduction')::integer<>10
    or exists(select 1 from jsonb_array_elements_text(result->'shadow'->'sources') x
      where x='Shared Cloak')
 then raise exception 'Other character own Ring reused shared attunement rider %',result; end if;
 perform public.set_character_rest_magic_choices_v1(other,array[]::uuid[]);

 perform public.set_character_rest_magic_choices_v1(c,array[]::uuid[]);
 result:=private.encounter_attuned_damage_mitigation_shadow_v1(c,'fire');
 if result->'shadow'->>'resistant'<>'false'
    or (result->'shadow'->>'flatReduction')::integer<>0
 then raise exception 'Unselected magic still granted Fire mitigation %',result; end if;
 -- Unknown rare source has structured Cold payload, but no trusted identity.
 result:=private.encounter_attuned_damage_mitigation_shadow_v1(c,'cold');
 if result->'baseline'->>'resistant'<>'true'
    or (result->'baseline'->>'flatReduction')::integer<>30
    or result->'shadow'->>'resistant'<>'false'
    or (result->'shadow'->>'flatReduction')::integer<>0
 then raise exception 'Unverified rare Cold source obtained attunement eligibility %',result; end if;
 -- Unequipped mock Cloak Fire DR100 never contributed to either helper.
 result:=private.encounter_attuned_damage_mitigation_shadow_v1(c,'fire');
 if (result->'baseline'->>'flatReduction')::integer<>10
 then raise exception 'Unequipped item affected baseline'; end if;

 -- OFF changes only configuration and immediately returns exact legacy output.
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(false);
 result:=private.encounter_attuned_damage_mitigation_shadow_v1(other,'fire');
 base:=private.encounter_equipped_damage_mitigation_v1(other,'fire');
 if result->'shadow' is distinct from base
    or result->'baseline' is distinct from base
    or result->>'wouldChange'<>'false'
 then raise exception 'OFF did not restore shared-account legacy parity %',result; end if;
end $test$;
select 'Attuned tactical mitigation shadow preserves OFF parity, ON source exclusivity and 30 Fire -> 15 -> 5 legacy order' as result;
