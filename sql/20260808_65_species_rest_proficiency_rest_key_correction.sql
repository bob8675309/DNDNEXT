-- DNDNext character_rest_log stores canonical rest keys as short_rest/long_rest.
-- Migration 63 used the prose shorthand 'long'; correct the runtime helper and
-- Githyanki expiry trigger before any real Species runtime state is created.

create or replace function private.species_runtime_latest_long_rest_v1(p_character_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select max(completed_at)
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';
$$;

create or replace function private.expire_githyanki_astral_knowledge_after_long_rest_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.rest_type<>'long_rest' then return new; end if;
  delete from public.character_runtime_feature_choices
  where character_id=new.character_id and feature_key='githyanki-astral-knowledge';
  perform private.set_species_runtime_projection_v1(new.character_id,'githyankiAstralKnowledge',null);
  return new;
end;
$$;

revoke all on function private.species_runtime_latest_long_rest_v1(uuid) from public,anon,authenticated;
revoke all on function private.expire_githyanki_astral_knowledge_after_long_rest_v1() from public,anon,authenticated;
grant execute on function private.species_runtime_latest_long_rest_v1(uuid) to service_role;
grant execute on function private.expire_githyanki_astral_knowledge_after_long_rest_v1() to service_role;
