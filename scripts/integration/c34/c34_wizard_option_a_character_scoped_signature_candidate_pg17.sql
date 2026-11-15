-- C34 T16 Option A candidate. DELIBERATELY NON-ORIGINAL function:
-- original held #353 wizard Signature Spells projection was found to mirror
-- a character's signature features to every linked account-level players.sheet.
-- Keep original raw source unchanged in sources/11_i1e_* and original
-- Savant/Signature materializer+deferred trigger byte-identical.
-- Remove ONLY that two-line legacy account UPDATE from original writer.
-- Disposable test candidate; no production migration or backfill.
\set ON_ERROR_STOP on
DO $t16_safe_pre$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR md5(pg_get_functiondef('private.apply_wizard_signature_spell_ids_v1(uuid,jsonb,text,text)'::regprocedure))<>'c6d23dc8eccb824e9199ca027139a7da'
 OR md5(pg_get_functiondef('private.materialize_player_forge_wizard_final_v1()'::regprocedure))<>'3c71ad65cde45d74bef4ea63f25847ac'
 THEN RAISE EXCEPTION 'T16 Option A requires verified source-original RED writer'; END IF;
END $t16_safe_pre$;

CREATE OR REPLACE FUNCTION private.apply_wizard_signature_spell_ids_v1(p_character_id uuid, p_selected jsonb, p_cadence text, p_creator text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_selected jsonb:=coalesce(p_selected,'[]'::jsonb);
  v_key text;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
  v_assignment public.character_spells%rowtype;
  v_summary jsonb:='[]'::jsonb;
  v_serialized jsonb:='[]'::jsonb;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:='{}'::jsonb;
  v_existing_summary jsonb:='[]'::jsonb;
  v_choice_summary jsonb:='[]'::jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' then
    if jsonb_typeof(v_selected)='array' and jsonb_array_length(v_selected)>0 then raise exception 'Signature Spells are only valid for an XPHB Wizard.'; end if;
    return '[]'::jsonb;
  end if;
  if v_progression.class_level<>20 then
    if jsonb_typeof(v_selected)='array' and jsonb_array_length(v_selected)>0 then raise exception 'Signature Spells require Wizard level 20.'; end if;
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(v_selected)<>'array' or jsonb_array_length(v_selected)<>2 then
    raise exception 'Signature Spells require exactly two level-3 spells from this Wizard''s spellbook.';
  end if;
  if (select count(distinct value) from jsonb_array_elements_text(v_selected))<>2 then
    raise exception 'Signature Spell selections must be distinct.';
  end if;

  for v_key in select value from jsonb_array_elements_text(v_selected) loop
    begin
      v_spell_id:=v_key::uuid;
    exception when others then
      raise exception 'Signature Spells require canonical spell ids.';
    end;
    select * into v_spell from public.spells_catalog_preferred where id=v_spell_id;
    if not found
       or v_spell.level<>3
       or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)='wizard') then
      raise exception '% is not a level-3 Wizard spell eligible for Signature Spells.',coalesce(v_spell.name,'The selected spell');
    end if;
    if not private.wizard_spellbook_has_spell_v1(p_character_id,v_spell.id) then
      raise exception '% is not in this Wizard''s spellbook and cannot be a Signature Spell.',v_spell.name;
    end if;

    select cs.* into v_assignment
    from public.character_spells cs
    where cs.character_id=p_character_id
      and cs.spell_id=v_spell.id
      and (
        cs.source_type='class'
        or (cs.source_type='class-feature' and coalesce((cs.raw_payload->>'wizardSpellbook')::boolean,false))
      )
    order by cs.created_at,cs.id
    limit 1
    for update of cs;
    if not found then raise exception '% could not be resolved to one authoritative Wizard spellbook assignment.',v_spell.name; end if;

    update public.character_spells cs
    set prepared=true,
        always_available=true,
        uses_max=1,
        uses_remaining=1,
        recharge='short_rest',
        raw_payload=coalesce(cs.raw_payload,'{}'::jsonb)||jsonb_build_object(
          'signatureSpell',true,
          'signatureSpellFeature','Signature Spells',
          'signatureSpellLevel',3,
          'signatureSpellGrantedAtLevel',20,
          'signatureSpellCreator',coalesce(nullif(btrim(p_creator),''),'character_progression_v5')
        ),
        updated_at=now()
    where cs.id=v_assignment.id;

    v_summary:=v_summary||jsonb_build_array(jsonb_build_object(
      'family','wizard-signature-spells',
      'type','signature-spell',
      'groupId','wizard-signature-spells',
      'feature','Signature Spells',
      'assignmentId',v_assignment.id,
      'spellId',v_spell.id,
      'spellKey',v_spell.spell_key,
      'name',v_spell.name,
      'source',v_spell.source,
      'school',v_spell.school,
      'level',20,
      'spellLevel',3,
      'membershipSourceType',v_assignment.source_type,
      'membershipSourceKey',v_assignment.source_key,
      'usesMax',1,
      'usesRemaining',1,
      'recharge','short_rest_or_long_rest'
    ));
    v_serialized:=v_serialized||jsonb_build_array(jsonb_build_object(
      'key',v_spell.id::text,
      'name',v_spell.name,
      'source',v_spell.source,
      'kind','spell',
      'spell',jsonb_build_object('id',v_spell.id,'spellKey',v_spell.spell_key,'level',3,'school',v_spell.school)
    ));
  end loop;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_sheet:=jsonb_set(v_sheet,'{meta}',case when jsonb_typeof(v_sheet->'meta')='object' then v_sheet->'meta' else '{}'::jsonb end,true);
  v_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;
  v_choices:=jsonb_set(v_choices,array['wizard-signature-spells'],jsonb_build_object(
    'label','Signature Spells',
    'kind','spell',
    'sourceFeature','Signature Spells',
    'source','XPHB',
    'level',20,
    'count',2,
    'placement','spells',
    'allowRepeatAcrossGroups',true,
    'cadence',coalesce(nullif(btrim(p_cadence),''),'level-up'),
    'replacementCadence',null,
    'constraints',jsonb_build_object('spellLevel',3,'spellClasses',jsonb_build_array('Wizard'),'wizardSpellbookRequired',true,'freeCastUses',1,'recharge','short_rest'),
    'selections',v_serialized
  ),true);

  v_existing_summary:=case when jsonb_typeof(v_sheet->'classFeatureChoiceSummary')='array' then v_sheet->'classFeatureChoiceSummary' else '[]'::jsonb end;
  select coalesce(jsonb_agg(e.item),'[]'::jsonb) into v_choice_summary
  from jsonb_array_elements(v_existing_summary) as e(item)
  where coalesce(e.item->>'groupId','')<>'wizard-signature-spells';
  v_choice_summary:=v_choice_summary||(
    select coalesce(jsonb_agg(jsonb_build_object(
      'groupId','wizard-signature-spells',
      'groupLabel','Signature Spells',
      'groupKind','spell',
      'level',20,
      'placement','spells',
      'cadence',coalesce(nullif(btrim(p_cadence),''),'level-up'),
      'key',e.entry->>'key',
      'name',e.entry->>'name',
      'source',e.entry->>'source',
      'kind','spell'
    )),'[]'::jsonb)
    from jsonb_array_elements(v_serialized) as e(entry)
  );

  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoiceSummary}',v_choice_summary,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoiceSummary}',v_choice_summary,true);
  v_sheet:=jsonb_set(v_sheet,'{signatureSpells}',v_serialized,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,signatureSpells}',v_serialized,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  -- T16 Option A character-scoped projection only: no cross-account legacy
  -- players.sheet mirror; original source remains preserved in source archive.

  return v_summary;
end;
$function$;
REVOKE ALL ON FUNCTION private.apply_wizard_signature_spell_ids_v1(uuid,jsonb,text,text) FROM PUBLIC,anon,authenticated;
DO $t16_safe_post$
DECLARE d text;
BEGIN
 d:=pg_get_functiondef('private.apply_wizard_signature_spell_ids_v1(uuid,jsonb,text,text)'::regprocedure);
 IF position('update public.players' IN lower(d))>0
 OR md5(d)='c6d23dc8eccb824e9199ca027139a7da'
 OR md5(pg_get_functiondef('private.materialize_player_forge_wizard_savant_for_character_v1(uuid)'::regprocedure))<>'49594930f540d308b43ce00461462829'
 OR md5(pg_get_functiondef('private.materialize_player_forge_wizard_signature_for_character_v1(uuid)'::regprocedure))<>'02395e9d544ef6d5d1e6e5436d080294'
 OR md5(pg_get_functiondef('private.materialize_player_forge_wizard_final_v1()'::regprocedure))<>'3c71ad65cde45d74bef4ea63f25847ac'
 OR has_function_privilege('anon','private.apply_wizard_signature_spell_ids_v1(uuid,jsonb,text,text)','EXECUTE')
 OR has_function_privilege('authenticated','private.apply_wizard_signature_spell_ids_v1(uuid,jsonb,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'T16 Option A scope-only signature projection not safe/source-custodial'; END IF;
END $t16_safe_post$;
\echo 'PASS C34-T16 NON-ORIGINAL Option A signature helper: canonical sheet retained, unsafe cross-account write removed'
