-- DNDNext admin site-activity visibility
-- Tracks a privacy-minimized browser visitor UUID plus authenticated user id when available.
-- No IP address, user-agent, fingerprint, or precise-location data is stored here.

create table if not exists public.site_visit_activity (
  visitor_key uuid primary key,
  user_id uuid null references auth.users(id) on delete set null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  visit_count bigint not null default 1 check (visit_count >= 1),
  last_path text null
);

create index if not exists site_visit_activity_last_seen_idx
  on public.site_visit_activity (last_seen desc);

create index if not exists site_visit_activity_user_last_seen_idx
  on public.site_visit_activity (user_id, last_seen desc)
  where user_id is not null;

alter table public.site_visit_activity enable row level security;

revoke all on table public.site_visit_activity from anon, authenticated;

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
  v_path text := left(coalesce(nullif(btrim(p_path), ''), '/'), 240);
begin
  if p_visitor_key is null then
    raise exception 'visitor key is required' using errcode = '22023';
  end if;

  delete from public.site_visit_activity
  where last_seen < now() - interval '31 days';

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
    auth.uid(),
    now(),
    now(),
    1,
    v_path
  )
  on conflict (visitor_key) do update
  set
    user_id = coalesce(auth.uid(), public.site_visit_activity.user_id),
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

create or replace function public.get_recent_site_activity_v1()
returns table (
  activity_kind text,
  activity_key text,
  email text,
  display_name text,
  role text,
  account_created_at timestamptz,
  last_sign_in_at timestamptz,
  first_seen timestamptz,
  last_seen timestamptz,
  visit_count bigint,
  last_path text,
  last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
begin
  if not private.current_user_is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  with visit_rollup as (
    select
      sva.user_id,
      min(sva.first_seen) as first_seen,
      max(sva.last_seen) as last_seen,
      sum(sva.visit_count)::bigint as visit_count
    from public.site_visit_activity sva
    where sva.user_id is not null
    group by sva.user_id
  ),
  latest_visit as (
    select distinct on (sva.user_id)
      sva.user_id,
      sva.last_path
    from public.site_visit_activity sva
    where sva.user_id is not null
    order by sva.user_id, sva.last_seen desc
  ),
  account_rows as (
    select
      'account'::text as activity_kind,
      u.id::text as activity_key,
      u.email::text as email,
      coalesce(p.name, nullif(u.raw_user_meta_data->>'character_name', ''), split_part(coalesce(u.email, ''), '@', 1))::text as display_name,
      coalesce(up.role, 'player')::text as role,
      u.created_at as account_created_at,
      u.last_sign_in_at,
      vr.first_seen,
      vr.last_seen,
      coalesce(vr.visit_count, 0)::bigint as visit_count,
      lv.last_path::text as last_path,
      greatest(
        u.created_at,
        coalesce(u.last_sign_in_at, '-infinity'::timestamptz),
        coalesce(vr.last_seen, '-infinity'::timestamptz)
      ) as last_activity_at
    from auth.users u
    left join public.user_profiles up on up.id = u.id
    left join public.players p on p.user_id = u.id
    left join visit_rollup vr on vr.user_id = u.id
    left join latest_visit lv on lv.user_id = u.id
    where
      u.created_at >= now() - interval '30 days'
      or u.last_sign_in_at >= now() - interval '30 days'
      or vr.last_seen >= now() - interval '30 days'
  ),
  anonymous_rows as (
    select
      'visitor'::text as activity_kind,
      sva.visitor_key::text as activity_key,
      null::text as email,
      ('Anonymous visitor ' || left(sva.visitor_key::text, 8))::text as display_name,
      null::text as role,
      null::timestamptz as account_created_at,
      null::timestamptz as last_sign_in_at,
      sva.first_seen,
      sva.last_seen,
      sva.visit_count,
      sva.last_path,
      sva.last_seen as last_activity_at
    from public.site_visit_activity sva
    where sva.user_id is null
      and sva.last_seen >= now() - interval '30 days'
  )
  select * from account_rows
  union all
  select * from anonymous_rows
  order by last_activity_at desc nulls last;
end;
$$;

revoke all on function public.get_recent_site_activity_v1() from public;
revoke execute on function public.get_recent_site_activity_v1() from anon;
grant execute on function public.get_recent_site_activity_v1() to authenticated;

comment on table public.site_visit_activity is
  'Privacy-minimized site visit summary keyed by a browser-generated UUID. No IP, user-agent, fingerprint, or precise location is stored.';

comment on function public.get_recent_site_activity_v1() is
  'Admin-only 30-day account and site-visitor activity summary.';
