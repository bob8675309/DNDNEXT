begin;

revoke execute on function public.encounter_canonical_speed_ft_v1(uuid) from authenticated;
grant execute on function public.encounter_canonical_speed_ft_v1(uuid) to service_role;

do $postconditions$
begin
  if has_function_privilege('anon','public.encounter_canonical_speed_ft_v1(uuid)','EXECUTE') then
    raise exception 'anon must not execute internal encounter speed helper';
  end if;
  if has_function_privilege('authenticated','public.encounter_canonical_speed_ft_v1(uuid)','EXECUTE') then
    raise exception 'authenticated must not execute internal encounter speed helper directly';
  end if;
  if not has_function_privilege('service_role','public.encounter_canonical_speed_ft_v1(uuid)','EXECUTE') then
    raise exception 'service role must retain internal encounter speed helper access';
  end if;
end
$postconditions$;

commit;