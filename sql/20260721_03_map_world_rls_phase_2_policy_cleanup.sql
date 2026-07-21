-- Phase 2 follow-up: keep read and write policies non-overlapping so each
-- authenticated SELECT evaluates only the intended read policy.

begin;

do $cleanup$
declare
  table_name text;
  policy_prefix text;
begin
  foreach table_name in array array[
    'locations', 'quests', 'map_routes', 'map_route_points',
    'map_route_edges', 'map_route_segments', 'map_icons', 'location_icons',
    'world_state', 'biomes', 'town_map_labels', 'town_map_flags',
    'npc_portrait_library'
  ]
  loop
    policy_prefix := table_name;
    execute format('drop policy if exists %I on public.%I', policy_prefix || '_admin_write', table_name);

    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.current_user_is_admin()))',
      policy_prefix || '_admin_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.current_user_is_admin())) with check ((select private.current_user_is_admin()))',
      policy_prefix || '_admin_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.current_user_is_admin()))',
      policy_prefix || '_admin_delete', table_name
    );
  end loop;
end
$cleanup$;

-- World events are admin-only for both reads and writes, but explicit policies
-- keep the intent auditable and avoid an ALL-policy overlapping future reads.
drop policy if exists world_events_admin_access on public.world_events;

create policy world_events_admin_select
on public.world_events for select to authenticated
using ((select private.current_user_is_admin()));

create policy world_events_admin_insert
on public.world_events for insert to authenticated
with check ((select private.current_user_is_admin()));

create policy world_events_admin_update
on public.world_events for update to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create policy world_events_admin_delete
on public.world_events for delete to authenticated
using ((select private.current_user_is_admin()));

-- These are ordinary trigger functions, not callable application APIs. Pinning
-- their lookup path prevents a hostile object from shadowing referenced names.
alter function public.set_updated_at_town_map_labels()
  set search_path = pg_catalog, public;
alter function public.set_updated_at_town_map_flags()
  set search_path = pg_catalog, public;

commit;
