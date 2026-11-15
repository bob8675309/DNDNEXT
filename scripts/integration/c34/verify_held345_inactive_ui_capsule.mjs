#!/usr/bin/env node
// C34 preservation-only: held #345 Profile UI source must not be lost or
// mounted before the coordinated stage1/2/3 SQL + signed role/browser cutover.
// This validator DOES NOT call Supabase, deploy SQL, import UI or modify files.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const capsule = "scripts/integration/c34/preserved/held345/";
export const HELD345_UI_PINS = Object.freeze([
  ["components/GlobalNpcProfileOverlay.js", "a0e133a7c2446cba3f8c672a1df78f6a5aa73763"],
  ["utils/npcProfileOverlay.js", "3d809c47a9aaae18d0e7e5ec6500199a9266baac"],
  ["components/CreatorBackstoryPanel.js", "23b0e86aab7a80b7243365ba107c1d37a5ec5812"],
  ["styles/npc-profile-centered.css", "150eb9ad78aeba268be955e63c8451e3c0ed0e14"],
]);
const liveNotReady = Object.freeze([
  ["pages/_app.js", ["GlobalNpcProfileOverlay", "npc-profile-centered.css"]],
  ["components/NpcPanel.js", ["CreatorBackstoryPanel"]],
  ["pages/inventory.js", ["openNpcProfile("]],
  ["components/MapPageClient.js", ["map-npc-profile-centered"]],
]);

export function gitBlobHash(bytes) {
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash("sha1").update("blob " + body.length + "\0").update(body).digest("hex");
}

export function auditHeld345InactiveUiCapsule(reader = (p) => fs.readFileSync(path.join(root, p))) {
  const raw = (p) => {
    const content = reader(p);
    return Buffer.isBuffer(content) ? content : Buffer.from(content);
  };
  for (const [source, sha] of HELD345_UI_PINS) {
    const data = raw(capsule + source);
    assert.equal(gitBlobHash(data), sha, "held #345 inactive Profile source blob drift: " + source);
  }
  const profile = raw(capsule + "components/GlobalNpcProfileOverlay.js").toString("utf8");
  const creator = raw(capsule + "components/CreatorBackstoryPanel.js").toString("utf8");
  const event = raw(capsule + "utils/npcProfileOverlay.js").toString("utf8");
  const css = raw(capsule + "styles/npc-profile-centered.css").toString("utf8");
  for (const token of ['.select(PROFILE_COLUMNS)', 'onAuthStateChange', 'initialView="profile"', 'role="dialog"']) {
    assert.ok(profile.includes(token), "held #345 global Profile safety contract lost: " + token);
  }
  assert.ok(!profile.includes('select("*")'), "held #345 Profile cannot broaden its identity read");
  for (const token of ["can_edit_creator_backstory_v1", "character_backstory_secrets", "if (!authorized) return null"]) {
    assert.ok(creator.includes(token), "held #345 creator private-backstory contract lost: " + token);
  }
  assert.ok(event.includes("OPEN_NPC_PROFILE_EVENT") && event.includes("UUID_PATTERN.test(id)"),
    "held #345 event must retain its input gate");
  assert.ok(css.includes(".app-npc-profile-shell") && css.includes(".town-profile-sidepanel"),
    "held #345 CSS source geometry missing");
  // Fail closed if anyone silently imports any of the preserved UI before
  // the existing source/RLS/browser acceptance gates are explicitly replaced.
  for (const [file, forbidden] of liveNotReady) {
    const active = raw(file).toString("utf8");
    for (const token of forbidden) {
      assert.ok(!active.includes(token),
        "held #345 requires coordinated privacy SQL+UI cutover before activation: " + file + " / " + token);
    }
  }
  return { originalBlobs: HELD345_UI_PINS.length, sourceIntegrity: "PASS",
    runtimeMounted: false, productionReadiness: "HOLD" };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditHeld345InactiveUiCapsule();
  process.stdout.write(JSON.stringify(result) + "\n");
}
