import assert from "node:assert/strict";
import fs from "node:fs";
const read = path => fs.readFileSync(path,"utf8");
const setup=read("pages/encounters/live.js");
const move=read("pages/encounters/play.js");
const combat=read("pages/encounters/combat.js");
const workflow=read(".github/workflows/validate-encounter-rest-release-candidate.yml");
assert.match(setup,/const \[teamDraft, setTeamDraft\] = useState\("players"\)/);
assert.match(setup,/setTeamDraft\(selectedParticipant\.team \|\| "players"\)/);
assert.match(setup,/p_team: teamDraft/);
assert.match(setup,/aria-label="Selected participant team"/);
assert.match(setup,/!hasHostilePair \? <p role="status"/);
assert.match(move,/!hasHostilePair \? <div className="waiting" role="status"/);
for(const source of [setup,move]){
 assert.match(source,/p\.team === "enemies"/);
 assert.match(source,/\["players", "allies"\]\.includes\(p\.team\)/);
}
assert.match(combat,/const manualSpells = useMemo/);
assert.match(combat,/Spells without a reviewed adapter cannot be cast/);
assert.match(combat,/Tactical adapter not yet implemented/);
assert.match(combat,/manualSpells\.map/);
assert.match(combat,/supportedSpells\.length \? <>/);
assert.doesNotMatch(combat,/SUPPORTED_SPELL_KEYS = new Set\(\[[\s\S]*?"eldritch-blast\|xphb"/);
assert.ok(workflow.includes("node scripts/validate_encounter_team_spell_visibility.mjs"));
console.log("Encounter hostile-team staging and known-spell disclosure contracts passed");
