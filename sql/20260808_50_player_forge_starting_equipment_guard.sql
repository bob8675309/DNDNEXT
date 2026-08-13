-- Tighten the staged Player Forge starting-equipment authority before deployment.
-- Bind the submitted Background equipment id to the Background actually recorded
-- on the character sheet and expose whether character-scoped currency exists.

alter table public.character_currency enable row level security;

create or replace function private.validate_player_forge_starting_equipment_sheet_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:=coalesce(new.sheet,'{}'::jsonb);
  v_selection jsonb;
  v_background_id uuid;
  v_background public.character_option_catalog%rowtype;
  v_sheet_background text;
  v_sheet_background_source text;
  v_level integer;
  v_roll integer;
begin
  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;
  if not (v_sheet ? 'startingEquipmentSelections') then return new; end if;
  if jsonb_typeof(v_sheet->'startingEquipmentSelections')<>'object' then
    raise exception 'startingEquipmentSelections must be a JSON object.';
  end if;

  v_selection:=v_sheet->'startingEquipmentSelections';
  begin
    v_background_id:=nullif(v_selection->>'backgroundId','')::uuid;
  exception when invalid_text_representation then
    raise exception 'Starting equipment references an invalid Background id.';
  end;
  if v_background_id is null then raise exception 'Starting equipment must reference the selected Background.'; end if;

  select * into v_background from public.character_option_catalog
  where id=v_background_id and option_type='background';
  if not found then raise exception 'Starting equipment references an unavailable Background.'; end if;

  v_sheet_background:=lower(regexp_replace(btrim(coalesce(v_sheet->>'background',v_sheet#>>'{meta,background}','')),'[^a-zA-Z0-9]+','','g'));
  if v_sheet_background='' or v_sheet_background<>lower(regexp_replace(btrim(coalesce(v_background.name,'')),'[^a-zA-Z0-9]+','','g')) then
    raise exception 'Starting equipment Background does not match the character Background.';
  end if;

  v_sheet_background_source:=upper(btrim(coalesce(v_sheet#>>'{meta,backgroundSource}','')));
  if v_sheet_background_source<>'' and v_sheet_background_source<>upper(btrim(coalesce(v_background.source,''))) then
    raise exception 'Starting equipment Background source does not match the character Background source.';
  end if;

  v_level:=greatest(1,least(20,coalesce(nullif(v_sheet->>'level','')::integer,nullif(v_sheet#>>'{meta,level}','')::integer,1)));
  if nullif(v_selection->>'wealthRoll','') is not null then
    begin v_roll:=(v_selection->>'wealthRoll')::integer;
    exception when others then raise exception 'Higher-level starting wealth roll must be a d10 result from 1 to 10.'; end;
    if v_roll not between 1 and 10 then raise exception 'Higher-level starting wealth roll must be a d10 result from 1 to 10.'; end if;
  end if;
  if v_level>=5 and v_roll is null then raise exception 'Higher-level starting wealth requires a d10 result from 1 to 10.'; end if;
  if v_level<5 and v_roll is not null then raise exception 'A higher-level starting wealth roll is not used below level 5.'; end if;

  return new;
end;
$$;

drop trigger if exists character_sheets_validate_player_forge_starting_equipment_v1 on public.character_sheets;
create constraint trigger character_sheets_validate_player_forge_starting_equipment_v1
after insert or update of sheet on public.character_sheets
deferrable initially deferred
for each row execute function private.validate_player_forge_starting_equipment_sheet_v1();

create or replace function public.get_character_currency_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_row public.character_currency%rowtype;
begin
  if not private.can_access_character_v1(p_character_id,'inventory') then
    raise exception 'You do not have permission to view this character currency.' using errcode='42501';
  end if;
  select * into v_row from public.character_currency where character_id=p_character_id;
  if not found then
    return jsonb_build_object(
      'characterId',p_character_id,
      'hasBalance',false,
      'copperValue',0,
      'display','0 gp',
      'sourceBreakdown','{}'::jsonb
    );
  end if;
  return jsonb_build_object(
    'characterId',p_character_id,
    'hasBalance',true,
    'copperValue',v_row.copper_value,
    'display',private.format_copper_currency_v1(v_row.copper_value),
    'sourceBreakdown',coalesce(v_row.source_breakdown,'{}'::jsonb)
  );
end;
$$;

revoke all on function private.validate_player_forge_starting_equipment_sheet_v1() from public,anon,authenticated;
grant execute on function private.validate_player_forge_starting_equipment_sheet_v1() to service_role;
revoke all on function public.get_character_currency_v1(uuid) from public,anon;
grant execute on function public.get_character_currency_v1(uuid) to authenticated,service_role;
