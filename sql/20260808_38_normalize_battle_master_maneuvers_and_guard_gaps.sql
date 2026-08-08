-- Normalize XPHB Battle Master maneuver identities from the imported Maneuver Options
-- source feature, then fail closed on earned levels that add maneuvers until the
-- progression materializer resolves those deltas explicitly.

with source_feature as (
  select id,feature_key,entries,raw_payload
  from public.class_feature_catalog
  where class_key='fighter'
    and class_source='XPHB'
    and coalesce(subclass_name,subclass_short_name,'')='Battle Master'
    and name='Maneuver Options'
    and source='XPHB'
  order by level asc
  limit 1
), refs as (
  select distinct
    split_part(trim(both '"' from ref::text),'|',1) as name,
    upper(split_part(trim(both '"' from ref::text),'|',2)) as source,
    f.id as source_feature_id,
    f.feature_key as source_feature_key,
    nullif(f.raw_payload->>'page','')::integer as page
  from source_feature f
  cross join lateral jsonb_path_query(f.entries,'$.**.optionalfeature') ref
), normalized as (
  select
    'optional-feature:' || trim(both '-' from regexp_replace(lower(replace(replace(name,'’',''),'''','')), '[^a-z0-9]+', '-', 'g')) || '|XPHB' as option_key,
    name,source_feature_id,source_feature_key,page
  from refs
  where source='XPHB' and btrim(name)<>''
)
insert into public.class_feature_option_catalog(
  option_key,option_type,name,source,class_key,feature_types,page,description,
  prerequisites,additional_spells,repeatable,choice_schema,metadata,raw_payload,updated_at
)
select
  n.option_key,
  'battle-master-maneuver',
  n.name,
  'XPHB',
  'fighter',
  array['MV:B']::text[],
  n.page,
  null,
  '{}'::jsonb,
  '[]'::jsonb,
  false,
  '{}'::jsonb,
  jsonb_build_object(
    'identityOnly',true,
    'source','class_feature_catalog:Maneuver Options',
    'sourceFeatureId',n.source_feature_id,
    'sourceFeatureKey',n.source_feature_key,
    'subclassName','Battle Master'
  ),
  jsonb_build_object('derivedFromFeatureId',n.source_feature_id,'derivedFromFeatureKey',n.source_feature_key),
  now()
from normalized n
on conflict(option_key) do update set
  option_type=excluded.option_type,
  name=excluded.name,
  source=excluded.source,
  class_key=excluded.class_key,
  feature_types=excluded.feature_types,
  page=coalesce(public.class_feature_option_catalog.page,excluded.page),
  metadata=coalesce(public.class_feature_option_catalog.metadata,'{}'::jsonb)||excluded.metadata,
  updated_at=now();

do $$
declare
  v_source_count integer;
  v_catalog_count integer;
begin
  with source_feature as (
    select entries
    from public.class_feature_catalog
    where class_key='fighter' and class_source='XPHB'
      and coalesce(subclass_name,subclass_short_name,'')='Battle Master'
      and name='Maneuver Options' and source='XPHB'
    order by level asc limit 1
  ), refs as (
    select distinct split_part(trim(both '"' from ref::text),'|',1) as name,
                    upper(split_part(trim(both '"' from ref::text),'|',2)) as source
    from source_feature,lateral jsonb_path_query(entries,'$.**.optionalfeature') ref
  )
  select count(*) into v_source_count from refs where source='XPHB' and btrim(name)<>'';

  select count(*) into v_catalog_count
  from public.class_feature_option_catalog
  where option_type='battle-master-maneuver' and source='XPHB' and class_key='fighter';

  if v_source_count<>20 then
    raise exception 'Expected 20 distinct XPHB Battle Master maneuver references in Maneuver Options, found %.',v_source_count;
  end if;
  if v_catalog_count<>20 then
    raise exception 'Expected 20 canonical XPHB Battle Master maneuver options, found %.',v_catalog_count;
  end if;
end;
$$;

create or replace function private.battle_master_maneuver_count_v1(p_level integer)
returns integer
language sql
immutable
set search_path=pg_catalog
as $$
  select case
    when greatest(1,least(20,coalesce(p_level,1)))>=15 then 9
    when greatest(1,least(20,coalesce(p_level,1)))>=10 then 7
    when greatest(1,least(20,coalesce(p_level,1)))>=7 then 5
    when greatest(1,least(20,coalesce(p_level,1)))>=3 then 3
    else 0 end;
$$;

create or replace function private.level_up_persistent_choice_gaps_base_v1(
  p_class_key text,
  p_class_source text,
  p_from_level integer,
  p_to_level integer
)
returns jsonb
language plpgsql
immutable
set search_path=pg_catalog,private
as $$
declare
  v_class text:=lower(btrim(coalesce(p_class_key,'')));
  v_source text:=upper(btrim(coalesce(p_class_source,'')));
  v_from integer:=greatest(1,coalesce(p_from_level,1));
  v_to integer:=greatest(1,coalesce(p_to_level,1));
  v_out jsonb:='[]'::jsonb;
  v_before integer:=0;
  v_after integer:=0;
begin
  if v_source<>'XPHB' or v_to<>v_from+1 then return v_out; end if;

  if v_class='warlock' then
    v_before:=private.xphb_warlock_invocation_count_v1(v_from);
    v_after:=private.xphb_warlock_invocation_count_v1(v_to);
    if v_after>v_before then
      v_out:=v_out||jsonb_build_array('Eldritch Invocations +'||(v_after-v_before)::text);
    end if;
  elsif v_class='fighter' then
    v_before:=private.battle_master_maneuver_count_v1(v_from);
    v_after:=private.battle_master_maneuver_count_v1(v_to);
    if v_after>v_before then
      v_out:=v_out||jsonb_build_array('Battle Master Maneuvers +'||(v_after-v_before)::text);
    end if;
  end if;
  return v_out;
end;
$$;

revoke all on function private.battle_master_maneuver_count_v1(integer) from public,anon,authenticated;
grant execute on function private.battle_master_maneuver_count_v1(integer) to service_role;
