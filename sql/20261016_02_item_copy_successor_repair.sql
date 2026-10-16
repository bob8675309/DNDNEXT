-- 2026-10-16 ItemCard/catalog audit: repair legacy item _copy rows whose
-- base source codes moved from 2014 (DMG/PHB/MM) to 2024 (XDMG/XPHB/XMM).
-- Keeps child identity/source/custom fields, applies source entry mutations,
-- and inherits canonical rarity/economy/type/rules from the successor base.
BEGIN;

CREATE OR REPLACE FUNCTION private.item_copy_apply_entries_v2(
  p_entries jsonb,
  p_mods jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO pg_catalog, public, private
AS $$
DECLARE
  v_entries jsonb := CASE WHEN jsonb_typeof(p_entries)='array' THEN p_entries ELSE '[]'::jsonb END;
  v_ops jsonb := CASE
    WHEN p_mods IS NULL OR p_mods='null'::jsonb THEN '[]'::jsonb
    WHEN jsonb_typeof(p_mods)='array' THEN p_mods
    ELSE jsonb_build_array(p_mods)
  END;
  v_op jsonb;
  v_items jsonb;
  v_mode text;
  v_index integer;
  v_next jsonb;
  v_entry jsonb;
  v_item jsonb;
  v_ordinality bigint;
  v_pattern text;
  v_replace text;
  v_flags text;
BEGIN
  FOR v_op IN SELECT value FROM jsonb_array_elements(v_ops)
  LOOP
    v_mode := coalesce(v_op->>'mode','');
    v_items := CASE
      WHEN v_op->'items' IS NULL OR v_op->'items'='null'::jsonb THEN '[]'::jsonb
      WHEN jsonb_typeof(v_op->'items')='array' THEN v_op->'items'
      ELSE jsonb_build_array(v_op->'items')
    END;

    IF v_mode='appendArr' THEN
      v_entries := v_entries || v_items;
    ELSIF v_mode='prependArr' THEN
      v_entries := v_items || v_entries;
    ELSIF v_mode='insertArr' THEN
      v_index := greatest(0,least(jsonb_array_length(v_entries),coalesce((v_op->>'index')::integer,0)));
      v_next := '[]'::jsonb;
      FOR v_entry,v_ordinality IN
        SELECT value, ordinality FROM jsonb_array_elements(v_entries) WITH ORDINALITY
      LOOP
        IF v_ordinality-1=v_index THEN
          FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
            v_next := v_next || jsonb_build_array(v_item);
          END LOOP;
        END IF;
        v_next := v_next || jsonb_build_array(v_entry);
      END LOOP;
      IF v_index=jsonb_array_length(v_entries) THEN
        v_next := v_next || v_items;
      END IF;
      v_entries := v_next;
    ELSIF v_mode='replaceArr' THEN
      v_index := CASE
        WHEN jsonb_typeof(v_op->'replace')='object' AND (v_op#>>'{replace,index}') ~ '^\d+$'
          THEN (v_op#>>'{replace,index}')::integer
        ELSE -1
      END;
      IF v_index >= 0 THEN
        v_next := '[]'::jsonb;
        FOR v_entry,v_ordinality IN
          SELECT value, ordinality FROM jsonb_array_elements(v_entries) WITH ORDINALITY
        LOOP
          IF v_ordinality-1=v_index THEN
            FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
              v_next := v_next || jsonb_build_array(v_item);
            END LOOP;
          ELSE
            v_next := v_next || jsonb_build_array(v_entry);
          END IF;
        END LOOP;
        v_entries := v_next;
      END IF;
    ELSIF v_mode='replaceTxt' THEN
      v_pattern := coalesce(v_op->>'replace','');
      v_replace := coalesce(v_op->>'with','');
      v_flags := coalesce(nullif(v_op->>'flags',''),'g');
      IF v_pattern <> '' THEN
        v_entries := regexp_replace(v_entries::text,v_pattern,v_replace,v_flags)::jsonb;
      END IF;
    END IF;
  END LOOP;

  RETURN v_entries;
END
$$;

WITH successor(source_old,source_new) AS (
  VALUES ('DMG','XDMG'),('PHB','XPHB'),('MM','XMM')
),
targets AS (
  SELECT
    child.id AS child_id,
    child.item_name AS child_name,
    child.payload AS child_payload,
    base.item_type AS base_item_type,
    base.item_rarity AS base_item_rarity,
    base.price_gp AS base_price_gp,
    base.payload AS base_payload,
    private.item_copy_apply_entries_v2(
      coalesce(base.payload->'entries','[]'::jsonb),
      child.payload #> '{_copy,_mod,entries}'
    ) AS resolved_entries
  FROM public.items_catalog child
  JOIN successor s
    ON upper(coalesce(child.payload #>> '{_copy,source}',''))=s.source_old
  JOIN public.items_catalog base
    ON lower(base.item_name)=lower(child.payload #>> '{_copy,name}')
   AND upper(coalesce(base.payload->>'source',''))=s.source_new
  WHERE child.payload ? '_copy'
    AND NOT EXISTS (
      SELECT 1
      FROM public.items_catalog exact_base
      WHERE lower(exact_base.item_name)=lower(child.payload #>> '{_copy,name}')
        AND upper(coalesce(exact_base.payload->>'source',''))=upper(coalesce(child.payload #>> '{_copy,source}',''))
    )
),
resolved AS (
  SELECT
    t.*,
    coalesce(
      nullif(private.item_copy_rule_text_v1(t.resolved_entries),''),
      nullif(t.base_payload->>'item_description',''),
      nullif(t.base_payload->>'rulesShort',''),
      ''
    ) AS resolved_description
  FROM targets t
)
UPDATE public.items_catalog child
SET
  item_type = r.base_item_type,
  item_rarity = r.base_item_rarity,
  price_gp = r.base_price_gp,
  payload = (
    coalesce(r.base_payload,'{}'::jsonb)
    || coalesce(r.child_payload,'{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object(
      'item_key', child.item_key,
      'item_id', coalesce(child.payload->>'item_id',child.item_key),
      'item_name', child.item_name,
      'name', child.item_name,
      'item_type', r.base_item_type,
      'uiType', coalesce(r.base_payload->>'uiType',r.base_item_type),
      'item_rarity', r.base_item_rarity,
      'rarity', coalesce(nullif(r.base_payload->>'rarity',''),r.base_item_rarity),
      'price_gp', r.base_price_gp,
      'entries', CASE WHEN jsonb_array_length(r.resolved_entries)>0 THEN r.resolved_entries ELSE NULL END,
      'item_description', r.resolved_description,
      'rulesShort', r.resolved_description
    ))
  )
FROM resolved r
WHERE child.id=r.child_id;

COMMIT;
