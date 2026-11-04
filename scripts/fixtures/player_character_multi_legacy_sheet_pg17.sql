-- DNDNext: legacy player snapshot regression from exact live v2 SQL.
-- Disposable PostgreSQL 17 ONLY; simulated request JWT, NOT production.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::integer<170000
 THEN RAISE EXCEPTION 'Requires ephemeral PostgreSQL 17 postgres'; END IF;
END $guard$;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $uid$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $uid$;

CREATE TABLE public.class_catalog (
 id uuid PRIMARY KEY, class_key text, class_name text, source text,
 ruleset text, updated_at timestamptz DEFAULT now(), hit_die integer,
 spellcasting_ability text
);
CREATE TABLE public.class_level_progression (
 class_id uuid, class_level integer, xp_threshold bigint,
 proficiency_bonus integer, spell_slots jsonb
);
CREATE TABLE public.npc_portrait_library (
 id uuid PRIMARY KEY, is_active boolean, storage_path text, public_url text
);
CREATE TABLE public.npc_visual_assets (
 id uuid PRIMARY KEY, is_active boolean, portrait_library_id uuid,
 sprite_path text, default_scale double precision
);
CREATE TABLE public.spells_catalog (
 id uuid PRIMARY KEY, name text, level integer, classes text[]
);
CREATE TABLE public.characters (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 race text, role text, description text, motivation text, quirk text,
 mannerism text, voice text, secret text, affiliation text,
 status text, background text, tags text[], kind text,
 storefront_enabled boolean, portrait_library_id uuid, visual_asset_id uuid,
 creation_request_id uuid UNIQUE,
 portrait_url text, portrait_storage_path text, portrait_thumb_url text,
 portrait_shop_url text, portrait_source text, image_url text,
 sprite_key text, sprite_path text, sprite_scale double precision,
 location_id uuid, last_known_location_id uuid, home_location_id uuid,
 is_hidden boolean, state text, updated_at timestamptz
);
CREATE TABLE public.character_sheets (
 character_id uuid PRIMARY KEY REFERENCES public.characters(id),
 sheet jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.character_permissions (
 character_id uuid NOT NULL REFERENCES public.characters(id),
 user_id uuid NOT NULL, can_inventory boolean NOT NULL,
 can_edit boolean NOT NULL, can_convert boolean NOT NULL,
 created_at timestamptz DEFAULT now(), PRIMARY KEY(character_id,user_id)
);
CREATE TABLE public.character_progression (
 character_id uuid PRIMARY KEY REFERENCES public.characters(id),
 class_id uuid NOT NULL, class_level integer, experience_points bigint,
 pending_level_up boolean, created_by uuid, updated_at timestamptz
);
CREATE TABLE public.character_level_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES public.characters(id),
 event_type text NOT NULL, from_level integer, to_level integer,
 xp_before bigint, xp_after bigint, details jsonb NOT NULL,
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.character_spells (
 character_id uuid NOT NULL, spell_id uuid NOT NULL,
 source_type text, source_label text, prepared boolean,
 always_available boolean, casting_stat text, raw_payload jsonb
);
CREATE TABLE public.players (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid UNIQUE, name text NOT NULL,
 sheet jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.class_catalog (
 id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability
) VALUES (
 '00000000-0000-0000-0000-000000000001',
 'fighter','Fighter','XPHB','2024',10,NULL
);
INSERT INTO public.class_level_progression (
 class_id,class_level,xp_threshold,proficiency_bonus,spell_slots
) VALUES (
 '00000000-0000-0000-0000-000000000001',1,0,2,'{}'::jsonb
);

-- Install exact source extracted from the current live DB via a SELECT-only
-- pg_get_functiondef call, then document the original bad behavior first.
\i scripts/fixtures/player_character_v2_live_source_pg17.sql
DO $original$
DECLARE
  v_user uuid := '00000000-0000-0000-0000-000000000110';
  v_first uuid; v_alt uuid; v_snapshot text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
  INSERT INTO public.players(user_id,name,sheet)
  VALUES(v_user,'Account Display','{}'::jsonb);
  v_first:=public.create_player_character_v2(
   '{"creation_request_id":"00000000-0000-0000-0000-000000001110",
      "name":"Baseline Fighter One","sheet":{"classKey":"fighter",
      "level":1,"marker":"baseline-primary"}}'::jsonb,
   '[]'::jsonb
  );
  v_alt:=public.create_player_character_v2(
   '{"creation_request_id":"00000000-0000-0000-0000-000000001111",
      "name":"Baseline Fighter Two","sheet":{"classKey":"fighter",
      "level":1,"marker":"baseline-alternate"}}'::jsonb,
   '[]'::jsonb
  );
  SELECT sheet->>'marker' INTO v_snapshot FROM public.players WHERE user_id=v_user;
  IF v_first=v_alt OR v_snapshot IS DISTINCT FROM 'baseline-alternate'
  THEN RAISE EXCEPTION 'Original source overwrite not reproduced; got %',v_snapshot; END IF;
  IF (SELECT count(*) FROM public.character_permissions WHERE user_id=v_user AND can_edit)=2
  THEN NULL; ELSE RAISE EXCEPTION 'Original canonical grants unexpectedly missing'; END IF;
END $original$;
\echo 'PASS M01 [EXPECTED UNSAFE]: source original overwrites legacy primary player snapshot on alternate creation'

-- Isolated candidate changes ONLY conflict-update eligibility for
-- nonempty, existing account-wide legacy snapshot. Everything else remains
-- the captured source. MD5 guard prevents applying over unreviewed drift.
\i sql/candidates/20261104_player_forge_preserve_legacy_sheet.sql
DO $fixed$
DECLARE
  v_user uuid := '00000000-0000-0000-0000-000000000120';
  v_existing uuid := '00000000-0000-0000-0000-000000000121';
  v_new uuid := '00000000-0000-0000-0000-000000000122';
  v_primary uuid; v_alt uuid; v_duplicate uuid;
  v_snapshot jsonb; v_account_name text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
  INSERT INTO public.players(user_id,name,sheet)
  VALUES(v_user,'Preserved Display Name','{}'::jsonb);
  v_primary:=public.create_player_character_v2(
   '{"creation_request_id":"00000000-0000-0000-0000-000000001120",
      "name":"Candidate Fighter One","sheet":{"classKey":"fighter",
      "level":1,"marker":"primary"}}'::jsonb,
   '[]'::jsonb
  );
  SELECT sheet,name INTO v_snapshot,v_account_name
    FROM public.players WHERE user_id=v_user;
  IF v_snapshot->>'marker' IS DISTINCT FROM 'primary'
     OR v_account_name IS DISTINCT FROM 'Preserved Display Name'
  THEN RAISE EXCEPTION 'Initial blank legacy snapshot must be seeded once'; END IF;

  v_alt:=public.create_player_character_v2(
   '{"creation_request_id":"00000000-0000-0000-0000-000000001121",
      "name":"Candidate Fighter Two","sheet":{"classKey":"fighter",
      "level":1,"marker":"alternate"}}'::jsonb,
   '[]'::jsonb
  );
  SELECT sheet INTO v_snapshot FROM public.players WHERE user_id=v_user;
  IF v_snapshot->>'marker' IS DISTINCT FROM 'primary'
  THEN RAISE EXCEPTION 'Alternate overwrote a populated legacy snapshot'; END IF;
  IF v_alt IS NOT DISTINCT FROM v_primary THEN
    RAISE EXCEPTION 'Alternate did not get an independent character ID'; END IF;
  IF (SELECT count(*) FROM public.characters c
      JOIN public.character_permissions cp ON cp.character_id=c.id
      WHERE cp.user_id=v_user AND cp.can_edit AND 'player-character'=ANY(c.tags))<>2
  THEN RAISE EXCEPTION 'Second creation damaged canonical permissions'; END IF;
  IF (SELECT count(*) FROM public.character_sheets cs
      WHERE cs.character_id IN(v_primary,v_alt)
        AND cs.sheet->>'marker' IN('primary','alternate'))<>2
  THEN RAISE EXCEPTION 'Separate canonical sheets were not preserved'; END IF;
  IF (SELECT count(*) FROM public.character_level_events
      WHERE character_id IN(v_primary,v_alt)
        AND event_type='player_character_created')<>2
  THEN RAISE EXCEPTION 'Expected one creation event per canonical character'; END IF;

  v_duplicate:=public.create_player_character_v2(
   '{"creation_request_id":"00000000-0000-0000-0000-000000001121",
      "name":"Candidate Fighter Two","sheet":{"classKey":"fighter",
      "level":1,"marker":"alternate"}}'::jsonb,'[]'::jsonb
  );
  IF v_duplicate IS DISTINCT FROM v_alt OR
    (SELECT count(*) FROM public.character_level_events
      WHERE character_id=v_alt AND event_type='player_character_created')<>1
  THEN RAISE EXCEPTION 'Idempotent duplicate creation produced extra event'; END IF;

  -- A populated older legacy sheet remains unchanged, even if no tagged
  -- canonical player character existed before this creation.
  PERFORM set_config('request.jwt.claim.sub',v_existing::text,true);
  INSERT INTO public.players(user_id,name,sheet)
  VALUES(v_existing,'Older Saved Account','{"marker":"legacy-original","custom":"preserve"}');
  PERFORM public.create_player_character_v2(
   '{"creation_request_id":"00000000-0000-0000-0000-000000001122",
      "name":"Existing Sheet Alternate","sheet":{"classKey":"fighter",
      "level":1,"marker":"new"}}'::jsonb,'[]'::jsonb
  );
  SELECT sheet INTO v_snapshot FROM public.players WHERE user_id=v_existing;
  IF v_snapshot->>'marker' IS DISTINCT FROM 'legacy-original'
     OR v_snapshot->>'custom' IS DISTINCT FROM 'preserve'
  THEN RAISE EXCEPTION 'Existing populated legacy sheet was overwritten'; END IF;

  -- An account WITHOUT a legacy row still gets initialized exactly once.
  PERFORM set_config('request.jwt.claim.sub',v_new::text,true);
  PERFORM public.create_player_character_v2(
   '{"creation_request_id":"00000000-0000-0000-0000-000000001123",
      "name":"No Legacy Row First","sheet":{"classKey":"fighter",
      "level":1,"marker":"auto-created"}}'::jsonb,'[]'::jsonb
  );
  IF (SELECT sheet->>'marker' FROM public.players WHERE user_id=v_new)
     IS DISTINCT FROM 'auto-created'
  THEN RAISE EXCEPTION 'Missing initial legacy row was not initialized'; END IF;
  PERFORM public.create_player_character_v2(
   '{"creation_request_id":"00000000-0000-0000-0000-000000001124",
      "name":"No Legacy Row Alt","sheet":{"classKey":"fighter",
      "level":1,"marker":"should-not-replace"}}'::jsonb,'[]'::jsonb
  );
  IF (SELECT sheet->>'marker' FROM public.players WHERE user_id=v_new)
     IS DISTINCT FROM 'auto-created'
  THEN RAISE EXCEPTION 'Auto-created legacy row replaced on alternate'; END IF;
END $fixed$;
\echo 'PASS M02–M06: blank seed, alternate preservation, independent canonical grants/sheets, retry identity, nonempty legacy preservation, first-time row insertion'
