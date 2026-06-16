-- Merchant alchemy duration qualifier preservation v3
-- Mirrors live migration: merchant_alchemy_duration_qualifiers_v3

create or replace function private.merchant_alchemy_duration_v1(
  p_duration text,
  p_duration_pct numeric default 0,
  p_die_steps integer default 0
)
returns text
language plpgsql
immutable
set search_path = pg_catalog, public, private
as $$
declare
  v_text text := nullif(btrim(p_duration), '');
  v_match text[];
  v_count numeric;
  v_die_size integer;
  v_unit text;
  v_suffix text := '';
  v_units text[] := array['round','minute','hour','day','week'];
  v_unit_seconds bigint[] := array[6,60,3600,86400,604800];
  v_index integer;
  v_seconds bigint;
  v_major bigint;
  v_minor bigint;
  v_scaled_dice integer;
  v_scaled_text text;
begin
  if v_text is null then
    return 'Until used';
  end if;

  if v_text ~* '^(instant|instantaneous|until\b)' then
    return regexp_replace(v_text, '^instantaneous$', 'Instant', 'i');
  end if;

  v_match := regexp_match(v_text, '^(\d+)d(\d+)\s*(round|minute|hour|day|week)s?(\s+.*)?$', 'i');
  if v_match is not null then
    v_count := v_match[1]::numeric;
    v_die_size := v_match[2]::integer;
    v_unit := lower(v_match[3]);
    v_suffix := coalesce(v_match[4], '');
    v_index := greatest(1, least(5, coalesce(array_position(v_units, v_unit), 1) + greatest(0, coalesce(p_die_steps, 0))));
    v_scaled_dice := greatest(1, ceil(v_count * (1 + greatest(0, coalesce(p_duration_pct, 0)) / 100.0) - 0.000000001)::integer);
    return v_scaled_dice::text || 'd' || v_die_size::text || ' ' || v_units[v_index]
      || case when v_scaled_dice = 1 then '' else 's' end || v_suffix;
  end if;

  v_match := regexp_match(v_text, '^(\d+(?:\.\d+)?)\s*(round|minute|hour|day|week)s?(\s+.*)?$', 'i');
  if v_match is null then
    return v_text;
  end if;

  v_count := v_match[1]::numeric;
  v_unit := lower(v_match[2]);
  v_suffix := coalesce(v_match[3], '');
  v_index := greatest(1, least(5, coalesce(array_position(v_units, v_unit), 1) + greatest(0, coalesce(p_die_steps, 0))));
  v_seconds := greatest(1, round(v_count * v_unit_seconds[v_index] * (1 + greatest(0, coalesce(p_duration_pct, 0)) / 100.0))::bigint);

  if v_seconds >= 604800 then
    v_major := v_seconds / 604800;
    v_minor := (v_seconds % 604800) / 86400;
    v_scaled_text := v_major::text || ' week' || case when v_major = 1 then '' else 's' end
      || case when v_minor > 0 then ' ' || v_minor::text || ' day' || case when v_minor = 1 then '' else 's' end else '' end;
  elsif v_seconds >= 86400 then
    v_major := v_seconds / 86400;
    v_minor := (v_seconds % 86400) / 3600;
    v_scaled_text := v_major::text || ' day' || case when v_major = 1 then '' else 's' end
      || case when v_minor > 0 then ' ' || v_minor::text || ' hour' || case when v_minor = 1 then '' else 's' end else '' end;
  elsif v_seconds >= 3600 then
    v_major := v_seconds / 3600;
    v_minor := (v_seconds % 3600) / 60;
    v_scaled_text := v_major::text || ' hour' || case when v_major = 1 then '' else 's' end
      || case when v_minor > 0 then ' ' || v_minor::text || ' minute' || case when v_minor = 1 then '' else 's' end else '' end;
  elsif v_seconds >= 60 then
    v_major := v_seconds / 60;
    v_minor := v_seconds % 60;
    v_scaled_text := v_major::text || ' minute' || case when v_major = 1 then '' else 's' end
      || case when v_minor > 0 then ' ' || v_minor::text || ' second' || case when v_minor = 1 then '' else 's' end else '' end;
  else
    v_scaled_text := v_seconds::text || ' second' || case when v_seconds = 1 then '' else 's' end;
  end if;

  return v_scaled_text || v_suffix;
end;
$$;

comment on function private.merchant_alchemy_duration_v1(text, numeric, integer)
is 'Scales merchant-crafted alchemy durations while preserving trailing qualifiers such as or 3 uses and after application.';
