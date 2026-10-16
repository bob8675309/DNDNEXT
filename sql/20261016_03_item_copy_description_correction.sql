-- 2026-10-16 ItemCard/catalog audit corrective pass.
-- The predecessor migration correctly repaired rarity/economy but learned that
-- runtime payload.entries can contain flavor overrides rather than canonical
-- rules. Rebuild the six source-compatible successor copies from the canonical
-- base item_description, and give the KftGV Book variant a source-specific
-- recovery instead of pretending its legacy DMG copy is the 2024 XDMG artifact.
BEGIN;

CREATE OR REPLACE FUNCTION private.item_copy_description_from_base_v3(
  p_base_description text,
  p_mods jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO pg_catalog, public, private
AS $$
DECLARE
  v_text text := coalesce(p_base_description,'');
  v_ops jsonb := CASE
    WHEN p_mods IS NULL OR p_mods='null'::jsonb THEN '[]'::jsonb
    WHEN jsonb_typeof(p_mods)='array' THEN p_mods
    ELSE jsonb_build_array(p_mods)
  END;
  v_op jsonb;
  v_mode text;
  v_items text;
  v_pattern text;
  v_replace text;
  v_flags text;
BEGIN
  FOR v_op IN SELECT value FROM jsonb_array_elements(v_ops)
  LOOP
    v_mode := coalesce(v_op->>'mode','');
    v_items := private.item_copy_rule_text_v1(v_op->'items');

    IF v_mode='replaceTxt' THEN
      v_pattern := coalesce(v_op->>'replace','');
      v_replace := coalesce(v_op->>'with','');
      v_flags := coalesce(nullif(v_op->>'flags',''),'g');
      IF v_pattern <> '' THEN
        v_text := regexp_replace(v_text,v_pattern,v_replace,v_flags);
      END IF;
    ELSIF v_mode='appendArr' AND nullif(v_items,'') IS NOT NULL THEN
      v_text := concat_ws(E'\n\n',nullif(v_text,''),v_items);
    ELSIF v_mode='prependArr' AND nullif(v_items,'') IS NOT NULL THEN
      v_text := concat_ws(E'\n\n',v_items,nullif(v_text,''));
    END IF;
  END LOOP;

  RETURN trim(both E'\n' from v_text);
END
$$;

WITH safe_alias(child_name,old_source,new_source) AS (
  VALUES
    ('+2 Ring of Protection','DMG','XDMG'),
    ('Charred Wand of Magic Missiles','DMG','XDMG'),
    ('Devlin''s Staff of Striking','DMG','XDMG'),
    ('Enchanted Three-Dragon Ante Set','PHB','XPHB'),
    ('Horn of the Endless Maze','DMG','XDMG'),
    ('Jakarion''s Staff of Frost','DMG','XDMG')
),
resolved AS (
  SELECT
    child.id AS child_id,
    child.item_key,
    child.item_name,
    child.payload AS child_payload,
    base.item_type,
    base.item_rarity,
    base.price_gp,
    base.payload AS base_payload,
    private.item_copy_description_from_base_v3(
      coalesce(base.payload->>'item_description',base.payload->>'rulesShort',''),
      child.payload #> '{_copy,_mod,entries}'
    ) AS resolved_description
  FROM safe_alias a
  JOIN public.items_catalog child
    ON child.item_name=a.child_name
   AND upper(coalesce(child.payload #>> '{_copy,source}',''))=a.old_source
  JOIN public.items_catalog base
    ON lower(base.item_name)=lower(child.payload #>> '{_copy,name}')
   AND upper(coalesce(base.payload->>'source',''))=a.new_source
)
UPDATE public.items_catalog child
SET
  item_type=r.item_type,
  item_rarity=r.item_rarity,
  price_gp=r.price_gp,
  payload=(
    coalesce(r.base_payload,'{}'::jsonb)
    || coalesce(r.child_payload,'{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object(
      'item_key',child.item_key,
      'item_id',coalesce(child.payload->>'item_id',child.item_key),
      'item_name',child.item_name,
      'name',child.item_name,
      'item_type',r.item_type,
      'uiType',coalesce(r.base_payload->>'uiType',r.item_type),
      'item_rarity',r.item_rarity,
      'rarity',coalesce(nullif(r.base_payload->>'rarity',''),r.item_rarity),
      'price_gp',r.price_gp,
      'item_description',r.resolved_description,
      'rulesShort',r.resolved_description
    ))
  )
FROM resolved r
WHERE child.id=r.child_id;

-- Keys from the Golden Vault intentionally modifies the 2014 Book of Vile
-- Darkness. Its legacy _copy is not source-compatible with the 2024 XDMG base,
-- so keep a source-specific player-facing recovery instead of an unsafe alias.
UPDATE public.items_catalog
SET
  item_type='Wondrous Item',
  item_rarity='artifact',
  price_gp=50000,
  payload=payload || jsonb_build_object(
    'item_type','Wondrous Item',
    'uiType','Wondrous Item',
    'item_rarity','artifact',
    'rarity','artifact',
    'price_gp',50000,
    'catalog_integrity_note','KftGV legacy DMG copy recovered with a source-specific summary; do not auto-resolve this item against XDMG.',
    'item_description',
      'A uniquely corrupted version of the Book of Vile Darkness, this artifact rewards prolonged study but binds its bearer to evil. A creature must spend 80 hours studying it before using its deeper benefits. A non-evil creature that attunes to it faces a DC 17 Charisma saving throw; failure changes that creature to neutral evil. The book abandons a bearer who stops furthering evil, and a bearer who dies while attuned has their soul claimed by a powerful evil entity.' || E'\n\n' ||
      'Circle of Death' || E'\n\n' ||
      'While attuned, you can use an action to cast Circle of Death from the book with save DC 20. Afterward, roll a d6; on 1–5 this property cannot be used again until the next dawn.' || E'\n\n' ||
      'Condition Immunities' || E'\n\n' ||
      'While attuned, you cannot be Charmed or Frightened.' || E'\n\n' ||
      'Evil Presence' || E'\n\n' ||
      'The hostile spirit inside the book tries to possess a new bearer. On a failed DC 20 Charisma saving throw, the spirit takes control until magic such as Dispel Evil and Good drives it out.' || E'\n\n' ||
      'Adjusted Ability Scores' || E'\n\n' ||
      'After the required study, increase one ability score by 2 to a maximum of 24 and decrease another by 2 to a minimum of 3. The book makes this adjustment only once.' || E'\n\n' ||
      'Mark of Darkness' || E'\n\n' ||
      'Study leaves a visible mark of corruption. The mark grants Advantage on Charisma (Persuasion) checks with evil creatures and Charisma (Intimidation) checks with non-evil creatures.' || E'\n\n' ||
      'Command Evil' || E'\n\n' ||
      'While attuned and holding the book, you can use an action to cast Dominate Monster on an evil target with save DC 18. This property recharges at the next dawn.' || E'\n\n' ||
      'Dark Lore' || E'\n\n' ||
      'When using the book to recall lore about evil, double your proficiency bonus on the relevant Intelligence check.' || E'\n\n' ||
      'Dark Speech' || E'\n\n' ||
      'While carrying the book and attuned to it, you can use an action to speak its Dark Speech. You take 1d12 Psychic damage, and each non-evil creature within 15 feet takes 3d6 Psychic damage.' || E'\n\n' ||
      'Destroying the Book' || E'\n\n' ||
      'The artifact repeatedly reforms unless evil is eradicated. A Solar can tear it apart for a long interval, and a bearer who studies it for a century can discover a hidden phrase capable of destroying both speaker and book before the artifact eventually reforms.'
  )
WHERE item_name='Book of Vile Darkness (Variant)'
  AND upper(coalesce(payload->>'source',''))='KFTGV';

COMMIT;
