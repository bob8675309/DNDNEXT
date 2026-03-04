-- DNDNext Option A (Graph Edges) - Phase 2 Functions
-- Adds graph-aware next-seq picking while preserving legacy behavior.

-- Picks next seq using graph edges (map_route_edges) as an undirected adjacency list.
-- Trade mode strongly prefers the legacy "canonical" next seq (route_next_seq_v1) when present.
create or replace function public.route_next_seq_graph_v2(
  p_route_id bigint,
  p_current_seq int,
  p_prev_seq int,
  p_route_mode text,
  p_seed bigint,
  p_day_num int,
  p_character_id uuid
) returns int
language plpgsql
stable
as $function$
declare
  cur_id bigint;
  canonical_next int;

  rec record;
  w numeric;
  total numeric := 0;
  pick numeric;
  r float8;

  candidates int[] := '{}';
  weights numeric[] := '{}';
  n int := 0;
  i int;
begin
  -- resolve current point id
  select id into cur_id
  from public.map_route_points
  where route_id = p_route_id and seq = p_current_seq
  limit 1;

  if cur_id is null then
    return null;
  end if;

  -- canonical next from legacy ordering (used as a strong bias for trade routes)
  canonical_next := public.route_next_seq_v1(p_route_id, p_current_seq);

  for rec in
    with nbr as (
      select
        case
          when e.a_point_id = cur_id then e.b_point_id
          else e.a_point_id
        end as nbr_id,
        coalesce(e.edge_kind, 'main') as edge_kind,
        e.weight as weight
      from public.map_route_edges e
      where e.route_id = p_route_id
        and coalesce(e.enabled, true) = true
        and (e.a_point_id = cur_id or e.b_point_id = cur_id)
    )
    select p.seq as next_seq, nbr.edge_kind, nbr.weight
    from nbr
    join public.map_route_points p on p.id = nbr.nbr_id
  loop
    n := n + 1;

    -- base weights by mode + edge_kind (overrideable by edge.weight)
    if rec.weight is not null then
      w := rec.weight;
    else
      if coalesce(p_route_mode,'') = 'excursion' then
        w := case rec.edge_kind
              when 'spur' then 80
              when 'main' then 20
              when 'return' then 40
              when 'excursion' then 100
              else 20
             end;
      else
        -- trade/default
        w := case rec.edge_kind
              when 'main' then 100
              when 'spur' then 15
              when 'return' then 50
              when 'excursion' then 20
              else 30
             end;
      end if;
    end if;

    -- Trade routes: heavily prefer the canonical legacy next seq when present.
    if coalesce(p_route_mode,'') <> 'excursion' and canonical_next is not null and rec.next_seq = canonical_next then
      w := w * 25;
    end if;

    -- Avoid immediate backtrack unless forced.
    if p_prev_seq is not null and rec.next_seq = p_prev_seq then
      if n > 1 and (canonical_next is null or rec.next_seq <> canonical_next) then
        w := w * 0.05;
      end if;
    end if;

    candidates := array_append(candidates, rec.next_seq);
    weights := array_append(weights, w);
    total := total + w;
  end loop;

  if n = 0 then
    return null;
  end if;

  if n = 1 then
    return candidates[1];
  end if;

  -- deterministic random in [0,total)
  r := (abs(hashtext(p_seed::text || ':routepick:' || p_day_num::text || ':' || p_character_id::text || ':' || p_route_id::text || ':' || p_current_seq::text)) % 1000000)::float8 / 1000000.0;
  pick := r * total;

  total := 0;
  for i in 1..n loop
    total := total + weights[i];
    if pick <= total then
      return candidates[i];
    end if;
  end loop;

  return candidates[n];
end;
$function$;

-- Wrapper that preserves legacy behavior unless map_routes.use_graph is enabled.
create or replace function public.route_next_seq_pick_v2(
  p_route_id bigint,
  p_current_seq int,
  p_prev_seq int,
  p_route_mode text,
  p_seed bigint,
  p_day_num int,
  p_character_id uuid
) returns int
language plpgsql
stable
as $function$
declare
  use_graph boolean;
begin
  select r.use_graph into use_graph
  from public.map_routes r
  where r.id = p_route_id;

  if coalesce(use_graph, false) then
    return public.route_next_seq_graph_v2(p_route_id, p_current_seq, p_prev_seq, p_route_mode, p_seed, p_day_num, p_character_id);
  end if;

  return public.route_next_seq_v1(p_route_id, p_current_seq);
end;
$function$;
