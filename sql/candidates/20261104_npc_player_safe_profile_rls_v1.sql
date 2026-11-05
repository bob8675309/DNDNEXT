-- DNDNext P1.3 player-safe NPC Profile projection / full-sheet read gate.
-- RESEARCH CANDIDATE ONLY. Do NOT apply on production without source-drift,
-- direct characters column grants, legacy RPC and frontend parity review.
-- Captured live 2026-11-04 from DnDWeb, PostgreSQL 17.
-- Applies only inside disposable PostgreSQL 17 CI until approved release.
BEGIN;
DO $drift$
DECLARE
 v_acl text;
 v_reader_md5 text;
 v_access_md5 text;
BEGIN
 SELECT qual INTO v_acl FROM pg_policies WHERE schemaname='public'
 AND tablename='character_sheets'
 AND policyname='character_sheets_select_visible_or_assigned'
 AND cmd='SELECT';
 IF v_acl IS NULL OR position('EXISTS' IN v_acl)=0
    OR position('characters' IN v_acl)=0 THEN
    RAISE EXCEPTION 'Unexpected full-sheet SELECT policy, inspect current source before migration: %',v_acl;
 END IF;
 SELECT md5(pg_get_functiondef('private.can_access_character_v1(uuid,text)'::regprocedure))
 INTO v_access_md5;
 IF v_access_md5 <> '97b5e6b059e6467e24c4283fe420c83e' THEN
    RAISE EXCEPTION 'Character authority source drift: %',v_access_md5;
 END IF;
 SELECT md5(pg_get_functiondef('public.get_my_player_characters_v2()'::regprocedure))
 INTO v_reader_md5;
 IF v_reader_md5 <> 'deca87aaad0dce214743c87cdca03f36' THEN
    RAISE EXCEPTION 'Legacy multi-character reader source drift: %',v_reader_md5;
 END IF;
END $drift$;

-- RLS is row-based: do not return ANY sheet JSON to visible outsiders or
-- unrelated inventory-only/convert-only users. GM / explicit sheet editors can
-- continue using the existing canonical sheet/editor workflows.
ALTER POLICY character_sheets_select_visible_or_assigned
ON public.character_sheets
USING ((SELECT private.can_access_character_v1(character_id,'edit')));

-- The only public player-safe projection. Do NOT add full sheet, GM notes,
-- credentials, personal inventory or unrevealed source fields to this JSON.
CREATE OR REPLACE FUNCTION public.get_npc_profile_visible_v1(p_character_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $fn$
WITH permitted AS (
 SELECT c.id,c.name,c.kind,c.race,c.role,c.affiliation,c.status,
        c.description,c.background,c.motivation,c.quirk,
        c.mannerism,c.voice,c.secret,
        c.location_id,c.is_hidden,c.storefront_enabled,
        c.portrait_url,c.portrait_storage_path,c.portrait_thumb_url,
        c.portrait_shop_url,c.portrait_source,c.image_url,
        cs.sheet AS s
 FROM public.characters c
 LEFT JOIN public.character_sheets cs ON cs.character_id = c.id
 WHERE c.id=p_character_id
   AND auth.uid() IS NOT NULL
   AND (
     NOT coalesce(c.is_hidden,false)
     OR private.can_access_character_v1(c.id,'read')
   )
), p AS (
 SELECT *,
 CASE
   WHEN jsonb_typeof(s->'profileReveal')='object'
   THEN s->'profileReveal'
   WHEN jsonb_typeof(s->'npcProfileReveal')='object'
   THEN s->'npcProfileReveal'
   ELSE '{}'::jsonb
 END AS reveal
 FROM permitted
)
SELECT jsonb_strip_nulls(
 jsonb_build_object(
  'id',p.id,'name',p.name,'kind',p.kind,'race',p.race,'role',p.role,
  'affiliation',p.affiliation,'status',p.status,
  'location_id',p.location_id,
  'storefront_enabled',p.storefront_enabled,
  'portrait_url',p.portrait_url,
  'portrait_storage_path',p.portrait_storage_path,
  'portrait_thumb_url',p.portrait_thumb_url,
  'portrait_shop_url',p.portrait_shop_url,
  'portrait_source',p.portrait_source,
  'image_url',p.image_url,
  'description',coalesce(nullif(p.description,''),p.s->>'description'),
  'lore',jsonb_strip_nulls(jsonb_build_object(
    'background',CASE WHEN p.reveal->'background'='true'::jsonb
      THEN coalesce(nullif(p.background,''),p.s->>'background') END,
    'traits',CASE WHEN p.reveal->'traits'='true'::jsonb
      THEN coalesce(p.s->>'traits',p.s#>>'{personality,traits}') END,
    'ideals',CASE WHEN p.reveal->'ideals'='true'::jsonb
      THEN coalesce(p.s->>'ideals',p.s#>>'{personality,ideals}') END,
    'bonds',CASE WHEN p.reveal->'bonds'='true'::jsonb
      THEN coalesce(p.s->>'bonds',p.s#>>'{personality,bonds}') END,
    'flaws',CASE WHEN p.reveal->'flaws'='true'::jsonb
      THEN coalesce(p.s->>'flaws',p.s#>>'{personality,flaws}') END,
    'motivation',CASE WHEN p.reveal->'motivation'='true'::jsonb
      THEN coalesce(nullif(p.motivation,''),p.s->>'motivation') END,
    'quirk',CASE WHEN p.reveal->'quirk'='true'::jsonb
      THEN coalesce(nullif(p.quirk,''),p.s->>'quirk') END,
    'mannerism',CASE WHEN p.reveal->'mannerism'='true'::jsonb
      THEN nullif(concat_ws(' • ',
        coalesce(nullif(p.mannerism,''),p.s->>'mannerism'),
        coalesce(nullif(p.voice,''),p.s->>'voice')),'') END,
    'secret',CASE WHEN p.reveal->'secret'='true'::jsonb
      THEN coalesce(nullif(p.secret,''),p.s->>'secret') END
  ))
 )
)
FROM p;
$fn$;
REVOKE ALL ON FUNCTION public.get_npc_profile_visible_v1(uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_npc_profile_visible_v1(uuid)
TO authenticated;

-- Legacy source is SECURITY DEFINER: RLS alone cannot protect it!
-- Retain every character and permissions row the existing API returns, but
-- restrict full character serialization + sheet payload to can_edit=true.
CREATE OR REPLACE FUNCTION public.get_my_player_characters_v2()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $fn$
  select coalesce(jsonb_agg(
    (CASE WHEN cp.can_edit THEN to_jsonb(c)
      ELSE jsonb_strip_nulls(jsonb_build_object(
        'id',c.id,'name',c.name,'kind',c.kind,'race',c.race,'role',c.role,
        'affiliation',c.affiliation,'status',c.status,
        'portrait_url',c.portrait_url,'portrait_storage_path',c.portrait_storage_path,
        'portrait_thumb_url',c.portrait_thumb_url,
        'portrait_shop_url',c.portrait_shop_url,
        'portrait_source',c.portrait_source,'image_url',c.image_url,
        'tags',c.tags
      ))
    END)
    || jsonb_build_object(
      'character_sheet', CASE WHEN cp.can_edit
         THEN coalesce(cs.sheet,'{}'::jsonb) ELSE '{}'::jsonb END,
      'permission',to_jsonb(cp)
    )
    order by cp.created_at asc,c.name asc
  ),'[]'::jsonb)
  from public.character_permissions cp
  join public.characters c on c.id=cp.character_id
  left join public.character_sheets cs on cs.character_id=c.id
  where cp.user_id=auth.uid()
    and (cp.can_edit or cp.can_inventory or cp.can_convert)
    and 'player-character'=any(coalesce(c.tags,'{}'::text[]));
$fn$;

-- Preserve the original EXECUTE ACL; the function already exists. Refuse
-- unexpected source fingerprint above; no new public or anon permission.
COMMIT;
