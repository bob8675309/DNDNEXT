-- DNDNext playable Merfolk movement adjustment.
-- Preserve the imported 10 ft. walk / 40 ft. swim source movement in metadata,
-- then use 20 ft. walk / 40 ft. swim for the playable preferred Species row.
-- raw_payload remains untouched so the original source import is still auditable.

update public.character_option_catalog
set metadata = jsonb_set(
  jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{heritageSourceSpeed}',
    coalesce(metadata->'heritageSourceSpeed', metadata->'speed', '{"walk":10,"swim":40}'::jsonb),
    true
  ),
  '{speed}',
  '{"walk":20,"swim":40}'::jsonb,
  true
)
where option_type = 'species'
  and name = 'Merfolk'
  and source = 'DMG';
