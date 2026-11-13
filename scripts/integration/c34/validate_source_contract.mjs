#!/usr/bin/env node
/**
 * C34: static source/provenance gate for the clean-main, NONDEPLOYABLE
 * NPC privacy + Forge research candidate. Never connects to a DB.
 *
 * A green result proves source identity and dependency shape ONLY.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
export const STAGES = Object.freeze([
  { id: "immutable-forge", file: "01_forge_immutable_intent.sql", sha: "99bceee24c1718570237e70a65fe3172f4c9fbc9", pr: 324, kind: "original-private-Forge-copy" },
  { id: "npc-stage1", file: "02_npc_profile_stage1.sql", sha: "9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3", pr: 345, kind: "full-sheet-rls-and-public-projection" },
  { id: "npc-stage2", file: "03_npc_dossier_stage2.sql", sha: "afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac", pr: 345, kind: "gm-dossier-and-column-acl" },
  { id: "npc-stage3", file: "04_private_story_stage3.sql", sha: "01e48823ac3a46aa5880e98200e97c2595501ce7", pr: 345, kind: "creator-attribution-and-story" },
  { id: "inventory-rls", file: "05_inventory_constraint_rls.sql", sha: "4532ddb8db642d0d0ab14646a3e87c034d4134c6", pr: 324, kind: "four-policies-and-legacy-check" },
  { id: "story-nonce", file: "06_story_complete_nonce_i1c.sql", sha: "91f5fb918bf205f2d4462e2ff0089f656601328e", pr: 351, kind: "story-inclusive-immutable-intent" },
]);

export const RELEASE_BLOCKERS = Object.freeze([
  "Original 31-trigger Forge graph has not been co-resident-tested in a fully faithful PG17 fixture.",
  "Option A legacy account sheet: 12/34 original writers bounded-tested, 22 untested; no production cutover.",
  "Full signed app-browser GM/creator/co-editor/inventory-only/outsider and Town/Shop/Print parity not accepted.",
  "Immutable Forge nonce, creator Story, equipment, RLS and inventory CHECK not yet jointly RED/GREEN tested.",
  "Original SQL source guards must pass on a disposable PG17/GoTrue database; this static gate cannot prove that.",
  "Independent encrypted DB and Storage restore rehearsal, staged rollout and owner go/no-go are outstanding.",
  "Original #345 UI changes and its source consumers are NOT in this research branch.",
  "Combat delegated control, replay and global lock-order release (#312/#317) remain separate and held.",
]);

function gitBlobSha(raw) {
  return createHash("sha1").update("blob " + raw.length + "\0").update(raw).digest("hex");
}

const requiredContracts = Object.freeze({
  "immutable-forge": [
    /private\.reserve_player_creation_intent_v1\s*\(/,
    /private\.complete_player_creation_intent_v1\s*\(/,
    /private\.create_player_character_v3_source_20261105\s*\(/,
    /FOR UPDATE/i,
  ],
  "npc-stage1": [
    /ALTER POLICY character_sheets_select_visible_or_assigned/i,
    /public\.get_npc_profile_visible_v1\s*\(/i,
  ],
  "npc-stage2": [
    /REVOKE SELECT\s*\(/i,
    /public\.get_npc_dossier_admin_v1\s*\(/i,
    /public\.get_character_editor_narrative_v1\s*\(/i,
  ],
  "npc-stage3": [
    /CREATE TRIGGER characters_capture_creator_at_insert_v1/i,
    /public\.character_backstory_secrets/i,
    /public\.character_public_secret_revelations/i,
    /public\.create_player_character_with_private_backstory_v1\s*\(/i,
    /ON CONFLICT\s*\(character_id\)\s*DO NOTHING/i,
  ],
  "inventory-rls": [
    /ALTER POLICY inventory_items_insert_owner_or_admin/i,
    /ALTER POLICY inventory_items_update_owner_or_admin/i,
    /ALTER POLICY inventory_items_delete_owner_or_admin/i,
    /ALTER POLICY inventory_items_select_owner_or_admin/i,
    /DROP CONSTRAINT inventory_items_owner_type_chk/i,
    /private\.can_access_character_v1\s*\(/i,
  ],
  "story-nonce": [
    /__dndnext_private_story_intent_sha256_i1c/,
    /private\.reserve_player_creation_intent_v1\s*\(/,
    /private\.create_player_character_v3_source_20261105\s*\(/,
    /public\.create_player_character_with_private_backstory_v1\s*\(/,
    /SECURITY INVOKER/i,
    /ON CONFLICT\s*\(character_id\)\s*DO NOTHING/i,
  ],
});

/**
 * The caller can inject a reader for pure mutation/negative unit tests.
 * No dynamically composed SQL is emitted by this tool.
 */
export function auditSources(readSource = (f) => fs.readFileSync(path.join(dir, "sources", f))) {
  const stages = STAGES.map((stage) => {
    const raw = readSource(stage.file);
    assert.ok(Buffer.isBuffer(raw), stage.file + ": reader must return raw bytes");
    const sha = gitBlobSha(raw);
    assert.equal(sha, stage.sha, stage.file + ": original Git blob drift; stop");
    const source = raw.toString("utf8");
    for (const contract of requiredContracts[stage.id]) {
      assert.match(source, contract, stage.id + ": original contract missing");
    }
    const begin = (source.match(/^BEGIN;\s*$/gm) || []).length;
    const commit = (source.match(/^COMMIT;\s*$/gm) || []).length;
    const expectedTxn = ["npc-stage1", "npc-stage2", "npc-stage3", "inventory-rls"].includes(stage.id);
    assert.equal(begin, expectedTxn ? 1 : 0, stage.id + ": BEGIN mismatch");
    assert.equal(commit, expectedTxn ? 1 : 0, stage.id + ": COMMIT mismatch");
    const meta = source.split(/\r?\n/).filter((line) => /^\s*\\/.test(line));
    assert.deepEqual(meta, stage.id === "story-nonce" ? ["\\set ON_ERROR_STOP on"] : [],
      stage.id + ": unreviewed psql command");
    return { id: stage.id, sourcePr: stage.pr, gitBlobSha: sha, bytes: raw.length,
      transactions: expectedTxn ? "wrapped-by-original" : "source-without-transaction" };
  });
  assert.deepEqual(stages.map((s) => s.id), STAGES.map((s) => s.id),
    "Do not reorder dependent original sources without a new review");
  return { classification: "SOURCE_ONLY_RESEARCH_NOT_RELEASE_READY",
    sourceIntegrity: "PASS", stageCount: stages.length, stages,
    executableJointSqlEmitted: false, originalAppFilesChanged: false,
    releaseBlocked: true, releaseBlockers: RELEASE_BLOCKERS };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && ["--json", "--release"].includes(args[0])),
    "Allowed: --json or --release");
  const report = auditSources();
  console.log(JSON.stringify(report, null, 2));
  if (args[0] === "--release") {
    console.error("RELEASE BLOCKED: static source parity is not an integration acceptance test");
    process.exitCode = 1;
  }
}
