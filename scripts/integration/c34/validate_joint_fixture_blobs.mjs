#!/usr/bin/env node
/**
 * Fail-closed raw Git blob check of original dependencies actually loaded by
 * C34 signed PostgreSQL 17 + genuine local GoTrue tests.
 * These are the exact source files at the test's operational paths, not merely
 * separately pinned copies. Deliberately excludes C34's newly-authored tests.
 * NO network, database connections, or schema modifications.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const ORIGINAL_JOINT_DEPENDENCIES = Object.freeze([
  ["sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql", "9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3"],
  ["sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql", "afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac"],
  ["sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql", "01e48823ac3a46aa5880e98200e97c2595501ce7"],
  ["sql/candidates/20261105_player_creation_immutable_intent_v1.sql", "99bceee24c1718570237e70a65fe3172f4c9fbc9"],
  ["sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql", "4532ddb8db642d0d0ab14646a3e87c034d4134c6"],
  ["sql/candidates/20261109_player_story_complete_intent_i1c_research.sql", "91f5fb918bf205f2d4462e2ff0089f656601328e"],
  ["scripts/fixtures/forge_creation_original_functions_pg17.sql", "6c64683e14ee148daf5c874a7e6e3c7ff606138c"],
  ["scripts/fixtures/c33_forge_privacy_original_policy_join_pg17.sql", "12612c4acbe861817037e1ab5a79ddb7c40a55e9"],
  ["scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql", "9c479d3f044268f73da3a5515d229096ce03f94a"],
  ["scripts/fixtures/forge_materializer_local_auth_extension_pg17.sql", "dad4f97a1a9ba8a2ed99b8ba8b6ac6cdd534103e"],
  ["scripts/fixtures/forge_materializer_original_functions_pg17.sql", "d6f5ac4f0cfd571edaa926b4168847eb85e18640"],
  ["scripts/fixtures/forge_owner_constraint_original_inventory_handlers_pg17.sql", "aafbfea03d565dfaa1599875ab49c3c485611c51"],
  ["scripts/fixtures/forge_inventory_policy_source_local_auth_pg17.sql", "e077a2b103fbbf1c1e5b5e437c8e877e6f619990"],
  ["scripts/fixtures/forge_inventory_access_original_pg17.sql", "930036668d4e889b85f1c5ad0abeed79793a5c09"],
  ["scripts/integration/c34/fixtures/forge_creation_replay_local_auth_pr351_pg17.sql", "aa701c679712475cd4f04d4e0a01fedc4616bafa"],
  ["scripts/integration/c34/fixtures/original_i1c_forge_private_story_nonce_local_auth.mjs", "90fb3058bc1c93ef72a331bad0747920c3c1202e"],
  ["scripts/fixtures/c33_forge_original_sprite_guard_local_pg17.sql", "d2f925129d198a443f1cea29d73ea56bff8b7a76"],
  ["scripts/fixtures/c33_forge_original_mog_guard_local_pg17.sql", "53bd80d36e94d3ac0f97d02d16a85881bdcf6b15"],
  ["scripts/fixtures/c33_forge_original_levelup_cancel_local_pg17.sql", "354ad33e1d86881244c48d090317e1906e3ed671"],
  ["scripts/fixtures/forge_subclass_choice_original_pg17.sql", "2b7da3a5e4f7c926c09312efb98f61a1244b0bc6"],
  ["scripts/fixtures/forge_progression_authority_original_pg17.sql", "3a0b6caeb6712f67af7895433df15f1439b19581"],
  ["scripts/fixtures/forge_progression_authority_local_auth_extension_pg17.sql", "413a82dc3c1913cb5f71c28531d31e19da89e02d"],
  ["scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql", "e6d574baa68dea6ad93f997941b3f062a234ff98"],
  ["scripts/fixtures/forge_feat_materializer_original_pg17.sql", "aa60a2699796fea20213dca55c5191e2beaa24ac"],
  ["scripts/fixtures/forge_feat_materializer_discriminators_original_pg17.sql", "b73e418b1f3b7fdbab528a9d52efe375af72e1e8"],
  ["sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql", "ecddcd514917a4d379d14b02477dfb41dbf44f29"],
  ["scripts/fixtures/forge_high_risk_original_progression_triggers_pg17.sql", "9da41b637b077ce5ab3f80e6308e0ca9b91fd002"],
]);
export function verifyOriginalJointDependencies(read=(name)=>fs.readFileSync(path.join(root,name))) {
  return ORIGINAL_JOINT_DEPENDENCIES.map(([file,expected])=>{
    const b=read(file);
    assert.ok(Buffer.isBuffer(b),"C34 original source reader must retain raw bytes");
    const sha=createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex");
    assert.equal(sha,expected,"C34 signed fixture/source drift: "+file);
    return {file,gitBlobSha:sha};
  });
}
if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length,2,"C34 source validator accepts no command-line actions");
  const evidence=verifyOriginalJointDependencies();
  console.log("PASS C34-S02: "+evidence.length+" operational signed-JWT candidate/fixture source blobs byte-identical to their original PRs");
}
