begin;

revoke all on public.encounter_maps from authenticated;
revoke all on public.encounter_hex_overrides from authenticated;
revoke all on public.encounter_map_objects from authenticated;

grant select on public.encounter_maps to authenticated;
grant select on public.encounter_hex_overrides to authenticated;
grant select on public.encounter_map_objects to authenticated;

do $postconditions$
begin
  if not has_table_privilege('authenticated','public.encounter_maps','SELECT') then
    raise exception 'authenticated must retain encounter map read access';
  end if;
  if has_table_privilege('authenticated','public.encounter_maps','INSERT')
     or has_table_privilege('authenticated','public.encounter_maps','UPDATE')
     or has_table_privilege('authenticated','public.encounter_maps','DELETE') then
    raise exception 'authenticated direct writes to encounter_maps must remain revoked';
  end if;
  if has_table_privilege('authenticated','public.encounter_hex_overrides','INSERT')
     or has_table_privilege('authenticated','public.encounter_hex_overrides','UPDATE')
     or has_table_privilege('authenticated','public.encounter_hex_overrides','DELETE') then
    raise exception 'authenticated direct writes to encounter_hex_overrides must remain revoked';
  end if;
  if has_table_privilege('authenticated','public.encounter_map_objects','INSERT')
     or has_table_privilege('authenticated','public.encounter_map_objects','UPDATE')
     or has_table_privilege('authenticated','public.encounter_map_objects','DELETE') then
    raise exception 'authenticated direct writes to encounter_map_objects must remain revoked';
  end if;
end
$postconditions$;

commit;
