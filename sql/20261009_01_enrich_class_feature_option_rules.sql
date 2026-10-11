-- Fill source-rule descriptions for class option identities that were previously
-- imported as identity-only rows.
--
-- Canonical reviewed source:
-- 5etools-mirror-3/5etools-src@8c026b807fac21862a309379a0c3228a0683198b
-- data/optionalfeatures.json
--
-- This migration is deliberately narrow:
-- - updates only existing exact option_type/name/source rows;
-- - updates only rows whose description is currently blank;
-- - preserves prerequisites, choice_schema, repeatable flags, progression, and
--   all other DNDNext persistence/validation authority;
-- - does not add or remove class choices.

with fetched as (
  select ((extensions.http_get('https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/8c026b807fac21862a309379a0c3228a0683198b/data/optionalfeatures.json')).content)::jsonb as payload
), source_rows as (
  select
    option_row,
    case
      when exists (
        select 1 from jsonb_array_elements_text(coalesce(option_row->'featureType','[]'::jsonb)) t(value)
        where upper(value)='EI'
      ) then 'eldritch-invocation'
      when exists (
        select 1 from jsonb_array_elements_text(coalesce(option_row->'featureType','[]'::jsonb)) t(value)
        where upper(value)='MM'
      ) then 'metamagic'
      when exists (
        select 1 from jsonb_array_elements_text(coalesce(option_row->'featureType','[]'::jsonb)) t(value)
        where upper(value) in ('MV:B','MV')
      ) then 'battle-master-maneuver'
      else null
    end as option_type
  from fetched
  cross join lateral jsonb_array_elements(payload->'optionalfeature') option_row
), source_rules as (
  select
    option_type,
    option_row->>'name' as name,
    option_row->>'source' as source,
    nullif(option_row->>'page','')::integer as page,
    nullif(
      btrim(private.flatten_5etools_entries_v1(
        coalesce(option_row->'entries', option_row->'entry', '[]'::jsonb)
      )),
      ''
    ) as description
  from source_rows
  where option_type is not null
), updated as (
  update public.class_feature_option_catalog o
  set
    description = s.description,
    page = coalesce(o.page, s.page),
    metadata = coalesce(o.metadata,'{}'::jsonb) || jsonb_build_object(
      'descriptionAuthority','5etools:data/optionalfeatures.json',
      'descriptionSourceCommit','8c026b807fac21862a309379a0c3228a0683198b',
      'descriptionReviewedAt','2026-10-09'
    ),
    updated_at = now()
  from source_rules s
  where o.option_type = s.option_type
    and o.name = s.name
    and o.source = s.source
    and nullif(btrim(o.description),'') is null
    and s.description is not null
  returning o.option_type,o.name,o.source
)
select count(*) as enriched_count from updated;

do $$
declare
  v_missing integer;
begin
  select count(*) into v_missing
  from public.class_feature_option_catalog
  where option_type in ('battle-master-maneuver','eldritch-invocation','metamagic')
    and source='XPHB'
    and nullif(btrim(description),'') is null;

  if v_missing <> 0 then
    raise exception
      'Class option source-rule enrichment incomplete: % XPHB maneuver/invocation/metamagic descriptions remain blank.',
      v_missing;
  end if;
end;
$$;
