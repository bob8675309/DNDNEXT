// components/MagicVariantBuilder.js
import { useEffect, useMemo, useState } from "react";

/**
 * Classic Magic Variant Builder
 * - Tabs: Melee, Ranged, Thrown, Armor, Shield, Ammunition
 * - Base = mundane only, filtered by tab
 * - Material dropdown (+ Adamantine/Mithral/Silvered/Ruidium)
 * - +N enhancement
 * - Other A / Other B from window.__MAGIC_VARIANTS__ (merged by admin.js)
 * - Full text rendering (uses "entries" fallback when textByKind absent)
 * - Name composer: last enchant forced to an "of X" suffix, de-duped
 * - Preview card with: flavor paragraph + bullet rules + bottom stats panel
 */

// ───────────────────────────────── helpers ──────────────────────────────
const TABS = ["melee", "ranged", "thrown", "armor", "shield", "ammunition"];
const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];

const title = (s) =>
  String(s || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const normRarity = (r) => {
  const x = String(r || "").toLowerCase();
  if (x.includes("legend")) return "Legendary";
  if (x.includes("very")) return "Very Rare";
  if (x.includes("rare")) return "Rare";
  if (x.includes("uncommon")) return "Uncommon";
  if (x.includes("common")) return "Common";
  return "";
};

// ---- detect melee/ranged/thrown from names + uiType
const RANGED_NAME = /(bow|crossbow|sling|blowgun)/i;
const THROWN_NAME = /(javelin|trident|throwing|boomerang|chakram|shuriken)/i;
const DART_ONLY = /\bdart\b/i; // treat as ranged only

function isThrown(it) {
  const nm = (it?.name || it?.item_name || "").toLowerCase();
  const prop = (it?.properties || it?.item_properties || "").toString().toLowerCase();
  return THROWN_NAME.test(nm) || /thrown/.test(prop);
}
function isMeleeBase(it) {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  const nm = (it?.name || it?.item_name || "").toLowerCase();
  if (/ammunition/i.test(ui)) return false;
  if (/shield|armor/i.test(ui)) return false;
  if (RANGED_NAME.test(nm) || DART_ONLY.test(nm)) return false;
  // NOTE: thrown pieces are **not** excluded from melee by design toggle:
  const INCLUDE_THROWN_IN_MELEE = true; // set false if you want them only under Thrown
  if (!INCLUDE_THROWN_IN_MELEE && isThrown(it)) return false;
  return /weapon/i.test(ui) || /club|mace|sword|axe|maul|flail|hammer|spear|staff|whip|scimitar|rapier|dagger|halberd|glaive|pike|morningstar|pick|sickle/.test(
    nm
  );
}
function isRangedBase(it) {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  const nm = (it?.name || it?.item_name || "").toLowerCase();
  if (/ammunition/i.test(ui)) return false;
  if (/shield|armor/i.test(ui)) return false;
  if (DART_ONLY.test(nm)) return true;
  return RANGED_NAME.test(nm) || /ranged/i.test(ui);
}

// ---- read & normalize variants (from window.__MAGIC_VARIANTS__)
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
        // prefer full entry body; textByKind is *only* used if it differs, never as an "As entry" stub
        const entries = Array.isArray(v?.entries) ? v.entries : [];
        const textByKind = v?.textByKind && typeof v.textByKind === "object" ? v.textByKind : {};
        out.push({
          key,
          name,
          appliesTo,
          rarity: normRarity(v?.rarity),
          rarityByValue: v?.rarityByValue || null,
          textByKind,
          entries,                     // keep the full body
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
      console.error("parse MAGIC_VARIANTS failed", e);
      setList([]);
    }
  }, [open]);
  return list;
}

// ---- enhancement & materials
const ENHANCEMENT = {
  values: [0, 1, 2, 3],
  rarityByValue: { 1: "Uncommon", 2: "Rare", 3: "Very Rare" },
  textByKind: {
    weapon: "You have a +{N} bonus to attack and damage rolls made with this magic weapon.",
    armor: "You have a +{N} bonus to Armor Class while wearing this armor.",
    shield: "While holding this shield, you have a +{N} bonus to Armor Class.",
    ammunition: "You have a +{N} bonus to attack and damage rolls made with this ammunition; once it hits, it’s no longer magical.",
  },
};
const MATERIALS = [
  {
    key: "adamantine",
    name: "Adamantine",
    appliesTo: ["weapon", "ammunition", "armor"],
    rarity: "Uncommon",
    textByKind: {
      weapon: "This weapon (or ammunition) is made of adamantine. Whenever it hits an object, the hit is a Critical Hit.",
      ammunition: "This ammunition is made of adamantine. Whenever it hits an object, the hit is a Critical Hit.",
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
const requiresPlus3 = (v) => /\bvorpal\b/i.test(v?.key || v?.name || "");

// ---- options metadata (for variants with pickers)
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

// ---- render text (prefer full entries; fall back to textByKind when actually different)
function renderVariantText(v, cat, opt) {
  if (!v) return "";
  const kind = cat === "melee" || cat === "ranged" || cat === "thrown" ? "weapon" : cat;

  const valueKey = (opt ?? "").toString();
  const dc = v.dcByValue?.[valueKey] ?? v.dcByValue?.[Number(valueKey)] ?? "";
  const atk = v.attackByValue?.[valueKey] ?? v.attackByValue?.[Number(valueKey)] ?? "";

  const baseBody = Array.isArray(v.entries) && v.entries.length ? v.entries.join(" ") : "";
  const kindBody = v.textByKind?.[kind] && v.textByKind[kind].trim() !== "As entry."
    ? v.textByKind[kind]
    : "";

  const body = (kindBody || baseBody || "").replace(/\s+/g, " ").trim();

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

// ---- pull stats from a wide set of field names (best-effort across sources)
function pickDamage(base) {
  const k = Object.keys(base || {});
  const tryKeys = [
    "damage", "item_damage", "damage_dice", "dmg1", "dmg", "weapon_damage",
    "dmg_dice", "dmgDice", "damagePrimary",
  ];
  for (const t of tryKeys) {
    if (base && base[t]) return String(base[t]);
  }
  // look for two fields (dice + type)
  const dice = base?.damage_dice || base?.dmg1 || "";
  const dtype = base?.damage_type || base?.dmgType || base?.damageType || "";
  const versatile = base?.versatile || base?.dmg2 ? `; versatile (${base?.versatile || base?.dmg2})` : "";
  if (dice || dtype) return `${dice} ${String(dtype).toLowerCase()}${versatile}`.trim();
  // sometimes tucked into a display text on UI classification
  if (base?.__cls?.damage) return String(base.__cls.damage);
  return "—";
}
function pickRangeOrAC(base, tab) {
  if (tab === "armor" || tab === "shield") {
    const ac = base?.ac ?? base?.armor_class ?? base?.item_ac ?? base?.__cls?.ac;
    return (ac ? String(ac) : "—");
  }
  // ranged
  const normal = base?.normalRange || base?.range || base?.rng || base?.__cls?.range || "";
  const long = base?.longRange || base?.long || "";
  if (normal && long && normal !== long) return `${normal}/${long}`;
  if (normal) return String(normal);
  return "—";
}
function pickProperties(base) {
  const props = [];
  const srcA = base?.properties || base?.item_properties;
  if (Array.isArray(srcA)) props.push(...srcA);
  if (typeof srcA === "string") props.push(...srcA.split(/[,;]\s*/));
  // masteries often show in cls
  if (base?.__cls?.mastery) props.push(...[].concat(base.__cls.mastery));
  if (base?.__cls?.tags) props.push(...[].concat(base.__cls.tags));
  const clean = props.map((p) => String(p).trim()).filter(Boolean);
  return clean.length ? Array.from(new Set(clean)).join("; ") : "—";
}

// ---- flavor paragraph builder (merge + de-dupe short lines)
function buildFlavor({ base, material, a, b }) {
  const baseShort = String(base?.short_description || base?.summary || "").trim();
  const lines = [];
  if (baseShort) lines.push(baseShort);

  if (material) {
    if (material.key === "adamantine") lines.push("The metal has a deep, matte sheen and feels unusually dense to the touch.");
    if (material.key === "mithral") lines.push("Silvery plates with fine, flexible links move as easily as cloth.");
    if (material.key === "silvered") lines.push("Faint bright glints catch along alchemically bonded silver inlays.");
    if (material.key === "ruidium") lines.push("Veins of crimson crystal pulse with a slow, aquatic thrum.");
  }
  if (a && /dancing/i.test(a.name)) lines.push("Subtle gyroscopic grooves and sigils allow the weapon to hover and weave through the air.");
  if ((a && /flame tongue/i.test(a.name)) || (b && /flame tongue/i.test(b.name))) {
    lines.push("Faint ember-bright runes trace along the edge, smouldering when called to flame.");
  }

  // compact into a single paragraph
  const uniq = [];
  for (const s of lines) if (s && !uniq.includes(s)) uniq.push(s);
  return uniq.length ? uniq.join(" ") : "";
}

// ---- name composer
function extractNameParts(v, opt) {
  if (!v) return { prefix: "", ofPart: "" };
  const meta = optionMetaForVariant(v);
  const optTitle = meta && opt ? meta.titleFmt(opt) : null;
  const n = String(v.name || "").trim();
  const ofIdx = n.toLowerCase().indexOf(" of ");
  if (ofIdx > -1) {
    const ofPart = (optTitle || n.slice(ofIdx + 4)).trim();
    return { prefix: n.slice(0, ofIdx).trim(), ofPart };
  }
  return { prefix: n.replace(/\s*(sword|weapon)\s*$/i, "").trim(), ofPart: optTitle ? optTitle : "" };
}

function composeFinalName({ baseName, bonus, materialName, aParts, bParts }) {
  const prefixes = [];
  if (Number(bonus) > 0) prefixes.push(`+${bonus}`);
  if (materialName) prefixes.push(materialName);

  if (aParts?.prefix) prefixes.push(aParts.prefix);
  // enforce: last enchant as “of …”. If bParts has no ofPart, synthesize from its prefix.
  const forcedOf = (bParts?.ofPart || bParts?.prefix || "").trim();

  // de-dup if A and forcedOf match (e.g., “Flame Tongue” twice)
  const dedupPrefixes = Array.from(new Set(prefixes.filter(Boolean)));

  const head = [dedupPrefixes.join(" ").trim(), baseName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return forcedOf ? `${head} of ${forcedOf}` : head;
}

// ───────────────────────────── component ────────────────────────────────
export default function MagicVariantBuilder({ open, onClose, baseItem, allItems = [], onBuild }) {
  const variants = useMagicVariants(open);

  const defaultTab = useMemo(() => {
    const t = baseItem?.__cls?.uiType || "";
    if (/shield/i.test(t)) return "shield";
    if (/armor/i.test(t)) return "armor";
    if (/ammunition/i.test(t)) return "ammunition";
    if (/ranged/i.test(t)) return "ranged";
    return isThrown(baseItem) ? "thrown" : "melee";
  }, [baseItem]);

  const [tab, setTab] = useState(defaultTab);
  const [base, setBase] = useState(baseItem || null);
  const [bonus, setBonus] = useState(0);
  const [materialKey, setMaterialKey] = useState("");
  const [selAKey, setSelAKey] = useState("");
  const [selAOpt, setSelAOpt] = useState("");
  const [selBKey, setSelBKey] = useState("");
  const [selBOpt, setSelBOpt] = useState("");

  // mundane filter per tab
  const mundaneFilter = useMemo(() => {
    return (it) => {
      const rRaw = String(it?.rarity || it?.item_rarity || "").toLowerCase();
      const mundane = !rRaw || rRaw === "none" || rRaw === "mundane";
      if (!mundane) return false;
      const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";

      if (tab === "melee") return isMeleeBase(it);
      if (tab === "ranged") return isRangedBase(it) && !isThrown(it) && !DART_ONLY.test((it?.name||""));
      if (tab === "thrown") return /weapon/i.test(ui) && isThrown(it);
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

  // materials per tab
  const kindForTab = (t) => (t === "melee" || t === "ranged" || t === "thrown" ? "weapon" : t);
  const materialChoices = useMemo(() => MATERIALS.filter((m) => m.appliesTo.includes(kindForTab(tab))), [tab]);
  const materialText = useMemo(() => {
    if (!materialKey) return "";
    const m = MATERIALS.find((x) => x.key === materialKey);
    return (m?.textByKind?.[kindForTab(tab)]) || "";
  }, [materialKey, tab]);

  // variant list
  const variantChoices = useMemo(() => {
    const appliesKind = kindForTab(tab);
    const list = variants.filter(
      (v) => v.appliesTo.includes(appliesKind) && v.key !== "enhancement" && !MATERIAL_KEYS.has(v.key)
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
  }, [variants, tab]);

  const selA = useMemo(() => variantChoices.find((v) => v.key === selAKey) || null, [variantChoices, selAKey]);
  const selB = useMemo(() => variantChoices.find((v) => v.key === selBKey) || null, [variantChoices, selBKey]);
  useEffect(() => { setSelAOpt(""); }, [selAKey]);
  useEffect(() => { setSelBOpt(""); }, [selBKey]);

  // name
  const composedName = useMemo(() => {
    if (!base) return "";
    const baseName = String(base.name || base.item_name || "Item");
    const materialName = MATERIALS.find((m) => m.key === materialKey)?.name || "";
    const aParts = extractNameParts(selA, selAOpt);
    const bParts = extractNameParts(selB, selBOpt);
    return composeFinalName({ baseName, bonus, materialName, aParts, bParts });
  }, [base, bonus, materialKey, selA, selAOpt, selB, selBOpt]);

  // preview text + rarity
  const preview = useMemo(() => {
    const lines = [];
    const rarities = [];
    const k = kindForTab(tab);

    if (Number(bonus) > 0) {
      lines.push(ENHANCEMENT.textByKind[k].replace("{N}", String(bonus)));
      rarities.push(ENHANCEMENT.rarityByValue[bonus]);
    }
    if (materialKey) {
      const m = MATERIALS.find((x) => x.key === materialKey);
      if (m?.textByKind?.[k]) lines.push(m.textByKind[k]);
      if (m?.rarity) rarities.push(m.rarity);
    }
    function addVariant(v, opt) {
      if (!v) return;
      if (requiresPlus3(v) && Number(bonus) < 3) {
        lines.push("This enchantment requires the item to already be +3 before it may be applied.");
      }
      const blurb = renderVariantText(v, tab, opt);
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
  }, [bonus, materialKey, selA, selAOpt, selB, selBOpt, tab]);

  // flavor paragraph for the big description box
  const flavor = useMemo(
    () => buildFlavor({ base, material: MATERIALS.find((m) => m.key === materialKey), a: selA, b: selB }),
    [base, materialKey, selA, selB]
  );

  // stats panel (bottom)
  const statDamage = useMemo(() => pickDamage(base || {}), [base]);
  const statRangeOrAC = useMemo(() => pickRangeOrAC(base || {}, tab), [base, tab]);
  const statProps = useMemo(() => pickProperties(base || {}), [base]);

  // build payload
  function handleBuild() {
    if (!base) return;
    const obj = {
      name: composedName || (base.name || base.item_name || "Item"),
      rarity: preview.rarity,
      baseId: base.id || base._id || base.item_id || null,
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
      // entries = bullet rules only; flavor stays visual
      entries: preview.lines.filter(Boolean),
      // stats snapshot for downstream card
      __stats: {
        damage: statDamage,
        rangeOrAC: statRangeOrAC,
        properties: statProps,
      },
      // optional flavor for your card’s top description box
      description: flavor,
    };
    onBuild?.(obj);
  }

  // ─────────────────────────────── UI ────────────────────────────────
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
              {/* Base */}
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
                    {ENHANCEMENT.textByKind[kindForTab(tab)].replace("{N}", String(bonus))}
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
                  if (!selA) return null;
                  const desc = renderVariantText(selA, tab, selAOpt);
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
                      {desc && <div className="small mt-1">{desc}</div>}
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
                  if (!selB) return null;
                  const desc = renderVariantText(selB, tab, selBOpt);
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
                      {desc && <div className="small mt-1">{desc}</div>}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Preview */}
            <div className="mt-3">
              <div className="d-flex align-items-center justify-content-between">
                <h5 className="m-0">Preview</h5>
                <span className="badge bg-secondary">{preview.rarity}</span>
              </div>

              <div className="card bg-black border-secondary mt-2">
                <div className="card-body">
                  <div className="fw-semibold mb-2">{composedName || "—"}</div>

                  {/* Big description box */}
                  <div className="mb-2" style={{ background: "#1b1e2a", border: "1px solid #2a2f45", borderRadius: 6, padding: 10, minHeight: 56 }}>
                    {flavor ? (
                      <div>{flavor}</div>
                    ) : (
                      <div className="text-muted">—</div>
                    )}
                  </div>

                  {/* Bulleted rules */}
                  {preview.lines.length === 0 ? (
                    <div className="text-muted">Choose options to see details.</div>
                  ) : (
                    <ul className="mb-2">
                      {preview.lines.map((ln, i) => <li key={i}>{ln}</li>)}
                    </ul>
                  )}

                  {/* Bottom stats panel */}
                  <div className="row g-2">
                    <div className="col-12 col-md-4">
                      <div className="small text-muted">Damage:</div>
                      <div> {statDamage} </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="small text-muted">{tab === "armor" || tab === "shield" ? "AC:" : "Range:"}</div>
                      <div> {statRangeOrAC} </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="small text-muted">Properties:</div>
                      <div> {statProps} </div>
                    </div>
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
