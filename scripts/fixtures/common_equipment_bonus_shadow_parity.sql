-- Isolated shadow-parity checks using the exact numeric keys exported by
-- character_equipment_effects_v1; no character table or inventory data needed.
\set ON_ERROR_STOP on
do $shadow$
declare
  eq jsonb:='{"schemaVersion":1,"savesAll":1,"saves":{"dex":2},"skillsAll":3,"skills":{"athletics":4,"acrobatics":-1},"initiative":5,"ac":{"total":17,"otherBonus":1}}'::jsonb;
  effects jsonb;
  result jsonb;
  failed boolean;
begin
  effects:=private.normalize_equipment_bonus_effects_v1(eq,
    '{"event":"saving_throw","ability":"dex"}'::jsonb);
  result:=private.resolve_effect_bundle_v1(
    '{"saving_throw_bonus":4}'::jsonb,effects);
  if result #>> '{stats,saving_throw_bonus}'<>'7'
    or jsonb_array_length(effects)<>2
    or result #>> '{stats,ac}' is not null then
    raise exception 'Dex save equipment bonus was not preserved: %, %',effects,result;
  end if;
  effects:=private.normalize_equipment_bonus_effects_v1(eq,
    '{"event":"ability_check","skill":"athletics"}'::jsonb);
  result:=private.resolve_effect_bundle_v1(
    '{"athletics_check":2}'::jsonb,effects);
  if result #>> '{stats,athletics_check}'<>'9'
    or jsonb_array_length(effects)<>2 then
    raise exception 'Athletics skill bonus was not preserved: %, %',effects,result;
  end if;
  effects:=private.normalize_equipment_bonus_effects_v1(eq,
    '{"event":"ability_check","skill":"acrobatics"}'::jsonb);
  result:=private.resolve_effect_bundle_v1(
    '{"acrobatics_check":1}'::jsonb,effects);
  if result #>> '{stats,acrobatics_check}'<>'3' then
    raise exception 'Acrobatics penalty was lost: %, %',effects,result;
  end if;
  effects:=private.normalize_equipment_bonus_effects_v1(eq,
    '{"event":"initiative"}'::jsonb);
  result:=private.resolve_effect_bundle_v1(
    '{"initiative":2}'::jsonb,effects);
  if result #>> '{stats,initiative}'<>'7' then
    raise exception 'Initiative equipment modifier was lost: %, %',effects,result;
  end if;
  -- No event means no permission to guess whether the consumer wants skill,
  -- save, AC, initiative or anything else.
  effects:=private.normalize_equipment_bonus_effects_v1(eq);
  if effects<>'[]'::jsonb then
    raise exception 'Missing trusted roll context added unintended modifiers';
  end if;
  -- Must never reinterpret final equipment AC as an additive armor bonus.
  if exists(
    select 1 from jsonb_array_elements(
      private.normalize_equipment_bonus_effects_v1(eq,
        '{"event":"initiative"}'::jsonb)
    ) e where e.value->>'target'='ac'
  ) then raise exception 'Equipment total AC was double-counted'; end if;

  -- Resolved effects from two already-authorized sources may compose,
  -- while the original equipment aggregate contributes only once.
  effects:=private.normalize_equipment_bonus_effects_v1(eq,
      '{"event":"saving_throw","ability":"dex"}'::jsonb)
    || '[{"id":"bless:active:1","source":"spell:bless","stackKey":"spell:bless:save","target":"saving_throw_bonus","op":"add","value":2}]'::jsonb;
  result:=private.resolve_effect_bundle_v1(
    '{"saving_throw_bonus":4}'::jsonb,effects);
  if result #>> '{stats,saving_throw_bonus}'<>'9' then
    raise exception 'Independent equipment plus spell stacking was lost: %',result;
  end if;

  failed:=false;
  begin
    perform private.normalize_equipment_bonus_effects_v1(
      '{"schemaVersion":1,"savesAll":"1"}'::jsonb,
      '{"event":"saving_throw","ability":"str"}'::jsonb);
  exception when sqlstate '22023' then failed:=true; end;
  if not failed then raise exception 'Untrusted text equipment bonus accepted'; end if;
  failed:=false;
  begin
    perform private.normalize_equipment_bonus_effects_v1(eq,
      '{"event":"saving_throw","ability":"unknown"}'::jsonb);
  exception when sqlstate '22023' then failed:=true; end;
  if not failed then raise exception 'Invalid saving throw ability accepted'; end if;
  failed:=false;
  begin
    perform private.normalize_equipment_bonus_effects_v1(eq,
      '{"event":"ability_check","skill":"perception"}'::jsonb);
  exception when sqlstate '22023' then failed:=true; end;
  if not failed then raise exception 'Unsupported skill silently treated as covered'; end if;
  failed:=false;
  begin
    perform private.normalize_equipment_bonus_effects_v1(eq,
      '{"event":"ability_check","skill":"athletics","override":42}'::jsonb);
  exception when sqlstate '22023' then failed:=true; end;
  if not failed then raise exception 'Unknown roll context key accepted'; end if;
  failed:=false;
  begin
    perform private.normalize_equipment_bonus_effects_v1(
      '{"schemaVersion":2}'::jsonb,'{"event":"initiative"}'::jsonb);
  exception when sqlstate '22023' then failed:=true; end;
  if not failed then raise exception 'Unknown equipment schema version accepted'; end if;
end;
$shadow$;
do $acl$
begin
  if has_function_privilege('anon',
    'private.normalize_equipment_bonus_effects_v1(jsonb,jsonb)','execute')
  or has_function_privilege('authenticated',
    'private.normalize_equipment_bonus_effects_v1(jsonb,jsonb)','execute')
  or not has_function_privilege('service_role',
    'private.normalize_equipment_bonus_effects_v1(jsonb,jsonb)','execute')
  then raise exception 'Equipment bonus adapter is not private'; end if;
end;
$acl$;
select 'Existing equipment numeric format preserves targeted bonuses through common effects' as result;
