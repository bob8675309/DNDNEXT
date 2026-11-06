#!/usr/bin/env node
// Deterministic inputs and assertions only. Real Forge authority is exercised
// by the existing disposable PG17 + GoTrue/PostgREST source-authentic suite.
// No network clients, DB connection strings, D&D rule resolution, or AI.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const SCHEMA_VERSION = 1;
export const ORIGINAL_SUBCLASS_HANDLER_MD5 = "273be29420a7274d997642e302604cb7";
export const MANIFEST_PATH = new URL("../fixtures/forge_seeded_scenarios_v1.json", import.meta.url);
const ACTOR = "PLAYER";
const RPCS = new Set(["create_player_character_v2", "create_player_character_v3"]);
const IDS = /^[a-z][a-z0-9-]{5,63}$/;
const COUNTS = ["characters", "sheets", "progression", "events", "grants", "instances", "items", "currency"];
const keys = (x) => Object.keys(x).sort();
const exactKeys = (obj, names, label) => {
  assert.ok(obj && typeof obj === "object" && !Array.isArray(obj), label + " must be object");
  assert.deepEqual(keys(obj), [...names].sort(), label + " fields changed");
};
const plain = (x) => JSON.parse(JSON.stringify(x));
export function loadManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}
export function validateManifest(data) {
  exactKeys(data, ["schemaVersion", "suite", "scenarios"], "manifest");
  assert.equal(data.schemaVersion, SCHEMA_VERSION);
  assert.equal(data.suite, "forge-player-source-seeded-v1");
  assert.ok(Array.isArray(data.scenarios) && data.scenarios.length === 2,
    "First slice permits exactly two separately receipted scenarios");
  const seen = new Set();
  for (const item of data.scenarios) {
    exactKeys(item, ["scenarioId", "seed", "rpc", "actor", "source", "negative", "expectedCounts"], "scenario");
    assert.match(item.scenarioId, IDS);
    assert.ok(!seen.has(item.scenarioId), "Duplicate scenario ID");
    seen.add(item.scenarioId);
    assert.ok(Number.isSafeInteger(item.seed) && item.seed > 0 && item.seed <= 4294967000);
    assert.ok(RPCS.has(item.rpc), "Unreviewed RPC: " + item.rpc);
    assert.equal(item.actor, ACTOR, "Only signed-in PLAYER is covered");
    exactKeys(item.source, ["classKey", "classSource", "level", "subclassName", "subclassSource"], "source");
    assert.deepEqual(item.source, {
      classKey: "fighter", classSource: "XPHB", level: 3,
      subclassName: "Champion", subclassSource: "XPHB"
    }, "Source-qualified fixture is limited to the original J142-J153 catalog");
    exactKeys(item.negative, ["changedSource", "invalidSubclass", "changedIntentSqlstate", "invalidMessageContains"], "negative");
    assert.equal(item.negative.changedSource, "PHB");
    assert.equal(item.negative.invalidSubclass, "Purple Dragon");
    assert.equal(item.negative.changedIntentSqlstate, "22023");
    assert.equal(item.negative.invalidMessageContains,
      "The selected subclass Purple Dragon is not available for the fighter class");
    exactKeys(item.expectedCounts, COUNTS, "expected counts");
    for (const key of COUNTS)
      assert.equal(item.expectedCounts[key], 1, "First slice canonical one-row assertion: " + key);
  }
  assert.deepEqual(data.scenarios.map(x => x.rpc).sort(), [...RPCS].sort(),
    "Both original v2 and original v3 wrappers must be exercised");
  return data;
}
function digest(scenarioId, seed, purpose) {
  return createHash("sha256").update("dndnext-forge-seeded-v1/" + scenarioId + "/" + seed + "/" + purpose).digest("hex");
}
function requestUuid(hex) {
  // RFC4122 version-4-shaped UUID derived from a public deterministic fixture seed.
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-4" + hex.slice(13, 16)
    + "-a" + hex.slice(17, 20) + "-" + hex.slice(20, 32);
}
export function compileScenario(item, offset = 0) {
  assert.ok(Number.isSafeInteger(offset) && offset >= 0 && offset <= 1000);
  const seed = item.seed + offset;
  assert.ok(Number.isSafeInteger(seed) && seed <= 4294967295);
  const normal = digest(item.scenarioId, seed, "create");
  const invalid = digest(item.scenarioId, seed, "invalid-new-request");
  return {
    schemaVersion: SCHEMA_VERSION,
    scenarioId: item.scenarioId,
    seed,
    actor: item.actor,
    rpc: item.rpc,
    source: plain(item.source),
    negative: plain(item.negative),
    expectedCounts: plain(item.expectedCounts),
    requestId: requestUuid(normal),
    name: "Scenario " + item.scenarioId + " " + normal.slice(0, 8),
    invalidRequestId: requestUuid(invalid),
    invalidName: "Scenario invalid " + item.scenarioId + " " + invalid.slice(0, 8)
  };
}
export function compileSuite(data, offset = 0) {
  validateManifest(data);
  return {
    schemaVersion: SCHEMA_VERSION, suite: data.suite,
    cases: data.scenarios.map(x => compileScenario(x, offset))
  };
}
export async function runSeededForgeScenarios(data, backend) {
  const compiled = compileSuite(data);
  for (const required of ["originalSourceHash", "makePayload", "rpc", "snapshot", "globalCounts", "hasReservation"])
    assert.equal(typeof backend[required], "function", "Missing real signed-in adapter: " + required);
  assert.equal(backend.originalSourceHash(), ORIGINAL_SUBCLASS_HANDLER_MD5,
    "Original PostgreSQL subclass handler source hash drift");
  const reports = [];
  // The changed seed must produce a second valid case, not just a static UUID.
  const work = [compiled.cases[0], compileScenario(data.scenarios[0], 1), compiled.cases[1]];
  const usedIds = new Set();
  for (const item of work) {
    assert.ok(!usedIds.has(item.requestId), "Derived scenario nonce collision");
    usedIds.add(item.requestId);
    const payload = backend.makePayload(item);
    assert.equal(payload.creation_request_id, item.requestId);
    assert.equal(payload.name, item.name);
    assert.equal(payload.sheet.classKey, item.source.classKey);
    assert.equal(payload.sheet.level, item.source.level);
    assert.equal(payload.sheet.subclassName, item.source.subclassName);
    assert.equal(payload.sheet.subclassSource, item.source.subclassSource);
    const created = await backend.rpc(item, payload);
    assert.ifError(created.error);
    assert.match(created.data, /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i, "RPC must return actual character UUID");
    const cid = created.data;
    const original = backend.snapshot(cid);
    for (const [key, count] of Object.entries(item.expectedCounts))
      assert.equal(original.counts[key], count, item.scenarioId + " missing canonical " + key);
    assert.deepEqual(original.source, item.source, "Original DB did not persist exact source/edition");
    assert.equal(original.editorAuthenticated, true, "Original creator identity not authenticated");
    const globalsAfterCreate = backend.globalCounts();
    const same = await backend.rpc(item, payload);
    assert.ifError(same.error);
    assert.equal(same.data, cid, "Immutable same-intent replay changed character");
    assert.deepEqual(backend.snapshot(cid), original, "Same-intent replay changed canonical rows");
    assert.deepEqual(backend.globalCounts(), globalsAfterCreate,
      "Same-intent replay inserted extra canonical rows or stock");
    const altered = plain(payload);
    altered.sheet.subclassSource = item.negative.changedSource;
    const rejected = await backend.rpc(item, altered);
    assert.ok(rejected.error, "Changed source intent unexpectedly succeeded");
    assert.equal(rejected.error.code, item.negative.changedIntentSqlstate);
    assert.deepEqual(backend.snapshot(cid), original, "Changed-intent replay mutated canonical rows");
    assert.deepEqual(backend.globalCounts(), globalsAfterCreate,
      "Changed-intent replay inserted rows or stock");
    const invalidPlan = { ...item, requestId: item.invalidRequestId, name: item.invalidName };
    const invalidPayload = backend.makePayload(invalidPlan);
    invalidPayload.sheet.subclassName = item.negative.invalidSubclass;
    const freshFailure = await backend.rpc(item, invalidPayload);
    assert.ok(freshFailure.error, "Original handler accepted unknown source subclass");
    assert.ok((freshFailure.error.message || "").toLowerCase().includes(
      item.negative.invalidMessageContains.toLowerCase()),
      "Failure did not reach source-original subclass validator: " + freshFailure.error.message);
    assert.equal(backend.hasReservation(item.invalidRequestId), false,
      "Failed create left reserved immutable nonce");
    assert.deepEqual(backend.globalCounts(), globalsAfterCreate,
      "Rejected original new creation failed atomic rollback");
    assert.deepEqual(backend.snapshot(cid), original, "Rejected new creation modified previous actor");
    reports.push({
      scenarioId: item.scenarioId, seed: item.seed, rpc: item.rpc,
      source: item.source, expectedCounts: item.expectedCounts,
      observedCounts: original.counts,
      checks: {
        sourceHandlerHashVerified: true, realAuthenticatedCreation: true,
        unchangedReplayInert: true, changedSourceRejectedSqlstate: rejected.error.code,
        invalidNewSubclassRolledBack: true, originalCreatorIdentityVerified: true
      }
    });
    console.log("PASS SCENARIO " + item.scenarioId + " seed=" + item.seed
      + " real signed Forge + inert replay + changed intent + source-error rollback");
  }
  return {
    schemaVersion: SCHEMA_VERSION, suite: data.suite, fixture: "disposable-pg17-real-local-gotrue-postgrest",
    originalSubclassHandlerMd5: ORIGINAL_SUBCLASS_HANDLER_MD5,
    baseline: "existing-J00-J153-passed-in-same-process",
    cases: reports, limitations: [
      "reduced local source catalog and editor RLS; not full production parity",
      "no browser acceptance, live Supabase SQL or deployed creation candidate",
      "global CP/CS/G/GI/I/C lock-order and missing original triggers remain open"
    ]
  };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  assert.ok(args.includes("--emit") && args.length <= 2, "Use --emit [--offset=N] only");
  const extra = args.filter(x => x !== "--emit");
  assert.ok(extra.length <= 1 && (extra.length === 0 || /^--offset=[0-9]{1,3}$/.test(extra[0])));
  const offset = extra.length ? Number(extra[0].split("=")[1]) : 0;
  process.stdout.write(JSON.stringify(compileSuite(loadManifest(), offset)) + "\n");
}
