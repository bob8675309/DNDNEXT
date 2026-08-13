begin;

with parent as (
  select *
  from public.character_option_catalog
  where option_type = 'species'
    and name = 'Aven'
    and source = 'PSA'
  limit 1
), variants(name, option_key, variant_name, page, ability, entries) as (
  values
  (
    'Aven (Hawk-Headed)',
    'species:aven-hawk-headed|PSA',
    'Hawk-Headed',
    16,
    '[{"wis":2}]'::jsonb,
    '[{"type":"entries","name":"Hawkeyed","entries":["You have proficiency in the {@skill Perception} skill. Attacking at long range does not impose disadvantage on your ranged weapon attack rolls."]}]'::jsonb
  ),
  (
    'Aven (Ibis-Headed)',
    'species:aven-ibis-headed|PSA',
    'Ibis-Headed',
    16,
    '[{"int":1}]'::jsonb,
    '[{"type":"entries","name":"Kefnet''s Blessing","entries":["You can add half your proficiency bonus, rounded down, to an Intelligence check that does not already include your proficiency bonus."]}]'::jsonb
  )
)
insert into public.character_option_catalog (
  id, option_key, option_type, name, source, category, description, prerequisite_text, tags, metadata, raw_payload, created_at, updated_at
)
select
  gen_random_uuid(),
  v.option_key,
  'species',
  v.name,
  'PSA',
  coalesce(p.category, 'humanoid'),
  coalesce(p.description, '') || E'\n\n' || (
    select string_agg(coalesce(e->>'name', 'Species Feature') || '. ' || coalesce((e->'entries'->>0), ''), E'\n\n')
    from jsonb_array_elements(v.entries) e
  ),
  '',
  coalesce(p.tags, '{}'::text[]),
  coalesce(p.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'page', v.page,
      'traits', coalesce(p.metadata->'traits', '[]'::jsonb) || v.entries,
      'parentSpecies', 'Aven',
      'parentSource', 'PSA',
      'variantName', v.variant_name,
      'sourceDerivedSubrace', true,
      'sourceAudit', jsonb_build_object(
        'status', 'restored-after-5etools-review',
        'source', 'PSA',
        'note', 'Plane Shift: Amonkhet Aven subrace records restored from the reviewed 5etools source data so the Forge can present Hawk-Headed and Ibis-Headed under the Aven parent.'
      )
    ),
  coalesce(p.raw_payload, '{}'::jsonb)
    || jsonb_build_object(
      'name', v.variant_name,
      'source', 'PSA',
      'raceName', 'Aven',
      'raceSource', 'PSA',
      'page', v.page,
      'ability', v.ability,
      'entries', coalesce(p.raw_payload->'entries', '[]'::jsonb) || v.entries
    ),
  now(), now()
from parent p
cross join variants v
where not exists (
  select 1
  from public.character_option_catalog existing
  where existing.option_key = v.option_key
);

commit;
