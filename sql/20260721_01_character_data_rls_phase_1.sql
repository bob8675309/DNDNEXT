-- DNDNext character-data RLS hardening, phase 1.
-- Protects NPC/merchant records and dependent character data without changing
-- crafting, town-map, or world-map behavior.

begin;

-- ---------------------------------------------------------------------------
-- Guarded helpers used by policies and the DM-only secret RPCs.
-- ---------------------------------------------------------------------------

create or replace function private.can_access_character_v1(
  p_character_id uuid,
  p_permission text default 'read'
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $function$
  select
    private.current_user_is_admin()
    or exists (
      select 1
      from public.character_permissions cp
      where cp.character_id = p_character_id
        and cp.user_id = auth.uid()
        and case lower(coalesce(p_permission, 'read'))
          when 'inventory' then cp.can_inventory or cp.can_edit
          when 'convert' then cp.can_convert or cp.can_edit
          when 'edit' then cp.can_edit
          else cp.can_inventory or cp.can_edit or cp.can_convert
        end
    );
$function$;

revoke all on function private.can_access_character_v1(uuid,text) from public, anon;
grant execute on function private.can_access_character_v1(uuid,text) to authenticated, service_role;

create or replace function public.get_character_secrets_v1(p_character_ids uuid[])
returns table(character_id uuid, secret text)
language sql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $function$
  select c.id, c.secret
  from public.characters c
  where c.id = any(coalesce(p_character_ids, '{}'::uuid[]))
    and private.can_access_character_v1(c.id, 'edit');
$function$;

create or replace function public.set_character_secret_v1(
  p_character_id uuid,
  p_secret text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
begin
  if auth.uid() is null or not private.can_access_character_v1(p_character_id, 'edit') then
    raise exception 'Not authorized to edit this character secret' using errcode = '42501';
  end if;

  update public.characters
  set secret = nullif(btrim(p_secret), ''), updated_at = timezone('utc', now())
  where id = p_character_id;

  if not found then
    raise exception 'Character not found' using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function public.get_character_secrets_v1(uuid[]) from public, anon;
revoke all on function public.set_character_secret_v1(uuid,text) from public, anon;
grant execute on function public.get_character_secrets_v1(uuid[]) to authenticated, service_role;
grant execute on function public.set_character_secret_v1(uuid,text) to authenticated, service_role;

-- The legacy map patch RPC remains available to the signed-in admin UI, but it
-- no longer acts as an unauthenticated SECURITY DEFINER write endpoint.
create or replace function public.update_character(p_character_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
begin
  if auth.uid() is null or not private.current_user_is_admin() then
    raise exception 'Only an administrator can update map character state' using errcode = '42501';
  end if;

  update public.characters
  set
    map_icon_id = coalesce((p_patch->>'map_icon_id')::uuid, map_icon_id),
    sprite_path = coalesce(p_patch->>'sprite_path', sprite_path),
    sprite_scale = coalesce((p_patch->>'sprite_scale')::double precision, sprite_scale),
    roaming_speed = coalesce((p_patch->>'roaming_speed')::double precision, roaming_speed),
    dwell_hours = coalesce((p_patch->>'dwell_hours')::integer, dwell_hours),
    is_hidden = coalesce((p_patch->>'is_hidden')::boolean, is_hidden),
    route_id = coalesce((p_patch->>'route_id')::bigint, route_id),
    route_mode = coalesce(p_patch->>'route_mode', route_mode),
    route_point_seq = coalesce((p_patch->>'route_point_seq')::integer, route_point_seq),
    state = coalesce(p_patch->>'state', state),
    rest_until = coalesce((p_patch->>'rest_until')::timestamptz, rest_until),
    route_segment_progress = coalesce((p_patch->>'route_segment_progress')::double precision, route_segment_progress),
    current_point_seq = coalesce((p_patch->>'current_point_seq')::integer, current_point_seq),
    next_point_seq = coalesce((p_patch->>'next_point_seq')::integer, next_point_seq),
    segment_started_at = coalesce((p_patch->>'segment_started_at')::timestamptz, segment_started_at),
    segment_ends_at = coalesce((p_patch->>'segment_ends_at')::timestamptz, segment_ends_at),
    last_moved_at = coalesce((p_patch->>'last_moved_at')::timestamptz, last_moved_at),
    projected_destination_id = coalesce((p_patch->>'projected_destination_id')::bigint, projected_destination_id),
    updated_at = timezone('utc', now())
  where id = p_character_id;

  if not found then
    raise exception 'Character not found' using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function public.update_character(uuid,jsonb) from public, anon;
grant execute on function public.update_character(uuid,jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Remove legacy/default policy state and enable RLS.
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
        'characters', 'character_sheets', 'character_permissions',
        'character_notes', 'character_spells', 'character_stock'
      ])
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end
$policies$;

alter table public.characters enable row level security;
alter table public.character_sheets enable row level security;
alter table public.character_permissions enable row level security;
alter table public.character_notes enable row level security;
alter table public.character_spells enable row level security;
alter table public.character_stock enable row level security;

-- Characters are campaign roster records. Signed-in players may read visible
-- entries; admins and explicitly assigned users may also read hidden entries.
create policy characters_select_visible_or_assigned
on public.characters for select to authenticated
using (
  not coalesce(is_hidden, false)
  or (select private.can_access_character_v1(id, 'read'))
);

create policy characters_insert_admin
on public.characters for insert to authenticated
with check ((select private.current_user_is_admin()));

create policy characters_update_editor
on public.characters for update to authenticated
using ((select private.can_access_character_v1(id, 'edit')))
with check ((select private.can_access_character_v1(id, 'edit')));

create policy characters_delete_editor
on public.characters for delete to authenticated
using ((select private.can_access_character_v1(id, 'edit')));

-- Sheets and spellbooks are readable for visible roster entries. Direct sheet
-- edits require can_edit/admin; direct spell assignment remains admin-only.
create policy character_sheets_select_visible_or_assigned
on public.character_sheets for select to authenticated
using (exists (
  select 1 from public.characters c
  where c.id = character_id
));

create policy character_sheets_insert_editor
on public.character_sheets for insert to authenticated
with check ((select private.can_access_character_v1(character_id, 'edit')));

create policy character_sheets_update_editor
on public.character_sheets for update to authenticated
using ((select private.can_access_character_v1(character_id, 'edit')))
with check ((select private.can_access_character_v1(character_id, 'edit')));

create policy character_sheets_delete_editor
on public.character_sheets for delete to authenticated
using ((select private.can_access_character_v1(character_id, 'edit')));

create policy character_spells_select_visible_or_assigned
on public.character_spells for select to authenticated
using (exists (
  select 1 from public.characters c
  where c.id = character_id
));

create policy character_spells_admin_write
on public.character_spells for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

-- Users can inspect only their own permission assignments. Admins manage all.
create policy character_permissions_select_self
on public.character_permissions for select to authenticated
using (user_id = (select auth.uid()) or (select private.current_user_is_admin()));

create policy character_permissions_admin_write
on public.character_permissions for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

-- Notes enforce the audience model already presented by the UI.
create policy character_notes_select_audience
on public.character_notes for select to authenticated
using (
  (select private.current_user_is_admin())
  or author_user_id = (select auth.uid())
  or (
    scope = 'shared'
    and (
      visible_to_user_ids is null
      or cardinality(visible_to_user_ids) = 0
      or (select auth.uid()) = any(visible_to_user_ids)
    )
  )
);

create policy character_notes_insert_author
on public.character_notes for insert to authenticated
with check (
  author_user_id = (select auth.uid())
  and exists (select 1 from public.characters c where c.id = character_id)
);

create policy character_notes_update_author_or_admin
on public.character_notes for update to authenticated
using (author_user_id = (select auth.uid()) or (select private.current_user_is_admin()))
with check (author_user_id = (select auth.uid()) or (select private.current_user_is_admin()));

create policy character_notes_delete_author_or_admin
on public.character_notes for delete to authenticated
using (author_user_id = (select auth.uid()) or (select private.current_user_is_admin()));

-- Merchant stock is a signed-in storefront catalogue. Stock mutation is admin
-- only; purchase/crafting SECURITY DEFINER transactions keep their own checks.
create policy character_stock_select_authenticated
on public.character_stock for select to authenticated
using (exists (select 1 from public.characters c where c.id = character_id));

create policy character_stock_admin_write
on public.character_stock for all to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

-- ---------------------------------------------------------------------------
-- Narrow Data API grants. DM-only characters.secret is available only through
-- the guarded RPCs above, avoiding column leakage through ordinary roster reads.
-- ---------------------------------------------------------------------------

revoke all on table public.characters from public, anon, authenticated;
revoke all on table public.character_sheets from public, anon, authenticated;
revoke all on table public.character_permissions from public, anon, authenticated;
revoke all on table public.character_notes from public, anon, authenticated;
revoke all on table public.character_spells from public, anon, authenticated;
revoke all on table public.character_stock from public, anon, authenticated;

do $grants$
declare
  readable_columns text;
  writable_columns text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum)
  into readable_columns
  from pg_attribute
  where attrelid = 'public.characters'::regclass
    and attnum > 0 and not attisdropped and attname <> 'secret';

  writable_columns := readable_columns;
  execute format('grant select (%s) on public.characters to authenticated', readable_columns);
  execute format('grant update (%s) on public.characters to authenticated', writable_columns);
end
$grants$;

grant insert, delete on table public.characters to authenticated;
grant select, insert, update, delete on table public.character_sheets to authenticated;
grant select, insert, update, delete on table public.character_permissions to authenticated;
grant select, insert, update, delete on table public.character_notes to authenticated;
grant select, insert, update, delete on table public.character_spells to authenticated;
grant select, insert, update, delete on table public.character_stock to authenticated;

grant all on table public.characters to service_role;
grant all on table public.character_sheets to service_role;
grant all on table public.character_permissions to service_role;
grant all on table public.character_notes to service_role;
grant all on table public.character_spells to service_role;
grant all on table public.character_stock to service_role;

commit;
