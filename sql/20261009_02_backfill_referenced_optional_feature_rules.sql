-- Ensure every refOptionalfeature currently used by the imported class/subclass
-- catalogue has a real source-rule description available to the Forge.
--
-- The migration is reference-driven: it does not publish every option in either
-- upstream source. It materializes only exact optional features already
-- referenced by public.class_feature_catalog.
--
-- Reviewed source snapshots:
--   5etools-mirror-3/5etools-src@8c026b807fac21862a309379a0c3228a0683198b
--     data/optionalfeatures.json
--   TheGiddyLimit/homebrew@ab4012f136dc1224c45d6c13c1d8f71b543c34bb
--     collection/Ghostfire Gaming; Grim Hollow - Player's Guide - 2024.json
--
-- Existing curated prerequisites, choice schemas, repeatability, and progression
-- authority are preserved on conflict. This migration supplies source rules and
-- source metadata; it does not change which choices are legal.

with source_refs as (
  select
    split_part(trim(both '"' from ref::text),'|',1) as name,
    upper(coalesce(nullif(split_part(trim(both '"' from ref::text),'|',2),''),f.source)) as source,
    case when count(distinct f.class_key)=1 then min(f.class_key) else null end as class_key
  from public.class_feature_catalog f
  cross join lateral jsonb_path_query(f.entries,'$.**.optionalfeature') ref
  group by 1,2
), fetched as (
  select
    '5etools'::text as source_set,
    '8c026b807fac21862a309379a0c3228a0683198b'::text as source_commit,
    'data/optionalfeatures.json'::text as source_file,
    ((extensions.http_get('https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/8c026b807fac21862a309379a0c3228a0683198b/data/optionalfeatures.json')).content)::jsonb as payload
  union all
  select
    'GrimHollowPG24'::text,
    'ab4012f136dc1224c45d6c13c1d8f71b543c34bb'::text,
    'collection/Ghostfire Gaming; Grim Hollow - Player''s Guide - 2024.json'::text,
    ((extensions.http_get('https://raw.githubusercontent.com/TheGiddyLimit/homebrew/ab4012f136dc1224c45d6c13c1d8f71b543c34bb/collection/Ghostfire%20Gaming%3B%20Grim%20Hollow%20-%20Player%27s%20Guide%20-%202024.json')).content)::jsonb
), primary_options as (
  select
    f.source_set,
    f.source_commit,
    f.source_file,
    opt,
    opt->>'name' as name,
    upper(opt->>'source') as source,
    nullif(opt->>'page','')::integer as page,
    0 as source_priority
  from fetched f
  cross join lateral jsonb_array_elements(coalesce(f.payload->'optionalfeature','[]'::jsonb)) opt
), alias_options as (
  select
    p.source_set,
    p.source_commit,
    p.source_file,
    p.opt,
    p.name,
    upper(alias->>'source') as source,
    coalesce(nullif(alias->>'page','')::integer,p.page) as page,
    1 as source_priority
  from primary_options p
  cross join lateral jsonb_array_elements(coalesce(p.opt->'otherSources','[]'::jsonb)) alias
  where nullif(alias->>'source','') is not null
), all_options as (
  select * from primary_options
  union all
  select * from alias_options
), ranked_matches as (
  select
    r.name,
    r.source,
    r.class_key,
    o.source_set,
    o.source_commit,
    o.source_file,
    o.opt,
    o.page,
    row_number() over (
      partition by lower(r.name),upper(r.source)
      order by o.source_priority,o.source_set
    ) as rn
  from source_refs r
  join all_options o
    on lower(o.name)=lower(r.name)
   and upper(o.source)=upper(r.source)
), source_rules as (
  select
    name,
    source,
    class_key,
    source_set,
    source_commit,
    source_file,
    page,
    case
      when exists (
        select 1 from jsonb_array_elements_text(coalesce(opt->'featureType','[]'::jsonb)) t(value)
        where upper(value)='EI'
      ) then 'eldritch-invocation'
      when exists (
        select 1 from jsonb_array_elements_text(coalesce(opt->'featureType','[]'::jsonb)) t(value)
        where upper(value)='MM'
      ) then 'metamagic'
      when exists (
        select 1 from jsonb_array_elements_text(coalesce(opt->'featureType','[]'::jsonb)) t(value)
        where upper(value) in ('MV:B','MV')
      ) then 'battle-master-maneuver'
      when exists (
        select 1 from jsonb_array_elements_text(coalesce(opt->'featureType','[]'::jsonb)) t(value)
        where upper(value)='AS'
      ) then 'arcane-shot'
      when exists (
        select 1 from jsonb_array_elements_text(coalesce(opt->'featureType','[]'::jsonb)) t(value)
        where upper(value)='RN'
      ) then 'rune'
      when exists (
        select 1 from jsonb_array_elements_text(coalesce(opt->'featureType','[]'::jsonb)) t(value)
        where upper(value)='ED'
      ) then 'elemental-discipline'
      when exists (
        select 1 from jsonb_array_elements_text(coalesce(opt->'featureType','[]'::jsonb)) t(value)
        where upper(value) like 'FS%'
      ) then 'fighting-style'
      when exists (
        select 1 from jsonb_array_elements_text(coalesce(opt->'featureType','[]'::jsonb)) t(value)
        where upper(value)='PB'
      ) then 'pact-boon'
      else 'optional-feature'
    end as option_type,
    array(
      select value
      from jsonb_array_elements_text(coalesce(opt->'featureType','[]'::jsonb)) t(value)
    )::text[] as feature_types,
    nullif(
      btrim(private.flatten_5etools_entries_v1(coalesce(opt->'entries',opt->'entry','[]'::jsonb))),
      ''
    ) as description
  from ranked_matches
  where rn=1
), upserted as (
  insert into public.class_feature_option_catalog(
    option_key,option_type,name,source,class_key,feature_types,page,description,
    prerequisites,additional_spells,repeatable,choice_schema,metadata,raw_payload,updated_at
  )
  select
    'optional-feature:' ||
      trim(both '-' from regexp_replace(
        lower(replace(replace(name,'’',''),'''','')),
        '[^a-z0-9]+','-','g'
      )) ||
      '|' || upper(source),
    option_type,
    name,
    source,
    class_key,
    feature_types,
    page,
    description,
    '{}'::jsonb,
    '[]'::jsonb,
    false,
    '{}'::jsonb,
    jsonb_build_object(
      'descriptionAuthority',source_set || ':optionalfeature',
      'descriptionSourceCommit',source_commit,
      'descriptionSourceFile',source_file,
      'descriptionReviewedAt','2026-10-09'
    ),
    jsonb_build_object(
      'normalizedFrom','referenced_optionalfeature_source_rule',
      'sourceSet',source_set
    ),
    now()
  from source_rules
  where description is not null
  on conflict(option_key) do update set
    description = case
      when nullif(btrim(public.class_feature_option_catalog.description),'') is null
        then excluded.description
      else public.class_feature_option_catalog.description
    end,
    page = coalesce(public.class_feature_option_catalog.page,excluded.page),
    feature_types = case
      when coalesce(cardinality(public.class_feature_option_catalog.feature_types),0)=0
        then excluded.feature_types
      else public.class_feature_option_catalog.feature_types
    end,
    metadata = coalesce(public.class_feature_option_catalog.metadata,'{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning option_key
)
select count(*) as source_rule_rows_upserted from upserted;

do $$
declare
  v_missing integer;
begin
  with refs as (
    select distinct
      split_part(trim(both '"' from ref::text),'|',1) as name,
      upper(coalesce(nullif(split_part(trim(both '"' from ref::text),'|',2),''),f.source)) as source
    from public.class_feature_catalog f
    cross join lateral jsonb_path_query(f.entries,'$.**.optionalfeature') ref
  )
  select count(*) into v_missing
  from refs r
  left join public.class_feature_option_catalog o
    on lower(o.name)=lower(r.name)
   and upper(o.source)=upper(r.source)
  where nullif(btrim(o.description),'') is null;

  if v_missing <> 0 then
    raise exception
      'Referenced class optional-feature rule backfill incomplete: % exact refOptionalfeature descriptions remain unavailable.',
      v_missing;
  end if;
end;
$$;
