-- Canonical class progression and XP foundation.
-- Isolated from map, crafting, merchant, and inventory systems.

create table if not exists public.class_catalog (
  id uuid primary key default gen_random_uuid(),
  class_key text not null,
  class_name text not null,
  source text not null,
  ruleset text not null,
  edition text,
  source_file text,
  hit_die integer check (hit_die is null or hit_die in (4, 6, 8, 10, 12)),
  primary_abilities text[] not null default '{}',
  saving_throws text[] not null default '{}',
  spellcasting_ability text,
  caster_progression text,
  prepared_spells_formula text,
  summary text,
  cantrip_progression jsonb not null default '[]'::jsonb,
  spells_known_progression jsonb not null default '[]'::jsonb,
  spells_known_progression_fixed jsonb not null default '[]'::jsonb,
  spells_known_progression_fixed_by_level jsonb not null default '{}'::jsonb,
  slot_progression jsonb not null default '[]'::jsonb,
  unlock_levels jsonb not null default '{}'::jsonb,
  class_features_by_level jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_catalog_key_source_unique unique (class_key, source),
  constraint class_catalog_key_format check (class_key = lower(class_key) and class_key ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint class_catalog_ruleset_check check (ruleset in ('2014', '2024', 'campaign'))
);

create table if not exists public.class_level_progression (
  class_id uuid not null references public.class_catalog(id) on delete cascade,
  class_level integer not null check (class_level between 1 and 20),
  proficiency_bonus integer not null check (proficiency_bonus between 2 and 6),
  xp_threshold bigint not null check (xp_threshold >= 0),
  cantrips_known integer check (cantrips_known is null or cantrips_known >= 0),
  spells_known integer check (spells_known is null or spells_known >= 0),
  spell_slots jsonb not null default '[]'::jsonb,
  features jsonb not null default '[]'::jsonb,
  choices jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (class_id, class_level)
);

create table if not exists public.character_progression (
  character_id uuid primary key references public.characters(id) on delete cascade,
  class_id uuid not null references public.class_catalog(id) on delete restrict,
  subclass_name text,
  subclass_source text,
  class_level integer not null default 1 check (class_level between 1 and 20),
  experience_points bigint not null default 0 check (experience_points >= 0),
  pending_level_up boolean not null default false,
  level_choices jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.character_level_events (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  event_type text not null,
  from_level integer check (from_level is null or from_level between 1 and 20),
  to_level integer check (to_level is null or to_level between 1 and 20),
  xp_before bigint check (xp_before is null or xp_before >= 0),
  xp_after bigint check (xp_after is null or xp_after >= 0),
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists class_catalog_name_idx on public.class_catalog(class_name, source);
create index if not exists character_progression_class_idx on public.character_progression(class_id, class_level);
create index if not exists character_level_events_character_idx on public.character_level_events(character_id, created_at desc);

create or replace function public.xp_threshold_for_level_v1(p_level integer)
returns bigint
language sql
immutable
set search_path = pg_catalog
as $$
  select (array[
    0::bigint, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
  ])[greatest(1, least(20, coalesce(p_level, 1)))];
$$;

create or replace function private.seed_class_spell_slots_v1(p_class_key text, p_caster_progression text, p_level integer)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_level integer := greatest(1, least(20, coalesce(p_level, 1)));
  v_progression text := lower(coalesce(p_caster_progression, ''));
  v_slots jsonb := '[]'::jsonb;
  v_pact_count integer;
  v_pact_level integer;
begin
  if v_progression in ('full', '1') then
    v_slots := case v_level
      when 1 then '[2]'::jsonb when 2 then '[3]'::jsonb when 3 then '[4,2]'::jsonb when 4 then '[4,3]'::jsonb
      when 5 then '[4,3,2]'::jsonb when 6 then '[4,3,3]'::jsonb when 7 then '[4,3,3,1]'::jsonb when 8 then '[4,3,3,2]'::jsonb
      when 9 then '[4,3,3,3,1]'::jsonb when 10 then '[4,3,3,3,2]'::jsonb when 11 then '[4,3,3,3,2,1]'::jsonb when 12 then '[4,3,3,3,2,1]'::jsonb
      when 13 then '[4,3,3,3,2,1,1]'::jsonb when 14 then '[4,3,3,3,2,1,1]'::jsonb when 15 then '[4,3,3,3,2,1,1,1]'::jsonb when 16 then '[4,3,3,3,2,1,1,1]'::jsonb
      when 17 then '[4,3,3,3,2,1,1,1,1]'::jsonb when 18 then '[4,3,3,3,3,1,1,1,1]'::jsonb when 19 then '[4,3,3,3,3,2,1,1,1]'::jsonb
      else '[4,3,3,3,3,2,2,1,1]'::jsonb end;
  elsif v_progression in ('half', 'half-up', '1/2') then
    if v_level = 1 and lower(coalesce(p_class_key, '')) <> 'artificer' then
      v_slots := '[]'::jsonb;
    else
      v_slots := case v_level
        when 1 then '[2]'::jsonb when 2 then '[2]'::jsonb when 3 then '[3]'::jsonb when 4 then '[3]'::jsonb
        when 5 then '[4,2]'::jsonb when 6 then '[4,2]'::jsonb when 7 then '[4,3]'::jsonb when 8 then '[4,3]'::jsonb
        when 9 then '[4,3,2]'::jsonb when 10 then '[4,3,2]'::jsonb when 11 then '[4,3,3]'::jsonb when 12 then '[4,3,3]'::jsonb
        when 13 then '[4,3,3,1]'::jsonb when 14 then '[4,3,3,1]'::jsonb when 15 then '[4,3,3,2]'::jsonb when 16 then '[4,3,3,2]'::jsonb
        when 17 then '[4,3,3,3,1]'::jsonb when 18 then '[4,3,3,3,1]'::jsonb when 19 then '[4,3,3,3,2]'::jsonb
        else '[4,3,3,3,2]'::jsonb end;
    end if;
  elsif v_progression = 'pact' then
    v_pact_count := case when v_level = 1 then 1 when v_level < 11 then 2 when v_level < 17 then 3 else 4 end;
    v_pact_level := case when v_level < 3 then 1 when v_level < 5 then 2 when v_level < 7 then 3 when v_level < 9 then 4 else 5 end;
    v_slots := jsonb_build_object('pactSlots', v_pact_count, 'pactSlotLevel', v_pact_level);
  end if;
  return v_slots;
end;
$$;

create or replace function private.seed_class_cantrips_v1(p_class_key text, p_level integer)
returns integer
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_key text := lower(coalesce(p_class_key, ''));
  v_level integer := greatest(1, least(20, coalesce(p_level, 1)));
begin
  return case
    when v_key = 'bard' then case when v_level < 4 then 2 when v_level < 10 then 3 else 4 end
    when v_key = 'cleric' then case when v_level < 4 then 3 when v_level < 10 then 4 else 5 end
    when v_key = 'druid' then case when v_level < 4 then 2 when v_level < 10 then 3 else 4 end
    when v_key = 'sorcerer' then case when v_level < 4 then 4 when v_level < 10 then 5 else 6 end
    when v_key = 'warlock' then case when v_level < 4 then 2 when v_level < 10 then 3 else 4 end
    when v_key = 'wizard' then case when v_level < 4 then 3 when v_level < 10 then 4 else 5 end
    when v_key = 'artificer' then case when v_level < 10 then 2 when v_level < 14 then 3 else 4 end
    else null
  end;
end;
$$;

with core_classes(class_key, class_name, hit_die, primary_abilities, saving_throws, spellcasting_ability, caster_progression, summary) as (
  values
    ('barbarian','Barbarian',12,array['str']::text[],array['str','con']::text[],null,null,'A durable warrior driven by battle fury and raw physical power.'),
    ('bard','Bard',8,array['cha']::text[],array['dex','cha']::text[],'cha','full','A versatile performer and spellcaster whose talents support allies and shape social encounters.'),
    ('cleric','Cleric',8,array['wis']::text[],array['wis','cha']::text[],'wis','full','A divine spellcaster empowered by faith, doctrine, or sacred service.'),
    ('druid','Druid',8,array['wis']::text[],array['int','wis']::text[],'wis','full','A primal spellcaster tied to nature, transformation, and the elemental world.'),
    ('fighter','Fighter',10,array['str','dex']::text[],array['str','con']::text[],null,null,'A trained combatant defined by weapon mastery and battlefield discipline.'),
    ('monk','Monk',8,array['dex','wis']::text[],array['str','dex']::text[],null,null,'A disciplined martial artist who channels focus through body and spirit.'),
    ('paladin','Paladin',10,array['str','cha']::text[],array['wis','cha']::text[],'cha','half','An armored champion whose oath fuels martial and divine power.'),
    ('ranger','Ranger',10,array['dex','wis']::text[],array['str','dex']::text[],'wis','half','A mobile hunter and explorer skilled in wilderness, tracking, and primal magic.'),
    ('rogue','Rogue',8,array['dex']::text[],array['dex','int']::text[],null,null,'A precise specialist who relies on expertise, agility, and opportunistic attacks.'),
    ('sorcerer','Sorcerer',6,array['cha']::text[],array['con','cha']::text[],'cha','full','An innate spellcaster whose magic flows from bloodline, transformation, or supernatural origin.'),
    ('warlock','Warlock',8,array['cha']::text[],array['wis','cha']::text[],'cha','pact','An occult spellcaster empowered by a pact, patron, or forbidden source.'),
    ('wizard','Wizard',6,array['int']::text[],array['int','wis']::text[],'int','full','A learned spellcaster who studies, records, and prepares arcane magic.')
), rulesets(source, ruleset, edition) as (
  values ('PHB','2014','classic'), ('XPHB','2024','revised')
)
insert into public.class_catalog (
  class_key, class_name, source, ruleset, edition, hit_die, primary_abilities, saving_throws,
  spellcasting_ability, caster_progression, summary, raw_payload
)
select c.class_key, c.class_name, r.source, r.ruleset, r.edition, c.hit_die, c.primary_abilities, c.saving_throws,
       c.spellcasting_ability, c.caster_progression, c.summary, jsonb_build_object('seed','phase1_core')
from core_classes c cross join rulesets r
on conflict (class_key, source) do update set
  class_name = excluded.class_name,
  ruleset = excluded.ruleset,
  edition = excluded.edition,
  hit_die = excluded.hit_die,
  primary_abilities = excluded.primary_abilities,
  saving_throws = excluded.saving_throws,
  spellcasting_ability = excluded.spellcasting_ability,
  caster_progression = excluded.caster_progression,
  summary = excluded.summary,
  updated_at = now();

insert into public.class_catalog (
  class_key, class_name, source, ruleset, edition, hit_die, primary_abilities, saving_throws,
  spellcasting_ability, caster_progression, summary, raw_payload
) values (
  'artificer','Artificer','TCE','2014','classic',8,array['int']::text[],array['con','int']::text[],
  'int','half-up','A magical inventor who channels arcane power through tools, infusions, and crafted devices.',jsonb_build_object('seed','phase1_core')
)
on conflict (class_key, source) do update set
  class_name = excluded.class_name, ruleset = excluded.ruleset, edition = excluded.edition,
  hit_die = excluded.hit_die, primary_abilities = excluded.primary_abilities, saving_throws = excluded.saving_throws,
  spellcasting_ability = excluded.spellcasting_ability, caster_progression = excluded.caster_progression,
  summary = excluded.summary, updated_at = now();

insert into public.class_level_progression (
  class_id, class_level, proficiency_bonus, xp_threshold, cantrips_known, spell_slots, features, choices, raw_payload
)
select c.id, level_number, 2 + floor((level_number - 1) / 4.0)::integer,
       public.xp_threshold_for_level_v1(level_number),
       private.seed_class_cantrips_v1(c.class_key, level_number),
       private.seed_class_spell_slots_v1(c.class_key, c.caster_progression, level_number),
       '[]'::jsonb, '[]'::jsonb, jsonb_build_object('seed','phase1_core')
from public.class_catalog c
cross join generate_series(1,20) as level_number
on conflict (class_id, class_level) do nothing;

create or replace function private.can_manage_character_progression_v1(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
  select private.current_user_is_admin()
    or exists (
      select 1 from public.character_permissions cp
      where cp.character_id = p_character_id
        and cp.user_id = auth.uid()
        and cp.can_edit
    );
$$;

create or replace function public.get_character_progression_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_character public.characters%rowtype;
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_current public.class_level_progression%rowtype;
  v_next public.class_level_progression%rowtype;
  v_floor bigint;
  v_next_threshold bigint;
  v_events jsonb := '[]'::jsonb;
  v_percent numeric := 0;
begin
  if auth.uid() is null and not private.current_user_is_admin() then
    raise exception 'Sign in is required to view character progression.' using errcode = '42501';
  end if;

  select * into v_character from public.characters where id = p_character_id;
  if not found then raise exception 'Character not found.' using errcode = 'P0002'; end if;

  select * into v_progression from public.character_progression where character_id = p_character_id;
  if v_progression.character_id is null then
    return jsonb_build_object(
      'character', jsonb_build_object('id',v_character.id,'name',v_character.name,'kind',v_character.kind),
      'progression', null,
      'events', '[]'::jsonb
    );
  end if;

  select * into v_class from public.class_catalog where id = v_progression.class_id;
  select * into v_current from public.class_level_progression where class_id = v_progression.class_id and class_level = v_progression.class_level;
  select * into v_next from public.class_level_progression where class_id = v_progression.class_id and class_level = v_progression.class_level + 1;
  v_floor := public.xp_threshold_for_level_v1(v_progression.class_level);
  v_next_threshold := case when v_progression.class_level < 20 then public.xp_threshold_for_level_v1(v_progression.class_level + 1) else null end;
  if v_next_threshold is not null and v_next_threshold > v_floor then
    v_percent := greatest(0, least(100, round(((v_progression.experience_points - v_floor)::numeric / (v_next_threshold - v_floor)::numeric) * 100, 1)));
  elsif v_progression.class_level >= 20 then
    v_percent := 100;
  end if;

  select coalesce(jsonb_agg(event_row order by (event_row->>'created_at') desc), '[]'::jsonb)
  into v_events
  from (
    select to_jsonb(e) as event_row
    from public.character_level_events e
    where e.character_id = p_character_id
    order by e.created_at desc
    limit 20
  ) recent_events;

  return jsonb_build_object(
    'character', jsonb_build_object('id',v_character.id,'name',v_character.name,'kind',v_character.kind),
    'progression', to_jsonb(v_progression),
    'class', to_jsonb(v_class) - 'raw_payload',
    'currentLevel', to_jsonb(v_current) - 'raw_payload',
    'nextLevel', case when v_next.class_id is null then null else to_jsonb(v_next) - 'raw_payload' end,
    'xp', jsonb_build_object(
      'current', v_progression.experience_points,
      'levelFloor', v_floor,
      'nextThreshold', v_next_threshold,
      'intoLevel', greatest(0, v_progression.experience_points - v_floor),
      'neededForNext', case when v_next_threshold is null then 0 else greatest(0, v_next_threshold - v_progression.experience_points) end,
      'percent', v_percent
    ),
    'events', v_events
  );
end;
$$;

create or replace function public.set_character_progression_v1(
  p_character_id uuid,
  p_class_key text,
  p_source text default 'XPHB',
  p_level integer default 1,
  p_experience_points bigint default 0,
  p_subclass_name text default null,
  p_subclass_source text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_class public.class_catalog%rowtype;
  v_before public.character_progression%rowtype;
  v_level integer := greatest(1, least(20, coalesce(p_level, 1)));
  v_xp bigint := greatest(0, coalesce(p_experience_points, 0));
  v_pending boolean;
  v_sheet jsonb;
begin
  perform private.require_character_admin_v1();
  if not exists (select 1 from public.characters where id = p_character_id) then
    raise exception 'Character not found.' using errcode = 'P0002';
  end if;

  select * into v_class
  from public.class_catalog
  where class_key = lower(btrim(coalesce(p_class_key,'')))
    and source = upper(btrim(coalesce(p_source,'XPHB')))
  limit 1;
  if v_class.id is null then
    raise exception 'Class % from source % is not available.', p_class_key, p_source using errcode = 'P0002';
  end if;

  select * into v_before from public.character_progression where character_id = p_character_id;
  v_pending := v_level < 20 and v_xp >= public.xp_threshold_for_level_v1(v_level + 1);

  insert into public.character_progression (
    character_id, class_id, subclass_name, subclass_source, class_level, experience_points,
    pending_level_up, created_by, updated_at
  ) values (
    p_character_id, v_class.id, nullif(btrim(p_subclass_name),''), nullif(btrim(p_subclass_source),''),
    v_level, v_xp, v_pending, auth.uid(), now()
  )
  on conflict (character_id) do update set
    class_id = excluded.class_id,
    subclass_name = excluded.subclass_name,
    subclass_source = excluded.subclass_source,
    class_level = excluded.class_level,
    experience_points = excluded.experience_points,
    pending_level_up = excluded.pending_level_up,
    updated_at = now();

  select sheet into v_sheet from public.character_sheets where character_id = p_character_id;
  v_sheet := coalesce(v_sheet, '{}'::jsonb)
    || jsonb_build_object(
      'classKey', v_class.class_key,
      'className', v_class.class_name,
      'class', v_class.class_name,
      'level', v_level,
      'rulesetSource', v_class.source,
      'ruleset', v_class.ruleset,
      'proficiencyBonus', 2 + floor((v_level - 1) / 4.0)::integer,
      'hitDice', v_level::text || 'd' || coalesce(v_class.hit_die, 8)::text
    );
  v_sheet := v_sheet || jsonb_build_object(
    'meta', coalesce(v_sheet->'meta','{}'::jsonb) || jsonb_build_object(
      'classKey', v_class.class_key,
      'className', v_class.class_name,
      'level', v_level,
      'rulesetSource', v_class.source,
      'ruleset', v_class.ruleset
    )
  );

  insert into public.character_sheets(character_id, sheet, updated_at)
  values (p_character_id, v_sheet, now())
  on conflict (character_id) do update set sheet = excluded.sheet, updated_at = now();

  insert into public.character_level_events (
    character_id, event_type, from_level, to_level, xp_before, xp_after, details, created_by
  ) values (
    p_character_id,
    case when v_before.character_id is null then 'progression_initialized' else 'progression_admin_updated' end,
    v_before.class_level,
    v_level,
    v_before.experience_points,
    v_xp,
    jsonb_build_object('classKey',v_class.class_key,'className',v_class.class_name,'source',v_class.source,'ruleset',v_class.ruleset),
    auth.uid()
  );

  return public.get_character_progression_v1(p_character_id);
end;
$$;

create or replace function public.add_character_xp_v1(p_character_id uuid, p_amount bigint, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_before bigint;
  v_after bigint;
  v_pending boolean;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to change this character progression.' using errcode = '42501';
  end if;
  if p_amount = 0 then raise exception 'XP change cannot be zero.'; end if;
  if p_amount < 0 and not private.current_user_is_admin() then
    raise exception 'Only an admin can remove XP.' using errcode = '42501';
  end if;

  select * into v_progression from public.character_progression where character_id = p_character_id for update;
  if v_progression.character_id is null then raise exception 'Character progression has not been initialized.' using errcode = 'P0002'; end if;
  v_before := v_progression.experience_points;
  v_after := greatest(0, v_before + p_amount);
  v_pending := v_progression.class_level < 20 and v_after >= public.xp_threshold_for_level_v1(v_progression.class_level + 1);

  update public.character_progression
  set experience_points = v_after, pending_level_up = v_pending, updated_at = now()
  where character_id = p_character_id;

  insert into public.character_level_events(character_id,event_type,from_level,to_level,xp_before,xp_after,details,created_by)
  values (p_character_id,'xp_changed',v_progression.class_level,v_progression.class_level,v_before,v_after,
          jsonb_strip_nulls(jsonb_build_object('amount',p_amount,'reason',nullif(btrim(p_reason),''))),auth.uid());

  return public.get_character_progression_v1(p_character_id);
end;
$$;

create or replace function public.import_class_progression_batch_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_row jsonb;
  v_class_id uuid;
  v_count integer := 0;
  v_level integer;
  v_source text;
  v_key text;
  v_ruleset text;
  v_cantrips integer;
  v_spells_known integer;
  v_slots jsonb;
  v_features jsonb;
begin
  perform private.require_character_admin_v1();
  if jsonb_typeof(coalesce(p_payload->'class_progressions','[]'::jsonb)) <> 'array' then
    raise exception 'class_progressions must be an array.';
  end if;
  if jsonb_array_length(coalesce(p_payload->'class_progressions','[]'::jsonb)) > 100 then
    raise exception 'Class progression batch is too large.';
  end if;

  for v_row in select value from jsonb_array_elements(coalesce(p_payload->'class_progressions','[]'::jsonb)) loop
    v_key := lower(btrim(coalesce(v_row->>'class_key','')));
    v_source := upper(btrim(coalesce(v_row->>'source','UNK')));
    if v_key = '' or nullif(v_row->>'class_name','') is null then continue; end if;
    v_ruleset := case when v_source = 'XPHB' then '2024' when v_source in ('PHB','TCE','EFA') then '2014' else 'campaign' end;

    insert into public.class_catalog (
      class_key,class_name,source,ruleset,edition,source_file,hit_die,saving_throws,
      spellcasting_ability,caster_progression,prepared_spells_formula,
      cantrip_progression,spells_known_progression,spells_known_progression_fixed,
      spells_known_progression_fixed_by_level,slot_progression,unlock_levels,
      class_features_by_level,raw_payload,updated_at
    ) values (
      v_key,v_row->>'class_name',v_source,v_ruleset,nullif(v_row->>'edition',''),nullif(v_row->>'source_file',''),
      nullif(v_row->>'hit_die','')::integer,
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'saving_throws','[]'::jsonb))),'{}'),
      nullif(v_row->>'spellcasting_ability',''),nullif(v_row->>'caster_progression',''),nullif(v_row->>'prepared_spells_formula',''),
      coalesce(v_row->'cantrip_progression','[]'::jsonb),coalesce(v_row->'spells_known_progression','[]'::jsonb),
      coalesce(v_row->'spells_known_progression_fixed','[]'::jsonb),coalesce(v_row->'spells_known_progression_fixed_by_level','{}'::jsonb),
      coalesce(v_row->'slot_progression','[]'::jsonb),coalesce(v_row->'unlock_levels','{}'::jsonb),
      coalesce(v_row->'class_features_by_level','{}'::jsonb),v_row,now()
    )
    on conflict (class_key,source) do update set
      class_name=excluded.class_name,
      ruleset=excluded.ruleset,
      edition=coalesce(excluded.edition,public.class_catalog.edition),
      source_file=coalesce(excluded.source_file,public.class_catalog.source_file),
      hit_die=coalesce(excluded.hit_die,public.class_catalog.hit_die),
      saving_throws=case when cardinality(excluded.saving_throws)>0 then excluded.saving_throws else public.class_catalog.saving_throws end,
      spellcasting_ability=coalesce(excluded.spellcasting_ability,public.class_catalog.spellcasting_ability),
      caster_progression=coalesce(excluded.caster_progression,public.class_catalog.caster_progression),
      prepared_spells_formula=coalesce(excluded.prepared_spells_formula,public.class_catalog.prepared_spells_formula),
      cantrip_progression=excluded.cantrip_progression,
      spells_known_progression=excluded.spells_known_progression,
      spells_known_progression_fixed=excluded.spells_known_progression_fixed,
      spells_known_progression_fixed_by_level=excluded.spells_known_progression_fixed_by_level,
      slot_progression=excluded.slot_progression,
      unlock_levels=excluded.unlock_levels,
      class_features_by_level=excluded.class_features_by_level,
      raw_payload=excluded.raw_payload,
      updated_at=now()
    returning id into v_class_id;

    for v_level in 1..20 loop
      begin v_cantrips := nullif(v_row->'cantrip_progression'->>(v_level-1),'')::integer; exception when others then v_cantrips := null; end;
      begin v_spells_known := nullif(v_row->'spells_known_progression'->>(v_level-1),'')::integer; exception when others then v_spells_known := null; end;
      v_slots := coalesce(v_row->'slot_progression'->(v_level-1), private.seed_class_spell_slots_v1(v_key,v_row->>'caster_progression',v_level));
      v_features := coalesce(v_row->'class_features_by_level'->(v_level::text),'[]'::jsonb);

      insert into public.class_level_progression(
        class_id,class_level,proficiency_bonus,xp_threshold,cantrips_known,spells_known,spell_slots,features,raw_payload,updated_at
      ) values (
        v_class_id,v_level,2+floor((v_level-1)/4.0)::integer,public.xp_threshold_for_level_v1(v_level),
        v_cantrips,v_spells_known,v_slots,v_features,jsonb_build_object('source','5etools_class_progression'),now()
      )
      on conflict (class_id,class_level) do update set
        proficiency_bonus=excluded.proficiency_bonus,
        xp_threshold=excluded.xp_threshold,
        cantrips_known=coalesce(excluded.cantrips_known,public.class_level_progression.cantrips_known),
        spells_known=coalesce(excluded.spells_known,public.class_level_progression.spells_known),
        spell_slots=excluded.spell_slots,
        features=case when jsonb_array_length(excluded.features)>0 then excluded.features else public.class_level_progression.features end,
        raw_payload=excluded.raw_payload,
        updated_at=now();
    end loop;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('classes',v_count);
end;
$$;

create or replace function private.sync_character_progression_from_sheet_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_key text;
  v_source text;
  v_level integer;
  v_class_id uuid;
  v_xp bigint;
begin
  v_key := lower(btrim(coalesce(new.sheet->>'classKey',new.sheet->'meta'->>'classKey','')));
  if v_key = '' or v_key = 'civilian' then return new; end if;
  v_source := upper(btrim(coalesce(new.sheet->>'rulesetSource',new.sheet->'meta'->>'rulesetSource','XPHB')));
  v_level := greatest(1,least(20,coalesce(nullif(new.sheet->>'level','')::integer,nullif(new.sheet->'meta'->>'level','')::integer,1)));

  select id into v_class_id from public.class_catalog where class_key=v_key and source=v_source limit 1;
  if v_class_id is null then
    select id into v_class_id from public.class_catalog
    where class_key=v_key
    order by case source when 'XPHB' then 0 when 'PHB' then 1 else 2 end
    limit 1;
  end if;
  if v_class_id is null then return new; end if;

  select experience_points into v_xp from public.character_progression where character_id=new.character_id;
  v_xp := coalesce(v_xp,public.xp_threshold_for_level_v1(v_level));
  insert into public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,updated_at)
  values(new.character_id,v_class_id,v_level,v_xp,v_level<20 and v_xp>=public.xp_threshold_for_level_v1(v_level+1),now())
  on conflict(character_id) do update set
    class_id=excluded.class_id,
    class_level=excluded.class_level,
    pending_level_up=excluded.pending_level_up,
    updated_at=now();
  return new;
exception when invalid_text_representation then
  return new;
end;
$$;

drop trigger if exists sync_character_progression_from_sheet_v1 on public.character_sheets;
create trigger sync_character_progression_from_sheet_v1
after insert or update of sheet on public.character_sheets
for each row execute function private.sync_character_progression_from_sheet_v1();

alter table public.class_catalog enable row level security;
alter table public.class_level_progression enable row level security;
alter table public.character_progression enable row level security;
alter table public.character_level_events enable row level security;

drop policy if exists class_catalog_read_v1 on public.class_catalog;
create policy class_catalog_read_v1 on public.class_catalog for select using (true);
drop policy if exists class_level_progression_read_v1 on public.class_level_progression;
create policy class_level_progression_read_v1 on public.class_level_progression for select using (true);

grant select on public.class_catalog, public.class_level_progression to anon, authenticated;
revoke all on public.character_progression, public.character_level_events from anon, authenticated;
grant execute on function public.xp_threshold_for_level_v1(integer) to anon, authenticated;
grant execute on function public.get_character_progression_v1(uuid) to authenticated;
grant execute on function public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text) to authenticated;
grant execute on function public.add_character_xp_v1(uuid,bigint,text) to authenticated;
grant execute on function public.import_class_progression_batch_v1(jsonb) to authenticated;
