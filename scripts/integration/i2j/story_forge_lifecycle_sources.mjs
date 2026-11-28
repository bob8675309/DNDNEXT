// Public-source pins and additive schema composition for the disposable I1-H database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const pins = {
  i1h: ["scripts/fixtures/i1h_warlock_acquisition_with_guards_pg17.sql", "c8c22cafa567f986d8049060d02e687fd040601e"],
  materializer: ["scripts/fixtures/forge_feat_materializer_original_pg17.sql", "aa60a2699796fea20213dca55c5191e2beaa24ac"],
  grantDdl: ["scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql", "e6d574baa68dea6ad93f997941b3f062a234ff98"],
  forgeAuthority: ["scripts/fixtures/forge_progression_authority_original_pg17.sql", "3a0b6caeb6712f67af7895433df15f1439b19581"],
  story: ["sql/candidates/20261109_player_story_complete_intent_i1c_research.sql", "91f5fb918bf205f2d4462e2ff0089f656601328e"],
  creator: ["sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql", "ecddcd514917a4d379d14b02477dfb41dbf44f29"],
  cash: ["scripts/fixtures/forge_market_cash_original_functions_pg17.sql", "6cf2e51820166bc88bb24ee544a8bb1403a6ea41"],
  p13: ["scripts/fixtures/p1_3_levelup_v5_local_auth_pg17.sql", "6619cc35a9e927696868bf13d3c8942116c9c8c3"],
  progression: ["scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql", "b3168d0c9ec92ae1c0c389ccf55655209f2841f8"],
  origin: ["sql/20260808_24_source_owned_origin_feat_authority.sql", "bdc9e3513a689adf66c8b95b80ecb8ee76fb5203"],
  reversal: ["sql/20260808_34_reversible_source_owned_origin_feats.sql", "97383438092320618fbcd4aa0de304ae77f3c64a"],
  earn: ["sql/20260808_26_earned_warlock_invocation_progression.sql", "e32062499f2e3b40ce2be38c22fa4f1cafa90f3c"],
  group: ["sql/20260808_35_eldritch_invocation_level_replacement.sql", "b46f6627813d87b7976cba9cb42663e7d861c81f"],
  parent: ["sql/20260808_36_fix_invocation_replacement_source_choices_parent.sql", "e46894e68849347277980ffa41c710603c06e471"],
  projection: ["sql/20260808_37_sync_eldritch_invocation_sheet_projection.sql", "84f1bc63a0761023dc2c48d71705faba99a23df7"],
  arch: ["sql/20260808_09_level_up_advancement_authority_helpers.sql", "ed8a1fc28b0f179857ec734ff59091efa32b397e"],
  guards: ["sql/20260808_02_player_forge_feat_instance_authority.sql", "39fc5629925cfe25274da6eb9264ab7ad42a1eb4"],
  classGuards: ["sql/20260808_21_player_forge_class_option_instance_authority.sql", "81db89dad30e5bbc2c9f07a8f4fbd72782a09294"],
  catalog: ["sql/20260711_01_canonical_spell_class_and_character_option_catalogs.sql", "43e6261e4dd906d713e4a53150b37e0a5d1e6abc"],
  subclass: ["sql/20260720_01_subclass_compatibility_and_selection.sql", "4e938bc3217f11b8a4ef589da83af00aaca51782"],
  spellAccess: ["sql/20260808_19_source_aware_level_up_spell_access.sql", "ba4443302d37bb99532695e438bd1c0d0f1e4e5c"],
  spellIndex: ["sql/20260706_01_spell_catalog_foundation.sql", "7efab442b46b0b055dfde6d197254c68c286d7b1"],
  battle: ["sql/20260808_39_battle_master_maneuver_progression.sql", "8782874160f4fa098241292920aa826ed17ee2d1"],
  wizard: ["sql/20260808_41_wizard_savant_forge_chronology.sql", "b0f3380b7ec22124ea19de3724867877060c6d92"],
  resources: ["sql/20260802_03_character_sheet_spell_resources.sql", "f96a3788334fe306374dfd4b5fdf4e00992d3924"],
  provenance: ["scripts/fixtures/i2j_proficiency_provenance_scratch_pg17.sql", "c32e26ca6c62aac9e74bd1367d4c9013adc62586"],
};

function readPins() {
  return Object.fromEntries(Object.entries(pins).map(([key, [path, expected]]) => {
    const contents = readFileSync(path);
    const hash = createHash("sha1").update("blob "+contents.length+"\0").update(contents).digest("hex");
    assert.equal(hash, expected, path);
    return [key, contents.toString("utf8")];
  }));
}

function functionBody(source, name) {
  const re = new RegExp("^create (?:or replace )?function "+name.replaceAll(".", "\\.")+
    "\\([\\s\\S]+?\\n?(\\$[a-z_]*\\$);", "gim");
  const bodies = [...source.matchAll(re)];
  assert.equal(bodies.length, 1, name);
  return bodies[0][0];
}

function segment(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first+start.length);
  assert.ok(first >= 0 && last > first, start);
  return source.slice(first,last);
}

function once(source, from, to) {
  assert.equal(source.split(from).length, 2, from);
  return source.replace(from, to);
}

const mirror = "  update public.players p set sheet=v_sheet,updated_at=now()\n"+
  "  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
const baseMirror = "  update public.players p set sheet = v_sheet, updated_at = now()\n"+
  "  where p.user_id in (\n    select cp.user_id from public.character_permissions cp where cp.character_id = p_character_id\n  );";
const earnedMirror = "  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
const canonicalOnly = "  -- Existing disposable Option A candidate: write only the canonical sheet.";
const originalValidator = "private.validate_existing_normalized_warlock_invocations_v2()";

export function installStoryLifecycleSources({sql, sqlFile, targetClass}) {
  assert.equal(process.env.DNDNEXT_I2J_STORY_LIFECYCLE, "DISPOSABLE_I1H_ONLY");
  assert.equal(process.env.PGHOST, "127.0.0.1");
  assert.equal(process.env.PGPORT, "55622");
  assert.match(sql("SHOW server_version"), /^17\./);
  assert.match(targetClass, /^[a-f0-9-]{36}$/);
  const sources = readPins();
  const q = value => "'"+String(value).replaceAll("'", "''")+"'";
  const def = name => sql("SELECT pg_get_functiondef("+q(name)+"::regprocedure)");
  const hash = name => sql("SELECT md5(pg_get_functiondef("+q(name)+"::regprocedure))");
  const internal = new Set();
  const install = (source, ...names) => {
    for(const name of names){
      sql(functionBody(sources[source],name));
      if(name.startsWith("private.")) internal.add(name);
    }
  };
  const fingerprints = {
    "public.complete_character_level_up_v5(uuid,jsonb)":"02d74b973a763c53c595be20e35e512f",
    "public.complete_character_level_up_v4(uuid,jsonb)":"f8338ef170c6e27b972e777eeae406b8",
    "public.complete_character_level_up_v3(uuid,jsonb)":"4467e166234c67fc12dd73da0e46b379",
    "private.can_manage_character_progression_v1(uuid)":"ac70e4ec033d86c4e0a254d50d429a45",
    "private.sync_character_progression_from_sheet_v1()":"bb1a3a2d1600ce33cd4fcadac5e0f3a9",
    "private.validate_and_materialize_player_forge_class_options_v1()":"6df5aee6f0519c9c77758d6e887ed8e4",
    "private.materialize_player_forge_feat_instances_v1()":"c27c4181a51cfd018bbb8244e9931550",
  };
  const originalHash = "4f1752db655b6ba490113f604c7583ef";
  assert.equal(hash(originalValidator), originalHash);
  const storyName = "public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)";
  const storyHash = hash(storyName);
  const triggers = () => sql("SELECT jsonb_agg(jsonb_build_array(tgname,tgenabled,tgdeferrable,tginitdeferred,pg_get_triggerdef(oid)) ORDER BY tgname) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND tgname IN ('character_progression_validate_player_forge_class_options_v1','character_progression_validate_player_forge_class_options_v2','character_progression_reject_unmarked_legacy_warlock_invocation','cancel_invalid_level_up_session_v1')");
  const guardSnapshot = triggers();
  assert.equal(JSON.parse(guardSnapshot).length,4);

  // Expand I1-G's dependency table without deleting its one historical
  // privileged validation specimen. Its prior columns remain unchanged.
  sql(`ALTER TABLE public.character_option_catalog ADD COLUMN option_key text,
      ADD COLUMN raw_payload jsonb, ADD COLUMN description text;
    ALTER TABLE public.character_option_grant_instances
      ADD COLUMN option_key text, ADD COLUMN option_type text NOT NULL DEFAULT 'feat',
      ADD COLUMN option_name text, ADD COLUMN option_source text,
      ADD COLUMN instance_key text, ADD COLUMN acquisition_label text,
      ADD COLUMN acquisition_level int NOT NULL DEFAULT 1 CHECK (acquisition_level BETWEEN 1 AND 20),
      ADD COLUMN choices jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(choices)='object'),
      ADD COLUMN effects jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(effects)='array'),
      ADD COLUMN fixed_spell_tokens jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(fixed_spell_tokens)='array'),
      ADD COLUMN repeatable boolean NOT NULL DEFAULT false,
      ADD COLUMN granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
      ADD UNIQUE(character_id,instance_key);
    UPDATE public.character_option_grant_instances g
      SET option_name=o.name,option_source=o.source,instance_key='i1g-privileged-fixture-'||g.id::text
      FROM public.character_option_catalog o WHERE o.id=g.option_id;
    ALTER TABLE public.character_option_grant_instances
      ALTER COLUMN option_name SET NOT NULL, ALTER COLUMN instance_key SET NOT NULL;
    ALTER TABLE public.character_level_up_sessions
      ALTER COLUMN id SET DEFAULT gen_random_uuid(),
      ADD COLUMN from_level int, ADD COLUMN to_level int,
      ADD COLUMN metadata_ready boolean NOT NULL DEFAULT true,
      ADD COLUMN preview jsonb NOT NULL DEFAULT '{}',
      ADD COLUMN required_choices jsonb NOT NULL DEFAULT '[]',
      ADD COLUMN selections jsonb NOT NULL DEFAULT '{}',
      ADD COLUMN created_by uuid, ADD COLUMN completed_at timestamptz;
    ALTER TABLE public.class_feature_option_catalog ADD COLUMN description text;
    ALTER TABLE public.class_feature_catalog ADD COLUMN description text;
    ALTER TABLE public.spells_catalog ADD COLUMN description text, ADD COLUMN range_text text;
    CREATE OR REPLACE VIEW public.spells_catalog_preferred AS SELECT * FROM public.spells_catalog;
    DROP VIEW public.character_option_catalog_preferred;
    CREATE VIEW public.character_option_catalog_preferred WITH (security_invoker=true) AS
      SELECT * FROM public.character_option_catalog WHERE source='XPHB';
    REVOKE ALL ON public.character_option_catalog_preferred,public.spells_catalog_preferred FROM PUBLIC,anon,authenticated;
    ALTER TABLE public.class_level_progression
      ADD COLUMN features jsonb NOT NULL DEFAULT '[]',
      ADD COLUMN cantrips_known int, ADD COLUMN spells_known int;
    ALTER TABLE public.class_catalog ADD COLUMN caster_progression text;
    UPDATE public.class_catalog SET caster_progression='pact' WHERE id=${q(targetClass)};
    UPDATE public.class_level_progression SET cantrips_known=2,spells_known=class_level+1
      WHERE class_id=${q(targetClass)} AND class_level IN (1,2);
    INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots,cantrips_known,spells_known)
      VALUES(${q(targetClass)},3,900,2,'[0,2]',2,4);
    INSERT INTO public.class_feature_catalog(id,feature_key,feature_type,name,source,class_key,class_name,class_source,subclass_name,level,description)
      VALUES(gen_random_uuid(),'i2j-story-lifecycle-warlock','class','Eldritch Invocations','XPHB','warlock','Warlock','XPHB',NULL,1,
          'Whenever you gain a Warlock level, you can replace one of your invocations.'),
        (gen_random_uuid(),'i2j-story-lifecycle-fiend','subclass','Fiend Patron','XPHB','warlock','Warlock','XPHB','Fiend',3,'Disposable lineage');
  `);
  sql(segment(sources.grantDdl,"CREATE TABLE public.character_option_grants (","-- The following original source functions"));
  sql("ALTER TABLE public.character_option_grants ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.character_option_grants FROM PUBLIC,anon,authenticated");
  install("forgeAuthority","private.validate_player_forge_feat_instances_v1");
  install("materializer","private.materialize_player_forge_feat_instances_v1");
  sql(segment(sources.grantDdl,"CREATE TRIGGER character_progression_materialize_player_forge_feat_instances_v","-- Source-original downstream authority guards"));
  install("guards","private.guard_direct_character_authority_mutation_v1");
  install("classGuards","private.guard_direct_class_option_authority_mutation_v1");
  sql(segment(sources.grantDdl,"CREATE TRIGGER character_option_grant_instances_direct_authority_guard_v1","-- Three original downstream"));
  sql(segment(sources.classGuards,"create trigger character_class_option_instances_direct_authority_guard_v1","execute function private.guard_direct_class_option_authority_mutation_v1();")+"execute function private.guard_direct_class_option_authority_mutation_v1();");
  sqlFile(pins.creator[0]);
  install("cash","private.player_forge_cash_equipment_option_v1","private.format_copper_currency_v1");

  // Read original P1.3 helper bodies without loading its incompatible empty
  // fixture or shadowing I1-H's existing tables and triggers.
  const p13Scope = functionBody(sources.p13,"private.p13_only_plain_fighter");
  sql(once(once(p13Scope,"v_class IS DISTINCT FROM 'fighter' OR p_to_level<>2","v_class IS DISTINCT FROM 'warlock' OR p_to_level NOT IN (2,3,4)"),
    "Reduced P1.3 fixture only supports featureless Fighter level 2","Joined fixture only supports Warlock 1→2 and 2→3"));
  install("p13","private.p13_only_empty","private.apply_level_up_artificer_plans_v1",
    "private.apply_level_up_replacements_v1","private.apply_level_up_wizard_signature_spells_v1",
    "private.apply_level_up_subclass_choices_v1","private.apply_tough_progression_bonus_v1",
    "private.simple_level_class_choice_groups_v1","private.additional_level_class_choice_groups_v1",
    "private.level_has_feature_v1","public.get_character_progression_v1");
  const gap = functionBody(sources.p13,"private.level_up_persistent_choice_gaps_v1");
  sql(once(gap,"$1<>'fighter' OR $2<>'XPHB' OR $3<>1 OR $4<>2",
    "$1<>'warlock' OR $2<>'XPHB' OR NOT (($3=1 AND $4=2) OR ($3=2 AND $4=3))"));
  for(const name of ["private.p13_only_plain_fighter","private.level_up_persistent_choice_gaps_v1",
    "private.can_manage_character_progression_v1","private.sync_character_progression_from_sheet_v1",
    "private.complete_character_level_up_base_v3","private.sync_player_forge_class_spell_summary_v1"]){
    internal.add(name);
  }
  if (sql("SELECT to_regclass('public.class_catalog_preferred') IS NULL")==="t") {
    sql("CREATE VIEW public.class_catalog_preferred AS SELECT * FROM public.class_catalog WHERE source='XPHB'");
    sql("REVOKE ALL ON public.class_catalog_preferred FROM PUBLIC,anon,authenticated");
  }
  install("catalog","public.is_preferred_class_version_v1");
  install("subclass","private.resolve_subclass_choice_v1");
  install("spellAccess","private.level_up_spell_access_v1");
  install("arch","private.player_sheet_skill_key_v1");
  install("origin","private.origin_feat_spell_choice_v1","private.origin_feat_skill_choice_valid_v1",
    "private.origin_feat_tool_choice_valid_v1","private.validate_source_owned_origin_feat_v1");
  install("reversal","private.other_character_option_effect_claim_v1","private.apply_source_owned_origin_feat_v1","private.remove_source_owned_origin_feat_v1");
  install("earn","private.level_up_warlock_invocation_groups_v1","private.apply_level_up_warlock_invocations_v1");
  install("projection","private.sync_character_eldritch_invocations_v1");
  install("group","private.level_up_warlock_invocation_replacement_group_v1","private.apply_level_up_warlock_invocation_replacement_v1");
  install("parent","private.ensure_character_source_choices_v1","private.apply_level_up_warlock_invocation_replacement_v2");
  install("battle","private.apply_level_up_battle_master_maneuvers_v1");
  install("wizard","private.apply_level_up_wizard_savant_v1");
  sql(sources.progression);
  const base = "private.complete_character_level_up_base_v3(uuid,jsonb)";
  assert.equal(hash(base),"e33639d549ef557976a3970ea51f5238");
  const replaceV1 = "private.apply_level_up_warlock_invocation_replacement_v1(uuid,integer,jsonb,jsonb,jsonb)";
  const replaceV2 = "private.apply_level_up_warlock_invocation_replacement_v2(uuid,integer,jsonb,jsonb,jsonb)";
  assert.equal(hash(replaceV1),"434994105f465b6ed92fdb80942f9942");
  assert.equal(hash(replaceV2),"7f3d2e2683dd4033b5862e591ac5bccc");
  const materialize = "private.apply_source_owned_origin_feat_v1(uuid,integer,uuid,jsonb,text,text,text)";
  const remove = "private.remove_source_owned_origin_feat_v1(uuid,text,text,text)";
  assert.equal(hash(materialize),"b7d69d8643a6b2ba2be8efbb4ee41243");

  // Match the existing disposable Option A omissions, leaving original
  // application RPCs, writer inputs and canonical transactions in place.
  const mirrors = [
    [base,baseMirror],["private.sync_player_forge_class_spell_summary_v1(uuid)",mirror],
    ["private.sync_character_eldritch_invocations_v1(uuid)",mirror],
    ["private.apply_level_up_warlock_invocations_v1(uuid,integer,jsonb,jsonb)",earnedMirror],
    [materialize,mirror],[replaceV1,mirror],
    ["private.ensure_character_source_choices_v1(uuid)",
      "    update public.players p set sheet=v_sheet,updated_at=now()\n"+
      "    where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);"],
  ];
  for(const [name,line] of mirrors) sql(once(def(name),line,canonicalOnly));
  sqlFile(pins.provenance[0]);
  const originalRemove=def(remove);
  const introduced="coalesce((v_effect->>'introduced')::boolean,false)";
  assert.equal(originalRemove.split(introduced).length,4);
  sql(once(originalRemove.replaceAll(introduced,"private.i2j_managed_effect_introduced(p_character_id,v_effect)"),mirror,canonicalOnly));

  // One authoritative identity index is already in the Forge fixture. Keep it
  // and install the legacy label index used by the historical spell suite.
  assert.equal(sql("SELECT to_regclass('public.character_spells_source_unique') IS NOT NULL"),"t");
  const labelIndex=sources.spellIndex.match(/create unique index if not exists character_spells_unique_source_idx[\s\S]*?;/i);
  assert.ok(labelIndex);
  sql(labelIndex[0]);
  sql(segment(sources.resources,"create table if not exists public.character_spell_slots (","create or replace function private.sync_character_spell_slots_v1("));
  install("resources","private.sync_character_spell_slots_v1","private.character_sheet_resource_profile_json_v1",
    "public.character_sheet_resource_profile_v1","public.update_character_spell_use_v1");
  for(const source of ["resources","group","parent","reversal","origin"]){
    const acl=sources[source].split("\n").filter(line =>
      /^(revoke all|grant execute) on function (public\.(character_sheet_resource_profile_v1|update_character_spell_use_v1|complete_character_level_up_v5)|private\.(sync_character_spell_slots_v1|character_sheet_resource_profile_json_v1|apply_level_up_warlock_invocation_replacement_v[12]|ensure_character_source_choices_v1|remove_source_owned_origin_feat_v1|apply_source_owned_origin_feat_v1|validate_source_owned_origin_feat_v1|other_character_option_effect_claim_v1|level_up_warlock_invocation_replacement_group_v1))\(/.test(line));
    if (acl.length) sql(acl.join("\n"));
  }
  for(const name of internal) sql("REVOKE ALL ON FUNCTION "+name+" FROM PUBLIC,anon,authenticated");
  sql("REVOKE ALL ON FUNCTION public.complete_character_level_up_v3(uuid,jsonb),public.complete_character_level_up_v4(uuid,jsonb),public.get_character_progression_v1(uuid) FROM PUBLIC,anon,authenticated");
  sql("NOTIFY pgrst,'reload schema'");

  function verify() {
    for(const [name,expected] of Object.entries(fingerprints)) assert.equal(hash(name),expected,name);
    assert.equal(hash(replaceV2),"7f3d2e2683dd4033b5862e591ac5bccc");
    assert.equal(hash(storyName),storyHash);
    assert.equal(triggers(),guardSnapshot);
    for(const name of internal) {
      assert.equal(sql("SELECT has_function_privilege('authenticated',"+q(name)+"::regproc,'EXECUTE')"),"f",name);
    }
  }
  verify();
  return {
    verify,
    applyFinalStateCandidate() {
      let candidate=once(def(originalValidator),"  v_expected integer:=0;",
        "  v_current public.character_progression%rowtype;\n  v_expected integer:=0;");
      candidate=once(candidate,"  select * into v_class from public.class_catalog where id=new.class_id;",
        "  select * into v_current from public.character_progression where character_id=new.character_id;\n"+
        "  if not found then\n"+
        "    if not exists(select 1 from public.characters where id=new.character_id) and not exists(select 1 from public.character_class_option_grant_instances where character_id=new.character_id) then return new; end if;\n"+
        "    raise exception 'Warlock progression missing at deferred validation.';\n"+
        "  end if;\n  select * into v_class from public.class_catalog where id=v_current.class_id;");
      assert.ok(candidate.includes("new.class_level"));
      sql(candidate.replaceAll("new.class_level","v_current.class_level"));
      assert.notEqual(hash(originalValidator),originalHash);
      verify();
    },
    fingerprintReceipt() {
      return "v5 "+hash("public.complete_character_level_up_v5(uuid,jsonb)")+
        " Story "+storyHash+" creation feat "+hash("private.materialize_player_forge_feat_instances_v1()")+
        " deferred validator "+hash(originalValidator);
    },
  };
}
