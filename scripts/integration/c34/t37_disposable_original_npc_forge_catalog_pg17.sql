-- T37-P2 ONLY: disposable source-shaped portrait and preferred catalog discovery.
-- NOT a production schema migration and NOT a shortcut around original Forge/RPC.
-- Run only AFTER all original T1-T35 tests and T36 scoped ACL baseline pass.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='40s';
DO $t37_scope$
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regprocedure('public.create_character_v1(jsonb)') IS NULL
  OR md5(pg_get_functiondef('public.create_character_v1(jsonb)'::regprocedure)) <> 'b58311c817d8648ef75ae35b66d831c5'
  OR to_regprocedure('public.c34_npc_narrative_save_research_v1(uuid,jsonb)') IS NULL
  OR to_regprocedure('public.c34_game_manager_capabilities_research_v1()') IS NULL
  OR to_regclass('public.npc_portrait_library') IS NULL
  OR to_regclass('public.npc_visual_assets') IS NULL
  OR to_regclass('public.class_catalog') IS NULL
  OR to_regclass('public.character_option_catalog_preferred') IS NOT NULL
  OR to_regclass('public.class_catalog_preferred') IS NOT NULL
  -- Original signed T1..T35 and T29 merchant tests ALREADY install
  -- public.items_catalog, including original populated inventory records.
  -- Reuse it read-only; never recreate or truncate the prior source fixture.
  OR to_regclass('public.items_catalog') IS NULL
  OR (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='items_catalog'
        AND column_name IN ('item_name','item_key','item_type','item_rarity','payload'))<>5
  OR to_regclass('public.portrait_sprite_suggestions') IS NOT NULL
  -- Prior signed ORIGINAL Forge fixtures already add these actual schema
  -- fields: portrait name/sort_order (J133) and asset overworld_scale
  -- (C33 sprite guard). Never add them twice or mask source drift.
  OR (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='npc_portrait_library'
        AND ((column_name='name' AND data_type='text')
          OR (column_name='sort_order' AND data_type='integer')))<>2
  OR NOT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='npc_visual_assets'
      AND column_name='overworld_scale' AND data_type='numeric')
  -- The original source-owned Forge setup ALREADY adds these eight sprite
  -- format columns; verify them instead of attempting duplicate ALTERs.
  OR (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='npc_visual_assets'
        AND ((column_name IN ('sprite_bucket','sprite_format') AND data_type='text')
          OR (column_name IN ('frame_width','frame_height','idle_frame','fps') AND data_type='integer')
          OR (column_name='direction_order' AND udt_name='_text')
          OR (column_name='walk_frames' AND udt_name='_int4')))<>8
  OR has_column_privilege('authenticated','public.characters','background','SELECT')
 THEN RAISE EXCEPTION 'T37 REFUSE: must be disposable original signed PG17 + intact T36 Stage2 ACL'; END IF;
END;
$t37_scope$;
-- Original NPC/Player Forge already defines static-fallback SPECIES and
-- BACKGROUND data. Serve the real source-owned class_catalog rows through an
-- explicit invoker-view, with empty preferred options so ORIGINAL fallbacks run.
-- The signed test must NOT claim complete hosted preferred catalogs.
CREATE VIEW public.class_catalog_preferred WITH (security_invoker=true) AS
 SELECT id,class_key,class_name,source,ruleset,'2024'::text AS edition,
        hit_die,NULL::text[] AS primary_abilities,
        NULL::text[] AS saving_throws,spellcasting_ability,
        NULL::text AS caster_progression,''::text AS summary,
        '{}'::jsonb AS raw_payload
 FROM public.class_catalog;
CREATE VIEW public.character_option_catalog_preferred WITH (security_invoker=true) AS
 SELECT NULL::uuid AS id,NULL::text AS option_key,NULL::text AS option_type,
        NULL::text AS name,NULL::text AS source,NULL::text AS category,
        NULL::text AS description,NULL::text AS prerequisite_text,
        NULL::text[] AS tags,NULL::jsonb AS metadata,NULL::jsonb AS raw_payload
 WHERE false;
-- Original T29 merchant and original Forge fixtures already created/seeded
-- public.items_catalog. The existing source rows are not touched.
-- Restore source-shaped public-library metadata only in this scratch DB.
-- Original create_character_v1 still verifies active portrait id on server.
-- name and sort_order are already present from the signed original portrait
-- trigger fixture. Add only this picker-specific local read projection.
ALTER TABLE public.npc_portrait_library
 ADD COLUMN bucket text DEFAULT 'npc-portraits',
 ADD COLUMN category text DEFAULT 'npc',
 ADD COLUMN tags text[] DEFAULT '{}'::text[],
 ADD COLUMN species_tags text[] DEFAULT '{}'::text[],
 ADD COLUMN profession_tags text[] DEFAULT '{}'::text[],
 ADD COLUMN theme_tags text[] DEFAULT '{}'::text[],
 ADD COLUMN width integer,
 ADD COLUMN height integer,
 ADD COLUMN aspect_ratio text,
 ADD COLUMN recommended_use text;
INSERT INTO public.npc_portrait_library
 (id,is_active,storage_path,public_url,name,bucket,category,tags,
  species_tags,profession_tags,theme_tags,width,height,aspect_ratio,
  recommended_use,sort_order)
 VALUES
 ('00000000-0000-0000-0000-000000000370',true,'synthetic/t37_forgetest.png',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
  'T37 Synthetic Forge Portrait','npc-portraits','character',ARRAY['npc'],
  ARRAY['orc'],ARRAY['ranger'],ARRAY['test'],1,1,'3:4','npc',1);
-- Previous original sprite-guard research already added overworld_scale.
-- The ORIGINAL NpcForgePortraitPickerModal SELECT requires the full read
-- shape below, even when the synthetic asset list itself is empty. These
-- columns are scratch metadata, NOT new production capabilities.
ALTER TABLE public.npc_visual_assets
 ADD COLUMN name text,
 ADD COLUMN tactical_scale numeric,
 ADD COLUMN species_tags text[] DEFAULT '{}'::text[],
 ADD COLUMN role_tags text[] DEFAULT '{}'::text[],
 ADD COLUMN theme_tags text[] DEFAULT '{}'::text[],
 ADD COLUMN is_default boolean DEFAULT false,
 ADD COLUMN notes text;
CREATE TABLE public.portrait_sprite_suggestions(
 portrait_library_id uuid,visual_asset_id uuid,suggestion_rank integer,is_primary boolean
);
GRANT SELECT ON public.class_catalog,public.class_catalog_preferred,
 public.character_option_catalog_preferred,public.items_catalog,
 public.npc_portrait_library,public.npc_visual_assets,
 public.portrait_sprite_suggestions TO authenticated;
DO $t37_post$
BEGIN
 IF md5(pg_get_functiondef('public.create_character_v1(jsonb)'::regprocedure)) <> 'b58311c817d8648ef75ae35b66d831c5'
 OR has_column_privilege('authenticated','public.characters','background','SELECT')
 OR (SELECT count(*) FROM public.npc_portrait_library WHERE id='00000000-0000-0000-0000-000000000370' AND is_active)<>1
 THEN RAISE EXCEPTION 'T37 scratch catalog introduced original source or privacy drift'; END IF;
END;
$t37_post$;
COMMIT;
NOTIFY pgrst,'reload schema';
\echo 'PASS T37-P2-LOCAL-CATALOG: original portrait and class source, original static fallback, unchanged Forge function + Stage2 ACL'
