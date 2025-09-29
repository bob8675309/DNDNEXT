// components/MagicVariantBuilder.js
import { useEffect, useMemo, useState } from "react";

/**
 * Classic Magic Variant Builder
 * - Tabs: Melee, Ranged, Thrown, Armor, Shield, Ammunition
 * - Base = mundane only, filtered by tab
 * - Material dropdown (Adamantine/Mithral/Silvered/Ruidium)
 * - +N enhancement
 * - Other A / Other B from window.__MAGIC_VARIANTS__
 * - Inline blurbs + rarity readout
 * - Vorpal gating requires +3
 * - NEW: “Blend Description” generates a fresh flavorful description every click
 *   and the text is sent to Admin as `item_description`. We also pass
 *   damageText/rangeText/propertiesText (and AC for armor/shield).
 */

// ----------------------------- helpers -----------------------------
const TABS = ["melee", "ranged", "thrown", "armor", "shield", "ammunition"];
const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];
const title = (s) => String(s || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const normRarity = (r) => {
  const x = String(r || "").toLowerCase();
  if (x.includes("legend")) return "Legendary";
  if (x.includes("very")) return "Very Rare";
  if (x.includes("rare")) return "Rare";
  if (x.includes("uncommon")) return "Uncommon";
  if (x.includes("common")) return "Common";
  return "";
};

// Simple text utils
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Very light classifiers (keeps Future/odd stuff out and splits thrown)
const RANGED_WORDS = /(bow|crossbow|sling|dart|net|javelin|boomerang)/i;
const isFuture = (it) => (it?.__cls?.uiType || "").toLowerCase() === "future";

function hasProp(it, abbr) {
  const props = (it?.property || []).map((p) => (typeof p === "string" ? p : p?.uid || p?.abbreviation || "")).filter(Boolean);
  return props.some((p) => String(p).toUpperCase() === String(abbr).toUpperCase());
}
function isThrownCapable(it) {
  // “Thrown” property OR a rangedText that looks like thrown ranges on melee weapons
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  const meleeish = /melee/i.test(ui) || /weapon/i.test(ui);
  return meleeish && (hasProp(it, "T") || /(\/|\d)\s*\/\s*(\d)/.test(String(it?.rangeText || "")));
}

function isMeleeBase(it) {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  if (isFuture(it)) return false;
  if (/armor|shield|ammunition/i.test(ui)) return false;
  if (/ranged/i.test(ui)) return false;
  if (/melee/i.test(ui)) return true;
  const name = (it?.name || it?.item_name || "").toLowerCase();
  if (RANGED_WORDS.test(name)) return false;
  return /weapon/i.test(ui) || /club|mace|sword|axe|maul|flail|hammer|spear|staff|whip|scimitar|rapier|dagger|halberd|glaive|pike|morningstar|lance|trident/i.test(
    name
  );
}
function isRangedBase(it) {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  if (isFuture(it)) return false;
  if (/armor|shield|ammunition/i.test(ui)) return false;
  if (/ranged/i.test(ui)) return true;
  const name = (it?.name || it?.item_name || "").toLowerCase();
  return RANGED_WORDS.test(name) || /bow|crossbow|sling/i.test(ui);
}

// Materials (wording kept)
const MATERIALS = [
  {
    key: "adamantine",
    name: "Adamantine",
    appliesTo: ["weapon", "ammunition", "armor"],
    rarity: "Uncommon",
    textByKind: {
      weapon:
        "This weapon (or ammunition) is made of adamantine. Whenever it hits an object, the hit is a Critical Hit.",
      ammunition:
        "This ammunition is made of adamantine. Whenever it hits an object, the hit is a Critical Hit.",
      armor: "While you wear this armor, any Critical Hit against you becomes a normal hit.",
    },
  },
  {
    key: "mithral",
    name: "Mithral",
    appliesTo: ["armor"],
    rarity: "Uncommon",
    textByKind: {
      armor:
        "Mithral is a light, flexible metal. If the base armor normally imposes Disadvantage on Dexterity (Stealth) checks or has a Strength requirement, the mithral version doesn’t.",
    },
  },
  {
    key: "silvered",
    name: "Silvered",
    appliesTo: ["weapon"],
    rarity: "Common",
    textByKind: {
      weapon:
        "An alchemical process has bonded silver to this magic weapon. When you score a Critical Hit against a shape-shifted creature, roll one additional damage die of the weapon’s normal damage type.",
    },
  },
  {
    key: "ruidium",
    name: "Ruidium",
    appliesTo: ["weapon", "armor"],
    rarity: "Very Rare",
    textByKind: {
      weapon:
        "You can breathe water and have a Swim Speed equal to your Speed. A creature you hit takes an extra 2d6 Psychic damage. On a natural 1 with this weapon, make a DC 20 Charisma save or gain 1 level of Exhaustion.",
      armor:
        "You have Resistance to Psychic damage, a Swim Speed equal to your Speed, and can breathe water. On a natural 1 on a saving throw while wearing this, make a DC 15 Charisma save or gain 1 level of Exhaustion.",
    },
  },
];
const MATERIAL_KEYS = new Set(MATERIALS.map((m) => m.key));

// +N enhancement copy
const ENHANCEMENT = {
  values: [0, 1, 2, 3],
  rarityByValue: { 1: "Uncommon", 2: "Rare", 3: "Very Rare" },
  textByKind: {
    weapon: "You have a +{N} bonus to attack and damage rolls made with this magic weapon.",
    armor: "You have a +{N} bonus to Armor Class while wearing this armor.",
    shield: "While holding this shield, you have a +{N} bonus to Armor Class.",
    ammunition:
      "You have a +{N} bonus to attack and damage rolls made with this ammunition; once it hits, it’s no longer magical.",
  },
};
const requiresPlus3 = (v) => /\bvorpal|sword_of_sharpness\b/i.test(v?.key || v?.name || "");

// Option label helpers
function optionMetaForVariant(v) {
  if (!v) return null;
  const k = v.key || "";
  if (k === "armor_resistance")
    return { label: "Resistance Type", titleFmt: (opt) => `${title(opt)} Resistance` };
  if (k === "armor_vulnerability")
    return { label: "Damage Type", titleFmt: (opt) => `${title(opt)} Vulnerability` };
  if (k === "ammunition_slaying")
    return { label: "Creature Type", titleFmt: (opt) => `Slaying (${title(opt)})` };
  if (k === "enspell_weapon" || k === "enspell_armor")
    return { label: "Spell Level", titleFmt: (opt) => `Level ${opt} Spell` };
  if (Array.isArray(v.options) && v.options.length)
    return { label: "Option", titleFmt: (opt) => title(opt) };
  return null;
}

// ---------------------- load / normalize variants ----------------------
function useMagicVariants(open) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!open) return;
    try {
      const raw = (typeof window !== "undefined" && window.__MAGIC_VARIANTS__) || [];
      const out = [];
      for (const v of raw) {
        const name = String(v?.name || "").trim();
        if (!name) continue;
        const key = String(v?.key || name).toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const appliesTo =
          Array.isArray(v?.appliesTo) && v.appliesTo.length
            ? v.appliesTo
            : ["weapon", "armor", "shield", "ammunition"];
        out.push({
          key,
          name,
          appliesTo,
          rarity: normRarity(v?.rarity),
          rarityByValue: v?.rarityByValue || null,
          textByKind: v?.textByKind || {},
          options: Array.isArray(v?.options) ? v.options : null,
          requires: v?.requires || null,
          attunement: !!v?.attunement,
          cursed: !!v?.cursed,
          dcByValue: v?.dcByValue || null,
          attackByValue: v?.attackBonusByValue || null,
          schools: v?.schools || null,
        });
      }
      setList(out);
    } catch (e) {
      console.error("parse magic variants failed", e);
      setList([]);
    }
  }, [open]);
  return list;
}

function textForVariant(v, cat, opt) {
  if (!v) return "";
  const kind = cat === "melee" || cat === "ranged" || cat === "thrown" ? "weapon" : cat;
  let body = v.textByKind?.[kind] || v.textByKind?.weapon || v.textByKind?.armor || "";
  if (!body) return (v.entries && v.entries[0]) || ""; // fallback to first entry if present

  const valueKey = (opt ?? "").toString();
  const dc = v.dcByValue?.[valueKey] ?? v.dcByValue?.[Number(valueKey)] ?? "";
  const atk = v.attackByValue?.[valueKey] ?? v.attackByValue?.[Number(valueKey)] ?? "";

  return body
    .replaceAll("{OPTION}", title(opt))
    .replaceAll("{LEVEL}", String(opt ?? ""))
    .replaceAll("{DC}", dc ? String(dc) : "—")
    .replaceAll("{ATK}", atk ? String(atk) : "—")
    .replaceAll("{SCHOOLS}", v.schools || "—")
    .replaceAll("{N}", "");
}
function rarityForVariant(v, opt) {
  if (!v) return "";
  if (v.rarityByValue && opt != null) {
    const r = v.rarityByValue[String(opt)] ?? v.rarityByValue[Number(opt)];
    return normRarity(r);
  }
  return normRarity(v.rarity);
}

// Pull stat strings for the admin card
function baseStatsFor(it) {
  const damageText = String(it?.damageText || it?.dmg1 || "").trim();
  const rangeText = String(it?.rangeText || "").trim();
  const propertiesText = String(it?.propertiesText || "").trim();
  const ac = it?.ac != null ? Number(it.ac) : null;
  const weight = it?.weight != null ? Number(it.weight) : null;
  const value = it?.value != null ? Number(it.value) : null;
  return { damageText, rangeText, propertiesText, ac, weight, value };
}

// ----------------------------- component -----------------------------
export default function MagicVariantBuilder({
  open,
  onClose,
  baseItem,
  allItems = [],
  onBuild,
}) {
  const variants = useMagicVariants(open);

  // Default tab from base item
  const defaultTab = useMemo(() => {
    const t = baseItem?.__cls?.uiType || "";
    if (/shield/i.test(t)) return "shield";
    if (/armor/i.test(t)) return "armor";
    if (/ammunition/i.test(t)) return "ammunition";
    if (/ranged/i.test(t)) return "ranged";
    return "melee";
  }, [baseItem]);

  const [tab, setTab] = useState(defaultTab);
  const [base, setBase] = useState(baseItem || null);
  const [bonus, setBonus] = useState(0);
  const [materialKey, setMaterialKey] = useState("");
  const [selAKey, setSelAKey] = useState("");
  const [selAOpt, setSelAOpt] = useState("");
  const [selBKey, setSelBKey] = useState("");
  const [selBOpt, setSelBOpt] = useState("");
  const [blendedDesc, setBlendedDesc] = useState("");

  // Mundane filter by tab (with Future exclusion)
  const mundaneFilter = useMemo(() => {
    return (it) => {
      const rarityRaw = String(it.rarity || it.item_rarity || "").toLowerCase();
      const mundane = !rarityRaw || rarityRaw === "none" || rarityRaw === "mundane";
      if (!mundane) return false;
      if (isFuture(it)) return false;

      const ui = it.__cls?.uiType || it.__cls?.rawType || "";
      if (tab === "melee") return isMeleeBase(it); // allow both pure melee + thrown-capable
      if (tab === "ranged") return isRangedBase(it) && !/ammunition/i.test(ui);
      if (tab === "thrown") return isThrownCapable(it);
      if (tab === "armor") return /armor/i.test(ui);
      if (tab === "shield") return /shield/i.test(ui);
      if (tab === "ammunition") return /ammunition/i.test(ui);
      return false;
    };
  }, [tab]);

  const baseChoices = useMemo(() => {
    return (allItems || [])
      .filter(mundaneFilter)
      .sort((a, b) => String(a.name || a.item_name).localeCompare(String(b.name || b.item_name)));
  }, [allItems, mundaneFilter]);

  useEffect(() => {
    if (!baseChoices.length) { setBase(null); return; }
    if (base && baseChoices.find((x) => (x.id || x.name) === (base.id || base.name))) return;
    setBase(baseChoices[0]);
  }, [baseChoices]); // eslint-disable-line

  // Materials per tab
  const materialKind = (tab === "melee" || tab === "ranged" || tab === "thrown") ? "weapon" : tab;
  const materialChoices = useMemo(() => {
    return MATERIALS.filter((m) => m.appliesTo.includes(materialKind));
  }, [materialKind]);
  const materialText = useMemo(() => {
    if (!materialKey) return "";
    const m = MATERIALS.find((x) => x.key === materialKey);
    return (m?.textByKind?.[materialKind]) || "";
  }, [materialKey, materialKind]);

  // Variant list (exclude enhancement/materials)
  const variantChoices = useMemo(() => {
    const kind = materialKind;
    const list = variants.filter(
      (v) => v.appliesTo.includes(kind) && v.key !== "enhancement" && !MATERIAL_KEYS.has(v.key)
    );
    const seen = new Set();
    const out = [];
    for (const v of list) {
      const id = v.key + "::" + v.name;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(v);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [variants, materialKind]);

  const selA = useMemo(() => variantChoices.find((v) => v.key === selAKey) || null, [variantChoices, selAKey]);
  const selB = useMemo(() => variantChoices.find((v) => v.key === selBKey) || null, [variantChoices, selBKey]);
  useEffect(() => { setSelAOpt(""); }, [selAKey]);
  useEffect(() => { setSelBOpt(""); }, [selBKey]);

  // Name compose (prefixes & “of …” suffixes, ensure last becomes “of X”)
  function namePartsFor(v, opt) {
    if (!v) return { prefix: "", ofPart: "" };
    const meta = optionMetaForVariant(v);
    const ofWithOpt = meta && opt ? meta.titleFmt(opt) : null;
    const n = v.name;
    if (/\b of \b/i.test(n)) {
      const ofPart = ofWithOpt || n.split(/\b of \b/i)[1];
      return { prefix: "", ofPart: ofPart.trim() };
    }
    return { prefix: n.replace(/\s*(sword|weapon)\s*$/i, "").trim(), ofPart: "" };
  }
  const composedName = useMemo(() => {
    if (!base) return "";
    const baseName = String(base.name || base.item_name || "Item");
    const pre = [];
    if (Number(bonus) > 0) pre.push(`+${bonus}`);
    if (materialKey) pre.push(MATERIALS.find((m) => m.key === materialKey)?.name || "");

    const a = namePartsFor(selA, selAOpt);
    const b = namePartsFor(selB, selBOpt);
    const prefixes = [a.prefix, b.prefix].filter(Boolean).join(" ").trim();
    const ofParts = [a.ofPart, b.ofPart].filter(Boolean);

    const head = [pre.join(" ").trim(), prefixes].filter(Boolean).join(" ").trim();
    const withBase = head ? `${head} ${baseName}` : baseName;

    // If there are any “of” parts, attach only once as a suffix chain.
    return ofParts.length ? `${withBase} of ${ofParts.join(" And ")}` : withBase;
  }, [base, bonus, materialKey, selA, selAOpt, selB, selBOpt]);

  // Preview lines + rarity
  const preview = useMemo(() => {
    const lines = [];
    const rarities = [];
    const kind = materialKind;

    if (Number(bonus) > 0) {
      lines.push(ENHANCEMENT.textByKind[kind].replace("{N}", String(bonus)));
      rarities.push(ENHANCEMENT.rarityByValue[bonus]);
    }
    if (materialKey) {
      const m = MATERIALS.find((x) => x.key === materialKey);
      if (m?.textByKind?.[kind]) lines.push(m.textByKind[kind]);
      if (m?.rarity) rarities.push(m.rarity);
    }
    function addVariant(v, opt) {
      if (!v) return;
      if (requiresPlus3(v) && Number(bonus) < 3) {
        lines.push("This enchantment requires the item to already be +3 before it may be applied.");
      }
      const blurb = textForVariant(v, kind, opt);
      if (blurb) lines.push(blurb);
      const r = rarityForVariant(v, opt);
      if (r) rarities.push(r);
    }
    addVariant(selA, selAOpt);
    addVariant(selB, selBOpt);

    const highest = rarities.reduce((acc, r) => {
      const a = RARITY_ORDER.indexOf(acc || "");
      const b = RARITY_ORDER.indexOf(r || "");
      return b > a ? r : acc;
    }, "");

    return { lines, rarity: highest || "—" };
  }, [bonus, materialKey, selA, selAOpt, selB, selBOpt, materialKind]);

  // ------------------------ Blend Description ------------------------
  const flavorFor = useMemo(() => {
    const map = new Map();

    // Materials
    map.set("adamantine", [
      "forged of adamantine, its surface bears a deep, glassy sheen and daunting weight",
      "adamantine veins run the length of the {BASE}, cold to the touch and stubborn as night",
    ]);
    map.set("mithral", [
      "spun of mithral, it moves with a light, silvery grace",
      "mithral weave gleams faintly, quick and quiet",
    ]);
    map.set("silvered", [
      "alchemically silvered, a pale shine clings to the edge",
      "the blade carries a moon-kissed lustre",
    ]);
    map.set("ruidium", [
      "streaked with ruidium like living coral, it hums with uneasy power",
      "ruddy ruidium nodules pulse faintly in the metal",
    ]);

    // Common weapon/armor variants (add more as you like)
    const add = (k, lines) => map.set(k, lines);
    add("flame_tongue", [
      "ember-bright runes smoulder along the edge when called to flame",
      "heat-blurred sigils kindle down the fuller at a word",
    ]);
    add("dancing", [
      "subtle gyroscopic grooves hint at a will to hover and weave through the air",
      "balance-cuts and hidden vanes let the {BASE} dance off your hand",
    ]);
    add("moon_touched", ["in darkness, starry motes gather along the blade"]);
    add("weapon_of_warning", ["etched ward-glyphs prickle awake at the faintest hint of danger"]);
    add("sword_of_sharpness", ["the edge shows a hair-fine mirror where the steel has been honed past reason"]);
    // Armor/Shield examples
    add("death_ward", ["a quiet benediction is engraved beneath the collar"]);
    add("prismatic_aegis", ["a faint prismatic sheen glides over the surface when it turns aside harm"]);

    return map;
  }, []);

  function blendNow() {
    if (!base) { setBlendedDesc(""); return; }
    const baseName = String(base.name || base.item_name || "").toLowerCase();
    const baseNoun = /shield/i.test(baseName) ? "shield" : /armor/i.test(baseName) ? "armor" : "blade";
    const opener = pick([
      `Simple yet dependable, the ${baseName} rides easy on the hip and comes free without fuss.`,
      `Well-kept and service-ready, this ${baseName} shows the hand of a careful craftsperson.`,
      `Weight and balance feel right the moment you take the ${baseName} in hand.`,
    ]);

    const materialBits = materialKey ? flavorFor.get(materialKey) || [] : [];
    const aBits = selA ? (flavorFor.get(selA.key) || flavorFor.get(selA.name?.toLowerCase()?.replace(/[^a-z0-9]+/g,"_")) || []) : [];
    const bBits = selB ? (flavorFor.get(selB.key) || flavorFor.get(selB.name?.toLowerCase()?.replace(/[^a-z0-9]+/g,"_")) || []) : [];

    const picked = [];
    if (materialBits.length) picked.push(pick(materialBits));
    if (aBits.length) picked.push(pick(aBits));
    if (bBits.length) picked.push(pick(bBits));

    const body = picked
      .filter(Boolean)
      .map((s) => s.replaceAll("{BASE}", baseNoun))
      .join(". ");

    const out = [opener, body].filter(Boolean).join(" ");
    setBlendedDesc(out);
  }

  // auto-clear when base/material/variants change
  useEffect(() => { setBlendedDesc(""); }, [base, materialKey, selAKey, selAOpt, selBKey, selBOpt]);

  // Build object to return
  function handleBuild() {
    if (!base) return;
    const stats = baseStatsFor(base);
    const obj = {
      name: composedName,
      rarity: preview.rarity,
      baseId: base.id || base._id,
      baseName: base.name || base.item_name,
      category: tab, // melee | ranged | thrown | armor | shield | ammunition
      bonus: Number(bonus) || 0,
      material: materialKey || null,
      variantA: selA?.name || null,
      variantAKey: selA?.key || null,
      variantAOption: selAOpt || null,
      variantB: selB?.name || null,
      variantBKey: selB?.key || null,
      variantBOption: selBOpt || null,
      entries: preview.lines.filter(Boolean), // bullet list for Admin card
      // Stats for the admin ItemCard footer:
      damageText: stats.damageText || "",
      rangeText: stats.rangeText || "",
      propertiesText: stats.propertiesText || "",
      ac: stats.ac ?? null,
      weight: stats.weight ?? null,
      value: stats.value ?? null,
      // Top description blurb for Admin card:
      item_description: blendedDesc || String(base.item_description || base.entries?.[0] || "").trim(),
    };
    onBuild?.(obj);
  }

  // ------------------------------ UI ------------------------------
  if (!open) return null;

  return (
    <div className="modal d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,.6)" }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content bg-dark text-light border-secondary">
          <div className="modal-header border-secondary">
            <h5 className="modal-title">Build Magic Variant</h5>
            <button className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
          </div>

          <div className="modal-body">
            {/* Tabs */}
            <div className="mb-3 d-flex flex-wrap gap-2">
              {TABS.map((k) => (
                <button
                  key={k}
                  className={`btn btn-sm ${tab === k ? "btn-light text-dark" : "btn-outline-light"}`}
                  onClick={() => {
                    setTab(k);
                    setMaterialKey("");
                    setSelAKey("");
                    setSelBKey("");
                    setSelAOpt("");
                    setSelBOpt("");
                  }}
                >
                  {title(k)}
                </button>
              ))}
            </div>

            <div className="row g-3">
              {/* Base chooser */}
              <div className="col-12 col-lg-6">
                <label className="form-label fw-semibold">
                  Base {tab === "ammunition" ? "Ammunition" : tab === "armor" ? "Armor" : tab === "shield" ? "Shield" : title(tab)} (mundane)
                </label>
                <select
                  className="form-select"
                  value={base?.id || base?.name || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const next =
                      baseChoices.find((it) => (it.id || it.name) === val) ||
                      baseChoices.find((it) => (it.name || "") === val) || null;
                    setBase(next);
                  }}
                >
                  {baseChoices.map((it) => {
                    const id = it.id || it.name;
                    const nm = it.name || it.item_name;
                    return <option key={id} value={id}>{nm}</option>;
                  })}
                </select>
              </div>

              {/* Rarity readout */}
              <div className="col-12 col-lg-6">
                <label className="form-label fw-semibold">Current Rarity</label>
                <input className="form-control" value={preview.rarity} readOnly />
              </div>

              {/* Material */}
              <div className="col-12 col-lg-6">
                <label className="form-label fw-semibold">Material (optional)</label>
                <select className="form-select" value={materialKey} onChange={(e) => setMaterialKey(e.target.value)}>
                  <option value="">— none —</option>
                  {materialChoices.map((m) => (
                    <option key={m.key} value={m.key}>{m.name}</option>
                  ))}
                </select>
                {materialKey && <div className="form-text text-light mt-1">{materialText}</div>}
              </div>

              {/* +N */}
              <div className="col-12 col-lg-6">
                <label className="form-label fw-semibold">Bonus (optional)</label>
                <div className="d-flex gap-2">
                  <input className="form-control" value="+N" readOnly style={{ maxWidth: 120 }} />
                  <select className="form-select" value={String(bonus)} onChange={(e) => setBonus(Number(e.target.value))}>
                    {ENHANCEMENT.values.map((v) => (
                      <option key={v} value={v}>{v === 0 ? "—" : v}</option>
                    ))}
                  </select>
                </div>
                {Number(bonus) > 0 && (
                  <div className="form-text text-light mt-1">
                    {ENHANCEMENT.textByKind[materialKind].replace("{N}", String(bonus))}
                  </div>
                )}
              </div>

              {/* Other A */}
              <div className="col-12 col-lg-6">
                <label className="form-label fw-semibold">Other A (optional)</label>
                <select className="form-select" value={selAKey} onChange={(e) => setSelAKey(e.target.value)}>
                  <option value="">— none —</option>
                  {variantChoices.map((v) => (
                    <option key={v.key} value={v.key} disabled={requiresPlus3(v) && Number(bonus) < 3}>
                      {v.name}{requiresPlus3(v) ? " (requires +3)" : ""}
                    </option>
                  ))}
                </select>
                {(() => {
                  const meta = optionMetaForVariant(selA);
                  const kind = materialKind;
                  const descA = selA ? textForVariant(selA, kind, selAOpt) : "";
                  if (!selA) return null;
                  return (
                    <>
                      {meta && Array.isArray(selA.options) && (
                        <div className="mt-2">
                          <label className="form-label small">{meta.label}</label>
                          <select className="form-select form-select-sm" value={selAOpt} onChange={(e) => setSelAOpt(e.target.value)}>
                            <option value="">— select —</option>
                            {selA.options.map((o) => (
                              <option key={String(o)} value={String(o)}>{title(o)}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {descA && <div className="small mt-1">{descA}</div>}
                    </>
                  );
                })()}
              </div>

              {/* Other B */}
              <div className="col-12 col-lg-6">
                <label className="form-label fw-semibold">Other B (optional)</label>
                <select className="form-select" value={selBKey} onChange={(e) => setSelBKey(e.target.value)}>
                  <option value="">— none —</option>
                  {variantChoices.map((v) => (
                    <option key={v.key} value={v.key} disabled={requiresPlus3(v) && Number(bonus) < 3}>
                      {v.name}{requiresPlus3(v) ? " (requires +3)" : ""}
                    </option>
                  ))}
                </select>
                {(() => {
                  const meta = optionMetaForVariant(selB);
                  const kind = materialKind;
                  const descB = selB ? textForVariant(selB, kind, selBOpt) : "";
                  if (!selB) return null;
                  return (
                    <>
                      {meta && Array.isArray(selB.options) && (
                        <div className="mt-2">
                          <label className="form-label small">{meta.label}</label>
                          <select className="form-select form-select-sm" value={selBOpt} onChange={(e) => setSelBOpt(e.target.value)}>
                            <option value="">— select —</option>
                            {selB.options.map((o) => (
                              <option key={String(o)} value={String(o)}>{title(o)}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {descB && <div className="small mt-1">{descB}</div>}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Preview */}
            <div className="mt-3">
              <div className="d-flex align-items-center justify-content-between">
                <h5 className="m-0">Preview</h5>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-secondary">{preview.rarity}</span>
                  <button className="btn btn-sm btn-outline-light" onClick={blendNow}>
                    ⟲ Blend Description
                  </button>
                </div>
              </div>

              <div className="card bg-black border-secondary mt-2">
                <div className="card-body">
                  <div className="fw-semibold mb-2">{composedName || "—"}</div>
                  {/* Blended description block */}
                  {blendedDesc ? (
                    <div className="mb-2">{blendedDesc}</div>
                  ) : null}

                  {preview.lines.length === 0 ? (
                    <div className="text-muted">Choose options to see details.</div>
                  ) : (
                    <ul className="mb-2">
                      {preview.lines.map((ln, i) => <li key={i}>{ln}</li>)}
                    </ul>
                  )}

                  {/* Footer stats pulled from base item (for parity with Admin card) */}
                  {base && (
                    <div className="small text-muted">
                      {(() => {
                        const s = baseStatsFor(base);
                        return (
                          <div className="d-flex flex-wrap gap-3">
                            <div>Damage: <span className="text-light">{s.damageText || "—"}</span></div>
                            <div>Range: <span className="text-light">{s.rangeText || "—"}</span></div>
                            <div>Properties: <span className="text-light">{s.propertiesText || "—"}</span></div>
                            {s.ac != null && <div>AC: <span className="text-light">{s.ac}</span></div>}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer border-secondary">
            <button className="btn btn-outline-light" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!base} onClick={handleBuild}>
              Build Variant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
