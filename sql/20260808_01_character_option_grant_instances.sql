-- Repeatable/nested character-option authority.
-- This complements character_option_grants, whose historical uniqueness on
-- (character_id, option_id) is useful as a presence summary but cannot model
-- multiple instances of a repeatable feat with different child choices.

create table if not exists public.character_option_grant_instances (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  option_id uuid references public.character_option_catalog(id) on delete restrict,
  option_key text,
  option_type text not null default 'feat',
  option_name text not null,
  option_source text,
  instance_key text not null,
  acquisition_owner_type text,
  acquisition_owner_key text,
  acquisition_label text,
  acquisition_level integer not null default 1 check (acquisition_level between 1 and 20),
  choices jsonb not null default '{}'::jsonb check (jsonb_typeof(choices) = 'object'),
  effects jsonb not null default '[]'::jsonb check (jsonb_typeof(effects) = 'array'),
  fixed_spell_tokens jsonb not null default '[]'::jsonb check (jsonb_typeof(fixed_spell_tokens) = 'array'),
  repeatable boolean not null default false,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (character_id, instance_key)
);

create index if not exists character_option_grant_instances_character_idx
  on public.character_option_grant_instances(character_id);
create index if not exists character_option_grant_instances_option_idx
  on public.character_option_grant_instances(option_id);
create index if not exists character_option_grant_instances_name_idx
  on public.character_option_grant_instances(character_id, lower(option_name));

alter table public.character_option_grant_instances enable row level security;

drop policy if exists character_option_grant_instances_rpc_only on public.character_option_grant_instances;
create policy character_option_grant_instances_rpc_only
  on public.character_option_grant_instances
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on public.character_option_grant_instances from anon, authenticated;

create or replace function private.validate_player_forge_feat_instances_v1(p_sheet jsonb)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_instances jsonb := coalesce(p_sheet -> 'featGrantInstances', '[]'::jsonb);
  v_instance jsonb;
  v_instance_key text;
  v_option_id uuid;
  v_catalog public.character_option_catalog%rowtype;
  v_level integer := greatest(1, least(20, coalesce(nullif(p_sheet ->> 'level', '')::integer, 1)));
  v_seen_keys text[] := '{}'::text[];
  v_seen_nonrepeatable uuid[] := '{}'::uuid[];
begin
  if jsonb_typeof(v_instances) <> 'array' then
    raise exception 'featGrantInstances must be a JSON array.';
  end if;
  if jsonb_array_length(v_instances) > 100 then
    raise exception 'Too many feat grant instances.';
  end if;

  for v_instance in select value from jsonb_array_elements(v_instances)
  loop
    if jsonb_typeof(v_instance) <> 'object' then
      raise exception 'Each feat grant instance must be an object.';
    end if;
    v_instance_key := nullif(btrim(v_instance ->> 'instanceId'), '');
    if v_instance_key is null then
      raise exception 'Every feat grant instance requires an instanceId.';
    end if;
    if v_instance_key = any(v_seen_keys) then
      raise exception 'Duplicate feat grant instance %.', v_instance_key;
    end if;
    v_seen_keys := array_append(v_seen_keys, v_instance_key);

    begin
      v_option_id := nullif(btrim(v_instance ->> 'optionId'), '')::uuid;
    exception when invalid_text_representation then
      raise exception 'Feat grant instance % has an invalid optionId.', v_instance_key;
    end;
    if v_option_id is null then
      raise exception 'Feat grant instance % must reference the canonical feat option.', v_instance_key;
    end if;

    select * into v_catalog
    from public.character_option_catalog
    where id = v_option_id and option_type = 'feat';
    if not found then
      raise exception 'Feat grant instance % references an unavailable feat.', v_instance_key;
    end if;
    if private.normalize_player_choice_name_v1(v_instance ->> 'name') <> private.normalize_player_choice_name_v1(v_catalog.name) then
      raise exception 'Feat grant instance % does not match its canonical feat name.', v_instance_key;
    end if;
    if nullif(btrim(v_instance ->> 'source'), '') is not null and upper(btrim(v_instance ->> 'source')) <> upper(v_catalog.source) then
      raise exception 'Feat grant instance % does not match its canonical feat source.', v_instance_key;
    end if;
    if coalesce((v_instance ->> 'acquisitionLevel')::integer, 1) < 1 or coalesce((v_instance ->> 'acquisitionLevel')::integer, 1) > v_level then
      raise exception 'Feat grant instance % has an invalid acquisition level.', v_instance_key;
    end if;
    if jsonb_typeof(coalesce(v_instance -> 'choices', '{}'::jsonb)) <> 'object' then
      raise exception 'Feat grant instance % choices must be an object.', v_instance_key;
    end if;
    if jsonb_typeof(coalesce(v_instance -> 'fixedEffects', '[]'::jsonb)) <> 'array' then
      raise exception 'Feat grant instance % effects must be an array.', v_instance_key;
    end if;

    if not coalesce((v_catalog.metadata ->> 'repeatable')::boolean, false) then
      if v_option_id = any(v_seen_nonrepeatable) then
        raise exception 'Feat % is not repeatable.', v_catalog.name;
      end if;
      v_seen_nonrepeatable := array_append(v_seen_nonrepeatable, v_option_id);
    end if;
  end loop;
end;
$function$;

comment on table public.character_option_grant_instances is
  'Per-character option grant instances. Supports repeatable feats and source-owned nested choices while character_option_grants remains a compatibility presence summary.';
