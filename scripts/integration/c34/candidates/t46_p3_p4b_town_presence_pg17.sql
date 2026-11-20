-- DNDNext T46-P3-P4B-A; NONMAP RESEARCH ONLY; not a production migration.
-- Exact source-original #345 Stage1/2/3 must already be installed locally.
-- Explicit signed-auth town presence; never expose canonical Sheet JSON.
BEGIN;
DO $preflight$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int<170000
 OR to_regclass('public.characters') IS NULL
 OR to_regclass('public.locations') IS NULL
 OR to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NULL
 OR to_regprocedure('private.current_user_is_admin()') IS NULL
 THEN RAISE EXCEPTION 'P4B-A requires disposable source-staged local PG17';END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.c34_t46_get_town_presence_v1(p_location_id bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $town$
WITH permitted AS MATERIALIZED (
 SELECT c.*
 FROM public.characters c
 WHERE p_location_id IS NOT NULL
 AND p_location_id > 0
 AND auth.uid() IS NOT NULL
 AND coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
 AND c.kind IN ('npc','merchant')
 AND (c.location_id=p_location_id
   OR (c.kind='merchant' AND c.home_location_id=p_location_id))
 AND (NOT coalesce(c.is_hidden,false) OR private.current_user_is_admin())
), projected AS MATERIALIZED (
 SELECT c.id,c.name,c.kind,c.location_id,c.home_location_id,c.storefront_enabled,
   jsonb_strip_nulls(
     coalesce(public.get_npc_profile_visible_v1(c.id),'{}'::jsonb)
     || jsonb_build_object(
       'home_location_id',c.home_location_id,
       'state',c.state,
       'tags',coalesce(c.tags,'{}'::text[]),
       'storefront_title',CASE WHEN c.kind='merchant' AND c.storefront_enabled THEN c.storefront_title END,
       'storefront_tagline',CASE WHEN c.kind='merchant' AND c.storefront_enabled THEN c.storefront_tagline END
     )
   ) AS obj
 FROM permitted c
)
SELECT jsonb_build_object(
 'roster',coalesce((SELECT jsonb_agg(p.obj ORDER BY p.name,p.id)
   FROM projected p WHERE p.location_id=p_location_id),'[]'::jsonb),
 'presentMerchants',coalesce((SELECT jsonb_agg(p.obj ORDER BY p.name,p.id)
   FROM projected p WHERE p.kind='merchant' AND p.location_id=p_location_id),'[]'::jsonb),
 'residentMerchants',coalesce((SELECT jsonb_agg(p.obj ORDER BY p.name,p.id)
   FROM projected p WHERE p.kind='merchant' AND p.home_location_id=p_location_id),'[]'::jsonb)
);
$town$;
REVOKE ALL ON FUNCTION public.c34_t46_get_town_presence_v1(bigint)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.c34_t46_get_town_presence_v1(bigint)
 TO authenticated;
COMMIT;
