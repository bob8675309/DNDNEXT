create table public.characters (
  id uuid not null default gen_random_uuid (),
  name text not null,
  race text null,
  role text null,
  description text null,
  motivation text null,
  quirk text null,
  mannerism text null,
  voice text null,
  secret text null,
  affiliation text null,
  status text not null default 'alive'::text,
  background text null,
  tags text[] not null default '{}'::text[],
  kind text not null default 'npc'::text,
  storefront_enabled boolean not null default false,
  map_icon_id uuid null,
  x double precision not null default 0,
  y double precision not null default 0,
  location_id bigint null,
  last_known_location_id bigint null,
  projected_destination_id bigint null,
  roaming_speed double precision not null default 0,
  is_hidden boolean not null default false,
  state text not null default 'resting'::text,
  rest_until timestamp with time zone null,
  route_id bigint null,
  route_point_seq integer null default 1,
  prev_point_seq integer null,
  route_segment_progress double precision null default 0,
  last_moved_at timestamp with time zone not null default timezone ('utc'::text, now()),
  route_mode text null default 'trade'::text,
  current_point_seq integer null,
  next_point_seq integer null,
  segment_started_at timestamp with time zone null,
  segment_ends_at timestamp with time zone null,
  storefront_title text null,
  storefront_tagline text null,
  storefront_bg_url text null,
  storefront_bg_video_url text null,
  storefront_bg_image_url text null,
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint characters_pkey primary key (id),
  constraint characters_name_key unique (name),
  constraint characters_location_id_fkey foreign KEY (location_id) references locations (id),
  constraint characters_route_id_fkey foreign KEY (route_id) references map_routes (id),
  constraint characters_projected_destination_id_fkey foreign KEY (projected_destination_id) references locations (id),
  constraint characters_map_icon_id_fkey foreign KEY (map_icon_id) references map_icons (id),
  constraint characters_last_known_location_id_fkey foreign KEY (last_known_location_id) references locations (id),
  constraint characters_status_check check (
    (
      status = any (
        array[
          'alive'::text,
          'dead'::text,
          'missing'::text,
          'unknown'::text
        ]
      )
    )
  ),
  constraint characters_state_check check (
    (
      state = any (
        array[
          'moving'::text,
          'resting'::text,
          'excursion'::text,
          'hidden'::text
        ]
      )
    )
  ),
  constraint characters_kind_check check (
    (kind = any (array['npc'::text, 'merchant'::text]))
  )
) TABLESPACE pg_default;

create index IF not exists characters_kind_idx on public.characters using btree (kind) TABLESPACE pg_default;

create index IF not exists characters_location_idx on public.characters using btree (location_id) TABLESPACE pg_default;

create index IF not exists characters_route_idx on public.characters using btree (route_id) TABLESPACE pg_default;