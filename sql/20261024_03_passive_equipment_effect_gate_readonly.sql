-- STAGED ONLY. Internal read-only passive equipment SOURCE ELIGIBILITY probe.
-- Does NOT replace existing equipment/AC/spell/tactical calculations.
-- Does NOT authorize magic effects or infer D&D attunement from missing keys.
-- Depends on draft #257 character_item_attunements; do not deploy alone.
create or replace function private.passive_equipment_source_gate_v1(
  p_character_id uuid,
  p_inventory_item_id uuid
) returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,private,auth
as $gate$
declare
  v_item public.inventory_items%rowtype;
  v_cat jsonb := '{}'::jsonb;
  v_payload jsonb := '{}'::jsonb;
  v_key text;
  v_code text;
  v_subkind text;
  v_rarity text;
  v_kind text := 'unclassified';
  v_slot text;
  v_slot_state text := 'unclassified';
  v_source_attune text := 'unknown';
  v_source_evidence text := 'unverified';
  v_verified jsonb := '{}'::jsonb;
  v_status text;
  v_owned boolean := false;
  v_ambiguous boolean := false;
  v_bond boolean := false;
  v_catalog_found boolean := false;
  v_required boolean := false;
  v_mundane boolean := false;
  v_equipped boolean := false;
  v_mundane_ac boolean := false;
begin
  if p_character_id is null or p_inventory_item_id is null then
    raise exception 'Character and inventory item required' using errcode='22023';
  end if;

  select * into v_item from public.inventory_items
  where id=p_inventory_item_id;
  if not found then
    return jsonb_build_object('schemaVersion',1,'sourceStatus','missing_inventory',
       'eligibleForPassiveMagic',false,'eligibleMundaneBaseAc',false);
  end if;
  v_equipped:=coalesce(v_item.is_equipped,false);
  v_owned := (
    v_item.owner_id=p_character_id::text
    and lower(coalesce(v_item.owner_type,'')) in ('npc','merchant','character')
  ) or (
    lower(coalesce(v_item.owner_type,''))='player'
    and exists (
      select 1 from public.character_permissions cp
      where cp.user_id::text=v_item.owner_id
        and cp.character_id=p_character_id
        and coalesce(cp.can_edit,false)
    )
  );

  -- Player-account inventories may be shared by multiple characters. Merely
  -- matching their player ID must NOT grant magical effects to both.
  if lower(coalesce(v_item.owner_type,''))='player' then
    select count(distinct cp.character_id)>1 into v_ambiguous
    from public.character_permissions cp
    where cp.user_id::text=v_item.owner_id and coalesce(cp.can_edit,false);
  end if;

  -- Require an exact structured source item key. A name-only fuzzy match
  -- could pick the wrong source/edition and may not authorize magic.
  v_key:=coalesce(nullif(v_item.card_payload->>'item_key',''),
                  nullif(v_item.card_payload->>'item_id',''),
                  nullif(v_item.item_id,''));
  if v_key is not null then
    select c.payload into v_cat from public.items_catalog c where c.item_key=v_key;
    v_catalog_found:=found;
  end if;

  if v_catalog_found then
    v_payload:=coalesce(v_cat,'{}'::jsonb)||coalesce(v_item.card_payload,'{}'::jsonb);
  end if;
  v_code:=split_part(lower(coalesce(v_payload->>'type','')),'|',1);
  v_subkind:=lower(coalesce(v_payload->>'uiSubKind',''));
  v_rarity:=lower(coalesce(v_payload->>'item_rarity',v_payload->>'rarity',''));
  v_mundane:=v_rarity in ('none','mundane');
  v_slot:=lower(btrim(coalesce(v_item.equip_slot,'')));

  v_kind:=case
    when v_code in ('la','ma','ha') then 'armor'
    when v_code='s' then 'shield'
    when v_code='rg' or v_subkind='ring' then 'ring'
    when v_subkind='boots' then 'boots'
    when v_subkind='cloak' then 'cloak'
    when v_code in ('m','r') then 'weapon'
    else 'unclassified' end;

  -- Valid physical slot is separate from attunement. Unknown source kinds
  -- are UNCLASSIFIED (not automatically valid). This is NOT a new equip RPC.
  v_slot_state:=case
    when not v_equipped then 'not_equipped'
    when v_kind='armor' and v_slot='body' then 'valid'
    when v_kind='shield' and v_slot in ('weapon_1','weapon_2','weapon_3') then 'valid'
    when v_kind='ring' and v_slot in ('ring_1','ring_2') then 'valid'
    when v_kind='boots' and v_slot='feet' then 'valid'
    when v_kind='cloak' and v_slot='shoulders' then 'valid'
    when v_kind='weapon' and v_slot in ('weapon_1','weapon_2','weapon_3') then 'valid'
    when v_kind='unclassified' then 'unclassified'
    else 'invalid' end;

  v_bond:=exists (
    select 1 from public.character_item_attunements a
    where a.character_id=p_character_id and a.inventory_item_id=p_inventory_item_id
  );

  if v_catalog_found then
    v_verified := private.verified_item_attunement_rule_v1(v_key);
    -- Source and instance positive requirements are monotone: an inventory
    -- override saying "false" cannot erase a catalogue's "required".
    v_required:=
      (v_cat->'reqAttune'='true'::jsonb)
      or (jsonb_typeof(v_cat->'reqAttune')='string'
         and lower(coalesce(v_cat->>'reqAttune','')) not in ('','false','no','none'))
      or (jsonb_typeof(v_cat->'reqAttuneTags')='array'
          and jsonb_array_length(v_cat->'reqAttuneTags')>0)
      or (v_cat->'attunement'='true'::jsonb)
      or (v_item.card_payload->'reqAttune'='true'::jsonb)
      or (jsonb_typeof(v_item.card_payload->'reqAttune')='string'
          and lower(coalesce(v_item.card_payload->>'reqAttune','')) not in ('','false','no','none'))
      or (jsonb_typeof(v_item.card_payload->'reqAttuneTags')='array'
          and jsonb_array_length(v_item.card_payload->'reqAttuneTags')>0)
      or (v_item.card_payload->'attunement'='true'::jsonb);
    v_source_attune:=case
      when v_required then 'required'
      when v_mundane then 'not_required_mundane'
      when v_cat->'reqAttune'='false'::jsonb or v_cat->'attunement'='false'::jsonb
           then 'explicitly_not_required'
      else 'unknown' end;
    v_source_evidence:=case when v_required then 'structured_source_positive'
                       when v_mundane then 'canonical_mundane'
                       when v_source_attune='explicitly_not_required' then 'structured_source_negative'
                       else 'missing_source_requirement' end;
    -- Verified 2024 exact-key corrections fill omissions. If a future
    -- catalogue explicitly contradicts a verified rule, record a conflict
    -- rather than silently activating or suppressing magic.
    if v_verified->>'attunement'='required' then
      if v_source_attune='explicitly_not_required' then
        v_source_attune:='source_conflict';
        v_source_evidence:='verified_2024_conflicts_with_catalogue';
      else
        v_source_attune:='required';
        v_source_evidence:='verified_br_2024_exact_item_key';
      end if;
    end if;
  end if;

  v_mundane_ac:=v_owned and v_equipped and v_slot_state='valid'
                and v_kind in ('armor','shield');
  v_status:=case
    when not v_owned then 'wrong_owner'
    when v_ambiguous then 'ambiguous_player_owner'
    when not v_catalog_found then 'unknown_source'
    when not v_equipped then 'not_equipped'
    when v_slot_state='invalid' then 'wrong_slot'
    when v_slot_state='unclassified' then 'unclassified_slot'
    when v_source_attune='unknown' then 'unknown_source_attunement'
    when v_source_attune='source_conflict' then 'source_metadata_conflict'
    when v_source_attune='required' and not v_bond then 'not_attuned'
    when v_source_attune='required' then 'rest_and_prerequisites_unverified'
    else 'consumer_rule_unverified'
  end;
  -- NO return path marks passive magic eligible. Bond != Short Rest receipt,
  -- class prerequisites, source-specific stacking, or activated powers.
  return jsonb_build_object(
    'schemaVersion',1,
    'sourceStatus',v_status,
    'catalogueMatched',v_catalog_found,
    'ownedByCharacter',v_owned,
    'playerOwnerAmbiguous',v_ambiguous,
    'isEquipped',v_equipped,
    'sourceKind',v_kind,
    'slotStatus',v_slot_state,
    'attunementSource',v_source_attune,
    'attunementEvidence',v_source_evidence,
    'attunementSourceClassKeys',coalesce(v_verified->'classKeys','[]'::jsonb),
    'bondPresent',v_bond,
    'restAndPrerequisitesVerified',false,
    'eligibleMundaneBaseAc',v_mundane_ac,
    'eligibleForPassiveMagic',false
  );
end
$gate$;
revoke all on function private.passive_equipment_source_gate_v1(uuid,uuid)
from public,anon,authenticated;
grant execute on function private.passive_equipment_source_gate_v1(uuid,uuid)
to service_role;
comment on function private.passive_equipment_source_gate_v1(uuid,uuid) is
'Internal untrusted-input gate for passive magic eligibility. Always fails closed on magic; no gameplay or equipment formula integration.';
