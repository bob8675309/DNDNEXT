CREATE OR REPLACE FUNCTION public.advance_all_characters_v3(p_now timestamp with time zone DEFAULT timezone('utc'::text, now()))
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  c         public.characters%rowtype;
  from_pt   public.map_route_points%rowtype;
  to_pt     public.map_route_points%rowtype;
  curr_pt   public.map_route_points%rowtype;

  v_route_type   text;
  v_is_loop      boolean;
  v_max_seq      integer;

  v_target_loc   bigint;
  v_target_seq   integer;
  v_next_seq     integer;

  v_dist           double precision;
  v_speed          double precision;
  v_travel_seconds double precision;
  v_alpha          double precision;

  v_dwell_hours int;
  v_dwell_seconds double precision;

  v_should_rest boolean;
  v_should_reroll boolean;
  v_theme text;

  v_stop_seed text;
  v_pick_seed text;
  v_roll double precision;
begin
  /* -------------------------------------------------------
     1) Advance all moving/excursion characters along a leg
     ------------------------------------------------------- */
  for c in
    select *
    from public.characters
    where kind in ('merchant','npc')
      and state in ('moving','excursion')
      and route_id is not null
  loop
    if c.segment_started_at is null or c.segment_ends_at is null then
      continue;
    end if;

    if p_now < c.segment_started_at then
      continue;
    end if;

    select * into from_pt
    from public.map_route_points
    where route_id = c.route_id
      and seq = coalesce(c.current_point_seq, c.route_point_seq)
    limit 1;

    select * into to_pt
    from public.map_route_points
    where route_id = c.route_id
      and seq = c.next_point_seq
    limit 1;

    if from_pt.id is null or to_pt.id is null then
      continue;
    end if;

    if p_now >= c.segment_ends_at then
      -- ARRIVED
      -- Dwell only at snapped points (location_id not null)
      v_dwell_hours := greatest(least(coalesce(c.dwell_hours, 4), 24), 1);

      v_dwell_seconds :=
        case
          when to_pt.location_id is null then 0
          else (v_dwell_hours::double precision) * 3600.0
        end;

      v_should_rest := (to_pt.location_id is not null and v_dwell_seconds > 0);

      -- deterministic reroll: only merchants, only when arriving at snapped location points
      v_should_reroll := false;
      if c.kind = 'merchant' and to_pt.location_id is not null then
        if c.state = 'excursion' then
          v_should_reroll := true;
        else
          -- 35% chance per snapped stop, deterministic by (merchant + location + hour bucket)
          v_stop_seed := c.id::text || '|' || to_pt.location_id::text || '|' || date_trunc('hour', p_now)::text || '|reroll35';
          v_roll := public.deterministic_rand(v_stop_seed);
          if v_roll < 0.35 then
            v_should_reroll := true;
          end if;
        end if;
      end if;

      if v_should_reroll then
        select coalesce(mp.theme, 'general')
        into v_theme
        from public.merchant_profiles mp
        where mp.merchant_id = c.id;

        perform public.reroll_merchant_inventory_v2(c.id, coalesce(v_theme,'general'), null);
      end if;

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

        state = case
          when v_should_rest then 'resting'
          else 'moving'
        end,

        rest_until = case
          when v_should_rest then p_now + make_interval(secs => v_dwell_seconds)
          else p_now
        end,

        last_known_location_id = coalesce(to_pt.location_id, c.last_known_location_id),

        -- when we hit the projected destination, clear it
        projected_destination_id = case
          when c.projected_destination_id is not null
           and c.projected_destination_id = to_pt.location_id
          then null
          else c.projected_destination_id
        end
      where id = c.id;

    else
      -- IN TRANSIT: interpolate
      v_travel_seconds := extract(epoch from (c.segment_ends_at - c.segment_started_at));
      if v_travel_seconds <= 0 then
        continue;
      end if;

      v_alpha :=
        least(1.0,
          greatest(0.0,
            extract(epoch from (p_now - c.segment_started_at)) / v_travel_seconds
          )
        );

      update public.characters
      set
        x = from_pt.x + (to_pt.x - from_pt.x) * v_alpha,
        y = from_pt.y + (to_pt.y - from_pt.y) * v_alpha,
        last_moved_at = p_now,
        route_segment_progress = v_alpha
      where id = c.id;
    end if;
  end loop;

  /* -------------------------------------------------------
     2) Plan next leg for characters ready to move
     ------------------------------------------------------- */
  for c in
    select *
    from public.characters
    where kind in ('merchant','npc')
      and state in ('resting','moving','excursion')
      and route_id is not null
      and (rest_until is null or rest_until <= p_now)
      and segment_started_at is null
      and segment_ends_at is null
  loop
    select r.route_type,
           r.is_loop,
           (select max(rp2.seq) from public.map_route_points rp2 where rp2.route_id = c.route_id)
    into v_route_type, v_is_loop, v_max_seq
    from public.map_routes r
    where r.id = c.route_id;

    if v_max_seq is null then
      continue;
    end if;

    select * into curr_pt
    from public.map_route_points rp
    where rp.route_id = c.route_id
      and rp.seq = coalesce(c.route_point_seq, c.current_point_seq, 1)
    limit 1;

    if curr_pt.id is null then
      continue;
    end if;

    v_next_seq := null;
    v_target_loc := null;
    v_target_seq := null;

    -- Trade routes: bias toward traveling from location to location
    if v_route_type = 'trade' then
      v_target_loc := c.projected_destination_id;

      -- validate target exists on this route
      if v_target_loc is not null then
        perform 1
        from public.map_route_points rp
        where rp.route_id = c.route_id
          and rp.location_id = v_target_loc
        limit 1;

        if not found then
          v_target_loc := null;
        end if;
      end if;

      -- pick a new target location deterministically if none
      if v_target_loc is null then
        -- deterministic pick based on (character + hour bucket)
        v_pick_seed := c.id::text || '|' || date_trunc('hour', p_now)::text || '|pick_target_loc';
        -- pick among distinct location_id values on the route excluding current location_id
        select loc_id
        into v_target_loc
        from (
          select distinct rp.location_id as loc_id
          from public.map_route_points rp
          where rp.route_id = c.route_id
            and rp.location_id is not null
            and (rp.location_id is distinct from curr_pt.location_id)
        ) t
        order by public.deterministic_rand(v_pick_seed || '|' || loc_id::text)
        limit 1;
      end if;

      if v_target_loc is not null then
        select rp.seq
        into v_target_seq
        from public.map_route_points rp
        where rp.route_id = c.route_id
          and rp.location_id = v_target_loc
        order by abs(rp.seq - curr_pt.seq)
        limit 1;
      end if;

      if v_target_seq is not null and v_target_seq <> curr_pt.seq then
        v_next_seq := public.pick_next_route_seq_toward_target(
          c.route_id,
          curr_pt.seq,
          v_target_seq,
          c.current_point_seq
        );
      end if;
    end if;

    -- fallback: random neighbor (your helper decides; we keep it as-is)
    if v_next_seq is null then
      v_next_seq := public.pick_next_route_seq(c.route_id, curr_pt.seq, c.current_point_seq);
      v_target_loc := null;
    end if;

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

    -- schedule travel time based on distance/speed
    v_dist := sqrt( (to_pt.x - curr_pt.x)^2 + (to_pt.y - curr_pt.y)^2 );
    v_speed := greatest(coalesce(c.roaming_speed, 0.001), 0.001);

    -- NOTE: still using your "map units per second" model here.
    v_travel_seconds := greatest(10.0, v_dist / v_speed);

    update public.characters
    set
      state = case when c.state = 'excursion' then 'excursion' else 'moving' end,
      current_point_seq = curr_pt.seq,
      next_point_seq = to_pt.seq,
      route_point_seq = curr_pt.seq,
      segment_started_at = p_now,
      segment_ends_at = p_now + make_interval(secs => v_travel_seconds),
      rest_until = null,
      route_segment_progress = 0.0,
      x = curr_pt.x,
      y = curr_pt.y,
      last_moved_at = p_now,
      projected_destination_id = v_target_loc
    where id = c.id;
  end loop;
end;
$function$;