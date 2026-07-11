-- The atomic player creator owns its progression insert. Avoid duplicate work from the compatibility sheet trigger.
create or replace function private.sync_character_progression_from_sheet_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_key text;
  v_source text;
  v_level integer;
  v_class_id uuid;
  v_xp bigint;
begin
  if coalesce(new.sheet->'meta'->>'creator','') = 'player_character_creator_v1' then
    return new;
  end if;

  v_key := lower(btrim(coalesce(new.sheet->>'classKey',new.sheet->'meta'->>'classKey','')));
  if v_key = '' or v_key = 'civilian' then return new; end if;
  v_source := upper(btrim(coalesce(new.sheet->>'rulesetSource',new.sheet->'meta'->>'rulesetSource','XPHB')));
  v_level := greatest(1,least(20,coalesce(nullif(new.sheet->>'level','')::integer,nullif(new.sheet->'meta'->>'level','')::integer,1)));

  select id into v_class_id from public.class_catalog where class_key=v_key and source=v_source limit 1;
  if v_class_id is null then
    select id into v_class_id from public.class_catalog
    where class_key=v_key
    order by case source when 'XPHB' then 0 when 'PHB' then 1 else 2 end
    limit 1;
  end if;
  if v_class_id is null then return new; end if;

  select experience_points into v_xp from public.character_progression where character_id=new.character_id;
  v_xp := coalesce(v_xp,public.xp_threshold_for_level_v1(v_level));
  insert into public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,updated_at)
  values(new.character_id,v_class_id,v_level,v_xp,v_level<20 and v_xp>=public.xp_threshold_for_level_v1(v_level+1),now())
  on conflict(character_id) do update set
    class_id=excluded.class_id,
    class_level=excluded.class_level,
    pending_level_up=excluded.pending_level_up,
    updated_at=now();
  return new;
exception when invalid_text_representation then
  return new;
end;
$$;
