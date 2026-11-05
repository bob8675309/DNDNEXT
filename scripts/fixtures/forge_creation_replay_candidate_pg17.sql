-- DNDNext source-authentic Forge v2/v3 and NPC replay regression, held-only.
-- Disposable PostgreSQL 17 ONLY. Simulated auth.uid; NOT real GoTrue yet.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::integer<170000
 THEN RAISE EXCEPTION 'Requires ephemeral PostgreSQL 17 postgres'; END IF;
END $guard$;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
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


-- Minimal scratch support tables; no real auth, inventory, 19 progression
-- triggers, source catalogues or live RLS are represented by this fixture.
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-0000-0000-000000000110'),
 ('00000000-0000-0000-0000-000000000111'),
 ('00000000-0000-0000-0000-000000000112');
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
AS $role$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated') $role$;
CREATE TABLE private.test_admins(id uuid PRIMARY KEY);
INSERT INTO private.test_admins(id) VALUES('00000000-0000-0000-0000-000000000112');
CREATE FUNCTION private.current_user_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $f$ SELECT EXISTS (SELECT 1 FROM private.test_admins WHERE id=auth.uid()) $f$;
ALTER TABLE public.spells_catalog ADD COLUMN source text DEFAULT 'XPHB';
ALTER TABLE public.character_spells
 ADD COLUMN source_key text NOT NULL DEFAULT 'class',
 ADD COLUMN known boolean NOT NULL DEFAULT true,
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX character_spells_source_unique
 ON public.character_spells(character_id,spell_id,source_type,source_key);
ALTER TABLE public.characters ADD COLUMN storefront_title text;
ALTER TABLE public.characters ADD COLUMN storefront_tagline text;
ALTER TABLE public.characters ADD COLUMN portrait_prompt text;
ALTER TABLE public.characters ALTER COLUMN location_id TYPE bigint USING null::bigint;
ALTER TABLE public.characters ALTER COLUMN last_known_location_id TYPE bigint USING null::bigint;
ALTER TABLE public.characters ALTER COLUMN home_location_id TYPE bigint USING null::bigint;
ALTER TABLE public.npc_visual_assets ADD COLUMN sprite_bucket text;
ALTER TABLE public.npc_visual_assets ADD COLUMN sprite_format text;
ALTER TABLE public.npc_visual_assets ADD COLUMN frame_width int;
ALTER TABLE public.npc_visual_assets ADD COLUMN frame_height int;
ALTER TABLE public.npc_visual_assets ADD COLUMN direction_order text[];
ALTER TABLE public.npc_visual_assets ADD COLUMN idle_frame int;
ALTER TABLE public.npc_visual_assets ADD COLUMN walk_frames int[];
ALTER TABLE public.npc_visual_assets ADD COLUMN fps int;
CREATE TABLE public.locations(id bigint PRIMARY KEY,npcs jsonb NOT NULL DEFAULT '[]'::jsonb);
CREATE FUNCTION private.location_roster_character_id_v1(p_entry jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT p_entry->>'id' $f$;
CREATE FUNCTION public.is_preferred_spell_version_v1(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE
AS $f$ SELECT EXISTS(SELECT 1 FROM public.spells_catalog WHERE id=p_id) $f$;
INSERT INTO public.class_catalog
(id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability)
VALUES('00000000-0000-0000-0000-000000000002','wizard','Wizard','XPHB','2024',6,'int');
INSERT INTO public.class_level_progression
(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots)
VALUES('00000000-0000-0000-0000-000000000002',1,0,2,'{"1":2}'::jsonb);
INSERT INTO public.spells_catalog(id,name,level,classes,source) VALUES
 ('00000000-0000-0000-0000-000000000901','Fire Bolt',0,ARRAY['Wizard'],'XPHB'),
 ('00000000-0000-0000-0000-000000000902','Ray of Frost',0,ARRAY['Wizard'],'XPHB');
\i scripts/fixtures/forge_creator_trigger_original_stage3_pg17.sql
\i scripts/fixtures/forge_creation_original_functions_pg17.sql

-- FCR-B00: prove the original unguarded v3 altered-nonce replay first.
DO $baseline$
DECLARE
 v_payload jsonb := '{"creation_request_id":"00000000-0000-0000-0000-000000009100","name":"Original Replay Wizard","sheet":{"classKey":"wizard","level":1}}';
 v_a jsonb := '[{"spell_id":"00000000-0000-0000-0000-000000000901","source_type":"class","access_type":"class-list"}]';
 v_b jsonb := '[{"spell_id":"00000000-0000-0000-0000-000000000902","source_type":"class","access_type":"class-list"}]';
 v_id uuid;v_same uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000110',true);
 v_id:=public.create_player_character_v3(v_payload,'[]'::jsonb,v_a);
 v_same:=public.create_player_character_v3(v_payload,'[]'::jsonb,v_b);
 IF v_id IS DISTINCT FROM v_same THEN RAISE EXCEPTION 'Baseline replay ID changed'; END IF;
 IF (SELECT count(*) FROM public.character_spells WHERE character_id=v_id
     AND raw_payload->>'creator'='shared_character_forge_player_v3')<>2
 THEN RAISE EXCEPTION 'Failed to reproduce baseline changed-nonce spell addition'; END IF;
 IF (SELECT count(*) FROM public.character_level_events WHERE character_id=v_id)<>1
 THEN RAISE EXCEPTION 'Baseline creation event duplicated'; END IF;
END;
$baseline$;
\echo 'PASS FCR-B00 EXPECTED UNSAFE: original public v3 changes spell assignments on same-ID altered-magic retry'
\i sql/candidates/20261105_player_creation_immutable_intent_v1.sql

-- FCR-01 v2 identical replay is inert; changed payload and choice rejected.
DO $test$
DECLARE
 p jsonb := '{"creation_request_id":"00000000-0000-0000-0000-000000009101","name":"Guarded Fighter","sheet":{"classKey":"fighter","level":1,"creator_user_id":"00000000-0000-0000-0000-000000000111"}}';
 i uuid;j uuid;before_count int;before_date timestamptz;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000110',true);
 i:=public.create_player_character_v2(p,'[]'::jsonb);
 SELECT count(*) INTO before_count FROM public.character_level_events WHERE character_id=i;
 SELECT updated_at INTO before_date FROM public.character_sheets WHERE character_id=i;
 j:=public.create_player_character_v2(p,'[]'::jsonb);
 IF i IS DISTINCT FROM j OR (SELECT count(*) FROM public.character_level_events WHERE character_id=i)<>before_count
    OR (SELECT updated_at FROM public.character_sheets WHERE character_id=i) IS DISTINCT FROM before_date
 THEN RAISE EXCEPTION 'Identical v2 replay had side effects'; END IF;
 BEGIN
   PERFORM public.create_player_character_v2(jsonb_set(p,'{name}','"Different Fighter"'::jsonb),'[]'::jsonb);
   RAISE EXCEPTION 'Changed v2 payload accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
   PERFORM public.create_player_character_v2(p,'[{"spell_id":"00000000-0000-0000-0000-000000000901"}]'::jsonb);
   RAISE EXCEPTION 'Changed v2 spell array accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 IF (SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id=i)
     IS DISTINCT FROM '00000000-0000-0000-0000-000000000110'::uuid
 THEN RAISE EXCEPTION 'Creator attribution used untrusted payload'; END IF;
 IF (SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE character_id=i
     AND octet_length(intent_sha256)=32)<>1
 THEN RAISE EXCEPTION 'Canonical digest reservation missing'; END IF;
END $test$;
\echo 'PASS FCR-01: exact v2 replay inert; changed name/spell choices rejected; creator bound to auth.uid'
-- FCR-02 v3 original nested v2 + source spell grants, no write on retry.
DO $test$
DECLARE
 p jsonb := '{"creation_request_id":"00000000-0000-0000-0000-000000009102","name":"Guarded Wizard","sheet":{"classKey":"wizard","level":1}}';
 a jsonb := '[{"spell_id":"00000000-0000-0000-0000-000000000901","source_type":"class","access_type":"class-list"}]';
 b jsonb := '[{"spell_id":"00000000-0000-0000-0000-000000000902","source_type":"class","access_type":"class-list"}]';
 i uuid;again uuid;before_spells jsonb;after_spells jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000110',true);
 i:=public.create_player_character_v3(p,'[]'::jsonb,a);
 SELECT jsonb_agg(to_jsonb(s) ORDER BY spell_id,source_type,source_key)
 INTO before_spells FROM public.character_spells s WHERE s.character_id=i;
 again:=public.create_player_character_v3(p,'[]'::jsonb,a);
 SELECT jsonb_agg(to_jsonb(s) ORDER BY spell_id,source_type,source_key)
 INTO after_spells FROM public.character_spells s WHERE s.character_id=i;
 IF i IS DISTINCT FROM again OR before_spells IS DISTINCT FROM after_spells
 THEN RAISE EXCEPTION 'Identical v3 replay touched spell rows'; END IF;
 BEGIN
   PERFORM public.create_player_character_v3(p,'[]'::jsonb,b);
   RAISE EXCEPTION 'Changed v3 magic accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
   PERFORM public.create_player_character_v3(jsonb_set(p,'{name}','"Changed Wizard"'::jsonb),'[]'::jsonb,a);
   RAISE EXCEPTION 'Changed v3 character accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
   PERFORM public.create_player_character_v2(p,'[]'::jsonb);
   RAISE EXCEPTION 'Cross-API v2 accepted the v3 nonce';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 IF (SELECT count(*) FROM public.character_spells WHERE character_id=i)<>1
    OR (SELECT count(*) FROM public.character_level_events WHERE character_id=i)<>1
 THEN RAISE EXCEPTION 'Rejected retry added spells/events'; END IF;
END $test$;
\echo 'PASS FCR-02: source-exact v3 nested v2 grants, exact retry no spells update, altered spell/character/API denied'

-- FCR-03/04 role, revoked grant, historical nonce and rollback.
DO $test$
DECLARE
 p jsonb := '{"creation_request_id":"00000000-0000-0000-0000-000000009102","name":"Guarded Wizard","sheet":{"classKey":"wizard","level":1}}';
 a jsonb := '[{"spell_id":"00000000-0000-0000-0000-000000000901","source_type":"class","access_type":"class-list"}]';
BEGIN
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000111',true);
 BEGIN
   PERFORM public.create_player_character_v3(p,'[]'::jsonb,a);
   RAISE EXCEPTION 'Other player stole replay nonce';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000110',true);
 BEGIN
   PERFORM public.create_player_character_v3(
     '{"creation_request_id":"00000000-0000-0000-0000-000000009100","name":"Original Replay Wizard","sheet":{"classKey":"wizard","level":1}}',
     '[]'::jsonb,a);
   RAISE EXCEPTION 'Legacy unverified nonce incorrectly accepted';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 BEGIN
   PERFORM public.create_player_character_v2(
     '{"creation_request_id":"00000000-0000-0000-0000-000000009103","name":"Invalid Fighter","sheet":{"classKey":"not-a-class","level":1}}','[]'::jsonb);
   RAISE EXCEPTION 'Invalid class was accepted';
 EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL; END;
 IF EXISTS(SELECT 1 FROM private.player_creation_intent_reservations_v1
            WHERE request_id='00000000-0000-0000-0000-000000009103')
    OR EXISTS(SELECT 1 FROM public.characters WHERE name='Invalid Fighter')
 THEN RAISE EXCEPTION 'Failed creation leaked character or reservation'; END IF;
 UPDATE public.character_permissions SET can_edit=false
 WHERE character_id=(SELECT id FROM public.characters WHERE name='Guarded Wizard')
   AND user_id='00000000-0000-0000-0000-000000000110';
 BEGIN
   PERFORM public.create_player_character_v3(p,'[]'::jsonb,a);
   RAISE EXCEPTION 'Revoked creator re-read cached creation';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END $test$;
\echo 'PASS FCR-03: other JWT identity denied, legacy missing intent fail-closed, bad class rollback, revoked editor denied'
-- FCR-04 legacy Admin NPC creation unchanged, creator captured at INSERT.
DO $test$
DECLARE
 p jsonb := '{"creation_request_id":"00000000-0000-0000-0000-000000009104","name":"Original Admin NPC","kind":"npc","sheet":{"note":"npc"},"creator_user_id":"00000000-0000-0000-0000-000000000111"}';
 i uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000112',true);
 i:=public.create_character_v1(p);
 IF (SELECT creator_user_id FROM private.character_creator_attribution WHERE character_id=i)
 IS DISTINCT FROM '00000000-0000-0000-0000-000000000112'::uuid
 THEN RAISE EXCEPTION 'Exact original NPC creation missed creator trigger'; END IF;
 IF (SELECT count(*) FROM public.character_sheets WHERE character_id=i)<>1
    OR EXISTS(SELECT 1 FROM public.character_level_events WHERE character_id=i)
 THEN RAISE EXCEPTION 'Admin NPC created unexpected player event/grant'; END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000111',true);
 BEGIN
   PERFORM public.create_character_v1(jsonb_set(p,'{name}','"Intruder"'::jsonb));
   RAISE EXCEPTION 'Non-Admin created NPC';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END $test$;
\echo 'PASS FCR-04: original Admin create executes creator trigger without player-event or unauthorized create'

-- FCR-05 compose held #319 legacy-snapshot rule with immutable nonce.
-- Owner 111 is distinct from the first testcase's owner 110; a new canonical
-- primary creates account snapshot and an alternate must preserve it.
DO $legacy$
DECLARE
 v_first uuid;v_alt uuid;v_same uuid;v_snapshot jsonb;v_name text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000111',true);
 v_first:=public.create_player_character_v2(
  '{"creation_request_id":"00000000-0000-0000-0000-000000009105","name":"Legacy First",
    "sheet":{"classKey":"fighter","level":1,"marker":"canonical-primary"}}','[]'::jsonb);
 SELECT sheet,name INTO v_snapshot,v_name FROM public.players
 WHERE user_id='00000000-0000-0000-0000-000000000111';
 IF v_snapshot->>'marker' IS DISTINCT FROM 'canonical-primary'
    OR v_name IS DISTINCT FROM 'Legacy First'
 THEN RAISE EXCEPTION 'First character must seed empty account-wide snapshot'; END IF;
 v_alt:=public.create_player_character_v2(
  '{"creation_request_id":"00000000-0000-0000-0000-000000009106","name":"Legacy Alternate",
    "sheet":{"classKey":"fighter","level":1,"marker":"canonical-alternate"}}','[]'::jsonb);
 SELECT sheet,name INTO v_snapshot,v_name FROM public.players
 WHERE user_id='00000000-0000-0000-0000-000000000111';
 IF v_snapshot->>'marker' IS DISTINCT FROM 'canonical-primary'
    OR v_name IS DISTINCT FROM 'Legacy First'
 THEN RAISE EXCEPTION 'Alternate overwrote protected legacy player snapshot'; END IF;
 IF v_first=v_alt OR (SELECT count(*) FROM public.character_sheets
    WHERE character_id IN (v_first,v_alt) AND
          sheet->>'marker' IN ('canonical-primary','canonical-alternate'))<>2
 THEN RAISE EXCEPTION 'Alternate did not preserve independent canonical sheets'; END IF;
 v_same:=public.create_player_character_v2(
  '{"creation_request_id":"00000000-0000-0000-0000-000000009106","name":"Legacy Alternate",
    "sheet":{"classKey":"fighter","level":1,"marker":"canonical-alternate"}}','[]'::jsonb);
 IF v_same<>v_alt OR (SELECT count(*) FROM public.character_level_events
   WHERE character_id IN (v_first,v_alt))<>2
 THEN RAISE EXCEPTION 'Alternate identical nonce created duplicate event'; END IF;
 IF (SELECT count(*) FROM public.character_permissions
   WHERE character_id IN (v_first,v_alt) AND user_id='00000000-0000-0000-0000-000000000111'
     AND can_edit AND can_inventory)<>2
 THEN RAISE EXCEPTION 'Alternate corrupted player grants'; END IF;
END;
$legacy$;
\echo 'PASS FCR-05: PR319 composed, first snapshot seed, alternate preservation, separate canonical sheets/grants, inert nonce retry'
