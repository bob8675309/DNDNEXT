import fs from "node:fs";
import path from "node:path";

const rel = path.join("pages", "town", "[id].js");
const target = path.join(process.cwd(), rel);
let source = fs.readFileSync(target, "utf8");

function replaceRequired(before, after, label) {
  if (source.includes(after)) return;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

function replaceBetween(startMarker, endMarker, replacement, label) {
  if (source.includes(replacement)) return;
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker not found`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`${label}: end marker not found`);
  source = source.slice(0, start) + replacement + "\n" + source.slice(end + endMarker.length);
}

function requireToken(token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

function requireAbsent(token, label) {
  if (source.includes(token)) throw new Error(`${label}: forbidden ${token}`);
}

const helperBlock = [
  'async function townRouteStep(label, task, { timeoutMs = 8000, required = false, fallback = null } = {}) {',
  '  let timeoutId = null;',
  '  const timeout = new Promise((resolve) => {',
  '    timeoutId = setTimeout(() => resolve({ timedOut: true }), timeoutMs);',
  '  });',
  '  const work = Promise.resolve()',
  '    .then(task)',
  '    .then((result) => ({ result }), (error) => ({ error }));',
  '  const outcome = await Promise.race([work, timeout]);',
  '  if (timeoutId) clearTimeout(timeoutId);',
  '',
  '  if (outcome?.timedOut) {',
  '    const message = `${label} timed out after ${timeoutMs}ms`;',
  '    console.warn("Town route load step skipped", message);',
  '    if (required) throw new Error(message);',
  '    return fallback;',
  '  }',
  '  if (outcome?.error) {',
  '    console.warn("Town route load step failed", label, outcome.error?.message || outcome.error);',
  '    if (required) throw outcome.error;',
  '    return fallback;',
  '  }',
  '  return outcome?.result ?? fallback;',
  '}',
  '',
  'function townQueryData(label, result, fallback = []) {',
  '  if (result?.error) {',
  '    console.warn(`${label} load skipped`, result.error?.message || result.error);',
  '    return fallback;',
  '  }',
  '  return result?.data ?? fallback;',
  '}',
  '',
].join("\n");

if (!source.includes("async function townRouteStep(")) {
  replaceRequired(
    "export default function TownPage() {",
    `${helperBlock}export default function TownPage() {`,
    "Town route load timeout helpers"
  );
}

const guardedLoadEffect = [
  '  useEffect(() => {',
  '    let alive = true;',
  '    const load = async () => {',
  '      if (!router.isReady) return;',
  '      if (!id) {',
  '        setLocation(null);',
  '        setRosterChars([]);',
  '        setQuests([]);',
  '        setStoredLabels([]);',
  '        setMarketData({ presentMerchants: [], residentMerchants: [] });',
  '        setPlayerInventory([]);',
  '        setPlayerPlants([]);',
  '        setLoading(false);',
  '        return;',
  '      }',
  '',
  '      setLoading(true);',
  '      setLocation(null);',
  '      setRosterChars([]);',
  '      setQuests([]);',
  '      setStoredLabels([]);',
  '      setMarketData({ presentMerchants: [], residentMerchants: [] });',
  '',
  '      try {',
  '        const authResult = await townRouteStep(',
  '          "auth session",',
  '          () => supabase.auth.getSession(),',
  '          { timeoutMs: 5000, fallback: { data: { session: null } } }',
  '        );',
  '        const user = authResult?.data?.session?.user || null;',
  '        const adminResult = user?.id',
  '          ? await townRouteStep("admin check", () => supabase.rpc("is_admin", { uid: user.id }), { timeoutMs: 5000, fallback: { data: false } })',
  '          : { data: false };',
  '        const admin = !!adminResult?.data;',
  '        if (!alive) return;',
  '        setIsAdmin(admin);',
  '        setPlayerUserId(user?.id || null);',
  '',
  '        const locResult = await townRouteStep(',
  '          "town location",',
  '          () => supabase.from("locations").select("*").eq("id", id).single(),',
  '          { timeoutMs: 9000, required: true }',
  '        );',
  '        if (locResult?.error) throw locResult.error;',
  '        const loc = locResult?.data || null;',
  '        if (!loc) throw new Error("Town " + id + " was not found.");',
  '        if (!alive) return;',
  '        setLocation(loc);',
  '        setLoading(false);',
  '',
  '        const merchantSelect = [',
  '          "id",',
  '          "name",',
  '          "kind",',
  '          "race",',
  '          "role",',
  '          "affiliation",',
  '          "status",',
  '          "state",',
  '          "location_id",',
  '          "home_location_id",',
  '          "storefront_enabled",',
  '          "storefront_title",',
  '          "storefront_tagline",',
  '          "storefront_bg_url",',
  '          "storefront_bg_image_url",',
  '          "storefront_bg_video_url",',
  '          "tags",',
  '        ].join(",");',
  '',
  '        const rawQuestKeys = Array.isArray(loc?.quests) ? loc.quests.map(pickId).filter(Boolean) : [];',
  '',
  '        const rosterTask = townRouteStep(',
  '          "town roster",',
  '          () => supabase',
  '            .from("characters")',
  '            .select("id,name,kind,race,role,affiliation,status,state,location_id,last_known_location_id,projected_destination_id,is_hidden,map_icon_id,tags")',
  '            .in("kind", ["npc", "merchant"])',
  '            .eq("location_id", id)',
  '            .order("name", { ascending: true }),',
  '          { timeoutMs: 9000, fallback: { data: [] } }',
  '        );',
  '',
  '        const presentMerchantTask = townRouteStep(',
  '          "present merchants",',
  '          () => supabase',
  '            .from("characters")',
  '            .select(merchantSelect)',
  '            .eq("kind", "merchant")',
  '            .eq("location_id", id)',
  '            .order("name", { ascending: true }),',
  '          { timeoutMs: 9000, fallback: { data: [] } }',
  '        );',
  '',
  '        const residentMerchantTask = townRouteStep(',
  '          "resident merchants",',
  '          () => supabase',
  '            .from("characters")',
  '            .select(merchantSelect)',
  '            .eq("kind", "merchant")',
  '            .eq("home_location_id", id)',
  '            .order("name", { ascending: true }),',
  '          { timeoutMs: 9000, fallback: { data: [] } }',
  '        );',
  '',
  '        const questTask = rawQuestKeys.length',
  '          ? townRouteStep("town quests", () => supabase.from("quests").select("id, title, status").in("id", rawQuestKeys), { timeoutMs: 7000, fallback: { data: [] } })',
  '          : Promise.resolve({ data: [] });',
  '',
  '        const labelsTask = townRouteStep(',
  '          "town map labels",',
  '          () => supabase',
  '            .from("town_map_labels")',
  '            .select("*")',
  '            .eq("location_id", id)',
  '            .order("sort_order", { ascending: true }),',
  '          { timeoutMs: 9000, fallback: { data: [] } }',
  '        );',
  '',
  '        const inventoryTask = user?.id',
  '          ? townRouteStep(',
  '              "player inventory",',
  '              () => supabase',
  '                .from("inventory_items")',
  '                .select("id,user_id,item_id,item_name,item_type,item_rarity,item_description,item_weight,item_cost,created_at,card_payload,owner_type,owner_id,is_equipped")',
  '                .eq("user_id", user.id)',
  '                .or("owner_type.is.null,owner_type.eq.player")',
  '                .order("item_name", { ascending: true }),',
  '              { timeoutMs: 9000, fallback: { data: [] } }',
  '            )',
  '          : Promise.resolve({ data: [] });',
  '',
  '        const plantsTask = user?.id',
  '          ? townRouteStep("player plants", () => loadPlayerPlantsForUser(user.id), { timeoutMs: 9000, fallback: [] })',
  '          : Promise.resolve([]);',
  '',
  '        const [rosterResult, presentResult, residentResult, questResult, labelResult, inventoryResult, plantRows] = await Promise.all([',
  '          rosterTask,',
  '          presentMerchantTask,',
  '          residentMerchantTask,',
  '          questTask,',
  '          labelsTask,',
  '          inventoryTask,',
  '          plantsTask,',
  '        ]);',
  '        if (!alive) return;',
  '',
  '        const rosterData = townQueryData("town roster", rosterResult, []);',
  '        setRosterChars(Array.isArray(rosterData) ? rosterData : []);',
  '',
  '        const presentMerchants = townQueryData("present merchants", presentResult, []);',
  '        const residentMerchants = townQueryData("resident merchants", residentResult, []);',
  '        setMarketData({',
  '          presentMerchants: dedupeMerchants(presentMerchants || []),',
  '          residentMerchants: dedupeMerchants(residentMerchants || []),',
  '        });',
  '',
  '        const questData = townQueryData("town quests", questResult, []);',
  '        const byId = new Map((questData || []).map((q) => [q.id, q]));',
  '        setQuests(rawQuestKeys.map((qid) => byId.get(qid)).filter(Boolean));',
  '',
  '        const labelRows = townQueryData("town map labels", labelResult, []);',
  '        setStoredLabels((labelRows || []).map(normalizeMapRow));',
  '',
  '        const inventoryRows = townQueryData("player inventory", inventoryResult, []);',
  '        setPlayerInventory((inventoryRows || []).map(normalizeInventoryRow).filter(Boolean));',
  '        setPlayerPlants(Array.isArray(plantRows) ? plantRows : []);',
  '      } catch (err) {',
  '        console.error("TownPage load failed", err);',
  '        if (alive) setLocation(null);',
  '      } finally {',
  '        if (alive) setLoading(false);',
  '      }',
  '    };',
  '    load();',
  '    return () => {',
  '      alive = false;',
  '    };',
  '  }, [router.isReady, id]);',
].join("\n");

if (!source.includes('townRouteStep("town location"')) {
  replaceBetween(
    '  useEffect(() => {\n    let alive = true;\n    const load = async () => {\n      if (!id) return;',
    '  }, [id]);',
    guardedLoadEffect,
    "Town route nonblocking load with timeouts"
  );
}

fs.writeFileSync(target, source, "utf8");

for (const token of [
  "async function townRouteStep",
  "function townQueryData",
  "if (!router.isReady) return;",
  "setLocation(loc);",
  "setLoading(false);",
  'townRouteStep("town location"',
  'townRouteStep("town roster"',
  'townRouteStep("present merchants"',
  'townRouteStep("town map labels"',
  'townRouteStep("player plants"',
  "Promise.all([\n          rosterTask,",
  "Town route load step skipped",
]) {
  requireToken(token, "Town route loading guard");
}

for (const token of [
  "await loadPlayerPlantsForUser(user.id);\n          if (!alive) return;",
]) {
  requireAbsent(token, "Town route loading guard should not block on player plants before rendering town shell");
}

console.log("Patched town route loading guard.");
