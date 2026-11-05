-- EXACT ORIGINAL DnDWeb PG17 sources captured read-only 2026-11-05.
-- Disposable authenticated PR #317 fixture only. NEVER APPLY LIVE.

-- md5(pg_get_functiondef) private.current_user_is_admin() = 1fc5fbcb121b2862eeab869edfb3a209
CREATE OR REPLACE FUNCTION private.current_user_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles AS up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
    );
$function$;

-- md5(pg_get_functiondef) private.guard_direct_character_authority_mutation_v1() = 04596b0a3fdfb71c1b357056e8c6023b
CREATE OR REPLACE FUNCTION private.guard_direct_character_authority_mutation_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_key text;
  v_protected_sheet_keys constant text[] := array['feats','boons','epicBoons','spells','startingSpellChoices','spellbook','knownSpells','preparedSpells','featsTraits','speciesTraitChoices','speciesSkillChoices','speciesChoiceFeats','speciesSpells','speciesSpellcasting','classFeatureChoices','classFeatureChoiceSummary','classChoiceFeats','sourceChoices','sourceChoiceSummary','featGrantInstances','featSpellChoices','weaponMasteries','expertiseSkills'];
  v_protected_meta_keys constant text[] := array['originFeat','backgroundFeatChoice','speciesBonusFeat','speciesTraitChoices','speciesSkillChoices','speciesChoiceFeats','speciesChoiceFeat','classFeatureChoices','classFeatureChoiceSummary','classChoiceFeats','sourceChoices','sourceChoiceSummary','featGrantInstances','featSpellChoices','weaponMasteries','expertiseSkills'];
begin
  if current_user not in ('anon','authenticated') or coalesce(private.current_user_is_admin(),false) then if tg_op='DELETE' then return old; end if; return new; end if;
  if tg_table_name='character_spells' then raise exception 'Players cannot directly add, change, or remove authoritative character spells.' using errcode='42501'; end if;
  if tg_table_name in ('character_option_grants','character_option_grant_instances') then raise exception 'Players cannot directly grant, instance, change, or remove feats and boons.' using errcode='42501'; end if;
  if tg_table_name='character_sheets' then
    if tg_op='INSERT' then
      foreach v_key in array v_protected_sheet_keys loop if new.sheet ? v_key and new.sheet -> v_key not in ('null'::jsonb,'[]'::jsonb,'{}'::jsonb,'""'::jsonb) then raise exception 'Authoritative character feature, source-choice, and spell fields must be written through a guarded creation or progression RPC.' using errcode='42501'; end if; end loop;
      foreach v_key in array v_protected_meta_keys loop if new.sheet #> array['meta',v_key] is not null and new.sheet #> array['meta',v_key] not in ('null'::jsonb,'[]'::jsonb,'{}'::jsonb,'""'::jsonb) then raise exception 'Authoritative character feature metadata must be written through a guarded creation or progression RPC.' using errcode='42501'; end if; end loop;
      return new;
    end if;
    if tg_op='UPDATE' then
      foreach v_key in array v_protected_sheet_keys loop if old.sheet -> v_key is distinct from new.sheet -> v_key then raise exception 'Players cannot directly change authoritative feats, source choices, boons, or spells on a character sheet.' using errcode='42501'; end if; end loop;
      foreach v_key in array v_protected_meta_keys loop if old.sheet #> array['meta',v_key] is distinct from new.sheet #> array['meta',v_key] then raise exception 'Players cannot directly change authoritative source-choice or feat metadata on a character sheet.' using errcode='42501'; end if; end loop;
      return new;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;

-- md5(pg_get_functiondef) private.sync_admin_feature_array_v1(p_character_id uuid, p_option_type text, p_name text, p_add boolean) = f2b6190ecc9400772e054892f63cdc47
CREATE OR REPLACE FUNCTION private.sync_admin_feature_array_v1(p_character_id uuid, p_option_type text, p_name text, p_add boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_path text[];
  v_sheet jsonb;
  v_values jsonb;
begin
  v_path := case when p_option_type='boon' then array['adminGrantedBoons'] else array['adminGrantedFeats'] end;
  select sheet into v_sheet from public.character_sheets where character_id=p_character_id for update;
  if not found then return; end if;
  v_sheet := coalesce(v_sheet,'{}'::jsonb);
  v_values := coalesce(v_sheet #> v_path,'[]'::jsonb);
  if jsonb_typeof(v_values)<>'array' then v_values:='[]'::jsonb; end if;

  if p_add then
    if not exists(select 1 from jsonb_array_elements_text(v_values) value where lower(value)=lower(p_name)) then
      v_values := v_values || to_jsonb(p_name);
    end if;
  else
    select coalesce(jsonb_agg(value),'[]'::jsonb) into v_values
    from jsonb_array_elements_text(v_values) value
    where lower(value)<>lower(p_name);
  end if;

  v_sheet := jsonb_set(v_sheet,v_path,v_values,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in (select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
end;
$function$;

-- md5(pg_get_functiondef) public.grant_character_option_v1(p_character_id uuid, p_option_id uuid, p_notes text) = aa0f6a0c6c6a6f2b9aacf57bd40e434c
CREATE OR REPLACE FUNCTION public.grant_character_option_v1(p_character_id uuid, p_option_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_option public.character_option_catalog%rowtype;
  v_grant public.character_option_grants%rowtype;
begin
  if not coalesce(public.is_admin(),false) then
    raise exception 'Admin access is required to grant feats or boons.' using errcode='42501';
  end if;
  if not exists(select 1 from public.characters where id=p_character_id) then
    raise exception 'Character not found.' using errcode='P0002';
  end if;
  select * into v_option from public.character_option_catalog where id=p_option_id;
  if v_option.id is null or v_option.option_type not in ('feat','boon') then
    raise exception 'Choose a feat or boon from the catalog.';
  end if;

  insert into public.character_option_grants(character_id,option_id,notes,granted_by,updated_at)
  values(p_character_id,p_option_id,nullif(btrim(coalesce(p_notes,'')),''),auth.uid(),now())
  on conflict(character_id,option_id) do update set
    notes=excluded.notes,
    granted_by=auth.uid(),
    updated_at=now()
  returning * into v_grant;

  perform private.sync_admin_feature_array_v1(p_character_id,v_option.option_type,v_option.name,true);
  return jsonb_build_object('grant',to_jsonb(v_grant),'option',to_jsonb(v_option));
end;
$function$;

-- md5(pg_get_functiondef) public.is_admin() = 629e70fee675bf18f353a19d807e4416
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  SELECT private.current_user_is_admin();
$function$;
