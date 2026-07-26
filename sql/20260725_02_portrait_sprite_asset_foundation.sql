begin;

create table if not exists public.npc_visual_assets (
  id uuid primary key default gen_random_uuid(),
  portrait_library_id uuid not null references public.npc_portrait_library(id) on delete cascade,
  name text not null,
  sprite_bucket text not null default 'map-icons',
  sprite_path text not null,
  sprite_format text not null default 'eight_direction_idle_walk_v1',
  frame_width integer not null default 64 check (frame_width > 0),
  frame_height integer not null default 64 check (frame_height > 0),
  direction_order text[] not null default array['down','down-left','left','up-left','up','up-right','right','down-right']::text[],
  idle_frame integer not null default 0 check (idle_frame >= 0),
  walk_frames integer[] not null default array[1,2,3]::integer[],
  fps numeric not null default 7 check (fps > 0),
  default_scale numeric not null default 0.7 check (default_scale > 0),
  is_default boolean not null default true,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portrait_library_id, sprite_path)
);

create unique index if not exists npc_visual_assets_one_default_per_portrait_idx
  on public.npc_visual_assets (portrait_library_id)
  where is_default and is_active;
create index if not exists npc_visual_assets_portrait_idx on public.npc_visual_assets(portrait_library_id);
create index if not exists npc_visual_assets_active_idx on public.npc_visual_assets(is_active, portrait_library_id);

alter table public.npc_visual_assets enable row level security;
drop policy if exists npc_visual_assets_authenticated_read on public.npc_visual_assets;
create policy npc_visual_assets_authenticated_read on public.npc_visual_assets
  for select to authenticated using (true);
revoke all on public.npc_visual_assets from public, anon, authenticated;
grant select on public.npc_visual_assets to authenticated;
grant all on public.npc_visual_assets to service_role;

alter table public.characters
  add column if not exists portrait_library_id uuid references public.npc_portrait_library(id) on delete set null,
  add column if not exists visual_asset_id uuid references public.npc_visual_assets(id) on delete set null,
  add column if not exists creation_request_id uuid;

create unique index if not exists characters_creation_request_id_uidx
  on public.characters(creation_request_id)
  where creation_request_id is not null;
create index if not exists characters_portrait_library_id_idx on public.characters(portrait_library_id);
create index if not exists characters_visual_asset_id_idx on public.characters(visual_asset_id);

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
  v_creation_request_id uuid;
  v_portrait_library_id uuid;
  v_visual_asset_id uuid;
  v_portrait public.npc_portrait_library%rowtype;
  v_asset public.npc_visual_assets%rowtype;
  v_portrait_url text;
  v_portrait_storage_path text;
  v_portrait_thumb_url text;
  v_portrait_shop_url text;
  v_portrait_source text;
  v_image_url text;
  v_sprite_path text;
  v_sprite_key text;
  v_sprite_scale double precision;
begin
  perform private.require_character_admin_v1();

  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'Character payload must be a JSON object';
  end if;

  if nullif(btrim(v_payload->>'creation_request_id'), '') is not null then
    begin
      v_creation_request_id := (v_payload->>'creation_request_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'creation_request_id must be a valid UUID';
    end;
    select id into v_character_id from public.characters where creation_request_id = v_creation_request_id;
    if found then return v_character_id; end if;
  end if;

  v_name := btrim(coalesce(v_payload->>'name', ''));
  if v_name = '' then raise exception 'Character name is required'; end if;
  if char_length(v_name) > 120 then raise exception 'Character name must be 120 characters or fewer'; end if;
  if exists (select 1 from public.characters where lower(name) = lower(v_name)) then
    raise exception 'A character named % already exists', v_name using errcode = '23505';
  end if;

  v_kind := lower(coalesce(nullif(btrim(v_payload->>'kind'), ''), 'npc'));
  if v_kind not in ('npc', 'merchant') then raise exception 'Character kind must be npc or merchant'; end if;

  v_status := lower(coalesce(nullif(btrim(v_payload->>'status'), ''), 'alive'));
  if v_status not in ('alive', 'dead', 'missing', 'unknown') then raise exception 'Invalid character status: %', v_status; end if;

  v_sheet := coalesce(v_payload->'sheet', '{}'::jsonb);
  if jsonb_typeof(v_sheet) <> 'object' then raise exception 'Character sheet must be a JSON object'; end if;

  if nullif(v_payload->>'location_id', '') is not null then
    begin v_location_id := (v_payload->>'location_id')::bigint;
    exception when invalid_text_representation then raise exception 'Starting location must be a valid location id'; end;
    if not exists (select 1 from public.locations where id = v_location_id) then raise exception 'Starting location % was not found', v_location_id; end if;
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

  if nullif(btrim(v_payload->>'portrait_library_id'), '') is not null then
    begin v_portrait_library_id := (v_payload->>'portrait_library_id')::uuid;
    exception when invalid_text_representation then raise exception 'portrait_library_id must be a valid UUID'; end;
    select * into v_portrait from public.npc_portrait_library where id = v_portrait_library_id and is_active;
    if not found then raise exception 'Selected portrait is not active or was not found'; end if;
  end if;

  if nullif(btrim(v_payload->>'visual_asset_id'), '') is not null then
    begin v_visual_asset_id := (v_payload->>'visual_asset_id')::uuid;
    exception when invalid_text_representation then raise exception 'visual_asset_id must be a valid UUID'; end;
    select * into v_asset from public.npc_visual_assets where id = v_visual_asset_id and is_active;
    if not found then raise exception 'Selected visual asset is not active or was not found'; end if;
    if v_portrait_library_id is not null and v_asset.portrait_library_id <> v_portrait_library_id then
      raise exception 'Selected sprite asset does not belong to the selected portrait';
    end if;
    if v_portrait_library_id is null then
      v_portrait_library_id := v_asset.portrait_library_id;
      select * into v_portrait from public.npc_portrait_library where id = v_portrait_library_id and is_active;
      if not found then raise exception 'Sprite asset portrait is not active or was not found'; end if;
    end if;
  end if;

  v_portrait_storage_path := coalesce(nullif(btrim(v_portrait.storage_path), ''), nullif(btrim(v_payload->>'portrait_storage_path'), ''));
  v_portrait_url := coalesce(nullif(btrim(v_portrait.public_url), ''), nullif(btrim(v_payload->>'portrait_url'), ''));
  v_portrait_thumb_url := coalesce(v_portrait_url, nullif(btrim(v_payload->>'portrait_thumb_url'), ''));
  v_portrait_shop_url := coalesce(v_portrait_url, nullif(btrim(v_payload->>'portrait_shop_url'), ''));
  v_portrait_source := case when v_portrait_library_id is not null then 'library' else coalesce(nullif(btrim(v_payload->>'portrait_source'), ''), 'default') end;
  v_image_url := coalesce(v_portrait_url, nullif(btrim(v_payload->>'image_url'), ''));

  v_sprite_path := coalesce(nullif(btrim(v_asset.sprite_path), ''), nullif(btrim(v_payload->>'sprite_path'), ''));
  v_sprite_key := coalesce(case when v_visual_asset_id is not null then v_visual_asset_id::text end, nullif(btrim(v_payload->>'sprite_key'), ''));
  v_sprite_scale := coalesce(v_asset.default_scale::double precision, nullif(v_payload->>'sprite_scale', '')::double precision);

  v_storefront_enabled := v_kind = 'merchant' and coalesce((v_payload->>'storefront_enabled')::boolean, true);

  insert into public.characters (
    name, race, role, description, motivation, quirk, mannerism, voice, secret, affiliation, status, background, tags, kind,
    storefront_enabled, storefront_title, storefront_tagline,
    portrait_library_id, visual_asset_id, creation_request_id,
    portrait_url, portrait_storage_path, portrait_thumb_url, portrait_shop_url, portrait_source, portrait_prompt, image_url,
    sprite_key, sprite_path, sprite_scale,
    location_id, last_known_location_id, home_location_id, is_hidden, state, updated_at
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
    v_portrait_library_id,
    v_visual_asset_id,
    v_creation_request_id,
    v_portrait_url,
    v_portrait_storage_path,
    v_portrait_thumb_url,
    v_portrait_shop_url,
    v_portrait_source,
    nullif(btrim(v_payload->>'portrait_prompt'), ''),
    v_image_url,
    v_sprite_key,
    v_sprite_path,
    v_sprite_scale,
    v_location_id,
    v_location_id,
    v_location_id,
    true,
    'resting',
    now()
  ) returning id into v_character_id;

  insert into public.character_sheets (character_id, sheet, updated_at)
  values (
    v_character_id,
    v_sheet || jsonb_build_object(
      'schemaVersion', coalesce(v_sheet->'schemaVersion', '1'::jsonb),
      'portrait', coalesce(v_sheet->'portrait', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'libraryId', v_portrait_library_id,
        'url', v_portrait_url,
        'storagePath', v_portrait_storage_path,
        'thumbUrl', v_portrait_thumb_url,
        'shopUrl', v_portrait_shop_url,
        'source', v_portrait_source,
        'recommendedMasterSize', '1536x2048',
        'aspectRatio', '3:4'
      )),
      'visualAsset', case when v_visual_asset_id is null then coalesce(v_sheet->'visualAsset', 'null'::jsonb) else jsonb_build_object(
        'id', v_visual_asset_id,
        'spritePath', v_asset.sprite_path,
        'spriteBucket', v_asset.sprite_bucket,
        'format', v_asset.sprite_format,
        'frameWidth', v_asset.frame_width,
        'frameHeight', v_asset.frame_height,
        'directionOrder', to_jsonb(v_asset.direction_order),
        'idleFrame', v_asset.idle_frame,
        'walkFrames', to_jsonb(v_asset.walk_frames),
        'fps', v_asset.fps,
        'defaultScale', v_asset.default_scale
      ) end,
      'meta', coalesce(v_sheet->'meta', '{}'::jsonb) || jsonb_build_object(
        'characterId', v_character_id,
        'createdBy', 'npc_forge_v1',
        'creationRequestId', v_creation_request_id
      )
    ),
    now()
  );

  if v_location_id is not null then
    update public.locations l
    set npcs = coalesce(l.npcs, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('id', v_character_id::text, 'type', v_kind))
    where l.id = v_location_id
      and not exists (
        select 1 from jsonb_array_elements(coalesce(l.npcs, '[]'::jsonb)) as roster(entry)
        where private.location_roster_character_id_v1(roster.entry) = v_character_id::text
      );
  end if;

  return v_character_id;
exception
  when unique_violation then
    if v_creation_request_id is not null then
      select id into v_character_id from public.characters where creation_request_id = v_creation_request_id;
      if found then return v_character_id; end if;
    end if;
    raise;
end;
$function$;

revoke all on function public.create_character_v1(jsonb) from public, anon;
grant execute on function public.create_character_v1(jsonb) to authenticated, service_role;

-- Guardrails: the legacy map renderer still owns old sprite_path semantics. This migration
-- registers richer metadata but deliberately does not modify route/movement functions or world state.
do $verify$
declare v_missing integer;
begin
  select count(*) into v_missing
  from information_schema.columns
  where table_schema='public' and table_name='characters'
    and column_name in ('portrait_library_id','visual_asset_id','creation_request_id');
  if v_missing <> 3 then raise exception 'portrait/sprite character columns missing after migration'; end if;
  if not exists (select 1 from pg_class where relname='npc_visual_assets' and relnamespace='public'::regnamespace) then
    raise exception 'npc_visual_assets table missing after migration';
  end if;
end
$verify$;

commit;
