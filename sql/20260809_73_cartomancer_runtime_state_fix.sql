-- Correct Cartomancer getter state detection before deployment acceptance.
-- Preserve whether the Hidden Ace runtime row exists before later SELECT statements
-- overwrite PL/pgSQL's implicit FOUND flag.

create or replace function public.get_character_cartomancer_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_grant public.character_option_grant_instances%rowtype;
  v_context jsonb:=private.cartomancer_character_context_v1(p_character_id);
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_feature_key text;
  v_latest_long_rest timestamptz;
  v_expires_at timestamptz;
  v_active boolean:=false;
  v_can_configure boolean:=false;
  v_prestidigitation boolean:=false;
  v_options jsonb:='[]'::jsonb;
  v_had_runtime boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Cartomancer for this character.' using errcode='42501';
  end if;

  select * into v_grant from public.character_option_grant_instances
  where character_id=p_character_id and private.cartomancer_family_v1(option_name,option_source)
  order by acquisition_level nulls first,instance_key limit 1;
  if not found then
    return jsonb_build_object('available',false,'featureName','Cartomancer','source','BMT','options','[]'::jsonb);
  end if;

  v_feature_key:=private.cartomancer_feature_key_v1(v_grant.instance_key);
  select * into v_runtime from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key=v_feature_key;
  v_had_runtime:=found;

  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log where character_id=p_character_id and rest_type='long_rest';

  if v_had_runtime then
    begin v_expires_at:=(v_runtime.state->>'expiresAt')::timestamptz; exception when others then v_expires_at:=null; end;
    v_active:=coalesce((v_runtime.state->>'configured')::boolean,false)
      and not coalesce((v_runtime.state->>'consumed')::boolean,false)
      and v_expires_at is not null and v_expires_at>now();
    v_can_configure:=v_latest_long_rest is not null
      and v_latest_long_rest>v_runtime.replacement_anchor_at
      and v_latest_long_rest+interval '8 hours'>now();
  else
    v_can_configure:=v_latest_long_rest is not null
      and v_latest_long_rest>v_grant.created_at
      and v_latest_long_rest+interval '8 hours'>now();
  end if;

  select exists(
    select 1 from public.character_spells cs join public.spells_catalog s on s.id=cs.spell_id
    where cs.character_id=p_character_id and cs.source_type='feat' and cs.source_key=v_grant.instance_key
      and private.normalize_player_choice_name_v1(s.name)=private.normalize_player_choice_name_v1('Prestidigitation')
  ) into v_prestidigitation;
  v_options:=private.cartomancer_hidden_ace_spell_options_v1(p_character_id);

  return jsonb_build_object(
    'available',true,
    'featureName','Cartomancer',
    'source','BMT',
    'instanceKey',v_grant.instance_key,
    'class',v_context,
    'cardTricksPrestidigitation',v_prestidigitation,
    'hiddenAceConfigured',v_had_runtime,
    'hiddenAceActive',v_active,
    'hiddenAceExpired',v_had_runtime and not v_active and not coalesce((v_runtime.state->>'consumed')::boolean,false),
    'canConfigureHiddenAce',v_can_configure,
    'latestLongRestAt',v_latest_long_rest,
    'state',case when v_had_runtime then v_runtime.state else '{}'::jsonb end,
    'options',v_options,
    'actionIntegration','deferred',
    'helper','Hidden Ace is chosen after a Long Rest, must be a 1-Action spell from your class list at a level for which you have spell slots, and remains imbued for 8 hours. Bonus Action casting/consumption is not wired in this non-combat slice.'
  );
end;
$$;

revoke all on function public.get_character_cartomancer_v1(uuid) from public,anon;
grant execute on function public.get_character_cartomancer_v1(uuid) to authenticated,service_role;
