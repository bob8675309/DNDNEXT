import fs from "node:fs";
import assert from "node:assert/strict";
const read=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const shell=read("pages/encounters/workspace.js");
assert.match(shell,/Encounter Workspace/);
assert.match(shell,/workspaceSessionId=\{sessionId\}/);
assert.match(shell,/onWorkspaceSessionChange=\{selection\}/);
for(const name of ["live","play","combat"]){
 const source=read("pages/encounters/"+name+".js");
 assert.match(source,/workspaceSessionId = ""/);
 assert.match(source,/onWorkspaceSessionChange\?\.\(/);
 assert.match(source,/href="\/encounters\/workspace"/);
}
assert.match(shell,/view === "map" \? <EncounterMapWorkshop \/>/);
assert.doesNotMatch(shell,/service_role|encounter_weapon_attack_atomic_candidate_v1/);
assert.ok(fs.existsSync(new URL("../styles/EncounterWorkspace.module.css",import.meta.url)));
console.log("Unified encounter workspace routing and session contracts PASS");
