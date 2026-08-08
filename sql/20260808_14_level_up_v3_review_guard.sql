-- v3 review wrapper: retain the reviewed v1 preview, then fail closed when the
-- next level contains a persistent class-choice delta not yet represented by
-- the transactional v3 payload. This is intentionally separate from runtime /
-- rest-reconfigurable choices such as Weapon Mastery.

create or replace function public.begin_character_level_up_v3(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_result jsonb;
  v_preview jsonb;
  v_gaps jsonb := '[]'::jsonb;
  v_reason text;
  v_session_id uuid;
begin
  v_result := public.begin_character_level_up_v1(p_character_id);
  v_preview := coalesce(v_result->'preview','{}'::jsonb);
  v_gaps := public.get_character_level_choice_gaps_v1(p_character_id);
  if jsonb_typeof(v_gaps)='array' and jsonb_array_length(v_gaps)>0 then
    v_reason := 'This level has persistent class choices that are being migrated to the shared progression resolver: '
      || (select string_agg(value, ', ') from jsonb_array_elements_text(v_gaps));
    v_preview := v_preview || jsonb_build_object(
      'persistentChoiceGaps',v_gaps,
      'metadataReady',false,
      'blockedReason',v_reason
    );
    begin v_session_id := (v_result #>> '{session,id}')::uuid; exception when others then v_session_id := null; end;
    if v_session_id is not null then
      update public.character_level_up_sessions
      set metadata_ready=false, preview=v_preview, updated_at=now()
      where id=v_session_id;
      select to_jsonb(s) into v_result
      from public.character_level_up_sessions s where s.id=v_session_id;
      return jsonb_build_object(
        'session',v_result,
        'preview',v_preview,
        'metadataReady',false,
        'canComplete',false,
        'message',v_reason
      );
    end if;
  end if;
  return v_result || jsonb_build_object('persistentChoiceGaps',v_gaps);
end;
$function$;

revoke all on function public.begin_character_level_up_v3(uuid) from public,anon;
grant execute on function public.begin_character_level_up_v3(uuid) to authenticated;
