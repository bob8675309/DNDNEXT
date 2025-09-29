// components/MagicVariantBuilder.js
import { useEffect, useMemo, useState } from "react";

/**
 * Classic Magic Variant Builder (logic fixes, same styling)
 * - Tabs: Melee, Ranged, Thrown, Armor, Shield, Ammunition
 * - Melee/Ranged show only mundane bases; Thrown duplicates any melee weapon that has the "thrown" property
 * - Bottom stats panel restored (damage, range/AC, properties incl. versatile)
 * - Name composer: "+N <Material> <A-prefix> <Base> of <B-suffix>" (no duplicate names)
 * - Variant text: prefer textByKind[kind] when it’s real, else fallback to full entries text
 * - Loads multiple variant packs on first open (if window.__MAGIC_VARIANTS__ not present)
 */

// ----------------------------- helpers -----------------------------
const TABS = ["melee", "ranged", "thrown", "armor", "shield", "ammunition"];
const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];
const nice = (s) => String(s || "");
const title = (s) => nice(s).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const normRarity = (r) => {
  const x = nice(r).toLowerCase();
  if (x.includes("legend")) return "Legendary";
  if (x.includes("very")) return "Very Rare";
  if (x.includes("rare")) return "Rare";
  if (x.includes("uncommon")) return "Uncommon";
  if (x.includes("common")) return "Common";
  return "";
};

// Flatten a 5etools-like entries array to plain text
function flattenEntries(entries) {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    if (typeof n === "string") {
      out.push(n.replace(/\{@[^}]+}/g, (m) => {
        const inner = m.slice(2, -1).trim();
        const sp = inner.indexOf(" ");
        if (sp === -1) return inner;
        const tag = inner.slice(0, sp).toLowerCase();
        const rest = inner.slice(sp + 1);
        if (tag === "dc") return `DC ${rest}`;
        if (tag === "spell" || tag === "item" || tag === "condition") return rest.split("|")[0];
        return rest;
      }));
      return;
    }
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === "object") {
      if (n.entries) walk(n.entries);
      if (n.caption) out.push(String(n.caption));
      if (Array.isArray(n.rows)) {
        n.rows.forEach((r) => Array.isArray(r) && out.push(r.join(" — ")));
      }
    }
  };
  walk(entries);
  return out.join("\n\n").trim();
}

/* -------------------------------- materials / +N ------------------------------- */
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

// Recognize thrown
function hasThrownProperty(it) {
  const props = []
    .concat(it?.properties || it?.item_properties || [])
    .map(String)
    .map((s) => s.toLowerCase());
  if (props.some((p) => /thrown/.test(p))) return true;
  const nm = nice(it?.name || it?.item_name).toLowerCase();
  // common thrown-capable melee
  return /(dagger|handaxe|hand axe|javelin|light hammer|spear|trident)/.test(nm);
}

// ------------- robust pack loader (first-open) -------------
function useMagicVariants(open) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!open) return;
    let dead = false;

    async function ensureWindowCatalog() {
      if (typeof window !== "undefined" && Array.isArray(window.__MAGIC_VARIANTS__)) return window.__MAGIC_VARIANTS__;
      // fallback fetch if admin hasn’t injected yet
      try {
        const urls = ["/items/magicvariants.json", "/items/magicvariants.hb-armor-shield.json"];
        const payloads = await Promise.all(
          urls.map(async (u) => {
            try {
              const r = await fetch(u);
              return r.ok ? await r.json() : null;
            } catch { return null; }
          })
        );
        const normalized = [];
        const seen = new Set();
        const looksVariant = (v) =>
          v && typeof v === "object" &&
          (v.name || v.entries || v.textByKind || v.bonusWeapon || v.bonusAc || v.delta || v.mod);
        const collect = (node) => {
          if (!node) return;
          if (Array.isArray(node)) node.forEach(collect);
          else if (looksVariant(node)) normalized.push(node);
          else if (typeof node === "object") Object.values(node).forEach(collect);
        };
        payloads.forEach(collect);

        const merged = [];
        for (const v of normalized) {
          const name = nice(v?.name).trim();
          if (!name) continue;
          const key = (nice(v?.key) || name).toLowerCase().replace(/[^a-z0-9]+/g, "_");
          const k =
            key ||
            `${name.toLowerCase()}::${(Array.isArray(v?.appliesTo) ? v.appliesTo : [])
              .slice()
              .sort()
              .join(",")}`;
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(v);
        }
        if (typeof window !== "undefined") window.__MAGIC_VARIANTS__ = merged;
        return merged;
      } catch {
        return [];
      }
    }

    (async () => {
      const raw = await ensureWindowCatalog();
      if (dead) return;

      // normalize
      const out = [];
      for (const v of raw || []) {
        const name = nice(v?.name).trim();
        if (!name) continue;
        const key = (nice(v?.key) || name).toLowerCase().replace(/[^a-z0-9]+/g, "_");
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
          entries: v?.entries || v?.description || [],
          options: Array.isArray(v?.options) ? v.options : null,
          requires: v?.requires || null,
          attunement: !!v?.attunement,
          cursed: !!v?.cursed,
          dcByValue: v?.dcByValue || null,
          attackByValue: v?.attackBonusByValue || null,
          schools: v?.schools || null,
        });
      }
      if (!dead) setList(out);
    })();

    return () => { dead = true; };
  }, [open]);
  return list;
}

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

// prefer textByKind when it contains real content; otherwise use flattened entries
function textForVariant(v, cat, opt) {
  if (!v) return "";
  const kind = (cat === "melee" || cat === "ranged" || cat === "thrown") ? "weapon" : cat;
  const bodyRaw = v.textByKind?.[kind] || v.textByKind?.weapon || v.textByKind?.armor || "";
  const looksUseless = !bodyRaw || /^\s*as\s+entry\.?\s*$/i.test(bodyRaw.trim());
  const body = looksUseless ? flattenEntries(v.entries) : bodyRaw;

  const valueKey = (opt ?? "").toString();
  const dc = v.dcByValue?.[valueKey] ?? v.dcByValue?.[Number(valueKey)] ?? "";
  const atk = v.attackByValue?.[valueKey] ?? v.attackByValue?.[Number(valueKey)] ?? "";

  return nice(body)
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
  onBuild,
}) {
  const variants = useMagicVariants(open);

  // Default tab
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

  // --- mundane filter + category buckets ---
  const isMundane = (it) => {
    const rr = nice(it.rarity || it.item_rarity).toLowerCase();
    return !rr || rr === "none" || rr === "mundane";
  };
  const isWeaponUi = (it) => /weapon/i.test(it?.__cls?.uiType || it?.__cls?.rawType || "");
  const isArmorUi = (it) => /armor/i.test(it?.__cls?.uiType || it?.__cls?.rawType || "");
  const isShieldUi = (it) => /shield/i.test(it?.__cls?.uiType || it?.__cls?.rawType || "");
  const isAmmoUi = (it) => /ammunition/i.test(it?.__cls?.uiType || it?.__cls?.rawType || "");

  // Ranged-only hints to keep blowgun/dart out of melee
  const RANGED_NAMES = /(bow|crossbow|sling|blowgun|dart|hand crossbow|heavy crossbow|light crossbow)/i;

  const meleeFilter = (it) =>
    isMundane(it) &&
    isWeaponUi(it) &&
    !isAmmoUi(it) &&
    // don’t show obviously ranged-only implements
    !RANGED_NAMES.test(nice(it.name || it.item_name)) &&
    true;

  const rangedFilter = (it) =>
    isMundane(it) &&
    isWeaponUi(it) &&
    !isAmmoUi(it) &&
    // looks like a ranged launcher or explicitly tagged as ranged upstream
    (RANGED_NAMES.test(nice(it.name || it.item_name)) || /ranged/i.test(it?.__cls?.uiType || ""));

  const thrownFilter = (it) =>
    isMundane(it) &&
    isWeaponUi(it) &&
    !isAmmoUi(it) &&
    hasThrownProperty(it);

  const baseFilter = useMemo(() => {
    if (tab === "melee") return meleeFilter;
    if (tab === "ranged") return rangedFilter;
    if (tab === "thrown") return thrownFilter;
    if (tab === "armor") return (it) => isMundane(it) && isArmorUi(it);
    if (tab === "shield") return (it) => isMundane(it) && isShieldUi(it);
    if (tab === "ammunition") return (it) => isMundane(it) && isAmmoUi(it);
    return () => false;
  }, [tab]);

  // Remove weird “trade goods / crafted named curios” from lists
  const looksLikeTradeGood = (it) => {
    const tags = []
      .concat(it?.tags || it?.type_tags || [])
      .map((t) => String(t).toLowerCase());
    const nm = nice(it?.name || it?.item_name).toLowerCase();
    return tags.includes("trade goods") || /\b(river heralds|ceremonial|amber|electrum|pearl)\b/.test(nm);
  };

  const baseChoices = useMemo(() => {
    return (allItems || [])
      .filter(baseFilter)
      .filter((it) => !looksLikeTradeGood(it))
      .sort((a, b) => nice(a.name || a.item_name).localeCompare(nice(b.name || b.item_name)));
  }, [allItems, baseFilter]);

  useEffect(() => {
    if (!baseChoices.length) { setBase(null); return; }
    if (base && baseChoices.find((x) => (x.id || x.name) === (base.id || base.name))) return;
    setBase(baseChoices[0]);
  }, [baseChoices]); // eslint-disable-line

  // Materials / variants per tab
  const normKind = (tab === "melee" || tab === "ranged" || tab === "thrown") ? "weapon" : tab;
  const materialChoices = useMemo(() => MATERIALS.filter((m) => m.appliesTo.includes(normKind)), [normKind]);
  const materialText = useMemo(() => {
    if (!materialKey) return "";
    const m = MATERIALS.find((x) => x.key === materialKey);
    return (m?.textByKind?.[normKind]) || "";
  }, [materialKey, normKind]);

  const variantChoices = useMemo(() => {
    const list = (variants || []).filter(
      (v) => Array.isArray(v.appliesTo) && v.appliesTo.includes(normKind) && v.key !== "enhancement" && !MATERIAL_KEYS.has(v.key)
    );
    const seen = new Set();
    const out = [];
    for (const v of list) {
      const id = (v.key || "") + "::" + v.name;
      if (!seen.has(id)) { seen.add(id); out.push(v); }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [variants, normKind]);

  const selA = useMemo(() => variantChoices.find((v) => v.key === selAKey) || null, [variantChoices, selAKey]);
  const selB = useMemo(() => variantChoices.find((v) => v.key === selBKey) || null, [variantChoices, selBKey]);
  useEffect(() => { setSelAOpt(""); }, [selAKey]);
  useEffect(() => { setSelBOpt(""); }, [selBKey]);

  // --- name compose ---
  function namePartsFor(v, opt) {
    if (!v) return { prefix: "", ofPart: "" };
    const meta = optionMetaForVariant(v);
    const withOpt = meta && opt ? meta.titleFmt(opt) : null;
    const n = v.name;
    const hasOf = /\b of \b/i.test(n);
    if (hasOf) {
      const ofPart = withOpt || n.split(/\b of \b/i)[1];
      return { prefix: "", ofPart: ofPart.trim() };
    }
    return { prefix: (withOpt || n).replace(/\s*(sword|weapon)\s*$/i, "").trim(), ofPart: "" };
  }

  const composedName = useMemo(() => {
    if (!base) return "";
    const baseName = nice(base.name || base.item_name || "Item");
    const pre = [];
    if (Number(bonus) > 0) pre.push(`+${bonus}`);
    if (materialKey) pre.push(MATERIALS.find((m) => m.key === materialKey)?.name || "");

    // rule: A = prefix (unless it’s already “of …”), B = suffix (force “of …” if needed)
    const a = namePartsFor(selA, selAOpt);
    let b = namePartsFor(selB, selBOpt);
    if (b.prefix && !b.ofPart) {
      b = { prefix: "", ofPart: b.prefix }; // force as “of <name>”
    }

    // Avoid duplicate suffix/prefix strings
    const prefixes = [a.prefix].filter(Boolean);
    const ofParts = [b.ofPart || a.ofPart].filter(Boolean);
    const head = [pre.join(" ").trim(), prefixes.join(" ").trim()].filter(Boolean).join(" ").trim();
    const withBase = head ? `${head} ${baseName}` : baseName;
    return ofParts.length ? `${withBase} of ${ofParts.join(" And ")}` : withBase;
  }, [base, bonus, materialKey, selA, selAOpt, selB, selBOpt]);

  // --- preview lines + rarity ---
  const preview = useMemo(() => {
    const lines = [];
    const rarities = [];

    if (Number(bonus) > 0) {
      lines.push(ENHANCEMENT.textByKind[normKind].replace("{N}", String(bonus)));
      rarities.push(ENHANCEMENT.rarityByValue[bonus]);
    }
    if (materialKey) {
      const m = MATERIALS.find((x) => x.key === materialKey);
      if (m?.textByKind?.[normKind]) lines.push(m.textByKind[normKind]);
      if (m?.rarity) rarities.push(m.rarity);
    }
    const addVariant = (v, opt) => {
      if (!v) return;
      if (requiresPlus3(v) && Number(bonus) < 3) {
        lines.push("This enchantment requires the item to already be +3 before it may be applied.");
      }
      const blurb = textForVariant(v, normKind, opt);
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

    return { lines, rarity: highest || "—" };
  }, [bonus, materialKey, selA, selAOpt, selB, selBOpt, normKind]);

  // --- bottom info panel (damage / AC / properties) ---
  const bottomInfo = useMemo(() => {
    const dmg = nice(base?.damage || base?.item_damage || "").trim();
    const versatile = nice(base?.versatile || base?.item_versatile || "").trim();
    const ac = nice(base?.ac || base?.item_ac || "");
    const range = nice(base?.range || base?.item_range || "");
    const props = []
      .concat(base?.properties || base?.item_properties || [])
      .map((p) => String(p))
      .filter(Boolean);
    if (versatile && !props.some((p) => /versatile/i.test(p))) props.push(`Versatile (${versatile})`);
    return {
      damage: dmg || "—",
      acOrRange: (tab === "armor" || tab === "shield") ? (ac || "—") : (range || "—"),
      properties: props.length ? props.join("; ") : "—",
      weight: base?.weight || base?.item_weight || null,
      cost: base?.cost || base?.item_cost || null,
      ui: base?.__cls?.uiType || base?.__cls?.rawType || null,
    };
  }, [base, tab]);

  // Build object to return
  function handleBuild() {
    if (!base) return;
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
      entries: preview.lines.filter(Boolean),
      // pass through for the admin card’s bottom panel
      __basePanel: bottomInfo,
      __isVariant: true,
    };
    onBuild?.(obj);
  }

  // ------------------------------ UI (unchanged visuals) ------------------------------
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
                    {ENHANCEMENT.textByKind[normKind].replace("{N}", String(bonus))}
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
                      {/* no per-item blurb under the selector; kept same as your last good look */}
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

                  {/* Bottom stats panel (restored) */}
                  <div className="small text-muted">
                    <div className="d-flex flex-wrap gap-4">
                      <div><span className="text-light">Damage:</span> {bottomInfo.damage}</div>
                      <div><span className="text-light">{(tab === "armor" || tab === "shield") ? "AC" : "Range"}:</span> {bottomInfo.acOrRange}</div>
                      <div><span className="text-light">Properties:</span> {bottomInfo.properties}</div>
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
