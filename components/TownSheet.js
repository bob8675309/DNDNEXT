import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { buildTownData } from "../utils/townData";
import styles from "./TownSheet.module.scss";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function toneKey(tone) {
  switch (tone) {
    case "amber":
      return styles.toneAmber;
    case "rose":
      return styles.toneRose;
    case "emerald":
      return styles.toneEmerald;
    case "violet":
      return styles.toneViolet;
    case "cyan":
      return styles.toneCyan;
    default:
      return styles.toneStone;
  }
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeOverlayItem(item, fallbackType = "location") {
  return {
    id: item?.id || uid(fallbackType),
    key: item?.key || item?.id || uid(fallbackType),
    name: item?.name || item?.label || "New label",
    x: Number(item?.x ?? 50),
    y: Number(item?.y ?? 50),
    tone: item?.tone || (fallbackType === "discovery" ? "amber" : "stone"),
    targetPanel: item?.targetPanel || item?.target_panel || null,
    category: item?.category || null,
    labelType: item?.labelType || item?.label_type || fallbackType,
    notes: item?.notes || null,
    isVisible: item?.isVisible !== false && item?.is_visible !== false,
  };
}

function inferCraftTypeFromText(text = "") {
  const s = String(text || "").toLowerCase();
  if (/(smith|forge|blade|armor|anvil|weapon)/.test(s)) return "blacksmith";
  if (/(alchem|potion|poison|brew|herb|tonic)/.test(s)) return "alchemist";
  if (/(enchant|arcane|runes|relic|spell|wizard)/.test(s)) return "enchanter";
  if (/(scribe|scroll|ink|book|library)/.test(s)) return "scribe";
  if (/(jewel|gem|gold|silversmith)/.test(s)) return "jeweler";
  return null;
}

function inferCrafterTypes(crafter) {
  const combined = [crafter?.name, crafter?.role, crafter?.affiliation, crafter?.storefront_title, crafter?.storefront_tagline]
    .filter(Boolean)
    .join(" ");
  const fromTags = Array.isArray(crafter?.tags) ? crafter.tags.map(inferCraftTypeFromText).filter(Boolean) : [];
  const base = inferCraftTypeFromText(combined);
  const types = new Set([base, ...fromTags].filter(Boolean));
  if (!types.size) types.add("artisan");
  return Array.from(types);
}

function humanizeCraftType(type) {
  switch (type) {
    case "blacksmith": return "Blacksmith";
    case "alchemist": return "Alchemist";
    case "enchanter": return "Enchanter";
    case "scribe": return "Scribe";
    case "jeweler": return "Jeweler";
    default: return "Artisan";
  }
}

function buildWorkshopServices(types = []) {
  const services = [];
  if (types.includes("blacksmith")) {
    services.push({
      id: "reforge",
      title: "Reforge & temper",
      subtitle: "Weapons and armor improvements",
      requiresSecondary: false,
      requiresTier: true,
      allowedTypes: ["weapon", "armor", "shield"],
      baseLabel: "Base weapon / armor",
      basePlaceholder: "Choose the mundane item to improve",
      tierLabel: "Enhancement tier",
      resultLabel: "Forged finish preview",
      description: "Temper a martial item into a stronger town-crafted variant.",
    });
  }
  if (types.includes("alchemist")) {
    services.push({
      id: "brew",
      title: "Alchemy blend",
      subtitle: "Potions, herbs, poisons, and essences",
      requiresSecondary: true,
      requiresTier: false,
      allowedTypes: ["potion", "poison", "consumable", "gear"],
      baseLabel: "Base reagent",
      basePlaceholder: "Choose the primary ingredient",
      secondaryLabel: "Secondary ingredient",
      secondaryPlaceholder: "Choose the supporting ingredient",
      resultLabel: "Experimental mixture preview",
      description: "Combine one base reagent with one supporting ingredient.",
    });
  }
  if (types.includes("enchanter")) {
    services.push({
      id: "imbue",
      title: "Arcane imbuement",
      subtitle: "Add a magical rider to an item",
      requiresSecondary: false,
      requiresTier: true,
      allowedTypes: ["weapon", "armor", "wondrous item", "gear"],
      baseLabel: "Base item to imbue",
      basePlaceholder: "Choose the item to enchant",
      tierLabel: "Enchant tier",
      resultLabel: "Runed enhancement preview",
      description: "Etch arcane power into a suitable base item.",
    });
  }
  if (types.includes("scribe")) {
    services.push({
      id: "inscribe",
      title: "Inscribe & copy",
      subtitle: "Scrolls, manuals, and coded notes",
      requiresSecondary: false,
      requiresTier: false,
      allowedTypes: ["scroll", "book", "tool", "gear"],
      baseLabel: "Base text / tool",
      basePlaceholder: "Choose the item to inscribe",
      resultLabel: "Inscribed utility preview",
      description: "Prepare a written or encoded upgrade concept.",
    });
  }
  if (types.includes("jeweler")) {
    services.push({
      id: "socket",
      title: "Gem setting",
      subtitle: "Socket, polish, and finish",
      requiresSecondary: true,
      requiresTier: false,
      allowedTypes: ["wondrous item", "gear", "armor", "weapon"],
      baseLabel: "Base item to socket",
      basePlaceholder: "Choose the item receiving the setting",
      secondaryLabel: "Socket component",
      secondaryPlaceholder: "Choose the gem, shard, or fitting",
      resultLabel: "Gem-set refinement preview",
      description: "Set a gem or ceremonial component into a suitable item.",
    });
  }
  if (!services.length) {
    services.push({
      id: "artisan",
      title: "General artisan work",
      subtitle: "Repair, combine, and customize",
      requiresSecondary: false,
      requiresTier: false,
      allowedTypes: ["gear", "tool", "weapon", "armor", "wondrous item", "potion"],
      baseLabel: "Base item",
      basePlaceholder: "Choose the main item",
      resultLabel: "Custom artisan preview",
      description: "A general-purpose crafting flow for town artisans.",
    });
  }
  return services;
}

function looksLikeMaterialItem(item) {
  const blob = [
    item?.item_name,
    item?.item_type,
    item?.card_payload?.item_type,
    item?.card_payload?.type,
    item?.card_payload?.uiType,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .join(" | ");
  return /(adamant|mithral|silver|silvered|ruidium|ore|ingot|dust|hide|scale|core|essence|obsidian|cold iron)/.test(blob);
}

function looksLikeCatalystItem(item) {
  const blob = [
    item?.item_name,
    item?.item_type,
    item?.card_payload?.item_type,
    item?.card_payload?.type,
    item?.card_payload?.uiType,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .join(" | ");
  return /(fang|eye|claw|hide|horn|rune|sigil|essence|dust|shard|gem|scale|heart|core|ichor|venom|gland|ink|oil|resin)/.test(blob);
}

function normalizeItemType(item) {
  const fields = [
    item?.item_type,
    item?.item_name,
    item?.card_payload?.item_type,
    item?.card_payload?.type,
    item?.card_payload?.uiType,
    item?.card_payload?.rawType,
    item?.card_payload?.name,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  const blob = fields.join(" | ");

  if (/(^|\b)(shield|sh)(\b|$)/.test(blob)) return "shield";
  if (/(^|\b)(la|ma|ha|armor|armour|breastplate|chain|plate|mail|hide armor|leather armor)(\b|$)/.test(blob)) return "armor";
  if (/(^|\b)(m|r|weapon|sword|bow|axe|mace|staff|hammer|spear|halberd|crossbow|dagger|club|flail|javelin|rapier|scimitar|trident|whip)(\b|$)/.test(blob)) return "weapon";
  if (/(potion|poison|elixir|brew|philter|consumable)/.test(blob)) return "potion";
  if (/(scroll)/.test(blob)) return "scroll";
  if (/(tool|kit)/.test(blob)) return "tool";
  if (/(book|manual|tome)/.test(blob)) return "book";
  if (/(wondrous|ring|amulet|rod|wand)/.test(blob)) return "wondrous item";
  return "gear";
}


function buildPreviewText({ service, primaryItem, secondaryItem, materialItem, catalystA, catalystB, catalystC, bonus = 0, crafter, variantA, variantB, variantC }) {
  if (!service || !primaryItem) return "Choose a service and a base item to preview the workshop result.";
  const crafterName = crafter?.name || "this crafter";
  const main = primaryItem?.item_name || "the selected item";
  const pieces = [];
  if (materialItem?.item_name) pieces.push(`material: ${materialItem.item_name}`);
  if (secondaryItem?.item_name) pieces.push(`secondary: ${secondaryItem.item_name}`);
  if (catalystA?.item_name) pieces.push(`A catalyst: ${catalystA.item_name}`);
  if (catalystB?.item_name) pieces.push(`B catalyst: ${catalystB.item_name}`);
  if (catalystC?.item_name) pieces.push(`C catalyst: ${catalystC.item_name}`);
  const enchants = [variantA?.label, variantB?.label, variantC?.label].filter(Boolean);
  if (enchants.length) pieces.push(`enchants: ${enchants.join(" • ")}`);
  const extras = pieces.length ? ` using ${pieces.join(" • ")}` : "";
  switch (service.id) {
    case "reforge":
      return `${crafterName} can reforge ${main}${bonus > 0 ? ` to +${bonus}` : ""}${extras}, hardening its finish into a stronger forged variant.`;
    case "brew":
      return `${crafterName} can blend ${main}${extras} into an unstable alchemical mixture with a stronger consumable effect.`;
    case "imbue":
      return `${crafterName} can etch arcane runes into ${main}${bonus > 0 ? ` at tier ${bonus}` : ""}${extras}, previewing a magical rider or infused trait.`;
    case "inscribe":
      return `${crafterName} can inscribe ${main}${extras}, preparing a written utility effect, encoded script, or copied ritual form.`;
    case "socket":
      return `${crafterName} can set and polish ${main}${extras}, previewing a gemmed refinement or ceremonial enhancement.`;
    default:
      return `${crafterName} can rework ${main}${extras} into a custom artisan result suited to the town.`;
  }
}









function collectWorkshopVariants(node) {
  const out = [];
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const item of node) out.push(...collectWorkshopVariants(item));
    return out;
  }
  if (typeof node === "object") {
    const looksVariant = node.name || node.effects || node.delta || node.mod || node.entries || node.item_description || node.bonusWeapon || node.bonusAc || node.bonusShield;
    if (looksVariant) {
      out.push(node);
    } else if (Array.isArray(node.items)) {
      out.push(...collectWorkshopVariants(node.items));
    } else {
      for (const [k, v] of Object.entries(node)) {
        const kids = collectWorkshopVariants(v);
        for (const child of kids) {
          if (!child.name && typeof k === "string") child.name = k;
          out.push(child);
        }
      }
    }
  }
  return out;
}

function normalizeWorkshopVariant(raw) {
  const name = String(raw?.name || "").trim();
  if (!name) return null;
  const key = String(raw?.key || name).toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const appliesTo = Array.isArray(raw?.appliesTo) && raw.appliesTo.length ? raw.appliesTo : ["weapon", "armor", "shield", "ammunition"];
  return {
    key,
    name,
    appliesTo,
    rarity: raw?.rarity || "",
    rarityByValue: raw?.rarityByValue || null,
    textByKind: raw?.textByKind || {},
    entries: raw?.entries || null,
    options: Array.isArray(raw?.options) ? raw.options : null,
    attunement: !!raw?.attunement,
    cursed: !!raw?.cursed,
  };
}

function useWorkshopVariants(enabled) {
  const [variants, setVariants] = useState([]);
  useEffect(() => {
    let dead = false;
    if (!enabled) return;
    (async () => {
      try {
        const files = ["/items/magicvariants.json", "/items/magicvariants.hb-armor-shield.json"];
        const payloads = await Promise.all(files.map(async (url) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return null;
            return await res.json();
          } catch {
            return null;
          }
        }));
        const seen = new Set();
        const merged = [];
        for (const payload of payloads) {
          for (const raw of collectWorkshopVariants(payload)) {
            const v = normalizeWorkshopVariant(raw);
            if (!v) continue;
            const id = `${v.key}::${v.appliesTo.slice().sort().join(",")}`;
            if (seen.has(id)) continue;
            seen.add(id);
            merged.push(v);
          }
        }
        if (!dead) setVariants(merged.sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        if (!dead) setVariants([]);
      }
    })();
    return () => {
      dead = true;
    };
  }, [enabled]);
  return variants;
}

function variantAppliesToItem(variant, itemType) {
  if (!variant) return false;
  const kind = itemType === "shield" ? "shield" : itemType === "armor" ? "armor" : itemType === "weapon" ? "weapon" : itemType === "wondrous item" ? "weapon" : itemType;
  return Array.isArray(variant.appliesTo) ? variant.appliesTo.includes(kind) || (kind === "shield" && variant.appliesTo.includes("armor")) : false;
}

function variantAllowedForService(variant, serviceId) {
  const name = String(variant?.name || "").toLowerCase();
  if (serviceId === "brew" || serviceId === "inscribe") return false;
  if (serviceId === "socket") return /(gem|jewel|warning|slaying|resistance|ward|protection|focus|guardian)/.test(name) || !!variant?.options;
  if (serviceId === "reforge") return !variant?.cursed;
  if (serviceId === "imbue") return true;
  return true;
}

function variantLabel(variant, option) {
  if (!variant) return "";
  if (option) return `${variant.name} (${String(option).replace(/[_-]+/g, " ")})`;
  return variant.name;
}

function BannerStat({ label, value, tone = "stone" }) {
  return (
    <div className={cls(styles.bannerStat, toneKey(tone))}>
      <div className={styles.eyebrow}>{label}</div>
      <div className={styles.bannerValue}>{value}</div>
    </div>
  );
}

function CompactTeaser({ kicker, title, subtitle, featured, tone, active, onOpen }) {
  return (
    <button
      type="button"
      className={cls(styles.teaserCard, toneKey(tone), active && styles.teaserCardActive)}
      onClick={onOpen}
    >
      <div className={styles.teaserHead}>
        <div>
          <div className={styles.eyebrow}>{kicker}</div>
          <div className={styles.teaserTitle}>{title}</div>
          <div className={styles.muted}>{subtitle}</div>
        </div>
        <div className={styles.teaserMeta}>{active ? "open" : "view"}</div>
      </div>
      {featured ? (
        <div className={cls(styles.teaserFeatured, toneKey(tone))}>
          <div className={styles.drawerItemTitle}>{featured.title}</div>
          <div className={styles.drawerItemText}>{featured.text}</div>
        </div>
      ) : null}
    </button>
  );
}

function DrawerTabs({ openPanel, setOpenPanel }) {
  const tabs = [
    ["stories", "City stories"],
    ["people", "Featured people"],
    ["jobs", "Jobs & quest leads"],
    ["rumors", "Tavern rumors"],
    ["market", "Bazaar / market"],
    ["crafters", "Crafters' quarter"],
  ];

  return (
    <div className={styles.drawerTabs}>
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={cls(styles.drawerTab, openPanel === id && styles.drawerTabActive)}
          onClick={() => setOpenPanel(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SharedDrawerContent({ panel }) {
  return (
    <div className={styles.drawerItems}>
      {(panel.items || []).map((item, idx) => (
        <div key={`${item.title}-${idx}`} className={cls(styles.drawerItem, toneKey(panel.tone))}>
          <div className={styles.drawerItemTitle}>{item.title}</div>
          <div className={styles.drawerItemText}>{item.text}</div>
        </div>
      ))}
    </div>
  );
}

function merchantSubtitle(merchant) {
  return merchant?.storefront_tagline || merchant?.storefront_title || merchant?.role || merchant?.affiliation || "Merchant";
}

function MerchantLinkRow({ merchant }) {
  const profileHref = merchant?.id ? `/npcs#${merchant.id}` : null;
  const shopHref = merchant?.storefront_enabled && merchant?.id ? `/map?merchant=${merchant.id}` : null;
  const badges = [];
  if (merchant?.isPresent) badges.push({ label: "In town", kind: "present" });
  if (merchant?.isResident) badges.push({ label: "Resident", kind: "resident" });
  if (!merchant?.isResident) badges.push({ label: "Traveler", kind: "traveler" });

  return (
    <div className={cls(styles.drawerItem, styles.marketCard, toneKey("amber"))}>
      <div className={styles.marketCardHead}>
        <div>
          <div className={styles.drawerItemTitle}>{merchant?.name || "Unknown Merchant"}</div>
          <div className={styles.drawerItemText}>{merchantSubtitle(merchant)}</div>
        </div>
        <div className={styles.marketBadgeRow}>
          {badges.map((badge) => (
            <span key={badge.label} className={cls(styles.marketBadge, badge.kind === "present" && styles.marketBadgePresent, badge.kind === "resident" && styles.marketBadgeResident)}>{badge.label}</span>
          ))}
        </div>
      </div>
      <div className={styles.marketActionRow}>
        {profileHref ? <a className="btn btn-sm btn-outline-light" href={profileHref}>Open Profile</a> : null}
        {shopHref ? <a className="btn btn-sm btn-warning" href={shopHref}>Browse Wares</a> : <span className={styles.marketMuted}>No storefront enabled</span>}
      </div>
    </div>
  );
}

function MarketDrawer({ marketData, townName }) {
  const present = Array.isArray(marketData?.presentMerchants) ? marketData.presentMerchants : [];
  const resident = Array.isArray(marketData?.residentMerchants) ? marketData.residentMerchants : [];
  const presentIds = new Set(present.map((m) => m.id));
  const enrichedPresent = present.map((m) => ({ ...m, isPresent: true, isResident: resident.some((r) => r.id === m.id) }));
  const enrichedResident = resident.map((m) => ({ ...m, isResident: true, isPresent: presentIds.has(m.id) }));

  return (
    <div className={styles.drawerItems}>
      <div className={cls(styles.drawerItem, styles.marketIntro, toneKey("amber"))}>
        <div className={styles.drawerItemTitle}>Bazaar of {townName || "Town"}</div>
        <div className={styles.drawerItemText}>Browse merchants currently in town and those who call this place home.</div>
      </div>

      <div className={styles.marketSection}>
        <div className={styles.marketSectionTitle}>Merchants in town now</div>
        {enrichedPresent.length ? enrichedPresent.map((merchant) => <MerchantLinkRow key={`present-${merchant.id}`} merchant={merchant} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No merchants are currently set to this town.</div></div>}
      </div>

      <div className={styles.marketSection}>
        <div className={styles.marketSectionTitle}>Resident merchants</div>
        {enrichedResident.length ? enrichedResident.map((merchant) => <MerchantLinkRow key={`resident-${merchant.id}`} merchant={merchant} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No resident merchants are assigned to this town yet.</div></div>}
      </div>
    </div>
  );
}




function CrafterWorkshopModal({ crafter, inventoryItems, onClose, onCraftWorkshop }) {
  const crafterTypes = useMemo(() => inferCrafterTypes(crafter), [crafter]);
  const services = useMemo(() => buildWorkshopServices(crafterTypes), [crafterTypes]);
  const workshopVariants = useWorkshopVariants(true);
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [primaryId, setPrimaryId] = useState("");
  const [secondaryId, setSecondaryId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [catalystAId, setCatalystAId] = useState("");
  const [catalystBId, setCatalystBId] = useState("");
  const [catalystCId, setCatalystCId] = useState("");
  const [variantAKey, setVariantAKey] = useState("");
  const [variantBKey, setVariantBKey] = useState("");
  const [variantCKey, setVariantCKey] = useState("");
  const [variantAOpt, setVariantAOpt] = useState("");
  const [variantBOpt, setVariantBOpt] = useState("");
  const [variantCOpt, setVariantCOpt] = useState("");
  const [bonus, setBonus] = useState("");
  const [craftState, setCraftState] = useState({ status: "idle", message: "" });

  useEffect(() => {
    const first = services[0] || null;
    setServiceId(first?.id || "");
    setPrimaryId("");
    setSecondaryId("");
    setMaterialId("");
    setCatalystAId("");
    setCatalystBId("");
    setCatalystCId("");
    setVariantAKey("");
    setVariantBKey("");
    setVariantCKey("");
    setVariantAOpt("");
    setVariantBOpt("");
    setVariantCOpt("");
    setBonus(first?.requiresTier ? "" : "0");
    setCraftState({ status: "idle", message: "" });
  }, [crafter?.id, services]);

  const selectedService = services.find((service) => service.id === serviceId) || services[0] || null;
  const filteredPrimary = (inventoryItems || []).filter((item) => !selectedService?.allowedTypes?.length || selectedService.allowedTypes.includes(normalizeItemType(item)));
  const primaryItem = (inventoryItems || []).find((item) => item.id === primaryId) || null;
  const primaryType = normalizeItemType(primaryItem);
  const enchantChoices = useMemo(() => {
    if (!selectedService || !primaryItem) return [];
    return (workshopVariants || []).filter((variant) => variantAllowedForService(variant, selectedService.id) && variantAppliesToItem(variant, primaryType));
  }, [workshopVariants, selectedService?.id, primaryType, primaryId]);

  const secondaryOptions = (inventoryItems || []).filter((item) => {
    if ([primaryId, materialId, catalystAId, catalystBId, catalystCId].includes(item.id)) return false;
    const kind = normalizeItemType(item);
    if (selectedService?.id === "brew") return !["weapon", "armor", "shield"].includes(kind);
    if (selectedService?.id === "socket") return !["weapon", "armor", "shield"].includes(kind);
    return true;
  });
  const materialOptions = (inventoryItems || []).filter((item) => ![primaryId, secondaryId, catalystAId, catalystBId, catalystCId].includes(item.id) && looksLikeMaterialItem(item));
  const catalystOptions = (inventoryItems || []).filter((item) => ![primaryId, secondaryId, materialId].includes(item.id) && looksLikeCatalystItem(item));

  const secondaryItem = (inventoryItems || []).find((item) => item.id === secondaryId) || null;
  const materialItem = (inventoryItems || []).find((item) => item.id === materialId) || null;
  const catalystA = (inventoryItems || []).find((item) => item.id === catalystAId) || null;
  const catalystB = (inventoryItems || []).find((item) => item.id === catalystBId) || null;
  const catalystC = (inventoryItems || []).find((item) => item.id === catalystCId) || null;
  const variantA = enchantChoices.find((variant) => variant.key === variantAKey) || null;
  const variantB = enchantChoices.find((variant) => variant.key === variantBKey) || null;
  const variantC = enchantChoices.find((variant) => variant.key === variantCKey) || null;

  useEffect(() => {
    setSecondaryId("");
    setMaterialId("");
    setCatalystAId("");
    setCatalystBId("");
    setCatalystCId("");
    setVariantAKey("");
    setVariantBKey("");
    setVariantCKey("");
    setVariantAOpt("");
    setVariantBOpt("");
    setVariantCOpt("");
    setBonus(selectedService?.requiresTier ? "" : "0");
    setCraftState({ status: "idle", message: "" });
  }, [selectedService?.id, primaryId]);

  const previewText = buildPreviewText({ service: selectedService, primaryItem, secondaryItem, materialItem, catalystA, catalystB, catalystC, bonus: Number(bonus) || 0, crafter, variantA: variantA ? { label: variantLabel(variantA, variantAOpt) } : null, variantB: variantB ? { label: variantLabel(variantB, variantBOpt) } : null, variantC: variantC ? { label: variantLabel(variantC, variantCOpt) } : null });

  async function handleCraft() {
    if (!primaryId) return setCraftState({ status: "error", message: "Choose a base item first." });
    if (selectedService?.requiresSecondary && !secondaryId) return setCraftState({ status: "error", message: "Choose the required secondary ingredient." });
    if (selectedService?.requiresTier && !bonus) return setCraftState({ status: "error", message: "Choose a tier before crafting." });
    if ((variantA && !catalystAId) || (variantB && !catalystBId) || (variantC && !catalystCId)) return setCraftState({ status: "error", message: "Each selected enchant needs a catalyst item." });
    if (variantA?.options?.length && !variantAOpt) return setCraftState({ status: "error", message: "Choose an option for Other A." });
    if (variantB?.options?.length && !variantBOpt) return setCraftState({ status: "error", message: "Choose an option for Other B." });
    if (variantC?.options?.length && !variantCOpt) return setCraftState({ status: "error", message: "Choose an option for Other C." });
    if (typeof onCraftWorkshop !== "function") return setCraftState({ status: "error", message: "Crafting is not available on this page yet." });
    setCraftState({ status: "saving", message: "Crafting item..." });
    try {
      await onCraftWorkshop({ crafter, serviceId: selectedService?.id, primaryItemId: primaryId, secondaryItemId: selectedService?.requiresSecondary ? secondaryId || null : null, materialItemId: materialId || null, catalystAId: catalystAId || null, catalystBId: catalystBId || null, catalystCId: catalystCId || null, bonus: Number(bonus) || 0, variantAKey: variantA?.key || null, variantAName: variantA?.name || null, variantAOption: variantAOpt || null, variantBKey: variantB?.key || null, variantBName: variantB?.name || null, variantBOption: variantBOpt || null, variantCKey: variantC?.key || null, variantCName: variantC?.name || null, variantCOption: variantCOpt || null });
      setCraftState({ status: "success", message: "Craft completed and added to your inventory." });
    } catch (err) {
      setCraftState({ status: "error", message: err?.message || "Crafting failed." });
    }
  }

  function renderEnchantSlot(label, valueKey, setValueKey, variant, optionValue, setOptionValue, catalystId, setCatalystId, excludedIds) {
    return (<>
      <label className={styles.formField}>
        <span>{label} enchant</span>
        <select className="form-select form-select-sm" value={valueKey} onChange={(e) => setValueKey(e.target.value)}>
          <option value="">Optional / none</option>
          {enchantChoices.filter((choice) => ![variantAKey, variantBKey, variantCKey].includes(choice.key) || choice.key === valueKey).map((choice) => <option key={choice.key} value={choice.key}>{choice.name}</option>)}
        </select>
      </label>
      {variant?.options?.length ? <label className={styles.formField}><span>{label} option</span><select className="form-select form-select-sm" value={optionValue} onChange={(e) => setOptionValue(e.target.value)}><option value="">Choose option</option>{variant.options.map((opt) => <option key={String(opt)} value={String(opt)}>{String(opt).replace(/[_-]+/g, " ")}</option>)}</select></label> : null}
      {valueKey ? <label className={styles.formField}><span>{label} catalyst</span><select className="form-select form-select-sm" value={catalystId} onChange={(e) => setCatalystId(e.target.value)}><option value="">Choose catalyst item</option>{catalystOptions.filter((item) => !excludedIds.includes(item.id) || item.id === catalystId).map((item) => <option key={item.id} value={item.id}>{item.item_name}</option>)}</select></label> : null}
    </>);
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.crafterModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.crafterModalHead}><div><div className={styles.eyebrow}>Workshop</div><div className={styles.crafterModalTitle}>{crafter?.name || "Crafter"}</div><div className={styles.muted}>{(crafterTypes || []).map(humanizeCraftType).join(" • ")}</div></div><button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button></div>
        <div className={styles.crafterModalGrid}>
          <section className={cls(styles.drawerItem, toneKey("emerald"))}><div className={styles.drawerItemTitle}>Available services</div><div className={styles.serviceGrid}>{services.map((service) => <button key={service.id} type="button" className={cls(styles.serviceCard, service.id === selectedService?.id && styles.serviceCardActive)} onClick={() => setServiceId(service.id)}><div className={styles.drawerItemTitle}>{service.title}</div><div className={styles.muted}>{service.subtitle}</div><div className={styles.drawerItemText}>{service.description}</div></button>)}</div></section>
          <section className={cls(styles.drawerItem, toneKey("cyan"))}><div className={styles.drawerItemTitle}>Workshop inputs</div><div className={styles.formGrid}>
            <label className={styles.formField}><span>{selectedService?.baseLabel || "Base item"}</span><select className="form-select form-select-sm" value={primaryId} onChange={(e) => setPrimaryId(e.target.value)}><option value="">{selectedService?.basePlaceholder || "Choose the main item"}</option>{filteredPrimary.map((item) => <option key={item.id} value={item.id}>{item.item_name} {item.item_rarity ? `(${item.item_rarity})` : ""}</option>)}</select></label>
            <label className={styles.formField}><span>Material item</span><select className="form-select form-select-sm" value={materialId} onChange={(e) => setMaterialId(e.target.value)}><option value="">Optional / none</option>{materialOptions.map((item) => <option key={item.id} value={item.id}>{item.item_name}</option>)}</select></label>
            {selectedService?.requiresSecondary ? <label className={styles.formField}><span>{selectedService?.secondaryLabel || "Secondary ingredient"}</span><select className="form-select form-select-sm" value={secondaryId} onChange={(e) => setSecondaryId(e.target.value)}><option value="">{selectedService?.secondaryPlaceholder || "Choose the supporting ingredient"}</option>{secondaryOptions.map((item) => <option key={item.id} value={item.id}>{item.item_name} {item.item_rarity ? `(${item.item_rarity})` : ""}</option>)}</select></label> : null}
            {selectedService?.requiresTier ? <label className={styles.formField}><span>{selectedService?.tierLabel || "Tier"}</span><select className="form-select form-select-sm" value={bonus} onChange={(e) => setBonus(e.target.value)}><option value="">Choose a tier</option><option value="1">Tier I / +1</option><option value="2">Tier II / +2</option><option value="3">Tier III / +3</option></select></label> : null}
            {primaryItem ? renderEnchantSlot("Other A", variantAKey, setVariantAKey, variantA, variantAOpt, setVariantAOpt, catalystAId, setCatalystAId, [catalystBId, catalystCId]) : null}
            {primaryItem ? renderEnchantSlot("Other B", variantBKey, setVariantBKey, variantB, variantBOpt, setVariantBOpt, catalystBId, setCatalystBId, [catalystAId, catalystCId]) : null}
            {primaryItem ? renderEnchantSlot("Other C", variantCKey, setVariantCKey, variantC, variantCOpt, setVariantCOpt, catalystCId, setCatalystCId, [catalystAId, catalystBId]) : null}
          </div><div className={styles.drawerItemText}>Different crafter archetypes expose different service flows. Enchant slots now come from the shared variant catalog, while catalyst items are still consumed from normal inventory.</div>{craftState?.message ? <div className={cls(styles.statusBanner, craftState?.status === "error" && styles.statusError, craftState?.status === "success" && styles.statusSuccess, craftState?.status === "saving" && styles.statusInfo)}>{craftState.message}</div> : null}</section>
        </div>
        <section className={cls(styles.drawerItem, styles.previewCard, toneKey("violet"))}><div className={styles.drawerItemTitle}>{selectedService?.resultLabel || "Workshop preview"}</div><div className={styles.drawerItemText}>{previewText}</div><div className={styles.previewMetaRow}><span className={styles.marketBadge}>Enchant wiring</span>{primaryItem ? <span className={styles.marketBadge}>{normalizeItemType(primaryItem)}</span> : null}{variantA ? <span className={styles.marketBadge}>{variantLabel(variantA, variantAOpt)}</span> : null}{variantB ? <span className={styles.marketBadge}>{variantLabel(variantB, variantBOpt)}</span> : null}{variantC ? <span className={styles.marketBadge}>{variantLabel(variantC, variantCOpt)}</span> : null}</div><div className={styles.workshopActionRow}><button type="button" className="btn btn-sm btn-success" disabled={!primaryId || craftState?.status === "saving" || (selectedService?.requiresSecondary && !secondaryId) || (selectedService?.requiresTier && !bonus)} onClick={handleCraft}>{craftState?.status === "saving" ? "Crafting..." : "Craft Item"}</button></div></section>
      </div>
    </div>
  );
}

function CrafterRow({ crafter, onOpenWorkshop }) {
  const types = inferCrafterTypes(crafter);
  const profileHref = crafter?.id ? `/npcs#${crafter.id}` : null;
  return (
    <div className={cls(styles.drawerItem, styles.marketCard, toneKey("emerald"))}>
      <div className={styles.marketCardHead}>
        <div>
          <div className={styles.drawerItemTitle}>{crafter?.name || "Unknown Crafter"}</div>
          <div className={styles.drawerItemText}>{crafter?.role || crafter?.affiliation || crafter?.storefront_title || "Town crafter"}</div>
        </div>
        <div className={styles.marketBadgeRow}>
          {types.map((type) => <span key={type} className={styles.marketBadge}>{humanizeCraftType(type)}</span>)}
        </div>
      </div>
      <div className={styles.marketActionRow}>
        {profileHref ? <a className="btn btn-sm btn-outline-light" href={profileHref}>Open Profile</a> : null}
        <button type="button" className="btn btn-sm btn-success" onClick={() => onOpenWorkshop(crafter)}>Open Workshop</button>
      </div>
    </div>
  );
}

function CrafterDrawer({ crafters, townName, inventoryItems, onOpenWorkshop }) {
  const rows = Array.isArray(crafters) ? crafters : [];
  return (
    <div className={styles.drawerItems}>
      <div className={cls(styles.drawerItem, toneKey("emerald"))}>
        <div className={styles.drawerItemTitle}>Crafters' Quarter of {townName || "Town"}</div>
        <div className={styles.drawerItemText}>Blacksmiths, alchemists, enchanters, and scribes can now open a workshop modal. This is the next roadmap step after the Bazaar drawer and sets up the future item-combination flow.</div>
      </div>
      <div className={styles.marketSection}>
        <div className={styles.marketSectionTitle}>Available crafters</div>
        {rows.length ? rows.map((crafter) => <CrafterRow key={crafter.id} crafter={crafter} onOpenWorkshop={onOpenWorkshop} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No obvious crafters are surfaced for this town yet.</div></div>}
      </div>
      <div className={cls(styles.drawerItem, toneKey("stone"))}>
        <div className={styles.drawerItemTitle}>Player inventory hook</div>
        <div className={styles.drawerItemText}>{inventoryItems?.length ? `Loaded ${inventoryItems.length} inventory item${inventoryItems.length === 1 ? "" : "s"} for workshop previews.` : "No player inventory items are currently available for workshop previews."}</div>
      </div>
    </div>
  );
}

function AdminDrawer({ dirty, editMode, setEditMode, labels, selectedItem, onSelect, onChangeSelected, onDeleteSelected, onBeginDiscoveryPlacement, onSave, mapToolsOpen, setMapToolsOpen, storedMapImage, fallbackMapImage, onSelectMap, onApplyMap, onClearPendingMap, onDeleteMap, imageMeta, pendingMapFileName, mapApplyState, mapFileInputKey, labelSaveState }) {
  return (
    <div className={styles.adminStack}>
      <section className={styles.adminCard}>
        <div className={styles.adminCardHead}>
          <div>
            <div className={styles.adminCardTitle}>City layout map editor</div>
            <div className={styles.muted}>Map labels and discoveries live in the shared drawer when admin tools are on.</div>
          </div>
          <button type="button" className={cls(styles.toggle, editMode && styles.toggleOn)} onClick={() => setEditMode((v) => !v)} aria-pressed={editMode} title="Toggle edit mode"><span className={styles.toggleKnob} /></button>
        </div>

        <div className={styles.adminActions}>
          <button type="button" className="btn btn-sm btn-outline-warning" onClick={onBeginDiscoveryPlacement}>Add Discovery</button>
          <button type="button" className="btn btn-sm btn-warning" onClick={onSave} disabled={!dirty || labelSaveState?.status === "saving"}>{labelSaveState?.status === "saving" ? "Saving..." : "Save Changes"}</button>
        </div>

        {labelSaveState?.message ? (
          <div className={cls(styles.statusBanner, labelSaveState?.status === "error" && styles.statusError, labelSaveState?.status === "success" && styles.statusSuccess, labelSaveState?.status === "saving" && styles.statusInfo)}>{labelSaveState.message}</div>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Name</th><th>X</th><th>Y</th><th>Tone</th><th>Type</th></tr></thead>
            <tbody>
              {labels.map((item) => (
                <tr key={item.id} className={selectedItem?.id === item.id ? styles.selectedRow : ""} onClick={() => onSelect(item.id)}>
                  <td>{item.name}</td><td>{Math.round(item.x)}</td><td>{Math.round(item.y)}</td><td>{item.tone}</td><td>{item.labelType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedItem ? (
          <div className={styles.formGrid}>
            <label className={styles.formField}><span>Name</span><input className="form-control form-control-sm" value={selectedItem.name || ""} onChange={(e) => onChangeSelected({ name: e.target.value })} /></label>
            <label className={styles.formField}><span>Tone</span><select className="form-select form-select-sm" value={selectedItem.tone || "stone"} onChange={(e) => onChangeSelected({ tone: e.target.value })}><option value="stone">Stone</option><option value="amber">Amber</option><option value="rose">Rose</option><option value="emerald">Emerald</option><option value="violet">Violet</option><option value="cyan">Cyan</option></select></label>
            <label className={styles.formField}><span>Type</span><select className="form-select form-select-sm" value={selectedItem.labelType || "location"} onChange={(e) => onChangeSelected({ labelType: e.target.value })}><option value="location">Location</option><option value="discovery">Discovery</option></select></label>
            <label className={styles.formField}><span>Drawer target</span><select className="form-select form-select-sm" value={selectedItem.targetPanel || ""} onChange={(e) => onChangeSelected({ targetPanel: e.target.value || null })}><option value="">None</option><option value="stories">City stories</option><option value="people">Featured people</option><option value="jobs">Jobs & quest leads</option><option value="rumors">Tavern rumors</option><option value="market">Bazaar / market</option><option value="crafters">Crafters' quarter</option></select></label>
            <label className={cls(styles.formField, styles.formFieldWide)}><span>Notes</span><input className="form-control form-control-sm" value={selectedItem.notes || ""} onChange={(e) => onChangeSelected({ notes: e.target.value })} /></label>
            <div className={cls(styles.coordText, styles.formFieldWide)}>X {selectedItem.x.toFixed(1)} • Y {selectedItem.y.toFixed(1)}</div>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDeleteSelected}>Delete Label</button>
          </div>
        ) : null}
      </section>

      <section className={styles.adminCard}>
        <div className={styles.adminCardHead}>
          <div><div className={styles.adminCardTitle}>Map tools</div><div className={styles.muted}>Replace or clear the town image without leaving the drawer.</div></div>
          <button type="button" className={cls(styles.toggle, mapToolsOpen && styles.toggleOn)} onClick={() => setMapToolsOpen((v) => !v)} aria-pressed={mapToolsOpen} title="Toggle map tools"><span className={styles.toggleKnob} /></button>
        </div>
        {mapToolsOpen ? (
          <div className={styles.mapTools}>
            <div className={styles.mapActionRow}><button type="button" className="btn btn-sm btn-outline-danger" onClick={onDeleteMap} disabled={mapApplyState?.status === "uploading" || mapApplyState?.status === "deleting"}>{mapApplyState?.status === "deleting" ? "Deleting..." : "Delete Map"}</button><button type="button" className="btn btn-sm btn-success" onClick={onApplyMap} disabled={!pendingMapFileName || mapApplyState?.status === "uploading" || mapApplyState?.status === "deleting"}>{mapApplyState?.status === "uploading" ? "Applying..." : "Apply Map"}</button></div>
            <label className={styles.uploadBox}><span>Choose a new map image, then click Apply Map.</span><input key={mapFileInputKey} type="file" accept="image/png,image/jpeg,image/webp" onChange={onSelectMap} /></label>
            {pendingMapFileName ? <div className={styles.pendingFileRow}><div className={styles.metaText}>Pending file: <strong>{pendingMapFileName}</strong></div><button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClearPendingMap} disabled={mapApplyState?.status === "uploading" || mapApplyState?.status === "deleting"}>Clear Selection</button></div> : null}
            {mapApplyState?.message ? <div className={cls(styles.statusBanner, mapApplyState?.status === "error" && styles.statusError, mapApplyState?.status === "success" && styles.statusSuccess, (mapApplyState?.status === "uploading" || mapApplyState?.status === "deleting" || mapApplyState?.status === "selected") && styles.statusInfo)}>{mapApplyState.message}</div> : null}
            <div className={styles.metaText}>{storedMapImage ? <><div><strong>Active source:</strong> uploaded town map stored in Supabase.</div><div>Natural size: {imageMeta?.width || "?"} × {imageMeta?.height || "?"}</div></> : fallbackMapImage ? <><div><strong>Active source:</strong> built-in fallback map from town data.</div><div>No uploaded map is stored for this town yet.</div></> : <div>No stored or fallback map is available for this town yet.</div>}</div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SharedDrawer({ panel, openPanel, setOpenPanel, adminToolsVisible, adminDrawerProps, marketData, townName, crafterData, playerInventory, onOpenWorkshop }) {
  const title = adminToolsVisible ? "City layout map editor" : panel.drawerTitle;
  const subtitle = adminToolsVisible ? "Editing controls live here so the map and drawer remain two clean equal-height panes." : panel.drawerSubtitle;
  return (
    <div className={cls(styles.drawerPane, adminToolsVisible && styles.drawerPaneAdmin)}>
      <div className={styles.drawerHead}>
        <div><div className={styles.eyebrow}>Shared drawer</div><div className={styles.drawerTitle}>{title}</div><div className={styles.muted}>{subtitle}</div></div>
        <div className={styles.drawerMeta}>{adminToolsVisible ? "admin tools" : "one open at a time"}</div>
      </div>
      {!adminToolsVisible ? <DrawerTabs openPanel={openPanel} setOpenPanel={setOpenPanel} /> : null}
      <div className={styles.drawerScroll}>
        {adminToolsVisible ? (
          <AdminDrawer {...adminDrawerProps} />
        ) : openPanel === "market" ? (
          <MarketDrawer marketData={marketData} townName={townName} />
        ) : openPanel === "crafters" ? (
          <CrafterDrawer crafters={crafterData} townName={townName} inventoryItems={playerInventory} onOpenWorkshop={onOpenWorkshop} />
        ) : (
          <SharedDrawerContent panel={panel} />
        )}
      </div>
    </div>
  );
}

function MapLabel({ item, selected, onPointerDown, onClick }) {
  return (
    <button type="button" className={cls(styles.mapLabel, toneKey(item.tone), selected && styles.mapLabelSelected)} style={{ left: `${item.x}%`, top: `${item.y}%` }} onPointerDown={onPointerDown} onClick={onClick} title={item.notes || item.name}>
      {item.labelType === "discovery" ? <span className={styles.mapLabelFlag}>⚑</span> : null}
      <span>{item.name}</span>
    </button>
  );
}

function TownMapPanel({ mapImage, imageNaturalSize, labels, isAdmin, editMode, placingDiscovery, selectedId, setSelectedId, onMoveItem, onAddDiscovery, onOpenPanel, adminToolsVisible, setAdminToolsVisible, mapSourceLabel }) {
  const surfaceRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    function handleMove(e) {
      if (!dragRef.current || !surfaceRef.current) return;
      const rect = surfaceRef.current.getBoundingClientRect();
      const clientX = e.touches?.[0]?.clientX ?? e.clientX;
      const clientY = e.touches?.[0]?.clientY ?? e.clientY;
      const x = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(2, Math.min(98, ((clientY - rect.top) / rect.height) * 100));
      onMoveItem(dragRef.current.id, { x, y });
    }
    function handleUp() { dragRef.current = null; }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [onMoveItem]);

  function beginDrag(item, e) {
    if (!(isAdmin && editMode)) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { id: item.id };
    setSelectedId(item.id);
  }

  function handleMapClick(e) {
    if (!(isAdmin && placingDiscovery) || !surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100));
    onAddDiscovery({ x, y });
  }

  const backgroundStyle = mapImage ? { backgroundImage: `linear-gradient(180deg, rgba(9,11,16,0.14), rgba(9,11,16,0.28)), url(${mapImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined;

  return (
    <div className={styles.mapPane}>
      <div className={styles.mapHead}>
        <div><div className={styles.eyebrow}>Interactive city layout</div><div className={styles.muted}>Map-first overview with clickable labels and discoveries.</div></div>
        {isAdmin ? <button type="button" className={cls(styles.adminToggle, adminToolsVisible && styles.adminToggleOn)} onClick={() => setAdminToolsVisible((v) => !v)} aria-pressed={adminToolsVisible}><span className={styles.adminToggleLabel}>Show Admin Tools</span><span className={cls(styles.toggle, adminToolsVisible && styles.toggleOn)}><span className={styles.toggleKnob} /></span></button> : null}
      </div>
      <div className={styles.mapBody}>
        <div key={mapImage || "no-town-map"} ref={surfaceRef} className={cls(styles.mapSurface, mapImage && styles.mapSurfaceHasImage, placingDiscovery && styles.mapSurfacePlacing)} style={backgroundStyle} onClick={handleMapClick}>
          {!mapImage ? <div className={styles.emptyText}>No stored town map yet. Upload one from map tools.</div> : null}
          {labels.filter((item) => item.isVisible !== false).map((item) => (
            <MapLabel
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onPointerDown={(e) => beginDrag(item, e)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedId(item.id);
                if (item.labelType === "location" && item.targetPanel) onOpenPanel(item.targetPanel);
              }}
            />
          ))}
        </div>
        <div className={styles.metaStack}>
          {(mapSourceLabel || (imageNaturalSize?.width && imageNaturalSize?.height)) ? <div className={styles.metaText}>{mapSourceLabel || ""}{mapSourceLabel && imageNaturalSize?.width && imageNaturalSize?.height ? " • " : ""}{imageNaturalSize?.width && imageNaturalSize?.height ? `Stored size: ${imageNaturalSize.width} × ${imageNaturalSize.height}` : ""}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function TownSheet({
  location,
  rosterChars,
  quests,
  backHref,
  isAdmin = false,
  storedLabels = [],
  onSaveMapData,
  mapImageUrl,
  imageNaturalSize,
  onSelectMapImage,
  onApplyMapImage,
  onClearPendingMap,
  onDeleteMapImage,
  pendingMapFileName = "",
  mapApplyState = { status: "idle", message: "" },
  labelSaveState = { status: "idle", message: "" },
  mapFileInputKey = 0,
  marketData = { presentMerchants: [], residentMerchants: [] },
  playerInventory = [],
  onCraftWorkshop,
}) {
  const townData = useMemo(() => buildTownData(location, rosterChars, quests), [location, rosterChars, quests]);
  const [openPanel, setOpenPanel] = useState("people");
  const [labels, setLabels] = useState(() => {
    const src = storedLabels?.length ? storedLabels : townData.mapLabels || [];
    return src.map((item) => normalizeOverlayItem(item, item?.labelType || item?.label_type || "location"));
  });
  const [selectedId, setSelectedId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [adminToolsVisible, setAdminToolsVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [placingDiscovery, setPlacingDiscovery] = useState(false);
  const [mapToolsOpen, setMapToolsOpen] = useState(true);
  const [activeWorkshopCrafter, setActiveWorkshopCrafter] = useState(null);
  const prevStoredKey = useMemo(() => JSON.stringify(storedLabels || []), [storedLabels]);

  useEffect(() => {
    const src = storedLabels?.length ? storedLabels : townData.mapLabels || [];
    setLabels(src.map((item) => normalizeOverlayItem(item, item?.labelType || item?.label_type || "location")));
    setDirty(false);
  }, [prevStoredKey, townData.mapLabels]);

  const stats = [
    ["Population", townData.stats.population, "amber"],
    ["Morale", townData.stats.morale, "rose"],
    ["Defenses", townData.stats.defenses, "emerald"],
    ["Mood", townData.stats.mood, "violet"],
    ["Ruler", townData.stats.ruler, "cyan"],
    ["Known for", townData.stats.knownFor, "stone"],
  ];

  const crafterData = useMemo(() => {
    const byId = new Map();
    const seed = [];
    if (Array.isArray(rosterChars)) seed.push(...rosterChars.filter((row) => row?.kind === "npc" || row?.kind === "merchant"));
    if (Array.isArray(marketData?.presentMerchants)) seed.push(...marketData.presentMerchants);
    if (Array.isArray(marketData?.residentMerchants)) seed.push(...marketData.residentMerchants);
    for (const row of seed) {
      if (!row?.id) continue;
      const types = inferCrafterTypes(row);
      if (!types.length) continue;
      if (!["blacksmith", "alchemist", "enchanter", "scribe", "jeweler", "artisan"].some((type) => types.includes(type))) continue;
      byId.set(row.id, { ...row, crafterTypes: types });
    }
    return Array.from(byId.values()).sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
  }, [rosterChars, marketData]);

  const panels = {
    stories: { tone: "amber", drawerTitle: "City stories", drawerSubtitle: "Rotating city stories that shift every in-game 24 hours.", teaserTitle: "City stories", teaserSubtitle: "Rotating top city story; opens into the broader story feed", items: townData.cityStories },
    people: { tone: "cyan", drawerTitle: "Featured people", drawerSubtitle: "Surfaced NPCs and notable figures players should recognize.", teaserTitle: "Featured people", teaserSubtitle: "Rotating spotlight NPC; opens into the surfaced list", items: townData.people },
    jobs: { tone: "emerald", drawerTitle: "Jobs & quest leads", drawerSubtitle: "Rotating job board with expandable quest hooks.", teaserTitle: "Jobs & quest leads", teaserSubtitle: "Rotating top job; opens into the quest board", items: townData.jobLeads },
    rumors: { tone: "rose", drawerTitle: "Tavern rumors", drawerSubtitle: "Rotating top rumor; opens into the tavern feed.", teaserTitle: "Tavern rumors", teaserSubtitle: "Rotating top rumor; opens into the tavern feed", items: townData.rumors },
    market: { tone: "amber", drawerTitle: "Bazaar / market", drawerSubtitle: "Merchants currently in town and those who live here.", teaserTitle: "Bazaar / market", teaserSubtitle: "Resident and visiting merchants surfaced from town data", items: [] },
    crafters: { tone: "emerald", drawerTitle: "Crafters' quarter", drawerSubtitle: "Town artisans, alchemists, smiths, and enchanters.", teaserTitle: "Crafters' quarter", teaserSubtitle: "Open a workshop modal and preview crafted results", items: [] },
  };

  const activePanel = panels[openPanel] || panels.people;
  const effectiveMapImage = mapImageUrl || townData.mapImage || null;
  const mapSourceLabel = mapImageUrl ? "Showing uploaded town map from storage." : townData.mapImage ? "Showing built-in fallback map for this town." : "No town map is currently available.";
  const featured = { stories: townData.cityStories?.[0], people: townData.people?.[0], jobs: townData.jobLeads?.[0], rumors: townData.rumors?.[0] };
  const selectedItem = labels.find((item) => item.id === selectedId) || null;

  function updateItem(id, patch) {
    setLabels((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setDirty(true);
  }
  function handleChangeSelected(patch) { if (!selectedItem) return; updateItem(selectedItem.id, patch); }
  function handleDeleteSelected() { if (!selectedItem) return; setLabels((prev) => prev.filter((item) => item.id !== selectedItem.id)); setSelectedId(null); setDirty(true); }
  function handleAddDiscovery(pos) {
    const next = normalizeOverlayItem({ id: uid("discovery"), key: uid("discovery-key"), name: "New Discovery", x: pos.x, y: pos.y, tone: "amber", labelType: "discovery", notes: "" }, "discovery");
    setLabels((prev) => [...prev, next]);
    setSelectedId(next.id);
    setDirty(true);
    setPlacingDiscovery(false);
    setEditMode(true);
    setAdminToolsVisible(true);
  }
  async function handleSave() { if (typeof onSaveMapData !== "function") return; await onSaveMapData({ labels }); setDirty(false); }

  const adminDrawerProps = { dirty, editMode, setEditMode, labels, selectedItem, onSelect: setSelectedId, onChangeSelected: handleChangeSelected, onDeleteSelected: handleDeleteSelected, onBeginDiscoveryPlacement: () => setPlacingDiscovery((v) => !v), onSave: handleSave, mapToolsOpen, setMapToolsOpen, storedMapImage: mapImageUrl, fallbackMapImage: townData.mapImage || null, onSelectMap: onSelectMapImage, onApplyMap: onApplyMapImage, onClearPendingMap, onDeleteMap: onDeleteMapImage, imageMeta: imageNaturalSize, pendingMapFileName, mapApplyState, mapFileInputKey, labelSaveState };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}><Link href={backHref || "/map"} className="btn btn-sm btn-outline-light">Back to Map</Link><div><div className={styles.eyebrow}>Town sheet</div><h1 className={styles.pageTitle}>{location?.name || "Town"}</h1></div></div>
      <section className={styles.summaryBanner}><div className={styles.eyebrow}>City summary</div><h2 className={styles.summaryHeadline}>Overview can orient the player visually before it asks them to read</h2><p className={styles.summaryBody}>{townData.summary}</p><div className={styles.summaryStats}>{stats.map(([label, value, tone]) => <BannerStat key={label} label={label} value={value} tone={tone} />)}</div></section>
      <section className={styles.topPaneRow}><SharedDrawer panel={activePanel} openPanel={openPanel} setOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} adminDrawerProps={adminDrawerProps} marketData={marketData} townName={location?.name} crafterData={crafterData} playerInventory={playerInventory} onOpenWorkshop={setActiveWorkshopCrafter} /><TownMapPanel mapImage={effectiveMapImage} imageNaturalSize={imageNaturalSize} labels={labels} isAdmin={isAdmin} editMode={editMode} placingDiscovery={placingDiscovery} selectedId={selectedId} setSelectedId={setSelectedId} onMoveItem={(id, patch) => updateItem(id, patch)} onAddDiscovery={handleAddDiscovery} onOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} setAdminToolsVisible={setAdminToolsVisible} mapSourceLabel={mapSourceLabel} /></section>
      <section className={styles.teaserGrid}><CompactTeaser kicker="City stories" title={panels.stories.teaserTitle} subtitle={panels.stories.teaserSubtitle} featured={featured.stories} tone={panels.stories.tone} active={openPanel === "stories" && !adminToolsVisible} onOpen={() => { setAdminToolsVisible(false); setOpenPanel("stories"); }} /><CompactTeaser kicker="Featured people" title={panels.people.teaserTitle} subtitle={panels.people.teaserSubtitle} featured={featured.people} tone={panels.people.tone} active={openPanel === "people" && !adminToolsVisible} onOpen={() => { setAdminToolsVisible(false); setOpenPanel("people"); }} /><CompactTeaser kicker="Jobs & quest leads" title={panels.jobs.teaserTitle} subtitle={panels.jobs.teaserSubtitle} featured={featured.jobs} tone={panels.jobs.tone} active={openPanel === "jobs" && !adminToolsVisible} onOpen={() => { setAdminToolsVisible(false); setOpenPanel("jobs"); }} /><CompactTeaser kicker="Tavern rumors" title={panels.rumors.teaserTitle} subtitle={panels.rumors.teaserSubtitle} featured={featured.rumors} tone={panels.rumors.tone} active={openPanel === "rumors" && !adminToolsVisible} onOpen={() => { setAdminToolsVisible(false); setOpenPanel("rumors"); }} /></section>
      {activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}
    </div>
  );
}
