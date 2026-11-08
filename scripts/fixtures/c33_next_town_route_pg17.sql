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
NOTIFY pgrst,'reload schema';
\echo 'PASS C3T00: scratch town and merchant projection exists in disposable local DB'
