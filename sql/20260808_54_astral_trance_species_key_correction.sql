-- Correct Astral Trance species eligibility after migration 52.
-- normalize_player_choice_name_v1 strips spaces, so Astral Elf normalizes to
-- `astralelf`, not `astral elf`.

create or replace function private.character_has_astral_trance_v1(p_character_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_species text;
  v_source text;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id;
  if not found then return false; end if;
  v_species:=private.normalize_player_choice_name_v1(coalesce(v_sheet->>'species',v_sheet->>'race',v_sheet#>>'{meta,species}',''));
  v_source:=upper(btrim(coalesce(v_sheet#>>'{meta,speciesSource}','')));
  return v_species='astralelf' and v_source='AAG';
end;
$$;

revoke all on function private.character_has_astral_trance_v1(uuid) from public,anon,authenticated;
grant execute on function private.character_has_astral_trance_v1(uuid) to service_role;
