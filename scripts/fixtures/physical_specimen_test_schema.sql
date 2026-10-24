-- Isolated integration fixture, used only by a GitHub Actions PostgreSQL service.
-- Test entities are not copied from the production user database.
create schema private;
create schema auth;
create role authenticated nologin;
create role anon nologin;
create role service_role nologin;

create table public.class_catalog(
  id uuid primary key, class_key text not null, source text not null
);
create table public.character_progression(
  character_id uuid primary key, class_id uuid not null references public.class_catalog(id),
  subclass_name text, subclass_source text, class_level integer not null
);
create table public.class_feature_catalog(
  id uuid primary key,feature_key text,class_key text,class_source text,
  subclass_name text,source text,level integer,name text,raw_payload jsonb
);
create table public.character_sheets(
  character_id uuid primary key,sheet jsonb not null
);
create table public.character_permissions(
  character_id uuid,user_id uuid,can_edit boolean not null default false,
  primary key(character_id,user_id)
);
create table public.character_rest_log(
  id uuid primary key,character_id uuid not null,
  rest_type text not null,completed_at timestamptz not null
);
create table public.character_runtime_feature_choices(
  character_id uuid,feature_key text,feature_name text,source text,
  cadence text,state jsonb not null default '{}'::jsonb,
  replacement_anchor_at timestamptz,created_at timestamptz,updated_at timestamptz,
  primary key(character_id,feature_key)
);
create table public.test_active_encounters(
  character_id uuid primary key
);
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
create function private.can_manage_character_progression_v1(p_character_id uuid)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$ select exists(select 1 from public.character_permissions c
  where c.character_id=p_character_id and c.user_id=auth.uid() and c.can_edit); $$;
create function private.normalize_player_choice_name_v1(p_name text)
returns text language sql immutable
as $$ select lower(regexp_replace(coalesce(p_name,''),'[^a-zA-Z0-9]+','','g')); $$;
create function private.character_active_encounter_v1(p_character_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public,private
as $$ select case when exists(
  select 1 from public.test_active_encounters where character_id=p_character_id
  ) then jsonb_build_object('status','active') else null end; $$;
insert into public.class_catalog values
  ('11111111-1111-1111-1111-111111111111','warlock','XPHB');
insert into public.character_progression values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','The Parasite Patron','GrimHollowPG24',3),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd','11111111-1111-1111-1111-111111111111','Other Patron','GrimHollowPG24',3),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','11111111-1111-1111-1111-111111111111','The Parasite Patron','GrimHollowPG24',3);
insert into public.character_sheets values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{"abilities":{"cha":{"score":20}}}'::jsonb),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd','{"abilities":{"cha":{"score":20}}}'::jsonb),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','{"abilities":{"cha":{"score":12}}}'::jsonb);
insert into public.character_permissions values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
-- Simulate a participant in an active tactical encounter.
insert into public.test_active_encounters(character_id)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
insert into public.class_feature_catalog(
  id,feature_key,class_key,class_source,subclass_name,source,level,name,raw_payload
) values (
  '22222222-2222-2222-2222-222222222222',
  'subclass:warlock:xphb:parasite:physical-specimen:grimhollowpg24:3',
  'warlock','XPHB','The Parasite Patron','GrimHollowPG24',3,'Physical Specimen',
  jsonb_build_object('entries',jsonb_build_array(
    'Physical Specimen Bonus Action text.',
    jsonb_build_object('type','list','items',jsonb_build_array(
      'Your Hit Points maximum increases by an amount equal to your Warlock level.',
      'You gain Darkvision with a range of 60 feet.',
      'Your Speed increases by 5 feet.',
      'You have Advantage on saves to avoid or end Poisoned.',
      'Your jump distance is tripled and you gain a Climb Speed.',
      'Add your Charisma modifier to Athletics or Acrobatics checks.'
    ))
  ))
);
