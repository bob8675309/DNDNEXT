-- REDUCED authorized creation entry, local GoTrue/PG17 only.
-- NOT deployed Forge source. All live Forge paths INSERT into characters.
-- Exercise same-row AFTER INSERT attribution without changing those RPCs.
CREATE OR REPLACE FUNCTION public.test_authoritative_character_create_v1(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $mock$
DECLARE actor uuid := auth.uid(); nonce uuid; cid uuid;
BEGIN
 IF actor IS NULL THEN
   RAISE EXCEPTION 'Sign in required' USING errcode='42501';
 END IF;
 nonce := nullif(p_payload->>'creation_request_id','')::uuid;
 IF nonce IS NULL THEN RAISE EXCEPTION 'Request ID required'; END IF;
 SELECT id INTO cid FROM public.characters WHERE creation_request_id=nonce;
 IF FOUND THEN
   IF NOT EXISTS (SELECT 1 FROM public.character_permissions cp
     WHERE cp.character_id=cid AND cp.user_id=actor AND cp.can_edit) THEN
     RAISE EXCEPTION 'Request belongs to another account' USING errcode='42501';
   END IF;
   RETURN cid;
 END IF;
 INSERT INTO public.characters(id,name,kind,creation_request_id,is_hidden)
 VALUES(gen_random_uuid(),coalesce(nullif(p_payload->>'name',''),'New character'),'npc',nonce,true)
 RETURNING id INTO cid;
 INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory)
 VALUES(cid,actor,true,true);
 INSERT INTO public.character_sheets(character_id,sheet)
 VALUES(cid,'{"classKey":"fighter"}'::jsonb);
 RETURN cid;
END;
$mock$;
REVOKE ALL ON FUNCTION public.test_authoritative_character_create_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.test_authoritative_character_create_v1(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
