#!/usr/bin/env node
// Pure free/offline manifest validation; NOT authenticated or browser acceptance.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { loadManifest, compileSuite, compileScenario, validateManifest, ORIGINAL_SUBCLASS_HANDLER_MD5 } from "./agents/forge_seeded_scenarios.mjs";

const file = resolve(fileURLToPath(new URL("./agents/forge_seeded_scenarios.mjs", import.meta.url)));
const execute = (...args) => JSON.parse(execFileSync(process.execPath, [file, "--emit", ...args],
  { encoding: "utf8", timeout: 10000, maxBuffer: 500000 }));
const spec = validateManifest(loadManifest());
const a = execute(), b = execute(), alteredSeed = execute("--offset=1");
assert.deepEqual(a, b, "Two fresh Node processes generated different scenario inputs");
assert.deepEqual(a, compileSuite(spec), "CLI and reusable module contract diverged");
assert.deepEqual(alteredSeed, compileSuite(spec, 1));
assert.equal(a.cases.length, 2);
assert.equal(new Set(a.cases.map(x => x.requestId)).size, 2);
for (let i = 0; i < a.cases.length; i++) {
  assert.notEqual(a.cases[i].requestId, alteredSeed.cases[i].requestId);
  assert.notEqual(a.cases[i].name, alteredSeed.cases[i].name);
  assert.equal(a.cases[i].source.subclassSource, "XPHB");
  assert.match(a.cases[i].requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(a.cases[i].schemaVersion, 1);
  assert.equal(a.cases[i].expectedCounts.grants, 1);
  assert.notEqual(a.cases[i].requestId, a.cases[i].invalidRequestId);
}
const bad = structuredClone(spec);
bad.scenarios[0].source.subclassSource = "PHB";
assert.throws(() => validateManifest(bad), /Source-qualified fixture/);
const unauthorized = structuredClone(spec);
unauthorized.scenarios[0].actor = "ADMIN";
assert.throws(() => validateManifest(unauthorized), /Only signed-in PLAYER/);
const permissive = structuredClone(spec);
permissive.scenarios[0].expectedCounts.items = 0;
assert.throws(() => validateManifest(permissive), /canonical one-row/);
const unknown = structuredClone(spec);
unknown.scenarios[0].skipRls = true;
assert.throws(() => validateManifest(unknown), /fields changed/);
assert.match(ORIGINAL_SUBCLASS_HANDLER_MD5, /^[a-f0-9]{32}$/);
assert.deepEqual(compileScenario(spec.scenarios[0],1),alteredSeed.cases[0]);
console.log("PASS STATIC deterministic scenario schema v1: two separate processes agree, changed seed yields a distinct legal source-qualified plan; unreviewed roles/rules/expectations fail closed.");
console.log("STATIC CONTRACT ONLY: real signed GoTrue/PG17 source execution and J00-J153 regression must pass separately.");
