-- Repair shared Wizard runtime helper dependencies discovered during deployed
-- Memorize Spell lifecycle acceptance. Migrations 44, 74, and 75 already
-- reference these contracts, so add them compatibly rather than rewriting
-- deployed history.

create or replace function private.can_manage_character_spell_resources_v1(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select private.can_manage_character_progression_v1(p_character_id);
$$;

create or replace function private.character_class_feature_acquired_at_v1(
  p_character_id uuid,
  p_class_key text,
  p_class_source text,
  p_feature_level integer
)
returns timestamptz
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_event_at timestamptz;
  v_created_at timestamptz;
begin
  if p_character_id is null
     or nullif(btrim(coalesce(p_class_key,'')),'') is null
     or nullif(btrim(coalesce(p_class_source,'')),'') is null
     or coalesce(p_feature_level,0)<1 then
    return null;
  end if;

  if not exists(
    select 1
    from public.character_progression cp
    join public.class_catalog c on c.id=cp.class_id
    where cp.character_id=p_character_id
      and lower(btrim(coalesce(c.class_key,'')))=lower(btrim(p_class_key))
      and upper(btrim(coalesce(c.source,'')))=upper(btrim(p_class_source))
      and cp.class_level>=p_feature_level
  ) then
    return null;
  end if;

  select min(coalesce(
    nullif(to_jsonb(e)->>'completed_at','')::timestamptz,
    nullif(to_jsonb(e)->>'created_at','')::timestamptz,
    nullif(to_jsonb(e)->>'updated_at','')::timestamptz
  ))
  into v_event_at
  from public.character_level_events e
  where e.character_id=p_character_id
    and coalesce(
      nullif(to_jsonb(e)->>'to_level','')::integer,
      nullif(to_jsonb(e)->>'new_level','')::integer,
      nullif(to_jsonb(e)->>'level','')::integer,
      0
    )>=p_feature_level
    and coalesce(
      nullif(to_jsonb(e)->>'from_level','')::integer,
      nullif(to_jsonb(e)->>'old_level','')::integer,
      0
    )<p_feature_level;

  if v_event_at is not null then
    return v_event_at;
  end if;

  select created_at into v_created_at
  from public.characters
  where id=p_character_id;

  return v_created_at;
end;
$$;

revoke all on function private.can_manage_character_spell_resources_v1(uuid) from public,anon,authenticated;
revoke all on function private.character_class_feature_acquired_at_v1(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function private.can_manage_character_spell_resources_v1(uuid) to service_role;
grant execute on function private.character_class_feature_acquired_at_v1(uuid,text,text,integer) to service_role;
