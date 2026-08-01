-- Normalize completed crafting output metadata and preserve the actual crafter
-- in completion receipts. This migration patches the audited implementation
-- fail-closed: any unexpected source drift aborts the migration.

do $migration$
declare
  v_definition text;
  v_anchor text;
  v_replacement text;
  v_occurrences integer;
begin
  select pg_get_functiondef('private.complete_craft_plan_v1_impl(uuid,uuid)'::regprocedure)
  into v_definition;

  v_anchor := $anchor$  v_output_quantity integer := 1;$anchor$;
  v_replacement := $replacement$  v_output_quantity integer := 1;
  v_crafter_id uuid;
  v_crafter_id_text text;
  v_crafter_name text;$replacement$;
  v_occurrences := (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception 'Craft completion declaration anchor mismatch: expected 1 occurrence, found %', v_occurrences;
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  v_anchor := $anchor$  v_output_type := coalesce(
    nullif(v_source_payload->>'item_type', ''),
    nullif(v_source_payload->>'type', ''),
    nullif(v_plan.family, ''),
    nullif(v_plan.category, ''),
    nullif(v_plan.recipe_kind, ''),
    'Crafted Item'
  );$anchor$;
  v_replacement := $replacement$  v_output_type := coalesce(
    nullif(v_source_payload->>'uiType', ''),
    nullif(v_source_payload->>'ui_type', ''),
    nullif(v_source_payload->>'item_type', ''),
    case
      when coalesce(v_source_payload->>'type', '') ~ '\|' then null
      else nullif(v_source_payload->>'type', '')
    end,
    nullif(v_plan.category, ''),
    nullif(v_plan.family, ''),
    nullif(v_plan.recipe_kind, ''),
    'Crafted Item'
  );$replacement$;
  v_occurrences := (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception 'Craft completion item-type anchor mismatch: expected 1 occurrence, found %', v_occurrences;
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  v_anchor := $anchor$  v_output_rarity := coalesce(
    nullif(v_source_payload->>'item_rarity', ''),
    nullif(v_source_payload->>'rarity', ''),
    nullif(v_plan.rarity, ''),
    'Common'
  );$anchor$;
  v_replacement := $replacement$  v_output_rarity := coalesce(
    nullif(v_source_payload->>'item_rarity', ''),
    nullif(v_source_payload->>'rarity', ''),
    nullif(v_plan.rarity, ''),
    'Common'
  );

  if lower(coalesce(v_output_rarity, '')) in ('', 'none', 'mundane') then
    v_output_rarity := 'Mundane';
  end if;$replacement$;
  v_occurrences := (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception 'Craft completion rarity anchor mismatch: expected 1 occurrence, found %', v_occurrences;
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  v_anchor := $anchor$  v_report := concat_ws(
    ' ',
    coalesce(v_plan.target_character_name, 'A crafter'),
    'completed',$anchor$;
  v_replacement := $replacement$  v_crafter_id_text := nullif(v_plan.plan_payload->'crafter'->>'id', '');
  if v_crafter_id_text is not null
     and v_crafter_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_crafter_id := v_crafter_id_text::uuid;
  end if;
  v_crafter_id := coalesce(v_crafter_id, v_attempt.actor_character_id, v_plan.target_character_id);
  v_crafter_name := coalesce(
    nullif(v_plan.plan_payload->'crafter'->>'name', ''),
    nullif(v_attempt.actor_character_name, ''),
    nullif(v_plan.target_character_name, ''),
    'A crafter'
  );

  v_report := concat_ws(
    ' ',
    v_crafter_name,
    'completed',$replacement$;
  v_occurrences := (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception 'Craft completion report anchor mismatch: expected 1 occurrence, found %', v_occurrences;
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  v_anchor := $anchor$    v_plan.target_character_id,
    v_plan.target_character_name,$anchor$;
  v_replacement := $replacement$    v_crafter_id,
    v_crafter_name,$replacement$;
  v_occurrences := (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception 'Craft completion receipt actor anchor mismatch: expected 1 occurrence, found %', v_occurrences;
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);

  execute v_definition;
end;
$migration$;

-- Repair previously completed physical crafts generically. No generated IDs are
-- embedded: completed plans are linked to their output item and successful attempt.
do $repair$
declare
  v_row record;
  v_report text;
  v_card_payload jsonb;
begin
  for v_row in
    select
      cp.id as plan_id,
      cp.completion_output_item_id as output_item_id,
      cp.completed_attempt_id as successful_attempt_id,
      cp.recipe_name,
      coalesce(nullif(cp.result_item_name, ''), nullif(ii.item_name, ''), cp.recipe_name, 'Crafted Item') as item_name,
      coalesce(
        nullif(ii.card_payload->>'uiType', ''),
        nullif(ii.card_payload->>'ui_type', ''),
        nullif(ii.card_payload->>'item_type', ''),
        nullif(cp.category, ''),
        nullif(cp.family, ''),
        case when coalesce(ii.item_type, '') ~ '\|' then null else nullif(ii.item_type, '') end,
        'Crafted Item'
      ) as normalized_type,
      case
        when lower(coalesce(
          nullif(ii.card_payload->>'item_rarity', ''),
          nullif(ii.card_payload->>'rarity', ''),
          nullif(cp.rarity, ''),
          nullif(ii.item_rarity, ''),
          'Common'
        )) in ('', 'none', 'mundane') then 'Mundane'
        else coalesce(
          nullif(ii.card_payload->>'item_rarity', ''),
          nullif(ii.card_payload->>'rarity', ''),
          nullif(cp.rarity, ''),
          nullif(ii.item_rarity, ''),
          'Common'
        )
      end as normalized_rarity,
      coalesce(
        case
          when coalesce(cp.plan_payload->'crafter'->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (cp.plan_payload->'crafter'->>'id')::uuid
          else null
        end,
        success_attempt.actor_character_id,
        cp.target_character_id
      ) as crafter_id,
      coalesce(
        nullif(cp.plan_payload->'crafter'->>'name', ''),
        nullif(success_attempt.actor_character_name, ''),
        nullif(cp.target_character_name, ''),
        'A crafter'
      ) as crafter_name,
      success_attempt.result_tier,
      success_attempt.roll_total,
      success_attempt.dc,
      ii.card_payload
    from public.craft_plans cp
    join public.inventory_items ii on ii.id = cp.completion_output_item_id
    left join public.crafting_attempts success_attempt on success_attempt.id = cp.completed_attempt_id
    where cp.status = 'completed'
      and lower(coalesce(cp.discipline, '')) = 'smithing'
  loop
    v_report := concat_ws(
      ' ',
      v_row.crafter_name,
      'completed',
      v_row.item_name || '.',
      'Attempt:',
      coalesce(v_row.result_tier, 'unknown') || ',',
      'roll',
      coalesce(v_row.roll_total::text, '—'),
      'vs DC',
      coalesce(v_row.dc::text, '—') || '.'
    );

    v_card_payload := coalesce(v_row.card_payload, '{}'::jsonb)
      || jsonb_build_object(
        'item_type', v_row.normalized_type,
        'item_rarity', v_row.normalized_rarity,
        'rarity', v_row.normalized_rarity,
        'crafting', coalesce(v_row.card_payload->'crafting', '{}'::jsonb)
          || jsonb_build_object('completion_report', v_report)
      );

    update public.inventory_items
    set item_type = v_row.normalized_type,
        item_rarity = v_row.normalized_rarity,
        card_payload = v_card_payload,
        updated_at = now()
    where id = v_row.output_item_id;

    update public.craft_plans
    set completion_report = v_report,
        updated_at = now()
    where id = v_row.plan_id;

    update public.crafting_attempts
    set actor_character_id = v_row.crafter_id,
        actor_character_name = v_row.crafter_name,
        report_text = v_report,
        output_item_payload = coalesce(output_item_payload, '{}'::jsonb)
          || jsonb_build_object(
            'card_payload', coalesce(output_item_payload->'card_payload', '{}'::jsonb)
              || jsonb_build_object(
                'item_type', v_row.normalized_type,
                'item_rarity', v_row.normalized_rarity,
                'rarity', v_row.normalized_rarity,
                'crafting', coalesce(output_item_payload->'card_payload'->'crafting', '{}'::jsonb)
                  || jsonb_build_object('completion_report', v_report)
              )
          )
    where craft_plan_id = v_row.plan_id
      and result_tier = 'completed';
  end loop;
end;
$repair$;
