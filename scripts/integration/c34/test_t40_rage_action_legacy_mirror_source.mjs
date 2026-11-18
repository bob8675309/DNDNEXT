#!/usr/bin/env node
// T40: exact-source original Rage standalone action + separate rest writer.
// Passing is source custody, NOT signed database behavior or production safety.
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const load=p=>fs.readFileSync(path.join(root,p));
const blob=b=>crypto.createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const a=load("sql/20260802_02_character_sheet_feature_actions.sql");
const r=load("sql/20260810_90_rest_class_feature_restoration.sql");
const fn=(s,name)=>{
 const start=s.indexOf("create or replace function "+name+"(");
 assert.ok(start>=0,"missing original "+name);
 const end=s.indexOf("\n$$;",start);assert.ok(end>start,"unterminated original "+name);
 return s.slice(start,end+4);
};
const action=fn(a.toString(),"public.update_character_sheet_action_state_v1");
const rest=fn(r.toString(),"private.restore_character_rest_action_state_v1");
const mirror=/  update public\.players p\n  set sheet=v_sheet,updated_at=now\(\)\n  where p\.user_id in \(\n    select cp\.user_id\n    from public\.character_permissions cp\n    where cp\.character_id=p_character_id and cp\.can_edit\n  \);/g;
const once=body=>assert.equal([...body.matchAll(mirror)].length,1);
test("T40-S01 original action and coupled rest Git blobs remain byte-pinned",()=>{
 assert.equal(blob(a),"a7e432a0f6be939f038a7926f81e9b81e36a903b");
 assert.equal(blob(r),"2bd48d73398a3e9095b61ee288c0377d464edfc6");
 assert.match(a.toString(),/grant execute on function public\.update_character_sheet_action_state_v1\(uuid,text,text\) to authenticated, service_role;/);
});
test("T40-S02 original standalone action canonical target correct but account mirror unsafe",()=>{
 once(action);
 assert.match(action,/private\.can_manage_character_progression_v1\(p_character_id\)/);
 assert.match(action,/from public\.character_sheets\s+where character_id=p_character_id\s+for update;/);
 assert.match(action,/update public\.character_sheets\s+set sheet=v_sheet,updated_at=now\(\)\s+where character_id=p_character_id;/);
 assert.match(action,/v_operation not in \('activate','deactivate','reset'\)/);
 assert.match(action,/v_remaining := v_remaining-1;/);
});
test("T40-S03 actual NPC Sheet hook and Profile call the original Rage RPC",()=>{
 const hook=load("hooks/useNpcSheetActionData.js").toString();
 const panel=load("components/NpcPanel.js").toString();
 const page=load("pages/npcs.js").toString();
 assert.match(hook,/supabase\.rpc\("update_character_sheet_action_state_v1",\s*\{\s*p_character_id: activeId/);
 assert.match(panel,/supabase\.rpc\("update_character_sheet_action_state_v1",\s*\{\s*p_character_id: npcId/);
 assert.match(hook,/requestRef\.current !== requestId/);
 assert.match(hook,/activeIdRef\.current !== activeId/);
 assert.match(page,/useNpcSheetActionData/);
 assert.match(page,/canCommand: !!isAdmin \|\| !!charPerm\?\.can_edit/);
 assert.match(page,/onActionCommand=\{npcSheetActions\.canCommand \? npcSheetActions\.handleActionCommand : null\}/);
});
test("T40-S04 rest restoration separately writes FULL account Sheet and remains release blocker",()=>{
 once(rest);
 assert.match(rest,/update public\.character_sheets\s+set sheet=v_sheet,updated_at=now\(\)\s+where character_id=p_character_id;/);
 assert.match(rest,/v_class_source='XPHB' and p_rest_type='short_rest'/);
 assert.match(rest,/p_rest_type='long_rest'/);
 assert.match(r.toString(),/v_action_result := private\.restore_character_rest_action_state_v1\(p_character_id,v_rest_type\)/);
});
test("T40-N01 removing historical mirror cannot pass source-original custody",()=>{
 const altered=action.replace(mirror,"-- stripped");
 assert.notEqual(altered,action);
 assert.throws(()=>once(altered));
});
test("T40-N02 unscoping canonical update is caught, never a valid Option A difference",()=>{
 const altered=action.replace("where character_id=p_character_id;\n\n  update public.players",";\n\n  update public.players");
 assert.notEqual(altered,action);
 assert.doesNotMatch(altered,/update public\.character_sheets\s+set sheet=v_sheet,updated_at=now\(\)\s+where character_id=p_character_id;/);
});
test("T40-N03 replacing only account mirror must preserve authorization, Rage uses and action constraints",()=>{
 const candidate=action.replace(mirror,"  -- NON ORIGINAL Option A account legacy mirror intentionally excluded.");
 assert.notEqual(candidate,action);
 assert.doesNotMatch(candidate,/update public\.players p/);
 for(const str of [
  "private.can_manage_character_progression_v1(p_character_id)",
  "v_remaining := v_remaining-1;",
  "v_operation not in ('activate','deactivate','reset')"
 ])assert.ok(candidate.includes(str));
 once(rest); // Do NOT count rest writer as covered by candidate.
});
