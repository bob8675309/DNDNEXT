begin;

with parent as (
  select * from public.character_option_catalog
  where option_type = 'species' and name = 'Genasi' and source = 'MPMM'
  limit 1
), variants(name, option_key, page, speed, resist, trait_tags, additional_spells, entries) as (
  values
  (
    'Genasi (Air)', 'species:genasi-air|MPMM', 16, '35'::jsonb, '["lightning"]'::jsonb, '[]'::jsonb,
    '[{"innate":{"3":{"daily":{"1":["feather fall"]}},"5":{"daily":{"1":["levitate"]}}},"ability":{"choose":["int","wis","cha"]},"known":{"1":["shocking grasp#c"]}}]'::jsonb,
    '[{"type":"entries","name":"Unending Breath","entries":["You can hold your breath indefinitely while you are not incapacitated."]},{"type":"entries","name":"Lightning Resistance","entries":["You have resistance to lightning damage."]},{"type":"entries","name":"Mingle with the Wind","entries":["You know the {@spell shocking grasp} cantrip. Starting at 3rd level, you can cast {@spell feather fall} with this trait. Starting at 5th level, you can also cast {@spell levitate} with this trait. Once you cast either leveled spell with this trait, you regain that use after a long rest.","Intelligence, Wisdom, or Charisma is the spellcasting ability allowed by the source; the Forge resolves the highest eligible final ability automatically."]}]'::jsonb
  ),
  (
    'Genasi (Earth)', 'species:genasi-earth|MPMM', 17, '30'::jsonb, '[]'::jsonb, '[]'::jsonb,
    '[{"innate":{"5":["pass without trace"]},"ability":{"choose":["int","wis","cha"]},"known":{"1":["blade ward#c"]}}]'::jsonb,
    '[{"type":"entries","name":"Earth Walk","entries":["Ground-based difficult terrain does not cost you extra movement while you use your walking speed."]},{"type":"entries","name":"Merge with Stone","entries":["You know the {@spell blade ward} cantrip and can also use its source-granted bonus-action casting a number of times equal to your proficiency bonus, refreshed by a long rest.","Starting at 5th level, you can cast {@spell pass without trace} with this trait once per long rest and may also use an appropriate spell slot.","Intelligence, Wisdom, or Charisma is the spellcasting ability allowed by the source; the Forge resolves the highest eligible final ability automatically."]}]'::jsonb
  ),
  (
    'Genasi (Fire)', 'species:genasi-fire|MPMM', 17, '30'::jsonb, '["fire"]'::jsonb, '[]'::jsonb,
    '[{"innate":{"3":{"daily":{"1":["burning hands"]}},"5":{"daily":{"1":["flame blade"]}}},"ability":{"choose":["int","wis","cha"]},"known":{"1":["produce flame#c"]}}]'::jsonb,
    '[{"type":"entries","name":"Fire Resistance","entries":["You have resistance to fire damage."]},{"type":"entries","name":"Reach to the Blaze","entries":["You know the {@spell produce flame} cantrip. Starting at 3rd level, you can cast {@spell burning hands} with this trait. Starting at 5th level, you can also cast {@spell flame blade} with this trait. Each leveled spell regains its source-granted use after a long rest.","Intelligence, Wisdom, or Charisma is the spellcasting ability allowed by the source; the Forge resolves the highest eligible final ability automatically."]}]'::jsonb
  ),
  (
    'Genasi (Water)', 'species:genasi-water|MPMM', 17, '{"walk":30,"swim":true}'::jsonb, '["acid"]'::jsonb, '["Amphibious"]'::jsonb,
    '[{"innate":{"3":{"daily":{"1":["create or destroy water"]}},"5":{"daily":{"1":["water walk"]}}},"ability":{"choose":["int","wis","cha"]},"known":{"1":["acid splash#c"]}}]'::jsonb,
    '[{"type":"entries","name":"Speed","entries":["Your walking speed is 30 feet, and your swimming speed equals your walking speed."]},{"type":"entries","name":"Acid Resistance","entries":["You have resistance to acid damage."]},{"type":"entries","name":"Amphibious","entries":["You breathe air and water."]},{"type":"entries","name":"Call to the Wave","entries":["You know the {@spell acid splash} cantrip. Starting at 3rd level, you can cast {@spell create or destroy water} with this trait. Starting at 5th level, you can also cast {@spell water walk} with this trait. Each leveled spell regains its source-granted use after a long rest.","Intelligence, Wisdom, or Charisma is the spellcasting ability allowed by the source; the Forge resolves the highest eligible final ability automatically."]}]'::jsonb
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
  'MPMM',
  coalesce(p.category, 'VRGR'),
  (
    select string_agg(coalesce(e->>'name','Species Feature') || '. ' || coalesce((e->'entries'->>0),''), E'\n\n')
    from jsonb_array_elements(v.entries) e
  ),
  '',
  coalesce(p.tags, '{}'::text[]),
  coalesce(p.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'page', v.page,
      'speed', v.speed,
      'traits', coalesce(p.metadata->'traits','[]'::jsonb) || v.entries,
      'parentSpecies', 'Genasi',
      'parentSource', 'MPMM',
      'variantName', regexp_replace(v.name, '^Genasi \((.*)\)$', '\1'),
      'additionalSpells', v.additional_spells,
      'resist', v.resist,
      'traitTags', v.trait_tags,
      'sourceDerivedSubrace', true
    ),
  coalesce(p.raw_payload, '{}'::jsonb)
    || jsonb_build_object(
      'name', regexp_replace(v.name, '^Genasi \((.*)\)$', '\1'),
      'source', 'MPMM',
      'raceName', 'Genasi',
      'raceSource', 'MPMM',
      'page', v.page,
      'speed', v.speed,
      'resist', v.resist,
      'traitTags', v.trait_tags,
      'additionalSpells', v.additional_spells,
      'entries', v.entries
    ),
  now(), now()
from parent p cross join variants v
where not exists (
  select 1 from public.character_option_catalog existing where existing.option_key = v.option_key
);

commit;
