-- Original deployed PG17 source, read-only captured 2026-11-05.
-- md5(pg_get_functiondef) = b8b0008a718de1aa3e74d66b30f1a679
-- DISPOSABLE PG17/GoTrue fixture only. NEVER deploy this SQL.
CREATE OR REPLACE FUNCTION private.guard_player_character_tag_update_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
begin
  if new.tags is distinct from old.tags
     and 'player-character' = any(coalesce(old.tags, '{}'::text[]))
     and pg_trigger_depth() = 1
     and auth.uid() is not null
     and not private.current_user_is_admin() then
    raise exception 'Player character tags are managed by campaign authority.' using errcode = '42501';
  end if;
  return new;
end;
$function$;
