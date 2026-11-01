-- P2 isolated PG17 genuine Auth read-endpoint parity fixture.
-- Exact public function definitions obtained via read-only live pg_get_functiondef
-- on 2026-11-01. NEVER install this fixture on DnDWeb.
alter table public.characters
  add column secret text,
  add column tags text[] not null default '{}'::text[];
alter table public.character_permissions
  add column created_at timestamptz not null default now();
update public.characters set secret='NPC_SOURCE_SECRET_REDACTED',
 tags=array['player-character','npc']
where id=public.p2_id(32);
-- Deliberately tag hidden NPC as a player-character in this adversarial
-- fixture: must STILL require edit/inventory/convert permission, never combat.

-- source MD5 2f28c77dcda18aed1c654515b26ec438 get_character_secrets_v1
CREATE OR REPLACE FUNCTION public.get_character_secrets_v1(p_character_ids uuid[])
 RETURNS TABLE(character_id uuid, secret text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select c.id, c.secret
  from public.characters c
  where c.id = any(coalesce(p_character_ids, '{}'::uuid[]))
    and private.can_access_character_v1(c.id, 'edit');
$function$;

revoke all on function public.get_character_secrets_v1(uuid[]) from public,anon;
grant execute on function public.get_character_secrets_v1(uuid[]) to authenticated;

-- source MD5 b6049deb0b4d59daf15d7dd6e8ac1079 get_my_player_character_v1
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

  return to_jsonb(v_character)
    || jsonb_build_object(
      'character_sheet', coalesce(v_sheet,'{}'::jsonb),
      'permission', to_jsonb(v_permission)
    );
end;
$function$;

revoke all on function public.get_my_player_character_v1() from public,anon;
grant execute on function public.get_my_player_character_v1() to authenticated;

-- source MD5 deca87aaad0dce214743c87cdca03f36 get_my_player_characters_v2
CREATE OR REPLACE FUNCTION public.get_my_player_characters_v2()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select coalesce(jsonb_agg(
    to_jsonb(c)
    || jsonb_build_object(
      'character_sheet', coalesce(cs.sheet, '{}'::jsonb),
      'permission', to_jsonb(cp)
    )
    order by cp.created_at asc, c.name asc
  ), '[]'::jsonb)
  from public.character_permissions cp
  join public.characters c on c.id = cp.character_id
  left join public.character_sheets cs on cs.character_id = c.id
  where cp.user_id = auth.uid()
    and (cp.can_edit or cp.can_inventory or cp.can_convert)
    and 'player-character' = any(coalesce(c.tags, '{}'::text[]));
$function$;

revoke all on function public.get_my_player_characters_v2() from public,anon;
grant execute on function public.get_my_player_characters_v2() to authenticated;

do $acl$
begin
  if has_function_privilege('anon','public.get_character_secrets_v1(uuid[])','EXECUTE')
  or has_function_privilege('anon','public.get_my_player_character_v1()','EXECUTE')
  or has_function_privilege('anon','public.get_my_player_characters_v2()','EXECUTE')
  then raise exception 'Secret/profile read RPC accidentally anonymous'; end if;
end $acl$;
notify pgrst,'reload schema';
