-- Disposable local profile-shape adapter. Only for local GoTrue CI.
-- Produces production-required columns so ACTUAL live profile function body
-- (copied into held candidate) executes without fake profile JSON.
alter table public.class_catalog
 add column ruleset text default '2024',
 add column caster_progression text default 'full',
 add column prepared_spells_formula text default null;
create table public.class_level_progression (
 class_id uuid not null,class_level integer not null,
 proficiency_bonus integer,spell_slots jsonb default '[]'::jsonb,
 primary key(class_id,class_level)
);
insert into public.class_level_progression(class_id,class_level,proficiency_bonus)
values(public.p2_id(71),5,3);
alter table public.encounter_spell_slots
 add column source_class_key text,
 add column source_book text,
 add column source_ruleset text,
 add column source_class_level integer;
alter table public.spells_catalog
 add column school text,
 add column casting_time text,
 add column range_text text,
 add column concentration boolean,
 add column attack_type text,
 add column saving_throw_abilities text[],
 add column damage_dice text,
 add column damage_types text[],
 add column healing_dice text;
alter table public.character_spells
 add column uses_max integer,
 add column uses_remaining integer,
 add column recharge text,
 add column save_dc_override integer,
 add column created_at timestamptz not null default now();
-- Existing local companion Fire Bolt is known, cantrip, not prepared.
-- Current caster SQL allows known cantrips regardless of prepared status.
insert into public.spells_catalog(id,spell_key,name,source,level)
values
 (public.p2_id(62),'secret-ritual|XPHB','GM Secret Ritual','XPHB',1),
 (public.p2_id(63),'shield|XPHB','Shield','XPHB',1),
 (public.p2_id(64),'unlearned-ritual|XPHB','GM Unknown Ritual','XPHB',1),
 (public.p2_id(65),'light|XPHB','Light','XPHB',0);
insert into public.character_spells(
 id,character_id,spell_id,source_type,source_key,source_label,
 known,prepared,always_available,casting_stat)
values
 (public.p2_id(159),public.p2_id(32),public.p2_id(62),
  'class','wizard','wizard',true,false,false,'int'),
 (public.p2_id(160),public.p2_id(32),public.p2_id(63),
  'class','wizard','wizard',true,true,false,'int'),
 (public.p2_id(161),public.p2_id(32),public.p2_id(64),
  'class','wizard','wizard',false,true,false,'int'),
 (public.p2_id(162),public.p2_id(32),public.p2_id(65),
  'feat','magic-initiate','magic-initiate',true,false,true,'int');
insert into public.encounter_spell_slots
 (id,participant_id,pool_key,slot_level,slots_max,slots_remaining,
  recharge_key,source_class_key,source_book,source_ruleset,source_class_level)
values(public.p2_id(1990),public.p2_id(33),
 'wizard',1,3,2,'long_rest','wizard','XPHB','2024',5);

-- Replace ONLY the fixture's simplified profile stub with exact source
-- function copied into PRIVATE and the held public projection wrapper.
drop function public.encounter_spellcasting_profile_v1(uuid);
\i sql/candidates/20261101_npc_spell_profile_visibility_candidate.sql

do $verify$
begin
 if has_function_privilege('anon',
  'public.encounter_spellcasting_profile_v1(uuid)','EXECUTE')
 or has_function_privilege('authenticated',
  'private.encounter_spellcasting_profile_full_candidate_v1(uuid)','EXECUTE')
 then raise exception 'NPC profile candidate RPC permissions broadened'; end if;
end $verify$;
notify pgrst,'reload schema';
