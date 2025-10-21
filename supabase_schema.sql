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
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.locations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  x text,
  y text DEFAULT ''::text,
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
  CONSTRAINT merchants_pkey PRIMARY KEY (id),
  CONSTRAINT merchants_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT merchants_last_known_location_id_fkey FOREIGN KEY (last_known_location_id) REFERENCES public.locations(id),
  CONSTRAINT merchants_projected_destination_id_fkey FOREIGN KEY (projected_destination_id) REFERENCES public.locations(id)
);
CREATE TABLE public.npcs (
  id text NOT NULL,
  name text NOT NULL,
  race text,
  role text,
  CONSTRAINT npcs_pkey PRIMARY KEY (id)
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