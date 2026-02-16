-- ============================================================
-- DnDNext: Dwell-hours + movement + safe character patching
--
-- What this fixes:
-- 1) Allows UI sliders to persist dwell_hours via update_character()
-- 2) Makes dwelling happen ONLY at snapped route points (location_id IS NOT NULL)
-- 3) Uses per-character dwell_hours (1..24) instead of map_route_points.dwell_seconds
--
-- NOTE: Your cron is currently running advance_all_characters_v2 every 10s.
--       This script patches v2 in-place.
-- ============================================================

-- 0) Ensure columns exist (idempotent)
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS dwell_hours int;

-- Keep values sane
ALTER TABLE public.characters
  DROP CONSTRAINT IF EXISTS characters_dwell_hours_range;
ALTER TABLE public.characters
  ADD CONSTRAINT characters_dwell_hours_range
  CHECK (dwell_hours IS NULL OR (dwell_hours BETWEEN 1 AND 24));

-- 1) Expand update_character() to allow dwell_hours and projected_destination_id
CREATE OR REPLACE FUNCTION public.update_character(p_character_id uuid, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  -- Only update known/safe fields
  update public.characters
  set
    map_icon_id   = coalesce((p_patch->>'map_icon_id')::uuid, map_icon_id),
    sprite_path   = coalesce(p_patch->>'sprite_path', sprite_path),
    sprite_scale  = coalesce((p_patch->>'sprite_scale')::double precision, sprite_scale),
    roaming_speed = coalesce((p_patch->>'roaming_speed')::double precision, roaming_speed),
    dwell_hours   = coalesce((p_patch->>'dwell_hours')::int, dwell_hours),
    is_hidden     = coalesce((p_patch->>'is_hidden')::boolean, is_hidden),

    route_id      = coalesce((p_patch->>'route_id')::bigint, route_id),
    route_mode    = coalesce(p_patch->>'route_mode', route_mode),
    route_point_seq = coalesce((p_patch->>'route_point_seq')::int, route_point_seq),

    state         = coalesce(p_patch->>'state', state),
    rest_until    = coalesce((p_patch->>'rest_until')::timestamptz, rest_until),
    route_segment_progress = coalesce((p_patch->>'route_segment_progress')::double precision, route_segment_progress),
    current_point_seq = coalesce((p_patch->>'current_point_seq')::int, current_point_seq),
    next_point_seq    = coalesce((p_patch->>'next_point_seq')::int, next_point_seq),
    segment_started_at = coalesce((p_patch->>'segment_started_at')::timestamptz, segment_started_at),
    segment_ends_at    = coalesce((p_patch->>'segment_ends_at')::timestamptz, segment_ends_at),
    last_moved_at      = coalesce((p_patch->>'last_moved_at')::timestamptz, last_moved_at),

    projected_destination_id = coalesce((p_patch->>'projected_destination_id')::bigint, projected_destination_id),

    updated_at = timezone('utc', now())
  where id = p_character_id;
end;
$function$;

-- 2) Patch advance_all_characters_v2():
--    - Dwell only at snapped points
--    - Dwell duration comes from characters.dwell_hours
CREATE OR REPLACE FUNCTION public.advance_all_characters_v2(
  p_now timestamp with time zone DEFAULT timezone('utc'::text, now())
)
RETURNS void
LANGUAGE plpgsql
AS $function$
declare
  c         public.characters%rowtype;
  from_pt   public.map_route_points%rowtype;
  to_pt     public.map_route_points%rowtype;
  v_travel_seconds double precision;
  v_t double precision;
  v_dist double precision;
  v_speed double precision;
  v_dwell double precision;
  v_next_seq integer;
begin
  -------------------------------------------------------------------
  -- 1) ADVANCE ACTIVE SEGMENTS (interpolate position)
  -------------------------------------------------------------------
  for c in
    select *
    from public.characters
    where state in ('moving','excursion')
      and route_id is not null
      and segment_started_at is not null
      and segment_ends_at is not null
      and next_point_seq is not null
      and kind in ('merchant','npc')
  loop
    -- load from/to points
    select * into from_pt
    from public.map_route_points
    where route_id = c.route_id
      and seq = coalesce(c.current_point_seq, c.route_point_seq, 1)
    limit 1;

    select * into to_pt
    from public.map_route_points
    where route_id = c.route_id
      and seq = c.next_point_seq
    limit 1;

    if from_pt.id is null or to_pt.id is null then
      continue;
    end if;

    -- arrived?
    if p_now >= c.segment_ends_at then
      -- Dwell only at snapped points; duration is per-character dwell_hours (1..24)
      v_dwell := case
        when to_pt.location_id is not null
          then greatest(coalesce(c.dwell_hours, 4), 1) * 3600
        else 0
      end;

      update public.characters
      set
        x = to_pt.x,
        y = to_pt.y,
        route_point_seq = to_pt.seq,
        current_point_seq = to_pt.seq,
        next_point_seq = null,
        segment_started_at = null,
        segment_ends_at = null,
        route_segment_progress = 1.0,
        last_moved_at = p_now,
        state = case when v_dwell > 0 then 'resting' else (case when c.state = 'excursion' then 'excursion' else 'moving' end) end,
        rest_until = case when v_dwell > 0 then p_now + make_interval(secs => v_dwell) else p_now end,
        last_known_location_id = coalesce(to_pt.location_id, c.last_known_location_id),
        location_id = coalesce(to_pt.location_id, c.location_id)
      where id = c.id;

    else
      -- still traveling: interpolate 0..1
      v_travel_seconds := extract(epoch from (c.segment_ends_at - c.segment_started_at));
      if v_travel_seconds <= 0 then
        continue;
      end if;

      v_t := least(
              1.0,
              greatest(
                0.0,
                extract(epoch from (p_now - c.segment_started_at)) / v_travel_seconds
              )
            );

      update public.characters
      set
        x = from_pt.x + (to_pt.x - from_pt.x) * v_t,
        y = from_pt.y + (to_pt.y - from_pt.y) * v_t,
        route_segment_progress = v_t,
        last_moved_at = p_now
      where id = c.id;
    end if;
  end loop;

  -------------------------------------------------------------------
  -- 2) START NEW SEGMENTS FOR ELIGIBLE CHARACTERS (rest over)
  -------------------------------------------------------------------
  for c in
    select *
    from public.characters
    where kind in ('merchant','npc')
      and route_id is not null
      and state in ('resting','moving','excursion')
      and (rest_until is null or rest_until <= p_now)
      and (segment_started_at is null or segment_ends_at is null or next_point_seq is null)
  loop
    -- current point
    select * into from_pt
    from public.map_route_points
    where route_id = c.route_id
      and seq = coalesce(c.route_point_seq, c.current_point_seq, 1)
    limit 1;

    if from_pt.id is null then
      continue;
    end if;

    -- pick a neighbor using your edge-based helper
    v_next_seq := public.pick_next_route_seq(c.route_id, from_pt.seq, c.prev_point_seq);

    if v_next_seq is null then
      continue;
    end if;

    select * into to_pt
    from public.map_route_points
    where route_id = c.route_id
      and seq = v_next_seq
    limit 1;

    if to_pt.id is null then
      continue;
    end if;

    -- travel time based on distance/speed
    v_dist := sqrt( (to_pt.x - from_pt.x)^2 + (to_pt.y - from_pt.y)^2 );
    v_speed := greatest(coalesce(c.roaming_speed, 0.02), 0.001);

    -- IMPORTANT: This is seconds; tune min/max to taste
    v_travel_seconds := greatest(20.0, least(240.0, v_dist / v_speed));

    update public.characters
    set
      state = case when c.state = 'excursion' then 'excursion' else 'moving' end,
      prev_point_seq = from_pt.seq,
      current_point_seq = from_pt.seq,
      next_point_seq = to_pt.seq,
      segment_started_at = p_now,
      segment_ends_at = p_now + make_interval(secs => v_travel_seconds),
      route_segment_progress = 0.0,
      rest_until = null,
      x = from_pt.x,
      y = from_pt.y,
      last_moved_at = p_now,
      projected_destination_id = coalesce(projected_destination_id, to_pt.location_id)
    where id = c.id;
  end loop;
end;
$function$;
