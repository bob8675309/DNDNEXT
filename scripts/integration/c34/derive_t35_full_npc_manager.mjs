#!/usr/bin/env node
// C34 T35 — exact-original FULL current manager, source-derived for signed
// research only. Does NOT edit pages/npcs.js, original T25 derivation, Forge,
// held PR #345, shared panels, map, hosted SQL, or production feature flags.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {deriveT25CurrentManager,T25_BASE_BLOB} from "./derive_t25_current_npc_manager.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
export const T35_TEMP_ROUTE="pages/__c34_t35_probe.jsx";
const input=path.join(root,"pages/npcs.js");
function once(src,from,to,label){
 const n=src.split(from).length-1;
 assert.equal(n,1,"T35 source exact: "+label+" count "+n);
 return src.replace(from,to);
}
export function deriveT35FullManager(original){
 const {output:old,edits:baseEdits}=deriveT25CurrentManager(original);
 assert.ok(baseEdits.length>=12);
 let code=old;const edits=[];
 const patch=(before,after,label)=>{code=once(code,before,after,label);edits.push(label);};
 patch(
 'import { readNonMapNpcProfileCandidate } from "../utils/c34/readNonMapNpcProfileCandidate.mjs";',
 'import { readTownGameManagerCapabilitiesCandidate, readTownGameManagerNpcProfileCandidate } from "../utils/c34/t31GameManagerRoleProfileCandidate.mjs";',
 "replace legacy dossier reader with source-original T31 authenticated three-role projection");
 const oldAuth=[
 '    const { data: admin, error } = await supabase.rpc("is_admin", { uid: actor });',
 '    if (actorRef.current !== actor) return;',
 '    if (!error) { setIsAdmin(admin === true); return; }',
 '    const { data: profile, error: fallback } = await supabase.from("user_profiles")',
 '      .select("role").eq("id", actor).maybeSingle();',
 '    if (actorRef.current === actor) setIsAdmin(!fallback && profile?.role === "admin");'
 ].join("\n");
 const newAuth=[
 '    // Legacy is_admin(uid) accepts non-player values and its fallbacks disagree.',
 '    // Resolve an EXACT server-validated Admin/GM/DM capability, no client hint.',
 '    const roleEpoch = rosterEpochRef.current;',
 '    const fresh = await readTownGameManagerCapabilitiesCandidate(supabase, {',
 '      isCurrent: () => actorRef.current === actor && rosterEpochRef.current === roleEpoch',
 '    });',
 '    if (actorRef.current !== actor || rosterEpochRef.current !== roleEpoch) return;',
 '    setIsAdmin(fresh.status === "ok" && fresh.capabilities.isGameManager === true);'
 ].join("\n");
 patch(oldAuth,newAuth,"remove broad is_admin(uid), legacy fallback and stale same-actor response");
 patch('const result = await readNonMapNpcProfileCandidate(supabase, id, {',
       'const result = await readTownGameManagerNpcProfileCandidate(supabase, id, {',
       "selected dossier/editor/Sheet uses T31 strict game role and original Stage2/3 source");
 patch('        withPrivateBackstory: false',
       '        withPrivateBackstory: false,',
       "T31 current request option preparation");
 patch('        withPrivateBackstory: false,\n      });',
       '        withPrivateBackstory: false,\n        isCurrent: current\n      });',
       "actor, role and selected request generation verified through last server role read");
 // T25's isAdmin is now *only* the strict T31 role projection; retain the
 // original full-page action controls and actor-bound original T25 rights.
 const anchor='  // Load character-level permissions';
 assert.ok(!code.includes(anchor),"T25 replaced original permission block as expected");
 const srcStart=code.indexOf('  const refreshManagerPermissions = () => {');
 const srcEnd=code.indexOf('  /* ------------------- sheet + notes loaders ------------------- */',srcStart);
 assert.ok(srcStart>0&&srcEnd>srcStart);
 const section=code.slice(srcStart,srcEnd);
 const hook=[
 '  // Current JWT role can be demoted without a new auth event: remove already',
 '  // displayed manager/Sheet/PDF bytes on tab return, then revalidate server.',
 '  useEffect(() => {',
 '    const check=()=>{ if(document.visibilityState==="visible") refreshManagerPermissions(); };',
 '    window.addEventListener("focus",check);',
 '    document.addEventListener("visibilitychange",check);',
 '    return () => {',
 '      window.removeEventListener("focus",check);',
 '      document.removeEventListener("visibilitychange",check);',
 '    };',
 '  }, []);',
 ''
 ].join("\n");
 code=code.slice(0,srcEnd)+hook+code.slice(srcEnd);edits.push("on focus/visibility evict any same-JWT role-revoked manager data");
 // Explicit review boundaries, not a broad rewrite.
 assert.doesNotMatch(code,/\.rpc\("is_admin",\s*\{\s*uid:/);
 assert.doesNotMatch(code,/readNonMapNpcProfileCandidate\(supabase/);
 assert.doesNotMatch(code,/loadCharacterSecrets|\.select\("character_id,sheet"\)/);
 const rosters=code.slice(code.indexOf("  const loadNpcs = "),code.indexOf("  /* ------------------- roster merge ------------------- */"));
 assert.equal((rosters.match(/\.select\(C34_T25_PUBLIC_ROSTER_FIELDS\)/g)||[]).length,3);
 assert.doesNotMatch(rosters,/"(?:background|motivation|quirk|mannerism|voice)"/);
 assert.match(code,/readTownGameManagerNpcProfileCandidate\(supabase, id/);
 assert.match(code,/withDossier: !!isAdmin, withSheet: permitted/);
 assert.match(code,/isCurrent: current/);
 assert.match(code,/function NpcsPage/);
 assert.match(code,/CharacterSheetPanel/);
 assert.match(code,/PortraitPickerModal/);
 assert.match(code,/SpritePickerModal/);
 assert.match(code,/setCharacterLocation/);
 assert.match(code,/handleDeleteNpc/);
 assert.match(code,/printNotes=\{\(notes \|\| \[\]\)\.filter\(canSeeNote\)\}/);
 assert.match(code,/selectedPrivateResult\?\.capabilities\?\.canPrint/);
 return {
  output:"// T35 research-only ORIGINAL full NPC manager from T25 source + "+T25_BASE_BLOB+"\n"+
    "// Local Next route only, never mount or deploy as production page.\n"+code,
  edits,baseEdits
 };
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {output,edits}=deriveT35FullManager(readFileSync(input,"utf8"));
 assert.ok(process.argv[2]==="--verify"||process.argv[2]==="--write",
  "T35 only --verify or --write into disposable localhost probe");
 if(process.argv[2]==="--write"){
  const out=path.join(root,T35_TEMP_ROUTE);
  writeFileSync(out,output,{flag:"wx"});
  console.log("T35 created local scratch Next route "+out);
 }else console.log("PASS T35-DERIVE: exact original/T25 manager preserved, "+edits.length+" audited game-master fixes");
}
