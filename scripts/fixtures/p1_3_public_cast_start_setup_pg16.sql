-- P1.3 disposable PG16 only, follows earlier exact-source Admin/refresh/permission fixtures.
-- Adds the minimum mock dependencies for the EXACT deployed public Healing Word v13 branch.
-- Does NOT represent actual signed-in users, full application schema, RLS or all combat triggers.
-- is_hidden already present in the preceding staged-update test fixture.
ALTER TABLE public.encounter_participants ADD COLUMN current_hp integer DEFAULT 6;
ALTER TABLE public.encounter_participants ADD COLUMN max_hp integer DEFAULT 14;
CREATE TABLE public.character_spells (
 id uuid PRIMARY KEY,character_id uuid NOT NULL,spell_id uuid NOT NULL,source_type text,
 source_label text,prepared boolean DEFAULT true,always_available boolean DEFAULT false,casting_stat text
);
CREATE TABLE public.spells_catalog(
 id uuid PRIMARY KEY,spell_key text NOT NULL,name text NOT NULL,source text NOT NULL,
 level integer NOT NULL,classes text[] NOT NULL
);
CREATE TABLE public.encounter_command_requests(
 request_id uuid PRIMARY KEY,encounter_id uuid NOT NULL,participant_id uuid NOT NULL,
 command_type text NOT NULL,requested_by uuid,result jsonb
);
CREATE TABLE public.encounter_conditions(id uuid PRIMARY KEY,participant_id uuid,condition_key text);
CREATE FUNCTION private.encounter_ability_score_v1(p_character uuid,p_stat text)
RETURNS integer LANGUAGE sql STABLE AS $fn$ SELECT 16 $fn$;
CREATE FUNCTION public.encounter_spellcasting_profile_v1(p_participant uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $fn$
 SELECT '{"isClassCaster":true,"className":"cleric","castingAbility":"wis"}'::jsonb
$fn$;
CREATE FUNCTION public.encounter_apply_healing_internal_v1(p_participant uuid,p_requested integer)
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE before_hp integer; after_hp integer;
BEGIN
 SELECT current_hp INTO before_hp FROM public.encounter_participants WHERE id=p_participant FOR UPDATE;
 UPDATE public.encounter_participants SET current_hp=least(max_hp,current_hp+p_requested)
 WHERE id=p_participant RETURNING current_hp INTO after_hp;
 RETURN jsonb_build_object('hpBefore',before_hp,'hpAfter',after_hp,'effective',after_hp-before_hp);
END
$fn$;
INSERT INTO public.class_catalog(id,class_key,source,ruleset,caster_progression,spellcasting_ability)
VALUES(public.fixture_uuid(991),'cleric','XPHB','2024','full','wis');
INSERT INTO public.class_level_progression(class_id,class_level,spell_slots)
VALUES(public.fixture_uuid(991),1,'[1]'::jsonb);
INSERT INTO public.spells_catalog(id,spell_key,name,source,level,classes)
VALUES(public.fixture_uuid(993),'healing-word|xphb','Healing Word','XPHB',1,ARRAY['cleric']::text[]);
INSERT INTO public.characters(id,name)
SELECT public.fixture_uuid(i),'Real Cast Integration Character '||i FROM generate_series(14,16) i;
INSERT INTO public.character_progression(character_id,class_id,class_level)
SELECT public.fixture_uuid(i),public.fixture_uuid(991),1 FROM generate_series(14,16) i;
INSERT INTO public.character_spell_slots(character_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key)
SELECT public.fixture_uuid(i),'spellcasting',1,1,1,'long_rest' FROM generate_series(14,16) i;
INSERT INTO public.encounters(id,map_id,status,phase,round,turn_index,active_participant_id)
VALUES
 (public.fixture_uuid(920),public.fixture_uuid(1),'draft','staging',0,0,null),
 (public.fixture_uuid(921),public.fixture_uuid(1),'draft','staging',0,0,null),
 (public.fixture_uuid(922),public.fixture_uuid(1),'paused','paused',1,0,public.fixture_uuid(5922));
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,initiative,controller_user_id,
 current_hp,max_hp,bonus_action_available,action_available,is_hidden)
VALUES
 (public.fixture_uuid(5920),public.fixture_uuid(920),public.fixture_uuid(14),'Test Cleric Sequential',18,public.fixture_uuid(900),5,14,true,true,false),
 (public.fixture_uuid(5921),public.fixture_uuid(921),public.fixture_uuid(15),'Test Cleric Race',18,public.fixture_uuid(900),5,14,true,true,false),
 (public.fixture_uuid(5922),public.fixture_uuid(922),public.fixture_uuid(16),'Test Cleric Resume',18,public.fixture_uuid(900),5,14,true,true,false);
INSERT INTO public.character_spells(id,character_id,spell_id,source_type,source_label,prepared,always_available,casting_stat)
SELECT public.fixture_uuid(6900+i),public.fixture_uuid(i),public.fixture_uuid(993),
 'class','cleric',true,false,'wis' FROM generate_series(14,16) i;
-- Paused encounter already has its prior slot snapshot; resume activation refreshes it.
INSERT INTO public.encounter_spell_slots(id,participant_id,pool_key,slot_level,slots_max,slots_remaining)
VALUES(public.fixture_uuid(4922),public.fixture_uuid(5922),'spellcasting',1,1,1);
-- Install deployed activation refresh trigger with exact trigger statement retrieved SELECT-only.
CREATE TRIGGER encounter_spell_slots_refresh_on_activation
 AFTER UPDATE OF status ON public.encounters
 FOR EACH ROW WHEN ((new.status = 'active'::text) AND (old.status IS DISTINCT FROM new.status))
 EXECUTE FUNCTION private.refresh_encounter_spell_slots_on_activation_v1();
