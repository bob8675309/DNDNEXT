-- Supabase public-schema default privileges can leave explicit anon EXECUTE on
-- newly created RPCs even after revoking the PostgreSQL PUBLIC role. These
-- commands make the intended authenticated/service-role command boundary exact.

revoke all on function public.get_character_githyanki_astral_knowledge_v1(uuid) from anon;
revoke all on function public.configure_character_githyanki_astral_knowledge_v1(uuid,text,uuid) from anon;
revoke all on function public.get_character_khoravar_skill_versatility_v1(uuid) from anon;
revoke all on function public.configure_character_khoravar_skill_versatility_v1(uuid,text) from anon;

revoke all on function public.get_character_githyanki_astral_knowledge_v1(uuid) from public;
revoke all on function public.configure_character_githyanki_astral_knowledge_v1(uuid,text,uuid) from public;
revoke all on function public.get_character_khoravar_skill_versatility_v1(uuid) from public;
revoke all on function public.configure_character_khoravar_skill_versatility_v1(uuid,text) from public;

grant execute on function public.get_character_githyanki_astral_knowledge_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_githyanki_astral_knowledge_v1(uuid,text,uuid) to authenticated,service_role;
grant execute on function public.get_character_khoravar_skill_versatility_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_khoravar_skill_versatility_v1(uuid,text) to authenticated,service_role;
