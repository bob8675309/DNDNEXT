import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import TownSheet from "../../components/TownSheet";
import { supabase } from "../../utils/supabaseClient";
import { pickId } from "../../utils/townData";

function normalizeMapRow(row) {
  return {
    id: row?.id,
    key: row?.key || row?.id,
    name: row?.name,
    x: Number(row?.x ?? 50),
    y: Number(row?.y ?? 50),
    tone: row?.tone || "stone",
    targetPanel: row?.target_panel || null,
    category: row?.category || null,
    labelType: row?.label_type || "location",
    notes: row?.notes || null,
    isVisible: row?.is_visible !== false,
  };
}

function objectPathFromStored(path) {
  if (!path) return "";
  const trimmed = String(path).trim();
  if (!trimmed) return "";
  return trimmed.replace(/^town-maps\//i, "").replace(/^\/+/, "");
}


function normalizeMerchantRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || "Unknown Merchant",
    kind: row.kind || "merchant",
    race: row.race || null,
    role: row.role || null,
    affiliation: row.affiliation || null,
    status: row.status || null,
    state: row.state || null,
    location_id: row.location_id ?? null,
    home_location_id: row.home_location_id ?? null,
    storefront_enabled: !!row.storefront_enabled,
    storefront_title: row.storefront_title || null,
    storefront_tagline: row.storefront_tagline || null,
    storefront_bg_url: row.storefront_bg_url || null,
    storefront_bg_image_url: row.storefront_bg_image_url || null,
    storefront_bg_video_url: row.storefront_bg_video_url || null,
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}

function dedupeMerchants(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    const m = normalizeMerchantRow(row);
    if (!m?.id) continue;
    byId.set(m.id, m);
  }
  return Array.from(byId.values()).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function normalizeInventoryRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id || null,
    item_id: row.item_id || null,
    item_name: row.item_name || row.item_id || "Unknown Item",
    item_type: row.item_type || null,
    item_rarity: row.item_rarity || null,
    item_description: row.item_description || null,
    item_weight: row.item_weight || null,
    item_cost: row.item_cost || null,
    created_at: row.created_at || null,
    card_payload: row.card_payload || null,
    owner_type: row.owner_type || null,
    owner_id: row.owner_id || null,
    is_equipped: !!row.is_equipped,
  };
}


function stripCraftTypeTag(value) {
  return String(value || "").split("|")[0].trim();
}

function normalizeCraftType(item) {
  const payload = item?.card_payload && typeof item.card_payload === "object" ? item.card_payload : {};
  const fields = [
    item?.item_type,
    payload.item_type,
    item?.uiType,
    payload.uiType,
    item?.rawType,
    payload.rawType,
    item?.type,
    payload.type,
    item?.__cls?.uiType,
    item?.__cls?.rawType,
    item?.item_name,
    payload.item_name,
    item?.name,
    payload.name,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  const blob = fields.join(" | ");
  const typeCodes = fields.map((value) => stripCraftTypeTag(value).toUpperCase());

  if (typeCodes.some((code) => code === "S" || code === "SH") || /(^|\b)shield(\b|$)/.test(blob)) return "shield";
  if (typeCodes.some((code) => code === "A") || /(^|\b)(ammunition|arrow|bolt|bullet)(\b|$)/.test(blob)) return "ammunition";
  if (typeCodes.some((code) => ["LA", "MA", "HA"].includes(code)) || /(^|\b)(armor|armour|breastplate|chain mail|scale mail|half plate|plate armor|leather armor|hide armor)(\b|$)/.test(blob)) return "armor";
  if (typeCodes.some((code) => code === "M" || code === "R") || /(^|\b)(weapon|melee weapon|ranged weapon|sword|bow|axe|mace|staff|hammer|spear|halberd|crossbow|dagger|club|flail|javelin|rapier|scimitar|trident|whip)(\b|$)/.test(blob)) return "weapon";
  if (/(potion|poison|elixir|brew|philter)/.test(blob)) return "potion";
  if (/(scroll)/.test(blob)) return "scroll";
  if (/(tool|kit)/.test(blob)) return "tool";
  if (/(book|manual|tome)/.test(blob)) return "book";
  if (/(wondrous|ring|amulet|rod|wand)/.test(blob)) return "wondrous item";
  return "gear";
}

function detectMaterialLabel(item) {
  const name = String(item?.item_name || "").toLowerCase();
  if (!name) return "";
  if (name.includes("adamant")) return "Adamantine";
  if (name.includes("mithral")) return "Mithral";
  if (name.includes("silver")) return "Silvered";
  if (name.includes("ruidium")) return "Ruidium";
  if (name.includes("cold iron")) return "Cold Iron";
  if (name.includes("obsidian")) return "Obsidian";
  return "";
}

function addBonusToEveryDiceSegment(value, bonus) {
  if (!value || !bonus) return value || "";
  return String(value).replace(/(\d+d\d+)(?!\s*\+\s*\d+)/g, (match) => `${match}+${bonus}`);
}

function applyBonusToDamageText(value, bonus) {
  if (!bonus || !value) return value || "";
  return addBonusToEveryDiceSegment(value, bonus);
}

function applyBonusToAC(value, bonus) {
  if (!bonus) return value || "";
  const raw = String(value || "").trim();
  const n = parseInt(raw, 10);
  if (Number.isFinite(n)) return String(n + bonus);
  return raw ? `${raw} (+${bonus})` : "";
}


function normalizeRarityLabel(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("legend")) return "Legendary";
  if (text.includes("very")) return "Very Rare";
  if (text.includes("rare")) return "Rare";
  if (text.includes("uncommon")) return "Uncommon";
  if (text.includes("common")) return "Common";
  return "";
}

function detectTierFromCraftedItem(item) {
  const payload = item?.card_payload && typeof item.card_payload === "object" ? item.card_payload : {};
  const candidates = [
    item?.crafted_bonus,
    item?.crafted_tier,
    item?.bonus,
    item?.tier,
    payload.crafted_bonus,
    payload.crafted_tier,
    payload.enchant_tier,
    payload.bonus,
    payload.tier,
    payload.enhancement_bonus,
  ];
  for (const value of candidates) {
    const n = parseInt(String(value || "").replace(/[^0-9-]/g, ""), 10);
    if ([1, 2, 3].includes(n)) return n;
  }
  const blob = [item?.item_name, payload.item_name, payload.name, payload.bonusWeapon, payload.bonusAc].filter(Boolean).join(" ");
  const match = blob.match(/(?:^|\s)\+(1|2|3)\b/);
  return match ? Number(match[1]) : 0;
}

function normalizeMagicVariantSelections(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && row.key && row.name)
    .slice(0, 3)
    .map((row) => ({
      slot: String(row.slot || "").toUpperCase(),
      key: String(row.key || ""),
      name: String(row.name || ""),
      option: row.option || null,
      label: row.label || row.name || "",
      text: row.text || "",
      rarity: normalizeRarityLabel(row.rarity),
      appliesTo: Array.isArray(row.appliesTo) ? row.appliesTo : [],
      attunement: !!row.attunement,
      cursed: !!row.cursed,
    }))
    .filter((row) => ["A", "B", "C"].includes(row.slot));
}

function highestRarity(...values) {
  const order = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];
  return values
    .map(normalizeRarityLabel)
    .filter(Boolean)
    .reduce((best, current) => order.indexOf(current) > order.indexOf(best || "") ? current : best, "") || "Common";
}

function computeCraftedRarity({ serviceId, bonus, materialItem, catalysts = [] }) {
  const catalystCount = catalysts.filter(Boolean).length;
  const materialLabel = detectMaterialLabel(materialItem);
  if (serviceId === "brew") {
    if (catalystCount >= 2) return "Rare";
    if (catalystCount >= 1) return "Uncommon";
    return "Common";
  }
  if (bonus >= 3 || materialLabel === "Ruidium") return "Very Rare";
  if (bonus >= 2 || catalystCount >= 2) return "Rare";
  if (bonus >= 1 || materialLabel || catalystCount >= 1) return "Uncommon";
  return "Common";
}

function buildCraftedResult({ crafter, serviceId, primaryItem, secondaryItem, materialItem, catalystA, catalystB, catalystC, bonus = 0, enchantTier = 0, magicVariants = [], imbueDraft = null }) {
  const catalysts = [catalystA, catalystB, catalystC].filter(Boolean);
  const baseName = String(primaryItem?.item_name || "Crafted Item").trim();
  const materialLabel = detectMaterialLabel(materialItem);
  const normalizedMagicVariants = normalizeMagicVariantSelections(magicVariants);
  const rarity = serviceId === "imbue"
    ? highestRarity(primaryItem?.item_rarity, primaryItem?.card_payload?.rarity, imbueDraft?.rarity, ...normalizedMagicVariants.map((variant) => variant.rarity))
    : computeCraftedRarity({ serviceId, bonus, materialItem, catalysts });
  const catalystNames = catalysts.map((item) => item.item_name).filter(Boolean);
  const crafterName = crafter?.name || "Town Crafter";

  if (serviceId === "imbue") {
    const tier = Number(enchantTier) || Number(bonus) || detectTierFromCraftedItem(primaryItem);
    const basePayload = primaryItem?.card_payload && typeof primaryItem.card_payload === "object" ? { ...primaryItem.card_payload } : {};
    const craftedName = String(imbueDraft?.name || baseName || "Enchanted Item").replace(/\s+/g, " ").trim();
    const enchantEntries = Array.isArray(imbueDraft?.entries) && imbueDraft.entries.length
      ? imbueDraft.entries
      : normalizedMagicVariants.map((variant) => variant.text).filter(Boolean);
    const descriptionParts = [
      `${crafterName} bound ${normalizedMagicVariants.length || "no"} magical trait${normalizedMagicVariants.length === 1 ? "" : "s"} into ${baseName} at smith tier +${tier}.`,
    ];
    if (enchantEntries.length) descriptionParts.push(enchantEntries.join(" "));
    if (catalystNames.length) descriptionParts.push(`Catalysts used: ${catalystNames.join(", ")}.`);
    const description = descriptionParts.join(" ");
    const craftedPayload = {
      ...basePayload,
      name: craftedName,
      item_name: craftedName,
      item_type: normalizeCraftType(primaryItem),
      rarity,
      item_rarity: rarity,
      item_description: description,
      entries: enchantEntries,
      crafted_by: crafterName,
      crafted_service: serviceId,
      crafted_bonus: tier,
      enchant_tier: tier,
      enchant_slots: normalizedMagicVariants,
      crafted_material: materialLabel || null,
      crafted_components: catalystNames,
      requires_attunement: normalizedMagicVariants.some((variant) => variant.attunement) || !!basePayload.requires_attunement,
      cursed: normalizedMagicVariants.some((variant) => variant.cursed) || !!basePayload.cursed,
      flavor: basePayload.flavor || description,
    };

    return {
      item_id: `crafted-${Date.now()}`,
      item_name: craftedName,
      item_type: craftedPayload.item_type,
      item_rarity: rarity,
      item_description: description,
      item_weight: primaryItem?.item_weight || null,
      item_cost: primaryItem?.item_cost || null,
      card_payload: craftedPayload,
    };
  }

  const prefix = [];
  if (bonus > 0 && serviceId !== "brew") prefix.push(`+${bonus}`);
  if (materialLabel && serviceId !== "brew") prefix.push(materialLabel);
  if (serviceId === "brew") prefix.push("Distilled");
  const craftedName = `${prefix.join(" ")} ${baseName}`.replace(/\s+/g, " ").trim();

  const descriptionParts = [];
  switch (serviceId) {
    case "forge_mundane":
      descriptionParts.push(`${crafterName} forged a fresh ${baseName}${materialLabel ? ` using ${materialLabel.toLowerCase()} materials` : ""}.`);
      break;
    case "reforge":
      descriptionParts.push(`${crafterName} reforged ${baseName}${materialLabel ? ` with ${materialLabel.toLowerCase()} materials` : ""}${bonus > 0 ? ` and tempered it to a +${bonus} finish` : ""}.`);
      break;
    case "imbue":
      descriptionParts.push(`${crafterName} etched arcane work into ${baseName}${materialLabel ? ` over a ${materialLabel.toLowerCase()} finish` : ""}${bonus > 0 ? ` and stabilized the enchantment at +${bonus}` : ""}.`);
      break;
    case "brew":
      descriptionParts.push(`${crafterName} brewed ${baseName}${secondaryItem?.item_name ? ` with ${secondaryItem.item_name}` : ""} into an unstable but potent alchemical draft.`);
      break;
    case "inscribe":
      descriptionParts.push(`${crafterName} inscribed ${baseName} into a utility script or encoded form.`);
      break;
    case "socket":
      descriptionParts.push(`${crafterName} socketed and polished ${baseName} into a gem-set variant.`);
      break;
    default:
      descriptionParts.push(`${crafterName} reworked ${baseName} into a town-crafted variant.`);
      break;
  }
  if (catalystNames.length) descriptionParts.push(`Catalysts used: ${catalystNames.join(", ")}.`);
  const description = descriptionParts.join(" ");

  const basePayload = primaryItem?.card_payload && typeof primaryItem.card_payload === "object" ? { ...primaryItem.card_payload } : {};
  const payloadDamage = applyBonusToDamageText(basePayload.damageText || basePayload.damage || "", bonus);
  const payloadAc = applyBonusToAC(basePayload.ac || basePayload.armorClass || "", bonus);
  const craftedPayload = {
    ...basePayload,
    name: craftedName,
    item_name: craftedName,
    item_type: normalizeCraftType(primaryItem),
    rarity,
    item_rarity: rarity,
    item_description: description,
    damageText: payloadDamage || basePayload.damageText || "",
    ac: payloadAc || basePayload.ac || "",
    crafted_by: crafterName,
    crafted_service: serviceId,
    crafted_bonus: bonus || 0,
    crafted_material: materialLabel || null,
    crafted_components: [secondaryItem?.item_name || null, ...catalystNames].filter(Boolean),
    flavor: basePayload.flavor || description,
  };

  return {
    item_id: `crafted-${Date.now()}`,
    item_name: craftedName,
    item_type: craftedPayload.item_type,
    item_rarity: rarity,
    item_description: description,
    item_weight: primaryItem?.item_weight || null,
    item_cost: primaryItem?.item_cost || null,
    card_payload: craftedPayload,
  };
}

function normalizeForgeTemplate(template) {
  if (!template) return null;
  return {
    id: null,
    user_id: null,
    item_id: template.item_id || null,
    item_name: template.item_name || template.name || "Forged Item",
    item_type: template.item_type || template.type || template.card_payload?.uiType || template.card_payload?.type || "gear",
    item_rarity: template.item_rarity || template.rarity || "Common",
    item_description: template.item_description || "",
    item_weight: template.item_weight || null,
    item_cost: template.item_cost || null,
    created_at: null,
    card_payload: template.card_payload || null,
    owner_type: "player",
    owner_id: null,
    is_equipped: false,
  };
}

async function getImageDimensions(file) {
  if (!file) return { width: null, height: null };
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: null, height: null });
    };
    img.src = objectUrl;
  });
}

export default function TownPage() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [location, setLocation] = useState(null);
  const [rosterChars, setRosterChars] = useState([]);
  const [quests, setQuests] = useState([]);
  const [storedLabels, setStoredLabels] = useState([]);
  const [pendingMapFile, setPendingMapFile] = useState(null);
  const [mapFileInputKey, setMapFileInputKey] = useState(0);
  const [mapApplyState, setMapApplyState] = useState({ status: "idle", message: "" });
  const [labelSaveState, setLabelSaveState] = useState({ status: "idle", message: "" });
  const [marketData, setMarketData] = useState({ presentMerchants: [], residentMerchants: [] });
  const [playerInventory, setPlayerInventory] = useState([]);
  const [playerUserId, setPlayerUserId] = useState(null);

  const mapImageUrl = useMemo(() => {
    const objectPath = objectPathFromStored(location?.town_map_image_path);
    if (!objectPath) return null;
    try {
      const { data } = supabase.storage.from("town-maps").getPublicUrl(objectPath);
      return data?.publicUrl ? `${data.publicUrl}${data.publicUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(location?.updated_at || location?.town_map_image_path || "town-map"))}` : null;
    } catch {
      return null;
    }
  }, [location?.town_map_image_path]);

  const imageNaturalSize = useMemo(
    () => ({
      width: Number(location?.town_map_image_width || 0) || null,
      height: Number(location?.town_map_image_height || 0) || null,
    }),
    [location?.town_map_image_width, location?.town_map_image_height]
  );

  const questKeys = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location?.quests]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getSession();
        const user = authData?.session?.user || null;
        let admin = false;
        if (user?.id) {
          const { data: isAdminRpc } = await supabase.rpc("is_admin", { uid: user.id });
          admin = !!isAdminRpc;
        }
        if (alive) {
          setIsAdmin(admin);
          setPlayerUserId(user?.id || null);
        }

        const { data: loc, error: locErr } = await supabase.from("locations").select("*").eq("id", id).single();
        if (locErr) throw locErr;
        if (!alive) return;
        setLocation(loc);

        const { data: rosterData } = await supabase
          .from("characters")
          .select("id,name,kind,race,role,affiliation,status,state,location_id,last_known_location_id,projected_destination_id,is_hidden,map_icon_id,tags")
          .in("kind", ["npc", "merchant"])
          .eq("location_id", id)
          .order("name", { ascending: true });
        if (!alive) return;
        setRosterChars(Array.isArray(rosterData) ? rosterData : []);

        const merchantSelect = [
          "id",
          "name",
          "kind",
          "race",
          "role",
          "affiliation",
          "status",
          "state",
          "location_id",
          "home_location_id",
          "storefront_enabled",
          "storefront_title",
          "storefront_tagline",
          "storefront_bg_url",
          "storefront_bg_image_url",
          "storefront_bg_video_url",
          "tags",
        ].join(",");

        const [{ data: presentMerchants, error: presentErr }, { data: residentMerchants, error: residentErr }] = await Promise.all([
          supabase
            .from("characters")
            .select(merchantSelect)
            .eq("kind", "merchant")
            .eq("location_id", id)
            .order("name", { ascending: true }),
          supabase
            .from("characters")
            .select(merchantSelect)
            .eq("kind", "merchant")
            .eq("home_location_id", id)
            .order("name", { ascending: true }),
        ]);
        if (presentErr) console.warn("present merchants load skipped", presentErr.message);
        if (residentErr) console.warn("resident merchants load skipped", residentErr.message);
        if (!alive) return;
        setMarketData({
          presentMerchants: dedupeMerchants(presentMerchants || []),
          residentMerchants: dedupeMerchants(residentMerchants || []),
        });

        if (user?.id) {
          const { data: inventoryRows, error: inventoryErr } = await supabase
            .from("inventory_items")
            .select("id,user_id,item_id,item_name,item_type,item_rarity,item_description,item_weight,item_cost,created_at,card_payload,owner_type,owner_id,is_equipped")
            .eq("user_id", user.id)
            .or("owner_type.is.null,owner_type.eq.player")
            .order("item_name", { ascending: true });
          if (inventoryErr) console.warn("player inventory load skipped", inventoryErr.message);
          if (!alive) return;
          setPlayerInventory((inventoryRows || []).map(normalizeInventoryRow).filter(Boolean));
        } else {
          setPlayerInventory([]);
        }

        const rawQuestKeys = Array.isArray(loc?.quests) ? loc.quests.map(pickId).filter(Boolean) : [];
        if (rawQuestKeys.length) {
          const { data: questData } = await supabase.from("quests").select("id, title, status").in("id", rawQuestKeys);
          if (!alive) return;
          const byId = new Map((questData || []).map((q) => [q.id, q]));
          setQuests(rawQuestKeys.map((qid) => byId.get(qid)).filter(Boolean));
        } else {
          setQuests([]);
        }

        const { data: labelRows, error: labelErr } = await supabase
          .from("town_map_labels")
          .select("*")
          .eq("location_id", id)
          .order("sort_order", { ascending: true });
        if (labelErr) console.warn("town_map_labels load skipped", labelErr.message);
        if (!alive) return;
        setStoredLabels((labelRows || []).map(normalizeMapRow));
      } catch (err) {
        console.error("TownPage load failed", err);
        if (alive) setLocation(null);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  async function handleSaveMapData({ labels }) {
    if (!id) return;

    setLabelSaveState({ status: "saving", message: "Saving label changes..." });

    const labelRows = (labels || []).map((item, idx) => ({
      location_id: id,
      key: item.key || item.id || `label-${idx}`,
      name: item.name,
      x: Number(item.x ?? 50),
      y: Number(item.y ?? 50),
      tone: item.tone || "stone",
      target_panel: item.labelType === "location" ? item.targetPanel || null : null,
      category: item.category || null,
      label_type: item.labelType || "location",
      notes: item.notes || null,
      is_visible: item.isVisible !== false,
      sort_order: idx,
    }));

    try {
      const { error: delLabelErr } = await supabase.from("town_map_labels").delete().eq("location_id", id);
      if (delLabelErr) throw delLabelErr;

      if (labelRows.length) {
        const { error: insLabelErr } = await supabase.from("town_map_labels").insert(labelRows).select("*");
        if (insLabelErr) throw insLabelErr;
      }

      const { data: refreshedRows, error: refreshErr } = await supabase
        .from("town_map_labels")
        .select("*")
        .eq("location_id", id)
        .order("sort_order", { ascending: true });
      if (refreshErr) throw refreshErr;

      setStoredLabels((refreshedRows || []).map(normalizeMapRow));
      setLabelSaveState({ status: "success", message: "Town map labels saved." });
    } catch (err) {
      console.error("Town label save failed", err);
      setLabelSaveState({ status: "error", message: err?.message || "Failed to save town map labels." });
      throw err;
    }
  }

  function handleSelectMapImage(event) {
    const file = event?.target?.files?.[0] || null;
    if (!file) {
      setPendingMapFile(null);
      setMapApplyState({ status: "idle", message: "" });
      return;
    }

    setPendingMapFile(file);
    setMapApplyState({
      status: "selected",
      message: `Selected ${file.name}. Click Apply Map to upload and switch the town map.`,
    });
  }

  function handleClearPendingMap() {
    setPendingMapFile(null);
    setMapFileInputKey((v) => v + 1);
    setMapApplyState({ status: "idle", message: "" });
  }

  async function handleApplyMapImage() {
    if (!pendingMapFile || !id) return;
    const file = pendingMapFile;
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const objectPath = `town-${id}-${Date.now()}.${ext}`;
    setMapApplyState({ status: "uploading", message: `Uploading ${file.name}...` });

    try {
      const dims = await getImageDimensions(file);

      const { error: uploadErr } = await supabase.storage
        .from("town-maps")
        .upload(objectPath, file, { upsert: true, contentType: file.type || undefined });
      if (uploadErr) throw uploadErr;

      const prevPath = objectPathFromStored(location?.town_map_image_path);
      const { data: updated, error: updErr } = await supabase
        .from("locations")
        .update({
          town_map_image_path: objectPath,
          town_map_image_width: dims.width,
          town_map_image_height: dims.height,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (updErr) throw updErr;

      if (prevPath && prevPath !== objectPath) {
        await supabase.storage.from("town-maps").remove([prevPath]).catch(() => null);
      }

      setLocation(updated);
      setPendingMapFile(null);
      setMapFileInputKey((v) => v + 1);
      setMapApplyState({ status: "success", message: `Applied new town map: ${file.name}` });
    } catch (err) {
      console.error("Town map upload failed", err);
      setMapApplyState({
        status: "error",
        message: err?.message || "Town map upload failed. Check storage permissions and the locations table update.",
      });
    }
  }

  async function handleDeleteMapImage() {
    if (!id) return;
    setMapApplyState({ status: "deleting", message: "Removing stored town map..." });
    try {
      const prevPath = objectPathFromStored(location?.town_map_image_path);
      if (prevPath) {
        await supabase.storage.from("town-maps").remove([prevPath]).catch(() => null);
      }
      const { data: updated, error } = await supabase
        .from("locations")
        .update({
          town_map_image_path: null,
          town_map_image_width: null,
          town_map_image_height: null,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      setLocation(updated);
      setPendingMapFile(null);
      setMapFileInputKey((v) => v + 1);
      setMapApplyState({ status: "success", message: "Stored town map removed. Fallback map will be shown if this town has one." });
    } catch (err) {
      console.error("Town map delete failed", err);
      setMapApplyState({ status: "error", message: err?.message || "Failed to delete stored town map." });
    }
  }


async function handleCraftWorkshop({ crafter, serviceId, primaryItemId, forgeTemplate, secondaryItemId, materialItemId, catalystAId, catalystBId, catalystCId, bonus = 0, enchantTier = 0, magicVariants = [], imbueDraft = null }) {
  if (!playerUserId) throw new Error("You must be logged in to craft items.");

  const byId = new Map((playerInventory || []).map((item) => [item.id, item]));
  const primaryItem = primaryItemId ? (byId.get(primaryItemId) || null) : normalizeForgeTemplate(forgeTemplate);
  const secondaryItem = byId.get(secondaryItemId) || null;
  const materialItem = byId.get(materialItemId) || null;
  const catalystA = byId.get(catalystAId) || null;
  const catalystB = byId.get(catalystBId) || null;
  const catalystC = byId.get(catalystCId) || null;

  if (!primaryItem) throw new Error(serviceId === "forge_mundane" ? "Choose a forge pattern first." : "Choose a base item from your inventory.");
  if (serviceId === "brew" && !secondaryItem) throw new Error("Alchemy blends require a secondary ingredient.");
  if (serviceId === "imbue") {
    const effectiveTier = Number(enchantTier) || Number(bonus) || detectTierFromCraftedItem(primaryItem);
    const normalizedMagicVariants = normalizeMagicVariantSelections(magicVariants);
    const allowedTypes = new Set(["weapon", "armor", "shield", "ammunition"]);
    if (!allowedTypes.has(normalizeCraftType(primaryItem))) throw new Error("Enchanters can only imbue weapons, armor, shields, and ammunition for now.");
    if (![1, 2, 3].includes(effectiveTier)) throw new Error("Enchanters require an item already tiered by a smith (+1, +2, or +3).");
    if (!normalizedMagicVariants.length) throw new Error("Choose at least one magical trait.");
    if (normalizedMagicVariants.length > effectiveTier) throw new Error(`Tier +${effectiveTier} can only hold ${effectiveTier} enchant slot${effectiveTier === 1 ? "" : "s"}.`);
  }

  const chosenIds = [primaryItemId, secondaryItemId, materialItemId, catalystAId, catalystBId, catalystCId].filter(Boolean);
  if (new Set(chosenIds).size !== chosenIds.length) {
    throw new Error("The same inventory item cannot fill multiple crafting slots.");
  }

  const crafted = buildCraftedResult({
    crafter,
    serviceId,
    primaryItem,
    secondaryItem,
    materialItem,
    catalystA,
    catalystB,
    catalystC,
    bonus: Number(bonus) || 0,
    enchantTier: Number(enchantTier) || 0,
    magicVariants,
    imbueDraft,
  });
  const consumedIds = Array.from(new Set(chosenIds));
  const consumedRows = consumedIds.map((itemId) => byId.get(itemId)).filter(Boolean);

  const craftedInsert = {
    user_id: playerUserId,
    owner_type: "player",
    owner_id: playerUserId,
    is_equipped: false,
    ...crafted,
  };

  const rollbackRows = consumedRows.map((item) => ({
    id: item.id,
    user_id: item.user_id || playerUserId,
    item_id: item.item_id,
    item_name: item.item_name,
    item_type: item.item_type,
    item_rarity: item.item_rarity,
    item_description: item.item_description,
    item_weight: item.item_weight,
    item_cost: item.item_cost,
    created_at: item.created_at,
    card_payload: item.card_payload,
    owner_type: item.owner_type,
    owner_id: item.owner_id,
    is_equipped: !!item.is_equipped,
  }));

  // Forge Mundane starts from a catalog template, so there might be no base inventory
  // item to consume. Avoid calling Supabase .in("id", []) in that path; Reforge and
  // material/catalyst consumption still delete selected inventory rows as before.
  if (consumedIds.length) {
    const { error: deleteErr } = await supabase.from("inventory_items").delete().eq("user_id", playerUserId).in("id", consumedIds);
    if (deleteErr) throw deleteErr;
  }

  const { data: insertedRows, error: insertErr } = await supabase
    .from("inventory_items")
    .insert(craftedInsert)
    .select("id,user_id,item_id,item_name,item_type,item_rarity,item_description,item_weight,item_cost,created_at,card_payload,owner_type,owner_id,is_equipped");
  if (insertErr) {
    if (rollbackRows.length) {
      await supabase.from("inventory_items").insert(rollbackRows);
    }
    throw insertErr;
  }

  const inserted = normalizeInventoryRow(insertedRows?.[0] || craftedInsert);
  setPlayerInventory((prev) =>
    [...(prev || []).filter((item) => !consumedIds.includes(item.id)), inserted].sort((a, b) =>
      String(a?.item_name || "").localeCompare(String(b?.item_name || ""))
    )
  );
  return inserted;
}

  return (
    <div className="container-fluid py-3 town-route-page">
      {loading ? (
        <div className="town-route-page__loading">Loading town sheet…</div>
      ) : location ? (
        <TownSheet
          location={location}
          rosterChars={rosterChars}
          quests={quests}
          backHref={`/map?location=${location.id}`}
          isAdmin={isAdmin}
          storedLabels={storedLabels}
          onSaveMapData={handleSaveMapData}
          mapImageUrl={mapImageUrl}
          imageNaturalSize={imageNaturalSize}
          onSelectMapImage={handleSelectMapImage}
          onApplyMapImage={handleApplyMapImage}
          onClearPendingMap={handleClearPendingMap}
          onDeleteMapImage={handleDeleteMapImage}
          pendingMapFileName={pendingMapFile?.name || ""}
          mapApplyState={mapApplyState}
          labelSaveState={labelSaveState}
          mapFileInputKey={mapFileInputKey}
          marketData={marketData}
          playerInventory={playerInventory}
          onCraftWorkshop={handleCraftWorkshop}
        />
      ) : (
        <div className="town-route-page__loading">Town not found.</div>
      )}
    </div>
  );
}
