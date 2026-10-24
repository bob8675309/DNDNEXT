-- Pure common effects math; no character writes or tactical state changes.
-- Call only from trusted server-side source adapters after eligibility/rest checks.
create or replace function private.resolve_effect_bundle_v1(
  p_base jsonb, p_effects jsonb, p_context jsonb default '{}'::jsonb
) returns jsonb language plpgsql immutable security invoker
set search_path=pg_catalog,private
as $resolver$
declare
 e jsonb; previous jsonb; selected jsonb:='{}'::jsonb;
 adds jsonb:='{}'::jsonb; floors jsonb:='{}'::jsonb;
 factors jsonb:='{}'::jsonb; advantage jsonb:='{}'::jsonb;
 disadvantage jsonb:='{}'::jsonb; modes jsonb:='{}'::jsonb;
 stats jsonb; applied jsonb:='[]'::jsonb;
 k text; target text; op text; t text; val numeric; base_value numeric;
 skipped integer:=0; duplicates integer:=0;
begin
 if jsonb_typeof(p_base) is distinct from 'object'
    or jsonb_typeof(p_effects) is distinct from 'array'
    or jsonb_typeof(p_context) is distinct from 'object'
    or jsonb_array_length(p_effects)>128 then
   raise exception 'Invalid common effects input' using errcode='22023';
 end if;
 for e in select value from jsonb_array_elements(p_effects) loop
   if jsonb_typeof(e) is distinct from 'object'
      or coalesce(e->>'id','') !~ '^[a-zA-Z0-9_:/.-]{1,128}$'
      or coalesce(e->>'source','') !~ '^[a-zA-Z0-9_:/.-]{1,128}$'
      or coalesce(e->>'stackKey','') !~ '^[a-zA-Z0-9_:/.-]{1,128}$' then
     raise exception 'Each effect needs id, source and stackKey' using errcode='22023';
   end if;
   if exists(select 1 from jsonb_object_keys(e) x
      where x not in ('id','source','stackKey','target','op','value','when')) then
     raise exception 'Unknown common effect field' using errcode='22023';
   end if;
   target:=e->>'target'; op:=e->>'op'; k:=e->>'stackKey';
   if op in ('advantage','disadvantage') then
     if target is null or target not in ('saving_throw','ability_check','attack_roll')
        or e ? 'value' then
       raise exception 'Invalid roll-mode effect' using errcode='22023';
     end if;
   elsif op in ('add','minimum','multiply') then
     if target is null or target not in ('max_hp','speed_ft','darkvision_ft','ac',
       'initiative','athletics_check','acrobatics_check',
       'jump_multiplier','climb_speed_ft','saving_throw_bonus',
       'attack_roll_bonus','damage_bonus')
       or jsonb_typeof(e->'value') is distinct from 'number' then
       raise exception 'Invalid numeric effect' using errcode='22023';
     end if;
     val:=(e->>'value')::numeric;
     if abs(val)>10000 or (op<>'add' and val<0)
       or (op='multiply' and val>20) then
       raise exception 'Unsupported effect magnitude' using errcode='22023';
     end if;
   else
     raise exception 'Unknown effect operation' using errcode='22023';
   end if;
   if e ? 'when' then
     if jsonb_typeof(e->'when') is distinct from 'object'
       or e->'when'='{}'::jsonb
       or exists(select 1 from jsonb_object_keys(e->'when') x
         where x not in ('event','condition','skill'))
       or exists(select 1 from jsonb_each(e->'when') x
         where jsonb_typeof(x.value)<>'string') then
       raise exception 'Malformed effect context condition' using errcode='22023';
     end if;
     if exists(select 1 from jsonb_each_text(e->'when') w
       where w.value is distinct from p_context->>w.key) then
       skipped:=skipped+1; continue;
     end if;
   end if;
   previous:=selected->k;
   if previous is not null then
     if previous->>'target' is distinct from target
       or previous->>'op' is distinct from op then
       raise exception 'Stack group mixes unrelated effects' using errcode='22023';
     end if;
     duplicates:=duplicates+1;
     if op in ('add','minimum','multiply') then
       if abs(val)>abs((previous->>'value')::numeric)
         or (abs(val)=abs((previous->>'value')::numeric)
           and (val>(previous->>'value')::numeric
             or (val=(previous->>'value')::numeric
               and e->>'id'<previous->>'id'))) then
         selected:=jsonb_set(selected,array[k],e,true);
       end if;
     elsif e->>'id'<previous->>'id' then
       selected:=jsonb_set(selected,array[k],e,true);
     end if;
   else
     selected:=jsonb_set(selected,array[k],e,true);
   end if;
 end loop;
 for k,e in select key,value from jsonb_each(selected) order by key loop
   applied:=applied||jsonb_build_array(e);
   target:=e->>'target'; op:=e->>'op';
   if op='advantage' then
     advantage:=jsonb_set(advantage,array[target],'true'::jsonb,true);
   elsif op='disadvantage' then
     disadvantage:=jsonb_set(disadvantage,array[target],'true'::jsonb,true);
   else
     val:=(e->>'value')::numeric;
     if op='add' then
       adds:=jsonb_set(adds,array[target],
         to_jsonb(coalesce((adds->>target)::numeric,0)+val),true);
     elsif op='minimum' then
       floors:=jsonb_set(floors,array[target],
         to_jsonb(greatest(coalesce((floors->>target)::numeric,val),val)),true);
     else
       factors:=jsonb_set(factors,array[target],
         to_jsonb(coalesce((factors->>target)::numeric,1)*val),true);
     end if;
   end if;
 end loop;
 stats:=p_base;
 foreach t in array array[
   'max_hp','speed_ft','darkvision_ft','ac','initiative',
   'athletics_check','acrobatics_check','jump_multiplier',
   'climb_speed_ft','saving_throw_bonus','attack_roll_bonus','damage_bonus'
 ] loop
   if adds ? t or floors ? t or factors ? t then
     if stats ? t and jsonb_typeof(stats->t) is distinct from 'number' then
       raise exception 'Base effect target is not numeric: %',t using errcode='22023';
     end if;
     base_value:=case when stats ? t then (stats->>t)::numeric
       when t='jump_multiplier' then 1 else 0 end;
     val:=greatest(base_value+coalesce((adds->>t)::numeric,0),
       coalesce((floors->>t)::numeric,base_value+coalesce((adds->>t)::numeric,0)))
       *coalesce((factors->>t)::numeric,1);
     if abs(val)>1000000 then
       raise exception 'Resolved numeric effect overflow' using errcode='22023';
     end if;
     stats:=jsonb_set(stats,array[t],to_jsonb(val),true);
   end if;
 end loop;
 foreach t in array array['saving_throw','ability_check','attack_roll'] loop
   if advantage ? t or disadvantage ? t then
     modes:=jsonb_set(modes,array[t],
       to_jsonb(case when advantage ? t and not disadvantage ? t
         then 'advantage'
         when disadvantage ? t and not advantage ? t
         then 'disadvantage' else 'normal' end),true);
   end if;
 end loop;
 return jsonb_build_object('schemaVersion',1,'stats',stats,'rollModes',modes,
   'appliedEffects',applied,'suppressedDuplicates',duplicates,
   'skippedConditional',skipped);
end;
$resolver$;
revoke all on function private.resolve_effect_bundle_v1(jsonb,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function private.resolve_effect_bundle_v1(jsonb,jsonb,jsonb)
  to service_role;
