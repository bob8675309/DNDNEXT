-- Fail closed for persistent class decisions that are not yet part of the v3
-- transaction.  Several 2024 progressions increase a cumulative choice count
-- without repeating the original feature row (notably Warlock Invocations), so
-- relying only on the next row's feature names can silently skip required state.

create or replace function private.level_up_persistent_choice_gaps_v1(
  p_class_key text,
  p_class_source text,
  p_from_level integer,
  p_to_level integer
)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog'
as $function$
declare
  v_class text := lower(btrim(coalesce(p_class_key,'')));
  v_source text := upper(btrim(coalesce(p_class_source,'')));
  v_from integer := greatest(1,coalesce(p_from_level,1));
  v_to integer := greatest(1,coalesce(p_to_level,1));
  v_out jsonb := '[]'::jsonb;
  v_warlock_before integer := 0;
  v_warlock_after integer := 0;
  v_meta_before integer := 0;
  v_meta_after integer := 0;
begin
  if v_source <> 'XPHB' or v_to <> v_from + 1 then return v_out; end if;

  if v_class='barbarian' and v_to=3 then
    v_out:=v_out||jsonb_build_array('Primal Knowledge skill');
  elsif v_class='bard' then
    if v_to=2 or v_to=9 then v_out:=v_out||jsonb_build_array('Expertise delta'); end if;
    if v_to=10 then v_out:=v_out||jsonb_build_array('Magical Secrets spell access'); end if;
  elsif v_class='cleric' and v_to=7 then
    v_out:=v_out||jsonb_build_array('Blessed Strikes choice');
  elsif v_class='druid' and v_to=7 then
    v_out:=v_out||jsonb_build_array('Elemental Fury choice');
  elsif v_class='paladin' and v_to=2 then
    v_out:=v_out||jsonb_build_array('Fighting Style');
  elsif v_class='ranger' then
    if v_to=2 then
      v_out:=v_out||jsonb_build_array('Fighting Style','Deft Explorer Expertise','Deft Explorer languages');
    elsif v_to=9 then
      v_out:=v_out||jsonb_build_array('Expertise delta');
    end if;
  elsif v_class='rogue' and v_to=6 then
    v_out:=v_out||jsonb_build_array('Expertise delta');
  elsif v_class='sorcerer' then
    v_meta_before:=case when v_from>=17 then 6 when v_from>=10 then 4 when v_from>=2 then 2 else 0 end;
    v_meta_after:=case when v_to>=17 then 6 when v_to>=10 then 4 when v_to>=2 then 2 else 0 end;
    if v_meta_after>v_meta_before then
      v_out:=v_out||jsonb_build_array('Metamagic +'||(v_meta_after-v_meta_before)::text);
    end if;
  elsif v_class='warlock' then
    v_warlock_before:=case
      when v_from>=18 then 10 when v_from>=15 then 9 when v_from>=12 then 8 when v_from>=9 then 7
      when v_from>=7 then 6 when v_from>=5 then 5 when v_from>=2 then 3 else 1 end;
    v_warlock_after:=case
      when v_to>=18 then 10 when v_to>=15 then 9 when v_to>=12 then 8 when v_to>=9 then 7
      when v_to>=7 then 6 when v_to>=5 then 5 when v_to>=2 then 3 else 1 end;
    if v_warlock_after>v_warlock_before then
      v_out:=v_out||jsonb_build_array('Eldritch Invocations +'||(v_warlock_after-v_warlock_before)::text);
    end if;
    if v_to in (11,13,15,17) then
      v_out:=v_out||jsonb_build_array('Mystic Arcanum level '||(case v_to when 11 then 6 when 13 then 7 when 15 then 8 else 9 end)::text);
    end if;
  elsif v_class='wizard' and v_to=2 then
    v_out:=v_out||jsonb_build_array('Scholar Expertise');
  end if;

  return v_out;
end;
$function$;

create or replace function public.get_character_level_choice_gaps_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_gaps jsonb := '[]'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review this character.' using errcode='42501';
  end if;
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_progression.class_level>=20 then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  v_gaps:=private.level_up_persistent_choice_gaps_v1(v_class.class_key,v_class.source,v_progression.class_level,v_progression.class_level+1);
  return v_gaps;
end;
$function$;

grant execute on function public.get_character_level_choice_gaps_v1(uuid) to authenticated;
