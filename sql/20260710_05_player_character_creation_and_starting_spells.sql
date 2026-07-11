-- Secure 2024 player-character creation and starting spell choices.

create or replace function private.xphb_starting_spell_requirements_v1(p_class_key text)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case lower(coalesce(p_class_key,''))
    when 'bard' then jsonb_build_object('cantrips',2,'leveled',4,'prepared',4)
    when 'cleric' then jsonb_build_object('cantrips',3,'leveled',4,'prepared',4)
    when 'druid' then jsonb_build_object('cantrips',2,'leveled',4,'prepared',4)
    when 'paladin' then jsonb_build_object('cantrips',0,'leveled',2,'prepared',2)
    when 'ranger' then jsonb_build_object('cantrips',0,'leveled',2,'prepared',2)
    when 'sorcerer' then jsonb_build_object('cantrips',4,'leveled',2,'prepared',2)
    when 'warlock' then jsonb_build_object('cantrips',2,'leveled',2,'prepared',2)
    when 'wizard' then jsonb_build_object('cantrips',3,'leveled',6,'prepared',4)
    else jsonb_build_object('cantrips',0,'leveled',0,'prepared',0)
  end;
$$;

create or replace function public.get_my_player_character_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_user uuid := auth.uid();
  v_character public.characters%rowtype;
  v_sheet jsonb;
  v_permission public.character_permissions%rowtype;
begin
  if v_user is null then
    raise exception 'Sign in is required.' using errcode = '42501';
  end if;

  select cp.* into v_permission
  from public.character_permissions cp
  join public.characters c on c.id = cp.character_id
  where cp.user_id = v_user
    and cp.can_edit
    and 'player-character' = any(coalesce(c.tags,'{}'::text[]))
  order by cp.created_at asc
  limit 1;

  if v_permission.character_id is null then return null; end if;

  select * into v_character from public.characters where id = v_permission.character_id;
  select sheet into v_sheet from public.character_sheets where character_id = v_permission.character_id;

  return to_jsonb(v_character)
    || jsonb_build_object(
      'character_sheet', coalesce(v_sheet,'{}'::jsonb),
      'permission', to_jsonb(v_permission)
    );
end;
$$;

create or replace function public.create_player_character_v1(
  p_payload jsonb,
  p_spell_choices jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_user uuid := auth.uid();
  v_payload jsonb := coalesce(p_payload,'{}'::jsonb);
  v_sheet jsonb;
  v_name text;
  v_class_key text;
  v_class public.class_catalog%rowtype;
  v_character_id uuid;
  v_tags text[] := array['player-character']::text[];
  v_choice jsonb;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
  v_seen uuid[] := '{}'::uuid[];
  v_prepared boolean;
  v_cantrip_count integer := 0;
  v_leveled_count integer := 0;
  v_prepared_count integer := 0;
  v_requirements jsonb;
  v_required_cantrips integer;
  v_required_leveled integer;
  v_required_prepared integer;
begin
  if v_user is null then
    raise exception 'Sign in is required to create a player character.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'Character payload must be a JSON object.';
  end if;
  if jsonb_typeof(coalesce(p_spell_choices,'[]'::jsonb)) <> 'array' then
    raise exception 'Spell choices must be an array.';
  end if;
  if jsonb_array_length(coalesce(p_spell_choices,'[]'::jsonb)) > 12 then
    raise exception 'Too many starting spell choices.';
  end if;

  if exists (
    select 1
    from public.character_permissions cp
    join public.characters c on c.id = cp.character_id
    where cp.user_id = v_user
      and cp.can_edit
      and 'player-character' = any(coalesce(c.tags,'{}'::text[]))
  ) then
    raise exception 'This account already has a linked player character.' using errcode = '23505';
  end if;

  v_name := btrim(coalesce(v_payload->>'name',''));
  if char_length(v_name) < 2 then raise exception 'Character name must be at least 2 characters.'; end if;
  if char_length(v_name) > 120 then raise exception 'Character name must be 120 characters or fewer.'; end if;
  if exists (select 1 from public.characters where lower(name)=lower(v_name)) then
    raise exception 'A character named % already exists.', v_name using errcode = '23505';
  end if;

  v_sheet := coalesce(v_payload->'sheet','{}'::jsonb);
  if jsonb_typeof(v_sheet) <> 'object' then raise exception 'Character sheet must be a JSON object.'; end if;
  v_class_key := lower(btrim(coalesce(v_sheet->>'classKey',v_sheet->'meta'->>'classKey','')));
  if v_class_key = '' or v_class_key = 'civilian' then
    raise exception 'Choose a 2024 adventuring class.';
  end if;

  select * into v_class
  from public.class_catalog
  where class_key = v_class_key and source = 'XPHB'
  limit 1;
  if v_class.id is null then
    raise exception 'The 2024 class % is not available.', v_class_key using errcode = 'P0002';
  end if;

  if coalesce(nullif(v_sheet->>'level','')::integer,1) <> 1 then
    raise exception 'New player characters must begin at level 1.';
  end if;

  v_requirements := private.xphb_starting_spell_requirements_v1(v_class_key);
  v_required_cantrips := coalesce((v_requirements->>'cantrips')::integer,0);
  v_required_leveled := coalesce((v_requirements->>'leveled')::integer,0);
  v_required_prepared := coalesce((v_requirements->>'prepared')::integer,0);

  for v_choice in select value from jsonb_array_elements(coalesce(p_spell_choices,'[]'::jsonb)) loop
    begin
      v_spell_id := (v_choice->>'spell_id')::uuid;
    exception when others then
      raise exception 'Every spell choice must include a valid spell_id.';
    end;
    if v_spell_id = any(v_seen) then raise exception 'Duplicate spell choices are not allowed.'; end if;
    v_seen := array_append(v_seen,v_spell_id);

    select * into v_spell from public.spells_catalog where id = v_spell_id;
    if v_spell.id is null then raise exception 'A selected spell was not found.' using errcode = 'P0002'; end if;
    if v_spell.source <> 'XPHB' then raise exception '% must use its 2024/XPHB version.', v_spell.name; end if;
    if v_spell.level not in (0,1) then raise exception '% is not a valid level-one spell choice.', v_spell.name; end if;
    if not exists (
      select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) as class_name
      where lower(class_name) = lower(v_class.class_name)
    ) then
      raise exception '% is not on the % class spell list.', v_spell.name, v_class.class_name;
    end if;

    begin
      v_prepared := coalesce((v_choice->>'prepared')::boolean,false);
    exception when others then
      v_prepared := false;
    end;

    if v_spell.level = 0 then
      v_cantrip_count := v_cantrip_count + 1;
    else
      v_leveled_count := v_leveled_count + 1;
      if v_prepared then v_prepared_count := v_prepared_count + 1; end if;
    end if;
  end loop;

  if v_cantrip_count <> v_required_cantrips then
    raise exception 'Choose exactly % starting cantrip(s).', v_required_cantrips;
  end if;
  if v_leveled_count <> v_required_leveled then
    raise exception 'Choose exactly % starting level-one spell(s).', v_required_leveled;
  end if;
  if v_prepared_count <> v_required_prepared then
    raise exception 'Mark exactly % level-one spell(s) as prepared.', v_required_prepared;
  end if;

  if jsonb_typeof(v_payload->'tags') = 'array' then
    select array_agg(distinct tag order by tag) into v_tags
    from (
      select lower(btrim(value)) as tag from jsonb_array_elements_text(v_payload->'tags') where btrim(value) <> ''
      union all select 'player-character'
    ) normalized;
  end if;

  v_sheet := v_sheet
    || jsonb_build_object(
      'classKey',v_class.class_key,
      'className',v_class.class_name,
      'class',v_class.class_name,
      'level',1,
      'rulesetSource','XPHB',
      'ruleset','2024',
      'proficiencyBonus',2,
      'hitDice','1d' || coalesce(v_class.hit_die,8)::text
    );
  v_sheet := v_sheet || jsonb_build_object(
    'meta',coalesce(v_sheet->'meta','{}'::jsonb) || jsonb_build_object(
      'classKey',v_class.class_key,
      'className',v_class.class_name,
      'level',1,
      'rulesetSource','XPHB',
      'ruleset','2024',
      'creator','player_character_creator_v1'
    )
  );

  insert into public.characters(
    name,race,role,description,motivation,quirk,mannerism,voice,secret,affiliation,status,background,tags,kind,
    storefront_enabled,is_hidden,state,updated_at
  ) values (
    v_name,
    nullif(btrim(v_payload->>'race'),''),
    coalesce(nullif(btrim(v_payload->>'role'),''),v_class.class_name),
    nullif(btrim(v_payload->>'description'),''),
    nullif(btrim(v_payload->>'motivation'),''),
    nullif(btrim(v_payload->>'quirk'),''),
    nullif(btrim(v_payload->>'mannerism'),''),
    nullif(btrim(v_payload->>'voice'),''),
    nullif(btrim(v_payload->>'secret'),''),
    nullif(btrim(v_payload->>'affiliation'),''),
    'alive',
    nullif(btrim(v_payload->>'background'),''),
    coalesce(v_tags,array['player-character']::text[]),
    'npc',false,true,'resting',now()
  ) returning id into v_character_id;

  insert into public.character_sheets(character_id,sheet,updated_at)
  values(v_character_id,v_sheet,now());

  insert into public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert)
  values(v_character_id,v_user,true,true,false);

  insert into public.character_progression(
    character_id,class_id,class_level,experience_points,pending_level_up,created_by,updated_at
  ) values(v_character_id,v_class.id,1,0,false,v_user,now());

  insert into public.character_level_events(
    character_id,event_type,from_level,to_level,xp_before,xp_after,details,created_by
  ) values(
    v_character_id,'player_character_created',null,1,null,0,
    jsonb_build_object('classKey',v_class.class_key,'source','XPHB','ruleset','2024'),v_user
  );

  for v_choice in select value from jsonb_array_elements(coalesce(p_spell_choices,'[]'::jsonb)) loop
    v_spell_id := (v_choice->>'spell_id')::uuid;
    select * into v_spell from public.spells_catalog where id=v_spell_id;
    begin v_prepared := coalesce((v_choice->>'prepared')::boolean,false); exception when others then v_prepared := false; end;
    insert into public.character_spells(
      character_id,spell_id,source_type,source_label,prepared,always_available,casting_stat,raw_payload
    ) values(
      v_character_id,v_spell_id,'class',v_class.class_name,
      case when v_spell.level=0 then true else v_prepared end,
      v_spell.level=0,
      v_class.spellcasting_ability,
      jsonb_build_object('grantedAtLevel',1,'rulesetSource','XPHB','creator','player_character_creator_v1')
    );
  end loop;

  update public.players set name=v_name,sheet=v_sheet,updated_at=now() where user_id=v_user;
  if not found then
    insert into public.players(user_id,name,sheet,updated_at) values(v_user,v_name,v_sheet,now());
  end if;

  return v_character_id;
end;
$$;

revoke all on function public.get_my_player_character_v1() from public,anon;
revoke all on function public.create_player_character_v1(jsonb,jsonb) from public,anon;
grant execute on function public.get_my_player_character_v1() to authenticated;
grant execute on function public.create_player_character_v1(jsonb,jsonb) to authenticated;
