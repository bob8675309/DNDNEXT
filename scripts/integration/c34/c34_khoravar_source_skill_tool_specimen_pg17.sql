-- C34 T14 reduced, source-identified XPHB skill/tool rows (DISPOSABLE TEST ONLY).
-- Exact four IDs, names, types and source from held #358 original I1-J signed fixture.
-- Unlike older I1-J, DO NOT recreate/replace T5's production-shaped preferred
-- view: C34 already has the original 13-column source-precedence view.
\set ON_ERROR_STOP on
DO $t14catalog_pre$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('public.character_option_catalog_preferred') IS NULL
 OR to_regclass('public.character_option_catalog') IS NULL
 OR to_regclass('public.character_runtime_feature_choices') IS NULL
 OR to_regprocedure('private.materialize_player_forge_eladrin_season_v1()') IS NULL
 OR to_regprocedure('private.materialize_player_forge_khoravar_skill_versatility_v1()') IS NOT NULL
 THEN RAISE EXCEPTION 'C34 T14 source skill/tool rows require signed T13 disposable baseline'; END IF;
END $t14catalog_pre$;
-- Source table subset, not a production items schema or full catalog.
CREATE TABLE IF NOT EXISTS public.items_catalog(
 id uuid PRIMARY KEY,
 item_key text NOT NULL UNIQUE,
 item_name text NOT NULL,
 item_type text,
 item_rarity text,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
INSERT INTO public.character_option_catalog(id,option_key,option_type,name,source,category,metadata)
VALUES
 ('87d46c71-9858-4731-9715-06b2ff387fc5','acrobatics','skill','Acrobatics','XPHB','skill','{"page":14,"ability":"dex"}'::jsonb),
 ('9fe003bf-37f4-4432-b864-edab79f32686','arcana','skill','Arcana','XPHB','skill','{"page":14,"ability":"int"}'::jsonb);
INSERT INTO public.items_catalog(id,item_key,item_name,item_type,item_rarity,payload)
VALUES
 ('bd914b52-04de-4cf3-a0ca-0200c9930e06','Alchemist''s Supplies|XPHB',
  'Alchemist''s Supplies','Tools','mundane','{"source":"XPHB","type":"AT|XPHB"}'::jsonb),
 ('dbbec469-010d-4915-907e-f5cd220a9f26','Dice Set|XPHB',
  'Dice Set','Tools','mundane','{"source":"XPHB","type":"GS|XPHB"}'::jsonb);
DO $t14catalog_post$
BEGIN
 IF (SELECT count(*) FROM public.character_option_catalog_preferred
     WHERE option_type='skill' AND id IN
     ('87d46c71-9858-4731-9715-06b2ff387fc5'::uuid,
      '9fe003bf-37f4-4432-b864-edab79f32686'::uuid))<>2
 OR (SELECT count(*) FROM public.items_catalog WHERE id IN
     ('bd914b52-04de-4cf3-a0ca-0200c9930e06'::uuid,
      'dbbec469-010d-4915-907e-f5cd220a9f26'::uuid))<>2
 THEN RAISE EXCEPTION 'C34 T14 original Khoravar reduced source skill/tool catalogs not resolved'; END IF;
END $t14catalog_post$;
\echo 'PASS C34-T14 four original XPHB skill/tool source specimens in T5 preferred-view schema (local only)'
