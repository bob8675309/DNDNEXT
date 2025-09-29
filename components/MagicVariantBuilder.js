import { useEffect, useMemo, useState } from "react";

/** Classic Magic Variant Builder (with thrown tab, stats footer, and blend button)
 *  - Tabs: Melee, Ranged, Thrown, Armor, Shield, Ammunition
 *  - Base = mundane only; filters out Future bucket; thrown items appear in Melee + Thrown
 *  - Material dropdown (Adamantine/Mithral/Silvered/Ruidium)
 *  - +N enhancement
 *  - Other A / Other B from window.__MAGIC_VARIANTS__ (multiple packs merged by admin)
 *  - Preview: blended description (optional) + bullet rules + stats footer
 *  - Name composer avoids duplicate suffix, forces last variant to “of …” if needed
 *  - Vorpal gating requires +3
 */

const TABS = ["melee", "ranged", "thrown", "armor", "shield", "ammunition"];
const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];

// ─────────── small utils
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
const get = (obj, path, d=undefined) => {
  try { return path.split(".").reduce((o,k)=> (o==null?undefined:o[k]), obj) ?? d; } catch { return d; }
};

// Property helpers (items sometimes store codes as strings or {uid:"V"} objects)
const codesFrom = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map((p) => (typeof p === "string" ? p : p?.uid)).filter(Boolean);
};
const hasProp = (it, code) => codesFrom(it?.property).includes(code);
const hasMastery = (it, m) => (Array.isArray(it?.mastery) ? it.mastery : []).includes(m);

// Classification helpers
const RANGED_WORDS = /(bow|crossbow|sling|dart|blowgun)/i;
const isThrown = (it) => hasProp(it, "T") || /(javelin|trident|throwing|handaxe|dagger|light hammer)/i.test((it?.name||"").toLowerCase());
const isMeleeBase = (it) => {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  const name = (it?.name || it?.item_name || "").toLowerCase();
  if (/ammunition/i.test(ui)) return false;
  if (/ranged/i.test(ui)) return false;
  if (/melee/i.test(ui)) return true;
  if (RANGED_WORDS.test(name)) return false;
  return /weapon/i.test(ui);
};
const isRangedBase = (it) => {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  const name = (it?.name || it?.item_name || "").toLowerCase();
  if (/ammunition/i.test(ui)) return false;
  return /ranged/i.test(ui) || RANGED_WORDS.test(name);
};

// Materials
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

// +N enhancement
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

const requiresPlus3 = (v) => /\bvorpal\b/i.test(v?.key || v?.name || "");

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
  if (Array.isArray(v?.options) && v.options.length)
    return { label: "Option", titleFmt: (opt) => title(opt) };
  return null;
}

// Load / normalize variants
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
        const appliesTo = Array.isArray(v?.appliesTo) && v.appliesTo.length ? v.appliesTo : ["weapon", "armor", "shield", "ammunition"];
        out.push({
          key,
          name,
          appliesTo,
          rarity: normRarity(v?.rarity),
          rarityByValue: v?.rarityByValue || null,
          textByKind: v?.textByKind || {},
          entries: Array.isArray(v?.entries) ? v.entries : null,
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

// Choose variant text: prefer non-trivial textByKind; else use main entry sentence
function textForVariant(v, cat, opt) {
  if (!v) return "";
  const kind = cat === "melee" || cat === "ranged" || cat === "thrown" ? "weapon" : cat;
  let body = (v.textByKind && (v.textByKind[kind] || v.textByKind.weapon || v.textByKind.armor)) || "";
  if (!body || /^as entry\.?$/i.test(body.trim())) {
    body = Array.isArray(v.entries) && v.entries[0] ? String(v.entries[0]) : "";
  }
  if (!body) return "";

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

// Stats footer helpers
function buildStats(base, tab) {
  const kind = tab === "melee" || tab === "ranged" || tab === "thrown" ? "weapon"
              : tab === "armor" ? "armor"
              : tab === "shield" ? "shield"
              : "ammunition";

  const stats = {
    kind,
    damage: "",
    versatile: "",
    range: "",
    properties: "",
    mastery: [],
    ac: "",
    armorType: "", // LA/MA/HA/Shield
  };

  if (!base) return stats;

  // armor/shield AC and type
  if (kind === "armor" || kind === "shield") {
    const ac = base.ac ?? base.acBase ?? "";
    stats.ac = ac ? String(ac) : "";
    const t = String(base.type || "").split("|")[0] || "";
    stats.armorType = kind === "shield" ? "Shield" : (t === "LA" ? "Light Armor" : t === "MA" ? "Medium Armor" : t === "HA" ? "Heavy Armor" : "");
  }

  // weapon + ammo
  if (kind === "weapon" || kind === "ammunition") {
    // damage text + versatile
    const dmgText = String(base.damageText || base.dmgText || "").trim();
    stats.damage = dmgText || (base.dmg1 ? `${base.dmg1} ${String(base.dmgType || "").toLowerCase()}` : "");
    // if properties include V and we have parentheses form “(1d10)”, try to expose as versatile
    if (/\(([^)]+)\)/.test(dmgText)) {
      const m = dmgText.match(/\(([^)]+)\)/);
      if (m) stats.versatile = m[1];
    }
    // range
    const rTxt = String(base.rangeText || "").trim();
    stats.range = rTxt || "";
    // properties text
    const propCodes = codesFrom(base.property);
    const propWords = [];
    const PUSH = (s) => { if (s) propWords.push(s); };
    propCodes.includes("2H") && PUSH("Two-Handed");
    propCodes.includes("H") && PUSH("Heavy");
    propCodes.includes("F") && PUSH("Finesse");
    propCodes.includes("R") && PUSH("Reach");
    propCodes.includes("LD") && PUSH("Loading");
    propCodes.includes("RLD") && PUSH("Reload");
    propCodes.includes("T") && PUSH("Thrown");
    propCodes.includes("V") && PUSH(stats.versatile ? `Versatile (${stats.versatile})` : "Versatile");
    stats.mastery = Array.isArray(base.mastery) ? base.mastery.slice() : [];
    if (stats.mastery.length) PUSH(`Mastery: ${stats.mastery.join(", ")}`);
    stats.properties = propWords.join("; ");
  }

  return stats;
}

// Name compose (avoid duplicate and force “of …” for last when both are prefixes)
function variantNameParts(v, opt) {
  if (!v) return { prefix: "", ofPart: "", hadOf: false, raw: "" };
  const meta = optionMetaForVariant(v);
  const withOpt = meta && opt ? meta.titleFmt(opt) : null;
  const n = v.name;
  if (/\b of \b/i.test(n)) {
    const after = n.split(/\b of \b/i)[1];
    return { prefix: "", ofPart: (withOpt || after).trim(), hadOf: true, raw: n };
  }
  return { prefix: (withOpt || n).replace(/\s*(sword|weapon)\s*$/i, "").trim(), ofPart: "", hadOf: false, raw: n };
}

// Blend description generator
function blendDescription(base, materialKey, selA, selB) {
  const bits = [];
  const baseDesc = String(base?.item_description || base?.loreFull || base?.entries?.[0] || "").trim();
  if (baseDesc) bits.push(baseDesc);

  if (materialKey) {
    const mat = MATERIALS.find((m) => m.key === materialKey)?.name;
    if (mat) bits.push(`Forged of ${mat.toLowerCase()}, its surface bears a distinctive sheen and weight.`);
  }
  const appendFor = (v) => {
    if (!v) return;
    const n = v.name.toLowerCase();
    if (/flame tongue/i.test(n)) bits.push("Faint ember-bright runes trace along the edge, smouldering when called to flame.");
    if (/dancing/i.test(n)) bits.push("Subtle gyroscopic grooves and sigils allow it to hover and weave through the air.");
    if (/warning/i.test(n)) bits.push("Tiny warding glyphs line the grip, prickling when danger nears.");
    if (/moon/i.test(n)) bits.push("In darkness, pale silver light ripples across the metal like moonlight on water.");
  };
  appendFor(selA);
  appendFor(selB);

  // Concise blend
  const out = bits.join(" ");
  return out ? out : "";
}

// ─────────── main component
export default function MagicVariantBuilder({ open, onClose, baseItem, allItems = [], onBuild }) {
  const variants = useMagicVariants(open);

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
  const [blend, setBlend] = useState(""); // blended paragraph shown above bullets

  // Mundane filter by tab (and never show "Future")
  const mundaneFilter = useMemo(() => {
    return (it) => {
      const ui = it.__cls?.uiType || it.__cls?.rawType || "";
      if (ui === "Future") return false;

      const rarityRaw = String(it.rarity || it.item_rarity || "").toLowerCase();
      const mundane = !rarityRaw || rarityRaw === "none" || rarityRaw === "mundane";
      if (!mundane) return false;

      if (tab === "melee")  return /weapon/i.test(ui) && !/ammunition/i.test(ui) && (isMeleeBase(it) || isThrown(it));
      if (tab === "ranged") return /weapon/i.test(ui) && !/ammunition/i.test(ui) && isRangedBase(it) && !isThrown(it);
      if (tab === "thrown") return /weapon/i.test(ui) && !/ammunition/i.test(ui) && isThrown(it);
      if (tab === "armor")  return /armor/i.test(ui);
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

  // Materials list
  const materialChoices = useMemo(() => {
    const kind = (tab === "melee" || tab === "ranged" || tab === "thrown") ? "weapon" : tab;
    return MATERIALS.filter((m) => m.appliesTo.includes(kind));
  }, [tab]);
  const materialText = useMemo(() => {
    if (!materialKey) return "";
    const kind = (tab === "melee" || tab === "ranged" || tab === "thrown") ? "weapon" : tab;
    const m = MATERIALS.find((x) => x.key === materialKey);
    return (m?.textByKind?.[kind]) || "";
  }, [materialKey, tab]);

  // Variant choices
  const variantChoices = useMemo(() => {
    const kind = (tab === "melee" || tab === "ranged" || tab === "thrown") ? "weapon" : tab;
    const seen = new Set(), out = [];
    for (const v of variants) {
      if (!v.appliesTo?.includes(kind)) continue;
      if (MATERIAL_KEYS.has(v.key) || v.key === "enhancement") continue;
      const id = v.key + "::" + v.name;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(v);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [variants, tab]);

  const selA = useMemo(() => variantChoices.find((v) => v.key === selAKey) || null, [variantChoices, selAKey]);
  const selB = useMemo(() => variantChoices.find((v) => v.key === selBKey) || null, [variantChoices, selBKey]);
  useEffect(() => { setSelAOpt(""); }, [selAKey]);
  useEffect(() => { setSelBOpt(""); }, [selBKey]);

  // Name composition
  const composedName = useMemo(() => {
    if (!base) return "";
    const baseName = String(base.name || base.item_name || "Item");
    const pre = [];
    if (Number(bonus) > 0) pre.push(`+${bonus}`);
    if (materialKey) pre.push(MATERIALS.find((m) => m.key === materialKey)?.name || "");

    const a = variantNameParts(selA, selAOpt);
    const b = variantNameParts(selB, selBOpt);

    // If both are prefix-style, promote B to suffix “of …”
    let prefixes = [];
    let ofParts = [];
    if (a.hadOf) ofParts.push(a.ofPart); else if (a.prefix) prefixes.push(a.prefix);
    if (b.hadOf) ofParts.push(b.ofPart);
    else if (b.prefix) {
      if (!a.hadOf && a.prefix) ofParts.push(b.prefix); // make B the suffix
      else prefixes.push(b.prefix);
    }

    const head = [pre.join(" ").trim(), prefixes.filter(Boolean).join(" ").trim()].filter(Boolean).join(" ").trim();
    const withBase = head ? `${head} ${baseName}` : baseName;
    return ofParts.length ? `${withBase} of ${ofParts.join(" And ")}` : withBase;
  }, [base, bonus, materialKey, selA, selAOpt, selB, selBOpt]);

  // Preview bullets + rarity + stats
  const preview = useMemo(() => {
    const lines = [];
    const rarities = [];
    const kind = (tab === "melee" || tab === "ranged" || tab === "thrown") ? "weapon" : tab;

    if (Number(bonus) > 0) {
      lines.push(ENHANCEMENT.textByKind[kind].replace("{N}", String(bonus)));
      rarities.push(ENHANCEMENT.rarityByValue[bonus]);
    }
    if (materialKey) {
      const m = MATERIALS.find((x) => x.key === materialKey);
      if (m?.textByKind?.[kind]) lines.push(m.textByKind[kind]);
      if (m?.rarity) rarities.push(m.rarity);
    }
    const addVariant = (v, opt) => {
      if (!v) return;
      if (requiresPlus3(v) && Number(bonus) < 3) lines.push("This enchantment requires the item to already be +3 before it may be applied.");
      const blurb = textForVariant(v, kind, opt);
      if (blurb) lines.push(blurb);
      const r = rarityForVariant(v, opt);
      if (r) rarities.push(r);
    };
    addVariant(selA, selAOpt);
    addVariant(selB, selBOpt);

    const highest = rarities.reduce((acc, r) => {
      const a = RARITY_ORDER.indexOf(acc || "");
      const b = RARITY_ORDER.indexOf(r || "");
      return b > a ? r : acc;
    }, "");

    return { lines, rarity: highest || "—", stats: buildStats(base, tab) };
  }, [bonus, materialKey, selA, selAOpt, selB, selBOpt, tab, base]);

  // Under-select blurbs
  const descA = selA ? textForVariant(selA, tab === "melee" || tab === "ranged" || tab === "thrown" ? "weapon" : tab, selAOpt) : "";
  const descB = selB ? textForVariant(selB, tab === "melee" || tab === "ranged" || tab === "thrown" ? "weapon" : tab, selBOpt) : "";

  // Build payload for Admin
  function handleBuild() {
    if (!base) return;
    const obj = {
      name: composedName,
      rarity: preview.rarity,
      baseId: base.id || base._id,
      baseName: base.name || base.item_name,
      category: tab, // melee|ranged|thrown|armor|shield|ammunition
      bonus: Number(bonus) || 0,
      material: materialKey || null,
      variantA: selA?.name || null,
      variantAKey: selA?.key || null,
      variantAOption: selAOpt || null,
      variantB: selB?.name || null,
      variantBKey: selB?.key || null,
      variantBOption: selBOpt || null,
      entries: preview.lines.filter(Boolean),
      // stats for Admin card
      damageText: preview.stats.damage,
      rangeText: preview.stats.range,
      propertiesText: preview.stats.properties,
      mastery: preview.stats.mastery,
      ac: preview.stats.ac,
      armorTypeText: preview.stats.armorType,
      // include the optional blended paragraph (Admin can adopt later)
      blendedDescription: blend || "",
    };
    onBuild?.(obj);
  }

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
                    setBlend("");
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
                    const next = baseChoices.find((it) => (it.id || it.name) === val) || baseChoices.find((it) => (it.name || "") === val) || null;
                    setBase(next);
                    setBlend("");
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
                <select className="form-select" value={materialKey} onChange={(e) => { setMaterialKey(e.target.value); setBlend(""); }}>
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
                    {ENHANCEMENT.textByKind[(tab === "melee" || tab === "ranged" || tab === "thrown") ? "weapon" : tab].replace("{N}", String(bonus))}
                  </div>
                )}
              </div>

              {/* Other A */}
              <div className="col-12 col-lg-6">
                <label className="form-label fw-semibold">Other A (optional)</label>
                <select className="form-select" value={selAKey} onChange={(e) => { setSelAKey(e.target.value); setBlend(""); }}>
                  <option value="">— none —</option>
                  {variantChoices.map((v) => (
                    <option key={v.key} value={v.key} disabled={requiresPlus3(v) && Number(bonus) < 3}>
                      {v.name}{requiresPlus3(v) ? " (requires +3)" : ""}
                    </option>
                  ))}
                </select>
                {(() => {
                  const meta = optionMetaForVariant(selA);
                  if (!selA) return null;
                  return (
                    <>
                      {meta && Array.isArray(selA.options) && (
                        <div className="mt-2">
                          <label className="form-label small">{meta.label}</label>
                          <select className="form-select form-select-sm" value={selAOpt} onChange={(e) => { setSelAOpt(e.target.value); setBlend(""); }}>
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
                <select className="form-select" value={selBKey} onChange={(e) => { setSelBKey(e.target.value); setBlend(""); }}>
                  <option value="">— none —</option>
                  {variantChoices.map((v) => (
                    <option key={v.key} value={v.key} disabled={requiresPlus3(v) && Number(bonus) < 3}>
                      {v.name}{requiresPlus3(v) ? " (requires +3)" : ""}
                    </option>
                  ))}
                </select>
                {(() => {
                  const meta = optionMetaForVariant(selB);
                  if (!selB) return null;
                  return (
                    <>
                      {meta && Array.isArray(selB.options) && (
                        <div className="mt-2">
                          <label className="form-label small">{meta.label}</label>
                          <select className="form-select form-select-sm" value={selBOpt} onChange={(e) => { setSelBOpt(e.target.value); setBlend(""); }}>
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
                  <button
                    className="btn btn-sm btn-outline-light"
                    type="button"
                    onClick={() => setBlend(blend || blendDescription(base, materialKey, selA, selB))}
                    title="Blend a single descriptive paragraph from the base item + options"
                  >
                    ✦ Blend Description
                  </button>
                </div>
              </div>

              <div className="card bg-black border-secondary mt-2">
                <div className="card-body">
                  <div className="fw-semibold mb-2">{composedName || "—"}</div>

                  {/* blended paragraph (optional) */}
                  {blend && <div className="mb-3">{blend}</div>}

                  {/* bullets */}
                  {preview.lines.length === 0 ? (
                    <div className="text-muted">Choose options to see details.</div>
                  ) : (
                    <ul className="mb-3">
                      {preview.lines.map((ln, i) => <li key={i}>{ln}</li>)}
                    </ul>
                  )}

                  {/* stats footer */}
                  <div className="small text-muted d-flex flex-wrap gap-4">
                    {(tab === "armor" || tab === "shield") ? (
                      <>
                        <div><span className="text-light">AC:</span> {preview.stats.ac || "—"}</div>
                        <div><span className="text-light">Type:</span> {preview.stats.armorType || "—"}</div>
                      </>
                    ) : (
                      <>
                        <div><span className="text-light">Damage:</span> {preview.stats.damage || "—"}</div>
                        <div><span className="text-light">Range:</span> {preview.stats.range || "—"}</div>
                        <div><span className="text-light">Properties:</span> {preview.stats.properties || "—"}</div>
                      </>
                    )}
                  </div>
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
