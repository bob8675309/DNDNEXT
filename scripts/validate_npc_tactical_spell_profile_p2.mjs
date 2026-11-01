// P2 source-only guard for proposed delegated NPC tactical spell visibility.
// True JWT PG17 tests execute actual candidate SQL separately in free CI.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("sql/candidates/20261101_npc_spell_profile_visibility_candidate.sql");
const ui=read("pages/encounters/combat.js");
const gen=read("scripts/fixtures/generate_npc_delegated_local_auth_fixture.mjs");
const fixture=read("scripts/fixtures/npc_spell_profile_source_shape_pg17.sql");
const jwt=read("scripts/test_npc_delegated_control_local_auth.mjs");
assert.ok(sql.includes("e4d6eac7759720b05af0de9dc6c6fc4e"),"Live source MD5 drift");
assert.match(sql,/CREATE OR REPLACE FUNCTION private\.encounter_spellcasting_profile_full_candidate_v1/);
assert.match(sql,/create or replace function public\.encounter_spellcasting_profile_v1/);
assert.match(sql,/private\.encounter_spellcasting_profile_full_candidate_v1\(v_p\.id\)/);
assert.match(sql,/private\.can_access_character_v1\(v_p\.character_id,'read'\)/);
assert.match(sql,/v_p\.controller_user_id=v_uid/);
assert.match(sql,/public\.is_admin\(v_uid\)/);
assert.match(sql,/ch\.kind in \('npc','merchant'\)/);
assert.match(sql,/coalesce\(cp\.can_control,false\)/);
assert.match(sql,/a\.known is true/);
assert.match(sql,/coalesce\(a\.prepared,false\)/);
assert.match(sql,/coalesce\(a\.always_available,false\)/);
assert.match(sql,/coalesce\(\(entry\.value->>'level'\)::integer,0\)=0/);
assert.match(sql,/order by entry\.ordinality/);
assert.match(sql,/jsonb_build_object\('known',true\)/);
for(const s of ["'visibilityScope','delegated-combat'","'spellListFiltered',true","'knownSpells',v_visible","'slotSnapshot',v_slots","using errcode='42501'"])
 assert.ok(sql.includes(s),"Missing visibility boundary: "+s);
for(const s of ["'characterSheet'","'fullSheet'","'knownSpells',v_full->'knownSpells'","'canonicalSlotProgression',v_full"])
 assert.ok(!sql.includes(s),"Unfiltered delegated payload marker: "+s);
assert.ok(ui.includes('spellProfile?.visibilityScope === "delegated-combat"'));
assert.ok(ui.includes("combat-ready spell"));
assert.ok(gen.includes(String.fromCharCode(92)+"i scripts/fixtures/npc_spell_profile_source_shape_pg17.sql"));
assert.ok(fixture.includes(String.fromCharCode(92)+"i sql/candidates/20261101_npc_spell_profile_visibility_candidate.sql"));
assert.ok(fixture.includes("drop function public.encounter_spellcasting_profile_v1(uuid)"));
for(const s of ["gmProfile.data.knownSpells.length,5","ownProfile.data.knownSpells.length,4","assertDelegatedProfile(a,true)","assertDelegatedProfile(b,false)","assertDelegatedProfile(winner,false)","secret-ritual|XPHB","unlearned-ritual|XPHB"])
 assert.ok(jwt.includes(s),"Missing signed-in profile assertion: "+s);
console.log("P2 delegated-only NPC tactical profile source contract PASS; existing full-profile callers preserved");
