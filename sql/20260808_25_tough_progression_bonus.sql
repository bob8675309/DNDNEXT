-- Tough grants +2 maximum HP per character level. The source-owned acquisition helper
-- applies 2 * acquisition level immediately. This hook adds only the +2 for later levels.

create or replace function private.apply_tough_progression_bonus_v1(
  p_character_id uuid,
  p_to_level integer
)
returns integer
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_tough_acquired integer;
  v_sheet jsonb:='{}'::jsonb;
  v_hp integer:=0;
  v_max integer:=0;
begin
  select min(gi.acquired_level) into v_tough_acquired
  from public.character_option_grant_instances gi
  where gi.character_id=p_character_id
    and private.normalize_player_choice_name_v1(gi.option_name)='tough';

  if v_tough_acquired is null or v_tough_acquired >= p_to_level then return 0; end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id for update;
  begin v_hp:=coalesce((v_sheet->>'hp')::integer,0); exception when others then v_hp:=0; end;
  begin v_max:=coalesce((v_sheet->>'maxHp')::integer,v_hp); exception when others then v_max:=v_hp; end;
  v_sheet:=jsonb_set(v_sheet,'{hp}',to_jsonb(greatest(1,v_hp+2)),true);
  v_sheet:=jsonb_set(v_sheet,'{maxHp}',to_jsonb(greatest(1,v_max+2)),true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  return 2;
end;
$$;

revoke all on function private.apply_tough_progression_bonus_v1(uuid,integer) from public,anon,authenticated;
grant execute on function private.apply_tough_progression_bonus_v1(uuid,integer) to service_role;
