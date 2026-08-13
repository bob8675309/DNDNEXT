-- Correct the Astral Trance skill-key adapter after migration 52.
-- normalize_player_choice_name_v1 strips spaces, so the two multiword skills
-- must match animalhandling / sleightofhand rather than spaced names.

create or replace function private.astral_trance_skill_key_v1(p_name text)
returns text
language sql
immutable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select case private.normalize_player_choice_name_v1(p_name)
    when 'animalhandling' then 'animalHandling'
    when 'sleightofhand' then 'sleightOfHand'
    when 'acrobatics' then 'acrobatics'
    when 'arcana' then 'arcana'
    when 'athletics' then 'athletics'
    when 'deception' then 'deception'
    when 'history' then 'history'
    when 'insight' then 'insight'
    when 'intimidation' then 'intimidation'
    when 'investigation' then 'investigation'
    when 'medicine' then 'medicine'
    when 'nature' then 'nature'
    when 'perception' then 'perception'
    when 'performance' then 'performance'
    when 'persuasion' then 'persuasion'
    when 'religion' then 'religion'
    when 'stealth' then 'stealth'
    when 'survival' then 'survival'
    else null
  end;
$$;

revoke all on function private.astral_trance_skill_key_v1(text) from public,anon,authenticated;
grant execute on function private.astral_trance_skill_key_v1(text) to service_role;
