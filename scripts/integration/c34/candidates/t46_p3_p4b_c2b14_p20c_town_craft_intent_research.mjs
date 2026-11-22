// P20C-P0 research-only transport schema. NOT recipe authorization and
// intentionally NOT imported by any gameplay page or server RPC.
// A server must independently verify signed identity, current privileges,
// recipe, crafter, resource ownership/quantity, wallet price and the attempt.
// Never trust client result payload, price, user role or GM override flags.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECIPE=/^[a-z0-9][a-z0-9:_-]{2,127}$/;
const SERVICE=new Set(["forge_mundane","reforge","brew","imbue","inscribe","socket"]);
const LANE=new Set(["secondary","material","catalyst_a","catalyst_b","catalyst_c"]);
const SOURCE=new Set(["inventory_items","player_plants"]);
const REQUEST_KEYS=new Set(["request_id","service_id","town_id","crafter_id","recipe_key","primary_item_id","ingredients"]);
const INGREDIENT_KEYS=new Set(["source","id","lane","quantity"]);
const isPlain=x=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const fail=s=>{throw new TypeError("P20C research intent rejected: "+s);};
function whitelist(x,keys,part){for(const k of Object.keys(x))if(!keys.has(k))fail(part+" contains untrusted key "+k);}
function uuid(x,field){if(typeof x!=="string"||!UUID.test(x))fail(field+" must be a UUID");return x.toLowerCase();}
export function normalizeP20CUntrustedTownCraftIntentResearch(x){
 if(!isPlain(x))fail("request must be a plain object");
 whitelist(x,REQUEST_KEYS,"request");
 const request_id=uuid(x.request_id,"request_id");
 const crafter_id=uuid(x.crafter_id,"crafter_id");
 if(!SERVICE.has(x.service_id))fail("unknown source service");
 if(!Number.isSafeInteger(x.town_id)||x.town_id<=0)fail("invalid town_id");
 if(typeof x.recipe_key!=="string"||!RECIPE.test(x.recipe_key))fail("recipe_key must identify a server catalog entry");
 const primary_item_id=x.primary_item_id==null?null:uuid(x.primary_item_id,"primary_item_id");
 if(!["brew","forge_mundane"].includes(x.service_id)&&!primary_item_id)fail("service requires an owned primary item");
 if(["brew","forge_mundane"].includes(x.service_id)&&primary_item_id)fail("catalog-based service rejects player primary");
 if(!Array.isArray(x.ingredients)||x.ingredients.length>5)fail("invalid ingredient slot count");
 const usedLanes=new Set(),usedSources=new Set();
 const ingredients=x.ingredients.map(entry=>{
  if(!isPlain(entry))fail("ingredient must be a plain object");
  whitelist(entry,INGREDIENT_KEYS,"ingredient");
  if(!SOURCE.has(entry.source))fail("unknown ingredient source");
  if(!LANE.has(entry.lane))fail("unknown ingredient lane");
  if(usedLanes.has(entry.lane))fail("duplicate ingredient lane");
  usedLanes.add(entry.lane);
  const id=uuid(entry.id,"ingredient id");
  const unique=entry.source+":"+id;
  if(usedSources.has(unique)||id===primary_item_id)fail("source item consumed twice");
  usedSources.add(unique);
  if(!Number.isSafeInteger(entry.quantity)||entry.quantity<1||entry.quantity>65535)fail("invalid positive stock quantity");
  return Object.freeze({source:entry.source,id,lane:entry.lane,quantity:entry.quantity});
 });
 if(x.service_id==="brew"&&(!usedLanes.has("secondary")||!usedLanes.has("material")))fail("brew requires two distinct ingredient lanes");
 if(x.service_id==="forge_mundane"&&!ingredients.length)fail("forge needs verified materials or currency cost");
 if(x.service_id==="inscribe"&&ingredients.length)fail("P20B inscribe subset permits no optional materials");
 return Object.freeze({request_id,service_id:x.service_id,town_id:x.town_id,crafter_id,recipe_key:x.recipe_key,primary_item_id,ingredients:Object.freeze(ingredients)});
}
