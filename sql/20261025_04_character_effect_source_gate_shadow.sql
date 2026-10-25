-- PRIVATE, READ-ONLY SHADOW SOURCE GATE for a future server-derived effects adapter.
-- Not a gameplay resolver; do not expose through a browser RPC or switch consumers.
-- Import only AFTER 20261025_01 and 20261025_02.
-- The caller must be trusted service-side; SECURITY DEFINER is restricted
-- below, with a fixed search_path, and bypasses RLS only for this read.
create or replace function private.character_magic_effect_source_gate_shadow_v1(
  p_character_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, private, auth
as $gate$
declare
  v_enabled boolean;
  v_cap integer;
  v_items jsonb := '[]'::jsonb;
begin
  if p_character_id is null then
    raise exception 'Character id is required' using errcode='22023';
  end if;
  if not exists(select 1 from public.characters c where c.id=p_character_id) then
    raise exception 'Character does not exist' using errcode='P0002';
  end if;
  select s.attunement_enabled,s.attunement_max_items
    into v_enabled,v_cap
    from public.campaign_item_pool_settings s where s.id=1;
  if not found then
    raise exception 'Campaign item pool settings are missing' using errcode='P0002';
  end if;

  -- This ownership read matches the current canonical equipment/weapon
  -- resolver's character-versus-account owner expansion. Account-owned
  -- inventory can appear for several editable characters: report this
  -- explicitly rather than silently claiming character-exclusive physical
  -- equipment. Selected magic riders are separately exclusive by exact ID.
  select coalesce(jsonb_agg(jsonb_build_object(
      'inventoryItemId',src.id,
      'physicalEquipped',true,
      'sourceMagicVerified',src.magic_verified,
      'rarityMagicCandidate',src.rarity_candidate,
      'selectedForCharacter',src.selected_here,
      'claimedByAnotherCharacter',src.selected_elsewhere,
      'accountScopeAmbiguous',src.account_shared,
      'magicRiderEligible',case
        when v_enabled is false then true
        when src.rarity_candidate is false then true
        else src.magic_verified and src.selected_here
      end,
      'reason',case
        when v_enabled is false then 'attunement_off'
        when src.rarity_candidate is false then 'mundane'
        when src.magic_verified is false then 'unverified_magic_source'
        when src.selected_elsewhere then 'claimed_by_other_character'
        when src.selected_here then 'selected'
        else 'not_selected'
      end
    ) order by src.id), '[]'::jsonb)
    into v_items
  from (
    select i.id,
      lower(btrim(coalesce(i.item_rarity,''))) in
        ('common','uncommon','rare','very rare','legendary','artifact')
        as rarity_candidate,
      private.optional_rest_item_is_magic_v1(i.id) as magic_verified,
      exists(select 1 from public.character_magic_item_selections_v1 att
        where att.inventory_item_id=i.id and att.character_id=p_character_id)
        as selected_here,
      exists(select 1 from public.character_magic_item_selections_v1 att
        where att.inventory_item_id=i.id and att.character_id<>p_character_id)
        as selected_elsewhere,
      (lower(btrim(coalesce(i.owner_type,'')))='player'
        and (select count(distinct cp.character_id)
          from public.character_permissions cp
          where cp.user_id::text=i.owner_id and cp.can_edit)>1)
        as account_shared
    from public.inventory_items i
    where i.is_equipped is true
      and (
        (i.owner_id=p_character_id::text
          and lower(btrim(coalesce(i.owner_type,'')))
            in ('character','npc','merchant'))
        or (
          lower(btrim(coalesce(i.owner_type,'')))='player'
          and exists(select 1 from public.character_permissions cp
            where cp.character_id=p_character_id and cp.can_edit
              and cp.user_id::text=i.owner_id)
        )
      )
  ) src;

  return jsonb_build_object(
    'schemaVersion',1,'characterId',p_character_id,
    'attunementEnabled',v_enabled,'maxItems',v_cap,
    'consumerEnforced',false,'items',v_items
  );
end;
$gate$;
revoke all on function private.character_magic_effect_source_gate_shadow_v1(uuid)
  from public,anon,authenticated;
grant execute on function private.character_magic_effect_source_gate_shadow_v1(uuid)
  to service_role;
comment on function private.character_magic_effect_source_gate_shadow_v1(uuid) is
'Private service-only, read-only inventory source audit. Never use its output as character-sheet/combat authority until consumer parity and shared-account physical custody are resolved.';
