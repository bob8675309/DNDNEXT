-- Align player inventory ownership with auth user UUIDs.
-- NPC and merchant inventory ownership remains characters.id based.

do $player_inventory_owner_alignment_v1$
declare
  v_definition text;
begin
  select pg_get_functiondef('private.complete_craft_plan_v1_impl(uuid,uuid)'::regprocedure)
  into v_definition;

  v_definition := replace(v_definition, E'\r\n', E'\n');

  if position('v_output_owner_id text;' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      'v_target_user_id uuid;',
      E'v_target_user_id uuid;\n  v_output_owner_id text;'
    );

    v_definition := replace(
      v_definition,
      E'  end if;\n\n  -- Verify and consume selected materials.',
      E'  end if;\n\n  if v_owner_type = ''player'' then\n    if v_target_user_id is null then\n      raise exception ''Player craft target % has no user_id'', v_plan.target_character_id;\n    end if;\n    v_output_owner_id := v_target_user_id::text;\n  else\n    v_output_owner_id := v_plan.target_character_id::text;\n  end if;\n\n  -- Verify and consume selected materials.'
    );

    v_definition := replace(
      v_definition,
      E'    v_plan.target_character_id,\n    v_target_user_id,',
      E'    v_output_owner_id,\n    v_target_user_id,'
    );

    v_definition := replace(
      v_definition,
      '''owner_id'', v_plan.target_character_id,',
      '''owner_id'', v_output_owner_id,'
    );

    if position('v_output_owner_id text;' in v_definition) = 0
       or position('v_output_owner_id := v_target_user_id::text;' in v_definition) = 0
       or position('v_output_owner_id := v_plan.target_character_id::text;' in v_definition) = 0
       or position(E'    v_output_owner_id,\n    v_target_user_id,') in v_definition = 0
       or position('''owner_id'', v_output_owner_id,') in v_definition = 0 then
      raise exception 'Could not safely patch private.complete_craft_plan_v1_impl ownership routing';
    end if;

    execute v_definition;
  end if;
end;
$player_inventory_owner_alignment_v1$;

update public.inventory_items ii
set owner_id = p.user_id::text,
    updated_at = now()
from public.players p
where ii.owner_type = 'player'
  and ii.user_id = p.user_id
  and ii.owner_id = p.id::text
  and ii.owner_id is distinct from p.user_id::text;
