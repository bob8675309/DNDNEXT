-- DNDNext Heritage replacement profiles for approved legacy/setting Species.
-- Preserves source payloads and physical chassis while replacing the old special-trait package
-- with eight curated Grim Hollow 2024 Heritage Traits.

begin;

-- The Grim Hollow trait list places these cross-category traits under Exploration.
-- Preserve their secondary Combat feature tags, but use the player-facing primary category.
update public.character_option_catalog
set category = 'E',
    metadata = case
      when name = 'Artifice Expertise'
        then jsonb_set(jsonb_set(coalesce(metadata, '{}'::jsonb), '{canonicalCategory}', '"E"'::jsonb, true), '{improvedName}', '"Expert Gadgeteer"'::jsonb, true)
      else jsonb_set(coalesce(metadata, '{}'::jsonb), '{canonicalCategory}', '"E"'::jsonb, true)
    end
where option_type = 'heritage_trait'
  and source = 'GrimHollowPG24'
  and name in ('Artifice Expertise', 'Helping Hand', 'Powerful Build');

-- Keep Custom Lineage's embedded catalogue synchronized with the corrected primary categories.
update public.character_option_catalog s
set metadata = jsonb_set(
  coalesce(s.metadata, '{}'::jsonb),
  '{heritageTraitCatalog}',
  coalesce((
    select jsonb_agg(
      case
        when elem->>'name' in ('Artifice Expertise', 'Helping Hand', 'Powerful Build')
          then jsonb_set(
            jsonb_set(elem, '{category}', '"E"'::jsonb, true),
            '{improvedName}',
            case when elem->>'name' = 'Artifice Expertise' then '"Expert Gadgeteer"'::jsonb else coalesce(elem->'improvedName', 'null'::jsonb) end,
            true
          )
        else elem
      end
      order by ord
    )
    from jsonb_array_elements(coalesce(s.metadata->'heritageTraitCatalog', '[]'::jsonb)) with ordinality as x(elem, ord)
  ), '[]'::jsonb),
  true
)
where s.option_type = 'species'
  and s.name = 'Custom Lineage'
  and s.source = 'TCE';

with profile_defs as (
  select *
  from jsonb_to_recordset($profiles$
[
  {
    "name": "Human (Innistrad)",
    "source": "PSI",
    "profileName": "Innistrad Heritage",
    "traits": [
      "Brave",
      "Hunter's Instinct",
      "Relentless Endurance",
      "Darkvision",
      "Even in Sleep",
      "Shroud of the Wild",
      "Keen Survivor",
      "Moved by Faith"
    ],
    "fixedSubchoices": {},
    "baseTraitNames": []
  },
  {
    "name": "Human (Kaladesh)",
    "source": "PSK",
    "profileName": "Kaladesh Heritage",
    "traits": [
      "Centered",
      "Timely Boon",
      "Artifice Expertise",
      "Driver",
      "Intrinsic Orientation",
      "Crafter's Eye",
      "Magical Insight",
      "Impromptu Artisan"
    ],
    "fixedSubchoices": {},
    "baseTraitNames": []
  },
  {
    "name": "Human (Ixalan)",
    "source": "PSX",
    "profileName": "Ixalan Heritage",
    "traits": [
      "Skirmish Tactics",
      "First Strike",
      "Timely Boon",
      "Driver",
      "Intrinsic Orientation",
      "Swimmer",
      "Keen Survivor",
      "Persuasive Knack"
    ],
    "fixedSubchoices": {},
    "baseTraitNames": []
  },
  {
    "name": "Human (Zendikar)",
    "source": "PSZ",
    "profileName": "Zendikar Heritage",
    "traits": [
      "Quick Initiative",
      "Timely Boon",
      "Climber",
      "Burst of Speed",
      "Standing Leap",
      "Keen Survivor",
      "Inborn Perception",
      "Athlete's Spirit"
    ],
    "fixedSubchoices": {},
    "baseTraitNames": []
  },
  {
    "name": "Merfolk",
    "source": "DMG",
    "profileName": "Merfolk Heritage",
    "traits": [
      "Slippery",
      "Timely Boon",
      "Amphibious",
      "Swimmer",
      "Intrinsic Orientation",
      "Connection to Nature",
      "Magical Insight",
      "Inborn Perception"
    ],
    "fixedSubchoices": {},
    "baseTraitNames": []
  },
  {
    "name": "Gnoll",
    "source": "DMG",
    "profileName": "Gnoll Heritage",
    "traits": [
      "Natural Attack",
      "Pack Tactics",
      "Hunter's Instinct",
      "Darkvision",
      "Burst of Speed",
      "Tireless",
      "Keen Survivor",
      "Inborn Perception"
    ],
    "fixedSubchoices": {},
    "baseTraitNames": []
  },
  {
    "name": "Bullywug",
    "source": "DMG",
    "profileName": "Bullywug Heritage",
    "traits": [
      "Slippery",
      "Menacing Roar",
      "Amphibious",
      "Standing Leap",
      "Shroud of the Wild",
      "Nature's Voice",
      "Instinctive Stealth",
      "Animal Friend"
    ],
    "fixedSubchoices": {},
    "baseTraitNames": []
  },
  {
    "name": "Grimlock",
    "source": "DMG",
    "profileName": "Grimlock Heritage",
    "traits": [
      "Ruthless Response",
      "Tenacious",
      "Resilient Ears",
      "Supple Squeeze",
      "Shroud of the Wild",
      "Inborn Perception",
      "Instinctive Stealth",
      "Eager Deceiver"
    ],
    "fixedSubchoices": {},
    "baseTraitNames": [
      "Blindsight"
    ]
  },
  {
    "name": "Boggart",
    "source": "LFL",
    "profileName": "Boggart Heritage",
    "traits": [
      "Larger Target",
      "Quick Slip",
      "Creature Cover",
      "Darkvision",
      "Pass Through",
      "Supple Squeeze",
      "Eager Deceiver",
      "Nimble Moves"
    ],
    "fixedSubchoices": {},
    "baseTraitNames": [
      "Creature Type"
    ]
  },
  {
    "name": "Flamekin",
    "source": "LFL",
    "profileName": "Flamekin Heritage",
    "traits": [
      "Damage Resistance",
      "Centered",
      "Focused Reserves",
      "Darkvision",
      "Inured to the Elements",
      "Tireless",
      "Magical Insight",
      "Connection to Nature"
    ],
    "fixedSubchoices": {
      "Damage Resistance": {
        "damageType": "Fire"
      }
    },
    "baseTraitNames": []
  },
  {
    "name": "Rimekin",
    "source": "LFL",
    "profileName": "Rimekin Heritage",
    "traits": [
      "Damage Resistance",
      "Centered",
      "Focused Mind",
      "Darkvision",
      "Inured to the Elements",
      "Tireless",
      "Magical Insight",
      "Embrace the Past"
    ],
    "fixedSubchoices": {
      "Damage Resistance": {
        "damageType": "Cold"
      }
    },
    "baseTraitNames": []
  },
  {
    "name": "Giff",
    "source": "AAG",
    "profileName": "Giff Heritage",
    "traits": [
      "Mighty Shove",
      "Stalwart Reserves",
      "Powerful Build",
      "Steady",
      "Tireless",
      "Athlete's Spirit",
      "Firm Influence",
      "Commanding Insight"
    ],
    "fixedSubchoices": {},
    "baseTraitNames": []
  }
]
$profiles$::jsonb) as p(
    name text,
    source text,
    "profileName" text,
    traits jsonb,
    "fixedSubchoices" jsonb,
    "baseTraitNames" jsonb
  )
),
expanded as (
  select
    p.name,
    p.source,
    p."profileName" as profile_name,
    p."fixedSubchoices" as fixed_subchoices,
    p."baseTraitNames" as base_trait_names,
    trait.value as trait_name,
    trait.ordinality as trait_ordinal
  from profile_defs p
  cross join lateral jsonb_array_elements_text(p.traits) with ordinality as trait(value, ordinality)
),
resolved as (
  select
    e.*,
    h.option_key,
    h.name as catalog_name,
    case when h.name in ('Artifice Expertise', 'Helping Hand', 'Powerful Build') then 'E' else h.category end as category,
    h.description,
    h.metadata as trait_metadata,
    coalesce((e.fixed_subchoices->e.trait_name), '{}'::jsonb) as fixed_subchoice
  from expanded e
  join public.character_option_catalog h
    on h.option_type = 'heritage_trait'
   and h.source = 'GrimHollowPG24'
   and h.name = e.trait_name
),
compiled as (
  select
    r.name,
    r.source,
    r.profile_name,
    min(r.base_trait_names::text)::jsonb as base_trait_names,
    jsonb_agg(
      jsonb_build_object(
        'key', r.option_key,
        'name', r.catalog_name,
        'category', r.category,
        'description', r.description,
        'improvedName', r.trait_metadata->>'improvedName',
        'repeatLimit', greatest(1, coalesce((r.trait_metadata->>'repeatLimit')::int, 1)),
        'fixedSubchoices', r.fixed_subchoice
      )
      order by r.trait_ordinal
    ) as profile_traits,
    jsonb_agg(
      jsonb_build_object(
        'name', r.catalog_name,
        'type', 'entries',
        'entries', jsonb_build_array(
          case
            when r.catalog_name = 'Damage Resistance' and coalesce(r.fixed_subchoice->>'damageType', '') <> ''
              then 'Exposure to elemental force has hardened you. You have Resistance to ' || (r.fixed_subchoice->>'damageType') || ' damage.'
            when coalesce(r.trait_metadata->>'improvedName', '') <> ''
             and position(E'\n\n' || (r.trait_metadata->>'improvedName') || E'\n\n' in r.description) > 0
              then split_part(r.description, E'\n\n' || (r.trait_metadata->>'improvedName') || E'\n\n', 1)
            else r.description
          end
        ),
        'heritageTraitKey', r.option_key,
        'heritageCategory', r.category,
        'fixedSubchoices', r.fixed_subchoice
      )
      order by r.trait_ordinal
    ) as display_traits,
    count(*) filter (where r.category = 'C') as combat_count,
    count(*) filter (where r.category = 'E') as exploration_count,
    count(*) filter (where r.category = 'R') as roleplaying_count,
    bool_or(r.catalog_name = 'Darkvision') as has_darkvision
  from resolved r
  group by r.name, r.source, r.profile_name
),
targets as (
  select
    s.id,
    s.name,
    s.source,
    s.metadata,
    c.profile_name,
    c.profile_traits,
    c.display_traits,
    c.combat_count,
    c.exploration_count,
    c.roleplaying_count,
    c.has_darkvision,
    coalesce(s.metadata->'heritageSourceTraits', s.metadata->'traits', '[]'::jsonb) as source_traits,
    coalesce(s.metadata->'heritageSourceLanguages', s.metadata->'languages', '[]'::jsonb) as source_languages,
    coalesce(s.metadata->'heritageSourceDarkvision', s.metadata->'darkvision', 'null'::jsonb) as source_darkvision,
    coalesce((
      select jsonb_agg(source_trait order by ord)
      from jsonb_array_elements(coalesce(s.metadata->'heritageSourceTraits', s.metadata->'traits', '[]'::jsonb)) with ordinality as st(source_trait, ord)
      where source_trait->>'name' in (
        select value
        from jsonb_array_elements_text(c.base_trait_names) as b(value)
      )
    ), '[]'::jsonb) as base_traits
  from public.character_option_catalog s
  join compiled c
    on c.name = s.name
   and c.source = s.source
  where s.option_type = 'species'
)
update public.character_option_catalog s
set metadata =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(coalesce(t.metadata, '{}'::jsonb),
                    '{heritageSourceTraits}', t.source_traits, true),
                  '{heritageSourceLanguages}', t.source_languages, true),
                '{heritageSourceDarkvision}', t.source_darkvision, true),
              '{heritageProfileActive}', 'true'::jsonb, true),
            '{heritagePickCount}', '8'::jsonb, true),
          '{legacyTraitPackageReplaced}', 'true'::jsonb, true),
        '{languages}', '[]'::jsonb, true),
      '{darkvision}', case when t.has_darkvision then '60'::jsonb else 'null'::jsonb end, true),
    '{traits}', t.base_traits || t.display_traits, true
  )
  || jsonb_build_object(
    'heritageProfile',
    jsonb_build_object(
      'system', 'GrimHollowPG24',
      'mode', 'traditional-fixed',
      'active', true,
      'homebrew', true,
      'pickCount', 8,
      'profileName', t.profile_name,
      'categoryCounts', jsonb_build_object('C', t.combat_count, 'E', t.exploration_count, 'R', t.roleplaying_count),
      'baseTraits', t.base_traits,
      'traits', t.profile_traits,
      'note', 'DNDNext curated replacement package. The original source trait package is preserved in heritageSourceTraits and is not stacked with these Heritage Traits.'
    )
  )
from targets t
where s.id = t.id;

-- Guardrails: all twelve approved Species must exist, resolve to exactly eight Heritage Traits,
-- and use the standard balanced 3/3/2 (in any order) traditional-package distribution.
do $$
declare
  v_target_count int;
  v_bad_count int;
begin
  select count(*) into v_target_count
  from public.character_option_catalog
  where option_type = 'species'
    and coalesce((metadata->>'heritageProfileActive')::boolean, false)
    and (name, source) in (
      ('Human (Innistrad)','PSI'), ('Human (Kaladesh)','PSK'), ('Human (Ixalan)','PSX'), ('Human (Zendikar)','PSZ'),
      ('Merfolk','DMG'), ('Gnoll','DMG'), ('Bullywug','DMG'), ('Grimlock','DMG'),
      ('Boggart','LFL'), ('Flamekin','LFL'), ('Rimekin','LFL'), ('Giff','AAG')
    );
  if v_target_count <> 12 then
    raise exception 'Expected 12 active Heritage replacement Species, found %', v_target_count;
  end if;

  select count(*) into v_bad_count
  from public.character_option_catalog
  where option_type = 'species'
    and coalesce((metadata->>'heritageProfileActive')::boolean, false)
    and (name, source) in (
      ('Human (Innistrad)','PSI'), ('Human (Kaladesh)','PSK'), ('Human (Ixalan)','PSX'), ('Human (Zendikar)','PSZ'),
      ('Merfolk','DMG'), ('Gnoll','DMG'), ('Bullywug','DMG'), ('Grimlock','DMG'),
      ('Boggart','LFL'), ('Flamekin','LFL'), ('Rimekin','LFL'), ('Giff','AAG')
    )
    and (
      jsonb_array_length(coalesce(metadata->'heritageProfile'->'traits','[]'::jsonb)) <> 8
      or (
        select array_agg((value)::int order by (value)::int)
        from jsonb_each_text(metadata->'heritageProfile'->'categoryCounts')
      ) <> array[2,3,3]
    );
  if v_bad_count <> 0 then
    raise exception 'One or more Heritage replacement profiles failed the 8-pick / balanced-category guardrail';
  end if;
end $$;

commit;
