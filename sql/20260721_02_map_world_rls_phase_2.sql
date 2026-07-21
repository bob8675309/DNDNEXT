-- DNDNext map/world RLS hardening, phase 2.
-- Keeps campaign map reference data readable while restricting all mutations
-- to administrators or internal/scheduled database execution.

begin;

-- ---------------------------------------------------------------------------
-- Replace legacy policy overlap with one explicit access model per table.
-- ---------------------------------------------------------------------------

do $policies$
declare
  policy_row record;
begin
  for policy_row in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'locations', 'quests', 'map_routes', 'map_route_points',
        'map_route_edges', 'map_route_segments', 'map_icons',
        'location_icons', 'world_state', 'biomes', 'world_events',
        'town_map_labels', 'town_map_flags', 'npc_portrait_library'
      ])
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end
$policies$;

alter table public.locations enable row level security;
alter table public.quests enable row level security;
alter table public.map_routes enable row level security;
alter table public.map_route_points enable row level security;
alter table public.map_route_edges enable row level security;
alter table public.map_route_segments enable row level security;
alter table public.map_icons enable row level security;
alter table public.location_icons enable row level security;
alter table public.world_state enable row level security;
alter table public.biomes enable row level security;
alter table public.world_events enable row level security;
alter table public.town_map_labels enable row level security;
alter table public.town_map_flags enable row level security;
alter table public.npc_portrait_library enable row level security;

-- Hidden locations and routes remain available to admins but do not leak to
-- ordinary callers. Separate anon/authenticated policies avoid calling private
-- authorization helpers for unauthenticated requests.
create policy locations_select_visible_anon
on public.locations for select to anon
using (not coalesce(is_hidden, false));

create policy locations_select_visible_or_admin
on public.locations for select to authenticated
using (not coalesce(is_hidden, false) or (select private.current_user_is_admin()));

create policy locations_admin_write
on public.locations for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy map_routes_select_visible_anon
on public.map_routes for select to anon
using (coalesce(is_visible, true));

create policy map_routes_select_visible_or_admin
on public.map_routes for select to authenticated
using (coalesce(is_visible, true) or (select private.current_user_is_admin()));

create policy map_routes_admin_write
on public.map_routes for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

-- Route geometry inherits visibility from its parent route.
create policy map_route_points_select_visible_anon
on public.map_route_points for select to anon
using (exists (select 1 from public.map_routes r where r.id = route_id));

create policy map_route_points_select_visible_or_admin
on public.map_route_points for select to authenticated
using (exists (select 1 from public.map_routes r where r.id = route_id));

create policy map_route_points_admin_write
on public.map_route_points for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy map_route_edges_select_visible_anon
on public.map_route_edges for select to anon
using (exists (select 1 from public.map_routes r where r.id = route_id));

create policy map_route_edges_select_visible_or_admin
on public.map_route_edges for select to authenticated
using (exists (select 1 from public.map_routes r where r.id = route_id));

create policy map_route_edges_admin_write
on public.map_route_edges for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy map_route_segments_select_visible_anon
on public.map_route_segments for select to anon
using (exists (select 1 from public.map_routes r where r.id = route_id));

create policy map_route_segments_select_visible_or_admin
on public.map_route_segments for select to authenticated
using (exists (select 1 from public.map_routes r where r.id = route_id));

create policy map_route_segments_admin_write
on public.map_route_segments for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

-- Reference catalogues: callers see active entries; admins see and manage all.
create policy map_icons_select_active_anon
on public.map_icons for select to anon
using (coalesce(is_active, true));

create policy map_icons_select_active_or_admin
on public.map_icons for select to authenticated
using (coalesce(is_active, true) or (select private.current_user_is_admin()));

create policy map_icons_admin_write
on public.map_icons for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy location_icons_select_active_anon
on public.location_icons for select to anon
using (coalesce(is_active, true) and coalesce(enabled, true));

create policy location_icons_select_active_or_admin
on public.location_icons for select to authenticated
using ((coalesce(is_active, true) and coalesce(enabled, true)) or (select private.current_user_is_admin()));

create policy location_icons_admin_write
on public.location_icons for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy npc_portrait_library_select_active
on public.npc_portrait_library for select to authenticated
using (coalesce(is_active, true) or (select private.current_user_is_admin()));

create policy npc_portrait_library_admin_write
on public.npc_portrait_library for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

-- Campaign reference/state tables.
create policy quests_select_public
on public.quests for select to anon, authenticated
using (true);

create policy quests_admin_write
on public.quests for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy biomes_select_public
on public.biomes for select to anon, authenticated
using (true);

create policy biomes_admin_write
on public.biomes for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy world_state_select_public
on public.world_state for select to anon, authenticated
using (true);

create policy world_state_admin_write
on public.world_state for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

-- Event payloads are DM/internal state and are not exposed to ordinary players.
create policy world_events_admin_access
on public.world_events for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

-- Town presentation remains readable to signed-in users. The prior permissive
-- insert/update/delete policies are intentionally replaced by admin-only writes.
create policy town_map_labels_select_authenticated
on public.town_map_labels for select to authenticated
using (true);

create policy town_map_labels_admin_write
on public.town_map_labels for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy town_map_flags_select_authenticated
on public.town_map_flags for select to authenticated
using (true);

create policy town_map_flags_admin_write
on public.town_map_flags for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

-- ---------------------------------------------------------------------------
-- Narrow Data API grants to the operations the policies intentionally expose.
-- ---------------------------------------------------------------------------

revoke all on table public.locations, public.quests, public.map_routes,
  public.map_route_points, public.map_route_edges, public.map_route_segments,
  public.map_icons, public.location_icons, public.world_state, public.biomes,
  public.world_events, public.town_map_labels, public.town_map_flags,
  public.npc_portrait_library from public, anon, authenticated;

grant select on table public.locations, public.quests, public.map_routes,
  public.map_route_points, public.map_route_edges, public.map_route_segments,
  public.map_icons, public.location_icons, public.world_state, public.biomes
to anon, authenticated;

grant select on table public.town_map_labels, public.town_map_flags,
  public.npc_portrait_library, public.world_events to authenticated;

grant insert, update, delete on table public.locations, public.quests,
  public.map_routes, public.map_route_points, public.map_route_edges,
  public.map_route_segments, public.map_icons, public.location_icons,
  public.world_state, public.biomes, public.world_events, public.town_map_labels,
  public.town_map_flags, public.npc_portrait_library to authenticated;

grant all on table public.locations, public.quests, public.map_routes,
  public.map_route_points, public.map_route_edges, public.map_route_segments,
  public.map_icons, public.location_icons, public.world_state, public.biomes,
  public.world_events, public.town_map_labels, public.town_map_flags,
  public.npc_portrait_library to service_role;

-- Views must obey the caller's RLS policies on the route tables.
alter view public.v_route_adjacent_points set (security_invoker = true);
alter view public.v_trade_stops set (security_invoker = true);
revoke all on table public.v_route_adjacent_points, public.v_trade_stops
from public, anon, authenticated;
grant select on table public.v_route_adjacent_points, public.v_trade_stops
to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mutating simulation RPCs are internal unless explicitly guarded for admins.
-- ---------------------------------------------------------------------------

create or replace function public.admin_advance_all_characters_v1(
  p_world_time timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
begin
  if auth.uid() is null or not private.current_user_is_admin() then
    raise exception 'Only an administrator can advance map characters' using errcode = '42501';
  end if;

  if p_world_time is null then
    perform public.advance_all_characters_v3();
  else
    perform public.advance_all_characters_v3(p_world_time);
  end if;
end;
$function$;

-- Preserve the established RPC name used by the admin travel drawer, but add
-- caller authorization and a pinned search path to the legacy definer function.
create or replace function public.set_merchant_route(
  p_merchant_id uuid,
  p_route_id bigint,
  p_start_seq integer default 1,
  p_mode text default 'trade'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
begin
  if auth.uid() is null or not private.current_user_is_admin() then
    raise exception 'Only an administrator can assign map routes' using errcode = '42501';
  end if;

  perform 1 from public.characters where id = p_merchant_id;
  if not found then
    raise exception 'character % not found', p_merchant_id;
  end if;

  if p_route_id is not null then
    perform 1 from public.map_routes where id = p_route_id;
    if not found then
      raise exception 'route % not found', p_route_id;
    end if;
  end if;

  update public.characters
  set route_id = p_route_id,
      route_point_seq = greatest(coalesce(p_start_seq, 1), 1),
      route_mode = coalesce(nullif(p_mode, ''), 'trade'),
      state = case when p_route_id is null then 'resting' else 'moving' end,
      rest_until = null,
      route_segment_progress = 0,
      current_point_seq = null,
      next_point_seq = null,
      segment_started_at = null,
      segment_ends_at = null,
      last_moved_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = p_merchant_id;
end;
$function$;

revoke all on function public.admin_advance_all_characters_v1(timestamptz) from public, anon;
grant execute on function public.admin_advance_all_characters_v1(timestamptz) to authenticated, service_role;

revoke all on function public.set_merchant_route(uuid,bigint,integer,text) from public, anon;
grant execute on function public.set_merchant_route(uuid,bigint,integer,text) to authenticated, service_role;

-- Scheduled/internal functions remain callable by postgres/service_role but are
-- no longer public browser mutation endpoints.
revoke execute on function public.advance_world_time(integer) from public, anon, authenticated;
revoke execute on function public.advance_world_time_v1() from public, anon, authenticated;
revoke execute on function public.advance_all_characters_v3() from public, anon, authenticated;
revoke execute on function public.advance_all_characters_v3(timestamptz) from public, anon, authenticated;
revoke execute on function public.resync_characters_on_route(bigint,timestamptz) from public, anon, authenticated;

grant execute on function public.advance_world_time(integer) to service_role;
grant execute on function public.advance_world_time_v1() to service_role;
grant execute on function public.advance_all_characters_v3() to service_role;
grant execute on function public.advance_all_characters_v3(timestamptz) to service_role;
grant execute on function public.resync_characters_on_route(bigint,timestamptz) to service_role;

commit;
