-- Repair Bestial Soul option extraction for the imported TCE source shape.
-- The source stores the three adaptations as plain-text items inside a list,
-- not as named child entries. Public runtime semantics from migration 79 remain unchanged.

create or replace function private.bestial_soul_options_v1()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  with feature as (
    select f.entries
    from public.class_feature_catalog f
    where lower(f.class_key)='barbarian'
      and upper(coalesce(f.class_source,''))='PHB'
      and lower(coalesce(f.subclass_name,''))='beast'
      and upper(coalesce(f.source,''))='TCE'
      and lower(f.name)='bestial soul'
    order by f.level,f.id
    limit 1
  ), items as (
    select regexp_replace(
      item #>> '{}',
      '\{@[^ ]+\s+([^}|]+)(?:\|[^}]*)?\}',
      '\1',
      'g'
    ) as description
    from feature f,
    lateral jsonb_path_query(
      f.entries,
      '$[*] ? (@.type == "list").items[*]'
    ) item
  ), classified as (
    select
      case
        when lower(description) like '%swimming speed%' then 'swimming'
        when lower(description) like '%climbing speed%' then 'climbing'
        when lower(description) like '%when you jump%' then 'jumping'
      end as key,
      case
        when lower(description) like '%swimming speed%' then 'Swimming'
        when lower(description) like '%climbing speed%' then 'Climbing'
        when lower(description) like '%when you jump%' then 'Jumping'
      end as name,
      description
    from items
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'key',key,
    'name',name,
    'source','TCE',
    'description',description
  ) order by name),'[]'::jsonb)
  from classified
  where key is not null;
$$;

revoke all on function private.bestial_soul_options_v1() from public,anon,authenticated;
grant execute on function private.bestial_soul_options_v1() to service_role;
