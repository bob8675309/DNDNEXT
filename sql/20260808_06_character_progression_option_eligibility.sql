-- Shared progression authority for General feats and Epic Boons.
-- The browser uses utils/characterProgressionResolver.js for previews; this
-- server function independently re-checks the current character before options
-- are exposed or later committed.

create or replace function private.character_has_progression_proficiency_v1(
  p_character_id uuid,
  p_class_id uuid,
  p_kind text,
  p_value text
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_class public.class_catalog%rowtype;
  v_wanted text := lower(btrim(coalesce(p_value,'')));
  v_values jsonb;
begin
  select * into v_class from public.class_catalog where id=p_class_id;
  if not found or v_wanted='' then return false; end if;
  if lower(coalesce(p_kind,''))='armor' then
    v_values := coalesce(v_class.raw_payload #> '{starting_proficiencies,armor}', '[]'::jsonb);
    if exists(select 1 from jsonb_array_elements_text(v_values) value where lower(btrim(value))=v_wanted) then return true; end if;
    if v_wanted='light' and exists(select 1 from public.character_option_grant_instances where character_id=p_character_id and lower(option_name)='lightly armored') then return true; end if;
    if v_wanted in ('medium','shield') and exists(select 1 from public.character_option_grant_instances where character_id=p_character_id and lower(option_name)='moderately armored') then return true; end if;
    if v_wanted='heavy' and exists(select 1 from public.character_option_grant_instances where character_id=p_character_id and lower(option_name)='heavily armored') then return true; end if;
    return false;
  end if;
  if lower(coalesce(p_kind,'')) in ('weapon','weapongroup') then
    v_values := coalesce(v_class.raw_payload #> '{starting_proficiencies,weapons}', '[]'::jsonb);
    if exists(select 1 from jsonb_array_elements_text(v_values) value where lower(btrim(value))=v_wanted) then return true; end if;
    if v_wanted='martial' and exists(select 1 from public.character_option_grant_instances where character_id=p_character_id and lower(option_name)='martial weapon training') then return true; end if;
    return false;
  end if;
  return false;
end;
$function$;

create or replace function private.character_option_prerequisites_met_v1(
  p_character_id uuid,
  p_option_id uuid,
  p_acquisition_level integer
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_option public.character_option_catalog%rowtype;
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_sheet jsonb := '{}'::jsonb;
  v_prereqs jsonb;
  v_alt jsonb;
  v_alt_ok boolean;
  v_key text;
  v_value jsonb;
  v_req jsonb;
  v_ability text;
  v_min integer;
  v_score integer;
  v_token text;
  v_name text;
  v_known_keys constant text[] := array['level','ability','spellcasting2020','spellcastingFeature','feature','proficiency','feat','background','race','campaign'];
begin
  select * into v_option from public.character_option_catalog where id=p_option_id and option_type in ('feat','boon');
  if not found then return false; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then return false; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id;
  v_prereqs := coalesce(v_option.metadata->'prerequisite','[]'::jsonb);
  if jsonb_typeof(v_prereqs)<>'array' then return false; end if;
  if jsonb_array_length(v_prereqs)=0 then return true; end if;

  for v_alt in select value from jsonb_array_elements(v_prereqs) loop
    if jsonb_typeof(v_alt)<>'object' then continue; end if;
    v_alt_ok := true;
    for v_key,v_value in select key,value from jsonb_each(v_alt) loop
      if not (v_key=any(v_known_keys)) then v_alt_ok:=false; exit; end if;
      if v_key='level' then
        if jsonb_typeof(v_value)='number' then
          if p_acquisition_level < (v_value #>> '{}')::integer then v_alt_ok:=false; exit; end if;
        elsif jsonb_typeof(v_value)='object' then
          if p_acquisition_level < coalesce((v_value->>'level')::integer,1) then v_alt_ok:=false; exit; end if;
          if nullif(v_value #>> '{class,name}','') is not null and lower(v_value #>> '{class,name}')<>lower(v_class.class_name) then v_alt_ok:=false; exit; end if;
        else v_alt_ok:=false; exit;
        end if;
      elsif v_key='ability' then
        if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if;
        for v_req in select value from jsonb_array_elements(v_value) loop
          for v_ability,v_value in select key,value from jsonb_each(v_req) loop
            if v_ability not in ('str','dex','con','int','wis','cha') then continue; end if;
            v_min := (v_value #>> '{}')::integer;
            begin v_score:=coalesce(nullif(v_sheet->'abilities'->v_ability->>'score','')::integer,nullif(v_sheet->'abilities'->>v_ability,'')::integer,10); exception when others then v_score:=10; end;
            if v_score<v_min then v_alt_ok:=false; exit; end if;
          end loop;
          exit when not v_alt_ok;
        end loop;
        exit when not v_alt_ok;
      elsif v_key in ('spellcasting2020','spellcastingFeature') then
        if coalesce((v_value #>> '{}')::boolean,false) and not (v_class.spellcasting_ability is not null or lower(coalesce(v_class.caster_progression,'')) like '%pact%' or lower(v_class.class_key)='warlock' or coalesce(v_sheet->'spellcasting'->>'ability','')<>'') then v_alt_ok:=false; exit; end if;
      elsif v_key='feature' then
        if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if;
        if not exists(
          select 1 from jsonb_array_elements_text(v_value) wanted
          where (lower(wanted) in ('spellcasting','pact magic') and (v_class.spellcasting_ability is not null or lower(v_class.class_key)='warlock'))
             or exists(select 1 from public.class_feature_catalog f where f.class_name=v_class.class_name and f.class_source=v_class.source and f.level<=p_acquisition_level and lower(f.name)=lower(wanted))
        ) then v_alt_ok:=false; exit; end if;
      elsif v_key='proficiency' then
        if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if;
        for v_req in select value from jsonb_array_elements(v_value) loop
          if nullif(v_req->>'armor','') is not null and not private.character_has_progression_proficiency_v1(p_character_id,v_class.id,'armor',v_req->>'armor') then v_alt_ok:=false; exit; end if;
          if nullif(v_req->>'weapon','') is not null and not private.character_has_progression_proficiency_v1(p_character_id,v_class.id,'weapon',v_req->>'weapon') then v_alt_ok:=false; exit; end if;
          if nullif(v_req->>'weaponGroup','') is not null and not private.character_has_progression_proficiency_v1(p_character_id,v_class.id,'weaponGroup',v_req->>'weaponGroup') then v_alt_ok:=false; exit; end if;
        end loop;
        exit when not v_alt_ok;
      elsif v_key='feat' then
        if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if;
        if not exists(
          select 1 from jsonb_array_elements_text(v_value) token
          where exists(
            select 1 from public.character_option_grant_instances gi
            where gi.character_id=p_character_id
              and private.normalize_player_choice_name_v1(gi.option_name)=private.normalize_player_choice_name_v1(split_part(token,'|',1))
          )
        ) then v_alt_ok:=false; exit; end if;
      elsif v_key='background' then
        if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if;
        if not exists(select 1 from jsonb_array_elements(v_value) req where private.normalize_player_choice_name_v1(req->>'name')=private.normalize_player_choice_name_v1(coalesce(v_sheet->>'background',v_sheet #>> '{meta,background}',''))) then v_alt_ok:=false; exit; end if;
      elsif v_key='race' then
        if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if;
        if not exists(select 1 from jsonb_array_elements(v_value) req where private.normalize_player_choice_name_v1(req->>'name')=private.normalize_player_choice_name_v1(coalesce(v_sheet->>'species',v_sheet->>'race',v_sheet #>> '{meta,species}',''))) then v_alt_ok:=false; exit; end if;
      elsif v_key='campaign' then
        if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if;
        if coalesce(v_sheet #>> '{meta,campaign}','')='' then v_alt_ok:=false; exit; end if;
        if not exists(select 1 from jsonb_array_elements_text(v_value) wanted where lower(wanted)=lower(v_sheet #>> '{meta,campaign}')) then v_alt_ok:=false; exit; end if;
      end if;
    end loop;
    if v_alt_ok then return true; end if;
  end loop;
  return false;
end;
$function$;

create or replace function public.get_character_level_advancement_options_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_progression public.character_progression%rowtype;
  v_next public.class_level_progression%rowtype;
  v_is_asi boolean := false;
  v_is_epic boolean := false;
  v_options jsonb := '[]'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review level-up choices.' using errcode='42501'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_progression.class_level>=20 then return jsonb_build_object('required',false,'options','[]'::jsonb); end if;
  select * into v_next from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level+1;
  v_is_asi := private.level_has_feature_v1(v_next.features,'Ability Score Improvement');
  v_is_epic := private.level_has_feature_v1(v_next.features,'Epic Boon');
  if not v_is_asi and not v_is_epic then return jsonb_build_object('required',false,'level',v_next.class_level,'options','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'option_key',o.option_key,'option_type',o.option_type,'name',o.name,'source',o.source,'category',o.category,
    'description',o.description,'prerequisite_text',o.prerequisite_text,'metadata',o.metadata
  ) order by case when o.option_type='boon' then 0 else 1 end,o.name),'[]'::jsonb)
  into v_options
  from public.character_option_catalog_preferred o
  where ((v_is_asi and o.option_type='feat' and o.category='G')
      or (v_is_epic and ((o.option_type='boon' and o.category='EB') or (o.option_type='feat' and o.category='G'))))
    and private.character_option_prerequisites_met_v1(p_character_id,o.id,v_next.class_level)
    and (coalesce((o.metadata->>'repeatable')::boolean,false) or not exists(select 1 from public.character_option_grant_instances gi where gi.character_id=p_character_id and gi.option_id=o.id));
  return jsonb_build_object('required',true,'kind',case when v_is_epic then 'epic-boon' else 'feat' end,'level',v_next.class_level,'options',v_options);
end;
$function$;

grant execute on function public.get_character_level_advancement_options_v1(uuid) to authenticated;
