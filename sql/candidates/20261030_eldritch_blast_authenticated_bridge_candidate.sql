-- DRAFT ONLY. Authenticated PostgREST gateway permission bridge.
-- The function is SECURITY DEFINER because the private atomic executor is
-- deliberately not granted to the request role. Its owner must be a narrowly
-- reviewed database role in any eventual deployment. No EXECUTE grant here.
-- A real Supabase gateway validates the signed JWT before setting claims.
-- No client-supplied user id/role/feature modifier is ever accepted.
create or replace function public.encounter_cast_eldritch_blast_candidate_v1(
  p_caster_id uuid, p_assignment_id uuid, p_target_ids uuid[], p_request_id uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private,auth
as $bridge$
declare
 v_uid uuid:=auth.uid();
 v_claims jsonb:=auth.jwt();
begin
 if coalesce(auth.role(),'')<>'authenticated' or v_uid is null
   or coalesce((v_claims->>'is_anonymous')::boolean,false)
 then raise exception 'Verified non-anonymous signed-in user required'
   using errcode='42501'; end if;
 return private.encounter_eldritch_blast_candidate_v1(
   p_caster_id,p_assignment_id,p_target_ids,p_request_id);
end;
$bridge$;
-- Explicitly disabled from every web-facing API role until a reviewed
-- migration and real PostgREST JWT tests authorize a scoped grant.
revoke all on function public.encounter_cast_eldritch_blast_candidate_v1(
  uuid,uuid,uuid[],uuid
) from public,anon,authenticated,service_role;
