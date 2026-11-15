#!/usr/bin/env node
// C34 T23 research-only source and negative tests; no Supabase credentials.
// This helper is UNMOUNTED. These tests do not establish server ACLs/browser
// release acceptance and cannot replace the original T1–T22 signed suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import {
  projectNonMapManagerRosterRow,
  selectedManagerDisplayRights,
  isCurrentManagerPrivateResponse,
  projectSelectedEditorNarrative,
} from "../../../utils/c34/nonMapNpcManagerCandidate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const U = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const V = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const secretKeys = ["background", "motivation", "quirk", "mannerism", "voice", "secret", "character_sheet"];

test("T23-R01 NPC roster strips all sensitive narrative and sheet payload", () => {
  const row = projectNonMapManagerRosterRow({
    id:A,kind:"npc",name:"T23 public NPC",race:"Dwarf",role:"Guard",
    description:"Public description",background:"PRIVATE BACKGROUND",
    motivation:"PRIVATE MOTIVE",quirk:"PRIVATE QUIRK",mannerism:"PRIVATE MANNER",
    voice:"PRIVATE VOICE",secret:"GM SECRET",character_sheet:{gmNotes:"PRIVATE"},
    location_id:9,is_hidden:false,tags:["guard"],sprite_path:"npc-icons/npc_11.png"
  },"npc");
  assert.equal(row.name,"T23 public NPC");
  assert.equal(row.description,"Public description");
  assert.equal(row.location_id,9);
  assert.equal(row.sprite_path,"npc-icons/npc_11.png");
  for(const key of secretKeys)assert.equal(Object.hasOwn(row,key),false,key);
});

test("T23-R02 merchant roster strips the same protected columns and secret", () => {
  const row=projectNonMapManagerRosterRow({
    id:B,kind:"merchant",name:"T23 public merchant",storefront_enabled:true,
    status:"alive",is_hidden:true,background:"Merchant private lore",
    secret:"Merchant GM secret",voice:"Private voice",
    portrait_shop_url:"/merchant.jpg",state:"resting"
  },"merchant");
  assert.equal(row.kind,"merchant");
  assert.equal(row.storefront_enabled,true);
  assert.equal(row.status,"hidden");
  assert.equal(row.portrait_shop_url,"/merchant.jpg");
  for(const key of secretKeys)assert.equal(Object.hasOwn(row,key),false,key);
  assert.equal(projectNonMapManagerRosterRow({...row,kind:"npc"},"merchant"),null);
  assert.equal(projectNonMapManagerRosterRow([],"npc"),null);
  assert.equal(projectNonMapManagerRosterRow(null,"npc"),null);
});

test("T23-P01 current character and current account required for granted UI rights", () => {
  const grant={character_id:A,user_id:U,can_edit:true,can_inventory:true,can_convert:true};
  assert.deepEqual(selectedManagerDisplayRights(grant,A,U),{
    can_edit:true,can_inventory:true,can_convert:true
  });
  for(const [selected,actor] of [[B,U],[A,V],[B,V],[A,null],[null,U]])
    assert.deepEqual(selectedManagerDisplayRights(grant,selected,actor),{
      can_edit:false,can_inventory:false,can_convert:false
    });
  assert.equal(selectedManagerDisplayRights({...grant,can_edit:1},A,U).can_edit,false);
  assert.equal(selectedManagerDisplayRights({...grant,user_id:null},A,U).can_edit,false);
  assert.equal(selectedManagerDisplayRights({character_id:A,can_edit:true},A,U).can_edit,false);
});

test("T23-N01 late response from prior selection or account is rejected",()=>{
  const good={selectedId:A,requestSelectedId:A,actorId:U,requestActorId:U,row:{id:A}};
  assert.equal(isCurrentManagerPrivateResponse(good),true);
  assert.equal(isCurrentManagerPrivateResponse({...good,selectedId:B}),false);
  assert.equal(isCurrentManagerPrivateResponse({...good,actorId:V}),false);
  assert.equal(isCurrentManagerPrivateResponse({...good,row:{id:B}}),false);
  assert.equal(isCurrentManagerPrivateResponse({...good,actorId:null}),false);
  assert.equal(isCurrentManagerPrivateResponse({...good,row:null}),false);
});

test("T23-N02 editor projection cannot accidentally promote GM dossier or secret",()=>{
  const args={selectedId:A,requestSelectedId:A,actorId:U,requestActorId:U,
    row:{id:A,background:"Editable",motivation:"Goal",quirk:"Habit",
      mannerism:"Calm",voice:"Soft",secret:"NEVER",character_sheet:{gm:"PRIVATE"},
      creator_private_story:"NO"}};
  assert.deepEqual(projectSelectedEditorNarrative(args),{
    id:A,background:"Editable",motivation:"Goal",quirk:"Habit",
    mannerism:"Calm",voice:"Soft"
  });
  assert.equal(projectSelectedEditorNarrative({...args,actorId:V}),null);
  assert.equal(projectSelectedEditorNarrative({...args,selectedId:B}),null);
});

test("T23-S01 candidate is not mounted in active NPC, map, town, inventory or app",()=>{
  const imports=["pages/npcs.js","components/NpcPanel.js","components/MapPageClient.js",
    "pages/_app.js","pages/inventory.js","pages/town/[id].js",
    "components/character/CharacterInteractionPanel.js"];
  for(const path of imports){
    const source=readFileSync(resolve(root,path),"utf8");
    assert.doesNotMatch(source,/nonMapNpcManagerCandidate/,path);
  }
  const candidate=readFileSync(resolve(root,"utils/c34/nonMapNpcManagerCandidate.mjs"),"utf8");
  assert.doesNotMatch(candidate,/supabase\.from|loadCharacterSecrets|service_role|tailwind/i);
});
