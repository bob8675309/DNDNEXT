#!/usr/bin/env node
// Static Forge original trigger audit. Never executes SQL or uses production credentials.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const COUNTS={character_progression:19,character_sheets:4,characters:6,inventory_items:2};
export function parseOriginalInventory(md){
 const rows=[],seen=new Set();
 for(const line of String(md).split(/\r?\n/)){
  if(!/^\|\s*`(?:character_progression|character_sheets|characters|inventory_items)`\s*\|/.test(line))continue;
  const c=line.split("|").slice(1,-1).map(x=>x.trim());
  if(c.length<6)continue;
  const fields=c.slice(0,4).map(x=>/^`([^`]+)`$/.exec(x)?.[1]);
  const [table,name,handler,md5]=fields,timing=c[4];
  if(!(table in COUNTS)||!name||!/^[a-z_][a-z0-9_]*$/i.test(name)||!handler||!/^[a-z_][a-z0-9_]*$/i.test(handler)||!/^[a-f0-9]{32}$/.test(md5||"")||!/^(Immediate|Deferred)$/.test(timing))
   throw Error("Invalid original trigger row: "+line.slice(0,180));
  if(seen.has(name))throw Error("Duplicate original trigger "+name);
  seen.add(name);rows.push({table,name,handler,md5,timing});
 }
 if(rows.length!==31)throw Error("Incomplete original census: "+rows.length+"/31");
 for(const [table,n] of Object.entries(COUNTS))assert.equal(rows.filter(r=>r.table===table).length,n,"Source census drift "+table);
 return rows;
}
export function scanFixtureTriggers(sql,file){
 const clean=String(sql).replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*--[^\n]*$/gm,"");
 const re=/^\s*CREATE\s+(CONSTRAINT\s+)?TRIGGER\s+"?([a-z_0-9]+)"?\s+([\s\S]*?);/gim,rows=[];
 for(const m of clean.matchAll(re)){
  const ddl=m[0];
  rows.push({name:m[2],file,
   table:/\bON\s+(?:public\.)?"?(character_progression|character_sheets|characters|inventory_items)"?\b/i.exec(ddl)?.[1],
   handler:/\bEXECUTE\s+(?:FUNCTION|PROCEDURE)\s+(?:"?(?:public|private)"?\.)?"?([a-z_0-9]+)"?\s*\(/i.exec(ddl)?.[1],
   timing:/\bDEFERRABLE\s+INITIALLY\s+DEFERRED\b/i.test(ddl)?"Deferred":"Immediate",constraint:Boolean(m[1])});
 }
 return rows;
}
export function compareCoverage(original,staged){
 const names=new Map();for(const s of staged){if(!names.has(s.name))names.set(s.name,[]);names.get(s.name).push(s);}
 const rows=original.map(o=>{
  const matches=names.get(o.name)||[];if(!matches.length)return {...o,status:"not-staged"};
  if(matches.length!==1)return {...o,status:"mismatch",detail:"duplicate CREATE TRIGGER"};
  const s=matches[0],errors=[];
  if(s.table!==o.table)errors.push("table differs");
  if(s.handler!==o.handler)errors.push("handler differs");
  if(s.timing!==o.timing)errors.push("timing differs");
  if(o.timing==="Deferred"&&!s.constraint)errors.push("missing CONSTRAINT");
  return {...o,status:errors.length?"mismatch":"staged-ddl",file:s.file,...(errors.length?{detail:errors.join("; ")}:{})};
 });
 return {originalCount:rows.length,stagedCount:rows.filter(x=>x.status==="staged-ddl").length,
  missingCount:rows.filter(x=>x.status==="not-staged").length,mismatchCount:rows.filter(x=>x.status==="mismatch").length,
  rows,otherFixtureTriggers:staged.filter(s=>!original.some(o=>o.name===s.name))};
}
export function inspectForgeCheckout(root){
 const manifest="docs/Forge_Original_Creation_Trigger_Coverage_2026-11-05.md";
 const file=path.join(root,manifest),dir=path.join(root,"scripts/fixtures");
 if(!existsSync(file)||!existsSync(dir))throw Error("Original trigger inventory/fixture missing on target; cannot infer");
 const original=parseOriginalInventory(readFileSync(file,"utf8"));
 const files=readdirSync(dir,{withFileTypes:true}).filter(f=>f.isFile()&&/^forge_.*\.sql$/.test(f.name)).map(f=>f.name).sort();
 const sources=files.map(f=>readFileSync(path.join(dir,f),"utf8"));
 const triggers=files.flatMap((f,i)=>scanFixtureTriggers(sources[i],"scripts/fixtures/"+f));
 const joint=sources.join("\n"),result=compareCoverage(original,triggers);
 result.rows=result.rows.map(r=>({...r,
  sourceDeclarationSeen:new RegExp("CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:private|public)\\."+r.handler+"\\s*\\(","i").test(joint),
  md5MentionedInFixture:joint.includes(r.md5)}));
 return {...result,manifest,scannedFiles:files.length};
}
export function renderReport(r){
 const lines=["# Forge original creation-adjacent trigger fixture coverage","",
  "Offline comparison to the dated read-only production census: "+r.manifest,
  "Original: "+r.originalCount+"; matching staged DDL: "+r.stagedCount+"; unstaged: "+r.missingCount+"; mismatched: "+r.mismatchCount+".",
  "SQL fixture files scanned: "+r.scannedFiles,"",
  "STAGED DDL IS NOT FULL ACCEPTANCE. Source declaration and MD5 text are not verified executable hashes; live drift, auth/RLS parity, deferred COMMIT, rollback, concurrent lock order and original catalog branches remain independently unverified.","",
  "| Table | Trigger | Handler | Historic MD5 | Fixture DDL | Source declaration seen |",
  "|---|---|---|---|---|---|"];
 for(const x of r.rows)lines.push("| "+x.table+" | "+x.name+" | "+x.handler+" | "+x.md5+" | "+x.status+(x.detail?" ("+x.detail+")":"")+" | "+(x.sourceDeclarationSeen?"yes":"no")+" |");
 lines.push("","## One bounded research item","",
  "Choose ONE not-staged trigger. Never invent a handler body or modify historical MD5s. If the original full pg_get_functiondef/pg_get_triggerdef is absent, report the missing read-only source evidence rather than fabricating fixture parity.",
  "Require disposable PG17 and genuine local GoTrue/PostgREST positive and negative branch tests, deferred COMMIT, atomic rollback/retry/concurrent actor tests, attribution and G/GI/I/C preservation. Do not use production SQL or write credentials.","");
 return lines.join("\n");
}
export function writeReport(target,control){
 const r=inspectForgeCheckout(target),md=renderReport(r),ctx=path.join(target,".agent-input"),out=path.join(control,"research-agent-artifact");
 mkdirSync(ctx,{recursive:true});mkdirSync(out,{recursive:true});
 writeFileSync(path.join(ctx,"FORGE_TRIGGER_COVERAGE.md"),md);
 writeFileSync(path.join(out,"FORGE_TRIGGER_COVERAGE.md"),md);
 writeFileSync(path.join(out,"FORGE_TRIGGER_COVERAGE.json"),JSON.stringify(r,null,2)+"\n");
 return r;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const r=writeReport(path.resolve(process.argv[2]||"target"),process.cwd());
 console.log("Original Forge trigger DDL "+r.stagedCount+"/"+r.originalCount+" staged, "+r.missingCount+" unstaged, "+r.mismatchCount+" mismatch");
 if(r.mismatchCount)process.exitCode=1;}catch(e){console.error("Forge audit failed closed: "+e.message);process.exitCode=1;}
}
