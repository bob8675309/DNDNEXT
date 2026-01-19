-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.ai_item_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  prompt text NOT NULL,
  image_url text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT ai_item_images_pkey PRIMARY KEY (id)
);
CREATE TABLE public.character_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL,
  author_user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'private'::text CHECK (scope = ANY (ARRAY['private'::text, 'shared'::text])),
  visible_to_user_ids ARRAY,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT character_notes_pkey PRIMARY KEY (id),
  CONSTRAINT character_notes_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id),
  CONSTRAINT character_notes_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.character_permissions (
  character_id uuid NOT NULL,
  user_id uuid NOT NULL,
  can_inventory boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_convert boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT character_permissions_pkey PRIMARY KEY (character_id, user_id),
  CONSTRAINT character_permissions_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id),
  CONSTRAINT character_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.character_sheets (
  character_id uuid NOT NULL,
  sheet jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT character_sheets_pkey PRIMARY KEY (character_id),
  CONSTRAINT character_sheets_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id)
);
CREATE TABLE public.character_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL,
  display_name text NOT NULL,
  price_gp numeric NOT NULL DEFAULT 0,
  qty integer NOT NULL DEFAULT 1,
  card_payload jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT character_stock_pkey PRIMARY KEY (id),
  CONSTRAINT character_stock_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id)
);
CREATE TABLE public.characters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  race text,
  role text,
  description text,
  motivation text,
  quirk text,
  mannerism text,
  voice text,
  secret text,
  affiliation text,
  status text NOT NULL DEFAULT 'alive'::text CHECK (status = ANY (ARRAY['alive'::text, 'dead'::text, 'missing'::text, 'unknown'::text])),
  background text,
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  kind text NOT NULL DEFAULT 'npc'::text CHECK (kind = ANY (ARRAY['npc'::text, 'merchant'::text])),
  storefront_enabled boolean NOT NULL DEFAULT false,
  map_icon_id uuid,
  x double precision NOT NULL DEFAULT 0,
  y double precision NOT NULL DEFAULT 0,
  location_id bigint,
  last_known_location_id bigint,
  projected_destination_id bigint,
  roaming_speed double precision NOT NULL DEFAULT 0,
  is_hidden boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'resting'::text CHECK (state = ANY (ARRAY['moving'::text, 'resting'::text, 'excursion'::text, 'hidden'::text])),
  rest_until timestamp with time zone,
  route_id bigint,
  route_point_seq integer DEFAULT 1,
  prev_point_seq integer,
  route_segment_progress double precision DEFAULT 0,
  last_moved_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  route_mode text DEFAULT 'trade'::text,
  current_point_seq integer,
  next_point_seq integer,
  segment_started_at timestamp with time zone,
  segment_ends_at timestamp with time zone,
  storefront_title text,
  storefront_tagline text,
  storefront_bg_url text,
  storefront_bg_video_url text,
  storefront_bg_image_url text,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT characters_pkey PRIMARY KEY (id),
  CONSTRAINT characters_map_icon_id_fkey FOREIGN KEY (map_icon_id) REFERENCES public.map_icons(id),
  CONSTRAINT characters_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT characters_last_known_location_id_fkey FOREIGN KEY (last_known_location_id) REFERENCES public.locations(id),
  CONSTRAINT characters_projected_destination_id_fkey FOREIGN KEY (projected_destination_id) REFERENCES public.locations(id),
  CONSTRAINT characters_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.map_routes(id)
);
CREATE TABLE public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  item_id text NOT NULL,
  item_name text NOT NULL,
  item_type text,
  item_rarity text,
  item_description text,
  item_weight text,
  item_cost text,
  created_at timestamp with time zone DEFAULT now(),
  card_payload jsonb,
  owner_type text CHECK (owner_type = ANY (ARRAY['player'::text, 'npc'::text, 'merchant'::text])) NOT VALI),
  owner_id text,
  is_equipped boolean NOT NULL DEFAULT false,
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.items_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  item_type text,
  item_rarity text,
  price_gp numeric NOT NULL DEFAULT 0,
  merchant_tags ARRAY NOT NULL DEFAULT '{}'::text[],
  payload jsonb NOT NULL,
  CONSTRAINT items_catalog_pkey PRIMARY KEY (id)
);
CREATE TABLE public.legacy_character_map (
  legacy_type text NOT NULL CHECK (legacy_type = ANY (ARRAY['npc'::text, 'merchant'::text])),
  legacy_id text NOT NULL,
  character_id uuid NOT NULL UNIQUE,
  CONSTRAINT legacy_character_map_pkey PRIMARY KEY (legacy_type, legacy_id),
  CONSTRAINT legacy_character_map_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id)
);
CREATE TABLE public.locations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  x numeric,
  y numeric,
  description text,
  quests jsonb DEFAULT '[]'::jsonb,
  npcs jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT locations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.map_flags (
  user_id uuid NOT NULL,
  x text,
  y text,
  color text,
  CONSTRAINT map_flags_pkey PRIMARY KEY (user_id),
  CONSTRAINT map_flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.map_icons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'general'::text,
  storage_path text NOT NULL DEFAULT ''::text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT map_icons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.map_route_edges (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  route_id bigint NOT NULL,
  a_point_id bigint NOT NULL,
  b_point_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT map_route_edges_pkey PRIMARY KEY (id),
  CONSTRAINT map_route_edges_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.map_routes(id),
  CONSTRAINT map_route_edges_a_point_id_fkey FOREIGN KEY (a_point_id) REFERENCES public.map_route_points(id),
  CONSTRAINT map_route_edges_b_point_id_fkey FOREIGN KEY (b_point_id) REFERENCES public.map_route_points(id)
);
CREATE TABLE public.map_route_points (
  id bigint NOT NULL DEFAULT nextval('map_route_points_id_seq'::regclass),
  route_id bigint NOT NULL,
  seq integer NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL,
  location_id bigint,
  dwell_seconds double precision NOT NULL DEFAULT 0,
  CONSTRAINT map_route_points_pkey PRIMARY KEY (id),
  CONSTRAINT map_route_points_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.map_routes(id),
  CONSTRAINT map_route_points_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.map_route_segments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  route_id bigint NOT NULL,
  a_point_id bigint NOT NULL,
  b_point_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT map_route_segments_pkey PRIMARY KEY (id),
  CONSTRAINT map_route_segments_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.map_routes(id),
  CONSTRAINT map_route_segments_a_point_id_fkey FOREIGN KEY (a_point_id) REFERENCES public.map_route_points(id),
  CONSTRAINT map_route_segments_b_point_id_fkey FOREIGN KEY (b_point_id) REFERENCES public.map_route_points(id)
);
CREATE TABLE public.map_routes (
  id bigint NOT NULL DEFAULT nextval('map_routes_id_seq'::regclass),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  route_type text NOT NULL DEFAULT 'trade'::text CHECK (route_type = ANY (ARRAY['trade'::text, 'excursion'::text, 'adventure'::text])),
  color text,
  is_loop boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT map_routes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.merchant_notes (
  id bigint NOT NULL DEFAULT nextval('merchant_notes_id_seq'::regclass),
  merchant_id uuid NOT NULL,
  author_user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'private'::text,
  visible_to_user_ids ARRAY,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT merchant_notes_pkey PRIMARY KEY (id),
  CONSTRAINT merchant_notes_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id)
);
CREATE TABLE public.merchant_profiles (
  merchant_id uuid NOT NULL,
  description text,
  motivation text,
  quirk text,
  mannerism text,
  voice text,
  secret text,
  affiliation text,
  status text NOT NULL DEFAULT 'alive'::text,
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  sheet jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  race text,
  role text,
  background text,
  CONSTRAINT merchant_profiles_pkey PRIMARY KEY (merchant_id),
  CONSTRAINT merchant_profiles_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id)
);
CREATE TABLE public.merchant_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  display_name text NOT NULL,
  price_gp numeric NOT NULL DEFAULT 0,
  qty integer NOT NULL DEFAULT 1,
  card_payload jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT merchant_stock_pkey PRIMARY KEY (id),
  CONSTRAINT merchant_stock_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id)
);
CREATE TABLE public.merchants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  x double precision DEFAULT 0,
  y double precision DEFAULT 0,
  inventory jsonb DEFAULT '[]'::jsonb,
  icon text,
  roaming_speed double precision DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  location_id bigint,
  last_known_location_id bigint,
  projected_destination_id bigint,
  bg_url text,
  bg_video_url text,
  bg_image_url text,
  primary_route_id uuid,
  excursion_route_id uuid,
  current_point_seq integer,
  next_point_seq integer,
  segment_started_at timestamp with time zone,
  segment_ends_at timestamp with time zone,
  state text DEFAULT 'moving'::text CHECK (state = ANY (ARRAY['moving'::text, 'resting'::text, 'excursion'::text, 'hidden'::text])),
  rest_until timestamp with time zone,
  route_id bigint,
  route_point_seq integer DEFAULT 1,
  route_segment_progress double precision DEFAULT 0,
  last_moved_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  route_mode text DEFAULT 'trade'::text,
  prev_point_seq integer,
  is_hidden boolean NOT NULL DEFAULT false,
  CONSTRAINT merchants_pkey PRIMARY KEY (id),
  CONSTRAINT merchants_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT merchants_last_known_location_id_fkey FOREIGN KEY (last_known_location_id) REFERENCES public.locations(id),
  CONSTRAINT merchants_projected_destination_id_fkey FOREIGN KEY (projected_destination_id) REFERENCES public.locations(id),
  CONSTRAINT merchants_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.map_routes(id),
  CONSTRAINT merchants_primary_route_id_fkey FOREIGN KEY (primary_route_id) REFERENCES public.routes(id),
  CONSTRAINT merchants_excursion_route_id_fkey FOREIGN KEY (excursion_route_id) REFERENCES public.routes(id)
);
CREATE TABLE public.npc_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  npc_id text NOT NULL,
  author_user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'private'::text CHECK (scope = ANY (ARRAY['private'::text, 'shared'::text])),
  visible_to_user_ids ARRAY,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT npc_notes_pkey PRIMARY KEY (id),
  CONSTRAINT npc_notes_npc_id_fkey FOREIGN KEY (npc_id) REFERENCES public.npcs(id),
  CONSTRAINT npc_notes_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.npc_permissions (
  npc_id text NOT NULL,
  user_id uuid NOT NULL,
  can_inventory boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT npc_permissions_pkey PRIMARY KEY (npc_id, user_id),
  CONSTRAINT npc_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.npc_sheets (
  npc_id text NOT NULL,
  sheet jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT npc_sheets_pkey PRIMARY KEY (npc_id),
  CONSTRAINT npc_sheets_npc_id_fkey FOREIGN KEY (npc_id) REFERENCES public.npcs(id)
);
CREATE TABLE public.npcs (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  name text NOT NULL UNIQUE,
  race text,
  role text,
  description text,
  motivation text,
  quirk text,
  mannerism text,
  voice text,
  secret text,
  affiliation text,
  status text DEFAULT 'alive'::text CHECK (status = ANY (ARRAY['alive'::text, 'dead'::text, 'missing'::text, 'unknown'::text])),
  location_id bigint,
  tags ARRAY DEFAULT '{}'::text[],
  updated_at timestamp with time zone DEFAULT now(),
  background text,
  CONSTRAINT npcs_pkey PRIMARY KEY (id),
  CONSTRAINT npcs_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.plants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rarity text DEFAULT 'Common'::text,
  found_in text,
  effect text,
  roll integer UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.player_plants (
  player_id uuid NOT NULL,
  plant_id uuid NOT NULL,
  quantity integer DEFAULT 1,
  last_gathered_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_plants_pkey PRIMARY KEY (player_id, plant_id),
  CONSTRAINT player_plants_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT player_plants_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plants(id)
);
CREATE TABLE public.player_recipes (
  player_id uuid NOT NULL,
  recipe_id uuid NOT NULL,
  discovered_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_recipes_pkey PRIMARY KEY (player_id, recipe_id),
  CONSTRAINT player_recipes_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT player_recipes_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id)
);
CREATE TABLE public.player_wallets (
  user_id uuid NOT NULL,
  gp numeric NOT NULL DEFAULT 0 CHECK (gp >= 0::numeric OR gp = '-1'::integer::numeric),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT player_wallets_pkey PRIMARY KEY (user_id),
  CONSTRAINT player_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  sheet jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.quests (
  id text NOT NULL,
  name text NOT NULL,
  status text,
  description text,
  CONSTRAINT quests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  ingredients jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT recipes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.route_points (
  id bigint NOT NULL DEFAULT nextval('route_points_id_seq'::regclass),
  route_id uuid NOT NULL,
  seq integer NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL,
  location_id bigint,
  is_stop boolean NOT NULL DEFAULT false,
  stop_min_seconds integer NOT NULL DEFAULT 0,
  stop_max_seconds integer NOT NULL DEFAULT 0,
  note text,
  CONSTRAINT route_points_pkey PRIMARY KEY (id),
  CONSTRAINT route_points_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id),
  CONSTRAINT route_points_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.routes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category USER-DEFINED NOT NULL,
  color text NOT NULL,
  is_loop boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT routes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.trade_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trade_requests_pkey PRIMARY KEY (id),
  CONSTRAINT trade_requests_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id)
);
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  role text DEFAULT 'player'::text,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);