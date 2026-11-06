-- Verbatim original live Warlock slot math functions, read-only 2026-11-05
-- Disposable source-authenticated Forge J109+ only; not a migration.

-- private.xphb_warlock_invocation_count_v1 md5 61c83f0172b33386f0a50435c2fe1ddb
CREATE OR REPLACE FUNCTION private.xphb_warlock_invocation_count_v1(p_level integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when greatest(1,least(20,coalesce(p_level,1))) >= 18 then 10
    when greatest(1,least(20,coalesce(p_level,1))) >= 15 then 9
    when greatest(1,least(20,coalesce(p_level,1))) >= 12 then 8
    when greatest(1,least(20,coalesce(p_level,1))) >= 9 then 7
    when greatest(1,least(20,coalesce(p_level,1))) >= 7 then 6
    when greatest(1,least(20,coalesce(p_level,1))) >= 5 then 5
    when greatest(1,least(20,coalesce(p_level,1))) >= 2 then 3
    else 1 end;
$function$;

-- private.xphb_warlock_invocation_slot_level_v1 md5 942dd3a4e08b8874f3e42cbbb8323038
CREATE OR REPLACE FUNCTION private.xphb_warlock_invocation_slot_level_v1(p_slot integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case greatest(1,least(10,coalesce(p_slot,1)))
    when 1 then 1 when 2 then 2 when 3 then 2 when 4 then 5 when 5 then 5
    when 6 then 7 when 7 then 9 when 8 then 12 when 9 then 15 when 10 then 18 end;
$function$;
