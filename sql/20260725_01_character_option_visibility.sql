BEGIN;

CREATE TABLE IF NOT EXISTS public.character_option_visibility (
  scope_key text NOT NULL DEFAULT 'default',
  option_id uuid NOT NULL REFERENCES public.character_option_catalog(id) ON DELETE CASCADE,
  is_visible boolean NOT NULL DEFAULT true,
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_key, option_id),
  CONSTRAINT character_option_visibility_scope_key_chk
    CHECK (length(btrim(scope_key)) BETWEEN 1 AND 80)
);

ALTER TABLE public.character_option_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS character_option_visibility_read_v1 ON public.character_option_visibility;
CREATE POLICY character_option_visibility_read_v1
ON public.character_option_visibility
FOR SELECT
TO anon, authenticated
USING (true);

REVOKE ALL ON TABLE public.character_option_visibility FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.character_option_visibility TO anon, authenticated, service_role;

DROP VIEW IF EXISTS public.character_option_catalog_available;
DROP VIEW IF EXISTS public.character_option_catalog_configured;

CREATE VIEW public.character_option_catalog_configured
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.option_key,
  p.option_type,
  p.name,
  p.source,
  p.category,
  p.description,
  p.prerequisite_text,
  p.tags,
  p.metadata,
  p.raw_payload,
  p.created_at,
  p.updated_at,
  COALESCE(v.is_visible, true) AS is_visible
FROM public.character_option_catalog_preferred AS p
LEFT JOIN public.character_option_visibility AS v
  ON v.scope_key = 'default'
 AND v.option_id = p.id;

CREATE VIEW public.character_option_catalog_available
WITH (security_invoker = true)
AS
SELECT
  id,
  option_key,
  option_type,
  name,
  source,
  category,
  description,
  prerequisite_text,
  tags,
  metadata,
  raw_payload,
  created_at,
  updated_at
FROM public.character_option_catalog_configured
WHERE is_visible;

REVOKE ALL ON TABLE public.character_option_catalog_configured FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.character_option_catalog_available FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.character_option_catalog_configured TO authenticated, service_role;
GRANT SELECT ON TABLE public.character_option_catalog_available TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_character_option_visibility_v1(
  p_option_id uuid,
  p_is_visible boolean,
  p_scope_key text DEFAULT 'default'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
DECLARE
  v_scope text := btrim(COALESCE(p_scope_key, 'default'));
BEGIN
  PERFORM private.require_character_admin_v1();

  IF p_option_id IS NULL THEN
    RAISE EXCEPTION 'Character option id is required' USING errcode = '22023';
  END IF;
  IF v_scope = '' OR length(v_scope) > 80 THEN
    RAISE EXCEPTION 'Invalid character option visibility scope' USING errcode = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.character_option_catalog WHERE id = p_option_id) THEN
    RAISE EXCEPTION 'Character option not found' USING errcode = 'P0002';
  END IF;

  INSERT INTO public.character_option_visibility(scope_key, option_id, is_visible, updated_by, updated_at)
  VALUES (v_scope, p_option_id, COALESCE(p_is_visible, true), auth.uid(), now())
  ON CONFLICT (scope_key, option_id)
  DO UPDATE SET
    is_visible = EXCLUDED.is_visible,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  RETURN COALESCE(p_is_visible, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_character_option_visibility_v1(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_character_option_visibility_v1(uuid, boolean, text) TO authenticated, service_role;

-- Establish an explicit default-game visibility row for every currently preferred background.
INSERT INTO public.character_option_visibility(scope_key, option_id, is_visible, updated_by)
SELECT 'default', p.id, true, NULL
FROM public.character_option_catalog_preferred AS p
WHERE p.option_type = 'background'
ON CONFLICT (scope_key, option_id)
DO UPDATE SET is_visible = true, updated_by = NULL, updated_at = now();

-- Hide only the setting-specific backgrounds the campaign owner chose to exclude.
UPDATE public.character_option_visibility AS v
SET is_visible = false,
    updated_by = NULL,
    updated_at = now()
FROM public.character_option_catalog_preferred AS p
WHERE v.scope_key = 'default'
  AND v.option_id = p.id
  AND p.option_type = 'background'
  AND (
    (upper(p.source) = 'AI' AND lower(p.name) IN ('celebrity adventurer''s scion', 'plaintiff', 'rival intern'))
    OR (upper(p.source) = 'BGDIA' AND lower(p.name) <> 'faceless')
    OR (upper(p.source) = 'DSOTDQ' AND lower(p.name) = 'knight of solamnia')
    OR upper(p.source) IN ('EFA', 'EGW', 'FRHOF', 'GGR', 'PSA')
  );

DO $postconditions$
DECLARE
  v_total integer;
  v_visible integer;
  v_hidden integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE is_visible), count(*) FILTER (WHERE NOT is_visible)
  INTO v_total, v_visible, v_hidden
  FROM public.character_option_catalog_configured
  WHERE option_type = 'background';

  IF v_total <> 148 THEN
    RAISE EXCEPTION 'Preferred background count changed unexpectedly: %', v_total;
  END IF;
  IF v_visible <> 75 OR v_hidden <> 73 THEN
    RAISE EXCEPTION 'Unexpected background visibility split: % shown / % hidden', v_visible, v_hidden;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.character_option_catalog_configured
    WHERE option_type = 'background'
      AND (
        (upper(source) = 'AI' AND name IN ('Failed Merchant', 'Gambler'))
        OR (upper(source) = 'BGDIA' AND name = 'Faceless')
        OR (upper(source) = 'DSOTDQ' AND name = 'Mage of High Sorcery')
        OR (upper(source) = 'PSI' AND name = 'Inquisitor')
        OR (upper(source) = 'SCC' AND name = 'Witherbloom Student')
      )
      AND NOT is_visible
  ) THEN
    RAISE EXCEPTION 'A required keep background was hidden';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.character_option_catalog_configured
    WHERE option_type = 'background'
      AND upper(source) IN ('EFA', 'EGW', 'FRHOF', 'GGR', 'PSA')
      AND is_visible
  ) THEN
    RAISE EXCEPTION 'A source requested for hiding still has visible backgrounds';
  END IF;
END;
$postconditions$;

COMMIT;
