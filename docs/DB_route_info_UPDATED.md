# DNDNext — DB Route Tables and Graph Routing (Option A)

**Last updated:** 2026-03-04

This document is the authoritative reference for the **route / road system** in Supabase Postgres:
- the `map_route_*` tables,
- how **legacy seq routes** work,
- how **Graph Mode** (`use_graph`) works (forks / dead-ends / retreading),
- and the common pitfalls that caused regressions.

---

## 1) Overview

There are four core route tables:

- `public.map_routes` — one row per route (metadata, visibility, loop, and **graph-mode flag**).
- `public.map_route_points` — ordered points (x,y) in a route, with optional `location_id` and `dwell_seconds`.
- `public.map_route_edges` — **graph edges** between points (**undirected**) used for Option A routing.
- `public.map_route_segments` — legacy/alternate edge table (also undirected). Keep documented; avoid using both for “routing truth” unless you intentionally need two layers.

### Key idea
- A *polyline* route is “point seq i → seq i+1”.
- A *road network* is a **graph**: a node can have **multiple neighbors** (forks), plus dead-end spurs that must be retread.

Graph routing is gated behind:
- `map_routes.use_graph = true`

If `use_graph = false`, the system behaves exactly like the old seq-based routes (no behavior change).

---

## 2) Table definitions (current expected columns)

> Note: historically some constraints were implemented via unique indexes rather than named constraints. During the graph migration we added explicit constraints to prevent duplicates and enforce canonical ordering.

### 2.1 `public.map_routes`
**Purpose:** top-level route metadata.

Common columns:
- `id BIGINT PK`
- `name TEXT`
- `code TEXT UNIQUE`
- `route_type TEXT DEFAULT 'trade'`
- `color TEXT`
- `is_loop BOOLEAN DEFAULT true`
- `is_visible BOOLEAN DEFAULT false`
- `created_at TIMESTAMPTZ DEFAULT timezone('utc', now())`
- **`use_graph BOOLEAN NOT NULL DEFAULT false`** ← Graph Mode gating flag (forks/dead-ends)

Operational meaning:
- `is_loop` controls what happens at the end of a seq route (legacy mode).
- `use_graph` controls whether the sim chooses next hops by **edges** instead of seq ordering.

### 2.2 `public.map_route_points`
**Purpose:** ordered vertices in a route.

Common columns:
- `id BIGINT PK`
- `route_id BIGINT` (logical FK to `map_routes.id`)
- `seq INT` (unique per route)
- `x DOUBLE PRECISION`
- `y DOUBLE PRECISION`
- `location_id BIGINT NULL` (optional stop)
- `dwell_seconds DOUBLE PRECISION DEFAULT 0`

Index/uniqueness:
- Unique `(route_id, seq)` (deterministic ordering per route)
- If you also have a **duplicate non-unique** `(route_id, seq)` index, it’s redundant (safe to drop after confirming).

### 2.3 `public.map_route_edges`
**Purpose:** graph adjacency for Option A routing.

Edges are stored as **undirected** (A—B), using canonical ordering:
- `a_point_id < b_point_id`

Common columns (post-migration):
- `id BIGINT PK`
- `route_id BIGINT`
- `a_point_id BIGINT`
- `b_point_id BIGINT`
- `edge_kind TEXT DEFAULT 'main'`  
  Allowed: `main | spur | return | excursion`
- `enabled BOOLEAN DEFAULT true`
- `weight NUMERIC NULL` (optional override for selection)
- `created_at TIMESTAMPTZ DEFAULT timezone('utc', now())`

Constraints / invariants:
- `a_point_id <> b_point_id` (no self-edges)
- `a_point_id < b_point_id` (canonical order)
- Unique edge per route: `(route_id, a_point_id, b_point_id)` (prevents duplicates)

**How to interpret an undirected edge**
If a character is at point `p`:
- If `p == a_point_id`, neighbor is `b_point_id`
- If `p == b_point_id`, neighbor is `a_point_id`

### 2.4 `public.map_route_segments`
**Purpose:** legacy/alternate undirected edge table.

Typical columns:
- `id BIGINT PK`
- `route_id BIGINT`
- `a_point_id BIGINT`
- `b_point_id BIGINT`
- `created_at TIMESTAMPTZ`

This table historically used the same undirected uniqueness pattern. If you keep both `segments` and `edges`, document which one is **authoritative** for routing. For Option A, `map_route_edges` is the routing source of truth.

---

## 3) Graph routing (Option A)

### 3.1 Gating behavior
- If `map_routes.use_graph = false`  
  → next hop uses legacy `route_next_seq_v1(route_id, current_seq)` (seq ordering)
- If `map_routes.use_graph = true`  
  → next hop uses graph picker (neighbors from `map_route_edges`)

### 3.2 Next-hop selection
The graph picker is designed to:
- support forks (multiple neighbors),
- support dead ends (only one neighbor → retread),
- avoid ping-ponging back to the previous point unless forced.

Selection uses:
- deterministic hashing (seed + day + character_id + current node) for stable behavior
- `edge_kind` + `route_mode` weighting:
  - trade routes: strongly prefer `main`, occasionally `spur`
  - excursion routes: prefer `spur`/`excursion` (configurable)

**Important:** because edges are undirected, a dead-end spur naturally “returns” by taking the only available neighbor. You don’t need explicit return edges unless you want asymmetric behavior.

---

## 4) How the simulation uses routes (high level)

Backend simulation is authoritative:
- `pg_cron` runs `sim_tick_v1()` → calls `advance_all_characters_v3(world_time)`
- `advance_all_characters_v3` maintains the character state machine and segment timestamps.

Routing responsibilities in the sim:
- When departing a stop, compute `next_point_seq`:
  - legacy: seq-next
  - graph: choose neighbor edge
- Set:
  - `segment_started_at`, `segment_ends_at` (duration computed from distance/speed/weather)
  - `prev_point_seq` (used to reduce immediate backtrack selection)
- Frontend interpolates position between points using segment timestamps (do **not** require per-frame DB x/y updates).

---

## 5) Editing routes safely

### 5.1 Legacy seq routes (use_graph=false)
- You are editing an ordered list. Movement is straight-line segment-by-seq.
- Curves require more points (polyline approximation).

### 5.2 Graph routes (use_graph=true)
- Points define geometry.
- Edges define connectivity (forks / dead ends).

**Fork example**
At junction point `J`, connect to multiple neighbors:
- add edges (J—A), (J—B), (J—C)

**Dead-end spur**
Leaf `L` connected only to junction `J`:
- edge (J—L) is sufficient.
- character retreads automatically.

### 5.3 Critical pitfall: inserting points / renumbering `seq`
If you renumber point `seq` values, any in-flight entity using seq indices can appear to “jump.”  
Graph mode reduces this risk because connectivity is by **point ids**, not seq — but your sim still tracks `current_point_seq` / `next_point_seq`, so keep seq consistent and avoid mass renumbering during live movement.

If you must renumber, do it when no one is moving on the route, or run a “rebase movers” repair that snaps movers to the nearest point and resets their seq pointers.

---

## 6) Debug and verification SQL

### 6.1 Confirm graph mode enabled
```sql
select id, name, use_graph
from public.map_routes
where id = <route_id>;
```

### 6.2 Find forks (nodes with degree > 2)
```sql
with deg as (
  select route_id, a_point_id as pid from public.map_route_edges where enabled
  union all
  select route_id, b_point_id as pid from public.map_route_edges where enabled
)
select route_id, pid, count(*) as degree
from deg
group by route_id, pid
having count(*) > 2
order by route_id, degree desc;
```

### 6.3 Validate edge integrity (canonical + kinds)
```sql
select *
from public.map_route_edges
where a_point_id >= b_point_id
   or a_point_id = b_point_id
   or edge_kind not in ('main','spur','return','excursion');
```

### 6.4 Inspect a moving character’s current leg
```sql
select name, route_id, state, current_point_seq, next_point_seq, prev_point_seq,
       segment_started_at, segment_ends_at
from public.characters
where name ilike '%<NAME>%';
```

### 6.5 Pull the actual A/B points used by the sim
```sql
with c as (
  select route_id, current_point_seq, next_point_seq
  from public.characters
  where name ilike '%<NAME>%'
  limit 1
)
select 'A' as which, rp.seq, rp.x, rp.y, rp.location_id
from c join public.map_route_points rp
  on rp.route_id=c.route_id and rp.seq=c.current_point_seq
union all
select 'B' as which, rp.seq, rp.x, rp.y, rp.location_id
from c join public.map_route_points rp
  on rp.route_id=c.route_id and rp.seq=c.next_point_seq;
```

---

## 7) Known regression traps (what bit us)

1) **Graph Mode saved but checkbox not checked**  
   DB had `use_graph=true` but frontend didn’t:
   - select `use_graph` in the route fetch
   - initialize editor state from DB
   - persist `use_graph` on save

2) **Postgres doesn’t support `ADD CONSTRAINT IF NOT EXISTS`**  
   Use `DO $$ ... IF NOT EXISTS (pg_constraint) THEN EXECUTE 'alter table ...'; END IF; $$;`

3) **Undirected edges require canonicalization**  
   Always store as `a_point_id < b_point_id` and dedupe after canonicalization.

4) **Two edge tables (`segments` and `edges`) cause confusion**  
   Document which one is authoritative. For Option A routing, use `map_route_edges`.

---

## 8) Recommendations

- Keep `map_route_edges` as the **only** routing truth for graph mode; treat `map_route_segments` as legacy or geometry-only unless there is a clear second role.
- Consider adding FK constraints (route_id → map_routes; point_id → map_route_points) when stable; if you intentionally avoid FKs for flexibility, document that decision.
- Add a small view `v_route_adjacency(route_id, from_point_id, to_point_id, edge_kind, weight, enabled)` to simplify neighbor queries.
- Keep route editing UI isolated (RoutesPanel / route editor component + hook) to reduce churn in `MapPageClient`.

---
