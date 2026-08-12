begin;

with parent as (
  select * from public.character_option_catalog
  where option_type = 'species' and name = 'Genasi' and source = 'MPMM'
  limit 1
), variants(option_key, description, entries) as (
  values
  (
    'species:genasi-air|MPMM',
    'Unending Breath. You can hold your breath indefinitely while you are not incapacitated. Lightning Resistance. You have resistance to lightning damage. Mingle with the Wind. You know shocking grasp. At 3rd level you can cast feather fall with this trait without a material component; at 5th level you can also cast levitate without a material component. Each leveled spell has one source-granted use per long rest, and either can also be cast using an appropriate spell slot. The source allows Intelligence, Wisdom, or Charisma as the spellcasting ability; the Forge resolves the highest eligible final ability automatically.',
    '[{"type":"entries","name":"Unending Breath","entries":["You can hold your breath indefinitely while you are not incapacitated."]},{"type":"entries","name":"Lightning Resistance","entries":["You have resistance to lightning damage."]},{"type":"entries","name":"Mingle with the Wind","entries":["You know the {@spell shocking grasp} cantrip. Starting at 3rd level, you can cast {@spell feather fall} with this trait without requiring a material component. Starting at 5th level, you can also cast {@spell levitate} with this trait without requiring a material component. Each leveled spell has one source-granted use that refreshes after a long rest, and you can also cast either spell using any spell slots you have of the appropriate level.","The source allows Intelligence, Wisdom, or Charisma as the spellcasting ability for these spells; the Forge resolves the highest eligible final ability automatically."]}]'::jsonb
  ),
  (
    'species:genasi-earth|MPMM',
    'Earth Walk. Ground-based difficult terrain does not cost extra movement while you use your walking speed. Merge with Stone. You know blade ward and can also cast it as a bonus action a number of times equal to your proficiency bonus, refreshing after a long rest. At 5th level you can cast pass without trace without a material component once per long rest and can also cast it using a 2nd-level or higher spell slot. The source allows Intelligence, Wisdom, or Charisma as the spellcasting ability; the Forge resolves the highest eligible final ability automatically.',
    '[{"type":"entries","name":"Earth Walk","entries":["Ground-based difficult terrain does not cost you extra movement while you use your walking speed."]},{"type":"entries","name":"Merge with Stone","entries":["You know the {@spell blade ward} cantrip. You can cast it normally, and you can also cast it as a bonus action a number of times equal to your proficiency bonus, regaining all source-granted bonus-action uses after a long rest.","Starting at 5th level, you can cast {@spell pass without trace} with this trait without requiring a material component. That source-granted use refreshes after a long rest, and you can also cast the spell using any spell slot you have of 2nd level or higher.","The source allows Intelligence, Wisdom, or Charisma as the spellcasting ability for these spells; the Forge resolves the highest eligible final ability automatically."]}]'::jsonb
  ),
  (
    'species:genasi-fire|MPMM',
    'Fire Resistance. You have resistance to fire damage. Reach to the Blaze. You know produce flame. At 3rd level you can cast burning hands with this trait; at 5th level you can also cast flame blade without a material component. Each leveled spell has one source-granted use per long rest, and either can also be cast using an appropriate spell slot. The source allows Intelligence, Wisdom, or Charisma as the spellcasting ability; the Forge resolves the highest eligible final ability automatically.',
    '[{"type":"entries","name":"Fire Resistance","entries":["You have resistance to fire damage."]},{"type":"entries","name":"Reach to the Blaze","entries":["You know the {@spell produce flame} cantrip. Starting at 3rd level, you can cast {@spell burning hands} with this trait. Starting at 5th level, you can also cast {@spell flame blade} with this trait without requiring a material component. Each leveled spell has one source-granted use that refreshes after a long rest, and you can also cast either spell using any spell slots you have of the appropriate level.","The source allows Intelligence, Wisdom, or Charisma as the spellcasting ability for these spells; the Forge resolves the highest eligible final ability automatically."]}]'::jsonb
  ),
  (
    'species:genasi-water|MPMM',
    'Acid Resistance. You have resistance to acid damage. Amphibious. You breathe air and water. Call to the Wave. You know acid splash. At 3rd level you can cast create or destroy water with this trait; at 5th level you can also cast water walk without a material component. Each leveled spell has one source-granted use per long rest, and either can also be cast using an appropriate spell slot. The source allows Intelligence, Wisdom, or Charisma as the spellcasting ability; the Forge resolves the highest eligible final ability automatically.',
    '[{"type":"entries","name":"Acid Resistance","entries":["You have resistance to acid damage."]},{"type":"entries","name":"Amphibious","entries":["You breathe air and water."]},{"type":"entries","name":"Call to the Wave","entries":["You know the {@spell acid splash} cantrip. Starting at 3rd level, you can cast {@spell create or destroy water} with this trait. Starting at 5th level, you can also cast {@spell water walk} with this trait without requiring a material component. Each leveled spell has one source-granted use that refreshes after a long rest, and you can also cast either spell using any spell slots you have of the appropriate level.","The source allows Intelligence, Wisdom, or Charisma as the spellcasting ability for these spells; the Forge resolves the highest eligible final ability automatically."]}]'::jsonb
  )
)
update public.character_option_catalog child
set
  description = variants.description,
  metadata = jsonb_set(
    coalesce(child.metadata, '{}'::jsonb),
    '{traits}',
    coalesce(parent.metadata->'traits', '[]'::jsonb) || variants.entries,
    true
  ) || jsonb_build_object(
    'sourceAudit', jsonb_build_object(
      'status', 'restored-after-5etools-review',
      'source', 'MPMM',
      'note', '5etools MPMM source audit restored component exceptions, alternate spell-slot casting, and full lineage spell cadence while preserving Forge spell-authority routing.'
    )
  ),
  updated_at = now()
from parent, variants
where child.option_type = 'species'
  and child.source = 'MPMM'
  and child.option_key = variants.option_key;

commit;
