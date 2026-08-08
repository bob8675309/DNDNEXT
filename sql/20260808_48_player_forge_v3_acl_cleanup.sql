-- Align create_player_character_v3 with the authenticated-only Player Forge boundary.
-- The function already rejects auth.uid() IS NULL internally; this removes the
-- stale explicit anon EXECUTE grant so ACLs match v1/v2 and the intended contract.

revoke execute on function public.create_player_character_v3(jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.create_player_character_v3(jsonb,jsonb,jsonb) to authenticated, service_role;
