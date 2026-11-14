#!/usr/bin/env node
// C34 T20 scratch TEST-DATA ADAPTER ONLY. Original #345 browser and React
// remain archived byte-identical; only a held345 local disposable checkout is
// edited so its older synthetic Fighter seed satisfies T19 source authority.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
export const ORIGINAL_C3B_BLOB="7b3a813d11d4b9e0fcd1ba8aef9d4e8463f58aa4";
export const ORIGINAL_HELD_HEAD="4f5f8ff7587aff1a68f21581ad68a4752789f54a";
export const ORIGINAL_C3B_REL="scripts/browser/verify_c33_creator_backstory_dom.mjs";
export const SYNTHETIC_FROM="const payload={name:\"C3B Browser Original Forge private story\",creation_request_id:randomUUID(),\n secret:null,sheet:{classKey:\"fighter\",level:1,marker:\"C33_BROWSER_COMPONENT\",\n startingEquipmentSelections:{mode:\"package\",classOption:\"A\",ruleset:\"vanilla\"}}};";
export const SYNTHETIC_TO="const payload={name:\"C3B Browser Original Forge private story\",creation_request_id:randomUUID(),\n secret:null,sheet:{classKey:\"fighter\",level:1,marker:\"C33_BROWSER_COMPONENT\",\n // T20 scratch-only: use the genuine T19 source-validated Fighter background,\n // origin feat and Defense class feature. No browser assertion is changed.\n background:\"Soldier\",meta:{backgroundSource:\"XPHB\",speciesKey:\"Elf\"},\n featGrantInstances:[{instanceId:\"c34-t5-origin-lucky\",\n  optionId:\"00000000-0000-0000-0000-000000009154\",\n  name:\"Lucky\",source:\"XPHB\",optionType:\"feat\",acquisitionLevel:1,\n  choices:{},fixedEffects:[]}],\n feats:[\"Lucky\"],\n classFeatureChoices:{fightingStyle:{kind:\"fighting-style\",count:1,level:1,\n  label:\"Fighting Style\",selections:[{name:\"Defense\",key:\"defense\",source:\"XPHB\"}]}},\n classFeatureChoiceSummary:[{groupId:\"fightingStyle\",key:\"defense\",name:\"Defense\",source:\"XPHB\"}],\n startingEquipmentSelections:{mode:\"package\",classOption:\"A\",ruleset:\"vanilla\",\n  backgroundId:\"00000000-0000-0000-0000-000000009150\",\n  backgroundOption:\"A\",choices:{}}}};";
export function gitBlobSha(input) {
 const b=Buffer.isBuffer(input)?input:Buffer.from(input);
 return createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex");
}
export function adaptOriginalC3BBrowserFixture(raw) {
 const content=Buffer.isBuffer(raw)?raw.toString("utf8"):String(raw);
 assert.equal(gitBlobSha(content),ORIGINAL_C3B_BLOB,"T20 original #345 browser fixture source drift");
 assert.equal(content.split(SYNTHETIC_FROM).length-1,1,"T20 original synthetic seed must occur exactly once");
 const result=content.replace(SYNTHETIC_FROM,SYNTHETIC_TO);
 assert.equal(result.replace(SYNTHETIC_TO,SYNTHETIC_FROM),content,
  "T20 may change only the original synthetic Fighter payload");
 assert.ok(result.includes('backgroundId:"00000000-0000-0000-0000-000000009150"'));
 assert.ok(result.includes('groupId:"fightingStyle"')&&result.includes('optionType:"feat"'));
 return result;
}

export const ORIGINAL_C3T_BLOB="d19b134fdb4e4b58833fe339f918c027959eae02";
export const ORIGINAL_C3T_REL="scripts/browser/verify_c33_next_town_route.mjs";
export const TOWN_ORIGIN_FROM='const origin="http://127.0.0.1:41820";';
export const TOWN_PROCESS_FROM='"-p","41820"';
export function adaptOriginalC3TBrowserPort(raw,port) {
 const content=Buffer.isBuffer(raw)?raw.toString("utf8"):String(raw);
 assert.equal(gitBlobSha(content),ORIGINAL_C3T_BLOB,
  "T20 original #345 Next town browser source drift");
 const value=String(port);
 assert.match(value,/^[0-9]{4,5}$/,"T20 local port must be numeric");
 assert.ok(Number(value)>=1024&&Number(value)<=65535,"T20 invalid local TCP port");
 assert.equal(content.split(TOWN_ORIGIN_FROM).length-1,1,
  "T20 original Next town browser localhost origin missing");
 assert.equal(content.split(TOWN_PROCESS_FROM).length-1,1,
  "T20 original Next process port missing");
 const newOrigin='const origin="http://127.0.0.1:'+value+'";';
 const newProcess='"-p","'+value+'"';
 const updated=content.replace(TOWN_ORIGIN_FROM,newOrigin).replace(TOWN_PROCESS_FROM,newProcess);
 assert.equal(updated.replace(newOrigin,TOWN_ORIGIN_FROM).replace(newProcess,TOWN_PROCESS_FROM),content,
  "T20 may adjust only the two Next localhost port literals");
 return updated;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 for(const [key,val] of Object.entries({CI:"true",GITHUB_ACTIONS:"true",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres"}))
  assert.equal(process.env[key],val,"T20 refuses nonlocal fixture adaptation: "+key);
 const root=path.join(process.cwd(),"held345");
 assert.equal(path.basename(root),"held345");
 assert.equal(execFileSync("git",["-C",root,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),
  ORIGINAL_HELD_HEAD,"T20 held checkout ref drift");
 const mode=process.argv[2]||"creator";
 if(mode==="creator") {
  const file=path.join(root,ORIGINAL_C3B_REL);
  fs.writeFileSync(file,adaptOriginalC3BBrowserFixture(fs.readFileSync(file)),"utf8");
  assert.equal(execFileSync("git",["-C",root,"diff","--name-only"],{encoding:"utf8"}).trim(),
   ORIGINAL_C3B_REL,"T20 may edit only the disposable C3B seed script");
  console.log("PASS C34-T20-COMPAT: original #345 C3B source archived; only synthetic local Fighter starting choices adapted");
 }else if(mode==="town-port"){
  const target=path.join(root,ORIGINAL_C3T_REL);
  fs.writeFileSync(target,adaptOriginalC3TBrowserPort(
    fs.readFileSync(target),process.env.C34_T20_TOWN_PORT),"utf8");
  const changed=execFileSync("git",["-C",root,"diff","--name-only"],{encoding:"utf8"}).trim();
  assert.equal(changed,ORIGINAL_C3B_REL+"\n"+ORIGINAL_C3T_REL,
   "T20 may edit only scratch Fighter seed and Next localhost port");
  console.log("PASS C34-T20-PORT: original Next browser assertions unchanged; only isolated localhost origin/process port changed");
 }else{
  throw new Error("T20 unrecognized safe scratch adaptation mode");
 }
}
