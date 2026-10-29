import fs from "node:fs";
import assert from "node:assert/strict";

const component = fs.readFileSync("components/TacticalCharacterResourceBridge.js", "utf8");
const workflow = fs.readFileSync(".github/workflows/validate-encounter-rest-release-candidate.yml", "utf8");

assert.match(component, /const latestProfileRef = useRef\(null\)/, "Realtime comparison must use latest resolved profile");
assert.match(component, /latestProfileRef\.current = nextProfile/, "Profile snapshot should update synchronously after RPC response");
assert.match(component, /eventType === "UPDATE"/, "Echo filtering must never discard INSERT or DELETE");
for (const field of ["pool_key", "slot_level", "slots_remaining", "slots_max", "recharge_key"]) {
  assert.ok(component.includes("row." + field), "Slot comparison missing " + field);
}
assert.match(component, /if \(!unchanged\) void load\(\)/, "Genuine resource updates must reload");
assert.match(component, /text\(current\?\.characterId\) === characterId/, "Snapshot must belong to same character");
assert.match(component, /loading && !currentProfile/, "Show loading only if current profile is not already available");
assert.match(component, /!error && currentProfile && profile\?\.persistentResourcesLinked/, "Preserve current profile while refreshing");
assert.ok(workflow.includes("node scripts/validate_tactical_resource_bridge_refresh.mjs"), "Release CI must run resource bridge guard");
assert.ok(workflow.includes("components/TacticalCharacterResourceBridge.js"), "Release CI must trigger on bridge changes");
console.log("Resource bridge echo suppression and stable loading contracts passed");
