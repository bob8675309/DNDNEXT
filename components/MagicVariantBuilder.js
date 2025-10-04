import { useEffect, useMemo, useState } from "react";

/**
 * Magic Variant Builder (classic UI + upgrades)
 * - +N bonuses *apply* to stat row (weapons add to damage; armor/shield add to AC)
 * - Versatile parenthetical damage also gets +N (e.g., "versatile (1d10+2)")
 * - “Blend Description” produces a new sensory-forward paragraph every click
 */

const TABS = ["melee", "ranged", "thrown", "armor", "shield", "ammunition"];
const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];

const title = (s) =>
  String(s || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const normRarity = (r) => {
  const x = String(r || "").toLowerCase();
  if (x.includes("legend")) return "Legendary";
  if (x.includes("very")) return "Very Rare";
  if (x.includes("rare")) return "Rare";
  if (x.includes("uncommon")) return "Uncommon";
  if (x.includes("common")) return "Common";
  return "";
};

const DMG = {
  P: "piercing", S: "slashing", B: "bludgeoning",
  R: "radiant", N: "necrotic", F: "fire", C: "cold",
  L: "lightning", A: "acid", T: "thunder", Psn: "poison",
  Psy: "psychic", Frc: "force"
};
const PROP = { L:"Light", F:"Finesse", H:"Heavy", R:"Reach", T:"Thrown", V:"Versatile", "2H":"Two-Handed", A:"Ammunition", LD:"Loading", S:"Special", RLD:"Reload" };
const stripTag = (s) => String(s || "").split("|")[0];

/* ------------------------------- stats ------------------------------- */
function getPropCodes(it) {
  const raw = [].concat(it?.property || it?.properties || []);
  const codes = raw
    .map((p) => (typeof p === "string" ? p : p?.uid || p?.abbreviation || p?.abbrev || ""))
    .map((s) => String(s).split("|")[0].trim())
    .filter(Boolean);

  const txt = String(it?.propertiesText || "").toLowerCase();
  if (txt.includes("versatile")) codes.push("V");
  if (txt.includes("thrown")) codes.push("T");
  if (txt.includes("ammunition")) codes.push("A");
  if (txt.includes("loading")) codes.push("LD");
  if (txt.includes("two-handed") || /\b2h\b/i.test(it?.propertiesText || "")) codes.push("2H");
  if (txt.includes("reach")) codes.push("R");
  return Array.from(new Set(codes));
}
const buildDamageText = (it) => {
  const props = getPropCodes(it);
  const d1 = it?.dmg1;
  const dt = it?.dmgType;
  const d2 = it?.dmg2;
  const base = d1 ? `${d1} ${DMG[dt] || dt || ""}`.trim() : "";
  const vers = props.includes("V") && d2 ? `versatile (${d2})` : "";
  return [base, vers].filter(Boolean).join("; ");
};
const buildRangeText = (it) => {
  const props = getPropCodes(it);
  const r = it?.rangeText || (it?.range ? String(it.range).replace(/ft\.?$/i, "").trim() : "");
  if (props.includes("T")) return r ? `Thrown ${r} ft.` : "Thrown";
  return r ? `${r} ft.` : "";
};
const buildPropsText = (it) => {
  const props = getPropCodes(it).map((p) => PROP[p] || p);
  const mastery = Array.isArray(it?.mastery) ? it.mastery.map(stripTag) : [];
  const base = (it?.propertiesText && !/^\s*$/.test(it.propertiesText))
    ? it.propertiesText
    : props.join(", ");
  return base + (mastery.length ? (base ? "; " : "") + `Mastery: ${mastery.join(", ")}` : "");
};

/* +N application helpers */
function applyBonusToDamageText(damageText, bonus) {
  if (!bonus || !damageText) return damageText || "";
  let t = damageText;
  // Primary dice (first occurrence like 1d8, 2d6, etc.)
  t = t.replace(/\b(\d+d\d+)(?!\s*[+\-])/i, (_, dice) => `${dice}+${bonus}`);
  // Versatile or other parenthetical dice: (1d10) -> (1d10+N) if not already +
  t = t.replace(/\((\s*\d+d\d+\s*)(?![+\-])/gi, (_, inner) => `(${inner}+${bonus}`);
  return t;
}
function applyBonusToAC(acText, bonus) {
  if (!bonus) return acText || "";
  const n = parseInt(acText, 10);
  if (Number.isFinite(n)) return String(n + bonus);
  return `${acText} (+${bonus})`;
}

/* -------------------------- light heuristics ------------------------- */
const RANGED_NAME = /(bow|crossbow|sling|blowgun)/i;
const FIREARM_NAME = /(pistol|rifle|musket|revolver|firearm|shotgun|carbine|antimatter)/i;

function hasDamage(it) {
  return Boolean(it?.dmg1 || it?.damageText);
}
function isTradeGood(it) {
  const t = (it?.__cls?.uiType || "").toLowerCase();
  const abbr = String(it?.type || it?.item_type || "").toUpperCase();
  return t === "trade goods" || abbr === "TG";
}
function isFuture(it) {
  return (it?.__cls?.uiType || "") === "Future";
}
function isThrownWeapon(it) {
  return getPropCodes(it).includes("T");
}
function isRangedWeapon(it) {
  const name = String(it?.name || it?.item_name || "");
  const props = getPropCodes(it);
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  if (/ranged/i.test(ui)) return true;
  if (RANGED_NAME.test(name)) return true;
  if (FIREARM_NAME.test(name)) return true;
  if (props.includes("A")) return true; // Ammunition
  return false;
}
function isMeleeWeapon(it) {
  const name = String(it?.name || it?.item_name || "");
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  if (/melee/i.test(ui)) return true;
  if (/weapon/i.test(ui) && !isRangedWeapon(it)) return true;
  if (RANGED_NAME.test(name) || FIREARM_NAME.test(name)) return false;
  return false;
}

/* ------------------------------ variants ----------------------------- */
const MATERIALS = [
  {
    key: "adamantine",
    name: "Adamantine",
    appliesTo: ["weapon", "ammunition", "armor"],
    rarity: "Uncommon",
    textByKind: {
      weapon: "This weapon (or ammunition) is made of adamantine. Whenever it hits an object, the hit is a Critical Hit.",
      ammunition: "This ammunition is made of adamantine. Whenever it hits an object, the hit is a Critical Hit.",
      armor: "While you wear this armor, any Critical Hit against you becomes a normal hit."
    }
  },
  {
    key: "mithral",
    name: "Mithral",
    appliesTo: ["armor"],
    rarity: "Uncommon",
    textByKind: {
      armor: "Mithral is a light, flexible metal. If the base armor normally imposes Disadvantage on Dexterity (Stealth) checks or has a Strength requirement, the mithral version doesn’t."
    }
  },
  {
    key: "silvered",
    name: "Silvered",
    appliesTo: ["weapon"],
    rarity: "Common",
    textByKind: {
      weapon: "An alchemical process has bonded silver to this magic weapon. When you score a Critical Hit against a shape-shifted creature, roll one additional damage die of the weapon’s normal damage type."
    }
  },
  {
    key: "ruidium",
    name: "Ruidium",
    appliesTo: ["weapon", "armor"],
    rarity: "Very Rare",
    textByKind: {
      weapon: "You can breathe water and have a Swim Speed equal to your Speed. A creature you hit takes an extra 2d6 Psychic damage. On a natural 1 with this weapon, make a DC 20 Charisma save or gain 1 level of Exhaustion.",
      armor: "You have Resistance to Psychic damage, a Swim Speed equal to your Speed, and can breathe water. On a natural 1 on a saving throw while wearing this, make a DC 15 Charisma save or gain 1 level of Exhaustion."
    }
  }
];
const MATERIAL_KEYS = new Set(MATERIALS.map((m) => m.key));

const ENHANCEMENT = {
  values: [0, 1, 2, 3],
  rarityByValue: { 1: "Uncommon", 2: "Rare", 3: "Very Rare" },
  textByKind: {
    weapon: "You have a +{N} bonus to attack and damage rolls made with this magic weapon.",
    armor: "You have a +{N} bonus to Armor Class while wearing this armor.",
    shield: "While holding this shield, you have a +{N} bonus to Armor Class.",
    ammunition: "You have a +{N} bonus to attack and damage rolls made with this ammunition; once it hits, it’s no longer magical."
  }
};
const requiresPlus3 = (v) => /\bvorpal\b/i.test(v?.key || v?.name || "");

/* variant option label helpers */
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

/* load / normalize variants */
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
        const appliesTo = Array.isArray(v?.appliesTo) && v.appliesTo.length
          ? v.appliesTo
          : ["weapon", "armor", "shield", "ammunition"];
        out.push({
          key,
          name,
          appliesTo,
          rarity: normRarity(v?.rarity),
          rarityByValue: v?.rarityByValue || null,
          textByKind: v?.textByKind || {},
          entries: v?.entries || null,
          options: Array.isArray(v?.options) ? v.options : null,
          requires: v?.requires || null,
          attunement: !!v?.attunement,
          cursed: !!v?.cursed,
          dcByValue: v?.dcByValue || null,
          attackByValue: v?.attackBonusByValue || null,
          schools: v?.schools || null
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

function canonicalKindFromTab(tab) {
  return tab === "melee" || tab === "ranged" || tab === "thrown" ? "weapon" : tab;
}

function textForVariant(v, cat, opt) {
  if (!v) return "";
  const kind = canonicalKindFromTab(cat);
  let body = v.textByKind?.[kind];

  const looksAsEntry = (s) => /^\s*as\s+entry\.?\s*$/i.test(String(s || ""));
  if (!body || looksAsEntry(body)) {
    const flat = Array.isArray(v.entries) ? v.entries.join(" ") : v.entries;
    body = flat || v.textByKind?.weapon || v.textByKind?.armor || "";
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

/* ----------------------------- component ----------------------------- */
export default function MagicVariantBuilder({
  open,
  onClose,
  baseItem,
  allItems = [],
  onBuild
}) {
  const variants = useMagicVariants(open);

  const defaultTab = useMemo(() => {
    const t = baseItem?.__cls?.uiType || baseItem?.__cls?.rawType || "";
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

  const mundaneFilter = useMemo(() => {
    return (it) => {
      const rRaw = String(it.rarity || it.item_rarity || "").toLowerCase();
      const mundane = !rRaw || rRaw === "none" || rRaw === "mundane";
      if (!mundane) return false;

      if (isFuture(it)) return false;
      if (isTradeGood(it)) return false;

      const ui = it.__cls?.uiType || it.__cls?.rawType || "";

      if (tab === "armor") return /armor/i.test(ui);
      if (tab === "shield") return /shield/i.test(ui);
      if (tab === "ammunition") return /ammunition/i.test(ui);

      if (!hasDamage(it)) return false;

      if (tab === "melee") {
        return /weapon/i.test(ui) && !/ammunition/i.test(ui) && isMeleeWeapon(it);
      }
      if (tab === "ranged") {
        return /weapon/i.test(ui) && isRangedWeapon(it) && !isThrownWeapon(it);
      }
      if (tab === "thrown") {
        return /weapon/i.test(ui) && isThrownWeapon(it);
      }
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

  const materialChoices = useMemo(() => {
    const kind = canonicalKindFromTab(tab);
    return MATERIALS.filter((m) => m.appliesTo.includes(kind));
  }, [tab]);
  const materialText = useMemo(() => {
    if (!materialKey) return "";
    const kind = canonicalKindFromTab(tab);
    const m = MATERIALS.find((x) => x.key === materialKey);
    return (m?.textByKind?.[kind]) || "";
  }, [materialKey, tab]);

  const variantChoices = useMemo(() => {
    const kind = canonicalKindFromTab(tab);
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

  function namePartsFor(v, opt) {
    if (!v) return { prefix: "", ofPart: "" };
    const meta = optionMetaForVariant(v);
    const ofWithOpt = meta && opt ? meta.titleFmt(opt) : null;
    const n = v.name;
    if (/\b of \b/i.test(n)) {
      const ofPart = ofWithOpt || n.split(/\b of \b/i)[1];
      return { prefix: "", ofPart: (ofPart || "").trim() };
    }
    return { prefix: n.replace(/\s*(sword|weapon|shield|armor)\s*$/i, "").trim(), ofPart: "" };
  }

  const composedName = useMemo(() => {
    if (!base) return "";
    const baseName = String(base.name || base.item_name || "Item");
    const pre = [];
    if (Number(bonus) > 0) pre.push(`+${bonus}`);
    if (materialKey) pre.push(MATERIALS.find((m) => m.key === materialKey)?.name || "");

    const a = namePartsFor(selA, selAOpt);
    const b = namePartsFor(selB, selBOpt);

    const prefixes = [a.prefix].filter(Boolean).join(" ").trim();
    const head = [pre.join(" ").trim(), prefixes].filter(Boolean).join(" ").trim();
    const withBase = head ? `${head} ${baseName}` : baseName;

    const ofList = [a.ofPart, b.ofPart || (selB ? (optionMetaForVariant(selB)?.titleFmt?.(selBOpt) || selB.name) : "")]
      .filter(Boolean);

    const uniq = [];
    for (const s of ofList) {
      const sl = s.toLowerCase();
      if (!uniq.find((x) => x.toLowerCase() === sl)) uniq.push(s);
    }

    return uniq.length ? `${withBase} of ${uniq.join(" And ")}` : withBase;
  }, [base, bonus, materialKey, selA, selAOpt, selB, selBOpt]);

  /* preview body + rarity */
  const preview = useMemo(() => {
    const lines = [];
    const rarities = [];
    const kind = canonicalKindFromTab(tab);

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

  /* stat row (apply +N) */
  const kindForBase = canonicalKindFromTab(tab);
  const baseDamage = base ? (base.damageText || buildDamageText(base)) : "";
  const baseRange  = base ? (base.rangeText  || buildRangeText(base))  : "";
  const baseProps  = base ? buildPropsText(base) : "";
  const baseAC     = base && /armor|shield/i.test(base?.__cls?.uiType || "") ? (base.ac ?? "") : "";

  const statDamage = kindForBase === "weapon" ? applyBonusToDamageText(baseDamage, bonus) : "";
  const statRange  = kindForBase === "weapon" ? baseRange : "";
  const statAC     = (kindForBase === "armor" || kindForBase === "shield") ? applyBonusToAC(String(baseAC || ""), bonus) : "";
  const statProps  = baseProps;

  /* Blend Description — varied & sensory */
  const [blended, setBlended] = useState("");
  useEffect(() => setBlended(""), [base, materialKey, selAKey, selBKey, selAOpt, selBOpt, bonus]);

  function pick(a){ return a[Math.floor(Math.random()*a.length)] || ""; }

  function handleBlend() {
    const bits = [];
    const baseName = String(base?.name || base?.item_name || "").toLowerCase();

    const openings = [
      `Made for wandering heroes, the ${baseName} ${pick(["carries a straightforward design", "favors balance over flourish", "is built for grit and daily use", "shows honest, travel-worn craft"])}.`,
      `Forged for long miles, the ${baseName} ${pick(["sits sure in the hand", "keeps tidy geometry", "trades ornament for reliability", "wears a workmanlike profile"])}.`,
      `A working ${baseName} with ${pick(["clean lines", "honest weight", "well-kept edges", "no-nonsense shaping")]}.`
    ];

    const materials = {
      adamantine: [
        "Forged of adamantine, its surface shows a dense, dusk-dark sheen and surprising heft.",
        "The adamantine core lends each edge a muted, stone-like ring on impact."
      ],
      mithral: [
        "Wrought of mithral, it feels quick in the hand and light across the body.",
        "Thin mithral links flex smoothly, whispering when you move."
      ],
      silvered: [
        "Silvered accents catch and scatter light in a cold, glassy way.",
        "Fine alchemical silver lines brighten along the ridges."
      ],
      ruidium: [
        "Veins of ruidium pulse faintly beneath the surface, unsettling to behold.",
        "Hairline crimson seams show through the finish like slow-beating embers."
      ],
      default: [
        "Careful polish leaves the metal clean and bright without gaudy flourish.",
        "Oiled leather fittings give a warm, steady scent built to last."
      ]
    };

    const variantHints = (v) => {
      if (!v) return [];
      const n = v.name.toLowerCase();
      if (/flame tongue/.test(n)) return ["Runes along the edge smoulder when heat is called."];
      if (/dancing/.test(n))     return ["Subtle gyroscopic grooves let the weapon hover and weave."];
      if (/warning/.test(n))     return ["A faint, steady thrumming warns a heartbeat before danger."];
      if (/sharpness/.test(n))   return ["The edge gleams with a glassy, preternatural keenness."];
      if (/vorpal/.test(n))      return ["In quiet rooms the blade seems to drink the sound around it."];
      return [`${v.name} markings are etched discreetly into the steel.`];
    };

    const matBlock = materials[materialKey] || materials.default;

    bits.push(pick(openings));
    bits.push(pick(matBlock));
    variantHints(selA).forEach((s) => bits.push(s));
    variantHints(selB).forEach((s) => bits.push(s));

    const text = bits.join(" ")
      .replace(/\s+/g, " ")
      .replace(/(^\w)/, (m) => m.toUpperCase());

    setBlended(text);
  }

  /* Build object returned to Admin — pass exactly what the preview shows */
  function handleBuild() {
    if (!base) return;
    const obj = {
      name: composedName,
      rarity: preview.rarity,
      baseId: base.id || base._id,
      baseName: base.name || base.item_name,
      category: tab,
      bonus: Number(bonus) || 0,
      material: materialKey || null,
      variantA: selA?.name || null,
      variantAKey: selA?.key || null,
      variantAOption: selAOpt || null,
      variantB: selB?.name || null,
      variantBKey: selB?.key || null,
      variantBOption: selBOpt || null,
      entries: preview.lines.filter(Boolean),
      flavor: blended || "",
      damageText: statDamage || "",
      rangeText:  statRange  || "",
      propertiesText: statProps || "",
      ac: statAC || ""
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
                    setBlended("");
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
                    {ENHANCEMENT.textByKind[canonicalKindFromTab(tab)].replace("{N}", String(bonus))}
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
                  const desc = selA ? textForVariant(selA, tab, selAOpt) : "";
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
                  const desc = selB ? textForVariant(selB, tab, selBOpt) : "";
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
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-secondary">{preview.rarity}</span>
                  <button className="btn btn-sm btn-outline-light" onClick={handleBlend}>⟳ Blend Description</button>
                </div>
              </div>
              <div className="card bg-black border-secondary mt-2">
                <div className="card-body">
                  <div className="fw-semibold mb-2">{composedName || "—"}</div>

                  {!!blended && (
                    <div className="mb-2">{blended}</div>
                  )}

                  {preview.lines.length === 0 ? (
                    <div className="text-muted">Choose options to see details.</div>
                  ) : (
                    <ul className="mb-2">
                      {preview.lines.map((ln, i) => <li key={i}>{ln}</li>)}
                    </ul>
                  )}

                  {/* Stat row */}
                  <div className="row g-3 small text-muted">
                    <div className="col-12 col-md-4">
                      <div><span className="text-light">Damage:</span> {statDamage || "—"}</div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div>
                        <span className="text-light">{/armor|shield/i.test(base?.__cls?.uiType || "") ? "AC:" : "Range:"}</span>{" "}
                        {statRange || statAC || "—"}
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div><span className="text-light">Properties:</span> {statProps || "—"}</div>
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
