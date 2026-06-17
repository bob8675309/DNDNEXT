begin;

create or replace function private.complete_enchanting_craft_plan_v1_impl(
  p_plan_id uuid,
  p_attempt_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_plan public.craft_plans%rowtype;
  v_attempt public.crafting_attempts%rowtype;
  v_base public.inventory_items%rowtype;
  v_snapshot jsonb := '{}'::jsonb;
  v_variant jsonb := '{}'::jsonb;
  v_crafter jsonb := '{}'::jsonb;
  v_existing_slots jsonb := '{}'::jsonb;
  v_next_slots jsonb := '{}'::jsonb;
  v_base_entries jsonb := '[]'::jsonb;
  v_final_entries jsonb := '[]'::jsonb;
  v_output_payload jsonb := '{}'::jsonb;
  v_slot text;
  v_expected_slot text;
  v_variant_rarity text;
  v_tier integer := 0;
  v_base_name text;
  v_output_name text;
  v_output_rarity text;
  v_output_description text;
  v_output_id uuid;
  v_target_kind text;
  v_owner_type text;
  v_owner_id text;
  v_target_user_id uuid;
  v_material jsonb;
  v_material_id uuid;
  v_required integer;
  v_current_qty integer;
  v_report text;
  v_actor_id uuid;
  v_actor_name text;
begin
  select * into v_plan
  from public.craft_plans
  where id = p_plan_id
  for update;

  if not found then
    raise exception 'Craft plan % not found', p_plan_id;
  end if;
  if lower(coalesce(v_plan.discipline, '')) <> 'enchanting' then
    raise exception 'Craft plan % is not an Enchanting plan', p_plan_id;
  end if;
  if v_plan.status = 'completed' then
    raise exception 'Craft plan % is already completed', p_plan_id;
  end if;

  if p_attempt_id is not null then
    select * into v_attempt
    from public.crafting_attempts
    where id = p_attempt_id and craft_plan_id = p_plan_id
    order by created_at desc
    limit 1;
  else
    select * into v_attempt
    from public.crafting_attempts
    where craft_plan_id = p_plan_id
    order by created_at desc
    limit 1;
  end if;

  if v_attempt.id is null then
    raise exception 'No attempt report found for craft plan %', p_plan_id;
  end if;
  if coalesce(v_attempt.result_tier, '') not in ('critical_success', 'success') then
    raise exception 'Craft plan % cannot complete from result tier %', p_plan_id, v_attempt.result_tier;
  end if;
  if v_plan.target_character_id is null then
    raise exception 'Craft plan % has no target character', p_plan_id;
  end if;
  if v_plan.target_inventory_item_id is null then
    raise exception 'Enchanting craft plan % has no base inventory item', p_plan_id;
  end if;

  v_snapshot := coalesce(
    v_plan.result_item_payload->'enchanting',
    v_plan.plan_payload->'enchanting',
    v_plan.result_item_payload->'automation_preview'->'enchanting',
    v_plan.plan_payload->'automation_preview'->'enchanting',
    '{}'::jsonb
  );
  if v_snapshot = '{}'::jsonb then
    raise exception 'Enchanting craft plan % has no canonical enchanting snapshot', p_plan_id;
  end if;

  v_slot := upper(coalesce(v_snapshot->>'slot', ''));
  if v_slot not in ('A', 'B', 'C') then
    raise exception 'Enchanting craft plan % has invalid target slot %', p_plan_id, v_slot;
  end if;

  v_variant := coalesce(v_snapshot->'variant', '{}'::jsonb);
  if v_variant = '{}'::jsonb or nullif(v_variant->>'name', '') is null then
    raise exception 'Enchanting craft plan % has no resolved variant', p_plan_id;
  end if;

  select * into v_base
  from public.inventory_items
  where id = v_plan.target_inventory_item_id
  for update;

  if not found then
    raise exception 'Base inventory item % was not found', v_plan.target_inventory_item_id;
  end if;
  if coalesce(v_base.quantity, 0) < 1 then
    raise exception 'Base inventory item % has no available quantity', v_base.id;
  end if;

  v_tier := coalesce(
    nullif(v_base.card_payload->>'enhancement_tier', '')::integer,
    nullif(v_base.card_payload->>'enhancementTier', '')::integer,
    nullif(v_base.card_payload->>'magic_tier', '')::integer,
    nullif(v_base.card_payload->>'magicTier', '')::integer,
    nullif(v_base.card_payload->>'tier', '')::integer,
    nullif(substring(v_base.item_name from '\\+([1-3])'), '')::integer,
    nullif(v_snapshot->>'tier', '')::integer,
    0
  );

  if v_tier < 1 or v_tier > 3 then
    raise exception 'Base item % does not have a supported +1 to +3 smith tier', v_base.item_name;
  end if;
  if (v_slot = 'B' and v_tier < 2) or (v_slot = 'C' and v_tier < 3) then
    raise exception 'Slot % is not unlocked on +% item %', v_slot, v_tier, v_base.item_name;
  end if;

  v_variant_rarity := lower(coalesce(
    v_variant->>'rarity',
    v_plan.result_item_payload->'recipe'->>'rarity',
    v_plan.plan_payload->'recipe'->>'rarity',
    v_plan.rarity,
    ''
  ));
  v_expected_slot := case
    when v_variant_rarity in ('common', 'uncommon') then 'A'
    when v_variant_rarity = 'rare' then 'B'
    when v_variant_rarity in ('very rare', 'very_rare') then 'C'
    else null
  end;
  if v_expected_slot is null then
    raise exception 'Rarity % is outside the current A/B/C enchanting workshop', v_variant_rarity;
  end if;
  if v_expected_slot <> v_slot then
    raise exception 'Variant rarity % belongs in Slot %, not Slot %', v_variant_rarity, v_expected_slot, v_slot;
  end if;

  if lower(concat_ws(' ', v_base.item_type, v_base.card_payload->>'item_type', v_base.card_payload->>'type', v_base.card_payload->>'uiType'))
     !~ 'weapon|armor|armour|shield|ammunition|melee|ranged|(^|[^a-z])(m|r|a|la|ma|ha|s|sh)([^a-z]|$)' then
    raise exception 'Base item % is not a supported physical gear type', v_base.item_name;
  end if;

  v_existing_slots := coalesce(v_base.card_payload#>'{enchanting,slots}', '{}'::jsonb);
  if v_existing_slots = '{}'::jsonb then
    v_existing_slots := coalesce(v_snapshot->'existingSlots', v_snapshot->'existing_slots', '{}'::jsonb);
  end if;
  v_variant := v_variant || jsonb_build_object('slot', v_slot, 'applied_at', now());
  v_next_slots := jsonb_set(v_existing_slots, array[v_slot], v_variant, true);
  v_base_name := coalesce(
    nullif(v_base.card_payload#>>'{enchanting,base_name}', ''),
    nullif(v_snapshot->>'baseName', ''),
    nullif(v_snapshot->>'base_name', ''),
    v_base.item_name
  );
  v_base_entries := coalesce(
    v_base.card_payload#>'{enchanting,base_entries}',
    v_snapshot->'baseEntries',
    v_snapshot->'base_entries',
    '[]'::jsonb
  );
  if jsonb_typeof(v_base_entries) <> 'array' then
    v_base_entries := '[]'::jsonb;
  end if;

  with ordered_lines as (
    select nullif(value #>> '{}', '') as line, 100 + ordinality::integer as sort_key
    from jsonb_array_elements(v_base_entries) with ordinality
    union all
    select nullif(slot_value->>'effect_text', ''),
           case slot_key when 'A' then 1000 when 'B' then 2000 when 'C' then 3000 else 4000 end
    from jsonb_each(v_next_slots) as slots(slot_key, slot_value)
    union all
    select nullif(entry_value #>> '{}', ''),
           (case slot_key when 'A' then 1100 when 'B' then 2100 when 'C' then 3100 else 4100 end) + ordinality::integer
    from jsonb_each(v_next_slots) as slots(slot_key, slot_value)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(slot_value->'entries') = 'array' then slot_value->'entries' else '[]'::jsonb end
    ) with ordinality as entries(entry_value, ordinality)
  ), deduped as (
    select line, min(sort_key) as sort_key
    from ordered_lines
    where line is not null
    group by line
  )
  select coalesce(jsonb_agg(to_jsonb(line) order by sort_key), '[]'::jsonb)
  into v_final_entries
  from deduped;

  select string_agg(value #>> '{}', E'\n')
  into v_output_description
  from jsonb_array_elements(v_final_entries);

  v_output_name := coalesce(nullif(v_snapshot->>'finalName', ''), nullif(v_snapshot->>'final_name', ''), v_plan.result_item_name, v_base.item_name);
  v_output_rarity := coalesce(
    nullif(v_snapshot->>'outputRarity', ''),
    nullif(v_snapshot->>'output_rarity', ''),
    nullif(v_base.item_rarity, ''),
    case v_tier when 1 then 'Uncommon' when 2 then 'Rare' when 3 then 'Very Rare' end
  );

  select coalesce(kind, 'npc') into v_target_kind
  from public.characters
  where id = v_plan.target_character_id;
  if found then
    v_owner_type := case when v_target_kind = 'merchant' then 'merchant' else 'npc' end;
    v_owner_id := v_plan.target_character_id::text;
    v_target_user_id := null;
  else
    select user_id into v_target_user_id
    from public.players
    where id = v_plan.target_character_id;
    if not found or v_target_user_id is null then
      raise exception 'Craft target % was not found or has no user_id', v_plan.target_character_id;
    end if;
    v_owner_type := 'player';
    v_owner_id := v_target_user_id::text;
  end if;

  for v_material in
    select value from jsonb_array_elements(coalesce(v_plan.selected_materials, '[]'::jsonb))
  loop
    if nullif(v_material->>'inventory_item_id', '') is null then
      continue;
    end if;
    v_material_id := (v_material->>'inventory_item_id')::uuid;
    if v_material_id = v_base.id then
      raise exception 'The base item cannot also be consumed as an enchanting catalyst';
    end if;
    v_required := greatest(coalesce(nullif(v_material->>'quantity_required', '')::integer, 1), 1);
    select quantity into v_current_qty
    from public.inventory_items
    where id = v_material_id
    for update;
    if not found then
      raise exception 'Selected catalyst item % was not found', v_material_id;
    end if;
    if coalesce(v_current_qty, 0) < v_required then
      raise exception 'Selected catalyst item % has quantity %, requires %', v_material_id, v_current_qty, v_required;
    end if;
    if v_current_qty = v_required then
      delete from public.inventory_items where id = v_material_id;
    else
      update public.inventory_items
      set quantity = v_current_qty - v_required, updated_at = now()
      where id = v_material_id;
    end if;
  end loop;

  if v_base.quantity = 1 then
    delete from public.inventory_items where id = v_base.id;
  else
    update public.inventory_items
    set quantity = v_base.quantity - 1, updated_at = now()
    where id = v_base.id;
  end if;

  v_crafter := coalesce(v_plan.result_item_payload->'crafter_snapshot', v_plan.plan_payload->'crafter_snapshot', '{}'::jsonb);
  v_actor_id := nullif(v_crafter->>'character_id', '')::uuid;
  v_actor_name := coalesce(nullif(v_crafter->>'character_name', ''), v_plan.target_character_name, 'A crafter');
  v_report := concat_ws(' ', v_actor_name, 'replaced Slot', v_slot, 'on', v_base.item_name || ',', 'creating', v_output_name || '.', 'Attempt:', v_attempt.result_tier || ',', 'roll', coalesce(v_attempt.roll_total::text, '—'), 'vs DC', coalesce(v_attempt.dc::text, '—') || '.');

  v_output_payload := coalesce(v_base.card_payload, '{}'::jsonb)
    || jsonb_build_object(
      'name', v_output_name,
      'item_name', v_output_name,
      'rarity', v_output_rarity,
      'item_rarity', v_output_rarity,
      'entries', v_final_entries,
      'item_description', v_output_description,
      'effect_text', v_output_description,
      'rulesText', v_output_description,
      'enchanting', jsonb_build_object(
        'version', 1,
        'base_name', v_base_name,
        'tier', v_tier,
        'slots', v_next_slots,
        'base_entries', v_base_entries,
        'last_replaced_slot', v_slot,
        'source_base_inventory_item_id', v_base.id,
        'updated_at', now()
      ),
      'crafting', coalesce(v_base.card_payload->'crafting', '{}'::jsonb) || jsonb_build_object(
        'craft_plan_id', v_plan.id,
        'attempt_id', v_attempt.id,
        'recipe_id', v_plan.recipe_id,
        'recipe_name', v_plan.recipe_name,
        'selected_materials', coalesce(v_plan.selected_materials, '[]'::jsonb),
        'crafter_snapshot', v_crafter,
        'completion_report', v_report,
        'attempt_result', v_attempt.result_tier,
        'attempt_roll_total', v_attempt.roll_total,
        'attempt_dc', v_attempt.dc,
        'replaced_inventory_item_id', v_base.id,
        'replaced_slot', v_slot
      )
    );

  insert into public.inventory_items (
    item_id, owner_type, owner_id, user_id, item_name, item_type, item_rarity,
    item_description, item_weight, item_cost, quantity, card_payload, is_equipped,
    created_at, updated_at
  ) values (
    v_base.item_id, v_owner_type, v_owner_id, v_target_user_id, v_output_name,
    v_base.item_type, v_output_rarity, v_output_description, v_base.item_weight,
    v_base.item_cost, 1, v_output_payload, v_base.is_equipped, now(), now()
  ) returning id into v_output_id;

  update public.craft_plans
  set status = 'completed', completed_at = now(), completed_attempt_id = v_attempt.id,
      completion_output_item_id = v_output_id, completion_report = v_report, updated_at = now()
  where id = v_plan.id;

  insert into public.crafting_attempts (
    craft_plan_id, actor_character_id, actor_character_name, recipe_id, recipe_name,
    roll_total, dc, result_tier, selected_materials, material_effects,
    consumed_materials, output_item_payload, report_text
  ) values (
    v_plan.id, v_actor_id, v_actor_name, v_plan.recipe_id, v_plan.recipe_name,
    v_attempt.roll_total, v_attempt.dc, 'completed', coalesce(v_plan.selected_materials, '[]'::jsonb),
    coalesce(v_attempt.material_effects, '[]'::jsonb), coalesce(v_plan.selected_materials, '[]'::jsonb),
    jsonb_build_object('created_inventory_item_id', v_output_id, 'replaced_inventory_item_id', v_base.id, 'name', v_output_name, 'card_payload', v_output_payload),
    v_report
  );

  return jsonb_build_object(
    'ok', true,
    'craft_plan_id', v_plan.id,
    'attempt_id', v_attempt.id,
    'created_item_id', v_output_id,
    'created_item_name', v_output_name,
    'replaced_item_id', v_base.id,
    'replaced_slot', v_slot,
    'owner_type', v_owner_type,
    'owner_id', v_owner_id,
    'slots', v_next_slots,
    'report', v_report
  );
end;
$function$;

create or replace function public.complete_craft_plan_v1(
  p_plan_id uuid,
  p_attempt_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  caller_role text := coalesce(auth.role(), '');
  v_discipline text;
begin
  if caller_role <> 'service_role' and not private.current_user_is_admin() then
    raise exception 'Only an administrator can complete a craft plan' using errcode = '42501';
  end if;

  select lower(coalesce(discipline, '')) into v_discipline
  from public.craft_plans
  where id = p_plan_id;

  if v_discipline is null then
    raise exception 'Craft plan % not found', p_plan_id;
  end if;
  if v_discipline = 'enchanting' then
    return private.complete_enchanting_craft_plan_v1_impl(p_plan_id, p_attempt_id);
  end if;
  return private.complete_craft_plan_v1_impl(p_plan_id, p_attempt_id);
end;
$function$;

comment on function private.complete_enchanting_craft_plan_v1_impl(uuid, uuid) is
  'Completes a successful Enchanting craft atomically: consumes one base item and its catalyst, replaces only the targeted A/B/C slot, preserves other slots, and creates one replacement inventory item.';

commit;
