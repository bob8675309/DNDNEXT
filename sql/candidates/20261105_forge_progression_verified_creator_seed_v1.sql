-- DNDNext / held PR #324: forge progression creator attribution correction.
-- RESEARCH CANDIDATE ONLY; not a numbered migration and NOT applied to DnDWeb.
-- Requires held PR #321 immutable creator capture and held PR #324 guarded
-- player-v2/v3 creation replay. Its purpose is to supply a verified creator
-- BEFORE the original immediate feat-instance AFTER INSERT materializer fires.
-- Never backfills historical rows or edits original functions or grant tables.
-- Source/lock/permission/browser cutover must be owner-reviewed before release.

DO $source_gate$
BEGIN
 IF to_regclass('private.character_creator_attribution') IS NULL
   OR to_regprocedure('private.capture_character_creator_on_insert_v1()') IS NULL
   OR NOT EXISTS (SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.characters'::regclass
       AND tgname='characters_capture_creator_at_insert_v1'
       AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'Missing held #321 trusted creator-INSERT capture'; END IF;
 IF to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 THEN RAISE EXCEPTION 'Missing held #324 typed creation nonce protection'; END IF;
 IF md5(pg_get_functiondef('private.sync_character_progression_from_sheet_v1()'::regprocedure))
      <> 'bb1a3a2d1600ce33cd4fcadac5e0f3a9'
   OR md5(pg_get_functiondef('private.materialize_player_forge_feat_instances_v1()'::regprocedure))
      <> 'c27c4181a51cfd018bbb8244e9931550'
 THEN RAISE EXCEPTION 'Original sheet sync/feat materializer source drift; stop'; END IF;
 IF to_regprocedure('private.seed_verified_forge_progression_creator_v1()') IS NOT NULL
 THEN RAISE EXCEPTION 'Creator binding candidate already exists; review before retry'; END IF;
END $source_gate$;

-- This SECURITY DEFINER function is available only as a PG trigger handler.
-- It does NOT assume edit privilege proves original creator identity.
-- The immutable creator was captured on the public.characters INSERT in
-- this very transaction; the source Forge stamps meta.creator server-side.
-- All lookups are plain MVCC SELECT, with NO FOR UPDATE, table data update,
-- reordering of character, sheet or progression INSERTs, or grant backfill.
CREATE FUNCTION private.seed_verified_forge_progression_creator_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $seed$
DECLARE
  v_actor uuid;
  v_recorded_creator uuid;
  v_sheet_creator text;
BEGIN
  IF TG_OP <> 'INSERT' OR NEW.created_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Do not change Admin NPC, legacy level-up, or unrelated service inserts.
  SELECT cs.sheet #>> '{meta,creator}' INTO v_sheet_creator
  FROM public.character_sheets cs
  WHERE cs.character_id=NEW.character_id;
  IF v_sheet_creator IS DISTINCT FROM 'shared_character_forge_player_v2' THEN
    RETURN NEW;
  END IF;

  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    -- No signed-in author: no creator claim may be inferred from the sheet.
    RETURN NEW;
  END IF;

  -- Recorded-at is the transaction timestamp assigned by the exact held
  -- #321 AFTER characters INSERT trigger, so old creator rows are excluded.
  -- The client cannot write this private table or spoof creator_user_id.
  SELECT ca.creator_user_id INTO v_recorded_creator
  FROM private.character_creator_attribution ca
  WHERE ca.character_id=NEW.character_id
    AND ca.recorded_at=transaction_timestamp();

  IF v_recorded_creator IS NULL THEN
    -- Do not claim a historical or unattributed character's old grants.
    RETURN NEW;
  END IF;
  IF v_recorded_creator IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Verified original creator does not match authenticated session'
      USING ERRCODE='42501';
  END IF;

  -- The original immediate AFTER INSERT feat materializer now sees the
  -- server-verified NEW.created_by. No existing row, G/I/CS/CP update, or
  -- original trigger function is altered here.
  NEW.created_by := v_actor;
  RETURN NEW;
END;
$seed$;

REVOKE ALL ON FUNCTION private.seed_verified_forge_progression_creator_v1()
 FROM PUBLIC,anon,authenticated;

-- Existing original BEFORE INSERT subclass trigger remains in place. New
-- source-only trigger uses simple MVCC reads, not row locks or rewrites.
CREATE TRIGGER character_progression_seed_verified_forge_creator_v1
BEFORE INSERT ON public.character_progression
FOR EACH ROW
EXECUTE FUNCTION private.seed_verified_forge_progression_creator_v1();
