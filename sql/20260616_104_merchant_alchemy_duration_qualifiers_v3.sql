-- Mirrors live migration merchant_alchemy_duration_qualifiers_v3.
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
  v text := nullif(btrim(p_duration), '');
  m text[];
  units text[] := array['round','minute','hour','day','week'];
  unit_seconds bigint[] := array[6,60,3600,86400,604800];
  unit_name text;
  suffix text := '';
  idx integer;
  amount numeric;
  die_size integer;
  seconds bigint;
  major bigint;
  minor bigint;
  rendered text;
begin
  if v is null then return 'Until used'; end if;
  if v ~* '^(instant|instantaneous|until\b)' then
    return regexp_replace(v, '^instantaneous$', 'Instant', 'i');
  end if;

  m := regexp_match(
    v,
    '^((\d+)d(\d+)|(\d+(?:\.\d+)?))\s*(round|minute|hour|day|week)s?(\s+.*)?$',
    'i'
  );
  if m is null then return v; end if;

  unit_name := lower(m[5]);
  suffix := coalesce(m[6], '');
  idx := greatest(1, least(5,
    coalesce(array_position(units, unit_name), 1)
    + greatest(0, coalesce(p_die_steps, 0))
  ));

  if m[2] is not null then
    amount := greatest(1, ceil(
      m[2]::numeric * (1 + greatest(0, coalesce(p_duration_pct, 0)) / 100.0)
      - 0.000000001
    ));
    die_size := m[3]::integer;
    return amount::integer::text || 'd' || die_size::text || ' ' || units[idx]
      || case when amount = 1 then '' else 's' end || suffix;
  end if;

  amount := m[4]::numeric;
  seconds := greatest(1, round(
    amount * unit_seconds[idx]
    * (1 + greatest(0, coalesce(p_duration_pct, 0)) / 100.0)
  )::bigint);

  if seconds >= 604800 then
    major := seconds / 604800;
    minor := (seconds % 604800) / 86400;
    rendered := major || ' week' || case when major = 1 then '' else 's' end
      || case when minor > 0 then ' ' || minor || ' day' || case when minor = 1 then '' else 's' end else '' end;
  elsif seconds >= 86400 then
    major := seconds / 86400;
    minor := (seconds % 86400) / 3600;
    rendered := major || ' day' || case when major = 1 then '' else 's' end
      || case when minor > 0 then ' ' || minor || ' hour' || case when minor = 1 then '' else 's' end else '' end;
  elsif seconds >= 3600 then
    major := seconds / 3600;
    minor := (seconds % 3600) / 60;
    rendered := major || ' hour' || case when major = 1 then '' else 's' end
      || case when minor > 0 then ' ' || minor || ' minute' || case when minor = 1 then '' else 's' end else '' end;
  elsif seconds >= 60 then
    major := seconds / 60;
    minor := seconds % 60;
    rendered := major || ' minute' || case when major = 1 then '' else 's' end
      || case when minor > 0 then ' ' || minor || ' second' || case when minor = 1 then '' else 's' end else '' end;
  else
    rendered := seconds || ' second' || case when seconds = 1 then '' else 's' end;
  end if;

  return rendered || suffix;
end;
$$;
