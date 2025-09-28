// components/MagicVariantBuilder.js
import { useEffect, useMemo, useState } from "react";

/**
 * Classic Magic Variant Builder (with fixes)
 * - Tabs: Melee, Ranged, Thrown, Armor, Shield, Ammunition
 * - Materials + +N bonus
 * - Other A / Other B from window.__MAGIC_VARIANTS__
 * - Uses main `entries` if textByKind is missing/“as entry”
 * - Name rule: the *last* chosen enchant becomes an “of …” suffix
 * - Preview shows base stats (damage / range or AC / properties / weight / cost)
 * - Output description = base description + short flavor per pick + rules list
 */

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

// Light heuristics to bucket base items
const THROW_WORDS = /(javelin|throwing|boomerang|trident|handaxe|dagger|spear|light hammer|net|chakram)/i;
const RANGED_WORDS = /(bow|crossbow|sling|blowgun|dart)/i;

function isMeleeBase(it) {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  const name = (it?.name || it?.item_name || "").toLowerCase();
  if (/shield|armor|ammunition/i.test(ui)) return false;
  if (RANGED_WORDS.test(name)) return false;
  if (THROW_WORDS.test(name)) return false; // moved to thrown
  if (/ranged/i.test(ui)) return false;
  return /weapon/i.test(ui) || /club|mace|sword|axe|maul|flail|hammer|spear|staff|whip|scimitar|rapier|dagger|halberd|glaive|pike|morningstar/i.test(
    name
  );
}
function isRangedBase(it) {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  const name = (it?.name || it?.item_name || "").toLowerCase();
  if (/ammunition|armor|shield/i.test(ui)) return false;
  if (THROW_WORDS.test(name)) return false; // thrown removed from ranged list
  return /ranged/i.test(ui) || RANGED_WORDS.test(name) || /bow|crossbow|sling/i.test(ui);
}
function isThrownBase(it) {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  const name = (it?.name || it?.item_name || "").toLowerCase();
  if (/ammunition|armor|shield/i.test(ui)) return false;
  return THROW_WORDS.test(name);
}

// Materials (wording per XDMG/CRCotN)
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
    flavor: "worked in midnight-black adamantine with mirror-bright edges.",
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
    flavor: "a light, rippled sheen betrays the mithral weave.",
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
    flavor: "the edges gleam with a pale, alchemical silver.",
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
    flavor: "ruddy crystals vein the surface like living coral.",
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
  if (Array.isArray(v.options) && v.options.length)
    return { label: "Option", titleFmt: (opt) => title(opt) };
  return null;
}

/* ---------------------- load / normalize variants ---------------------- */
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
          entries: Array.isArray(v?.entries) ? v.entries : (v?.entries ? [v.entries] : []),
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

/* -------- text helpers: prefer textByKind; fallback to main entries ------- */
function joinEntries(entries) {
  return (entries || []).map((s) => String(s || "").trim()).filter(Boolean).join(" ");
}
function looksAsEntry(s) {
  return /^as\s*entry\.?$/i.test(String(s || "").trim());
}
function textForVariant(v, cat, opt) {
  if (!v) return "";
  const kind = cat === "melee" || cat === "ranged" || cat === "thrown" ? "weapon" : cat;

  // try textByKind first
  let body = v.textByKind?.[kind] || v.textByKind?.weapon || v.textByKind?.armor || "";
  if (!body || looksAsEntry(body)) body = ""; // ignore useless “As entry.”

  // if no useful textByKind, fall back to full entries
  if (!body) body = joinEntries(v.entries);

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

/* ----------------- base stats for the preview card ----------------- */
function pick(...vals) {
  for (const v of vals) {
    if (v === 0) return 0;
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}
function baseStatsFromItem(it, tab) {
  const isArmor = tab === "armor";
  const isShield = tab === "shield";
  const isAmmo = tab === "ammunition";
  const isWeapon = !isArmor && !isShield && !isAmmo;

  const damage =
    pick(it?.damage, it?.item_damage, it?.Damage, it?.weapon_damage, it?.dmg) || (isWeapon ? "—" : "");
  const rangeOrAc =
    isArmor || isShield
      ? pick(it?.ac, it?.armor_class, it?.AC, it?.item_ac, "—")
      : pick(it?.range, it?.Range, it?.item_range, "—");
  const properties =
    pick(it?.properties, it?.item_properties, it?.props, it?.mastery, it?.Mastery) || "—";

  const weight = pick(it?.weight, it?.item_weight, it?.Weight, "—");
  const cost = pick(it?.cost, it?.item_cost, it?.Cost, it?.price, "—");
  const type =
    pick(it?.__cls?.uiType, it?.item_type, it?.type, it?.__cls?.rawType, isWeapon ? "Weapon" : "");

  return { damage, rangeOrAc, properties, weight, cost, type };
}

/* --------- small flavor snippets to graft into base description ---------- */
function flavorForMaterial(materialKey) {
  return MATERIALS.find((m) => m.key === materialKey)?.flavor || "";
}
function flavorForVariant(v, opt) {
  const k = (v?.key || "").toLowerCase();
  if (/flame_tongue/.test(k) || /flame tongue/i.test(v?.name || "")) {
    return "Soot-dark runes along the blade pulse with ember-light when the command word is spoken.";
  }
  if (/dancing/.test(k)) {
    return "Subtle gyroscopic etchings promise motion; the weapon thrums faintly when tossed skyward.";
  }
  if (/vanishing/.test(k)) {
    return "Fine tracery shimmers like heat-haze, swallowing sound and silhouette.";
  }
  if (/speed_?armor|speed\b/.test(k)) {
    return "Slim channels along its surface hum with quicksilver vigor.";
  }
  if (/woodwalk/.test(k)) {
    return "Tiny leaf-worked inlays whisper with the breath of nearby trees.";
  }
  if (/adamantine/.test(k)) {
    return "Adamantine hardness gives it a cold, star-metal luster.";
  }
  return "";
}

/* ----------------------------- component ----------------------------- */
export default function MagicVariantBuilder({
  open,
  onClose,
  baseItem,
  allItems = [],
  onBuild,
}) {
  const variants = useMagicVariants(open);

  // Default tab from base item (weapon ⇒ melee by default)
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

  // Mundane filter by tab
  const mundaneFilter = useMemo(() => {
    return (it) => {
      const rRaw = String(it.rarity || it.item_rarity || "").toLowerCase();
      const mundane = !rRaw || rRaw === "none" || rRaw === "mundane";
      if (!mundane) return false;

      if (tab === "melee") return isMeleeBase(it);
      if (tab === "ranged") return isRangedBase(it);
      if (tab === "thrown") return isThrownBase(it);
      if (tab === "armor") return /armor/i.test(it.__cls?.uiType || it.__cls?.rawType || "");
      if (tab === "shield") return /shield/i.test(it.__cls?.uiType || it.__cls?.rawType || "");
      if (tab === "ammunition") return /ammunition/i.test(it.__cls?.uiType || it.__cls?.rawType || "");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseChoices]);

  // Materials per tab
  const kindForTab = (t) => (t === "melee" || t === "ranged" || t === "thrown" ? "weapon" : t);
  const materialChoices = useMemo(() => {
    return MATERIALS.filter((m) => m.appliesTo.includes(kindForTab(tab)));
  }, [tab]);
  const materialText = useMemo(() => {
    if (!materialKey) return "";
    const m = MATERIALS.find((x) => x.key === materialKey);
    return (m?.textByKind?.[kindForTab(tab)]) || "";
  }, [materialKey, tab]);

  // Variant list (exclude enhancement/materials)
  const variantChoices = useMemo(() => {
    const kind = kindForTab(tab);
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
  }, [variants, tab]);

  const selA = useMemo(() => variantChoices.find((v) => v.key === selAKey) || null, [variantChoices, selAKey]);
  const selB = useMemo(() => variantChoices.find((v) => v.key === selBKey) || null, [variantChoices, selBKey]);
  useEffect(() => { setSelAOpt(""); }, [selAKey]);
  useEffect(() => { setSelBOpt(""); }, [selBKey]);

  /* ---------- Name compose: last selected becomes an “of …” suffix ---------- */
  function labelForVariant(v, opt) {
    if (!v) return "";
    const meta = optionMetaForVariant(v);
    const withOpt = meta && opt ? meta.titleFmt(opt) : v.name;
    return withOpt;
  }
  function stripTrailingWeaponWord(s) {
    return String(s || "").replace(/\s*(sword|weapon)\s*$/i, "").trim();
  }
  const composedName = useMemo(() => {
    if (!base) return "";
    const baseName = String(base.name || base.item_name || "Item");
    const pre = [];
    if (Number(bonus) > 0) pre.push(`+${bonus}`);
    if (materialKey) pre.push(MATERIALS.find((m) => m.key === materialKey)?.name || "");

    // determine A (prefix) and B (forced "of …" suffix if present; else A becomes suffix)
    const aLabel = stripTrailingWeaponWord(labelForVariant(selA, selAOpt));
    const bLabel = stripTrailingWeaponWord(labelForVariant(selB, selBOpt));

    const prefixes = [aLabel, bLabel].filter(Boolean);
    let head = baseName;

    // move the last chosen (B if set, else A) to an "of …" suffix if it doesn't already contain "of"
    const last = bLabel || aLabel || "";
    const firstPrefix = (prefixes.length > 1 ? prefixes[0] : "");
    const suffixSource = last.replace(/^\s*of\s+/i, ""); // strip any existing "of"
    const suffix = suffixSource ? `of ${suffixSource}` : "";

    // Build head: "+N Material [firstPrefix] Base"
    const left = [pre.join(" ").trim(), firstPrefix].filter(Boolean).join(" ").trim();
    head = left ? `${left} ${baseName}` : baseName;

    return suffix ? `${head} ${suffix}` : head;
  }, [base, bonus, materialKey, selA, selAOpt, selB, selBOpt]);

  /* ---------------- Preview lines + rarity and flavor description --------------- */
  const preview = useMemo(() => {
    const lines = [];
    const rarities = [];
    const kind = kindForTab(tab);

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
  }, [bonus, materialKey, selA, selAOpt, selB, selBOpt, tab]);

  // flavor description
  const flavoredDescription = useMemo(() => {
    const baseDesc = String(base?.description || base?.item_description || "").trim();
    const flavorBits = [];
    if (materialKey) flavorBits.push(flavorForMaterial(materialKey));
    if (selA) flavorBits.push(flavorForVariant(selA, selAOpt));
    if (selB) flavorBits.push(flavorForVariant(selB, selBOpt));
    const flavor = flavorBits.filter(Boolean).join(" ");
    return [baseDesc, flavor].filter(Boolean).join("\n\n");
  }, [base, materialKey, selA, selAOpt, selB, selBOpt]);

  // Under-select blurbs
  const descKind = kindForTab(tab);
  const descA = selA ? textForVariant(selA, descKind, selAOpt) : "";
  const descB = selB ? textForVariant(selB, descKind, selBOpt) : "";

  // Build object to return
  function handleBuild() {
    if (!base) return;

    const built = {
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
      // Description: flavor + rule bullets
      description: [flavoredDescription, ...preview.lines.map((l) => `• ${l}`)].filter(Boolean).join("\n\n"),
      entries: preview.lines.filter(Boolean),
    };

    // bake in some base stats so the ItemCard can render nicely
    const stats = baseStatsFromItem(base, tab);
    Object.assign(built, {
      damage: stats.damage,
      item_damage: stats.damage,
      range: stats.rangeOrAc,
      item_range: stats.rangeOrAc,
      ac: tab === "armor" || tab === "shield" ? stats.rangeOrAc : undefined,
      properties: stats.properties,
      item_properties: stats.properties,
      weight: stats.weight,
      item_weight: stats.weight,
      cost: stats.cost,
      item_cost: stats.cost,
      type: stats.type,
      item_type: stats.type,
    });

    onBuild?.(built);
  }

  /* -------------------------------- UI -------------------------------- */
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
                <span className="badge bg-secondary">{preview.rarity}</span>
              </div>
              <div className="card bg-black border-secondary mt-2">
                <div className="card-body">
                  <div className="fw-semibold mb-2">{composedName || "—"}</div>
                  {preview.lines.length === 0 ? (
                    <div className="text-muted">Choose options to see details.</div>
                  ) : (
                    <ul className="mb-3">
                      {preview.lines.map((ln, i) => <li key={i}>{ln}</li>)}
                    </ul>
                  )}
                  {/* Base stats readout */}
                  {base && (() => {
                    const st = baseStatsFromItem(base, tab);
                    return (
                      <div className="small text-muted">
                        <div><span className="me-2">Damage:</span>{st.damage || "—"}</div>
                        <div><span className="me-2">{tab==="armor"||tab==="shield"?"AC:":"Range:"}</span>{st.rangeOrAc || "—"}</div>
                        <div><span className="me-2">Properties:</span>{st.properties || "—"}</div>
                        <div className="mt-1">
                          <span className="badge bg-secondary me-2">{st.cost || "— gp"}</span>
                          <span className="badge bg-secondary me-2">{st.weight || "— lbs"}</span>
                          {st.type ? <span className="badge bg-secondary">{st.type}</span> : null}
                        </div>
                  );
                  })()}
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
 