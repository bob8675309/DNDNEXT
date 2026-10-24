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

-- Canonical Speed dependency is the same saved-sheet interpretation as the
-- production encounter_canonical_speed_ft_v1; no full encounter RPC is needed.
create function public.encounter_canonical_speed_ft_v1(p_character_id uuid)
returns integer language plpgsql stable security definer
set search_path=pg_catalog,public
as $$
declare v_raw text;
begin
  select sheet->>'speed' into v_raw from public.character_sheets
    where character_id=p_character_id;
  if coalesce(v_raw,'') ~ '^[0-9]+$' and v_raw::integer>0 then
    return v_raw::integer;
  end if;
  return 30;
end;
$$;
update public.character_sheets set sheet=sheet||
  '{"hp":24,"maxHp":24,"tempHp":0,"speed":30}'::jsonb
where character_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
update public.character_sheets set sheet=sheet||
  '{"hp":12,"maxHp":12,"speed":30}'::jsonb
where character_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';


-- Tactical command fixture: use real parameter/column shapes and command
-- allowlist, while keeping other encounter mechanics outside this focused test.
create table public.encounters(
 id uuid primary key,status text not null default 'draft',
 active_participant_id uuid,round integer not null default 0,
 turn_index integer not null default 0,version bigint not null default 1,
 updated_at timestamptz not null default now()
);
create table public.encounter_participants(
 id uuid primary key,encounter_id uuid not null references public.encounters(id),
 character_id uuid,display_name text not null,controller_user_id uuid,
 is_defeated boolean not null default false,
 bonus_action_available boolean not null default true,
 current_hp integer,max_hp integer,
 speed_ft integer not null default 30 check(speed_ft>0),
 state jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table public.encounter_conditions(
 participant_id uuid,condition_key text not null
);
create table public.encounter_command_requests(
 request_id uuid primary key,
 encounter_id uuid not null references public.encounters(id),
 participant_id uuid references public.encounter_participants(id),
 command_type text not null,
 requested_by uuid,
 result jsonb,
 constraint encounter_command_requests_command_type_check
   check(command_type in ('move','end_turn','core_action','attack',
     'weapon_attack','save','reaction','effect','spell_cast'))
);
create table public.encounter_combat_log(
 id bigint generated by default as identity primary key,
 encounter_id uuid not null references public.encounters(id),
 round integer not null,turn_index integer not null,
 actor_participant_id uuid references public.encounter_participants(id),
 event_type text not null,summary text not null,detail jsonb not null
);
-- Isolated fixture only: permit inspection of tactical snapshots inside assertion
-- blocks running as authenticated. These GRANTs are NOT production migrations.
grant select on public.encounter_participants, public.encounters,
  public.encounter_combat_log, public.character_sheets to authenticated;

-- Simulate the existing production max-HP guard trigger, then replace only
-- its function definition with the new migration.
create function private.guard_encounter_participant_max_hp_v1()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private
as $hp_guard$
declare v_sheet jsonb; v_max integer;
begin
  if new.max_hp is null then
    select sheet into v_sheet from public.character_sheets
      where character_id=new.character_id;
    begin
      v_max:=coalesce(nullif(v_sheet->>'maxHp','')::integer,
        nullif(v_sheet->>'hp','')::integer,new.current_hp,1);
    exception when others then v_max:=coalesce(new.current_hp,1); end;
    new.max_hp:=greatest(0,coalesce(v_max,1));
  end if;
  if new.current_hp is not null and new.max_hp is not null
     and new.current_hp>new.max_hp then new.current_hp:=new.max_hp; end if;
  return new;
end;
$hp_guard$;
create trigger encounter_participant_max_hp_guard
before insert or update of character_id,current_hp,max_hp
on public.encounter_participants
for each row execute function private.guard_encounter_participant_max_hp_v1();

create function public.encounter_can_control_participant_v1(p_participant_id uuid)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$
select exists (
  select 1 from public.encounter_participants ep
  where ep.id=p_participant_id and
  (ep.controller_user_id=auth.uid() or
    exists(select 1 from public.character_permissions cp
      where cp.character_id=ep.character_id
        and cp.user_id=auth.uid() and cp.can_edit))
);
$$;
-- Retain the earlier test's explicit encounter guard plus the actual lookup
-- shape used by the production outside-combat mutation RPC.
create or replace function private.character_active_encounter_v1(p_character_id uuid)
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,private
as $$
  select case when
    exists(select 1 from public.test_active_encounters
      where character_id=p_character_id)
    or exists(select 1 from public.encounter_participants p
      join public.encounters e on e.id=p.encounter_id
      where p.character_id=p_character_id and e.status='active')
    then jsonb_build_object('status','active') else null end;
$$;
