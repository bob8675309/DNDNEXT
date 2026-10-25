\set ON_ERROR_STOP on
-- Extends the #257–#264 disposable PostgreSQL fixture. Not production data.
do $test$
declare
 c uuid:='aaaaaaaa-0000-4000-8000-000000000001';
 other uuid:='aaaaaaaa-0000-4000-8000-000000000002';
 item uuid:='dddddddd-0000-4000-8000-000000000005';
 first_id uuid:='88888888-0000-4000-8000-000000000001';
 second_id uuid:='88888888-0000-4000-8000-000000000003';
 reason text:='The DM verified contact and uninterrupted focus after separate item identification.';
 v jsonb;
 old_rests int;
 old_bonds int;
 expected_rest uuid;
 blocked boolean;
begin
 perform set_config('fixture.uid','bbbbbbbb-0000-4000-8000-000000000001',true);
 select count(*) into old_rests from public.character_rest_log;
 select count(*) into old_bonds from public.character_item_attunements;
 select rest_log_id into expected_rest from private.attunement_focus_rest_links_v1 where attempt_id=first_id;
 if expected_rest is null then raise exception 'Canonical rest link missing'; end if;
 perform set_config('fixture.uid','bbbbbbbb-0000-4000-8000-000000000002',true);
 blocked:=false;
 begin
  perform private.review_attunement_focused_rest_v1(c,first_id,'approve',true,true,true,reason);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Player forged GM approval'; end if;
 perform set_config('fixture.uid','',true);
 blocked:=false;
 begin
  perform private.review_attunement_focused_rest_v1(c,first_id,'approve',true,true,true,reason);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Service without admin principal forged GM approval'; end if;
 perform set_config('fixture.uid','bbbbbbbb-0000-4000-8000-000000000001',true);
 blocked:=false;
 begin
  perform private.review_attunement_focused_rest_v1(c,first_id,'approve',true,false,true,reason);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'GM approved interrupted attempt'; end if;
 blocked:=false;
 begin
  perform private.review_attunement_focused_rest_v1(c,first_id,'approve',true,true,false,reason);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'GM approved same-rest identification'; end if;
 blocked:=false;
 begin
  perform private.review_attunement_focused_rest_v1(c,first_id,'approve',true,true,true,'short');
 exception when invalid_parameter_value then blocked:=true; end;
 if not blocked then raise exception 'GM approved without accountable note'; end if;
 blocked:=false;
 begin
  perform private.review_attunement_focused_rest_v1(other,first_id,'approve',true,true,true,reason);
 exception when no_data_found then blocked:=true; end;
 if not blocked then raise exception 'Foreign character used a rest link'; end if;
 insert into public.test_active_encounters values(c);
 blocked:=false;
 begin
  perform private.review_attunement_focused_rest_v1(c,first_id,'approve',true,true,true,reason);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Review succeeded during active encounter'; end if;
 delete from public.test_active_encounters where character_id=c;
 v:=private.review_attunement_focused_rest_v1(c,first_id,'approve',true,true,true,reason);
 if v->>'reviewState'<>'gm_decision_recorded' or v->>'decision'<>'approve'
    or (v->>'restLogId')::uuid<>expected_rest or v->>'replayed'<>'false'
    or v->>'attunementReady'<>'false' or v->>'canCreateBond'<>'false'
 then raise exception 'GM review failed closed-state contract %',v; end if;
 if not exists(select 1 from private.attunement_focus_gm_reviews_v1
   where attempt_id=first_id and rest_log_id=expected_rest and character_id=c
     and inventory_item_id=item and decision='approve'
     and reviewed_by='bbbbbbbb-0000-4000-8000-000000000001'
     and contact_confirmed and uninterrupted_confirmed
     and identification_separate_confirmed)
 then raise exception 'GM review audit record mismatched source'; end if;
 v:=private.review_attunement_focused_rest_v1(c,first_id,'approve',true,true,true,reason);
 if v->>'replayed'<>'true' then raise exception 'Review replay was not idempotent'; end if;
 blocked:=false;
 begin
  perform private.review_attunement_focused_rest_v1(c,first_id,'reject',false,false,false,reason);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Approved GM decision was overwritten'; end if;
 blocked:=false;
 begin
  perform private.review_attunement_focused_rest_v1(c,first_id,'approve',true,true,true,reason||' Later changed.');
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Immutable GM reason was overwritten'; end if;
 v:=private.begin_attunement_world_focus_v1(c,item,second_id);
 update public.world_state set world_time=world_time+interval '61 minutes' where id=1;
 v:=private.record_attunement_focused_short_rest_v1(c,second_id);
 if v->>'status'<>'rest_logged_unverified' then raise exception 'Second canonical rest missing %',v; end if;
 v:=private.review_attunement_focused_rest_v1(c,second_id,'reject',false,false,false,
  'The DM observed an interruption and rejected the item focus.');
 if v->>'decision'<>'reject' or v->>'attunementReady'<>'false'
 then raise exception 'Rejected GM decision incorrectly authorized magic %',v; end if;
 if (select count(*) from private.attunement_focus_gm_reviews_v1)<>2
 then raise exception 'Duplicate GM reviews stored'; end if;
 -- Critical case: transferred away AND returned before final approval.
 update public.inventory_items set owner_id=other::text where id=item;
 if (select count(*) from private.attunement_focus_sessions_v1
   where inventory_item_id=item and status='invalidated')<>2
 then raise exception 'Transfer failed to invalidate both completed attempts'; end if;
 update public.inventory_items set owner_id=c::text where id=item;
 v:=private.inspect_attunement_world_focus_v1(c,first_id);
 if v->>'status'='rest_logged_unverified'
 then raise exception 'Transfer out and back resurrected focus %',v; end if;
 v:=private.review_attunement_focused_rest_v1(c,first_id,'approve',true,true,true,reason);
 if v->>'replayed'<>'true' or v->>'currentFocusStatus'<>'invalidated'
    or v->>'canCreateBond'<>'false'
 then raise exception 'Historical GM review replay authorized current effect %',v; end if;
 if (select count(*) from public.character_item_attunements)<>old_bonds
 then raise exception 'GM adjudication wrote an attunement bond'; end if;
 if (select count(*) from public.character_rest_log)<>old_rests+1
 then raise exception 'GM review wrote a counterfeit rest'; end if;
 if has_function_privilege('authenticated',
 'private.review_attunement_focused_rest_v1(uuid,uuid,text,boolean,boolean,boolean,text)','EXECUTE')
 or has_function_privilege('anon',
 'private.review_attunement_focused_rest_v1(uuid,uuid,text,boolean,boolean,boolean,text)','EXECUTE')
 or has_table_privilege('authenticated','private.attunement_focus_gm_reviews_v1','INSERT')
 or has_table_privilege('service_role','private.attunement_focus_gm_reviews_v1','UPDATE')
 then raise exception 'Private review function/table grants unsafe'; end if;
end $test$;
select 'Trusted DM review audit, negative review and custody invalidation passed' as result;
