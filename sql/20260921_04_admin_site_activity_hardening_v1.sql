-- Harden privacy-minimized site activity ingestion after review.
-- 1) Keep anonymous row creation bounded even though the public client can call the RPC.
-- 2) Never retain a prior account id when the current observation is signed out.
-- 3) Reset pre-hardening browser rows to anonymous because the old shared browser key
--    could span authenticated and signed-out activity on the same device.

update public.site_visit_activity
set user_id = null
where user_id is not null;

create or replace function public.record_site_visit_v1(
  p_visitor_key uuid,
  p_path text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_path text := left(coalesce(nullif(btrim(p_path), ''), '/'), 240);
  v_exists boolean := false;
  v_recent_anon_creations bigint := 0;
  v_anon_rows bigint := 0;
begin
  if p_visitor_key is null then
    raise exception 'visitor key is required' using errcode = '22023';
  end if;

  delete from public.site_visit_activity
  where last_seen < now() - interval '31 days';

  select exists (
    select 1
    from public.site_visit_activity
    where visitor_key = p_visitor_key
  )
  into v_exists;

  if v_uid is null and not v_exists then
    -- Serialize anonymous row admission so concurrent random UUID floods cannot
    -- race past the bounded-ingestion checks.
    perform pg_advisory_xact_lock(hashtextextended('dndnext_site_visit_anon_admission_v1', 0));

    select exists (
      select 1
      from public.site_visit_activity
      where visitor_key = p_visitor_key
    )
    into v_exists;

    if not v_exists then
      select count(*)
      into v_recent_anon_creations
      from public.site_visit_activity
      where user_id is null
        and first_seen >= now() - interval '1 minute';

      if v_recent_anon_creations >= 12 then
        return;
      end if;

      select count(*)
      into v_anon_rows
      from public.site_visit_activity
      where user_id is null;

      if v_anon_rows >= 2500 then
        return;
      end if;
    end if;
  end if;

  insert into public.site_visit_activity (
    visitor_key,
    user_id,
    first_seen,
    last_seen,
    visit_count,
    last_path
  )
  values (
    p_visitor_key,
    v_uid,
    now(),
    now(),
    1,
    v_path
  )
  on conflict (visitor_key) do update
  set
    -- Current auth state is authoritative. A signed-out request must never keep
    -- the account id from a previous signed-in observation on the same key.
    user_id = v_uid,
    last_seen = now(),
    visit_count = public.site_visit_activity.visit_count
      + case
          when public.site_visit_activity.last_seen < now() - interval '30 minutes' then 1
          else 0
        end,
    last_path = excluded.last_path;
end;
$$;

revoke all on function public.record_site_visit_v1(uuid, text) from public;
grant execute on function public.record_site_visit_v1(uuid, text) to anon, authenticated;

comment on function public.record_site_visit_v1(uuid, text) is
  'Privacy-minimized visit recorder. Anonymous new-row admission is bounded to 12/minute and 2500 retained anonymous rows; account association always follows current auth.uid().';
