-- Read-only copied creator INSERT attribution block from held PR #321 stage 3.
-- The Admin authorization helper is the live original body; its underlying
-- private.current_user_is_admin() role source is reduced for scratch PG17 only.
-- All changes here are disposable fixture SQL, never production DnDWeb.
CREATE OR REPLACE FUNCTION private.require_character_admin_v1()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.current_user_is_admin() then
    raise exception 'Only an administrator can manage campaign characters' using errcode = '42501';
  end if;
end;
$function$;

-- Creator attribution is trusted provenance, NOT an editable permission grant.
-- No client may choose a creator_user_id, claim someone else's character, or
-- reassign origin after receiving can_edit or temporary control.
CREATE TABLE private.character_creator_attribution (
 character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
 creator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.character_creator_attribution FROM PUBLIC,anon,authenticated;

-- Call from the same trusted SECURITY DEFINER transaction as character
-- creation, *after* the canonical character INSERT; never expose this helper
-- to the browser. Existing rows are deliberately NOT auto-attributed.
CREATE OR REPLACE FUNCTION private.record_character_creator_v1(p_character_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $creator$
DECLARE v_caller uuid := auth.uid();
BEGIN
 IF v_caller IS NULL THEN
   RAISE EXCEPTION 'Authenticated creator required' USING errcode='42501';
 END IF;
 INSERT INTO private.character_creator_attribution(character_id,creator_user_id)
 VALUES (p_character_id,v_caller)
 ON CONFLICT (character_id) DO NOTHING;
 IF NOT EXISTS (
   SELECT 1 FROM private.character_creator_attribution
   WHERE character_id=p_character_id AND creator_user_id=v_caller
 ) THEN
   RAISE EXCEPTION 'Character creator attribution is immutable' USING errcode='42501';
 END IF;
END;
$creator$;
REVOKE ALL ON FUNCTION private.record_character_creator_v1(uuid)
FROM PUBLIC,anon,authenticated;

-- All canonical character insertions, including the original Admin NPC
-- create_character_v1 and player-character v1/v2/v3 Forge families, pass
-- through public.characters. Bind provenance at AFTER INSERT in that SAME
-- transaction, without changing complex existing RPC sources or permitting
-- a forged creator_user_id payload. No hard-coded row/account creator grants.
-- Service-side creations with no validated signed-in auth.uid() have no
-- attribution and remain GM-only until an explicitly reviewed workflow.
CREATE OR REPLACE FUNCTION private.capture_character_creator_on_insert_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $capture$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM private.record_character_creator_v1(NEW.id);
  END IF;
  RETURN NEW;
END;
$capture$;
REVOKE ALL ON FUNCTION private.capture_character_creator_on_insert_v1()
FROM PUBLIC,anon,authenticated;
CREATE TRIGGER characters_capture_creator_at_insert_v1
AFTER INSERT ON public.characters
FOR EACH ROW EXECUTE FUNCTION private.capture_character_creator_on_insert_v1();

