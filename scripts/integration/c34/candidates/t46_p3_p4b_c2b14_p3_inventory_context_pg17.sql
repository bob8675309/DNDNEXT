-- C34 B14-P3. Research-only inventory context/target projection, disposable PG17.
-- NOT a migration. Not mounted in pages/inventory.js or deployed to hosted DB.
-- Backend role + scoped owner permissions + safe target list in one authorized
-- read operation. Item rows deliberately remain separate for paging/realtime.
-- Reuses ONLY versioned explicit-role manager from B14-P2, never public.is_admin.
BEGIN;
CREATE OR REPLACE FUNCTION public.c34_b14_p3_inventory_context_v1(
  p_owner_type text,
  p_owner_id text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $b14p3$
DECLARE
  v_caller uuid := auth.uid();
  v_manager boolean;
  v_owner_type text := lower(btrim(coalesce(p_owner_type,'')));
  v_owner_id text := btrim(coalesce(p_owner_id,''));
  v_owner_uuid uuid;
  v_can_view boolean := false;
  v_can_manage boolean := false;
  v_targets jsonb := '[]'::jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign-in required' USING ERRCODE = '42501';
  END IF;

  -- Character-owned Forge starting gear requires its separate, source-original
  -- private.can_access_character_v1 ACL. Do NOT silently equate user_id with
  -- inventory ownership or synthesize a permission from account metadata.
  IF v_owner_type = 'character' THEN
    RAISE EXCEPTION 'Character-scoped inventory authorization is not installed in this candidate'
      USING ERRCODE = '42501';
  END IF;
  IF v_owner_type NOT IN ('player','npc','merchant') OR v_owner_id = '' THEN
    RAISE EXCEPTION 'Invalid inventory owner scope' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_owner_uuid := v_owner_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid inventory owner UUID' USING ERRCODE = '22023';
  END;
  v_manager := private.c34_b14_p2_inventory_manager_v1();

  IF v_owner_type = 'player' THEN
    v_can_view := v_owner_uuid = v_caller OR (
      v_manager AND EXISTS (
        SELECT 1 FROM public.players p WHERE p.user_id = v_owner_uuid
      )
    );
  ELSIF v_owner_type = 'npc' THEN
    v_can_view := EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = v_owner_uuid AND c.kind = 'npc'
        AND NOT ('player-character' = ANY(coalesce(c.tags,'{}'::text[])))
        AND (v_manager OR (
          coalesce(c.is_hidden,false)=false AND coalesce(c.state,'') <> 'hidden'
        ))
        AND (
          v_manager OR EXISTS (
            SELECT 1 FROM public.character_permissions cp
            WHERE cp.character_id = c.id AND cp.user_id = v_caller
              AND (coalesce(cp.can_inventory,false) OR coalesce(cp.can_edit,false))
          )
        )
    );
  ELSE
    v_can_view := v_manager AND EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = v_owner_uuid AND c.kind = 'merchant'
    );
  END IF;
  v_can_manage := v_can_view;

  IF v_can_view THEN
    SELECT coalesce(jsonb_agg(
      jsonb_build_object('kind',t.kind,'id',t.id,'name',t.name)
      ORDER BY t.kind,t.name,t.id
    ),'[]'::jsonb)
    INTO v_targets
    FROM (
      SELECT 'player'::text kind,p.user_id::text id,
             coalesce(nullif(p.name,''),'Player')::text name
      FROM public.players p WHERE p.user_id IS NOT NULL AND p.user_id <> v_caller
      UNION ALL
      SELECT 'npc'::text,c.id::text,
             coalesce(nullif(c.name,''),'NPC')::text
      FROM public.characters c WHERE c.kind='npc'
        AND NOT ('player-character' = ANY(coalesce(c.tags,'{}'::text[])))
        AND (v_manager OR (
          coalesce(c.is_hidden,false)=false AND coalesce(c.state,'') <> 'hidden'
        ))
      UNION ALL
      SELECT 'merchant'::text,c.id::text,
             coalesce(nullif(c.name,''),'Merchant')::text
      FROM public.characters c WHERE c.kind='merchant' AND v_manager
    ) AS t;
  END IF;
  RETURN jsonb_build_object(
    'owner_type',v_owner_type,'owner_id',v_owner_id,
    'can_view',v_can_view,'can_manage',v_can_manage,
    'is_manager',v_manager,'targets',v_targets
  );
END;
$b14p3$;

REVOKE ALL ON FUNCTION public.c34_b14_p3_inventory_context_v1(text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p3_inventory_context_v1(text,text)
  TO authenticated;
COMMIT;
