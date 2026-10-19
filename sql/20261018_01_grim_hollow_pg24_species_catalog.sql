-- Grim Hollow: Player's Guide (2024) Species catalogue import.
-- Pinned partnered source: TheGiddyLimit/homebrew@ab4012f136dc1224c45d6c13c1d8f71b543c34bb
-- Adds ten new source Species and seven explicitly-labeled Grim Hollow source variants.
-- Existing PHB/XPHB/VRGR rows are not overwritten.

begin;

with book as (
  select (
    http_get(
      'https://raw.githubusercontent.com/TheGiddyLimit/homebrew/ab4012f136dc1224c45d6c13c1d8f71b543c34bb/collection/Ghostfire%20Gaming%3B%20Grim%20Hollow%20-%20Player%27s%20Guide%20-%202024.json'
    )
  ).content::jsonb as payload
),
heritage_catalog as (
  select jsonb_agg(
    jsonb_build_object(
      'key', option_key,
      'name', name,
      'category', category,
      'description', description,
      'improvedName', metadata->>'improvedName',
      'repeatLimit', greatest(1, coalesce((metadata->>'repeatLimit')::int, 1))
    )
    order by case category when 'C' then 0 when 'E' then 1 when 'R' then 2 else 9 end, name
  ) as items
  from public.character_option_catalog
  where option_type = 'heritage_trait'
    and source = 'GrimHollowPG24'
),
races as (
  select value as raw, ordinality as race_ord
  from book, jsonb_array_elements(payload->'race') with ordinality
  where value->>'source' = 'GrimHollowPG24'
),
fluffs as (
  select value as raw
  from book, jsonb_array_elements(payload->'raceFluff')
  where value->>'source' = 'GrimHollowPG24'
),
traditional as (
  select
    r.raw->>'name' as species_name,
    cat_ord,
    item_ord,
    item as raw_item,
    substring(item from '\{@optfeature[[:space:]]+([^|}]+)\|GrimHollowPG24') as trait_name
  from races r
  cross join lateral jsonb_array_elements(coalesce(r.raw->'entries'->1->'entries', '[]'::jsonb))
    with ordinality as c(cat, cat_ord)
  cross join lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(cat) = 'object' and cat->>'type' = 'entries'
        then coalesce(cat->'entries'->0->'items', '[]'::jsonb)
      else '[]'::jsonb
    end
  ) with ordinality as i(item, item_ord)
),
traditional_agg as (
  select
    t.species_name,
    jsonb_agg(
      jsonb_build_object(
        'key', h.option_key,
        'name', t.trait_name,
        'category', h.category,
        'raw', t.raw_item
      )
      order by t.cat_ord, t.item_ord
    ) as selections
  from traditional t
  join public.character_option_catalog h
    on h.option_type = 'heritage_trait'
   and h.source = 'GrimHollowPG24'
   and h.name = t.trait_name
  group by t.species_name
),
compiled as (
  select
    r.raw,
    r.race_ord,
    r.raw->>'name' as source_name,
    case
      when r.raw->>'name' in ('Dhampir','Dragonborn','Dwarf','Elf','Gnome','Halfling','Human')
        then (r.raw->>'name') || ' (Grim Hollow)'
      else r.raw->>'name'
    end as display_name,
    coalesce(t.selections, '[]'::jsonb) as traditional_selections,
    h.items as heritage_catalog,
    coalesce(
      nullif(private.flatten_5etools_entries_v1(f.raw->'entries'), ''),
      nullif(private.flatten_5etools_entries_v1(f.raw->'_copy'->'_mod'->'entries'->'items'), ''),
      ''
    ) as lore,
    f.raw->'images'->0->'href'->>'url' as source_art_url,
    private.flatten_5etools_entries_v1(r.raw->'entries') as description,
    private.flatten_5etools_entries_v1(r.raw->'entries'->1) as heritage_intro,
    private.flatten_5etools_entries_v1(r.raw->'entries'->2) as heritage_selection_rule,
    private.flatten_5etools_entries_v1(r.raw->'speedEntry') as speed_rule
  from races r
  left join fluffs f on f.raw->>'name' = r.raw->>'name'
  left join traditional_agg t on t.species_name = r.raw->>'name'
  cross join heritage_catalog h
),
upserted as (
  insert into public.character_option_catalog (
    option_key, option_type, name, source, category, description,
    prerequisite_text, tags, metadata, raw_payload, updated_at
  )
  select
    'species:'
      || trim(both '-' from regexp_replace(lower(replace(source_name, '''', '')), '[^a-z0-9]+', '-', 'g'))
      || case when display_name <> source_name then '-grim-hollow' else '' end
      || '|GRIMHOLLOWPG24',
    'species',
    display_name,
    'GrimHollowPG24',
    coalesce(raw->'creatureTypes'->>0, 'humanoid'),
    description,
    null,
    array['size:' || coalesce(raw->'size', '[]'::jsonb)::text, 'heritage-system:grim-hollow'],
    jsonb_build_object(
      'lore', lore,
      'page', nullif(raw->>'page','')::int,
      'size', coalesce(raw->'size', '[]'::jsonb),
      'speed', coalesce(raw->'speed', '30'::jsonb),
      'traits', jsonb_build_array(
        jsonb_build_object(
          'name', 'Heritage Traits',
          'type', 'entries',
          'entries', jsonb_build_array(heritage_intro, heritage_selection_rule)
        )
      ),
      'lineage', coalesce(raw->'lineage', 'null'::jsonb),
      'languages', '[]'::jsonb,
      'darkvision', 'null'::jsonb,
      'loreSource', 'GrimHollowPG24',
      'creatureTypes', coalesce(raw->'creatureTypes', '["humanoid"]'::jsonb),
      'heritageOnly', true,
      'heritagePickCount', 8,
      'heritageTraitCatalog', heritage_catalog,
      'traditionalHeritageSelections', traditional_selections,
      'sourceName', source_name,
      'sourceDisplayVariant', display_name <> source_name,
      'sourceArtUrl', source_art_url,
      'smallSpeedBonusHeritagePick', speed_rule ilike '%gain an extra traditional trait%',
      'smallSpeedReduction', case when speed_rule ilike '%gain an extra traditional trait%' then 5 else 0 end,
      'sourceSpeedEntry', coalesce(raw->'speedEntry', 'null'::jsonb),
      'importedFrom', 'GrimHollowPG24',
      'sourceEdition', '2024'
    ),
    raw || jsonb_build_object(
      'sourceCommit', 'ab4012f136dc1224c45d6c13c1d8f71b543c34bb',
      'sourceFile', 'collection/Ghostfire Gaming; Grim Hollow - Player''s Guide - 2024.json',
      'sourceName', source_name
    ),
    now()
  from compiled
  on conflict (option_key) do update set
    option_type = excluded.option_type,
    name = excluded.name,
    source = excluded.source,
    category = excluded.category,
    description = excluded.description,
    prerequisite_text = excluded.prerequisite_text,
    tags = excluded.tags,
    metadata = excluded.metadata,
    raw_payload = excluded.raw_payload,
    updated_at = now()
  returning id, option_key, name, source
)
select count(*) from upserted;

do $postconditions$
declare
  v_count integer;
  v_bad_catalog integer;
begin
  select count(*) into v_count
  from public.character_option_catalog
  where option_type = 'species'
    and source = 'GrimHollowPG24';

  if v_count <> 17 then
    raise exception 'Expected 17 Grim Hollow PG24 Species rows, found %', v_count;
  end if;

  select count(*) into v_bad_catalog
  from public.character_option_catalog
  where option_type = 'species'
    and source = 'GrimHollowPG24'
    and jsonb_array_length(coalesce(metadata->'heritageTraitCatalog','[]'::jsonb)) <> 107;

  if v_bad_catalog <> 0 then
    raise exception '% Grim Hollow Species rows do not contain the full 107-trait Heritage catalogue', v_bad_catalog;
  end if;

  if not exists (
    select 1 from public.character_option_catalog
    where option_type='species' and source='GrimHollowPG24' and name='Accursed'
  ) or not exists (
    select 1 from public.character_option_catalog
    where option_type='species' and source='GrimHollowPG24' and name='Wulven'
  ) then
    raise exception 'Grim Hollow unique Species coverage is incomplete';
  end if;

  if not exists (
    select 1 from public.character_option_catalog
    where option_type='species' and source='GrimHollowPG24' and name='Human (Grim Hollow)'
  ) or not exists (
    select 1 from public.character_option_catalog
    where option_type='species' and source='XPHB' and name='Human'
  ) then
    raise exception 'Grim Hollow source variants must coexist with existing core Species rows';
  end if;

  if exists (
    select 1 from public.character_option_catalog
    where option_type='species'
      and source='GrimHollowPG24'
      and name not in (
        'Accursed','Arisen','Dhampir (Grim Hollow)','Disembodied','Downcast',
        'Dragonborn (Grim Hollow)','Dreamer','Dwarf (Grim Hollow)','Elf (Grim Hollow)',
        'Gnome (Grim Hollow)','Grudgel','Halfling (Grim Hollow)','Human (Grim Hollow)',
        'Laneshi','Ogresh','Wechselkind','Wulven'
      )
  ) then
    raise exception 'Unexpected Grim Hollow Species identity detected';
  end if;
end
$postconditions$;

commit;
