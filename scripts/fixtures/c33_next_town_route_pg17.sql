-- C3T real Next town acceptance: ADDITIVE disposable PG17 only.
-- Never apply to production.
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS quests jsonb DEFAULT '[]'::jsonb;
INSERT INTO public.locations(id,name,description,quests)
VALUES(99001,'C3T scratch town','Disposable signed town Profile smoke','[]'::jsonb)
ON CONFLICT(id) DO UPDATE SET name=excluded.name;
GRANT SELECT ON public.locations TO authenticated,anon;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS map_icon_id uuid;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS projected_destination_id bigint;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS storefront_bg_url text;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS storefront_bg_image_url text;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS storefront_bg_video_url text;
CREATE TABLE IF NOT EXISTS public.town_map_labels
(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),location_id bigint,sort_order int DEFAULT 0);
GRANT SELECT ON public.town_map_labels TO authenticated,anon;
CREATE TABLE IF NOT EXISTS public.character_stock
(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),character_id uuid,
display_name text,qty int DEFAULT 0,price_gp numeric DEFAULT 0,card_payload jsonb DEFAULT '{}'::jsonb);
GRANT SELECT ON public.character_stock TO authenticated;
-- C3J's pre-stage snapshot grants only a narrow original Profile subset.
-- The REAL TownPage roster/merchant projections additionally read these
-- PUBLIC identity/map/storefront columns. Restore their column privileges
-- ONLY in this scratch test: NEVER grant SELECT on the whole characters table
-- (which contains GM secret / unrevealed narrative fields).
GRANT SELECT (
  state,last_known_location_id,projected_destination_id,map_icon_id,
  home_location_id,storefront_title,storefront_tagline,
  storefront_bg_url,storefront_bg_image_url,storefront_bg_video_url
) ON public.characters TO authenticated;

-- Keep the proposed Stage2 role-wide private-column revocations effective.
DO $c3t_grants$
BEGIN
 IF NOT has_column_privilege('authenticated','public.characters','home_location_id','SELECT')
 OR NOT has_column_privilege('authenticated','public.characters','state','SELECT')
 OR has_column_privilege('authenticated','public.characters','secret','SELECT')
 OR has_column_privilege('authenticated','public.characters','background','SELECT')
 OR has_column_privilege('authenticated','public.characters','motivation','SELECT')
 OR has_column_privilege('anon','public.characters','id','SELECT')
 THEN
   RAISE EXCEPTION 'C3T role/column grants diverged; never widen sensitive character table access';
 END IF;
END $c3t_grants$;
NOTIFY pgrst,'reload schema';
\echo 'PASS C3T00: scratch town and merchant projection exists in disposable local DB'
