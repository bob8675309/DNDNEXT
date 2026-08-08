-- After v4 applies required new Invocation slots, project the final normalized set back to the sheet.
-- This keeps sheet.eldritchInvocations aligned when a level contains both retraining and a new slot.

create or replace function private.sync_character_eldritch_invocations_v1(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_class_key text;
  v_class_source text;
  v_sheet jsonb:='{}'::jsonb;
  v_names jsonb:='[]'::jsonb;
begin
  select lower(coalesce(c.class_key,'')),upper(coalesce(c.source,''))
  into v_class_key,v_class_source
  from public.character_progression p
  join public.class_catalog c on c.id=p.class_id
  where p.character_id=p_character_id;
  if not found or v_class_key<>'warlock' or v_class_source<>'XPHB' then return; end if;

  select coalesce(jsonb_agg(o.name order by g.instance_key),'[]'::jsonb)
  into v_names
  from public.character_class_option_grant_instances g
  join public.class_feature_option_catalog o on o.id=g.option_catalog_id
  where g.character_id=p_character_id and g.option_type='eldritch-invocation';

  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id for update;
  if not found then raise exception 'Character sheet is unavailable.'; end if;
  v_sheet:=jsonb_set(v_sheet,'{eldritchInvocations}',v_names,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
end;
$$;

create or replace function public.complete_character_level_up_v5(p_character_id uuid,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_input jsonb:=coalesce(p_selections,'{}'::jsonb);
  v_progression public.character_progression%rowtype;
  v_to integer;
  v_replacements jsonb:=coalesce(v_input->'replacement_selections','{}'::jsonb);
  v_all_class jsonb:=coalesce(v_input->'class_choice_selections','{}'::jsonb);
  v_invocation_replacement jsonb:=coalesce(v_all_class->'warlock-invocation-replacement','{}'::jsonb);
  v_forward_class jsonb:=v_all_class-'warlock-invocation-replacement';
  v_feat_instances jsonb:=coalesce(v_input->'class_option_feat_instances','[]'::jsonb);
  v_invocation_summary jsonb:='[]'::jsonb;
  v_standard_summary jsonb:='[]'::jsonb;
  v_summary jsonb:='[]'::jsonb;
  v_result jsonb;
  v_forward_input jsonb;
  v_level_choice jsonb:='{}'::jsonb;
  v_session_id uuid;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  if jsonb_typeof(v_input)<>'object' or jsonb_typeof(v_replacements)<>'object' or jsonb_typeof(v_all_class)<>'object' or jsonb_typeof(v_feat_instances)<>'array' then
    raise exception 'Level-up selections, class choices, replacement selections, and class-option feat instances have an invalid shape.';
  end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found or v_progression.class_level>=20 then raise exception 'Character progression is unavailable for another level.'; end if;
  v_to:=v_progression.class_level+1;

  v_invocation_summary:=private.apply_level_up_warlock_invocation_replacement_v2(
    p_character_id,v_to,v_invocation_replacement,v_all_class,v_feat_instances
  );
  v_standard_summary:=private.apply_level_up_replacements_v1(p_character_id,v_to,v_replacements);
  v_summary:=coalesce(v_invocation_summary,'[]'::jsonb)||coalesce(v_standard_summary,'[]'::jsonb);

  v_forward_input:=jsonb_set(v_input,'{class_choice_selections}',v_forward_class,true);
  v_result:=public.complete_character_level_up_v4(p_character_id,v_forward_input-'replacement_selections');
  perform private.sync_character_eldritch_invocations_v1(p_character_id);

  if jsonb_array_length(v_summary)>0 then
    select coalesce(level_choices->v_to::text,'{}'::jsonb) into v_level_choice from public.character_progression where character_id=p_character_id;
    v_level_choice:=v_level_choice||jsonb_build_object('replacements',v_summary);
    update public.character_progression
    set level_choices=jsonb_set(coalesce(level_choices,'{}'::jsonb),array[v_to::text],v_level_choice,true),updated_at=now()
    where character_id=p_character_id;

    select id into v_session_id from public.character_level_up_sessions
    where character_id=p_character_id and to_level=v_to and status='completed'
    order by completed_at desc limit 1;
    if v_session_id is not null then
      update public.character_level_up_sessions
      set selections=coalesce(selections,'{}'::jsonb)||jsonb_build_object(
        'replacement_selections',v_replacements,
        'invocation_replacement_selection',v_invocation_replacement,
        'replacements',v_summary
      ),updated_at=now()
      where id=v_session_id;
    end if;

    update public.character_level_events
    set details=coalesce(details,'{}'::jsonb)||jsonb_build_object('replacements',v_summary)
    where id=(select id from public.character_level_events where character_id=p_character_id and event_type='level_up_completed' and to_level=v_to order by created_at desc limit 1);
  end if;

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('replacements',v_summary,'progression',public.get_character_progression_v1(p_character_id));
end;
$$;

revoke all on function private.sync_character_eldritch_invocations_v1(uuid) from public,anon,authenticated;
revoke all on function public.complete_character_level_up_v5(uuid,jsonb) from public,anon;
grant execute on function private.sync_character_eldritch_invocations_v1(uuid) to service_role;
grant execute on function public.complete_character_level_up_v5(uuid,jsonb) to authenticated,service_role;
