begin;

create or replace function private.player_forge_json_spell_min_level_v1(
  p_node jsonb,
  p_spell_name text,
  p_level integer default 1
) returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
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
$$;

create or replace function private.player_forge_species_spell_choice_limit_v1(p_trait jsonb)
returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
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
$$;

revoke all on function private.player_forge_json_spell_min_level_v1(jsonb,text,integer) from public;
revoke all on function private.player_forge_species_spell_choice_limit_v1(jsonb) from public;

commit;
