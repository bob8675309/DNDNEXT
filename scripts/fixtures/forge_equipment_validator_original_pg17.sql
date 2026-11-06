-- Source-exact read-only live DnDWeb deferred sheet equipment validator.
-- Original MD5(pg_get_functiondef) 41cb1758bd2e1eb9b3998389deabb49b.
-- NEVER RUN ON PRODUCTION; loaded in disposable local PG17/GoTrue only.
CREATE OR REPLACE FUNCTION private.validate_player_forge_starting_equipment_sheet_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_sheet jsonb:=coalesce(new.sheet,'{}'::jsonb);
  v_selection jsonb;
  v_background_id uuid;
  v_background public.character_option_catalog%rowtype;
  v_sheet_background text;
  v_sheet_background_source text;
  v_level integer;
  v_roll integer;
  v_mode text;
  v_ruleset text;
  v_purchase jsonb;
begin
  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;
  if not (v_sheet ? 'startingEquipmentSelections') then return new; end if;
  if jsonb_typeof(v_sheet->'startingEquipmentSelections')<>'object' then
    raise exception 'startingEquipmentSelections must be a JSON object.';
  end if;

  v_selection:=v_sheet->'startingEquipmentSelections';
  v_mode:=lower(coalesce(nullif(v_selection->>'mode',''),'package'));
  v_ruleset:=lower(coalesce(nullif(v_selection->>'ruleset',''),case when v_mode='package' then 'vanilla' else 'dndnext-homebrew' end));
  if v_ruleset not in ('vanilla','dndnext-homebrew') then
    raise exception 'Unknown Player Forge starting-equipment ruleset.';
  end if;
  if v_mode not in ('market','package') then
    raise exception 'Unknown Player Forge starting-equipment mode.';
  end if;

  begin
    v_background_id:=nullif(v_selection->>'backgroundId','')::uuid;
  exception when invalid_text_representation then
    raise exception 'Starting equipment references an invalid Background id.';
  end;
  if v_background_id is null then raise exception 'Starting equipment must reference the selected Background.'; end if;

  select * into v_background
  from public.character_option_catalog
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
    begin
      v_roll:=(v_selection->>'wealthRoll')::integer;
    exception when others then
      raise exception 'Higher-level starting wealth roll must be a d10 result from 1 to 10.';
    end;
    if v_roll not between 1 and 10 then raise exception 'Higher-level starting wealth roll must be a d10 result from 1 to 10.'; end if;
  end if;
  if v_level>=5 and v_roll is null then raise exception 'Higher-level starting wealth requires a d10 result from 1 to 10.'; end if;
  if v_level<5 and v_roll is not null then raise exception 'A higher-level starting wealth roll is not used below level 5.'; end if;

  if v_mode='market' then
    if (v_selection ? 'marketPurchases') and jsonb_typeof(v_selection->'marketPurchases')<>'array' then
      raise exception 'Starting market purchases must be a JSON array.';
    end if;
    for v_purchase in select value from jsonb_array_elements(coalesce(v_selection->'marketPurchases','[]'::jsonb)) loop
      if jsonb_typeof(v_purchase)<>'object' then
        raise exception 'Each starting market purchase must be a JSON object.';
      end if;
      if nullif(v_purchase->>'merchantId','') is null or nullif(v_purchase->>'stockId','') is null then
        raise exception 'Each starting market purchase must identify its merchant and stock row.';
      end if;
      begin
        if coalesce(nullif(v_purchase->>'qty','')::integer,1)<1 then
          raise exception 'Starting market purchase quantity must be at least 1.';
        end if;
      exception when invalid_text_representation then
        raise exception 'Starting market purchase quantity must be a whole number.';
      end;
    end loop;
  end if;

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION private.validate_player_forge_starting_equipment_sheet_v1() FROM PUBLIC,anon,authenticated;
