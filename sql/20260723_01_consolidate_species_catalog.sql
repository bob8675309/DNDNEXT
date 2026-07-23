begin;

update public.character_option_catalog
set
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{lore}',
    to_jsonb(
      'Kithkin are short folk with stout legs, long arms, and sturdy torsos. Their broad faces, round ears, and large expressive eyes give them a vaguely ursine appearance. Most kithkin are linked by an empathic web that lets them sense the feelings of nearby kithkin, and many trust one another implicitly because of that connection. Some temporarily or permanently leave the web after trauma or for other personal reasons, but kithkin still typically consider betrayal of their own a heinous crime.'::text
    ),
    true
  ),
  updated_at = now()
where option_type = 'species'
  and lower(btrim(name)) = 'kithkin';

create or replace view public.character_option_catalog_preferred
with (security_invoker = true)
as
with eligible as (
  select
    o.*,
    case
      when o.option_type = 'species' and lower(btrim(o.name)) = 'faerie' then 'Fairy'
      else o.name
    end as preferred_name
  from public.character_option_catalog o
  where not (
    o.option_type = 'species'
    and lower(btrim(o.name)) in ('fairy', 'gnome (deep)')
  )
),
preferred as (
  select distinct on (
    o.option_type,
    lower(regexp_replace(btrim(o.preferred_name), '\s+', ' ', 'g'))
  )
    o.*
  from eligible o
  order by
    o.option_type,
    lower(regexp_replace(btrim(o.preferred_name), '\s+', ' ', 'g')),
    case
      when o.option_type = 'species' and upper(o.source) = 'XPHB' then 0
      when o.option_type = 'species' and upper(o.source) = 'MPMM' then 1
      else public.character_source_priority_v1(o.source) + 2
    end,
    o.source,
    o.updated_at desc,
    o.id
)
select
  id,
  option_key,
  option_type,
  preferred_name as name,
  source,
  category,
  description,
  prerequisite_text,
  tags,
  metadata,
  raw_payload,
  created_at,
  updated_at
from preferred;

grant select on public.character_option_catalog_preferred to anon, authenticated;

commit;
