-- DNDNext Option A (Graph Edges) - Phase 1 Migration
-- SAFE: does not change movement unless you explicitly set map_routes.use_graph = true

begin;

-- 1) Route-level toggle for graph navigation
alter table public.map_routes
  add column if not exists use_graph boolean not null default false;

-- 2) Edge metadata for fork weighting and enable/disable
alter table public.map_route_edges
  add column if not exists edge_kind text not null default 'main';

alter table public.map_route_edges
  add column if not exists enabled boolean not null default true;

alter table public.map_route_edges
  add column if not exists weight numeric;

-- 3) Normalize existing edges to undirected canonical ordering (a_point_id < b_point_id)
--    so we can safely add a unique constraint and avoid A-B vs B-A duplicates.
update public.map_route_edges
set a_point_id = least(a_point_id, b_point_id),
    b_point_id = greatest(a_point_id, b_point_id)
where a_point_id > b_point_id;

-- Remove exact duplicates after normalization (keep smallest id)
delete from public.map_route_edges e
using public.map_route_edges d
where e.route_id = d.route_id
  and e.a_point_id = d.a_point_id
  and e.b_point_id = d.b_point_id
  and e.id > d.id;

-- 4) Constraints (idempotent)
alter table public.map_route_edges
  add constraint if not exists map_route_edges_no_self
  check (a_point_id <> b_point_id);

alter table public.map_route_edges
  add constraint if not exists map_route_edges_canonical_order
  check (a_point_id < b_point_id);

alter table public.map_route_edges
  add constraint if not exists map_route_edges_kind_check
  check (edge_kind in ('main','spur','return','excursion'));

alter table public.map_route_edges
  add constraint if not exists map_route_edges_unique
  unique (route_id, a_point_id, b_point_id);

-- 5) Backfill edge_kind from seq adjacency (best-effort)
--    Sequential edges are treated as "main"; everything else defaults to "spur".
with mm as (
  select route_id, min(seq) as min_seq, max(seq) as max_seq
  from public.map_route_points
  group by route_id
),
pairs as (
  select
    e.id,
    e.route_id,
    pa.seq as a_seq,
    pb.seq as b_seq,
    r.is_loop,
    mm.min_seq,
    mm.max_seq
  from public.map_route_edges e
  join public.map_route_points pa on pa.id = e.a_point_id
  join public.map_route_points pb on pb.id = e.b_point_id
  join public.map_routes r on r.id = e.route_id
  join mm on mm.route_id = e.route_id
)
update public.map_route_edges e
set edge_kind = case
  when abs(p.a_seq - p.b_seq) = 1 then 'main'
  when p.is_loop and (
    (p.a_seq = p.min_seq and p.b_seq = p.max_seq) or
    (p.a_seq = p.max_seq and p.b_seq = p.min_seq)
  ) then 'main'
  else 'spur'
end
from pairs p
where p.id = e.id;

commit;

-- Sanity check: should be zero unless you've already added forks.
-- select route_id, a_point_id, count(*) from public.map_route_edges group by route_id, a_point_id having count(*) > 1;
