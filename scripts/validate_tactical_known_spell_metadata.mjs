import assert from "node:assert/strict";
import fs from "node:fs";
import { tacticalKnownSpellAssignments, hasVerifiedKnownSpellAssignment }
  from "../utils/tacticalKnownSpellAssignments.mjs";

const spell = (known) => ({ assignmentId:"a",known,source:"XPHB" });
assert.deepEqual(tacticalKnownSpellAssignments(null),[]);
assert.deepEqual(tacticalKnownSpellAssignments({knownSpells:"invalid"}),[]);
const rows=tacticalKnownSpellAssignments({knownSpells:[
 spell(true),spell(false),{assignmentId:"legacy"},null
]});
assert.deepEqual(rows.map(s=>s.assignmentId),["a","legacy"]);
assert.equal(hasVerifiedKnownSpellAssignment(spell(true)),true);
assert.equal(hasVerifiedKnownSpellAssignment(spell(false)),false);
assert.equal(hasVerifiedKnownSpellAssignment({assignmentId:"legacy"}),false);
assert.equal(hasVerifiedKnownSpellAssignment(null),false);
const page=fs.readFileSync("pages/encounters/combat.js","utf8");
const sql=fs.readFileSync("sql/candidates/20261031_tactical_spell_profile_known_metadata_candidate.sql","utf8");
const local=fs.readFileSync("scripts/test_eldritch_blast_local_auth.mjs","utf8");
const activation=fs.readFileSync("scripts/fixtures/eldritch_blast_activate_profile_pg17.sql","utf8");
for(const m of ["tacticalKnownSpellAssignments(spellProfile)","knownSpells.filter(",
 "hasVerifiedKnownSpellAssignment(eldritchBlastAssignment)",
 "onCast={EB_STAGING_CAST_ENABLED && hasVerifiedKnownSpellAssignment(eldritchBlastAssignment)"]) 
 assert.ok(page.includes(m),m);
assert.ok(sql.includes("'known',a.known"));
assert.ok(sql.includes("encounter_can_control_participant_v1"));
assert.ok(activation.includes("\\i sql/candidates/20261031_tactical_spell_profile_known_metadata_candidate.sql"));
for(const m of ["set known=false","known,false","Unknown spell rejection","set known=true"])
 assert.ok(local.includes(m),"JWT unknown test: "+m);
console.log("Known spell: explicit false exclusion, legacy compatibility, staging fail-closed and signed JWT local contracts PASS");
