-- EXACT ORIGINAL PostgreSQL17 DnDWeb source, read-only 2026-11-05.
-- Source-qualified XPHB Fighter starting-market v3 local GoTrue tests only.
-- NEVER apply to production. No numbered SQL migrations in this file.

-- md5(pg_get_functiondef) private.format_copper_currency_v1(p_copper bigint) = f7f8dce93e3d20a5c35fccee0bcf374b
CREATE OR REPLACE FUNCTION private.format_copper_currency_v1(p_copper bigint)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_cp bigint:=greatest(0,coalesce(p_copper,0));
  v_gp bigint;
  v_sp bigint;
  v_rem bigint;
  v_out text:='';
begin
  v_gp:=v_cp/100;
  v_rem:=v_cp%100;
  v_sp:=v_rem/10;
  v_rem:=v_rem%10;
  if v_gp>0 then v_out:=v_gp||' gp'; end if;
  if v_sp>0 then v_out:=v_out||case when v_out<>'' then ' ' else '' end||v_sp||' sp'; end if;
  if v_rem>0 then v_out:=v_out||case when v_out<>'' then ' ' else '' end||v_rem||' cp'; end if;
  return case when v_out='' then '0 gp' else v_out end;
end;
$function$;

-- md5(pg_get_functiondef) private.player_forge_cash_equipment_option_v1(p_options jsonb) = 78231b02e56477cedd90992e42826597
CREATE OR REPLACE FUNCTION private.player_forge_cash_equipment_option_v1(p_options jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_group jsonb;
  v_key text;
  v_parts jsonb;
  v_copper bigint;
begin
  if jsonb_typeof(coalesce(p_options,'[]'::jsonb)) <> 'array' then return null; end if;

  for v_group in select value from jsonb_array_elements(coalesce(p_options,'[]'::jsonb)) loop
    if jsonb_typeof(v_group) <> 'object' then continue; end if;
    for v_key,v_parts in select key,value from jsonb_each(v_group) loop
      if jsonb_typeof(v_parts) <> 'array' or jsonb_array_length(v_parts)=0 then continue; end if;
      if exists(
        select 1
        from jsonb_array_elements(v_parts) p(value)
        where not (p.value ? 'value')
      ) then
        continue;
      end if;

      select coalesce(sum(greatest(0,coalesce(nullif(p.value->>'value','')::bigint,0))),0)
      into v_copper
      from jsonb_array_elements(v_parts) p(value);

      return jsonb_build_object(
        'key',upper(coalesce(v_key,'')),
        'parts',v_parts,
        'copper',coalesce(v_copper,0)
      );
    end loop;
  end loop;

  return null;
end;
$function$;
