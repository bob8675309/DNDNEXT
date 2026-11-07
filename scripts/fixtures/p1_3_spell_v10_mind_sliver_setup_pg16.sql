-- Disposable local scratch PG16 after v11 Guiding Bolt fixtures.
-- Public v13->v12->v11->v11_pre->v10 Mind Sliver is source-faithful; ability/profile/save,
-- targeting/damage, authorization and full RLS are mocked.
INSERT INTO public.spells_catalog(id,spell_key,name,source,level,classes)
 VALUES(public.fixture_uuid(996),'mind-sliver|xphb','Mind Sliver','XPHB',0,ARRAY['bard','wizard']::text[]);
INSERT INTO public.characters(id,name) SELECT public.fixture_uuid(i),'Mind Sliver source case '||i
 FROM generate_series(46,50) i;
INSERT INTO public.encounters(id,map_id,status,phase,round,turn_index,active_participant_id)
 VALUES(public.fixture_uuid(944),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5980)),
       (public.fixture_uuid(945),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5983));
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,team,initiative,q,r,
 action_available,controller_user_id,speed_ft,current_hp,max_hp,armor_class)
 VALUES
(public.fixture_uuid(5980),public.fixture_uuid(944),public.fixture_uuid(46),'Caster One','players',20,0,0,true,public.fixture_uuid(900),30,40,40,10),
(public.fixture_uuid(5981),public.fixture_uuid(944),public.fixture_uuid(47),'Target One','enemies',10,3,0,true,public.fixture_uuid(900),30,20,20,10),
(public.fixture_uuid(5982),public.fixture_uuid(944),public.fixture_uuid(48),'Other Target','enemies',5,4,0,true,public.fixture_uuid(900),30,20,20,10),
(public.fixture_uuid(5983),public.fixture_uuid(945),public.fixture_uuid(49),'Caster Two','players',20,0,0,true,public.fixture_uuid(900),30,40,40,10),
(public.fixture_uuid(5984),public.fixture_uuid(945),public.fixture_uuid(50),'Target Two','enemies',10,3,0,true,public.fixture_uuid(900),30,20,20,10);
INSERT INTO public.character_spells(id,character_id,spell_id,source_type,source_label,prepared,always_available,casting_stat)
 VALUES(public.fixture_uuid(6980),public.fixture_uuid(46),public.fixture_uuid(996),'class','bard',true,false,'cha'),
       (public.fixture_uuid(6983),public.fixture_uuid(49),public.fixture_uuid(996),'class','bard',true,false,'cha');
