\set ON_ERROR_STOP on
create schema if not exists private;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
\i sql/20261025_03_rest_magic_effect_eligibility_shadow.sql
do $test$
declare
 a uuid:='eeeeeeee-0000-4000-8000-000000000001';
 b uuid:='eeeeeeee-0000-4000-8000-000000000002';
 c uuid:='eeeeeeee-0000-4000-8000-000000000003';
 d uuid:='eeeeeeee-0000-4000-8000-000000000004';
 e uuid:='eeeeeeee-0000-4000-8000-000000000005';
 f uuid:='eeeeeeee-0000-4000-8000-000000000006';
 candidates jsonb;
 result jsonb;
 blocked boolean;
begin
 candidates:=jsonb_build_array(
 jsonb_build_object('inventoryItemId',a,'equipped',true,'magic',true,
   'effect',jsonb_build_object('id','ring','source','equipment','stackKey','ring','target','ac','op','add','value',1)),
 jsonb_build_object('inventoryItemId',b,'equipped',true,'magic',true,
   'effect',jsonb_build_object('id','cloak','source','equipment','stackKey','cloak','target','ac','op','add','value',1)),
 jsonb_build_object('inventoryItemId',c,'equipped',true,'magic',false,
   'effect',jsonb_build_object('id','armor','source','equipment','stackKey','armor','target','ac','op','add','value',2)),
 jsonb_build_object('inventoryItemId',d,'equipped',false,'magic',true,
   'effect',jsonb_build_object('id','unequipped','source','equipment','stackKey','unused','target','ac','op','add','value',9)),
 jsonb_build_object('inventoryItemId',e,'equipped',true,'magic',true,
   'effect',jsonb_build_object('id','staff','source','equipment','stackKey','staff','target','saving_throw_bonus','op','add','value',2)),
 jsonb_build_object('inventoryItemId',f,'equipped',true,'magic',true,
   'effect',jsonb_build_object('id','boots','source','equipment','stackKey','boots','target','speed_ft','op','add','value',10))
 );
 result:=private.filter_rest_magic_effect_candidates_v1(candidates,false,array[]::uuid[]);
 if jsonb_array_length(result->'effects')<>5
    or jsonb_array_length(result->'suppressed')<>1
    or result->>'consumerEnforced'<>'false'
 then raise exception 'OFF mode failed equipped parity %',result; end if;
 result:=private.filter_rest_magic_effect_candidates_v1(candidates,true,array[a]);
 if jsonb_array_length(result->'effects')<>2
    or jsonb_array_length(result->'suppressed')<>4
    or not exists (select 1 from jsonb_array_elements(result->'suppressed') x
         where x->>'reason'='not_selected' and x->>'inventoryItemId'=b::text)
 then raise exception 'ON mode magic selection / mundane preservation failed %',result; end if;
 result:=private.filter_rest_magic_effect_candidates_v1(candidates,true,array[a,b,e]);
 if jsonb_array_length(result->'effects')<>4
    or jsonb_array_length(result->'suppressed')<>2
    or not exists (select 1 from jsonb_array_elements(result->'suppressed') x
      where x->>'inventoryItemId'=f::text and x->>'reason'='not_selected')
 then raise exception 'Fourth equipped magic item was not suppressed %',result; end if;
 result:=private.filter_rest_magic_effect_candidates_v1(candidates,false,array[a,b,e]);
 if jsonb_array_length(result->'effects')<>5
 then raise exception 'OFF retained selection changed legacy effects %',result; end if;
 result:=private.filter_rest_magic_effect_candidates_v1(candidates,true,array[]::uuid[]);
 if jsonb_array_length(result->'effects')<>1
    or jsonb_array_length(result->'suppressed')<>5
 then raise exception 'Unchosen magic affected non-magic armor %',result; end if;
 blocked:=false;
 begin
  perform private.filter_rest_magic_effect_candidates_v1(candidates,true,array[a,b,e,f]);
 exception when invalid_parameter_value then blocked:=true; end;
 if not blocked then raise exception 'Four chosen magic item IDs exceeded three cap'; end if;
 blocked:=false;
 begin
   perform private.filter_rest_magic_effect_candidates_v1(candidates,true,array[a,a]);
 exception when invalid_parameter_value then blocked:=true; end;
 if not blocked then raise exception 'Duplicate selection was accepted'; end if;
 blocked:=false;
 begin
   perform private.filter_rest_magic_effect_candidates_v1(
     '[{"inventoryItemId":"eeeeeeee-0000-4000-8000-000000000001","equipped":true,"magic":true,"effect":{},"clientOverride":true}]'::jsonb,
     true,array[a]);
 exception when invalid_parameter_value then blocked:=true; end;
 if not blocked then raise exception 'Unexpected candidate field accepted'; end if;
 if has_function_privilege('anon',
    'private.filter_rest_magic_effect_candidates_v1(jsonb,boolean,uuid[])','EXECUTE')
 then raise exception 'Anonymous access incorrectly granted'; end if;
end $test$;
select 'Shadow magic eligibility OFF/ON, source identity and ACL contracts passed' as result;
