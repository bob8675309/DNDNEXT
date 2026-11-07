import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();
const manifest = JSON.parse(fs.readFileSync("scripts/data/tactical_spell_preservation_20261107.json","utf8"));
const required = new Set([
  "scripts/validate_tactical_spell_preservation.mjs",
  "scripts/data/tactical_spell_preservation_20261107.json",
  "pages/encounters/combat.js",
  "scripts/validate_tactical_spell_suite.mjs",
  "docs/Deployed_Tactical_Spell_Effects_Smoke_Recovery_2026-11-07.md",
  ...manifest.spells.flatMap(s => [s.sql,s.ledger,s.serverValidator,s.uiValidator]),
  ...manifest.baselineValidators.paths
]);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spell-preservation-"));
try {
  for (const file of required) {
    const dest = path.join(dir,file);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.copyFileSync(path.join(cwd,file),dest);
  }
  function check(caseName, update, expectedFailure) {
    const saved = new Map();
    for (const file of update.paths) saved.set(file,fs.readFileSync(path.join(dir,file),"utf8"));
    update.apply();
    const run=spawnSync(process.execPath,["scripts/validate_tactical_spell_preservation.mjs"],{cwd:dir,encoding:"utf8",timeout:20000});
    if (expectedFailure) {
      assert.notEqual(run.status,0,caseName+" must fail closed");
      assert((run.stderr+run.stdout).includes(expectedFailure),caseName+" unexpected failure: "+run.stderr);
    } else {
      assert.equal(run.status,0,caseName+" must pass: "+run.stderr);
    }
    for (const [file,value] of saved) fs.writeFileSync(path.join(dir,file),value);
    console.log("PASS mutation:",caseName);
  }
  const ui="pages/encounters/combat.js", data="scripts/data/tactical_spell_preservation_20261107.json";
  const mutate=(file,fn)=>({paths:[file],apply:()=>fs.writeFileSync(path.join(dir,file),fn(fs.readFileSync(path.join(dir,file),"utf8")))});
  check("original complete 19-spell inventory",{paths:[],apply:()=>{}},null);
  check("whitelist deletion",mutate(ui,t=>t.replace('  "fire-bolt|xphb",\n',"")),"19-adapter UI whitelist changed");
  check("guarded RPC route drift",mutate(ui,t=>t.replace('if (key === "lightning-bolt|xphb") {\n      return runRpc("encounter_cast_directional_area_spell_v2"', 'if (key === "lightning-bolt|xphb") {\n      return runRpc("encounter_cast_directional_area_spell_v1"')),"special UI RPC drift");
  check("historical failed CI wrongly marked green",mutate(data,t=>t.replace('"pr": 299,\n      "head"', '"pr": 299,\n      "head"').replace(/("pr": 299,[\s\S]*?"result": )"failure"/,'$1"success"')),"Negative #299 result must be retained");
  check("original SQL function lost",mutate("sql/20260730_07_tactical_lightning_bolt.sql",t=>t.replace(/create or replace function public\.encounter_cast_directional_area_spell_v2\(/i,"create or replace function public.deleted_function(")),"original RPC definition missing");
  check("held classifier conflict erased",
    mutate(data,t=>t.replace('"status": "open-review-required"','"status": "closed-without-review"')),
    "Held Acid Splash taxonomy conflict must remain explicit");
  check("Acid Splash sphere radius silently changed",
    mutate("sql/20260730_04_tactical_acid_splash.sql",
      t=>t.replace("'areaRadiusFt',5","'areaRadiusFt',10")),
    "XPHB Acid Splash must retain a 5-ft sphere");

  check("original non-spell validator removed while total count otherwise preserved",
    mutate("scripts/validate_tactical_spell_suite.mjs",
      t=>t.replace('"scripts/validate_tactical_equipped_damage_mitigation.mjs"', '"scripts/validate_fake_unused_spare.mjs"')),
    "Original validator removed from tactical suite");
  check("archived positive CI receipt incorrectly flipped",
    mutate(data,t=>t.replace(/("pr": 294,[\s\S]*?"result": )"success"/,'$1"failure"')),
    "Positive #294 result must remain historically accurate");
  console.log("PASS deterministic mutation tests; disposable temp files only");
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
