-- Complete the shared equipment-effects integration for tactical weapon math.
-- Migration 03 establishes the resolver; this migration preserves idempotent
-- compatibility while routing direct ability-modifier bonuses into attacks.

do $migration$
declare
  v_definition text;
  v_anchor text;
  v_replacement text;
  v_occurrences integer;
begin
  -- Harden the public read wrapper so a NULL permission result never grants access.
  create or replace function public.character_equipment_effects_v1(p_character_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to 'pg_catalog','public','private','auth'
  as $function$
  begin
    if p_character_id is null then raise exception 'Character is required'; end if;
    if coalesce(auth.role(),'')<>'service_role'
       and not coalesce(private.current_user_is_admin(),false)
       and not coalesce(private.can_access_character_v1(p_character_id,'read'),false) then
      raise exception 'Not authorized to view character equipment effects' using errcode='42501';
    end if;
    return private.character_equipment_effects_v1(p_character_id);
  end;
  $function$;

  revoke all on function public.character_equipment_effects_v1(uuid) from public,anon;
  grant execute on function public.character_equipment_effects_v1(uuid) to authenticated,service_role;

  -- Preserve existing snapshot keys and add effective modifiers for consumers
  -- that must not reconstruct them from adjusted scores.
  create or replace function public.encounter_canonical_combat_snapshot_v1(p_character_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to 'pg_catalog','public','private','auth'
  as $function$
  declare
    v_sheet jsonb:='{}'::jsonb;
    v_effects jsonb:='{}'::jsonb;
    v_prof integer:=2;
    v_hp integer:=1;
  begin
    if p_character_id is null then
      return jsonb_build_object('str',10,'dex',10,'strMod',0,'dexMod',0,'prof',2,'ac',10,'hp',1);
    end if;
    select coalesce(cs.sheet,'{}'::jsonb)
    into v_sheet
    from public.character_sheets cs
    where cs.character_id=p_character_id;
    begin v_prof:=coalesce(nullif(v_sheet->>'proficiencyBonus','')::integer,2); exception when others then v_prof:=2; end;
    begin v_hp:=coalesce(nullif(v_sheet->>'hp','')::integer,nullif(v_sheet->>'maxHp','')::integer,1); exception when others then v_hp:=1; end;
    v_effects:=private.character_equipment_effects_v1(p_character_id);
    return jsonb_build_object(
      'str',coalesce((v_effects#>>'{abilities,str,effectiveScore}')::integer,10),
      'dex',coalesce((v_effects#>>'{abilities,dex,effectiveScore}')::integer,10),
      'strMod',coalesce((v_effects#>>'{abilities,str,effectiveMod}')::integer,0),
      'dexMod',coalesce((v_effects#>>'{abilities,dex,effectiveMod}')::integer,0),
      'prof',v_prof,
      'ac',coalesce((v_effects#>>'{ac,total}')::integer,10),
      'hp',v_hp
    );
  end;
  $function$;

  select pg_get_functiondef('public.encounter_weapon_profile_internal_v1(uuid,uuid)'::regprocedure)
  into v_definition;

  v_anchor := $anchor$  v_str integer := 10;
  v_dex integer := 10;
  v_prof_bonus integer := 2;$anchor$;
  v_replacement := $replacement$  v_str integer := 10;
  v_dex integer := 10;
  v_str_mod integer := 0;
  v_dex_mod integer := 0;
  v_prof_bonus integer := 2;$replacement$;
  v_occurrences := (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor);
  if v_occurrences<>1 then raise exception 'Weapon profile modifier declaration anchor mismatch: %',v_occurrences; end if;
  v_definition:=replace(v_definition,v_anchor,v_replacement);

  v_anchor := $anchor$  v_str := coalesce((v_snapshot->>'str')::integer,10);
  v_dex := coalesce((v_snapshot->>'dex')::integer,10);
  v_prof_bonus := coalesce((v_snapshot->>'prof')::integer,2);$anchor$;
  v_replacement := $replacement$  v_str := coalesce((v_snapshot->>'str')::integer,10);
  v_dex := coalesce((v_snapshot->>'dex')::integer,10);
  v_str_mod := coalesce((v_snapshot->>'strMod')::integer,floor((v_str-10)/2.0)::integer);
  v_dex_mod := coalesce((v_snapshot->>'dexMod')::integer,floor((v_dex-10)/2.0)::integer);
  v_prof_bonus := coalesce((v_snapshot->>'prof')::integer,2);$replacement$;
  v_occurrences := (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor);
  if v_occurrences<>1 then raise exception 'Weapon profile snapshot anchor mismatch: %',v_occurrences; end if;
  v_definition:=replace(v_definition,v_anchor,v_replacement);

  v_anchor := $anchor$  if v_is_ranged then
    v_ability := 'dex';
    v_ability_mod := floor((v_dex-10)/2.0)::integer;
  elsif v_is_finesse and v_dex > v_str then
    v_ability := 'dex';
    v_ability_mod := floor((v_dex-10)/2.0)::integer;
  else
    v_ability := 'str';
    v_ability_mod := floor((v_str-10)/2.0)::integer;
  end if;$anchor$;
  v_replacement := $replacement$  if v_is_ranged then
    v_ability := 'dex';
    v_ability_mod := v_dex_mod;
  elsif v_is_finesse and v_dex_mod > v_str_mod then
    v_ability := 'dex';
    v_ability_mod := v_dex_mod;
  else
    v_ability := 'str';
    v_ability_mod := v_str_mod;
  end if;$replacement$;
  v_occurrences := (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor);
  if v_occurrences<>1 then raise exception 'Weapon profile ability anchor mismatch: %',v_occurrences; end if;
  v_definition:=replace(v_definition,v_anchor,v_replacement);

  execute v_definition;
end;
$migration$;
