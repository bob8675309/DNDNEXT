-- DNDNext — additive, UNDEPLOYED Admin character-creation notice candidate.
-- Source event is existing public.character_level_events(player_character_created).
-- No trigger, duplicate client write, alteration of creation RPC or character data.
-- Review and generate a numbered migration with the repo's Supabase CLI BEFORE apply.
-- Do not run on DnDWeb production based only on this draft.
BEGIN;

CREATE TABLE private.admin_character_creation_notice_reviews (
  event_id uuid NOT NULL
    REFERENCES public.character_level_events(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, admin_user_id)
);

ALTER TABLE private.admin_character_creation_notice_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.admin_character_creation_notice_reviews
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_character_creation_notices_v1(
  p_limit integer DEFAULT 80
)
RETURNS TABLE (
  event_id uuid,
  character_id uuid,
  character_name text,
  created_by uuid,
  creator_email text,
  created_at timestamptz,
  reviewed_at timestamptz,
  unread_total bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT e.id, e.character_id, c.name, e.created_by,
         u.email::text, e.created_at, r.reviewed_at,
         count(*) FILTER (WHERE r.reviewed_at IS NULL) OVER ()::bigint
  FROM public.character_level_events e
  JOIN public.characters c ON c.id = e.character_id
  LEFT JOIN auth.users u ON u.id = e.created_by
  LEFT JOIN private.admin_character_creation_notice_reviews r
    ON r.event_id = e.id AND r.admin_user_id = auth.uid()
  WHERE e.event_type = 'player_character_created'
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT least(greatest(coalesce(p_limit, 80), 1), 100);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_character_creation_notices_v1(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_character_creation_notices_v1(integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.review_admin_character_creation_notice_v1(
  p_event_id uuid
)
RETURNS timestamptz
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_reviewed timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_event_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.character_level_events e
    WHERE e.id = p_event_id AND e.event_type = 'player_character_created'
  ) THEN
    RAISE EXCEPTION 'Character creation notice not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO private.admin_character_creation_notice_reviews (
    event_id, admin_user_id
  )
  VALUES (p_event_id, auth.uid())
  ON CONFLICT (event_id, admin_user_id) DO NOTHING;

  SELECT r.reviewed_at INTO v_reviewed
  FROM private.admin_character_creation_notice_reviews r
  WHERE r.event_id = p_event_id AND r.admin_user_id = auth.uid();

  RETURN v_reviewed;
END;
$function$;

REVOKE ALL ON FUNCTION public.review_admin_character_creation_notice_v1(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_admin_character_creation_notice_v1(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.get_admin_character_creation_notices_v1(integer)
IS 'Admin-only safe projection from existing committed player_character_created events. Never exposes character sheet or raw level-event details.';
COMMENT ON TABLE private.admin_character_creation_notice_reviews
IS 'Per-Admin read receipts for committed character-creation events. Not a player-writable notification queue.';

COMMIT;
