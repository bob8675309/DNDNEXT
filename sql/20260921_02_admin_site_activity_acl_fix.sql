-- Live follow-up for environments where exposed-schema function defaults grant anon EXECUTE.
revoke execute on function public.get_recent_site_activity_v1() from anon;
grant execute on function public.get_recent_site_activity_v1() to authenticated;
