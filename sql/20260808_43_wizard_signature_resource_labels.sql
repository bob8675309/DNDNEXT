-- Harden the Signature Spells overlay without changing spellbook provenance.
-- Migration 42 applies the free-use resource to the existing Wizard spellbook row.
-- This follow-up prevents overwriting an unrelated limited-use resource and exposes a
-- stable player-facing feature label through the existing sheet resource profile.

create or replace function private.guard_signature_spell_resource_overlay_v1()
returns trigger
language plpgsql
set search_path=pg_catalog,public,private
as $$
declare
  v_becoming_signature boolean:=false;
begin
  v_becoming_signature:=coalesce((new.raw_payload->>'signatureSpell')::boolean,false)
    and not coalesce((old.raw_payload->>'signatureSpell')::boolean,false);

  if v_becoming_signature and coalesce(old.uses_max,0)>0 then
    raise exception 'Signature Spells cannot overwrite another limited-use resource on the same spell assignment.';
  end if;

  if coalesce((new.raw_payload->>'signatureSpell')::boolean,false) then
    new.raw_payload:=coalesce(new.raw_payload,'{}'::jsonb)||jsonb_build_object(
      'resourceLabel','Signature Spell',
      'resourceFeature','Signature Spells',
      'signatureSpellRecharge','short_rest_or_long_rest'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists character_spells_guard_signature_spell_resource_overlay_v1 on public.character_spells;
create trigger character_spells_guard_signature_spell_resource_overlay_v1
before update of prepared,always_available,uses_max,uses_remaining,recharge,raw_payload on public.character_spells
for each row execute function private.guard_signature_spell_resource_overlay_v1();

create or replace function private.character_sheet_resource_profile_json_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_class_key text;
  v_class_name text;
  v_class_level integer;
  v_slots jsonb:='[]'::jsonb;
  v_spell_uses jsonb:='[]'::jsonb;
  v_last_short timestamptz;
  v_last_long timestamptz;
begin
  select c.class_key,c.class_name,cp.class_level
  into v_class_key,v_class_name,v_class_level
  from public.character_progression cp
  join public.class_catalog c on c.id=cp.class_id
  where cp.character_id=p_character_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'poolKey',s.pool_key,'slotLevel',s.slot_level,'max',s.slots_max,'remaining',s.slots_remaining,
    'rechargeKey',s.recharge_key,'sourceClassKey',s.source_class_key,'sourceBook',s.source_book,
    'sourceRuleset',s.source_ruleset,'sourceClassLevel',s.source_class_level
  ) order by s.pool_key,s.slot_level),'[]'::jsonb)
  into v_slots
  from public.character_spell_slots s
  where s.character_id=p_character_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId',cs.id,
    'spellId',sp.id,
    'name',sp.name,
    'resourceLabel',coalesce(nullif(cs.raw_payload->>'resourceLabel',''),sp.name),
    'resourceFeature',nullif(cs.raw_payload->>'resourceFeature',''),
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
  where cs.character_id=p_character_id and cs.uses_max is not null and cs.uses_max>0;

  select max(completed_at) filter(where rest_type='short_rest'),
         max(completed_at) filter(where rest_type='long_rest')
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
$$;

revoke all on function private.guard_signature_spell_resource_overlay_v1() from public,anon,authenticated;
grant execute on function private.guard_signature_spell_resource_overlay_v1() to service_role;
