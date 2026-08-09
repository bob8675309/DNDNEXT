-- Correct Memorize Spell getter runtime-state detection before deployment acceptance.
-- Preserve whether a prior Short-Rest swap receipt exists rather than relying on
-- PL/pgSQL's implicit FOUND flag across later work.

create or replace function public.get_character_wizard_memorize_spell_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb:=private.wizard_memorize_spell_context_v1(p_character_id);
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_latest_short_rest timestamptz;
  v_acquired_at timestamptz;
  v_can_configure boolean:=false;
  v_options jsonb:='{}'::jsonb;
  v_had_runtime boolean:=false;
begin
  if not private.can_manage_character_spell_resources_v1(p_character_id) then
    raise exception 'You do not have permission to review Memorize Spell for this character.' using errcode='42501';
  end if;
  if not coalesce((v_context->>'eligible')::boolean,false) then
    return jsonb_build_object('available',false,'featureName','Memorize Spell','source','XPHB');
  end if;
  begin v_acquired_at:=(v_context->>'acquiredAt')::timestamptz; exception when others then v_acquired_at:=null; end;
  select max(completed_at) into v_latest_short_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='short_rest';
  select * into v_runtime from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='wizard-memorize-spell';
  v_had_runtime:=found;
  v_can_configure:=v_latest_short_rest is not null
    and (v_acquired_at is null or v_latest_short_rest>v_acquired_at)
    and (not v_had_runtime or v_latest_short_rest>v_runtime.replacement_anchor_at);
  v_options:=private.wizard_memorize_spell_options_v1(p_character_id);
  return jsonb_build_object(
    'available',true,
    'featureName','Memorize Spell',
    'source','XPHB',
    'cadence','short_rest',
    'context',v_context,
    'latestShortRestAt',v_latest_short_rest,
    'canConfigure',v_can_configure,
    'lastSwap',case when v_had_runtime then v_runtime.state else '{}'::jsonb end,
    'preparedOptions',coalesce(v_options->'prepared','[]'::jsonb),
    'unpreparedOptions',coalesce(v_options->'unprepared','[]'::jsonb),
    'helper','After a qualifying Short Rest, replace one prepared level-1+ Wizard spell with another level-1+ spell from your actual spellbook. Spellbook membership does not change.'
  );
end;
$$;

revoke all on function public.get_character_wizard_memorize_spell_v1(uuid) from public,anon;
grant execute on function public.get_character_wizard_memorize_spell_v1(uuid) to authenticated,service_role;
