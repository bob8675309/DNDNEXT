-- P1.3 research-only G lock after I before W.
-- Use ONLY after baseline grant race has reproduced nonlocked CP check.
-- Do NOT install on production; unproven global I/G lock ordering.
\set ON_ERROR_STOP on
DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 THEN RAISE EXCEPTION 'P13 source guard patch requires disposable PG17'; END IF;
END $guard$;
DO $patch$
DECLARE v_src text:=pg_get_functiondef(
  'public.p13_candidate_locked_weapon_reaction_v1(uuid,uuid,uuid)'::regprocedure);
  anchor text:='v_linked:=(v_inv.owner_id=';
  replacement text:=$body$
 IF lower(coalesce(v_inv.owner_type,''))='player' THEN
   -- Lock the live owner/character permission row after selected item I.
   -- While a real signed-in Admin UPDATE holds G, this blocks and rereads
   -- its committed can_inventory/can_edit values before resolving W.
   PERFORM cp.character_id FROM public.character_permissions cp
   WHERE cp.character_id=v_actor_row.character_id
     AND cp.user_id::text=v_inv.owner_id
   ORDER BY cp.character_id,cp.user_id FOR UPDATE OF cp;
 END IF;
 v_linked:=(v_inv.owner_id=$body$;
BEGIN
 IF position(anchor IN v_src)=0 OR position('p13_candidate_locked_weapon_reaction_v1(' IN v_src)=0
 THEN RAISE EXCEPTION 'Original scratch weapon guard changed: manual review required'; END IF;
 EXECUTE replace(v_src,anchor,replacement);
END $patch$;
NOTIFY pgrst,'reload schema';
