-- C3F isolated authentic NewNpcModalV3 browser-CI catalog surface.
-- Disposable empty local PostgreSQL 17 and GoTrue fixture ONLY. Not a migration.
-- Run AFTER the already successful C3J/C3I/C3S JWT matrix in the same scratch
-- environment, without rewriting original Forge v2/v3 or stage1-3 SQL.
-- Catalog data are an explicitly REDUCED selection of source-keyed XPHB rows:
-- this is browser pipeline acceptance, NOT a complete rules catalog test.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
   OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
   -- The CLI forwards host 54322 to PostgreSQL's Docker-internal 5432;
   -- PGHOST/PGPORT are verified by the signed workflow and Node runner.
   OR to_regclass('auth.users') IS NULL
   OR to_regclass('public.inventory_items') IS NULL
   OR to_regclass('public.character_backstory_secrets') IS NULL
   OR to_regclass('public.class_catalog_preferred') IS NOT NULL
   OR to_regprocedure('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)') IS NULL
   OR md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))
     <> '6ba73e6f12fcf826cc0a739cce45ff40'
 THEN RAISE EXCEPTION 'C3F browser catalog fixture requires pre-tested ephemeral signed original Forge'; END IF;
END $guard$;

ALTER TABLE public.class_catalog
 ADD COLUMN IF NOT EXISTS edition integer,
 ADD COLUMN IF NOT EXISTS primary_abilities text[],
 ADD COLUMN IF NOT EXISTS saving_throws text[],
 ADD COLUMN IF NOT EXISTS caster_progression text,
 ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.class_level_progression
 ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS cantrips_known integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS spells_known integer NOT NULL DEFAULT 0;
ALTER TABLE public.character_option_catalog
 ADD COLUMN IF NOT EXISTS option_key text,
 ADD COLUMN IF NOT EXISTS category text,
 ADD COLUMN IF NOT EXISTS description text,
 ADD COLUMN IF NOT EXISTS prerequisite_text text,
 ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
 ADD COLUMN IF NOT EXISTS raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.spells_catalog
 ADD COLUMN IF NOT EXISTS spell_key text,
 ADD COLUMN IF NOT EXISTS page integer,
 ADD COLUMN IF NOT EXISTS school text,
 ADD COLUMN IF NOT EXISTS school_code text,
 ADD COLUMN IF NOT EXISTS subclasses text[],
 ADD COLUMN IF NOT EXISTS casting_time text,
 ADD COLUMN IF NOT EXISTS range_text text,
 ADD COLUMN IF NOT EXISTS range_distance numeric,
 ADD COLUMN IF NOT EXISTS range_unit text,
 ADD COLUMN IF NOT EXISTS duration_text text,
 ADD COLUMN IF NOT EXISTS ritual boolean,
 ADD COLUMN IF NOT EXISTS concentration boolean,
 ADD COLUMN IF NOT EXISTS components_v boolean,
 ADD COLUMN IF NOT EXISTS components_s boolean,
 ADD COLUMN IF NOT EXISTS components_m boolean,
 ADD COLUMN IF NOT EXISTS material_text text,
 ADD COLUMN IF NOT EXISTS description text,
 ADD COLUMN IF NOT EXISTS higher_level_text text,
 ADD COLUMN IF NOT EXISTS scaling_text text,
 ADD COLUMN IF NOT EXISTS scaling_json jsonb,
 ADD COLUMN IF NOT EXISTS area_type text,
 ADD COLUMN IF NOT EXISTS area_size numeric,
 ADD COLUMN IF NOT EXISTS area_unit text,
 ADD COLUMN IF NOT EXISTS saving_throw_abilities text[],
 ADD COLUMN IF NOT EXISTS attack_type text,
 ADD COLUMN IF NOT EXISTS damage_dice text,
 ADD COLUMN IF NOT EXISTS damage_types text[],
 ADD COLUMN IF NOT EXISTS healing_dice text,
 ADD COLUMN IF NOT EXISTS tags text[],
 ADD COLUMN IF NOT EXISTS misc_tags text[],
 ADD COLUMN IF NOT EXISTS area_tags text[],
 ADD COLUMN IF NOT EXISTS raw_payload jsonb;
ALTER TABLE public.characters
 ADD COLUMN IF NOT EXISTS storefront_bg_url text,
 ADD COLUMN IF NOT EXISTS storefront_bg_video_url text,
 ADD COLUMN IF NOT EXISTS storefront_bg_image_url text;
-- Public merchant media fields, only granted in disposable fixture.
GRANT SELECT(storefront_bg_url,storefront_bg_video_url,storefront_bg_image_url)
 ON public.characters TO authenticated;
CREATE TABLE public.class_feature_catalog (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 class_key text,class_name text,feature_type text,name text,source text,class_source text,
 subclass_name text,subclass_short_name text,level integer,
 description text,entries jsonb,raw_payload jsonb
);
CREATE TABLE public.class_feature_option_catalog (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 option_key text,option_type text,name text,source text,class_key text,
 feature_types text[],page integer,description text,prerequisites jsonb,
 additional_spells jsonb,repeatable boolean,choice_schema jsonb,metadata jsonb
);
ALTER TABLE public.npc_portrait_library
 ADD COLUMN IF NOT EXISTS name text,
 ADD COLUMN IF NOT EXISTS bucket text,
 ADD COLUMN IF NOT EXISTS category text,
 ADD COLUMN IF NOT EXISTS tags text[],
 ADD COLUMN IF NOT EXISTS species_tags text[],
 ADD COLUMN IF NOT EXISTS profession_tags text[],
 ADD COLUMN IF NOT EXISTS theme_tags text[],
 ADD COLUMN IF NOT EXISTS width integer,
 ADD COLUMN IF NOT EXISTS height integer,
 ADD COLUMN IF NOT EXISTS aspect_ratio numeric,
 ADD COLUMN IF NOT EXISTS recommended_use text,
 ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE public.npc_visual_assets
 ADD COLUMN IF NOT EXISTS name text,
 ADD COLUMN IF NOT EXISTS overworld_scale numeric,
 ADD COLUMN IF NOT EXISTS tactical_scale numeric,
 ADD COLUMN IF NOT EXISTS species_tags text[],
 ADD COLUMN IF NOT EXISTS role_tags text[],
 ADD COLUMN IF NOT EXISTS theme_tags text[],
 ADD COLUMN IF NOT EXISTS is_default boolean,
 ADD COLUMN IF NOT EXISTS notes text;
CREATE TABLE public.portrait_sprite_suggestions (
 portrait_library_id uuid, visual_asset_id uuid,
 suggestion_rank integer, is_primary boolean
);

CREATE OR REPLACE VIEW public.class_catalog_preferred
WITH (security_invoker=true) AS
SELECT DISTINCT ON (class_key) *
FROM public.class_catalog
ORDER BY class_key, CASE WHEN source='XPHB' THEN 0 ELSE 1 END,id;
CREATE OR REPLACE VIEW public.character_option_catalog_preferred
WITH (security_invoker=true) AS
SELECT DISTINCT ON (option_type,lower(name)) *
FROM public.character_option_catalog
ORDER BY option_type,lower(name),CASE WHEN source='XPHB' THEN 0 ELSE 1 END,id;

-- The exact already-approved project migration implementation of this
-- READ-ONLY equipment picker is copied verbatim from
-- sql/20260808_49_player_forge_starting_equipment_currency.sql below.
-- It reads class_catalog.raw_payload, background.metadata and items_catalog.
create or replace function public.get_player_forge_starting_equipment_v1(p_class_id uuid,p_background_id uuid,p_level integer default 1)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_class public.class_catalog%rowtype;
  v_background public.character_option_catalog%rowtype;
  v_class_options jsonb:='[]'::jsonb;
  v_background_options jsonb:='[]'::jsonb;
  v_choice_options jsonb:='{}'::jsonb;
  v_level integer:=greatest(1,least(20,coalesce(p_level,1)));
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  select * into v_class from public.class_catalog where id=p_class_id;
  if found then v_class_options:=coalesce(v_class.raw_payload#>'{startingEquipment,defaultData}','[]'::jsonb); end if;
  select * into v_background from public.character_option_catalog where id=p_background_id and option_type='background';
  if found then v_background_options:=coalesce(v_background.metadata->'equipment','[]'::jsonb); end if;

  select jsonb_build_object(
    'toolArtisan',coalesce(jsonb_agg(jsonb_build_object('itemKey',i.item_key,'name',i.item_name,'source',i.payload->>'source','itemType',i.item_type) order by i.item_name) filter(where coalesce(i.payload->>'type','') like 'AT%' and i.payload->>'source'='XPHB'),'[]'::jsonb),
    'instrumentMusical',coalesce(jsonb_agg(jsonb_build_object('itemKey',i.item_key,'name',i.item_name,'source',i.payload->>'source','itemType',i.item_type) order by i.item_name) filter(where coalesce(i.payload->>'type','') like 'INS%' and i.payload->>'source'='XPHB'),'[]'::jsonb),
    'setGaming',coalesce(jsonb_agg(jsonb_build_object('itemKey',i.item_key,'name',i.item_name,'source',i.payload->>'source','itemType',i.item_type) order by i.item_name) filter(where coalesce(i.payload->>'type','') like 'GS%' and i.payload->>'source'='XPHB'),'[]'::jsonb),
    'focusHoly',coalesce(jsonb_agg(jsonb_build_object('itemKey',i.item_key,'name',i.item_name,'source',i.payload->>'source','itemType',i.item_type) order by i.item_name) filter(where i.payload->>'scfType'='holy' and i.payload->>'source'='XPHB'),'[]'::jsonb),
    'focusDruidic',coalesce(jsonb_agg(jsonb_build_object('itemKey',i.item_key,'name',i.item_name,'source',i.payload->>'source','itemType',i.item_type) order by i.item_name) filter(where i.payload->>'scfType'='druid' and i.payload->>'source'='XPHB'),'[]'::jsonb)
  ) into v_choice_options
  from public.items_catalog i
  where lower(coalesce(i.item_rarity,''))='mundane';

  return jsonb_build_object(
    'catalogReady',true,
    'classId',p_class_id,
    'classKey',coalesce(v_class.class_key,''),
    'className',coalesce(v_class.class_name,''),
    'classSource',coalesce(v_class.source,''),
    'classOptions',v_class_options,
    'backgroundId',p_background_id,
    'backgroundKey',coalesce(v_background.option_key,''),
    'backgroundName',coalesce(v_background.name,''),
    'backgroundSource',coalesce(v_background.source,''),
    'backgroundOptions',v_background_options,
    'choiceOptions',v_choice_options,
    'level',v_level,
    'higherLevelGuide',private.player_forge_higher_level_wealth_v1(v_level,case when v_level>=5 then 1 else null end)-'copper'
  );
end;
$$;

REVOKE ALL ON FUNCTION public.get_player_forge_starting_equipment_v1(uuid,uuid,integer)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_player_forge_starting_equipment_v1(uuid,uuid,integer)
 TO authenticated;

UPDATE public.class_catalog SET
 edition=2024,
 primary_abilities=ARRAY['str','dex'],
 saving_throws=ARRAY['str','con'],
 summary='XPHB Fighter level-one browser fixture; authentic class key/source, reduced rule details.',
 raw_payload='{"startingEquipment":{"defaultData":[]},"startingProficiencies":{"skills":[{"choose":{"from":["athletics","acrobatics","perception","survival"],"count":2}}]}}'::jsonb
WHERE class_key='fighter' AND source='XPHB';
UPDATE public.class_level_progression SET
 features='[]'::jsonb, cantrips_known=0,spells_known=0
WHERE class_id='00000000-0000-0000-0000-000000000001' AND class_level=1;

INSERT INTO public.character_option_catalog
(id,option_key,option_type,name,source,category,description,tags,metadata,raw_payload)
VALUES
('00000000-0000-0000-0000-000000009911','dwarf-xphb','species','Dwarf','XPHB','species',
 'XPHB Dwarf source-keyed Chromium fixture',ARRAY['playable'],
 '{"speed":{"walk":30},"size":["Medium"],"traits":[]}'::jsonb,'{}'::jsonb),
('00000000-0000-0000-0000-000000009912','soldier-xphb','background','Soldier','XPHB','background',
 'XPHB Soldier source-keyed Chromium fixture',ARRAY['origin'],
 '{"abilities":["str","dex","con"],"skills":[{"athletics":true},{"intimidation":true}],"feats":[{"Savage Attacker":true}],"equipment":[]}'::jsonb,
 '{"feats":[{"Savage Attacker":true}],"skillProficiencies":[{"athletics":true},{"intimidation":true}]}'::jsonb),
('00000000-0000-0000-0000-000000009913','savage-attacker-xphb','feat','Savage Attacker','XPHB','origin',
 'XPHB Soldier origin feat fixture',ARRAY['origin'],'{}'::jsonb,'{}'::jsonb);
INSERT INTO public.npc_portrait_library
(id,is_active,name,bucket,storage_path,public_url,category,tags,
 species_tags,profession_tags,theme_tags,width,height,aspect_ratio,
 recommended_use,sort_order)
VALUES(
 '00000000-0000-0000-0000-000000009914',true,'C3F Dwarf Fixture Portrait',
 'npc-portraits','c33/browser/dwarf.png',
 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
 'character',ARRAY['fixture'],ARRAY['dwarf'],ARRAY['fighter'],ARRAY['test'],768,1024,0.75,
 'all',1);

-- Deliberately allow only catalog SELECT on local signed users. The staged
-- characters/character_sheets/private-backstory RLS and ACL are UNCHANGED.
GRANT SELECT ON public.class_catalog,public.class_level_progression,
 public.character_option_catalog,public.items_catalog,public.spells_catalog,
 public.class_feature_catalog,public.class_feature_option_catalog,
 public.npc_portrait_library,public.npc_visual_assets,
 public.portrait_sprite_suggestions TO authenticated;
GRANT SELECT ON public.class_catalog_preferred,
 public.character_option_catalog_preferred TO authenticated;
NOTIFY pgrst,'reload schema';
\echo 'PASS C3F00: original v3 and three-stage privacy untouched; source-keyed reduced browser catalog, actual source equipment getter installed'
