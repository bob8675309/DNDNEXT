-- DNDNext crafting workflow v6
-- Removes Troll Heart from forge stock and permits completed crafts to be delivered
-- directly to a player record such as Letho.

-- Troll Heart remains available for future alchemy or enchanting definitions,
-- but the two smithing-only catalog variants are no longer forge materials.
delete from public.items_catalog
where item_key in (
  'smithing:material:troll-heart',
  'smithing:material:troll-heart:hq'
);

-- Extend the existing completion transaction without duplicating its material
-- consumption and output-generation rules. The function continues to resolve
-- NPCs and merchants through public.characters, then falls back to public.players.
do $craft_player_delivery_v6$
declare
  v_definition text;
begin
  select pg_get_functiondef('private.complete_craft_plan_v1_impl(uuid,uuid)'::regprocedure)
  into v_definition;

  if position('v_target_user_id uuid;' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      'v_owner_type text := ''npc'';',
      E'v_owner_type text := ''npc'';\n  v_target_user_id uuid;'
    );

    v_definition := regexp_replace(
      v_definition,
      'select coalesce\(kind, ''npc''\)[[:space:]]+into v_target_kind[[:space:]]+from public\.characters[[:space:]]+where id = v_plan\.target_character_id;[[:space:]]+if coalesce\(v_target_kind, ''npc''\) = ''merchant'' then[[:space:]]+v_owner_type := ''merchant'';[[:space:]]+else[[:space:]]+v_owner_type := ''npc'';[[:space:]]+end if;',
      E'select coalesce(kind, ''npc'')\n  into v_target_kind\n  from public.characters\n  where id = v_plan.target_character_id;\n\n  if found then\n    if coalesce(v_target_kind, ''npc'') = ''merchant'' then\n      v_owner_type := ''merchant'';\n    else\n      v_owner_type := ''npc'';\n    end if;\n  else\n    select user_id\n    into v_target_user_id\n    from public.players\n    where id = v_plan.target_character_id;\n\n    if found then\n      v_target_kind := ''player'';\n      v_owner_type := ''player'';\n    else\n      raise exception ''Craft target % was not found in characters or players'', v_plan.target_character_id;\n    end if;\n  end if;'
    );

    v_definition := regexp_replace(
      v_definition,
      'v_plan\.target_character_id,[[:space:]]+null,[[:space:]]+v_output_name,',
      E'v_plan.target_character_id,\n    v_target_user_id,\n    v_output_name,'
    );

    if position('v_target_user_id uuid;' in v_definition) = 0
       or position('from public.players' in v_definition) = 0
       or position('v_owner_type := ''player'';' in v_definition) = 0
       or position('v_target_user_id,' in v_definition) = 0 then
      raise exception 'Could not safely patch private.complete_craft_plan_v1_impl for player delivery';
    end if;

    execute v_definition;
  end if;
end;
$craft_player_delivery_v6$;
