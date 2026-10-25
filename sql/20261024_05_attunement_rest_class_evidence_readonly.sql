-- STAGED INTERNAL READ MODEL ONLY. No attunement writes or effect activation.
-- The existing complete_character_rest_v1(uuid,text) does NOT emit focused-item
-- evidence; legacy/generic short rests MUST NOT qualify for attunement.
-- Source: D&D 2024 Basic Rules equipment attunement + Short Rest glossary.
create or replace function private.attunement_rest_class_evidence_v1(
  p_character_id uuid,
  p_inventory_item_id uuid
) returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,private,auth
as $evidence$
declare
 v_item public.inventory_items%rowtype;
 v_source jsonb:='{}'::jsonb;
 v_class_status text:='source_unverified';
 v_rest_status text:='missing_verified_focused_short_rest';
 v_class_keys jsonb:='[]'::jsonb;
 v_class_found boolean:=false;
 v_class_matching boolean:=false;
 v_epoch numeric;
 v_rest record;
begin
 if p_character_id is null or p_inventory_item_id is null then
   raise exception 'Character and item required' using errcode='22023';
 end if;
 select * into v_item from public.inventory_items
 where id=p_inventory_item_id;
 if not found then
   return jsonb_build_object('schemaVersion',1,'classPrerequisiteStatus','item_not_found',
     'shortRestEvidenceStatus','item_not_found','shortRestEvidenceVerified',false,
     'classPrerequisiteVerified',false,'attunementReady',false);
 end if;
 -- No fuzzy name lookup, no inventory override that can erase the verified rule.
 v_source:=private.verified_item_attunement_rule_v1(
   coalesce(nullif(v_item.card_payload->>'item_key',''),
            nullif(v_item.card_payload->>'item_id',''),
            nullif(v_item.item_id,'')));
 v_class_keys:=coalesce(v_source->'classKeys','[]'::jsonb);
 if v_source->>'attunement'<>'required' then
   v_class_status:='source_unverified';
 elsif jsonb_typeof(v_class_keys)<>'array' then
   v_class_status:='invalid_source_prerequisites';
 elsif jsonb_array_length(v_class_keys)=0 then
   v_class_status:='no_class_prerequisite';
 else
   select exists(
     select 1 from public.character_progression cp
     join public.class_catalog cc on cc.id=cp.class_id
     where cp.character_id=p_character_id and cp.class_level>0
   ), exists(
     select 1 from public.character_progression cp
     join public.class_catalog cc on cc.id=cp.class_id
     where cp.character_id=p_character_id and cp.class_level>0
       and lower(cc.class_key) in
           (select lower(k) from jsonb_array_elements_text(v_class_keys) as k)
   ) into v_class_found,v_class_matching;
   v_class_status:=case
     when not v_class_found then 'class_source_missing'
     when v_class_matching then 'class_prerequisite_met'
     else 'class_prerequisite_unmet' end;
 end if;

 -- Recorded generic rests and client claims are never evidence of item contact.
 -- The canonical rest RPC today does not write attunementFocus. A FUTURE,
 -- guarded server rest path must validate contact, exclusive focus,
 -- identification on a DIFFERENT rest, a full uninterrupted hour, and write
 -- this one-item receipt during the same authorized transaction.
 select r.id,r.completed_at,r.details into v_rest
 from public.character_rest_log r
 where r.character_id=p_character_id and r.rest_type='short_rest'
   and jsonb_typeof(r.details->'attunementFocus')='object'
   and r.details#>>'{attunementFocus,itemId}'=p_inventory_item_id::text
 order by r.completed_at desc,r.id desc limit 1;
 if found then
   if v_rest.details#>>'{attunementFocus,authority}'='canonical_rest_server_v1'
      and v_rest.details#>>'{attunementFocus,contactVerified}'='true'
      and v_rest.details#>>'{attunementFocus,exclusiveFocus}'='true'
      and v_rest.details#>>'{attunementFocus,interrupted}'='false'
      and v_rest.details#>>'{attunementFocus,identificationRestSeparate}'='true'
      and jsonb_typeof(v_rest.details#>'{attunementFocus,startedEpoch}')='number'
      and jsonb_typeof(v_rest.details#>'{attunementFocus,focusedItems}')='array'
      and jsonb_array_length(v_rest.details#>'{attunementFocus,focusedItems}')=1
      and v_rest.details#>>'{attunementFocus,focusedItems,0}'=p_inventory_item_id::text
   then
     v_epoch:=(v_rest.details#>>'{attunementFocus,startedEpoch}')::numeric;
     if v_epoch>0 and v_rest.completed_at>=to_timestamp(v_epoch::double precision)+interval '1 hour'
        and v_rest.completed_at<=to_timestamp(v_epoch::double precision)+interval '24 hours'
     then
       v_rest_status:='focused_short_rest_evidence_present';
     else
       v_rest_status:='insufficient_or_invalid_rest_duration';
     end if;
   else
     v_rest_status:='incomplete_or_untrusted_focus_evidence';
   end if;
 end if;
 return jsonb_build_object('schemaVersion',1,
   'classPrerequisiteStatus',v_class_status,
   'classPrerequisiteVerified',v_class_status in ('class_prerequisite_met','no_class_prerequisite'),
   'shortRestEvidenceStatus',v_rest_status,
   'shortRestEvidenceVerified',v_rest_status='focused_short_rest_evidence_present',
   'attunementReady',false);
end
$evidence$;
revoke all on function private.attunement_rest_class_evidence_v1(uuid,uuid)
from public,anon,authenticated;
grant execute on function private.attunement_rest_class_evidence_v1(uuid,uuid)
to service_role;
comment on function private.attunement_rest_class_evidence_v1(uuid,uuid) is
'Read-only candidate attunement evidence; never authorizes attunement or magical gameplay. Generic rest logs do not qualify.';
