-- Disposable local PG16 source integration only. No production weapon profile, damage modifiers,
-- targeting geometry, equipment ownership or signed-in authorization are represented here.
ALTER TABLE public.encounter_participants ADD COLUMN armor_class integer DEFAULT 10;
ALTER TABLE public.encounter_participants ADD COLUMN temp_hp integer DEFAULT 0;
CREATE FUNCTION public.encounter_weapon_profile_internal_v1(p_participant uuid,p_item uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $fn$
SELECT '{"name":"Fixture Blade","reachFt":5,"normalRangeFt":5,"longRangeFt":5,"isRanged":false,"isThrown":false,"damageDice":"1d1","damageType":"slashing","attackBonus":20,"abilityMod":0,"magicBonus":0}'::jsonb
$fn$;
CREATE FUNCTION private.encounter_resolve_attack_roll_v1(p_attacker uuid,p_target uuid,p_disadvantage boolean)
RETURNS jsonb LANGUAGE sql STABLE AS $fn$
SELECT '{"roll":12,"advantage":false,"disadvantage":false,"guidingBoltAdvantage":false,"guidingBoltEffectConsumed":false,"advantageCanceledByDisadvantage":false}'::jsonb
$fn$;
CREATE FUNCTION public.encounter_apply_damage_internal_v1(p_target uuid,p_damage integer,p_damage_type text)
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE old_hp integer; new_hp integer;
BEGIN
 SELECT current_hp INTO old_hp FROM public.encounter_participants WHERE id=p_target FOR UPDATE;
 UPDATE public.encounter_participants SET current_hp=greatest(0,current_hp-p_damage),is_defeated=(current_hp-p_damage<=0)
 WHERE id=p_target RETURNING current_hp INTO new_hp;
 RETURN jsonb_build_object('targetId',p_target,'damageType',p_damage_type,'rawDamage',p_damage,
 'resistant',false,'immune',false,'vulnerable',false,'damage',old_hp-new_hp,
 'targetHp',new_hp,'targetTempHp',0,'defeated',new_hp<=0);
END
$fn$;
INSERT INTO public.characters(id,name)
SELECT public.fixture_uuid(i),'Weapon Case Actor '||i FROM generate_series(25,30) i;
INSERT INTO public.encounters(id,map_id,status,phase,round,turn_index,active_participant_id)
VALUES
(public.fixture_uuid(934),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5940)),
(public.fixture_uuid(935),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5942)),
(public.fixture_uuid(936),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5944));
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,team,initiative,q,r,
 reaction_available,action_available,controller_user_id,speed_ft,armor_class,current_hp,max_hp)
VALUES
(public.fixture_uuid(5940),public.fixture_uuid(934),public.fixture_uuid(25),'Attacker A','players',20,0,0,false,true,public.fixture_uuid(900),30,10,10,10),
(public.fixture_uuid(5941),public.fixture_uuid(934),public.fixture_uuid(26),'Target A','enemies',10,1,0,false,true,public.fixture_uuid(900),30,10,10,10),
(public.fixture_uuid(5942),public.fixture_uuid(935),public.fixture_uuid(27),'Attacker B','players',20,0,0,false,true,public.fixture_uuid(900),30,10,10,10),
(public.fixture_uuid(5943),public.fixture_uuid(935),public.fixture_uuid(28),'Target B','enemies',10,1,0,false,true,public.fixture_uuid(900),30,10,10,10),
(public.fixture_uuid(5944),public.fixture_uuid(936),public.fixture_uuid(29),'Attacker C','players',20,0,0,false,true,public.fixture_uuid(900),30,10,10,10),
(public.fixture_uuid(5945),public.fixture_uuid(936),public.fixture_uuid(30),'Target C','enemies',10,1,0,false,true,public.fixture_uuid(900),30,10,10,10);
