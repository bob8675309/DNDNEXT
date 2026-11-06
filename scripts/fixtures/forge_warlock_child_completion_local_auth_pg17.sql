-- J164 live-source-identified level-2 Warlock dependent Invocation data.
-- Read-only DnDWeb select snapshot 2026-11-06; NEVER apply to production.
-- Only disposable local GoTrue/PostgREST PostgreSQL 17 AFTER J163.
\set ON_ERROR_STOP on
\i scripts/fixtures/forge_warlock_preferred_spell_original_pg17.sql
DO $guard$
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('public.class_feature_option_catalog') IS NULL
  OR to_regclass('public.class_feature_catalog') IS NULL
  OR md5(pg_get_functiondef('private.validate_player_forge_nested_choice_payload_v1()'::regprocedure)) <> 'df2861cc76b0b74bb7cd57fbe61c9a05'
  OR md5(pg_get_functiondef('private.validate_and_materialize_player_forge_class_options_v1()'::regprocedure)) <> '6df5aee6f0519c9c77758d6e887ed8e4'
  OR md5(pg_get_functiondef('private.validate_player_forge_authority_payload_v1()'::regprocedure)) <> '48006f8db76e9b32c96fcd2b6a4b3080'
  OR md5(pg_get_functiondef('private.xphb_warlock_invocation_count_v1(integer)'::regprocedure)) <> '61c83f0172b33386f0a50435c2fe1ddb'
  OR private.xphb_warlock_invocation_count_v1(2)<>3
  OR private.xphb_warlock_invocation_slot_level_v1(1)<>1
  OR private.xphb_warlock_invocation_slot_level_v1(2)<>2
  OR private.xphb_warlock_invocation_slot_level_v1(3)<>2
  OR md5(pg_get_functiondef('public.is_preferred_spell_version_v1(uuid)'::regprocedure)) <> '68993ebe31db168b77329aea0f466c5d'
  OR NOT EXISTS(SELECT 1 FROM public.class_catalog WHERE id='6792abd0-1fd9-44fb-ae4c-56c307ab791a'::uuid AND class_key='warlock' AND source='XPHB' AND spellcasting_ability='cha')
  OR EXISTS(SELECT 1 FROM public.class_level_progression WHERE class_id='6792abd0-1fd9-44fb-ae4c-56c307ab791a'::uuid AND class_level=2)
  OR EXISTS(SELECT 1 FROM public.class_feature_catalog WHERE feature_key='class:warlock:xphb::eldritch-invocation-options:xphb:1')
  OR EXISTS(SELECT 1 FROM public.class_feature_option_catalog WHERE id='a0968ca9-deab-4bef-a8b0-05e11d4b3e0a'::uuid)
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='spells_catalog' AND column_name IN ('range_unit','range_distance','attack_type'))
 THEN RAISE EXCEPTION 'J164 isolated Warlock level2 dependency fixture source/scope baseline mismatch';
 END IF;
END $guard$;

-- Existing fixture Warlock live class row is source-qualified; only add its
-- level-2 progression from read-only catalog, NOT a synthetic new class.
INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots,cantrips_known,spells_known)
VALUES('6792abd0-1fd9-44fb-ae4c-56c307ab791a',2,300,2,'[2,0,0,0,0,0,0,0,0]'::jsonb,2,3);

-- Source original class feature row used by the earlier unmodified authority
-- helper to prove Invocation names are class-eligible, not synthetic grants.
INSERT INTO public.class_feature_catalog
 (id,feature_key,feature_type,name,source,class_key,class_source,level,description,entries)
VALUES
 ('a0063975-8f97-4c3d-adc1-1214c176cfd9'::uuid,'class:warlock:xphb::eldritch-invocation-options:xphb:1','class','Eldritch Invocation Options','XPHB','warlock','XPHB',1,'Eldritch Invocation options appear in alphabetical order.

Agonizing Blast|XPHB

Armor of Shadows|XPHB

Ascendant Step|XPHB

Devil''s Sight|XPHB

Devouring Blade|XPHB

Eldritch Mind|XPHB

Eldritch Smite|XPHB

Eldritch Spear|XPHB

Fiendish Vigor|XPHB

Gaze of Two Minds|XPHB

Gift of the Depths|XPHB

Gift of the Protectors|XPHB

Investment of the Chain Master|XPHB

Lessons of the First Ones|XPHB

Lifedrinker|XPHB

Mask of Many Faces|XPHB

Master of Myriad Forms|XPHB

Misty Visions|XPHB

One with Shadows|XPHB

Otherworldly Leap|XPHB

Pact of the Blade|XPHB

Pact of the Chain|XPHB

Pact of the Tome|XPHB

Repelling Blast|XPHB

Thirsting Blade|XPHB

Visions of Distant Realms|XPHB

Whispers of the Grave|XPHB

Witch Sight|XPHB','["Eldritch Invocation options appear in alphabetical order.",{"type":"options","count":1,"entries":[{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Agonizing Blast|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Armor of Shadows|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Ascendant Step|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Devil''s Sight|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Devouring Blade|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Eldritch Mind|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Eldritch Smite|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Eldritch Spear|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Fiendish Vigor|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Gaze of Two Minds|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Gift of the Depths|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Gift of the Protectors|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Investment of the Chain Master|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Lessons of the First Ones|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Lifedrinker|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Mask of Many Faces|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Master of Myriad Forms|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Misty Visions|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"One with Shadows|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Otherworldly Leap|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Pact of the Blade|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Pact of the Chain|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Pact of the Tome|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Repelling Blast|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Thirsting Blade|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Visions of Distant Realms|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Whispers of the Grave|XPHB"},{"type":"refOptionalfeature","preserve":{"prerequisite":true},"optionalfeature":"Witch Sight|XPHB"}]}]'::jsonb);

-- Actual XPHB Agonizing Blast source catalog choice (minClassLevel 2).
-- Prior approved Armor of Shadows and Eldritch Mind original rows are retained.
INSERT INTO public.class_feature_option_catalog
 (id,option_key,option_type,name,source,class_key,prerequisites,repeatable,choice_schema,metadata,raw_payload)
VALUES
 ('a0968ca9-deab-4bef-a8b0-05e11d4b3e0a'::uuid,'optional-feature:agonizing-blast|XPHB','eldritch-invocation','Agonizing Blast','XPHB','warlock','{"minClassLevel":2}'::jsonb,true,'{"kind":"warlock-damage-cantrip","distinctPerRepeat":true}'::jsonb,'{"sourceFile":"data/optionalfeatures.json","descriptionAuthority":"5etools:optionalfeature","descriptionReviewedAt":"2026-10-09","descriptionSourceFile":"data/optionalfeatures.json","descriptionSourceCommit":"8c026b807fac21862a309379a0c3228a0683198b"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb);

-- The earlier reduced spells table omitted these original handler columns.
ALTER TABLE public.spells_catalog ADD COLUMN range_unit text;
ALTER TABLE public.spells_catalog ADD COLUMN range_distance numeric;
ALTER TABLE public.spells_catalog ADD COLUMN attack_type text;

-- Five exact live-identified source-eligible Warlock starting-spell specimens.
INSERT INTO public.spells_catalog
 (id,name,level,source,classes,damage_types,damage_dice,ritual,range_unit,range_distance,attack_type)
VALUES
 ('4dc8d2b8-40ad-4d7c-8a39-ec42f6eb513c'::uuid,'Chill Touch',0,'XPHB',ARRAY['Sorcerer','Warlock','Wizard']::text[],ARRAY['necrotic']::text[],'1d10',false,'touch',NULL,'Melee Spell Attack'),
 ('47d3fd14-695b-4d54-a3fb-9c210ed59952'::uuid,'Eldritch Blast',0,'XPHB',ARRAY['Warlock']::text[],ARRAY['force']::text[],'1d10',false,'feet',120,'Ranged Spell Attack'),
 ('afa6d1fa-c238-4519-bc8e-3b80a5d55f75'::uuid,'Armor of Agathys',1,'XPHB',ARRAY['Warlock']::text[],ARRAY['cold']::text[],NULL,false,'self',NULL,NULL),
 ('1e4007d8-c780-4e97-af58-f273ee1c73b4'::uuid,'Hex',1,'XPHB',ARRAY['Warlock']::text[],ARRAY['necrotic']::text[],'1d6',false,'feet',90,NULL),
 ('fabffecc-cacd-4595-85ec-dfa8b27ec9a4'::uuid,'Witch Bolt',1,'XPHB',ARRAY['Sorcerer','Warlock','Wizard']::text[],ARRAY['lightning']::text[],'2d12',false,'feet',60,'Ranged Spell Attack');

DO $sources$
BEGIN
 IF (SELECT count(*) FROM public.spells_catalog WHERE id = ANY(ARRAY[
   '4dc8d2b8-40ad-4d7c-8a39-ec42f6eb513c'::uuid,
   '47d3fd14-695b-4d54-a3fb-9c210ed59952'::uuid,
   'afa6d1fa-c238-4519-bc8e-3b80a5d55f75'::uuid,
   '1e4007d8-c780-4e97-af58-f273ee1c73b4'::uuid,
   'fabffecc-cacd-4595-85ec-dfa8b27ec9a4'::uuid
 ]))<>5
 OR NOT EXISTS(SELECT 1 FROM public.class_level_progression WHERE class_id='6792abd0-1fd9-44fb-ae4c-56c307ab791a'::uuid AND class_level=2 AND cantrips_known=2 AND spells_known=3 AND spell_slots='[2,0,0,0,0,0,0,0,0]'::jsonb)
 OR NOT EXISTS(SELECT 1 FROM public.class_feature_option_catalog WHERE id='a0968ca9-deab-4bef-a8b0-05e11d4b3e0a'::uuid AND option_key='optional-feature:agonizing-blast|XPHB' AND (prerequisites->>'minClassLevel')::integer=2 AND choice_schema->>'kind'='warlock-damage-cantrip')
 OR NOT EXISTS(SELECT 1 FROM public.class_feature_catalog WHERE feature_key='class:warlock:xphb::eldritch-invocation-options:xphb:1' AND position('Agonizing Blast' IN description)>0 AND position('Armor of Shadows' IN description)>0 AND position('Eldritch Mind' IN description)>0)
 THEN RAISE EXCEPTION 'Warlock level-2 live source level/spell/option/feature materialization mismatch';
 END IF;
END $sources$;
\echo 'PASS J164 guarded disposable XPHB Warlock level2 source progression, 3 Invocation slots, real Agonizing choice and 5 source-eligible spell records'
