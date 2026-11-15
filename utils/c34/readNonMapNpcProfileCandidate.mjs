// C34 T21 NON-ORIGINAL, UNMOUNTED current-app candidate.
// No map, town, inventory, pages or existing NpcPanel imports.
// Original #345 stage1/2/3 RPCs and RLS remain the sole server authorities.
// Never use this module as a fallback to raw public.characters/GM secrets.
export const NPC_UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SAFE_PROFILE_FIELDS=Object.freeze([
  "id","name","kind","race","role","affiliation","status","location_id",
  "storefront_enabled","portrait_url","portrait_storage_path",
  "portrait_thumb_url","portrait_shop_url","portrait_source",
  "image_url","description"
]);
const SAFE_LORE_FIELDS=Object.freeze([
  "background","traits","ideals","bonds","flaws","motivation","quirk","mannerism"
]);
const EDITOR_FIELDS=Object.freeze([
  "id","background","motivation","quirk","mannerism","voice"
]);

export function sanitizeNpcPublicProjection(raw, requestedId) {
  if (!raw || typeof raw!=="object" || Array.isArray(raw) ||
      String(raw.id||"").toLowerCase()!==String(requestedId||"").toLowerCase())
    return null;
  const projected={};
  for(const k of SAFE_PROFILE_FIELDS)
    if(Object.prototype.hasOwnProperty.call(raw,k))
      projected[k]=raw[k];
  const lore={};
  const input=raw.lore && typeof raw.lore==="object" && !Array.isArray(raw.lore)
    ? raw.lore : {};
  for(const k of SAFE_LORE_FIELDS)
    if(Object.prototype.hasOwnProperty.call(input,k))
      lore[k]=input[k];
  projected.lore=lore;
  // Even a legacy "reveal.secret" flag is not consent to publish GM secrets.
  // GM-only dossiers are a separate guarded server RPC and return slot.
  return projected;
}
export function emptyNpcReaderResult(status="unavailable") {
  return { status, profile:null, dossier:null, editorNarrative:null,
    sheet:null, privateBackstory:null,
    capabilities:{isGM:false,canPrint:false,canEdit:false,canEditBackstory:false} };
}
const validActorId=id=>NPC_UUID_RE.test(String(id||""));
const isSafeRow=(r,id)=>r && typeof r==="object" &&
  String(r.id||"").toLowerCase()===String(id).toLowerCase();

// No direct private character query; all elevated rights checked by the
// database and on a second genuine auth.getUser() before returning results.
// UI must ALSO synchronously unmount on SIGNED_OUT/account switch and reject
// stale requests, as the original held #345 overlay does.
export async function readNonMapNpcProfileCandidate(client, characterId, options={}) {
  const id=String(characterId||"").trim();
  if(!validActorId(id))return emptyNpcReaderResult("invalid-id");
  if(!client?.auth?.getUser || !client?.rpc || !client?.from)
    return emptyNpcReaderResult("unavailable");
  const start=await client.auth.getUser();
  const userId=start?.data?.user?.id;
  if(start.error || !validActorId(userId))
    return emptyNpcReaderResult("unauthenticated");
  const res=await client.rpc("get_npc_profile_visible_v1",{p_character_id:id});
  const profile=!res.error && sanitizeNpcPublicProjection(res.data,id);
  if(!profile)return emptyNpcReaderResult("unavailable");
  const result=emptyNpcReaderResult("ok");
  result.profile=profile;

  if(options.withDossier===true){
    const admin=await client.rpc("is_admin",{uid:userId});
    if(!admin.error && admin.data===true){
      const gm=await client.rpc("get_npc_dossier_admin_v1",{p_character_id:id});
      if(!gm.error && isSafeRow(gm.data,id)){
        result.dossier=gm.data;
        result.capabilities.isGM=true;
      }
    }
  }
  if(options.withSheet===true){
    // Editor-only narrative RPC enforces CURRENT can_edit; inventory rights
    // are not enough. Even with this right the Sheet RLS must pass separately.
    const edit=await client.rpc("get_character_editor_narrative_v1",{p_character_id:id});
    if(!edit.error && isSafeRow(edit.data,id)){
      const canonical=await client.from("character_sheets")
        .select("sheet").eq("character_id",id).maybeSingle();
      if(!canonical.error && canonical.data?.sheet &&
          typeof canonical.data.sheet==="object" &&
          !Array.isArray(canonical.data.sheet)){
        result.sheet=canonical.data.sheet;
        const safe={};
        for(const k of EDITOR_FIELDS)
          if(Object.prototype.hasOwnProperty.call(edit.data,k))
            safe[k]=edit.data[k];
        result.editorNarrative=safe;
        result.capabilities.canPrint=true;
        result.capabilities.canEdit=true;
      }
    }
  }
  if(options.withPrivateBackstory===true){
    const allowed=await client.rpc("can_edit_creator_backstory_v1",{p_character_id:id});
    if(!allowed.error && allowed.data===true){
      const story=await client.from("character_backstory_secrets")
        .select("secret_text").eq("character_id",id).maybeSingle();
      if(!story.error){
        result.privateBackstory=typeof story.data?.secret_text==="string"
          ? story.data.secret_text : "";
        result.capabilities.canEditBackstory=true;
      }
    }
  }
  const end=await client.auth.getUser();
  if(end.error || end.data?.user?.id!==userId)
    return emptyNpcReaderResult("session-changed");
  return result;
}
