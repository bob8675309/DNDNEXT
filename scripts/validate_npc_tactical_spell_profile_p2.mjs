// P2 source-only guard for proposed delegated NPC tactical spell visibility.
// True JWT PG17 tests execute actual candidate SQL separately in free CI.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("sql/candidates/20261101_npc_spell_profile_visibility_candidate.sql");
const ui=read("pages/encounters/combat.js");
const v2=read("sql/candidates/20261101_npc_spell_profile_v2_visibility_candidate.sql");
const v2Fixture=read("scripts/fixtures/npc_spell_profile_v2_source_shape_pg17.sql");
const sensitive=read("scripts/fixtures/npc_source_read_rpc_parity_pg17.sql");
const indirect=read("scripts/fixtures/npc_indirect_resource_read_rpc_parity_pg17.sql");
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
assert.ok(v2.includes("d2a41429785f5c55f6c5b941d6ed6d88"));
assert.ok(v2.includes("$function$;\n\nrevoke all on function private.encounter_spellcasting_profile_v2_full_candidate_v1"),
 "Copied production v2 definition must end before its EXECUTE revocation");
assert.ok(sensitive.includes("$function$;\n\nrevoke all on function public.get_character_secrets_v1"),
 "Copied live secret read function must end before its ACL");
assert.ok(v2.includes("private.encounter_spellcasting_profile_v2_full_candidate_v1"));
assert.ok(v2.includes("v_profile->>'visibilityScope'='delegated-combat'"));
assert.ok(v2.includes("return v_profile;"));
assert.ok(v2.includes("return private.encounter_spellcasting_profile_v2_full_candidate_v1"));
assert.ok(v2Fixture.includes(String.fromCharCode(92)+"i sql/candidates/20261101_npc_spell_profile_v2_visibility_candidate.sql"));
assert.ok(gen.includes(String.fromCharCode(92)+"i scripts/fixtures/npc_spell_profile_v2_source_shape_pg17.sql"));
for(const s of ["get_character_secrets_v1","get_my_player_character_v1","get_my_player_characters_v2"])
 assert.ok(sensitive.includes(s),"Lost source read RPC parity: "+s);
for(const s of ["encounter_spellcasting_profile_v2","assert.deepEqual(v2.data,r.data","gmV2.data.persistentSlotState.length,1","ownV2.data.resourceBridgeVersion,1","get_character_secrets_v1","get_my_player_characters_v2"])
 assert.ok(jwt.includes(s),"Missing genuine JWT anti-bypass regression: "+s);
for(const p of ["character_sheet_resource_profile_v1","character_sheet_resource_profile_v2",
 "get_character_currency_v1","get_character_inventory_v1","character_equipment_effects_v1"]){
 assert.ok(indirect.includes("FUNCTION public."+p+"("),
  "Missing actual public resource reader: "+p);
 assert.ok(jwt.includes('"'+p+'"'),
  "Missing signed-in resource read denial: "+p);
}
assert.ok(indirect.includes("FUNCTION private.can_manage_character_progression_v1"));
assert.ok(gen.includes(String.fromCharCode(92)+"i scripts/fixtures/npc_indirect_resource_read_rpc_parity_pg17.sql"));
assert.equal((indirect.match(/\$function\$;\n/g)||[]).length,6,
 "All source-extracted SQL definitions must terminate before ACL statement");
console.log("P2 delegated NPC v1/v2 profiles, secrets, currency, inventory and resource read RPC contracts PASS; research only");
