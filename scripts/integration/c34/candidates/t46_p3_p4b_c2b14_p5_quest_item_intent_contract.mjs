// C34 B14-P5: VERSIONED RESEARCH-ONLY quest/item interaction wire proposal.
// No imports, network, DB access, side effects or game/runtime registration.
// The client supplies only a PROPOSAL, never identity/permissions/quest authority.
// A future SERVER must validate auth, NPC/quest entitlement, item ownership,
// visibility, current RLS and a transactional transfer + idempotent receipt.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECIPIENT_TYPES=new Set(["player","npc","merchant"]);
const ITEM_KEY=/^[a-z0-9][a-z0-9._:-]{0,127}$/i;
const PROPOSAL_KEYS=new Set([
  "requestId","intent","itemId","requestedItemKey","quantity","recipient","questId"
]);
const RECIPIENT_KEYS=new Set(["type","id"]);

function isObject(v) {
  return typeof v==="object"&&v!==null&&!Array.isArray(v) &&
    Object.getPrototypeOf(v)===Object.prototype;
}
function keysOnly(obj,allowed,kind) {
  if(!isObject(obj)||Object.keys(obj).some(k=>!allowed.has(k)))
    throw new TypeError("Invalid "+kind+" fields; caller cannot assert issuer or permissions");
}
function uuid(v,name) {
  if(typeof v!=="string"||!UUID.test(v))
    throw new TypeError("Invalid "+name+" UUID");
  return v.toLowerCase();
}
function optionalQuestId(value) {
  if(value===undefined||value===null)return null;
  // public.quests.id is TEXT (not UUID). Keep exact text and disallow control
  // chars; existence/visibility must be checked against DB by server later.
  if(typeof value!=="string"||value.length<1||value.length>256||
    value.trim()!==value||/[\u0000-\u001f\u007f]/.test(value))
    throw new TypeError("Invalid quest reference");
  return value;
}
function recipient(input) {
  keysOnly(input,RECIPIENT_KEYS,"recipient");
  if(!RECIPIENT_TYPES.has(input.type))
    throw new TypeError("Invalid recipient type; no player-character target");
  return Object.freeze({type:input.type,id:uuid(input.id,"recipient")});
}

export function normalizeQuestItemProposal(input) {
  keysOnly(input,PROPOSAL_KEYS,"item interaction proposal");
  const requestId=uuid(input.requestId,"requestId");
  const questId=optionalQuestId(input.questId);
  const destination=recipient(input.recipient);
  if(input.intent==="send") {
    if(input.requestedItemKey!==undefined||input.quantity!==undefined)
      throw new TypeError("Send uses one exact item row; request descriptor forbidden");
    return Object.freeze({
      requestId,intent:"send",questId,recipient:destination,
      itemId:uuid(input.itemId,"item"),requestedItemKey:null,quantity:1,
      // UI proposal alone does not write or authorize. Server may reject.
      state:"proposed",mutationAuthorized:false
    });
  }
  if(input.intent==="request") {
    if(input.itemId!==undefined)
      throw new TypeError("Item requests describe what is sought, not another user's row ID");
    if(typeof input.requestedItemKey!=="string"||!ITEM_KEY.test(input.requestedItemKey))
      throw new TypeError("Invalid requested item catalog key");
    if(!Number.isSafeInteger(input.quantity)||input.quantity<1||input.quantity>99)
      throw new TypeError("Requested item quantity must be an integer 1-99");
    return Object.freeze({
      requestId,intent:"request",questId,recipient:destination,
      itemId:null,requestedItemKey:input.requestedItemKey,quantity:input.quantity,
      // Even valid quest request is pending ONLY after trusted backend creation;
      // no transfer or item mint ever occurs on proposal normalization.
      state:"proposed",mutationAuthorized:false
    });
  }
  throw new TypeError("Unsupported item interaction intent");
}

// UI-only view of server-owned request lifecycle. NEVER persist a transition
// from this helper or interpret a client status as proof of authorization.
// Fulfillment requires a trusted SERVER transfer receipt from the SAME
// transaction that updates inventory + request status + quest progress.
export function projectQuestItemRequestTransition({status,decision,transferReceiptId=null}) {
  if(status!=="pending")throw new TypeError("Only pending requests can transition");
  if(decision==="decline"||decision==="cancel"||decision==="expire"){
    if(transferReceiptId!==null)throw new TypeError("Nonfulfillment cannot claim a receipt");
    return Object.freeze({status:{
      decline:"declined",cancel:"cancelled",expire:"expired"
    }[decision],requiresServerSettlement:true});
  }
  if(decision==="fulfill"){
    return Object.freeze({
      status:"fulfilled",transferReceiptId:uuid(transferReceiptId,"server transfer receipt"),
      requiresServerSettlement:true
    });
  }
  throw new TypeError("Unsupported request transition");
}
