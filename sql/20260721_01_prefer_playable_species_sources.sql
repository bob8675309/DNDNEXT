begin;

create or replace view public.character_option_catalog_preferred
with (security_invoker = true)
as
select distinct on (
  o.option_type,
  lower(regexp_replace(btrim(o.name), '\\s+', ' ', 'g'))
)
  o.*
from public.character_option_catalog o
order by
  o.option_type,
  lower(regexp_replace(btrim(o.name), '\\s+', ' ', 'g')),
  case
    when o.option_type = 'species' and upper(o.source) = 'XPHB' then 0
    when o.option_type = 'species' and upper(o.source) = 'MPMM' then 1
    else public.character_source_priority_v1(o.source) + 2
  end,
  o.source,
  o.updated_at desc,
  o.id;

grant select on public.character_option_catalog_preferred to anon, authenticated;

commit;
