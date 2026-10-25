\set ON_ERROR_STOP on
-- Extend the disposable #257/#260/#261 fixture schema, not production.
create table public.class_catalog(id uuid primary key,class_key text not null);
create table public.character_progression(character_id uuid,class_id uuid,class_level integer);
create table public.character_rest_log(id uuid primary key,character_id uuid,rest_type text,details jsonb,completed_at timestamptz);
insert into public.class_catalog values
('66666666-0000-4000-8000-000000000001','fighter'),
('66666666-0000-4000-8000-000000000002','wizard');
do $test$
declare
 c uuid:='aaaaaaaa-0000-4000-8000-000000000001';
 other uuid:='aaaaaaaa-0000-4000-8000-000000000002';
 staff uuid:='dddddddd-0000-4000-8000-000000000002';
 boots uuid:='eeeeeeee-0000-4000-8000-000000000001';
 v jsonb;
begin
 v:=private.attunement_rest_class_evidence_v1(c,staff);
 if v->>'classPrerequisiteStatus'<>'class_source_missing'
  or v->>'shortRestEvidenceVerified'<>'false'
 then raise exception 'Missing class/rest must not qualify %',v; end if;
 insert into public.character_progression values(c,'66666666-0000-4000-8000-000000000001',5);
 v:=private.attunement_rest_class_evidence_v1(c,staff);
 if v->>'classPrerequisiteStatus'<>'class_prerequisite_unmet'
 then raise exception 'Fighter cannot qualify for Staff of Power %',v; end if;
 update public.character_progression
 set class_id='66666666-0000-4000-8000-000000000002' where character_id=c;
 v:=private.attunement_rest_class_evidence_v1(c,staff);
 if v->>'classPrerequisiteStatus'<>'class_prerequisite_met'
 then raise exception 'Wizard prerequisite not projected %',v; end if;
 v:=private.attunement_rest_class_evidence_v1(c,boots);
 if v->>'classPrerequisiteStatus'<>'no_class_prerequisite'
 then raise exception 'Boots got invented class restriction %',v; end if;
 insert into public.character_rest_log values
 ('77777777-0000-4000-8000-000000000001',c,'short_rest',
  '{"scope":"standalone_character_sheet","restores":["spell slots"]}',now()-interval '2 hours');
 v:=private.attunement_rest_class_evidence_v1(c,staff);
 if v->>'shortRestEvidenceVerified'<>'false'
 then raise exception 'Generic short rest incorrectly attuned item %',v; end if;
 insert into public.character_rest_log values
 ('77777777-0000-4000-8000-000000000002',c,'short_rest',
 jsonb_build_object('attunementFocus',jsonb_build_object(
 'itemId',staff::text,'authority','canonical_rest_server_v1',
 'contactVerified',true,'exclusiveFocus',false,'interrupted',false,
 'identificationRestSeparate',true,'startedEpoch',extract(epoch from now()-interval '2 hours'),
 'focusedItems',jsonb_build_array(staff::text))),now()-interval '5 minutes');
 v:=private.attunement_rest_class_evidence_v1(c,staff);
 if v->>'shortRestEvidenceStatus'<>'incomplete_or_untrusted_focus_evidence'
 then raise exception 'Incomplete exclusive focus accepted %',v; end if;
 insert into public.character_rest_log values
 ('77777777-0000-4000-8000-000000000003',c,'short_rest',
 jsonb_build_object('attunementFocus',jsonb_build_object(
 'itemId',staff::text,'authority','canonical_rest_server_v1',
 'contactVerified',true,'exclusiveFocus',true,'interrupted',false,
 'identificationRestSeparate',true,'startedEpoch',extract(epoch from now()-interval '70 minutes'),
 'focusedItems',jsonb_build_array(staff::text))),now());
 v:=private.attunement_rest_class_evidence_v1(c,staff);
 if v->>'shortRestEvidenceStatus'<>'focused_short_rest_evidence_present'
 or v->>'attunementReady'<>'false'
 then raise exception 'Synthetic qualified focus not projected or grants magic %',v; end if;
 v:=private.attunement_rest_class_evidence_v1(other,staff);
 if v->>'shortRestEvidenceVerified'<>'false'
 then raise exception 'Another character reused focused rest %',v; end if;
 v:=private.attunement_rest_class_evidence_v1(c,boots);
 if v->>'shortRestEvidenceVerified'<>'false'
 then raise exception 'Another item reused focused rest %',v; end if;
 insert into public.character_rest_log values
 ('77777777-0000-4000-8000-000000000004',c,'short_rest',
 jsonb_build_object('attunementFocus',jsonb_build_object(
 'itemId',staff::text,'authority','canonical_rest_server_v1',
 'contactVerified',true,'exclusiveFocus',true,'interrupted',false,
 'identificationRestSeparate',true,'startedEpoch',extract(epoch from now()-interval '75 minutes'),
 'focusedItems',jsonb_build_array(staff::text,boots::text))),now()+interval '1 minute');
 v:=private.attunement_rest_class_evidence_v1(c,staff);
 if v->>'shortRestEvidenceStatus'<>'incomplete_or_untrusted_focus_evidence'
 then raise exception 'Two items focused in a single short rest %',v; end if;
 insert into public.character_rest_log values
 ('77777777-0000-4000-8000-000000000005',c,'long_rest',
 jsonb_build_object('attunementFocus',jsonb_build_object(
 'itemId',boots::text,'authority','canonical_rest_server_v1',
 'contactVerified',true,'exclusiveFocus',true,'interrupted',false,
 'identificationRestSeparate',true,'startedEpoch',extract(epoch from now()-interval '8 hours'),
 'focusedItems',jsonb_build_array(boots::text))),now());
 v:=private.attunement_rest_class_evidence_v1(c,boots);
 if v->>'shortRestEvidenceVerified'<>'false'
 then raise exception 'Long rest falsely used as attunement short rest %',v; end if;
 if has_function_privilege('authenticated','private.attunement_rest_class_evidence_v1(uuid,uuid)','EXECUTE')
 or has_function_privilege('anon','private.attunement_rest_class_evidence_v1(uuid,uuid)','EXECUTE')
 then raise exception 'Private evidence callable by client role'; end if;
end $test$;
select 'Attunement class and focused Short Rest evidence tests passed' result;
