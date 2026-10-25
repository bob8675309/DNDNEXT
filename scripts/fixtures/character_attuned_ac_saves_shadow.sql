\set ON_ERROR_STOP on
-- Bootstrap the disposable, real-schema-shaped account/character/selection
-- test data. Earlier PG16 fixtures intentionally leave campaign rule OFF.
\i scripts/fixtures/character_magic_source_gate_shadow.sql

-- Extend disposable tables to the actual legacy resolver's required columns.
alter table public.inventory_items
  add column item_type text,
  add column updated_at timestamptz default now();
alter table public.items_catalog
  add column item_name text,
  add column payload jsonb not null default '{}'::jsonb;
create table public.character_sheets(character_id uuid primary key,sheet jsonb);
insert into public.character_sheets values
('cccccccc-0000-4000-8000-000000000001',
 '{"abilities":{"dex":{"score":16},"str":{"score":12}}}'::jsonb),
('cccccccc-0000-4000-8000-000000000002',
 '{"abilities":{"dex":{"score":12}}}'::jsonb);
create or replace function public.craft_payload_inferred_ac(p_name text)
returns integer language sql immutable
as $f$ select null::integer $f$;

-- Existing staff source adds +3 AC, +2 global saves, +1 Dex save;
-- all three must disappear together while the staff remains equipped.
update public.inventory_items
set card_payload='{"bonusAc":3,"bonusSavingThrow":2,"modifiers":{"saves":{"dex":1}}}'::jsonb
where id='eeeeeeee-0000-4000-8000-000000000002';

-- Ordinary mundane Breastplate physically provides AC14 + up to 2 DEX.
insert into public.inventory_items
  (id,item_id,item_name,item_rarity,card_payload,owner_type,owner_id,is_equipped,equip_slot,item_type)
values
 ('eeeeeeee-0000-4000-8000-000000000011','Breastplate|XPHB','Breastplate','mundane',
  '{"ac":14,"type":"MA|XPHB"}','character','cccccccc-0000-4000-8000-000000000001',true,'body','medium armor'),
 -- Animated Shield: physical AC2 survives without attunement, +1 save rider does not.
 ('eeeeeeee-0000-4000-8000-000000000012','AnimatedShield|XDMG','Animated Shield','very rare',
  '{"ac":2,"type":"S|XDMG","bonusSavingThrow":1}','character','cccccccc-0000-4000-8000-000000000001',true,'misc_1','shield'),
 -- Cloak: catalogue +1 AC but this instance overrides that to +2.
 ('eeeeeeee-0000-4000-8000-000000000013','CloakProtection|XDMG','Cloak of Protection','uncommon',
  '{"bonusAc":2,"bonusSavingThrow":1}','character','cccccccc-0000-4000-8000-000000000001',true,'shoulders','wondrous item');
insert into public.items_catalog(item_key,item_rarity,item_name,payload) values
 ('Breastplate|XPHB','mundane','Breastplate','{"ac":14,"type":"MA|XPHB"}'),
 ('AnimatedShield|XDMG','very rare','Animated Shield','{"ac":2,"type":"S|XDMG"}'),
 ('CloakProtection|XDMG','uncommon','Cloak of Protection','{"bonusAc":1,"bonusSavingThrow":1}');

-- Compile the exact legacy resolver (copy compared byte-for-byte by CI),
-- then the new read-only direct bonus comparison function.
\i scripts/fixtures/legacy_character_equipment_resolver_v1.sql
\i sql/20261025_06_character_attuned_ac_saves_shadow.sql

do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 cloak uuid:='eeeeeeee-0000-4000-8000-000000000013';
 shield uuid:='eeeeeeee-0000-4000-8000-000000000012';
 staff uuid:='eeeeeeee-0000-4000-8000-000000000002';
 unknown_item uuid:='eeeeeeee-0000-4000-8000-000000000007';
 res jsonb;
 base jsonb;
 shadow jsonb;
 denied boolean;
begin
 if has_function_privilege('anon','private.character_attuned_ac_saves_shadow_v1(uuid)','EXECUTE')
    or has_function_privilege('authenticated','private.character_attuned_ac_saves_shadow_v1(uuid)','EXECUTE')
    or not has_function_privilege('service_role','private.character_attuned_ac_saves_shadow_v1(uuid)','EXECUTE')
 then raise exception 'Shadow AC/saves function leaked role grants'; end if;

 res:=private.character_attuned_ac_saves_shadow_v1(c);
 base:=private.character_equipment_effects_v1(c);
 if res->'baseline' is distinct from base or res->'shadow' is distinct from base
    or res->>'wouldChange'<>'false' or res->>'consumerEnforced'<>'false'
 then raise exception 'OFF did not preserve exact legacy character equipment effects %',res; end if;
 if (base#>>'{ac,total}')::integer<>23
    or (base#>>'{ac,base}')::integer<>16
    or (base#>>'{ac,shieldBonus}')::integer<>2
    or (base#>>'{ac,otherBonus}')::integer<>5
    or (base->>'savesAll')::integer<>4
    or (base#>>'{saves,dex}')::integer<>1
 then raise exception 'Legacy breastplate shield cloak staff formula unexpected %',base; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(true);
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);

 -- A single chosen cloak retains its INSTANCE +2 AC/+1 saves; staff magic
 -- (+3 AC/+2 saves/+1 DEX save) and magic shield's +1 save are suppressed.
 -- Shield AC2 and Breastplate AC14+DEX2 MUST survive unselected status.
 perform public.set_character_rest_magic_choices_v1(c,array[cloak]);
 res:=private.character_attuned_ac_saves_shadow_v1(c);
 base:=res->'baseline'; shadow:=res->'shadow';
 if (base#>>'{ac,total}')::integer<>23
    or (shadow#>>'{ac,total}')::integer<>20
    or (shadow#>>'{ac,base}')::integer<>16
    or (shadow#>>'{ac,shieldBonus}')::integer<>2
    or shadow#>>'{ac,armorItemId}'<>'eeeeeeee-0000-4000-8000-000000000011'
    or shadow#>>'{ac,shieldItemId}'<>shield::text
    or (shadow#>>'{ac,otherBonus}')::integer<>2
    or (shadow->>'savesAll')::integer<>1
    or (shadow#>>'{saves,dex}')::integer<>0
    or res->>'directAcSavesComparisonComplete'<>'false'
    or res->>'consumerEnforced'<>'false'
 then raise exception 'Chosen cloak, unchosen staff and physical shield AC shadow mismatch %',res; end if;
 if not exists(select 1 from jsonb_array_elements(res->'unresolvedItemIds') x
    where x#>>'{}'=shield::text)
 then raise exception 'Unknown shield base/enhancement split was silently marked verified'; end if;

 -- Exactly three choices: physical equipment unchanged; known direct magic
 -- bonuses return to legacy totals (though broader effect parity remains open).
 perform public.set_character_rest_magic_choices_v1(c,array[cloak,shield,staff]);
 res:=private.character_attuned_ac_saves_shadow_v1(c);
 if res->'shadow' is distinct from res->'baseline'
    or res->>'wouldChange'<>'false'
    or res->>'fullEffectConsumerParityReady'<>'false'
 then raise exception 'Selected item direct AC/saves did not match legacy %',res; end if;

 -- Remove all magic choices. The character still wears physical armor and
 -- shield, but gets NONE of the cloak/staff/shield magic bonuses.
 perform public.set_character_rest_magic_choices_v1(c,array[]::uuid[]);
 res:=private.character_attuned_ac_saves_shadow_v1(c);
 shadow:=res->'shadow';
 if (shadow#>>'{ac,total}')::integer<>18
    or (shadow#>>'{ac,base}')::integer<>16
    or (shadow#>>'{ac,shieldBonus}')::integer<>2
    or (shadow#>>'{ac,otherBonus}')::integer<>0
    or (shadow->>'savesAll')::integer<>0
    or (shadow#>>'{saves,dex}')::integer<>0
 then raise exception 'Unselected magic erroneously removed physical armor or retained magic %',res; end if;

 -- An item of unverified origin can display rarity/payload yet must not
 -- contribute its direct +4 AC and +5 saves while optional ON.
 update public.inventory_items set
   card_payload='{"bonusAc":4,"bonusSavingThrow":5}'::jsonb
 where id=unknown_item;
 res:=private.character_attuned_ac_saves_shadow_v1(c);
 if (res->'baseline'#>>'{ac,total}')::integer<>22
    or (res->'shadow'#>>'{ac,total}')::integer<>18
    or (res->'baseline'->>'savesAll')::integer<>9
    or (res->'shadow'->>'savesAll')::integer<>0
 then raise exception 'Unverified magic inventory instance bypassed gate %',res; end if;

 -- OFF is exact baseline parity regardless of prior selected state.
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(false);
 res:=private.character_attuned_ac_saves_shadow_v1(c);
 base:=private.character_equipment_effects_v1(c);
 if res->'baseline' is distinct from base or res->'shadow' is distinct from base
    or res->>'wouldChange'<>'false'
 then raise exception 'OFF equipment parity drifted after toggle %',res; end if;

 denied:=false;
 begin perform private.character_attuned_ac_saves_shadow_v1(null);
 exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Missing character id not rejected'; end if;
end $test$;
select 'Legacy AC and saves exact OFF parity, chosen magic riders, physical shield/armor preservation and unsafe-source exclusion passed' as result;
