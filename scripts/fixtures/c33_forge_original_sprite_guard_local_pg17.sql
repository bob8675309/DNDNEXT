-- One of the 14 original creation-adjacent triggers not yet staged in
-- the historical 17/31 original Forge suite. SOURCE-EXACT read-only live
-- DnDWeb PG17.4 (2026-11-07), MD5 7f9bda0599640617039a841b35e5d5a6.
-- Disposable combined Forge/privacy test only; NOT production migration.
\set ON_ERROR_STOP on

DO $preflight$
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR to_regclass('public.characters') IS NULL
    OR to_regclass('public.npc_visual_assets') IS NULL
    OR to_regprocedure('private.guard_character_visual_asset_sprite_v1()') IS NOT NULL
 THEN RAISE EXCEPTION 'Guard sprite trigger may only be installed on disposable source-authentic C3.3 PG17';
 END IF;
END $preflight$;

-- The source-original handler accesses v_asset.overworld_scale, which the
-- minimal historical Forge auth fixture omitted; this is a column on live DB.
ALTER TABLE public.npc_visual_assets
  ADD COLUMN overworld_scale numeric;

-- Exact PG17 pg_get_functiondef body:
CREATE OR REPLACE FUNCTION private.guard_character_visual_asset_sprite_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_asset public.npc_visual_assets%rowtype;
begin
  if new.visual_asset_id is null then
    return new;
  end if;

  select * into v_asset
  from public.npc_visual_assets
  where id = new.visual_asset_id
    and is_active;

  if not found then
    raise exception 'Selected sprite asset is not active or was not found';
  end if;

  if v_asset.sprite_format <> 'eight_direction_idle_walk_v1'
     or v_asset.sprite_bucket <> 'map-icons'
     or v_asset.frame_width <> 64
     or v_asset.frame_height <> 64
     or v_asset.direction_order <> array['down','down-left','left','up-left','up','up-right','right','down-right']::text[]
     or v_asset.idle_frame <> 0
     or v_asset.walk_frames <> array[1,2,3]::integer[]
     or v_asset.fps <> 7 then
    raise exception 'Selected sprite asset does not satisfy the DNDNext 8-direction runtime contract';
  end if;

  new.sprite_key := v_asset.id::text;
  new.sprite_path := v_asset.sprite_path;
  new.sprite_scale := coalesce(v_asset.overworld_scale::double precision, v_asset.default_scale::double precision, 0.35);
  return new;
end;
$function$;

CREATE TRIGGER guard_character_visual_asset_sprite_v1
BEFORE INSERT OR UPDATE OF visual_asset_id ON public.characters
FOR EACH ROW EXECUTE FUNCTION private.guard_character_visual_asset_sprite_v1();

DO $source_guard$
DECLARE
 v_trig text;
BEGIN
 IF md5(pg_get_functiondef('private.guard_character_visual_asset_sprite_v1()'::regprocedure))
     <> '7f9bda0599640617039a841b35e5d5a6'
 THEN RAISE EXCEPTION 'Original visual asset sprite guard MD5 drift'; END IF;
 SELECT pg_get_triggerdef(oid,true) INTO v_trig
 FROM pg_trigger
 WHERE tgrelid='public.characters'::regclass
   AND tgname='guard_character_visual_asset_sprite_v1'
   AND NOT tgisinternal;
 IF v_trig IS NULL
    OR v_trig NOT LIKE '%BEFORE INSERT OR UPDATE OF visual_asset_id%'
 THEN RAISE EXCEPTION 'Original visual sprite trigger timing/source drift: %',v_trig; END IF;
END $source_guard$;

-- Synthetic ACTIVE source-looking portrait + valid/invalid assets used ONLY
-- by source-original Admin NPC and original v2 player RPC test branches.
INSERT INTO public.npc_portrait_library(id,is_active,storage_path,public_url)
VALUES ('00000000-0000-0000-0000-000000007420',true,
        'c33/test-portrait.png','https://example.invalid/c33/test-portrait.png');
INSERT INTO public.npc_visual_assets(
 id,is_active,portrait_library_id,sprite_path,default_scale,overworld_scale,
 sprite_bucket,sprite_format,frame_width,frame_height,
 direction_order,idle_frame,walk_frames,fps
) VALUES
('00000000-0000-0000-0000-000000007421',true,
 '00000000-0000-0000-0000-000000007420','c33/valid-8dir.png',0.35,0.42,
 'map-icons','eight_direction_idle_walk_v1',64,64,
 ARRAY['down','down-left','left','up-left','up','up-right','right','down-right'],0,
 ARRAY[1,2,3],7),
('00000000-0000-0000-0000-000000007422',true,
 '00000000-0000-0000-0000-000000007420','c33/invalid-8dir.png',0.35,0.42,
 'map-icons','eight_direction_idle_walk_v1',32,64,
 ARRAY['down','down-left','left','up-left','up','up-right','right','down-right'],0,
 ARRAY[1,2,3],7);
\echo 'PASS C3V00: original source-exact visual asset guard, trigger timing, synthetic active and invalid sprite contracts'
