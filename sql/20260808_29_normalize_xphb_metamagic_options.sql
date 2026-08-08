-- Promote the canonical XPHB Metamagic option identities already referenced by
-- class_feature_catalog into class_feature_option_catalog.
-- This intentionally stores identity/ownership metadata only; the imported class feature
-- remains the rule-text source and replacement logic no longer depends on a hard-coded name list.

with source_feature as (
  select id,feature_key,source,description,raw_payload
  from public.class_feature_catalog
  where class_key='sorcerer'
    and class_source='XPHB'
    and name='Metamagic Options'
  order by level asc
  limit 1
), parsed as (
  select distinct
    btrim(match[1]) as name,
    f.id as source_feature_id,
    f.feature_key as source_feature_key,
    nullif(f.raw_payload->>'page','')::integer as page
  from source_feature f
  cross join lateral regexp_matches(
    coalesce(f.description,''),
    '([A-Za-z][A-Za-z ''’.-]+)\|XPHB',
    'g'
  ) match
), normalized as (
  select
    'optional-feature:' || trim(both '-' from regexp_replace(lower(replace(replace(name,'’',''),'''','')), '[^a-z0-9]+', '-', 'g')) || '|XPHB' as option_key,
    name,source_feature_id,source_feature_key,page
  from parsed
)
insert into public.class_feature_option_catalog(
  option_key,option_type,name,source,class_key,feature_types,page,description,
  prerequisites,additional_spells,repeatable,choice_schema,metadata,raw_payload,updated_at
)
select
  n.option_key,
  'metamagic',
  n.name,
  'XPHB',
  'sorcerer',
  array['MM']::text[],
  n.page,
  null,
  '{}'::jsonb,
  '[]'::jsonb,
  false,
  '{}'::jsonb,
  jsonb_build_object(
    'identityOnly',true,
    'source','class_feature_catalog:Metamagic Options',
    'sourceFeatureId',n.source_feature_id,
    'sourceFeatureKey',n.source_feature_key
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
declare v_count integer;
begin
  select count(*) into v_count
  from public.class_feature_option_catalog
  where option_type='metamagic' and source='XPHB' and class_key='sorcerer';
  if v_count<>10 then
    raise exception 'Expected 10 canonical XPHB Metamagic options, found %.',v_count;
  end if;
end;
$$;
