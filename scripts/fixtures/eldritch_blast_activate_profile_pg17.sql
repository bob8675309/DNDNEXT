\set ON_ERROR_STOP on
-- Disposable Supabase Auth/PostgREST CI ONLY.
-- Add minimal canonical class/character tables, not production user data.
alter table public.character_progression add column class_id uuid;
alter table public.character_spells
 add column prepared boolean default false,
 add column always_available boolean default false,
 add column uses_max integer,
 add column uses_remaining integer,
 add column recharge text,
 add column casting_stat text,
 add column save_dc_override integer,
 add column attack_bonus_override integer,
 add column created_at timestamptz default now();
alter table public.spells_catalog
 add column name text,
 add column school text,
 add column casting_time text,
 add column range_text text,
 add column concentration boolean default false,
 add column attack_type text,
 add column saving_throw_abilities text[] default '{}',
 add column damage_dice text,
 add column healing_dice text;
create table public.class_catalog(
 id uuid primary key,class_key text not null,class_name text not null,
 source text not null,ruleset text not null,spellcasting_ability text,
 caster_progression text,prepared_spells_formula text
);
create table public.class_level_progression(
 class_id uuid not null,class_level integer not null,
 proficiency_bonus integer not null,spell_slots jsonb not null default '[]',
 primary key(class_id,class_level)
);
create table public.character_sheets(character_id uuid primary key,sheet jsonb not null);
create table public.encounter_spell_slots(
 participant_id uuid not null,pool_key text not null,
 slot_level integer not null,slots_max integer not null,
 slots_remaining integer not null,recharge_key text,
 source_class_key text,source_book text,source_ruleset text,
 source_class_level integer
);
alter table public.class_catalog enable row level security;
alter table public.class_level_progression enable row level security;
alter table public.character_sheets enable row level security;
alter table public.encounter_spell_slots enable row level security;
insert into public.class_catalog
(id,class_key,class_name,source,ruleset,spellcasting_ability,
caster_progression,prepared_spells_formula) values(
 public.fixture_uuid(201),'warlock|XPHB','Warlock','XPHB','2024',
 'cha','pact_magic','warlock_formula'
);
insert into public.class_level_progression(class_id,class_level,proficiency_bonus)
values(public.fixture_uuid(201),3,2),(public.fixture_uuid(201),5,3);
update public.character_progression
set class_id=public.fixture_uuid(201),class_level=3
where character_id=public.fixture_uuid(31);
insert into public.character_sheets(character_id,sheet)
values(public.fixture_uuid(31),
 '{"abilities":{"cha":{"score":20}},"proficiencyBonus":2}'::jsonb);
update public.spells_catalog set
 name=case when lower(spell_key)='eldritch-blast|xphb' then 'Eldritch Blast'
           else 'Supplementary cantrip' end,
 school='Evocation',casting_time='1 action',range_text='120 feet',
 damage_dice='1d10',attack_type='ranged'
where id in(public.fixture_uuid(61),public.fixture_uuid(62),
            public.fixture_uuid(63),public.fixture_uuid(64));
insert into public.encounter_spell_slots
(participant_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key,
source_class_key,source_book,source_ruleset,source_class_level)
values(public.fixture_uuid(11),'pact',2,2,1,'short_rest',
'warlock|XPHB','XPHB','2024',3);
drop function public.encounter_spellcasting_profile_v1(uuid);
drop function private.encounter_ability_score_v1(uuid,text);
\i scripts/fixtures/eldritch_blast_production_profile_pg17.sql
-- No public-facing profile endpoint exposed to anonymous users in CI.
revoke all on function public.encounter_spellcasting_profile_v1(uuid)
 from public,anon,service_role;
grant execute on function public.encounter_spellcasting_profile_v1(uuid)
 to authenticated;
revoke all on function public.encounter_can_control_participant_v1(uuid)
 from public,anon,service_role;
grant execute on function public.encounter_can_control_participant_v1(uuid)
 to authenticated;
revoke all on function private.encounter_ability_score_v1(uuid,text)
 from public,anon,authenticated,service_role;
do $acl$
begin
 if has_function_privilege('anon',
 'public.encounter_spellcasting_profile_v1(uuid)','EXECUTE')
 or has_function_privilege('service_role',
 'public.encounter_spellcasting_profile_v1(uuid)','EXECUTE')
 or has_function_privilege('authenticated',
 'private.encounter_ability_score_v1(uuid,text)','EXECUTE')
 then raise exception 'Unsafe local profile fixture ACL';end if;
end;
$acl$;
