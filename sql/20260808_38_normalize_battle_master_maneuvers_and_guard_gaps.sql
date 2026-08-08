-- Normalize XPHB Battle Master maneuver identities from the imported Maneuver Options
-- source feature. The historical filename mentions gap guarding, but subclass-specific
-- progression gating is intentionally NOT added to the class-only gap function here;
-- earned Battle Master authority is connected at a character/subclass-aware layer.

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

revoke all on function private.battle_master_maneuver_count_v1(integer) from public,anon,authenticated;
grant execute on function private.battle_master_maneuver_count_v1(integer) to service_role;
