-- Exact original five PG17 species source-magic helper definitions read-only 2026-11-05.
-- Research-only disposable local GoTrue. DO NOT DEPLOY.

-- md5 player_forge_best_casting_ability_v1 3dce158c3dfe14ff6776855b1ead5022
CREATE OR REPLACE FUNCTION private.player_forge_best_casting_ability_v1(p_sheet jsonb, p_allowed text[], p_class_ability text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_key text;
  v_score integer;
  v_modifier integer;
  v_best_key text := null;
  v_best_score integer := -999;
  v_best_modifier integer := -999;
  v_best_class_preferred boolean := false;
  v_class_key text := lower(coalesce(p_class_ability, ''));
  v_class_preferred boolean;
  v_rank integer;
  v_best_rank integer := 999;
begin
  foreach v_key in array coalesce(p_allowed, '{}'::text[]) loop
    v_key := lower(btrim(v_key));
    if v_key not in ('int','wis','cha','str','dex','con') then continue; end if;
    begin
      v_score := coalesce(nullif(p_sheet #>> array['abilities',v_key,'score'], '')::integer, 10);
    exception when others then
      v_score := 10;
    end;
    v_modifier := floor((v_score - 10)::numeric / 2)::integer;
    v_class_preferred := v_key = v_class_key;
    v_rank := case v_key when 'int' then 0 when 'wis' then 1 when 'cha' then 2 when 'str' then 3 when 'dex' then 4 else 5 end;
    if v_best_key is null
       or v_modifier > v_best_modifier
       or (v_modifier = v_best_modifier and v_class_preferred and not v_best_class_preferred)
       or (v_modifier = v_best_modifier and v_class_preferred = v_best_class_preferred and v_score > v_best_score)
       or (v_modifier = v_best_modifier and v_class_preferred = v_best_class_preferred and v_score = v_best_score and v_rank < v_best_rank) then
      v_best_key := v_key;
      v_best_score := v_score;
      v_best_modifier := v_modifier;
      v_best_class_preferred := v_class_preferred;
      v_best_rank := v_rank;
    end if;
  end loop;
  return v_best_key;
end;
$function$;

-- md5 player_forge_json_spell_min_level_v1 c6770a82adc7ee3b79151262474b7aed
CREATE OR REPLACE FUNCTION private.player_forge_json_spell_min_level_v1(p_node jsonb, p_spell_name text, p_level integer DEFAULT 1)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_type text := jsonb_typeof(p_node);
  v_key text;
  v_value jsonb;
  v_child integer;
  v_best integer := null;
  v_text text;
  v_next_level integer;
begin
  if p_node is null then return null; end if;
  if v_type = 'string' then
    v_text := p_node #>> '{}';
    v_text := split_part(split_part(v_text, '#', 1), '|', 1);
    if private.normalize_player_choice_name_v1(v_text) = private.normalize_player_choice_name_v1(p_spell_name) then
      return greatest(1, coalesce(p_level, 1));
    end if;
    return null;
  elsif v_type = 'array' then
    for v_value in select value from jsonb_array_elements(p_node) loop
      v_child := private.player_forge_json_spell_min_level_v1(v_value, p_spell_name, p_level);
      if v_child is not null and (v_best is null or v_child < v_best) then v_best := v_child; end if;
    end loop;
    return v_best;
  elsif v_type = 'object' then
    for v_key, v_value in select key, value from jsonb_each(p_node) loop
      v_next_level := coalesce(p_level, 1);
      if v_key ~ '^[0-9]+$' then v_next_level := greatest(v_next_level, v_key::integer); end if;
      v_child := private.player_forge_json_spell_min_level_v1(v_value, p_spell_name, v_next_level);
      if v_child is not null and (v_best is null or v_child < v_best) then v_best := v_child; end if;
    end loop;
    return v_best;
  end if;
  return null;
end;
$function$;

-- md5 player_forge_species_spell_choice_limit_v1 c9bc6081a43c52c44c1cf192886456df
CREATE OR REPLACE FUNCTION private.player_forge_species_spell_choice_limit_v1(p_trait jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_text text := lower(coalesce(p_trait::text, ''));
  v_match text[];
  v_value text;
begin
  v_match := regexp_match(v_text, '(one|two|three|four|[0-9]+)[[:space:]]+(?:of the following[[:space:]]+)?cantrips?(?:[[:space:]]+of your choice)?');
  if v_match is null then
    v_match := regexp_match(v_text, 'know[[:space:]]+(one|two|three|four|[0-9]+)[[:space:]]+of the following cantrips?');
  end if;
  if v_match is null and (v_text like '%cantrip%of your choice%' or v_text like '%one of the following cantrips%') then return 1; end if;
  if v_match is null then return null; end if;
  v_value := v_match[1];
  return case v_value when 'one' then 1 when 'two' then 2 when 'three' then 3 when 'four' then 4 else greatest(1, v_value::integer) end;
end;
$function$;

-- md5 player_forge_trait_has_spell_v1 deb38940c6249808a39aeb2380e09c16
CREATE OR REPLACE FUNCTION private.player_forge_trait_has_spell_v1(p_trait jsonb, p_spell_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  select exists (
    select 1
    from regexp_matches(coalesce(p_trait::text,''), E'\\{@spell\\s+([^}|]+)', 'gi') as match
    where private.normalize_player_choice_name_v1(match[1]) = private.normalize_player_choice_name_v1(p_spell_name)
  );
$function$;

-- md5 upsert_player_forge_source_magic_spell_v1 2a880d642809146678bd391304d9777c
CREATE OR REPLACE FUNCTION private.upsert_player_forge_source_magic_spell_v1(p_character_id uuid, p_spell_id uuid, p_source_type text, p_source_key text, p_source_label text, p_casting_stat text, p_uses_max integer DEFAULT NULL::integer, p_recharge text DEFAULT NULL::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_spell public.spells_catalog%rowtype;
begin
  select * into v_spell from public.spells_catalog where id=p_spell_id and public.is_preferred_spell_version_v1(id);
  if not found then raise exception 'Source magic references an unavailable or non-preferred spell.'; end if;
  insert into public.character_spells(
    character_id, spell_id, source_type, source_key, source_label, known, prepared,
    always_available, casting_stat, uses_remaining, uses_max, recharge, raw_payload, updated_at
  ) values (
    p_character_id, p_spell_id, p_source_type, p_source_key, p_source_label, true, true,
    true, nullif(lower(coalesce(p_casting_stat,'')),''), p_uses_max, p_uses_max, p_recharge,
    coalesce(p_payload,'{}'::jsonb) || jsonb_build_object('creator','shared_character_forge_source_magic_v1'), now()
  )
  on conflict(character_id,spell_id,source_type,source_key) do update
  set source_label=excluded.source_label,
      known=true,
      prepared=true,
      always_available=true,
      casting_stat=excluded.casting_stat,
      uses_remaining=excluded.uses_remaining,
      uses_max=excluded.uses_max,
      recharge=excluded.recharge,
      raw_payload=excluded.raw_payload,
      updated_at=now();
end;
$function$;
