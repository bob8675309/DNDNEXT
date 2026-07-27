begin;

create table if not exists public.encounter_spell_slots (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.encounter_participants(id) on delete cascade,
  pool_key text not null check (pool_key in ('spellcasting','pact_magic')),
  slot_level integer not null check (slot_level between 1 and 9),
  slots_max integer not null check (slots_max >= 0),
  slots_remaining integer not null check (slots_remaining >= 0 and slots_remaining <= slots_max),
  recharge_key text not null check (recharge_key in ('long_rest','short_rest','special')),
  source_class_id uuid references public.class_catalog(id) on delete set null,
  source_class_key text,
  source_book text,
  source_ruleset text,
  source_class_level integer check (source_class_level is null or source_class_level between 1 and 20),
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  unique(participant_id,pool_key,slot_level)
);

create index if not exists encounter_spell_slots_source_class_idx
  on public.encounter_spell_slots(source_class_id);

alter table public.encounter_spell_slots enable row level security;
revoke all on public.encounter_spell_slots from public, anon, authenticated;
grant select on public.encounter_spell_slots to authenticated;
grant all on public.encounter_spell_slots to service_role;

drop policy if exists encounter_spell_slots_authenticated_read on public.encounter_spell_slots;
create policy encounter_spell_slots_authenticated_read on public.encounter_spell_slots
for select to authenticated using (
  public.encounter_can_control_participant_v1(participant_id)
);

create or replace function private.encounter_ability_score_v1(p_character_id uuid,p_ability text)
returns integer
language plpgsql stable security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_sheet jsonb;
  v_key text:=lower(btrim(coalesce(p_ability,'')));
  v_raw text;
  v_score integer;
begin
  if p_character_id is null or v_key not in ('str','dex','con','int','wis','cha') then return null; end if;
  select cs.sheet into v_sheet from public.character_sheets cs where cs.character_id=p_character_id;
  if v_sheet is null then return 10; end if;
  v_raw:=v_sheet #>> array['abilities',v_key,'score'];
  if coalesce(v_raw,'') ~ '^-?[0-9]+$' then
    v_score:=v_raw::integer;
    if v_score between 1 and 30 then return v_score; end if;
  end if;
  return 10;
end;
$function$;
revoke all on function private.encounter_ability_score_v1(uuid,text) from public, anon, authenticated;
grant execute on function private.encounter_ability_score_v1(uuid,text) to service_role;

create or replace function private.initialize_encounter_spell_slots_v1(p_participant_id uuid)
returns integer
language plpgsql security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_participant public.encounter_participants%rowtype;
  v_class_id uuid;
  v_class_level integer;
  v_class_key text;
  v_source text;
  v_ruleset text;
  v_caster_progression text;
  v_spellcasting_ability text;
  v_spell_slots jsonb;
  v_pool_key text;
  v_recharge_key text;
  v_slot record;
  v_inserted integer:=0;
  v_rows integer:=0;
begin
  if p_participant_id is null then return 0; end if;
  select * into v_participant from public.encounter_participants where id=p_participant_id;
  if not found or v_participant.character_id is null then return 0; end if;

  select cp.class_id,cp.class_level,c.class_key,c.source,c.ruleset,c.caster_progression,c.spellcasting_ability,lp.spell_slots
  into v_class_id,v_class_level,v_class_key,v_source,v_ruleset,v_caster_progression,v_spellcasting_ability,v_spell_slots
  from public.character_progression cp
  join public.class_catalog c on c.id=cp.class_id
  left join public.class_level_progression lp on lp.class_id=cp.class_id and lp.class_level=cp.class_level
  where cp.character_id=v_participant.character_id;

  if not found or nullif(btrim(coalesce(v_spellcasting_ability,'')),'') is null then return 0; end if;
  if jsonb_typeof(coalesce(v_spell_slots,'[]'::jsonb))<>'array' then return 0; end if;

  v_pool_key:=case when lower(coalesce(v_caster_progression,''))='pact' then 'pact_magic' else 'spellcasting' end;
  v_recharge_key:=case when v_pool_key='pact_magic' then 'short_rest' else 'long_rest' end;

  for v_slot in
    select ordinality::integer as slot_level, value::integer as slots_max
    from jsonb_array_elements_text(v_spell_slots) with ordinality
  loop
    if v_slot.slot_level between 1 and 9 and v_slot.slots_max>0 then
      insert into public.encounter_spell_slots(
        participant_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key,
        source_class_id,source_class_key,source_book,source_ruleset,source_class_level
      ) values(
        v_participant.id,v_pool_key,v_slot.slot_level,v_slot.slots_max,v_slot.slots_max,v_recharge_key,
        v_class_id,v_class_key,v_source,v_ruleset,v_class_level
      )
      on conflict(participant_id,pool_key,slot_level) do nothing;
      get diagnostics v_inserted=row_count;
      v_rows:=v_rows+v_inserted;
    end if;
  end loop;
  return v_rows;
end;
$function$;
revoke all on function private.initialize_encounter_spell_slots_v1(uuid) from public, anon, authenticated;
grant execute on function private.initialize_encounter_spell_slots_v1(uuid) to service_role;

create or replace function private.snapshot_encounter_spell_slots_after_insert_v1()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, private
as $function$
begin
  perform private.initialize_encounter_spell_slots_v1(new.id);
  return new;
end;
$function$;
revoke all on function private.snapshot_encounter_spell_slots_after_insert_v1() from public, anon, authenticated;
grant execute on function private.snapshot_encounter_spell_slots_after_insert_v1() to service_role;

drop trigger if exists encounter_participant_spell_slot_snapshot on public.encounter_participants;
create trigger encounter_participant_spell_slot_snapshot
after insert on public.encounter_participants
for each row execute function private.snapshot_encounter_spell_slots_after_insert_v1();

do $backfill$
declare v_row record;
begin
  for v_row in select id from public.encounter_participants loop
    perform private.initialize_encounter_spell_slots_v1(v_row.id);
  end loop;
end;
$backfill$;

create or replace function public.encounter_spellcasting_profile_v1(p_participant_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_role text:=coalesce(auth.role(),'');
  v_participant public.encounter_participants%rowtype;
  v_class_id uuid;
  v_class_level integer;
  v_class_key text;
  v_class_name text;
  v_source text;
  v_ruleset text;
  v_spellcasting_ability text;
  v_caster_progression text;
  v_prepared_formula text;
  v_prof integer;
  v_slot_progression jsonb:='[]'::jsonb;
  v_ability_score integer;
  v_ability_mod integer;
  v_spell_attack_bonus integer;
  v_spell_save_dc integer;
  v_slots jsonb:='[]'::jsonb;
  v_spells jsonb:='[]'::jsonb;
begin
  if p_participant_id is null then raise exception 'Participant is required'; end if;
  select * into v_participant from public.encounter_participants where id=p_participant_id;
  if not found then raise exception 'Participant not found'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_participant.id) then
    raise exception 'Not authorized to view this participant spellcasting profile';
  end if;

  select cp.class_id,cp.class_level,c.class_key,c.class_name,c.source,c.ruleset,c.spellcasting_ability,c.caster_progression,c.prepared_spells_formula,
         lp.proficiency_bonus,coalesce(lp.spell_slots,'[]'::jsonb)
  into v_class_id,v_class_level,v_class_key,v_class_name,v_source,v_ruleset,v_spellcasting_ability,v_caster_progression,v_prepared_formula,
       v_prof,v_slot_progression
  from public.character_progression cp
  join public.class_catalog c on c.id=cp.class_id
  left join public.class_level_progression lp on lp.class_id=cp.class_id and lp.class_level=cp.class_level
  where cp.character_id=v_participant.character_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'poolKey',s.pool_key,
    'slotLevel',s.slot_level,
    'max',s.slots_max,
    'remaining',s.slots_remaining,
    'rechargeKey',s.recharge_key,
    'sourceClassKey',s.source_class_key,
    'sourceBook',s.source_book,
    'sourceRuleset',s.source_ruleset,
    'sourceClassLevel',s.source_class_level
  ) order by s.pool_key,s.slot_level),'[]'::jsonb)
  into v_slots
  from public.encounter_spell_slots s
  where s.participant_id=v_participant.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId',a.id,
    'spellId',sp.id,
    'spellKey',sp.spell_key,
    'name',sp.name,
    'source',sp.source,
    'level',sp.level,
    'school',sp.school,
    'castingTime',sp.casting_time,
    'rangeText',sp.range_text,
    'concentration',sp.concentration,
    'attackType',sp.attack_type,
    'savingThrowAbilities',sp.saving_throw_abilities,
    'damageDice',sp.damage_dice,
    'damageTypes',sp.damage_types,
    'healingDice',sp.healing_dice,
    'sourceType',a.source_type,
    'sourceLabel',a.source_label,
    'prepared',a.prepared,
    'alwaysAvailable',a.always_available,
    'usesMax',a.uses_max,
    'usesRemaining',a.uses_remaining,
    'recharge',a.recharge,
    'castingStat',a.casting_stat,
    'saveDcOverride',a.save_dc_override,
    'attackBonusOverride',a.attack_bonus_override
  ) order by sp.level,sp.name,a.created_at),'[]'::jsonb)
  into v_spells
  from public.character_spells a
  join public.spells_catalog sp on sp.id=a.spell_id
  where a.character_id=v_participant.character_id;

  if nullif(btrim(coalesce(v_spellcasting_ability,'')),'') is not null then
    v_ability_score:=private.encounter_ability_score_v1(v_participant.character_id,v_spellcasting_ability);
    v_ability_mod:=floor((coalesce(v_ability_score,10)-10)/2.0)::integer;
    if v_prof is null then
      select case when coalesce(cs.sheet->>'proficiencyBonus','') ~ '^[0-9]+$' then (cs.sheet->>'proficiencyBonus')::integer else 2 end
      into v_prof from public.character_sheets cs where cs.character_id=v_participant.character_id;
      v_prof:=coalesce(v_prof,2);
    end if;
    v_spell_attack_bonus:=v_ability_mod+v_prof;
    v_spell_save_dc:=8+v_ability_mod+v_prof;
  end if;

  return jsonb_build_object(
    'participantId',v_participant.id,
    'characterId',v_participant.character_id,
    'classId',v_class_id,
    'classKey',v_class_key,
    'className',v_class_name,
    'classSource',v_source,
    'ruleset',v_ruleset,
    'classLevel',v_class_level,
    'isClassCaster',nullif(btrim(coalesce(v_spellcasting_ability,'')),'') is not null,
    'castingAbility',v_spellcasting_ability,
    'castingAbilityScore',v_ability_score,
    'castingAbilityModifier',v_ability_mod,
    'proficiencyBonus',v_prof,
    'spellAttackBonus',v_spell_attack_bonus,
    'spellSaveDc',v_spell_save_dc,
    'casterProgression',v_caster_progression,
    'preparedSpellsFormula',v_prepared_formula,
    'canonicalSlotProgression',coalesce(v_slot_progression,'[]'::jsonb),
    'slotSnapshot',coalesce(v_slots,'[]'::jsonb),
    'knownSpells',coalesce(v_spells,'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.encounter_spellcasting_profile_v1(uuid) from public, anon;
grant execute on function public.encounter_spellcasting_profile_v1(uuid) to authenticated, service_role;

do $postconditions$
begin
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='encounter_spell_slots' and c.relkind='r') then
    raise exception 'encounter_spell_slots table missing';
  end if;
  if has_table_privilege('authenticated','public.encounter_spell_slots','INSERT')
     or has_table_privilege('authenticated','public.encounter_spell_slots','UPDATE')
     or has_table_privilege('authenticated','public.encounter_spell_slots','DELETE') then
    raise exception 'authenticated must not directly mutate encounter spell slots';
  end if;
  if not has_table_privilege('authenticated','public.encounter_spell_slots','SELECT') then
    raise exception 'authenticated spell slot read access missing';
  end if;
  if has_function_privilege('authenticated','private.initialize_encounter_spell_slots_v1(uuid)','EXECUTE') then
    raise exception 'spell slot initializer must remain private';
  end if;
  if has_function_privilege('authenticated','private.encounter_ability_score_v1(uuid,text)','EXECUTE') then
    raise exception 'ability score helper must remain private';
  end if;
  if not has_function_privilege('authenticated','public.encounter_spellcasting_profile_v1(uuid)','EXECUTE') then
    raise exception 'guarded spellcasting profile RPC missing';
  end if;
  if not exists(select 1 from pg_trigger where tgname='encounter_participant_spell_slot_snapshot' and not tgisinternal) then
    raise exception 'encounter participant spell slot snapshot trigger missing';
  end if;
end;
$postconditions$;

commit;
