-- Adapt legacy Fighting Initiate to the campaign's 2024 feat model.
-- The source feat is from Tasha's, where martial-weapon proficiency was enough.
-- In this campaign's 2024 ruleset, Fighting Styles are themselves feats gated by
-- the Fighting Style class feature, so Fighting Initiate is treated as a General
-- feat whose prerequisite is already possessing that class feature.
--
-- Keep the imported source prerequisite in metadata for auditability; only the
-- effective campaign prerequisite is replaced.

update public.character_option_catalog
set
  category = 'G',
  prerequisite_text = 'Fighting Style class feature',
  metadata = (
    jsonb_set(
      jsonb_set(
        coalesce(metadata, '{}'::jsonb),
        '{sourcePrerequisite}',
        coalesce(metadata -> 'sourcePrerequisite', metadata -> 'prerequisite', '[]'::jsonb),
        true
      ),
      '{prerequisite}',
      '[{"feature":["Fighting Style"]}]'::jsonb,
      true
    )
    || jsonb_build_object(
      'campaignRulesetOverride', '2024',
      'campaignRulesNote', 'Fighting Initiate requires the Fighting Style class feature and branches into a Fighter Fighting Style choice.'
    )
  ),
  updated_at = now()
where option_type = 'feat'
  and lower(name) = 'fighting initiate'
  and upper(source) = 'TCE';
