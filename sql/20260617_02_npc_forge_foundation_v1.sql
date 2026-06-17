begin;

create or replace function private.require_character_admin_v1()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.current_user_is_admin() then
    raise exception 'Only an administrator can manage campaign characters' using errcode = '42501';
  end if;
end;
$function$;

create or replace function private.location_roster_character_id_v1(p_entry jsonb)
returns text
language sql
immutable
set search_path = pg_catalog
as $function$
  select case jsonb_typeof(p_entry)
    when 'object' then nullif(p_entry->>'id', '')
    when 'string' then nullif(p_entry #>> '{}', '')
    else null
  end;
$function$;

create or replace function public.create_character_v1(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_sheet jsonb;
  v_name text;
  v_kind text;
  v_status text;
  v_location_id bigint;
  v_character_id uuid;
  v_tags text[] := '{}'::text[];
  v_storefront_enabled boolean;
begin
  perform private.require_character_admin_v1();

  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'Character payload must be a JSON object';
  end if;

  v_name := btrim(coalesce(v_payload->>'name', ''));
  if v_name = '' then
    raise exception 'Character name is required';
  end if;
  if char_length(v_name) > 120 then
    raise exception 'Character name must be 120 characters or fewer';
  end if;
  if exists (select 1 from public.characters where lower(name) = lower(v_name)) then
    raise exception 'A character named % already exists', v_name using errcode = '23505';
  end if;

  v_kind := lower(coalesce(nullif(btrim(v_payload->>'kind'), ''), 'npc'));
  if v_kind not in ('npc', 'merchant') then
    raise exception 'Character kind must be npc or merchant';
  end if;

  v_status := lower(coalesce(nullif(btrim(v_payload->>'status'), ''), 'alive'));
  if v_status not in ('alive', 'dead', 'missing', 'unknown') then
    raise exception 'Invalid character status: %', v_status;
  end if;

  v_sheet := coalesce(v_payload->'sheet', '{}'::jsonb);
  if jsonb_typeof(v_sheet) <> 'object' then
    raise exception 'Character sheet must be a JSON object';
  end if;

  if nullif(v_payload->>'location_id', '') is not null then
    begin
      v_location_id := (v_payload->>'location_id')::bigint;
    exception when invalid_text_representation then
      raise exception 'Starting location must be a valid location id';
    end;
    if not exists (select 1 from public.locations where id = v_location_id) then
      raise exception 'Starting location % was not found', v_location_id;
    end if;
  end if;

  if jsonb_typeof(v_payload->'tags') = 'array' then
    select coalesce(array_agg(distinct tag order by tag), '{}'::text[])
    into v_tags
    from (
      select lower(btrim(value)) as tag
      from jsonb_array_elements_text(v_payload->'tags')
      where btrim(value) <> ''
    ) normalized_tags;
  end if;

  v_storefront_enabled := v_kind = 'merchant' and coalesce((v_payload->>'storefront_enabled')::boolean, true);

  insert into public.characters (
    name,
    race,
    role,
    description,
    motivation,
    quirk,
    mannerism,
    voice,
    secret,
    affiliation,
    status,
    background,
    tags,
    kind,
    storefront_enabled,
    storefront_title,
    storefront_tagline,
    location_id,
    last_known_location_id,
    home_location_id,
    is_hidden,
    state,
    updated_at
  ) values (
    v_name,
    nullif(btrim(v_payload->>'race'), ''),
    nullif(btrim(v_payload->>'role'), ''),
    nullif(btrim(v_payload->>'description'), ''),
    nullif(btrim(v_payload->>'motivation'), ''),
    nullif(btrim(v_payload->>'quirk'), ''),
    nullif(btrim(v_payload->>'mannerism'), ''),
    nullif(btrim(v_payload->>'voice'), ''),
    nullif(btrim(v_payload->>'secret'), ''),
    nullif(btrim(v_payload->>'affiliation'), ''),
    v_status,
    nullif(btrim(v_payload->>'background'), ''),
    v_tags,
    v_kind,
    v_storefront_enabled,
    case when v_storefront_enabled then nullif(btrim(v_payload->>'storefront_title'), '') else null end,
    case when v_storefront_enabled then nullif(btrim(v_payload->>'storefront_tagline'), '') else null end,
    v_location_id,
    v_location_id,
    v_location_id,
    true,
    'resting',
    now()
  )
  returning id into v_character_id;

  insert into public.character_sheets (character_id, sheet, updated_at)
  values (
    v_character_id,
    v_sheet || jsonb_build_object(
      'schemaVersion', coalesce(v_sheet->'schemaVersion', '1'::jsonb),
      'meta', coalesce(v_sheet->'meta', '{}'::jsonb) || jsonb_build_object(
        'characterId', v_character_id,
        'createdBy', 'npc_forge_v1'
      )
    ),
    now()
  );

  if v_location_id is not null then
    update public.locations l
    set npcs = coalesce(l.npcs, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('id', v_character_id::text, 'type', v_kind)
    )
    where l.id = v_location_id
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(l.npcs, '[]'::jsonb)) as roster(entry)
        where private.location_roster_character_id_v1(roster.entry) = v_character_id::text
      );
  end if;

  return v_character_id;
end;
$function$;

create or replace function public.delete_character_v1(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_character public.characters%rowtype;
  v_inventory_deleted integer := 0;
  v_locations_cleaned integer := 0;
begin
  perform private.require_character_admin_v1();

  select * into v_character
  from public.characters
  where id = p_character_id
  for update;

  if not found then
    raise exception 'Character % was not found', p_character_id;
  end if;

  if v_character.id = 'c0a40081-9bab-402d-8437-62267e596c4f'::uuid
     or lower(btrim(v_character.name)) = 'mog' then
    raise exception 'Mog is protected and cannot be deleted' using errcode = '42501';
  end if;

  delete from public.inventory_items
  where owner_id = p_character_id::text
    and owner_type in ('npc', 'merchant', 'character');
  get diagnostics v_inventory_deleted = row_count;

  update public.locations l
  set npcs = coalesce((
    select jsonb_agg(roster.entry order by roster.ordinality)
    from jsonb_array_elements(coalesce(l.npcs, '[]'::jsonb)) with ordinality as roster(entry, ordinality)
    where private.location_roster_character_id_v1(roster.entry) is distinct from p_character_id::text
  ), '[]'::jsonb)
  where exists (
    select 1
    from jsonb_array_elements(coalesce(l.npcs, '[]'::jsonb)) as roster(entry)
    where private.location_roster_character_id_v1(roster.entry) = p_character_id::text
  );
  get diagnostics v_locations_cleaned = row_count;

  delete from public.characters where id = p_character_id;

  return jsonb_build_object(
    'ok', true,
    'character_id', p_character_id,
    'character_name', v_character.name,
    'inventory_items_deleted', v_inventory_deleted,
    'location_rosters_cleaned', v_locations_cleaned
  );
end;
$function$;

create or replace function private.protect_mog_delete_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if old.id = 'c0a40081-9bab-402d-8437-62267e596c4f'::uuid
     or lower(btrim(old.name)) = 'mog' then
    raise exception 'Mog is protected and cannot be deleted' using errcode = '42501';
  end if;
  return old;
end;
$function$;

drop trigger if exists protect_mog_delete_v1 on public.characters;
create trigger protect_mog_delete_v1
before delete on public.characters
for each row execute function private.protect_mog_delete_v1();

insert into public.character_sheets (character_id, sheet, updated_at)
select
  c.id,
  jsonb_build_object(
    'schemaVersion', 1,
    'meta', jsonb_build_object(
      'characterId', c.id,
      'createdBy', 'sheet_backfill_v1'
    )
  ),
  now()
from public.characters c
left join public.character_sheets cs on cs.character_id = c.id
where cs.character_id is null
on conflict (character_id) do nothing;

revoke all on function public.create_character_v1(jsonb) from public;
revoke all on function public.delete_character_v1(uuid) from public;
grant execute on function public.create_character_v1(jsonb) to authenticated, service_role;
grant execute on function public.delete_character_v1(uuid) to authenticated, service_role;

comment on function public.create_character_v1(jsonb) is
  'Atomically creates a canonical NPC or merchant and its character sheet. New characters start resting and off-map.';
comment on function public.delete_character_v1(uuid) is
  'Deletes an NPC or merchant and owned inventory while cleaning location rosters. Mog is protected.';

commit;
