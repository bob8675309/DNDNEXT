BEGIN;

CREATE OR REPLACE FUNCTION private.background_json_items_v1(p_value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN p_value IS NULL OR p_value = 'null'::jsonb THEN '[]'::jsonb
    WHEN jsonb_typeof(p_value) = 'array' THEN p_value
    ELSE jsonb_build_array(p_value)
  END;
$function$;

CREATE OR REPLACE FUNCTION private.background_json_slice_v1(p_value jsonb, p_start integer, p_end integer)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $function$
  SELECT COALESCE(jsonb_agg(entry.value ORDER BY entry.ordinality), '[]'::jsonb)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_value) = 'array' THEN p_value ELSE '[]'::jsonb END)
       WITH ORDINALITY AS entry(value, ordinality)
  WHERE entry.ordinality > GREATEST(0, COALESCE(p_start, 0))
    AND (p_end IS NULL OR entry.ordinality <= GREATEST(0, p_end));
$function$;

CREATE OR REPLACE FUNCTION private.apply_background_entry_mods_v1(p_entries jsonb, p_mods jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, private
AS $function$
DECLARE
  result jsonb := CASE WHEN jsonb_typeof(p_entries) = 'array' THEN p_entries ELSE '[]'::jsonb END;
  operations jsonb := CASE WHEN jsonb_typeof(p_mods) = 'array' THEN p_mods ELSE jsonb_build_array(p_mods) END;
  operation jsonb;
  items jsonb;
  mode text;
  insert_index integer;
  replace_index integer;
  replace_name text;
  pattern text;
  replacement text;
  flags text;
BEGIN
  IF p_mods IS NULL OR p_mods = 'null'::jsonb THEN
    RETURN result;
  END IF;

  FOR operation IN SELECT value FROM jsonb_array_elements(operations)
  LOOP
    IF operation IS NULL OR operation = 'null'::jsonb THEN CONTINUE; END IF;
    mode := COALESCE(operation->>'mode', '');
    items := private.background_json_items_v1(operation->'items');

    IF mode = 'appendArr' THEN
      result := result || items;
    ELSIF mode = 'prependArr' THEN
      result := items || result;
    ELSIF mode = 'insertArr' THEN
      insert_index := GREATEST(0, LEAST(jsonb_array_length(result), COALESCE((operation->>'index')::integer, 0)));
      result := private.background_json_slice_v1(result, 0, insert_index)
             || items
             || private.background_json_slice_v1(result, insert_index, NULL);
    ELSIF mode = 'removeArr' THEN
      SELECT COALESCE(jsonb_agg(entry.value ORDER BY entry.ordinality), '[]'::jsonb)
      INTO result
      FROM jsonb_array_elements(result) WITH ORDINALITY AS entry(value, ordinality)
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(private.background_json_items_v1(operation->'names')) AS removed(name)
        WHERE removed.name = COALESCE(entry.value->>'name', (entry.ordinality - 1)::text)
      );
    ELSIF mode = 'replaceArr' THEN
      replace_index := NULL;
      IF jsonb_typeof(operation->'replace') = 'string' THEN
        replace_name := operation->>'replace';
        SELECT (entry.ordinality - 1)::integer
        INTO replace_index
        FROM jsonb_array_elements(result) WITH ORDINALITY AS entry(value, ordinality)
        WHERE entry.value->>'name' = replace_name
        ORDER BY entry.ordinality
        LIMIT 1;
      ELSIF jsonb_typeof(operation->'replace') = 'object' AND operation->'replace' ? 'index' THEN
        replace_index := (operation->'replace'->>'index')::integer;
      END IF;

      IF replace_index IS NOT NULL AND replace_index >= 0 AND replace_index < jsonb_array_length(result) THEN
        result := private.background_json_slice_v1(result, 0, replace_index)
               || items
               || private.background_json_slice_v1(result, replace_index + 1, NULL);
      END IF;
    ELSIF mode = 'replaceTxt' THEN
      pattern := COALESCE(operation->>'replace', '');
      replacement := COALESCE(operation->>'with', '');
      flags := COALESCE(operation->>'flags', 'g');
      IF pattern <> '' THEN
        result := regexp_replace(result::text, pattern, replacement, flags)::jsonb;
      END IF;
    END IF;
  END LOOP;

  RETURN result;
END;
$function$;

DO $block$
DECLARE
  changed integer;
  pass integer := 0;
BEGIN
  LOOP
    pass := pass + 1;

    WITH resolvable AS (
      SELECT
        child.id,
        child.description AS child_description,
        child.metadata AS child_metadata,
        child.raw_payload AS child_payload,
        base.description AS base_description,
        base.metadata AS base_metadata,
        base.raw_payload AS base_payload
      FROM public.character_option_catalog AS child
      JOIN public.character_option_catalog AS base
        ON base.option_type = 'background'
       AND lower(base.name) = lower(child.raw_payload #>> '{_copy,name}')
       AND upper(base.source) = upper(child.raw_payload #>> '{_copy,source}')
      WHERE child.option_type = 'background'
        AND child.raw_payload ? '_copy'
        AND NOT (base.raw_payload ? '_copy')
    ), merged AS (
      SELECT
        id,
        COALESCE(NULLIF(child_description, ''), base_description) AS next_description,
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      COALESCE(base_metadata, '{}'::jsonb) || COALESCE(child_metadata, '{}'::jsonb),
                      '{skills}',
                      CASE WHEN jsonb_typeof(child_metadata->'skills') = 'array' AND jsonb_array_length(child_metadata->'skills') > 0 THEN child_metadata->'skills' ELSE COALESCE(base_metadata->'skills', '[]'::jsonb) END,
                      true
                    ),
                    '{feats}',
                    CASE WHEN jsonb_typeof(child_metadata->'feats') = 'array' AND jsonb_array_length(child_metadata->'feats') > 0 THEN child_metadata->'feats' ELSE COALESCE(base_metadata->'feats', '[]'::jsonb) END,
                    true
                  ),
                  '{tools}',
                  CASE WHEN jsonb_typeof(child_metadata->'tools') = 'array' AND jsonb_array_length(child_metadata->'tools') > 0 THEN child_metadata->'tools' ELSE COALESCE(base_metadata->'tools', '[]'::jsonb) END,
                  true
                ),
                '{abilities}',
                CASE WHEN jsonb_typeof(child_metadata->'abilities') = 'array' AND jsonb_array_length(child_metadata->'abilities') > 0 THEN child_metadata->'abilities' ELSE COALESCE(base_metadata->'abilities', '[]'::jsonb) END,
                true
              ),
              '{languages}',
              CASE WHEN jsonb_typeof(child_metadata->'languages') = 'array' AND jsonb_array_length(child_metadata->'languages') > 0 THEN child_metadata->'languages' ELSE COALESCE(base_metadata->'languages', '[]'::jsonb) END,
              true
            ),
            '{equipment}',
            CASE WHEN jsonb_typeof(child_metadata->'equipment') = 'array' AND jsonb_array_length(child_metadata->'equipment') > 0 THEN child_metadata->'equipment' ELSE COALESCE(base_metadata->'equipment', '[]'::jsonb) END,
            true
          ),
          '{copyResolvedFrom}',
          jsonb_build_object('name', child_payload #>> '{_copy,name}', 'source', upper(child_payload #>> '{_copy,source}')),
          true
        ) AS next_metadata,
        jsonb_set(
          COALESCE(base_payload, '{}'::jsonb) || (COALESCE(child_payload, '{}'::jsonb) - '_copy'),
          '{entries}',
          private.apply_background_entry_mods_v1(
            COALESCE(base_payload->'entries', '[]'::jsonb),
            child_payload #> '{_copy,_mod,entries}'
          ),
          true
        ) AS next_payload
      FROM resolvable
    )
    UPDATE public.character_option_catalog AS target
    SET description = merged.next_description,
        metadata = merged.next_metadata,
        raw_payload = merged.next_payload,
        updated_at = now()
    FROM merged
    WHERE target.id = merged.id;

    GET DIAGNOSTICS changed = ROW_COUNT;
    EXIT WHEN changed = 0;
    IF pass >= 20 THEN
      RAISE EXCEPTION 'Background copy resolution exceeded 20 passes.';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.character_option_catalog
    WHERE option_type = 'background' AND raw_payload ? '_copy'
  ) THEN
    RAISE EXCEPTION 'Some copied backgrounds could not be resolved against their source background.';
  END IF;
END;
$block$;

DO $postconditions$
DECLARE
  preferred_count integer;
  cobalt_skills integer;
  cobalt_features integer;
BEGIN
  SELECT count(*) INTO preferred_count
  FROM public.character_option_catalog_preferred
  WHERE option_type = 'background';
  IF preferred_count <> 148 THEN
    RAISE EXCEPTION 'Preferred background count changed unexpectedly: %', preferred_count;
  END IF;

  SELECT
    jsonb_array_length(COALESCE(metadata->'skills', '[]'::jsonb)),
    (
      SELECT count(*)
      FROM jsonb_array_elements(COALESCE(raw_payload->'entries', '[]'::jsonb)) AS entry(value)
      WHERE COALESCE((entry.value #>> '{data,isFeature}')::boolean, false)
         OR COALESCE(entry.value->>'name', '') ~* 'Feature\s*:'
    )
  INTO cobalt_skills, cobalt_features
  FROM public.character_option_catalog
  WHERE option_type = 'background'
    AND lower(name) = 'cobalt scholar (sage)'
    AND upper(source) = 'EGW';

  IF COALESCE(cobalt_skills, 0) < 1 THEN
    RAISE EXCEPTION 'Cobalt Scholar did not inherit Sage skill proficiencies.';
  END IF;
  IF COALESCE(cobalt_features, 0) < 1 THEN
    RAISE EXCEPTION 'Cobalt Scholar did not inherit the Sage background feature.';
  END IF;
END;
$postconditions$;

DROP FUNCTION private.apply_background_entry_mods_v1(jsonb, jsonb);
DROP FUNCTION private.background_json_slice_v1(jsonb, integer, integer);
DROP FUNCTION private.background_json_items_v1(jsonb);

COMMIT;
