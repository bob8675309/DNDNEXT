-- I1-C RESEARCH CANDIDATE ONLY, NEVER A DEPLOYMENT MIGRATION.
-- Requires original #324 immutable Forge candidate AND #345 Stage1-3 privacy
-- installed together in an EMPTY disposable PostgreSQL 17 + genuine GoTrue DB.
-- Never apply against production without separately approved coordinated release.
--
-- Security model: public Story RPC REMAINS SECURITY INVOKER for actual Story RLS.
-- A narrow private SECURITY DEFINER helper reuses the original #324 reservation
-- and complete routines and its source-original internal Forge v3. The helper
-- computes an ephemeral SHA256 of the canonical private Story, inserts that
-- digest as a reserved property into the IN-MEMORY nonce fingerprint payload,
-- and lets the original reservation store ONLY its final digest. Neither raw
-- Story nor its direct SHA is stored in the nonce ledger or character sheet.
--
-- Direct v3 and Story-v3 have distinct hashes for the same nonce. Original
-- player-v2/v3 code, MD5 gates, equipment/feat triggers and old tests unchanged.
-- Mixed old client paths will fail closed rather than migrate silently.
\set ON_ERROR_STOP on
DO $i1c_guard$
DECLARE v_wrapper text; v_reserve text;
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
    OR to_regclass('private.character_creator_attribution') IS NULL
    OR to_regclass('public.character_backstory_secrets') IS NULL
    OR to_regprocedure('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)') IS NULL
    OR to_regprocedure('private.reserve_player_creation_intent_v1(uuid,text,jsonb,jsonb,jsonb)') IS NULL
    OR to_regprocedure('private.complete_player_creation_intent_v1(uuid,uuid)') IS NULL
    OR to_regprocedure('private.create_player_character_v3_source_20261105(jsonb,jsonb,jsonb)') IS NULL
    OR to_regprocedure('private.can_access_creator_backstory_v1(uuid)') IS NULL
 THEN
   RAISE EXCEPTION 'I1-C requires source-locked disposable original Forge + Stage3 + immutable nonce candidate';
 END IF;
 SELECT pg_get_functiondef('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)'::regprocedure)
 INTO v_wrapper;
 SELECT pg_get_functiondef('private.reserve_player_creation_intent_v1(uuid,text,jsonb,jsonb,jsonb)'::regprocedure)
 INTO v_reserve;
 IF position('public.create_player_character_v3(' in v_wrapper)=0
    OR position('ON CONFLICT (character_id) DO NOTHING' in v_wrapper)=0
    OR position('private.can_access_creator_backstory_v1' in v_wrapper)=0
    OR position('jsonb_build_array(' in v_reserve)=0
    OR position('FOR UPDATE' in v_reserve)=0
 THEN RAISE EXCEPTION 'Original #324/#345 source contract drift: stop I1-C candidate'; END IF;
 IF to_regprocedure('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)') IS NOT NULL THEN
   RAISE EXCEPTION 'I1-C helper already installed; do not replay candidate blindly';
 END IF;
END;
$i1c_guard$;

-- PRIVATE, narrow source-preserving bridge. Only the verified JWT owner may
-- create; original reservation serializes same-nonce calls under row lock.
CREATE FUNCTION private.create_player_character_v3_with_story_intent_i1c(
 p_payload jsonb,
 p_spell_choices jsonb,
 p_magic_selections jsonb,
 p_private_backstory text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $i1c_bridge$
DECLARE
 v_req uuid;
 v_existing uuid;
 v_create boolean;
 v_character uuid;
 v_story text;
 v_story_hash text;
 v_nonce_payload jsonb;
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Signed-in creator required' USING ERRCODE='42501';
 END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN
   RAISE EXCEPTION 'Expected character creation payload object' USING ERRCODE='22023';
 END IF;
 IF NULLIF(btrim(coalesce(p_payload->>'secret','')),'') IS NOT NULL THEN
   RAISE EXCEPTION 'GM Secret cannot be supplied in player Forge payload' USING ERRCODE='42501';
 END IF;
 -- Reserved key can only be derived on the server, never client supplied.
 IF p_payload ? '__dndnext_private_story_intent_sha256_i1c' THEN
   RAISE EXCEPTION 'Reserved private Story nonce field is not a client choice'
     USING ERRCODE='22023';
 END IF;
 IF NULLIF(btrim(coalesce(p_payload->>'creation_request_id','')),'') IS NOT NULL THEN
   BEGIN
     v_req := (p_payload->>'creation_request_id')::uuid;
   EXCEPTION WHEN invalid_text_representation THEN
     RAISE EXCEPTION 'creation_request_id must be a valid UUID' USING ERRCODE='22023';
   END;
 END IF;
 -- Empty/blank Story is consistently an absent Story in this API. Nonempty
 -- content is EXACT original text, including whitespace, for replay identity.
 v_story := CASE WHEN p_private_backstory IS NULL
                   OR btrim(p_private_backstory)=''
                  THEN NULL ELSE p_private_backstory END;
 v_story_hash := encode(sha256(convert_to(
   jsonb_build_array('i1c-creator-private-story-v1',v_story)::text,'UTF8'
 )), 'hex');
 -- This augmented JSONB is used ONLY as a transient input to the unmodified
 -- #324 reservation function. Its digest (not this payload) is persisted.
 v_nonce_payload := p_payload || jsonb_build_object(
   '__dndnext_private_story_intent_sha256_i1c',v_story_hash
 );
 SELECT r.existing_character_id,r.must_create
 INTO v_existing,v_create
 FROM private.reserve_player_creation_intent_v1(
   v_req,'player-v3',v_nonce_payload,p_spell_choices,p_magic_selections
 ) AS r;
 IF NOT v_create THEN RETURN v_existing; END IF;
 -- Same ORIGINAL source function used by #324 public v3, no rematerialization
 -- of gameplay/Forge/feat/grant/merchant logic, original payload unchanged.
 v_character := private.create_player_character_v3_source_20261105(
   p_payload,p_spell_choices,p_magic_selections
 );
 PERFORM private.complete_player_creation_intent_v1(v_req,v_character);
 RETURN v_character;
END;
$i1c_bridge$;
REVOKE ALL ON FUNCTION private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)
 TO authenticated;

-- Keep actual private Story INSERT in the INVOKER path; this retains stage3
-- authenticated/RLS checks, and a failed insertion rolls back the entire
-- nonce+character transaction. No new privilege on Story tables is granted.
CREATE OR REPLACE FUNCTION public.create_player_character_with_private_backstory_v1(
 p_payload jsonb,
 p_spell_choices jsonb,
 p_magic_selections jsonb,
 p_private_backstory text
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog','public','private','auth'
AS $i1c_wrapper$
DECLARE v_character_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Signed-in creator required' USING ERRCODE='42501';
 END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN
   RAISE EXCEPTION 'Expected character creation payload object' USING ERRCODE='22023';
 END IF;
 IF NULLIF(btrim(coalesce(p_payload->>'secret','')),'') IS NOT NULL THEN
   RAISE EXCEPTION 'GM Secret cannot be supplied in the player Forge payload'
     USING ERRCODE='42501';
 END IF;
 v_character_id := private.create_player_character_v3_with_story_intent_i1c(
   p_payload,p_spell_choices,p_magic_selections,p_private_backstory
 );
 IF NULLIF(btrim(coalesce(p_private_backstory,'')),'') IS NOT NULL THEN
   IF NOT private.can_access_creator_backstory_v1(v_character_id) THEN
     RAISE EXCEPTION 'Original creator private-backstory access required'
       USING ERRCODE='42501';
   END IF;
   INSERT INTO public.character_backstory_secrets(character_id,secret_text)
   VALUES(v_character_id,p_private_backstory)
   -- Validated SAME intent never overwrites a later explicit authorized edit.
   ON CONFLICT (character_id) DO NOTHING;
 END IF;
 RETURN v_character_id;
END;
$i1c_wrapper$;
REVOKE ALL ON FUNCTION public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)
 TO authenticated;

-- A signed user may call the narrow private bridge from SQL, but it has NO
-- unrestricted public schema RPC endpoint and requires auth.uid and the exact
-- original reservation/Forge source. The user-facing wrapper preserves RLS.
-- No modifications to original public.create_player_character_v2/v3, tables,
-- grants, historical private Stories, editor rights or trigger definitions.
NOTIFY pgrst,'reload schema';
