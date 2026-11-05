-- P1.3 GM/PLAYER SECRETS SEPARATION -- RESEARCH ONLY, NOT A MIGRATION.
-- Requires BOTH stage1 + stage2 NPC visibility candidates. No live usage.
-- Source preflight is immutable; deployment would require coordinated UI cutover.
BEGIN;
DO $gate$
DECLARE v1_md5 text; v_get_md5 text; v_set_md5 text; v_stage1 text;
BEGIN
 IF to_regprocedure('public.get_npc_dossier_admin_v1(uuid)') IS NULL
    OR to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NULL
 THEN RAISE EXCEPTION 'GM-secret separation requires both earlier staged candidates'; END IF;
 SELECT md5(pg_get_functiondef('public.get_my_player_character_v1()'::regprocedure)) INTO v1_md5;
 SELECT md5(pg_get_functiondef('public.get_character_secrets_v1(uuid[])'::regprocedure)) INTO v_get_md5;
 SELECT md5(pg_get_functiondef('public.set_character_secret_v1(uuid,text)'::regprocedure)) INTO v_set_md5;
 IF v1_md5 <> 'b6049deb0b4d59daf15d7dd6e8ac1079'
    OR v_get_md5 <> '2f28c77dcda18aed1c654515b26ec438'
    OR v_set_md5 <> '13bdb65758552362bc7049b65131c9aa'
 THEN RAISE EXCEPTION 'Legacy secret RPC source changed; stop before altering ACL behavior'; END IF;
 SELECT pg_get_functiondef('public.get_my_player_characters_v2()'::regprocedure) INTO v_stage1;
 IF position('CASE WHEN cp.can_edit' in v_stage1) = 0
 THEN RAISE EXCEPTION 'Player-character v2 reader is not stage-one restricted source'; END IF;
END $gate$;

-- Player/authored backstory is its own record and never maps to old GM secret.
CREATE TABLE public.character_backstory_secrets (
 character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
 secret_text text NOT NULL DEFAULT '' CHECK (length(secret_text) <= 16000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.character_backstory_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_backstory_secrets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.character_backstory_secrets TO authenticated;
CREATE POLICY character_backstory_secrets_select_editor
 ON public.character_backstory_secrets FOR SELECT TO authenticated
 USING (auth.uid() IS NOT NULL AND private.can_access_character_v1(character_id,'edit'));
CREATE POLICY character_backstory_secrets_insert_editor
 ON public.character_backstory_secrets FOR INSERT TO authenticated
 WITH CHECK (auth.uid() IS NOT NULL AND private.can_access_character_v1(character_id,'edit'));
CREATE POLICY character_backstory_secrets_update_editor
 ON public.character_backstory_secrets FOR UPDATE TO authenticated
 USING (auth.uid() IS NOT NULL AND private.can_access_character_v1(character_id,'edit'))
 WITH CHECK (auth.uid() IS NOT NULL AND private.can_access_character_v1(character_id,'edit'));

-- GM has a separate and deliberate "published clue" record.
-- Changing editable sheet.profileReveal.secret does NOT publish GM secrets.
CREATE TABLE public.character_public_secret_revelations (
 character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
 public_text text NOT NULL DEFAULT '' CHECK (length(public_text) <= 16000),
 is_revealed boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.character_public_secret_revelations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_public_secret_revelations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.character_public_secret_revelations TO authenticated;
CREATE POLICY character_public_secret_revelations_gm_only
 ON public.character_public_secret_revelations FOR ALL TO authenticated
 USING (auth.uid() IS NOT NULL AND private.current_user_is_admin())
 WITH CHECK (auth.uid() IS NOT NULL AND private.current_user_is_admin());

-- Restrict existing GM secret getters/setters without changing old API names.
-- Legacy values in characters.secret remain untouched; no destructive migration.
CREATE OR REPLACE FUNCTION public.get_character_secrets_v1(p_character_ids uuid[])
 RETURNS TABLE(character_id uuid, secret text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select c.id, c.secret
  from public.characters c
  where c.id = any(coalesce(p_character_ids, '{}'::uuid[]))
    and auth.uid() is not null and private.current_user_is_admin();
$function$;

CREATE OR REPLACE FUNCTION public.set_character_secret_v1(p_character_id uuid, p_secret text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
begin
  if auth.uid() is null or not private.current_user_is_admin() then
    raise exception 'Not authorized to edit this character secret' using errcode = '42501';
  end if;

  update public.characters
  set secret = nullif(btrim(p_secret), ''), updated_at = timezone('utc', now())
  where id = p_character_id;

  if not found then
    raise exception 'Character not found' using errcode = 'P0002';
  end if;
end;
$function$;


-- Keep existing source identity / tagged-PC reader behavior but prevent
-- server-side to_jsonb(c) from bypassing the column's denied SELECT.
CREATE OR REPLACE FUNCTION public.get_my_player_character_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_user uuid := auth.uid();
  v_character public.characters%rowtype;
  v_sheet jsonb;
  v_permission public.character_permissions%rowtype;
begin
  if v_user is null then
    raise exception 'Sign in is required.' using errcode = '42501';
  end if;

  select cp.* into v_permission
  from public.character_permissions cp
  join public.characters c on c.id = cp.character_id
  where cp.user_id = v_user
    and cp.can_edit
    and 'player-character' = any(coalesce(c.tags,'{}'::text[]))
  order by cp.created_at asc
  limit 1;

  if v_permission.character_id is null then return null; end if;

  select * into v_character from public.characters where id = v_permission.character_id;
  select sheet into v_sheet from public.character_sheets where character_id = v_permission.character_id;

  return (to_jsonb(v_character) - 'secret')
    || jsonb_build_object(
      'character_sheet', coalesce(v_sheet,'{}'::jsonb),
      'permission', to_jsonb(v_permission)
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_player_characters_v2()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $fn$
  select coalesce(jsonb_agg(
    (CASE WHEN cp.can_edit THEN (to_jsonb(c) - 'secret')
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

-- Server-safe projection must NEVER read legacy characters.secret.
-- Public reveal requires an independently GM-authored published clue.
CREATE OR REPLACE FUNCTION public.get_npc_profile_visible_v1(p_character_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $fn$
WITH permitted AS (
 SELECT c.id,c.name,c.kind,c.race,c.role,c.affiliation,c.status,
        c.description,c.background,c.motivation,c.quirk,
        c.mannerism,c.voice,
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
    'secret',(
      SELECT nullif(reveal.public_text,'')
      FROM public.character_public_secret_revelations reveal
      WHERE reveal.character_id=p.id AND reveal.is_revealed=true
    )
  ))
 )
)
FROM p;
$fn$;

COMMIT;
