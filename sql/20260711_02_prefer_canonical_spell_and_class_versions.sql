-- Update existing secure creator and level-up RPCs to use one preferred source version.

do $do$
declare
  v_def text;
begin
  select pg_get_functiondef('public.create_player_character_v1(jsonb,jsonb)'::regprocedure) into v_def;

  v_def := replace(v_def,
$old$  where class_key = v_class_key and source = 'XPHB'
  limit 1;$old$,
$new$  where class_key = v_class_key
  order by public.character_source_priority_v1(source), source
  limit 1;$new$);

  v_def := replace(v_def,
$old$raise exception 'The 2024 class % is not available.', v_class_key$old$,
$new$raise exception 'The class % is not available.', v_class_key$new$);

  v_def := replace(v_def,
$old$v_requirements := private.xphb_starting_spell_requirements_v1(v_class_key);$old$,
$new$v_requirements := private.starting_spell_requirements_v2(v_class.id);$new$);

  v_def := replace(v_def,
$old$if v_spell.source <> 'XPHB' then raise exception '% must use its 2024/XPHB version.', v_spell.name; end if;$old$,
$new$if not public.is_preferred_spell_version_v1(v_spell.id) then raise exception '% must use the preferred catalog version.', v_spell.name; end if;$new$);

  v_def := replace(v_def,
$old$'rulesetSource','XPHB'$old$,
$new$'rulesetSource',v_class.source$new$);
  v_def := replace(v_def,
$old$'ruleset','2024'$old$,
$new$'ruleset',v_class.ruleset$new$);

  if v_def not like '%order by public.character_source_priority_v1(source)%' then
    raise exception 'Could not patch create_player_character_v1 class preference contract.';
  end if;
  if v_def not like '%is_preferred_spell_version_v1%' then
    raise exception 'Could not patch create_player_character_v1 spell preference contract.';
  end if;

  execute v_def;
end
$do$;

do $do$
declare
  v_def text;
begin
  select pg_get_functiondef('public.begin_character_level_up_v1(uuid)'::regprocedure) into v_def;
  v_def := replace(v_def,
$old$v_class.source = 'XPHB'$old$,
$new$public.is_preferred_class_version_v1(v_class.id)$new$);
  if v_def not like '%is_preferred_class_version_v1%' then
    raise exception 'Could not patch begin_character_level_up_v1 class preference contract.';
  end if;
  execute v_def;
end
$do$;

do $do$
declare
  v_def text;
begin
  select pg_get_functiondef('public.complete_character_level_up_v1(uuid,jsonb)'::regprocedure) into v_def;

  v_def := replace(v_def,
$old$if v_class.source <> 'XPHB' then raise exception 'Only 2024/XPHB progression can be applied.'; end if;$old$,
$new$if not public.is_preferred_class_version_v1(v_class.id) then raise exception 'Only the preferred class version can be applied.'; end if;$new$);

  v_def := replace(v_def,
$old$if v_spell.source<>'XPHB' then raise exception '% must use its 2024/XPHB version.',v_spell.name; end if;$old$,
$new$if not public.is_preferred_spell_version_v1(v_spell.id) then raise exception '% must use the preferred catalog version.',v_spell.name; end if;$new$);

  v_def := replace(v_def,
$old$'rulesetSource','XPHB'$old$,
$new$'rulesetSource',v_class.source$new$);
  v_def := replace(v_def,
$old$'ruleset','2024'$old$,
$new$'ruleset',v_class.ruleset$new$);

  if v_def not like '%is_preferred_class_version_v1%' then
    raise exception 'Could not patch complete_character_level_up_v1 class preference contract.';
  end if;
  if v_def not like '%is_preferred_spell_version_v1%' then
    raise exception 'Could not patch complete_character_level_up_v1 spell preference contract.';
  end if;

  execute v_def;
end
$do$;
