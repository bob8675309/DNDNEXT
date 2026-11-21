#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import {buildG2GlobalPlayerProfileOverlay} from "./candidates/t46_global_g2_player_profile_overlay.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const file=path.join(root,"components/PlayerCharacterProfilePanelUnified.js");
const buf=fs.readFileSync(file);
const sha=crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+buf.length+"\0"),buf])).digest("hex");
test("G2 source-exact global panel candidate, all original creator/profile/epoch and no broad fallback",()=>{
 assert.equal(sha,"8a561e51eafd9e8507db7a4d3f15fd4699d6d1b8");
 const before=buf.toString("utf8");
 const after=buildG2GlobalPlayerProfileOverlay(before);
 assert.notEqual(after,before);
 assert.equal(before.includes('supabase.rpc("get_my_player_characters_v2")'),true);
 assert.equal(before.includes('.from("characters")'),true);
 assert.equal(after.includes('.from("characters")'),false);
 assert.ok(after.includes("if (listResult?.error) throw listResult.error;"));
 assert.ok(after.includes('const rows = listResult.data;'));
 assert.ok(after.includes('window.addEventListener("focus", refreshOnFocus);'));
 for(const marker of [
  "PlayerCharacterCreator key={sessionUser.id}",
  "shouldAutoOpenPlayerCharacterPanel",
  'setCreatingCharacter(true)',
  "requestAppWindowReset",
  'const OPEN_PLAYER_PROFILE_EVENT = "dndnext:open-player-profile";',
  'const isCurrentRequest = () => isCurrentProfileLoadRequest'
 ]) assert.ok(after.includes(marker),"Preservation regression "+marker);
 assert.ok(after.includes("activeProfileUserIdRef.current === actorId && profileLoadRequestRef.current === requestEpoch"));
 assert.ok(!after.includes("let alive = true;"));
 assert.throws(()=>buildG2GlobalPlayerProfileOverlay(before.replace('if (!rows.length && resolvedPlayerName)','if (anotherCondition)')),
  /Missing preserved original branch/);
});
