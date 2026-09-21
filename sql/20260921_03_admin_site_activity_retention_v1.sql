-- Keep the anonymous/browser activity ledger bounded to the requested 30-day window.
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
    visitor_key, user_id, first_seen, last_seen, visit_count, last_path
  )
  values (
    p_visitor_key, auth.uid(), now(), now(), 1, v_path
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
