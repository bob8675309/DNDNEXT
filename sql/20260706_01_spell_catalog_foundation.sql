-- Spell and magic foundation tables.
-- This migration creates a normalized spell catalog while preserving the raw imported payload.
-- Import only spell data you are licensed/allowed to use in your campaign/site.

create extension if not exists pgcrypto;

create table if not exists public.spells_catalog (
  id uuid primary key default gen_random_uuid(),
  spell_key text not null unique,
  slug text not null,
  name text not null,
  source text not null,
  source_file text,
  page integer,
  level integer not null default 0 check (level >= 0 and level <= 9),
  school_code text,
  school text,
  classes text[] not null default '{}',
  subclasses text[] not null default '{}',
  ritual boolean not null default false,
  concentration boolean not null default false,
  casting_time text,
  casting_time_json jsonb not null default '[]'::jsonb,
  range_text text,
  range_type text,
  range_distance numeric,
  range_unit text,
  range_json jsonb not null default '{}'::jsonb,
  area_type text,
  area_size numeric,
  area_unit text,
  components_v boolean not null default false,
  components_s boolean not null default false,
  components_m boolean not null default false,
  material_text text,
  components_json jsonb not null default '{}'::jsonb,
  duration_text text,
  duration_json jsonb not null default '[]'::jsonb,
  saving_throw_abilities text[] not null default '{}',
  attack_type text,
  damage_dice text,
  damage_types text[] not null default '{}',
  healing_dice text,
  scaling_text text,
  scaling_json jsonb not null default '{}'::jsonb,
  description text,
  higher_level_text text,
  tags text[] not null default '{}',
  misc_tags text[] not null default '{}',
  area_tags text[] not null default '{}',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  imported_at timestamptz not null default now()
);

create index if not exists spells_catalog_name_idx on public.spells_catalog using gin (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));
create index if not exists spells_catalog_level_idx on public.spells_catalog (level);
create index if not exists spells_catalog_school_idx on public.spells_catalog (school);
create index if not exists spells_catalog_source_idx on public.spells_catalog (source);
create index if not exists spells_catalog_classes_idx on public.spells_catalog using gin (classes);
create index if not exists spells_catalog_damage_types_idx on public.spells_catalog using gin (damage_types);
create index if not exists spells_catalog_tags_idx on public.spells_catalog using gin (tags);

create table if not exists public.spell_effects (
  id uuid primary key default gen_random_uuid(),
  spell_id uuid not null references public.spells_catalog(id) on delete cascade,
  effect_index integer not null default 0,
  effect_kind text not null default 'utility',
  damage_type text,
  dice_formula text,
  save_ability text,
  save_effect text,
  condition text,
  duration_text text,
  area_type text,
  area_size numeric,
  area_unit text,
  targeting_text text,
  scaling_formula text,
  effect_text text,
  tags text[] not null default '{}',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists spell_effects_spell_id_idx on public.spell_effects (spell_id);
create index if not exists spell_effects_kind_idx on public.spell_effects (effect_kind);
create index if not exists spell_effects_damage_type_idx on public.spell_effects (damage_type);
create index if not exists spell_effects_condition_idx on public.spell_effects (condition);
create index if not exists spell_effects_tags_idx on public.spell_effects using gin (tags);

create table if not exists public.character_spells (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  spell_id uuid not null references public.spells_catalog(id) on delete cascade,
  source_type text not null default 'class',
  source_label text,
  prepared boolean not null default false,
  always_available boolean not null default false,
  uses_max integer,
  uses_remaining integer,
  recharge text,
  casting_stat text,
  save_dc_override integer,
  attack_bonus_override integer,
  notes text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (character_id, spell_id, source_type, coalesce(source_label, ''))
);

create index if not exists character_spells_character_id_idx on public.character_spells (character_id);
create index if not exists character_spells_spell_id_idx on public.character_spells (spell_id);
create index if not exists character_spells_prepared_idx on public.character_spells (character_id, prepared);
create index if not exists character_spells_source_type_idx on public.character_spells (source_type);
