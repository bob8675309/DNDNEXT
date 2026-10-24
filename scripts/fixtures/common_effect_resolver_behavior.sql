\set ON_ERROR_STOP on
do $test$
declare
 v jsonb; v2 jsonb; rejected boolean;
 base jsonb:='{"max_hp":20,"speed_ft":30,"darkvision_ft":0,"jump_multiplier":1,"athletics_check":2}'::jsonb;
 effects jsonb;
begin
 v:=private.resolve_effect_bundle_v1(base,'[]'::jsonb);
 if v->'stats' is distinct from base or v->'rollModes'<>'{}'::jsonb
 then raise exception 'Empty effect bundle changed base values'; end if;

 -- One subclass feature supplies numeric, minimum, multiplier and conditional
 -- effects. Its activation/eligibility is deliberately checked upstream.
 effects:='[
  {"id":"parasite:hp","source":"feature:parasite","stackKey":"parasite:hp","target":"max_hp","op":"add","value":3},
  {"id":"parasite:speed","source":"feature:parasite","stackKey":"parasite:speed","target":"speed_ft","op":"add","value":5},
  {"id":"parasite:vision","source":"feature:parasite","stackKey":"parasite:vision","target":"darkvision_ft","op":"minimum","value":60},
  {"id":"parasite:jump","source":"feature:parasite","stackKey":"parasite:jump","target":"jump_multiplier","op":"multiply","value":3},
  {"id":"parasite:skill","source":"feature:parasite","stackKey":"parasite:skill","target":"athletics_check","op":"add","value":5},
  {"id":"parasite:poison","source":"feature:parasite","stackKey":"parasite:poison","target":"saving_throw","op":"advantage","when":{"event":"saving_throw","condition":"poisoned"}}
 ]'::jsonb;
 v:=private.resolve_effect_bundle_v1(base,effects);
 if v #>> '{stats,max_hp}'<>'23'
  or v #>> '{stats,speed_ft}'<>'35'
  or v #>> '{stats,darkvision_ft}'<>'60'
  or v #>> '{stats,jump_multiplier}'<>'3'
  or v #>> '{stats,athletics_check}'<>'7'
  or v->>'skippedConditional'<>'1'
  or v->'rollModes'<>'{}'::jsonb then
  raise exception 'Feature effect composition failed: %',v; end if;
 v:=private.resolve_effect_bundle_v1(base,effects,
  '{"event":"saving_throw","condition":"poisoned"}'::jsonb);
 if v #>> '{rollModes,saving_throw}'<>'advantage' then
  raise exception 'Saving throw condition did not gate Advantage'; end if;
 v:=private.resolve_effect_bundle_v1(base,effects,
  '{"event":"saving_throw","condition":"frightened"}'::jsonb);
 if v->'rollModes'<>'{}'::jsonb then
  raise exception 'Advantage leaked to a different condition'; end if;

 -- Two instances of the same named spell use one stack group; boots and a
 -- distinct class feature can stack independently where source rules permit.
 effects:='[
  {"id":"longstrider:1","source":"spell:longstrider","stackKey":"spell:longstrider:speed","target":"speed_ft","op":"add","value":10},
  {"id":"longstrider:2","source":"spell:longstrider","stackKey":"spell:longstrider:speed","target":"speed_ft","op":"add","value":5},
  {"id":"boots:1","source":"equipment:boots","stackKey":"equipment:boots:speed","target":"speed_ft","op":"add","value":5},
  {"id":"parasite:1","source":"feature:parasite","stackKey":"feature:parasite:speed","target":"speed_ft","op":"add","value":5}
 ]'::jsonb;
 v:=private.resolve_effect_bundle_v1(base,effects);
 v2:=private.resolve_effect_bundle_v1(base,
  jsonb_build_array(effects->3,effects->2,effects->1,effects->0));
 if v #>> '{stats,speed_ft}'<>'50'
  or v2 #>> '{stats,speed_ft}'<>'50'
  or v->>'suppressedDuplicates'<>'1'
  or jsonb_array_length(v->'appliedEffects')<>3 then
  raise exception 'Stacking, source independence, or order failed: %, %',v,v2; end if;

 v:=private.resolve_effect_bundle_v1('{}'::jsonb,
 '[{"id":"luck","source":"feat:luck","stackKey":"feat:luck:save","target":"saving_throw","op":"advantage"},
 {"id":"poison","source":"condition:poisoned","stackKey":"condition:poisoned:save","target":"saving_throw","op":"disadvantage"}]'::jsonb);
 if v #>> '{rollModes,saving_throw}'<>'normal' then
   raise exception 'Advantage versus Disadvantage did not cancel'; end if;

 v:=private.resolve_effect_bundle_v1('{"speed_ft":30}'::jsonb,
 '[{"id":"slow","source":"spell:slow","stackKey":"spell:slow:speed","target":"speed_ft","op":"add","value":-10},
 {"id":"boots","source":"equipment:boots","stackKey":"equipment:boots:speed","target":"speed_ft","op":"add","value":5}]'::jsonb);
 if v #>> '{stats,speed_ft}'<>'25' then raise exception 'Negative modifiers failed'; end if;

 rejected:=false;
 begin
  perform private.resolve_effect_bundle_v1('{}'::jsonb,
   '[{"id":"bad","source":"x","stackKey":"x","target":"unknown","op":"add","value":5}]'::jsonb);
 exception when sqlstate '22023' then rejected:=true; end;
 if not rejected then raise exception 'Unknown target accepted'; end if;
 rejected:=false;
 begin
  perform private.resolve_effect_bundle_v1('{}'::jsonb,
   '[{"id":"bad","source":"x","stackKey":"x","target":"speed_ft","op":"add","value":"5"}]'::jsonb);
 exception when sqlstate '22023' then rejected:=true; end;
 if not rejected then raise exception 'Untrusted string treated as a bonus'; end if;
 rejected:=false;
 begin
  perform private.resolve_effect_bundle_v1('{}'::jsonb,
   '[{"id":"bad","source":"x","stackKey":"x","target":"saving_throw","op":"advantage","when":{"unknown":"true"}}]'::jsonb);
 exception when sqlstate '22023' then rejected:=true; end;
 if not rejected then raise exception 'Unknown conditional field accepted'; end if;
 rejected:=false;
 begin
  perform private.resolve_effect_bundle_v1('{}'::jsonb,
   '[{"id":"a","source":"a","stackKey":"shared","target":"speed_ft","op":"add","value":5},
   {"id":"b","source":"b","stackKey":"shared","target":"max_hp","op":"add","value":5}]'::jsonb);
 exception when sqlstate '22023' then rejected:=true; end;
 if not rejected then raise exception 'Mixed stacking group accepted'; end if;
  -- The same magnitude and effect ID from two different sources must
  -- choose deterministic provenance no matter their encounter load order.
  effects:='[
    {"id":"swing","source":"source:z","stackKey":"shared:damage","target":"damage_bonus","op":"add","value":3},
    {"id":"swing","source":"source:a","stackKey":"shared:damage","target":"damage_bonus","op":"add","value":3}
  ]'::jsonb;
  v:=private.resolve_effect_bundle_v1('{}'::jsonb,effects);
  v2:=private.resolve_effect_bundle_v1('{}'::jsonb,
    jsonb_build_array(effects->1,effects->0));
  if v->'appliedEffects' is distinct from v2->'appliedEffects'
    or v #>> '{stats,damage_bonus}' <> '3'
    or v #>> '{appliedEffects,0,source}' <> 'source:a' then
    raise exception 'Equal-magnitude source provenance depends on input order';
  end if;

  -- Fixed arithmetic order: additions, minimum floor, then multiplier.
  v:=private.resolve_effect_bundle_v1('{"speed_ft":10}'::jsonb,
  '[{"id":"bonus","source":"source:feat","stackKey":"feat:speed","target":"speed_ft","op":"add","value":2},
    {"id":"floor","source":"source:spell","stackKey":"spell:floor","target":"speed_ft","op":"minimum","value":15},
    {"id":"factor","source":"source:spell","stackKey":"spell:factor","target":"speed_ft","op":"multiply","value":2}]'::jsonb);
  if v #>> '{stats,speed_ft}'<>'30' then
    raise exception 'Add/minimum/multiply order is not deterministic';
  end if;

  -- Conditional skill effects must apply to the selected skill only.
  effects:='[
    {"id":"skill:bonus","source":"feature:skill","stackKey":"feature:skill:athletics","target":"athletics_check","op":"add","value":4,"when":{"event":"ability_check","skill":"athletics"}}
  ]'::jsonb;
  v:=private.resolve_effect_bundle_v1('{"athletics_check":2}'::jsonb,effects,
    '{"event":"ability_check","skill":"acrobatics"}'::jsonb);
  if v #>> '{stats,athletics_check}'<>'2'
    or v->>'skippedConditional'<>'1' then
    raise exception 'Skill-specific effect leaked into a different check';
  end if;
  v:=private.resolve_effect_bundle_v1('{"athletics_check":2}'::jsonb,effects,
    '{"event":"ability_check","skill":"athletics"}'::jsonb);
  if v #>> '{stats,athletics_check}'<>'6' then
    raise exception 'Matching skill-specific effect did not apply';
  end if;

  rejected:=false;
  begin
    perform private.resolve_effect_bundle_v1('{}'::jsonb,
      '[{"id":"null-target","source":"x","stackKey":"x","op":"add","value":4}]'::jsonb);
  exception when sqlstate '22023' then rejected:=true; end;
  if not rejected then raise exception 'Missing numeric target accepted'; end if;

  rejected:=false;
  begin
    perform private.resolve_effect_bundle_v1('{}'::jsonb,
      '[{"id":"bad identifier!","source":"x","stackKey":"x","target":"speed_ft","op":"add","value":4}]'::jsonb);
  exception when sqlstate '22023' then rejected:=true; end;
  if not rejected then raise exception 'Malformed identifier accepted'; end if;

  rejected:=false;
  begin
    perform private.resolve_effect_bundle_v1('{}'::jsonb,
      '[{"id":"bogus","source":"x","stackKey":"x","target":"speed_ft","op":"add","value":4,"injected":true}]'::jsonb);
  exception when sqlstate '22023' then rejected:=true; end;
  if not rejected then raise exception 'Undeclared normalized field accepted'; end if;

  rejected:=false;
  begin
    perform private.resolve_effect_bundle_v1('{}'::jsonb,
      '[{"id":"bogus","source":"x","stackKey":"x","target":"saving_throw","op":"advantage","when":"poisoned"}]'::jsonb);
  exception when sqlstate '22023' then rejected:=true; end;
  if not rejected then raise exception 'Non-object condition accepted'; end if;

  rejected:=false;
  begin
    perform private.resolve_effect_bundle_v1('{"speed_ft":"30"}'::jsonb,
      '[{"id":"bonus","source":"x","stackKey":"x","target":"speed_ft","op":"add","value":5}]'::jsonb);
  exception when sqlstate '22023' then rejected:=true; end;
  if not rejected then raise exception 'Non-numeric base stat accepted'; end if;

  rejected:=false;
  begin
    perform private.resolve_effect_bundle_v1('{}'::jsonb,
      (select jsonb_agg(jsonb_build_object(
        'id','id:'||g,'source','source:x','stackKey','key:'||g,
        'target','speed_ft','op','add','value',1
      )) from generate_series(1,129) g));
  exception when sqlstate '22023' then rejected:=true; end;
  if not rejected then raise exception 'Over-large effect bundle accepted'; end if;
end;
$test$;
do $privileges$
begin
 if has_function_privilege('anon',
    'private.resolve_effect_bundle_v1(jsonb,jsonb,jsonb)','execute')
 or has_function_privilege('authenticated',
    'private.resolve_effect_bundle_v1(jsonb,jsonb,jsonb)','execute')
 or not has_function_privilege('service_role',
    'private.resolve_effect_bundle_v1(jsonb,jsonb,jsonb)','execute')
 then raise exception 'Common effect resolver has unsafe grants'; end if;
end;
$privileges$;
select 'Common effects isolated PostgreSQL tests passed' as result;
