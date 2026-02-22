-- recreate_cron_and_all_functions.sql
-- Export of pg_cron jobs and all referenced functions
-- Run as superuser or role with pg_cron permissions.
-- Generated: please set timestamp if desired.

-- ============================
-- Detected cron jobs (source)
-- ============================
-- jobid: 10
-- schedule: * * * * *
-- command: SELECT public.sim_tick_v1();
-- database: postgres
-- username: postgres
-- active: true

-- ===================================================================
-- NOTES:
-- - This script will CREATE/REPLACE the functions and schedule new cron
--   jobs using cron.schedule_in_database.
-- - To remove existing jobs safely you may call cron.unschedule(jobid)
--   as a superuser prior to scheduling. Unscheduling by numeric ID
--   requires appropriate permissions.
-- - Running schedule_in_database also requires pg_cron to be installed
--   and the executing role to have the required privileges.
-- ===================================================================


-- ============================
-- Function definitions
-- ============================

-- Function: public.sim_tick_v1()
CREATE OR REPLACE FUNCTION public.sim_tick_v1()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  ws public.world_state;
  last_ts timestamptz;
  real_delta_seconds double precision;
BEGIN
  -- Only one tick at a time
  IF NOT pg_try_advisory_lock(987654321) THEN
    RETURN;
  END IF;

  -- Gate: only allow one "real tick" about once per minute
  SELECT updated_at INTO last_ts
  FROM public.world_state
  WHERE id = 1;

  real_delta_seconds := EXTRACT(EPOCH FROM (now() - COALESCE(last_ts, now())));

  IF real_delta_seconds < 50 THEN
    PERFORM pg_advisory_unlock(987654321);
    RETURN;
  END IF;

  ws := public.advance_world_time_v1();

  BEGIN
    PERFORM public.advance_all_characters_v3(ws.world_time);
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  PERFORM pg_advisory_unlock(987654321);
END $function$;


-- Function: public.advance_world_time_v1()
CREATE OR REPLACE FUNCTION public.advance_world_time_v1()
 RETURNS world_state
 LANGUAGE plpgsql
AS $function$
DECLARE
  ws public.world_state;
  real_delta_seconds double precision;
  game_delta interval;
BEGIN
  SELECT * INTO ws FROM public.world_state WHERE id = 1 FOR UPDATE;

  real_delta_seconds := GREATEST(0, EXTRACT(EPOCH FROM (now() - ws.updated_at)));
  game_delta := make_interval(secs => real_delta_seconds * ws.time_scale);

  UPDATE public.world_state
  SET world_time = ws.world_time + game_delta,
      updated_at = now()
  WHERE id = 1
  RETURNING * INTO ws;

  RETURN ws;
END $function$;


-- Function: public.advance_all_characters_v3()
-- wrapper variant that calls the timestamp-taking variant with timezone('utc', now())
CREATE OR REPLACE FUNCTION public.advance_all_characters_v3()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  perform public.advance_all_characters_v3(timezone('utc', now()));
end;
$function$;


-- Function: public.advance_all_characters_v3(p_world_time timestamp with time zone)
CREATE OR REPLACE FUNCTION public.advance_all_characters_v3(p_world_time timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  c record;

  tod_min int;
  is_night boolean;
  is_evening_depart_window boolean;

  ws_seed bigint;
  day_num int;

  -- route points
  ax double precision; ay double precision; aloc bigint; adwell double precision;
  bx double precision; by_ double precision; bloc bigint; bdwell double precision;

  dist double precision;
  speed_units_per_hour numeric;
  travel_seconds_base double precision;
  travel_seconds double precision;

  -- weather
  biome_id int;
  wx_severity text;
  wx_mult int;
  wx_blocked boolean;

  -- progress
  seg_total double precision;
  seg_elapsed double precision;
  t double precision;

  -- dwell
  dwell_seconds_effective double precision;

  -- scheduling
  jitter int;
  next_morning timestamptz;
  depart_offset_min int;

  -- camp pause
  remaining_seconds double precision;

  -- merchant reroll chance
  reroll_roll int;
BEGIN
  -- Load world seed if present, otherwise fall back to 1337
  SELECT COALESCE(seed, 1337) INTO ws_seed
  FROM public.world_state
  WHERE id = 1;

  day_num := public.world_day_number(p_world_time);
  tod_min := public.world_time_minutes_of_day(p_world_time);

  is_night := (tod_min >= 20*60) OR (tod_min < 6*60);
  is_evening_depart_window := (tod_min >= 18*60) AND (tod_min < 20*60);

  -- Process characters that are due. Skip hidden characters.
  FOR c IN
    SELECT *
    FROM public.characters
    WHERE is_hidden = false
      AND state <> 'hidden'
      AND (next_action_at IS NULL OR next_action_at <= p_world_time)
    FOR UPDATE SKIP LOCKED
  LOOP
    -- deterministic jitter (0..29 seconds) stored for reference
    jitter := public.character_tick_jitter_seconds(c.id);

    -- If next_action_at is null, initialize it to "now + jitter" and skip this tick.
    IF c.next_action_at IS NULL THEN
      UPDATE public.characters
      SET next_action_at = p_world_time + make_interval(secs => jitter),
          tick_jitter_seconds = jitter
      WHERE id = c.id;
      CONTINUE;
    END IF;

    -- ------------------------------------------------------------
    -- A) Handle camping state (resume when allowed)
    -- ------------------------------------------------------------
    IF c.state = 'camping' THEN
      -- Determine biome for weather gating (use last_known_location if available)
      SELECT l.biome_id INTO biome_id
      FROM public.locations l
      WHERE l.id = COALESCE(c.last_known_location_id, c.location_id);

      SELECT severity, multiplier, blocked
      INTO wx_severity, wx_mult, wx_blocked
      FROM public.get_weather_for_biome_day_v1(biome_id, day_num, ws_seed)
      LIMIT 1;

      -- Resume only during travel hours AND when not weather-blocked (if camp_reason is weather)
      IF (NOT is_night) AND (COALESCE(c.camp_reason,'') <> 'weather' OR wx_blocked = false) THEN
        remaining_seconds := COALESCE(c.paused_remaining_seconds, 0);

        -- apply current weather multiplier to remaining duration
        travel_seconds := remaining_seconds * GREATEST(1, COALESCE(wx_mult, 1));

        UPDATE public.characters
        SET state = COALESCE(c.paused_state, 'moving'),
            paused_state = NULL,
            paused_remaining_seconds = NULL,
            camp_reason = NULL,
            camp_started_at = NULL,
            segment_started_at = p_world_time,
            segment_ends_at = p_world_time + make_interval(secs => travel_seconds),
            next_action_at = p_world_time + make_interval(secs => GREATEST(10, jitter)) -- small stagger
        WHERE id = c.id;

      ELSE
        -- stay camping; check again in ~1 minute of world time
        UPDATE public.characters
        SET next_action_at = p_world_time + interval '1 minute' + make_interval(secs => jitter)
        WHERE id = c.id;
      END IF;

      CONTINUE;
    END IF;

    -- ------------------------------------------------------------
    -- B) If it's night and character is currently moving/excursion, force camp
    -- ------------------------------------------------------------
    IF is_night AND c.state IN ('moving','excursion') THEN
      -- compute remaining seconds on segment, clamp >= 0
      remaining_seconds := GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(c.segment_ends_at, p_world_time) - p_world_time)));

      -- create deterministic camp event chance (night)
      SELECT l.biome_id INTO biome_id
      FROM public.locations l
      WHERE l.id = COALESCE(c.last_known_location_id, c.location_id);

      PERFORM public.maybe_create_camp_event_v1(p_world_time, c.id, 'night', 'light', biome_id, day_num, ws_seed);

      UPDATE public.characters
      SET paused_state = c.state,
          paused_remaining_seconds = remaining_seconds::int,
          state = 'camping',
          camp_reason = 'night',
          camp_started_at = p_world_time,
          location_id = NULL, -- ensure sprite-only state
          next_action_at = public.world_next_time_at(p_world_time, 6, 0) + make_interval(secs => jitter)
      WHERE id = c.id;

      CONTINUE;
    END IF;

    -- ------------------------------------------------------------
    -- C) If resting at a location and in 18:00–20:00, delay departure to 06:00–08:00
    -- ------------------------------------------------------------
    IF c.state = 'resting' AND c.location_id IS NOT NULL AND is_evening_depart_window THEN
      depart_offset_min := public.character_morning_depart_offset_minutes(c.id, day_num + 1, ws_seed); -- 0..120
      next_morning := public.world_next_time_at(p_world_time, 6, 0) + make_interval(mins => depart_offset_min);

      UPDATE public.characters
      SET next_action_at = next_morning,
          tick_jitter_seconds = jitter
      WHERE id = c.id;

      CONTINUE;
    END IF;

    -- ------------------------------------------------------------
    -- D) Resting at location: dwell until dwell_ends_at, then depart
    -- ------------------------------------------------------------
    IF c.state = 'resting' AND c.location_id IS NOT NULL THEN
      -- If dwell_ends_at is in the future, just wait.
      IF c.dwell_ends_at IS NOT NULL AND c.dwell_ends_at > p_world_time THEN
        UPDATE public.characters
        SET next_action_at = LEAST(c.dwell_ends_at, p_world_time + interval '30 minutes') + make_interval(secs => jitter),
            tick_jitter_seconds = jitter
        WHERE id = c.id;
        CONTINUE;
      END IF;

      -- Ensure route assigned
      IF c.route_id IS NULL THEN
        UPDATE public.characters
        SET next_action_at = p_world_time + interval '6 hours' + make_interval(secs => jitter)
        WHERE id = c.id;
        CONTINUE;
      END IF;

      -- Determine current seq (fallback to route_point_seq/current_point_seq)
      IF c.current_point_seq IS NULL THEN
        UPDATE public.characters
        SET current_point_seq = COALESCE(c.route_point_seq, 1)
        WHERE id = c.id;
        c.current_point_seq := COALESCE(c.route_point_seq, 1);
      END IF;

      c.next_point_seq := public.route_next_seq_v1(c.route_id, c.current_point_seq);

      -- Pull A and B points
      SELECT x,y,location_id,dwell_seconds INTO ax,ay,aloc,adwell
      FROM public.route_point_v1(c.route_id, c.current_point_seq);

      SELECT x,y,location_id,dwell_seconds INTO bx,by_,bloc,bdwell
      FROM public.route_point_v1(c.route_id, c.next_point_seq);

      IF ax IS NULL OR bx IS NULL THEN
        UPDATE public.characters
        SET next_action_at = p_world_time + interval '6 hours' + make_interval(secs => jitter)
        WHERE id = c.id;
        CONTINUE;
      END IF;

      -- Weather for biome of current location (resting at location)
      SELECT l.biome_id INTO biome_id
      FROM public.locations l
      WHERE l.id = c.location_id;

      SELECT severity, multiplier, blocked
      INTO wx_severity, wx_mult, wx_blocked
      FROM public.get_weather_for_biome_day_v1(biome_id, day_num, ws_seed)
      LIMIT 1;

      IF wx_blocked THEN
        -- Weather blocks travel: camp in-place (sprite on map) even though at location.
        -- Invariant says: if in location list => no sprite. So we remove location_id and camp.
        PERFORM public.maybe_create_camp_event_v1(p_world_time, c.id, 'weather', wx_severity, biome_id, day_num, ws_seed);

        UPDATE public.characters
        SET paused_state = 'resting',
            paused_remaining_seconds = 0,
            state = 'camping',
            camp_reason = 'weather',
            camp_started_at = p_world_time,
            location_id = NULL,
            last_known_location_id = c.location_id,
            next_action_at = p_world_time + interval '30 minutes' + make_interval(secs => jitter)
        WHERE id = c.id;

        CONTINUE;
      END IF;

      -- Compute travel duration
      dist := sqrt( (bx-ax)*(bx-ax) + (by_-ay)*(by_-ay) );
      speed_units_per_hour := COALESCE(c.move_speed_units_per_hour, 1.0);
      travel_seconds_base := CASE
        WHEN speed_units_per_hour <= 0 THEN 3600
        ELSE (dist / speed_units_per_hour::double precision) * 3600.0
      END;

      travel_seconds := travel_seconds_base * GREATEST(1, COALESCE(wx_mult, 1));

      UPDATE public.characters
      SET state = CASE WHEN c.route_mode = 'excursion' THEN 'excursion' ELSE 'moving' END,
          location_id = NULL,
          last_known_location_id = c.location_id,
          projected_destination_id = bloc,
          current_point_seq = c.current_point_seq,
          next_point_seq = c.next_point_seq,
          segment_started_at = p_world_time,
          segment_ends_at = p_world_time + make_interval(secs => travel_seconds),
          route_segment_progress = 0,
          next_action_at = p_world_time + interval '1 minute' + make_interval(secs => jitter),
          tick_jitter_seconds = jitter
      WHERE id = c.id;

      CONTINUE;
    END IF;

    -- ------------------------------------------------------------
    -- E) Moving/excursion: update progress; handle arrival; handle weather blocks
    -- ------------------------------------------------------------
    IF c.state IN ('moving','excursion') THEN
      -- Ensure route
      IF c.route_id IS NULL OR c.current_point_seq IS NULL OR c.next_point_seq IS NULL THEN
        UPDATE public.characters
        SET state = 'resting',
            projected_destination_id = NULL,
            location_id = COALESCE(c.last_known_location_id, c.location_id),
            next_action_at = p_world_time + interval '6 hours' + make_interval(secs => jitter)
        WHERE id = c.id;
        CONTINUE;
      END IF;

      -- Load points
      SELECT x,y,location_id,dwell_seconds INTO ax,ay,aloc,adwell
      FROM public.route_point_v1(c.route_id, c.current_point_seq);

      SELECT x,y,location_id,dwell_seconds INTO bx,by_,bloc,bdwell
      FROM public.route_point_v1(c.route_id, c.next_point_seq);

      IF ax IS NULL OR bx IS NULL THEN
        UPDATE public.characters
        SET state = 'resting',
            projected_destination_id = NULL,
            location_id = COALESCE(c.last_known_location_id, c.location_id),
            next_action_at = p_world_time + interval '6 hours' + make_interval(secs => jitter)
        WHERE id = c.id;
        CONTINUE;
      END IF;

      -- Weather based on last_known_location biome
      SELECT l.biome_id INTO biome_id
      FROM public.locations l
      WHERE l.id = COALESCE(c.last_known_location_id, c.location_id);

      SELECT severity, multiplier, blocked
      INTO wx_severity, wx_mult, wx_blocked
      FROM public.get_weather_for_biome_day_v1(biome_id, day_num, ws_seed)
      LIMIT 1;

      IF wx_blocked THEN
        remaining_seconds := GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(c.segment_ends_at, p_world_time) - p_world_time)));

        PERFORM public.maybe_create_camp_event_v1(p_world_time, c.id, 'weather', wx_severity, biome_id, day_num, ws_seed);

        UPDATE public.characters
        SET paused_state = c.state,
            paused_remaining_seconds = remaining_seconds::int,
            state = 'camping',
            camp_reason = 'weather',
            camp_started_at = p_world_time,
            location_id = NULL,
            next_action_at = p_world_time + interval '30 minutes' + make_interval(secs => jitter)
        WHERE id = c.id;

        CONTINUE;
      END IF;

      -- If arrived
      IF c.segment_ends_at IS NOT NULL AND c.segment_ends_at <= p_world_time THEN
        -- Snap to B
        UPDATE public.characters
        SET x = bx,
            y = by_,
            route_segment_progress = 1,
            current_point_seq = c.next_point_seq,
            next_point_seq = public.route_next_seq_v1(c.route_id, c.next_point_seq),
            last_known_location_id = COALESCE(bloc, c.last_known_location_id),
            projected_destination_id = NULL,
            segment_started_at = NULL,
            segment_ends_at = NULL
        WHERE id = c.id;

        -- If B is a stop (location_id not null), enter resting/dwell
        IF bloc IS NOT NULL THEN
          dwell_seconds_effective :=
            CASE
              WHEN COALESCE(bdwell, 0) > 0 THEN bdwell
              ELSE (COALESCE(c.dwell_hours, 6) * 3600)::double precision
            END;

          -- Merchant inventory reroll: 35% on town stop; 100% if returning from excursion
          IF c.kind = 'merchant' THEN
            reroll_roll := abs(hashtext(ws_seed::text || ':reroll:' || c.id::text || ':' || day_num::text || ':' || bloc::text)) % 100;

            IF c.state = 'excursion' OR reroll_roll < 35 THEN
              BEGIN
                PERFORM public.reroll_merchant_inventory_v2(c.id);
              EXCEPTION WHEN undefined_function THEN
                NULL;
              END;
            END IF;
          END IF;

          UPDATE public.characters
          SET state = 'resting',
              location_id = bloc,
              projected_destination_id = NULL,
              dwell_started_at = p_world_time,
              dwell_ends_at = p_world_time + make_interval(secs => dwell_seconds_effective),
              next_action_at = p_world_time + make_interval(secs => dwell_seconds_effective) + make_interval(secs => jitter)
          WHERE id = c.id;

          CONTINUE;
        END IF;

        -- If B is not a stop, immediately start next segment (subject to night window)
        IF is_night THEN
          remaining_seconds := 0;
          UPDATE public.characters
          SET paused_state = 'moving',
              paused_remaining_seconds = remaining_seconds::int,
              state = 'camping',
              camp_reason = 'night',
              camp_started_at = p_world_time,
              location_id = NULL,
              next_action_at = public.world_next_time_at(p_world_time, 6, 0) + make_interval(secs => jitter)
          WHERE id = c.id;

          CONTINUE;
        END IF;

        -- schedule next action soon to start the next segment
        UPDATE public.characters
        SET next_action_at = p_world_time + interval '5 seconds' + make_interval(secs => jitter)
        WHERE id = c.id;

        CONTINUE;
      END IF;

      -- Not arrived yet: update progress and x/y
      seg_total := GREATEST(1, EXTRACT(EPOCH FROM (COALESCE(c.segment_ends_at, p_world_time) - COALESCE(c.segment_started_at, p_world_time))));
      seg_elapsed := GREATEST(0, EXTRACT(EPOCH FROM (p_world_time - COALESCE(c.segment_started_at, p_world_time))));
      t := LEAST(1, seg_elapsed / seg_total);

      UPDATE public.characters
      SET x = ax + (bx - ax) * t,
          y = ay + (by_ - ay) * t,
          route_segment_progress = t,
          last_moved_at = timezone('utc', now()),
          next_action_at = p_world_time + interval '1 minute' + make_interval(secs => jitter),
          tick_jitter_seconds = jitter
      WHERE id = c.id;

      CONTINUE;
    END IF;

    -- ------------------------------------------------------------
    -- F) Default catch-all: re-check later
    -- ------------------------------------------------------------
    UPDATE public.characters
    SET next_action_at = p_world_time + interval '10 minutes' + make_interval(secs => jitter),
        tick_jitter_seconds = jitter
    WHERE id = c.id;

  END LOOP;
END $function$;