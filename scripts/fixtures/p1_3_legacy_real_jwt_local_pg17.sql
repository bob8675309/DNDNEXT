-- P1.3 research: disposable *local Supabase CLI PG17 only*, not a production migration.
-- Loaded by GitHub Actions only with PGHOST=127.0.0.1 PGPORT=54322 PGDATABASE=postgres.
-- No auth.uid/auth.role stubs! Supabase's real GoTrue/PostgREST set the claims.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 THEN RAISE EXCEPTION 'P1.3 local Auth fixture refuses unexpected database/version'; END IF;
END $guard$;
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION public.p13_auth_uuid(p_n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $id$
  SELECT ('00000000-0000-0000-0000-'||lpad(p_n::text,12,'0'))::uuid $id$;
CREATE TABLE public.p13_auth_admins(user_id uuid PRIMARY KEY);
CREATE TABLE public.characters(id uuid PRIMARY KEY, name text, kind text);
CREATE TABLE public.character_permissions(
 character_id uuid NOT NULL, user_id uuid NOT NULL, can_edit boolean DEFAULT false,
 can_control boolean DEFAULT false,
 PRIMARY KEY(character_id,user_id)
);
CREATE TABLE public.encounters(
 id uuid PRIMARY KEY,status text NOT NULL,round integer DEFAULT 1,turn_index integer DEFAULT 0,
 active_participant_id uuid,version integer DEFAULT 0,updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.encounter_participants(
 id uuid PRIMARY KEY,encounter_id uuid NOT NULL,character_id uuid,
 display_name text,controller_user_id uuid,
 action_available boolean NOT NULL DEFAULT true,
 is_hidden boolean NOT NULL DEFAULT false,
 is_defeated boolean NOT NULL DEFAULT false,
 current_hp integer DEFAULT 1,max_hp integer DEFAULT 20,
 updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.spells_catalog(
 id uuid PRIMARY KEY,spell_key text NOT NULL,name text NOT NULL,source text NOT NULL,
 level integer NOT NULL
);
CREATE TABLE public.character_spells(
 id uuid PRIMARY KEY,character_id uuid NOT NULL,spell_id uuid NOT NULL,
 source_type text NOT NULL,source_label text,
 prepared boolean DEFAULT true,always_available boolean DEFAULT false,casting_stat text
);
CREATE TABLE public.encounter_command_requests(
 request_id uuid PRIMARY KEY,encounter_id uuid,participant_id uuid,command_type text,
 requested_by uuid,result jsonb
);
CREATE TABLE public.encounter_conditions(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,participant_id uuid,condition_key text);
CREATE TABLE public.encounter_spell_slots(
 id uuid PRIMARY KEY,participant_id uuid,pool_key text,slot_level integer,
 slots_max integer,slots_remaining integer,recharge_key text DEFAULT 'long_rest',
 updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.encounter_combat_log(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 encounter_id uuid,round integer,turn_index integer,actor_participant_id uuid,
 target_participant_id uuid,event_type text,summary text,detail jsonb
);
-- Intentionally local-only Admin implementation: real auth.uid() + local role rows.
CREATE FUNCTION public.is_admin(p_uid uuid) RETURNS boolean LANGUAGE sql STABLE
 SECURITY DEFINER SET search_path TO 'pg_catalog','public'
 AS $admin$ SELECT EXISTS(SELECT 1 FROM public.p13_auth_admins WHERE user_id=p_uid) $admin$;
-- Original DnDWeb authorization helper (MD5 b91d975f399efb2ed2db8519f633fae7):
CREATE OR REPLACE FUNCTION public.encounter_can_control_participant_v1(p_participant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_participant public.encounter_participants%rowtype;
begin
  if coalesce(auth.role(), '') = 'service_role' then return true; end if;
  if v_uid is null then return false; end if;
  if public.is_admin(v_uid) then return true; end if;
  select * into v_participant from public.encounter_participants where id=p_participant_id;
  if not found then return false; end if;
  if v_participant.controller_user_id = v_uid then return true; end if;
  if v_participant.character_id is not null and exists (
    select 1 from public.character_permissions cp
    where cp.character_id=v_participant.character_id and cp.user_id=v_uid and coalesce(cp.can_edit,false)
  ) then return true; end if;
  return false;
end;
$function$;

-- Original DnDWeb slot-turn guard (MD5 78195a807865efdbf74122a3d562a095):
CREATE OR REPLACE FUNCTION private.encounter_enforce_spell_slot_cast_turn_v1(p_caster_id uuid, p_assignment_id uuid, p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_p public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_level integer;
  v_request_text text:=coalesce(p_request_id::text,'');
begin
  if p_caster_id is null or p_assignment_id is null then return; end if;

  select s.level into v_level
  from public.encounter_participants p
  join public.character_spells cs on cs.character_id=p.character_id and cs.id=p_assignment_id
  join public.spells_catalog s on s.id=cs.spell_id
  where p.id=p_caster_id;
  if not found or coalesce(v_level,0)<=0 then return; end if;

  select * into v_p from public.encounter_participants where id=p_caster_id;
  if not found then return; end if;
  select * into v_e from public.encounters where id=v_p.encounter_id for update;
  if not found then return; end if;

  if exists(
    select 1
    from public.encounter_combat_log l
    where l.encounter_id=v_e.id
      and l.round=v_e.round
      and l.turn_index=v_e.turn_index
      and l.actor_participant_id=v_p.id
      and l.event_type='spell_cast'
      and coalesce(nullif(l.detail->>'slotLevel','')::integer,0)>0
      and coalesce(l.detail->>'requestId','')<>v_request_text
  ) then
    raise exception 'A spell slot has already been expended to cast a spell on this turn';
  end if;
end;
$function$;

-- Only geometry/stat/healing dependencies are mocked: spell processors themselves are ORIGINAL.
CREATE FUNCTION public.encounter_spellcasting_profile_v1(p_participant uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $profile$
  SELECT '{"isClassCaster":true,"castingAbility":"wis","proficiencyBonus":2}'::jsonb $profile$;
CREATE FUNCTION private.encounter_ability_score_v1(p_character uuid,p_stat text)
RETURNS integer LANGUAGE sql STABLE AS $score$ SELECT 16 $score$;
CREATE FUNCTION public.encounter_targeting_context_internal_v1(p_caster uuid,p_target uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $target$
 SELECT '{"hasLineOfSight":true,"distanceFt":5,"coverLevel":"none"}'::jsonb $target$;
CREATE FUNCTION public.encounter_apply_healing_internal_v1(p_target uuid,p_requested integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'pg_catalog','public'
 AS $heal$
 DECLARE v_before integer;v_after integer;
 BEGIN
  SELECT current_hp INTO v_before FROM public.encounter_participants WHERE id=p_target FOR UPDATE;
  UPDATE public.encounter_participants
  SET current_hp=LEAST(max_hp,current_hp+p_requested) WHERE id=p_target RETURNING current_hp INTO v_after;
  RETURN jsonb_build_object('before',v_before,'after',v_after,'healed',v_after-v_before);
 END $heal$;
-- Source snapshot already on research PR #317: v9 -> v1 and *_pre_1v, unchanged.
\i scripts/fixtures/p1_3_legacy_v9_to_v1_live_source_pg16.sql
INSERT INTO public.characters VALUES
(public.p13_auth_uuid(611),'TEST NPC CAST ACTOR','npc'),
(public.p13_auth_uuid(612),'TEST Ally','npc'),
(public.p13_auth_uuid(613),'TEST Other Ally','npc'),
(public.p13_auth_uuid(614),'TEST Separate Actor','npc'),
(public.p13_auth_uuid(615),'TEST Separate Target','npc');
INSERT INTO public.encounters(id,status,round,turn_index,active_participant_id)
VALUES(public.p13_auth_uuid(901),'active',1,0,public.p13_auth_uuid(1011)),
(public.p13_auth_uuid(902),'active',1,0,public.p13_auth_uuid(1014));
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,current_hp,max_hp,is_hidden,controller_user_id)
VALUES
(public.p13_auth_uuid(1011),public.p13_auth_uuid(901),public.p13_auth_uuid(611),'Test Caster',20,20,false,null),
(public.p13_auth_uuid(1012),public.p13_auth_uuid(901),public.p13_auth_uuid(612),'Test Ally',1,20,false,null),
(public.p13_auth_uuid(1013),public.p13_auth_uuid(901),public.p13_auth_uuid(613),'Test Hidden Ally',2,20,true,null),
(public.p13_auth_uuid(1014),public.p13_auth_uuid(902),public.p13_auth_uuid(614),'Test Unused Caster',20,20,false,null),
(public.p13_auth_uuid(1015),public.p13_auth_uuid(902),public.p13_auth_uuid(615),'Test Unused Target',1,20,false,null);
INSERT INTO public.spells_catalog VALUES
(public.p13_auth_uuid(2011),'cure-wounds|xphb','Cure Wounds','XPHB',1),
(public.p13_auth_uuid(2012),'unsupported-spell|xphb','GM-assisted Spell','XPHB',0),
(public.p13_auth_uuid(2013),'cure-wounds|phb','Old Cure Wounds','PHB',1);
INSERT INTO public.character_spells VALUES
(public.p13_auth_uuid(3011),public.p13_auth_uuid(611),public.p13_auth_uuid(2011),'class','cleric',true,false,'wis'),
(public.p13_auth_uuid(3012),public.p13_auth_uuid(611),public.p13_auth_uuid(2011),'class','cleric',true,false,'wis'),
(public.p13_auth_uuid(3013),public.p13_auth_uuid(611),public.p13_auth_uuid(2012),'class','cleric',true,false,'wis'),
(public.p13_auth_uuid(3014),public.p13_auth_uuid(611),public.p13_auth_uuid(2013),'class','cleric',true,false,'wis'),
(public.p13_auth_uuid(3015),public.p13_auth_uuid(614),public.p13_auth_uuid(2011),'class','cleric',true,false,'wis');
INSERT INTO public.encounter_spell_slots(id,participant_id,pool_key,slot_level,slots_max,slots_remaining)
VALUES(public.p13_auth_uuid(4011),public.p13_auth_uuid(1011),'spellcasting',1,1,1),
(public.p13_auth_uuid(4014),public.p13_auth_uuid(1014),'spellcasting',1,1,1);
-- Only authenticated signed-in clients can invoke legacy v9; no anon direct EXECUTE.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encounter_can_control_participant_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid) TO authenticated;
-- RLS is used only as a real Data API visibility test; privileged cast functions
-- are SECURITY DEFINER and bypass it. No permissive authenticated SELECT.
ALTER TABLE public.encounter_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY p13_local_participant_read ON public.encounter_participants
FOR SELECT TO authenticated
USING (is_hidden=false OR controller_user_id=auth.uid() OR public.is_admin(auth.uid()));
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon,authenticated;
GRANT SELECT ON public.encounter_participants TO authenticated;
DO $assert$
BEGIN
 IF has_function_privilege('anon','public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'P1.3 local Auth grant violation'; END IF;
END $assert$;
NOTIFY pgrst,'reload schema';
