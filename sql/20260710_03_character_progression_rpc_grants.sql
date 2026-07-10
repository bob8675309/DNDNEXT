-- Restrict progression SECURITY DEFINER RPCs to signed-in users.
revoke execute on function public.get_character_progression_v1(uuid) from public, anon;
revoke execute on function public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text) from public, anon;
revoke execute on function public.add_character_xp_v1(uuid,bigint,text) from public, anon;
revoke execute on function public.import_class_progression_batch_v1(jsonb) from public, anon;

grant execute on function public.get_character_progression_v1(uuid) to authenticated;
grant execute on function public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text) to authenticated;
grant execute on function public.add_character_xp_v1(uuid,bigint,text) to authenticated;
grant execute on function public.import_class_progression_batch_v1(jsonb) to authenticated;
