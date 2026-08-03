begin;

-- Canonical character-level spell resources for standalone/in-person Sheet & Rolls.
-- Encounter spell slots remain encounter-scoped snapshots and are not mutated here.

create table if not exists public.character_spell_slots (
  character_id uuid not null references public.characters(id) on delete cascade,
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
  primary key(character_id,pool_key,slot_level)
);

create index if not exists character_spell_slots_source_class_idx
  on public.character_spell_slots(source_class_id);

create table if not exists public.character_rest_log (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  rest_type text not null check (rest_type in ('short_rest','long_rest')),
  completed_by uuid,
  restored_spell_slots integer not null default 0 check (restored_spell_slots >= 0),
  restored_spell_uses integer not null default 0 check (restored_spell_uses >= 0),
  details jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default timezone('utc',now())
);

create index if not exists character_rest_log_character_time_idx
  on public.character_rest_log(character_id,completed_at desc);

alter table public.character_spell_slots enable row level security;
alter table public.character_rest_log enable row level security;

revoke all on public.character_spell_slots from public, anon, authenticated;
revoke all on public.character_rest_log from public, anon, authenticated;
grant all on public.character_spell_slots to service_role;
grant all on public.character_rest_log to service_role;

create or replace function private.sync_character_spell_slots_v1(p_character_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
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
  v_levels integer[] := '{}'::integer[];
  v_slot record;
  v_rows integer := 0;
  v_changed integer := 0;
begin
  if p_character_id is null then return 0; end if;

  select cp.class_id,cp.class_level,c.class_key,c.source,c.ruleset,
         c.caster_progression,c.spellcasting_ability,lp.spell_slots
  into v_class_id,v_class_level,v_class_key,v_source,v_ruleset,
       v_caster_progression,v_spellcasting_ability,v_spell_slots
  from public.character_progression cp
  join public.class_catalog c on c.id=cp.class_id
  left join public.class_level_progression lp
    on lp.class_id=cp.class_id and lp.class_level=cp.class_level
  where cp.character_id=p_character_id;

  if not found
     or nullif(btrim(coalesce(v_spellcasting_ability,'')),'') is null
     or jsonb_typeof(coalesce(v_spell_slots,'[]'::jsonb)) <> 'array' then
    delete from public.character_spell_slots where character_id=p_character_id;
    get diagnostics v_rows=row_count;
    return v_rows;
  end if;

  v_pool_key := case when lower(coalesce(v_caster_progression,''))='pact'
    then 'pact_magic' else 'spellcasting' end;
  v_recharge_key := case when v_pool_key='pact_magic'
    then 'short_rest' else 'long_rest' end;

  for v_slot in
    select ordinality::integer as slot_level,value::integer as slots_max
    from jsonb_array_elements_text(v_spell_slots) with ordinality
  loop
    if v_slot.slot_level between 1 and 9 and v_slot.slots_max > 0 then
      v_levels := array_append(v_levels,v_slot.slot_level);
      insert into public.character_spell_slots(
        character_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key,
        source_class_id,source_class_key,source_book,source_ruleset,source_class_level
      ) values(
        p_character_id,v_pool_key,v_slot.slot_level,v_slot.slots_max,v_slot.slots_max,v_recharge_key,
        v_class_id,v_class_key,v_source,v_ruleset,v_class_level
      )
      on conflict(character_id,pool_key,slot_level) do update
      set slots_max=excluded.slots_max,
          slots_remaining=least(public.character_spell_slots.slots_remaining,excluded.slots_max),
          recharge_key=excluded.recharge_key,
          source_class_id=excluded.source_class_id,
          source_class_key=excluded.source_class_key,
          source_book=excluded.source_book,
          source_ruleset=excluded.source_ruleset,
          source_class_level=excluded.source_class_level,
          updated_at=timezone('utc',now());
      get diagnostics v_changed=row_count;
      v_rows := v_rows + v_changed;
    end if;
  end loop;

  if coalesce(array_length(v_levels,1),0)=0 then
    delete from public.character_spell_slots where character_id=p_character_id;
  else
    delete from public.character_spell_slots
    where character_id=p_character_id
      and (pool_key<>v_pool_key or not (slot_level=any(v_levels)));
  end if;

  return v_rows;
end;
$function$;

revoke all on function private.sync_character_spell_slots_v1(uuid) from public, anon, authenticated;
grant execute on function private.sync_character_spell_slots_v1(uuid) to service_role;

create or replace function private.character_sheet_resource_profile_json_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_class_key text;
  v_class_name text;
  v_class_level integer;
  v_slots jsonb := '[]'::jsonb;
  v_spell_uses jsonb := '[]'::jsonb;
  v_last_short timestamptz;
  v_last_long timestamptz;
begin
  select c.class_key,c.class_name,cp.class_level
  into v_class_key,v_class_name,v_class_level
  from public.character_progression cp
  join public.class_catalog c on c.id=cp.class_id
  where cp.character_id=p_character_id;

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
  from public.character_spell_slots s
  where s.character_id=p_character_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId',cs.id,
    'spellId',sp.id,
    'name',sp.name,
    'level',sp.level,
    'max',cs.uses_max,
    'remaining',coalesce(cs.uses_remaining,cs.uses_max),
    'recharge',cs.recharge,
    'sourceType',cs.source_type,
    'sourceLabel',cs.source_label
  ) order by sp.level,sp.name,cs.created_at),'[]'::jsonb)
  into v_spell_uses
  from public.character_spells cs
  join public.spells_catalog sp on sp.id=cs.spell_id
  where cs.character_id=p_character_id
    and cs.uses_max is not null
    and cs.uses_max > 0;

  select max(completed_at) filter (where rest_type='short_rest'),
         max(completed_at) filter (where rest_type='long_rest')
  into v_last_short,v_last_long
  from public.character_rest_log
  where character_id=p_character_id;

  return jsonb_build_object(
    'schemaVersion',1,
    'characterId',p_character_id,
    'classKey',v_class_key,
    'className',v_class_name,
    'classLevel',v_class_level,
    'canManage',true,
    'slots',coalesce(v_slots,'[]'::jsonb),
    'limitedSpellUses',coalesce(v_spell_uses,'[]'::jsonb),
    'lastShortRest',v_last_short,
    'lastLongRest',v_last_long
  );
end;
$function$;

revoke all on function private.character_sheet_resource_profile_json_v1(uuid) from public, anon, authenticated;
grant execute on function private.character_sheet_resource_profile_json_v1(uuid) to service_role;

create or replace function public.character_sheet_resource_profile_v1(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to manage this character''s resources.' using errcode='42501';
  end if;
  perform private.sync_character_spell_slots_v1(p_character_id);
  return private.character_sheet_resource_profile_json_v1(p_character_id);
end;
$function$;

create or replace function public.update_character_spell_slot_v1(
  p_character_id uuid,
  p_pool_key text,
  p_slot_level integer,
  p_operation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_pool_key text := lower(btrim(coalesce(p_pool_key,'')));
  v_operation text := lower(btrim(coalesce(p_operation,'')));
  v_slot public.character_spell_slots%rowtype;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to manage this character''s spell slots.' using errcode='42501';
  end if;
  if v_pool_key not in ('spellcasting','pact_magic') or p_slot_level not between 1 and 9 then
    raise exception 'Invalid spell slot pool or level.' using errcode='22023';
  end if;
  if v_operation not in ('use','restore','reset') then
    raise exception 'Unsupported spell slot operation.' using errcode='22023';
  end if;

  perform private.sync_character_spell_slots_v1(p_character_id);
  select * into v_slot
  from public.character_spell_slots
  where character_id=p_character_id and pool_key=v_pool_key and slot_level=p_slot_level
  for update;
  if not found then
    raise exception 'No matching spell slot pool exists.' using errcode='P0002';
  end if;

  if v_operation='use' then
    if v_slot.slots_remaining<=0 then
      raise exception 'No spell slots remain in this pool.' using errcode='22023';
    end if;
    update public.character_spell_slots
    set slots_remaining=slots_remaining-1,updated_at=timezone('utc',now())
    where character_id=p_character_id and pool_key=v_pool_key and slot_level=p_slot_level;
  elsif v_operation='restore' then
    update public.character_spell_slots
    set slots_remaining=least(slots_max,slots_remaining+1),updated_at=timezone('utc',now())
    where character_id=p_character_id and pool_key=v_pool_key and slot_level=p_slot_level;
  else
    update public.character_spell_slots
    set slots_remaining=slots_max,updated_at=timezone('utc',now())
    where character_id=p_character_id and pool_key=v_pool_key and slot_level=p_slot_level;
  end if;

  return private.character_sheet_resource_profile_json_v1(p_character_id);
end;
$function$;

create or replace function public.update_character_spell_use_v1(
  p_character_id uuid,
  p_assignment_id uuid,
  p_operation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_operation text := lower(btrim(coalesce(p_operation,'')));
  v_max integer;
  v_remaining integer;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to manage this character''s spell uses.' using errcode='42501';
  end if;
  if v_operation not in ('use','restore','reset') then
    raise exception 'Unsupported spell use operation.' using errcode='22023';
  end if;

  select uses_max,coalesce(uses_remaining,uses_max)
  into v_max,v_remaining
  from public.character_spells
  where id=p_assignment_id and character_id=p_character_id and uses_max is not null and uses_max>0
  for update;
  if not found then
    raise exception 'No matching limited-use spell exists.' using errcode='P0002';
  end if;

  if v_operation='use' then
    if v_remaining<=0 then
      raise exception 'No uses remain for this spell.' using errcode='22023';
    end if;
    v_remaining:=v_remaining-1;
  elsif v_operation='restore' then
    v_remaining:=least(v_max,v_remaining+1);
  else
    v_remaining:=v_max;
  end if;

  update public.character_spells
  set uses_remaining=v_remaining,updated_at=timezone('utc',now())
  where id=p_assignment_id and character_id=p_character_id;

  return private.character_sheet_resource_profile_json_v1(p_character_id);
end;
$function$;

create or replace function public.complete_character_rest_v1(
  p_character_id uuid,
  p_rest_type text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_rest_type text := lower(replace(replace(btrim(coalesce(p_rest_type,'')),' ','_'),'-','_'));
  v_slots_restored integer := 0;
  v_uses_restored integer := 0;
  v_profile jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to complete rests for this character.' using errcode='42501';
  end if;
  if v_rest_type not in ('short_rest','long_rest') then
    raise exception 'Rest type must be short_rest or long_rest.' using errcode='22023';
  end if;

  perform private.sync_character_spell_slots_v1(p_character_id);

  select coalesce(sum(slots_max-slots_remaining),0)::integer
  into v_slots_restored
  from public.character_spell_slots
  where character_id=p_character_id
    and slots_remaining<slots_max
    and (v_rest_type='long_rest' or recharge_key='short_rest');

  update public.character_spell_slots
  set slots_remaining=slots_max,updated_at=timezone('utc',now())
  where character_id=p_character_id
    and slots_remaining<slots_max
    and (v_rest_type='long_rest' or recharge_key='short_rest');

  select coalesce(sum(uses_max-coalesce(uses_remaining,uses_max)),0)::integer
  into v_uses_restored
  from public.character_spells
  where character_id=p_character_id
    and uses_max is not null and uses_max>0
    and coalesce(uses_remaining,uses_max)<uses_max
    and case
      when v_rest_type='long_rest' then lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_')) in ('short_rest','long_rest')
      else lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_'))='short_rest'
    end;

  update public.character_spells
  set uses_remaining=uses_max,updated_at=timezone('utc',now())
  where character_id=p_character_id
    and uses_max is not null and uses_max>0
    and case
      when v_rest_type='long_rest' then lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_')) in ('short_rest','long_rest')
      else lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_'))='short_rest'
    end;

  insert into public.character_rest_log(
    character_id,rest_type,completed_by,restored_spell_slots,restored_spell_uses,details
  ) values(
    p_character_id,v_rest_type,auth.uid(),v_slots_restored,v_uses_restored,
    jsonb_build_object(
      'scope','standalone_character_sheet',
      'encounterStateChanged',false,
      'restores',case when v_rest_type='short_rest'
        then jsonb_build_array('short-rest spell slots','short-rest limited spell uses')
        else jsonb_build_array('all spell slots','short-rest limited spell uses','long-rest limited spell uses')
      end
    )
  );

  v_profile:=private.character_sheet_resource_profile_json_v1(p_character_id);
  return v_profile || jsonb_build_object(
    'restResult',jsonb_build_object(
      'restType',v_rest_type,
      'restoredSpellSlots',v_slots_restored,
      'restoredSpellUses',v_uses_restored
    )
  );
end;
$function$;

revoke all on function public.character_sheet_resource_profile_v1(uuid) from public, anon;
revoke all on function public.update_character_spell_slot_v1(uuid,text,integer,text) from public, anon;
revoke all on function public.update_character_spell_use_v1(uuid,uuid,text) from public, anon;
revoke all on function public.complete_character_rest_v1(uuid,text) from public, anon;

grant execute on function public.character_sheet_resource_profile_v1(uuid) to authenticated, service_role;
grant execute on function public.update_character_spell_slot_v1(uuid,text,integer,text) to authenticated, service_role;
grant execute on function public.update_character_spell_use_v1(uuid,uuid,text) to authenticated, service_role;
grant execute on function public.complete_character_rest_v1(uuid,text) to authenticated, service_role;

comment on table public.character_spell_slots is
  'Canonical standalone/in-person character spell-slot state. Encounter spell slots remain isolated snapshots.';
comment on table public.character_rest_log is
  'Auditable short-rest and long-rest completions from standalone Sheet & Rolls.';
comment on function public.complete_character_rest_v1(uuid,text) is
  'Completes a standalone character rest, restoring only spell slots and limited spell uses. It does not mutate encounter state, HP, Hit Dice, or class-feature resources.';

-- Ensure every existing sheet has a stable character identity for shared sheet enhancements.
update public.character_sheets cs
set sheet=jsonb_set(
  jsonb_set(
    cs.sheet,
    '{meta}',
    case when jsonb_typeof(cs.sheet->'meta')='object' then cs.sheet->'meta' else '{}'::jsonb end,
    true
  ),
  '{meta,characterId}',
  to_jsonb(cs.character_id::text),
  true
), updated_at=timezone('utc',now())
where cs.sheet#>>'{meta,characterId}' is distinct from cs.character_id::text;

update public.players p
set sheet=cs.sheet,updated_at=timezone('utc',now())
from public.character_permissions cp
join public.character_sheets cs on cs.character_id=cp.character_id
where cp.user_id=p.user_id and cp.can_edit;

-- Initialize canonical slot pools for all existing character progressions.
do $backfill$
declare v_character record;
begin
  for v_character in select character_id from public.character_progression loop
    perform private.sync_character_spell_slots_v1(v_character.character_id);
  end loop;
end;
$backfill$;

do $postconditions$
begin
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='character_spell_slots' and c.relkind='r') then
    raise exception 'character_spell_slots table missing';
  end if;
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='character_rest_log' and c.relkind='r') then
    raise exception 'character_rest_log table missing';
  end if;
  if has_table_privilege('authenticated','public.character_spell_slots','INSERT')
     or has_table_privilege('authenticated','public.character_spell_slots','UPDATE')
     or has_table_privilege('authenticated','public.character_spell_slots','DELETE') then
    raise exception 'authenticated must not directly mutate character spell slots';
  end if;
  if has_table_privilege('authenticated','public.character_rest_log','INSERT')
     or has_table_privilege('authenticated','public.character_rest_log','UPDATE')
     or has_table_privilege('authenticated','public.character_rest_log','DELETE') then
    raise exception 'authenticated must not directly mutate character rest logs';
  end if;
  if has_function_privilege('authenticated','private.sync_character_spell_slots_v1(uuid)','EXECUTE') then
    raise exception 'character slot synchronizer must remain private';
  end if;
  if not has_function_privilege('authenticated','public.character_sheet_resource_profile_v1(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.update_character_spell_slot_v1(uuid,text,integer,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.update_character_spell_use_v1(uuid,uuid,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.complete_character_rest_v1(uuid,text)','EXECUTE') then
    raise exception 'guarded character resource RPC grant missing';
  end if;
  if exists(select 1 from public.character_spell_slots where slots_remaining<0 or slots_remaining>slots_max) then
    raise exception 'invalid character spell slot counts found';
  end if;
end;
$postconditions$;

commit;
