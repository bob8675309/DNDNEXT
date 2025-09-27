// components/MagicVariantBuilder.js
import { useEffect, useMemo, useState } from "react";

/**
 * Classic Magic Variant Builder (with fixes)
 * - Tabs: Melee, Ranged, Thrown, Armor, Shield, Ammunition
 * - Variant catalog can be injected via prop `variantCatalog` (preferred) or read from window
 * - Material dropdown, +N enhancement, Other A / B with options
 * - textByKind now falls back to full entries when kind text is missing/placeholder
 * - Base stats (damage/AC/properties/weight/cost/description) are preserved on build
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

/* -------------------- melee/ranged/thrown heuristics -------------------- */
const RANGED_NAME = /(bow|crossbow|sling|blowgun)/i;
const THROWN_NAME = /(javelin|handaxe|hand axe|throwing|spear|trident|dagger|boomerang|light hammer)/i;

function looksThrown(it) {
  const name = (it?.name || it?.item_name || "").toLowerCase();
  const props = (it?.properties || it?.item_properties || "").toLowerCase();
  return THROWN_NAME.test(name) || /\bthrown\b/.test(props);
}

function isMeleeBase(it) {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  const name = (it?.name || it?.item_name || "").toLowerCase();
  if (looksThrown(it)) return false;
  if (RANGED_NAME.test(name)) return false; // blowgun/dart excluded
  if (/ammunition/i.test(ui)) return false;
  if (/ranged/i.test(ui)) return false;
  return /weapon/i.test(ui) || /club|mace|sword|axe|maul|flail|hammer|spear|staff|whip|scimitar|rapier|dagger|halberd|glaive|pike|morningstar/i.test(name);
}

function isRangedBase(it) {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  const name = (it?.name || it?.item_name || "").toLowerCase();
  if (looksThrown(it)) return false; // keep thrown only in Thrown tab
  if (/ammunition/i.test(ui)) return false;
  return /ranged/i.test(ui) || RANGED_NAME.test(name) || /bow|crossbow|sling/i.test(ui) || /dart\b/.test(name);
}

/* ------------------------------- materials ------------------------------ */
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

/* ------------------------------- +N bonus ------------------------------- */
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

/* -------------------------- option label helpers ------------------------ */
function optionMetaForVariant(v) {
  if (!v) return null;
  const k = v.key || "";
  if (k === "armor_resistance") return { label: "Resistance Type", titleFmt: (opt) => `${title(opt)} Resistance` };
  if (k === "armor_vulnerability") return { label: "Damage Type", titleFmt: (opt) => `${title(opt)} Vulnerability` };
  if (k === "ammunition_slaying") return { label: "Creature Type", titleFmt: (opt) => `Slaying (${title(opt)})` };
  if (k === "enspell_weapon" || k === "enspell_armor") return { label: "Spell Level", titleFmt: (opt) => `Level ${opt} Spell` };
  if (Array.isArray(v.options) && v.options.length) return { label: "Option", titleFmt: (opt) => title(opt) };
  return null;
}

/* ----------------------- load / normalize variants ---------------------- */
function useMagicVariants(open, injected) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!open) return;
    // prefer injected catalog
    if (Array.isArray(injected) && injected.length) {
      setList(injected);
      return;
    }
    try {
      const raw = (typeof window !== "undefined" && window.__MAGIC_VARIANTS__) || [];
      setList(Array.isArray(raw) ? raw : []);
    } catch {
      setList([]);
    }
  }, [open, injected]);
  return list.map((v) => {
    const name = String(v?.name || "").trim();
    if (!name) return null;
    const key = String(v?.key || name).toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const appliesTo = Array.isArray(v?.appliesTo) && v.appliesTo.length ? v.appliesTo : ["weapon", "armor", "shield", "ammunition"];
    return {
      key,
      name,
      appliesTo,
      rarity: normRarity(v?.rarity),
      rarityByValue: v?.rarityByValue || null,
      textByKind: v?.textByKind || {},
      entries: v?.entries || [],
      options: Array.isArray(v?.options) ? v.options : null,
      requires: v?.requires || null,
      attunement: !!v?.attunement,
      cursed: !!v?.cursed,
      dcByValue: v?.dcByValue || null,
      attackByValue: v?.attackBonusByValue || null,
      schools: v?.schools || null
    };
  }).filter(Boolean);
}

// flatten entries utility
function flattenEntries(entries) {
  if (!entries) return "";
  const out = [];
  const walk = (n) => {
    if (!n) return;
    if (typeof n === "string") { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (typeof n === "object") { if (n.entries) walk(n.entries); }
  };
  walk(entries);
  return out.join(" ").trim();
}

// Build a one-line description for a variant selection (with robust fallback)
function textForVariant(v, cat, opt) {
  if (!v) return "";
  const kind = (cat === "melee" || cat === "ranged" || cat === "thrown") ? "weapon" : cat;
  const byKind = (v.textByKind && v.textByKind[kind]) ? String(v.textByKind[kind]).trim() : "";
  const looksPlaceholder = /^as\s+entry\.?$/i.test(byKind) || byKind.length < 8;
  const base = looksPlaceholder || !byKind ? flattenEntries(v.entries) : byKind;

  const valueKey = (opt ?? "").toString();
  const dc = v.dcByValue?.[valueKey] ?? v.dcByValue?.[Number(valueKey)] ?? "";
  const atk = v.attackByValue?.[valueKey] ?? v.attackByValue?.[Number(valueKey)] ?? "";

  return String(base || "")
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

/* -------------------------------- component ------------------------------- */
export default function MagicVariantBuilder({
  open,
  onClose,
  baseItem,
  allItems = [],
  variantCatalog = [],
  onBuild
}) {
  const variants = useMagicVariants(open, variantCatalog);

  // Default tab from base item
  const defaultTab = useMemo(() => {
    const t = baseItem?.__cls?.uiType || "";
    if (/shield/i.test(t)) return "shield";
    if (/armor/i.test(t)) return "armor";
    if (/ammunition/i.test(t)) return "ammunition";
    if (baseItem && looksThrown(baseItem)) return "thrown";
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

  // Mundane filter per tab
  const mundaneFilter = useMemo(() => {
    return (it) => {
      const rarityRaw = String(it.rarity || it.item_rarity || "").toLowerCase();
      const mundane = !rarityRaw || rarityRaw === "none" || rarityRaw === "mundane";
      if (!mundane) return false;
      const ui = it.__cls?.uiType || it.__cls?.rawType || "";
      if (tab === "melee") return /weapon/i.test(ui) && !/ammunition/i.test(ui) && isMeleeBase(it);
      if (tab === "ranged") return /weapon/i.test(ui) && !/ammunition/i.test(ui) && isRangedBase(it);
      if (tab === "thrown") return /weapon/i.test(ui) && looksThrown(it);
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

  // Material choices per tab
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

  // Variant list
  const variantChoices = useMemo(() => {
    const kind = (tab === "melee" || tab === "ranged" || tab === "thrown") ? "weapon" : tab;
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

  // Name compose
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
    return ofParts.length ? `${withBase} of ${ofParts.join(" And ")}` : withBase;
  }, [base, bonus, materialKey, selA, selAOpt, selB, selBOpt]);

  // Preview lines + rarity
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
      if (requiresPlus3(v) && Number(bonus) < 3) {
        lines.push("This enchantment requires the item to already be +3 before it may be applied.");
      }
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

    return { lines, rarity: highest || "—" };
  }, [bonus, materialKey, selA, selAOpt, selB, selBOpt, tab]);

  const descA = selA ? textForVariant(selA, tab, selAOpt) : "";
  const descB = selB ? textForVariant(selB, tab, selBOpt) : "";

  // Build object to return (preserve base stats)
  function handleBuild() {
    if (!base) return;
    const kind = (tab === "melee" || tab === "ranged" || tab === "thrown") ? "weapon" : tab;

    const baseDesc = String(base.description || base.item_description || "").trim();
    const variantDesc = preview.lines.filter(Boolean).map((s) => `• ${s}`).join("\n");
    const description = [baseDesc, variantDesc].filter(Boolean).join("\n\n");

    const obj = {
      name: composedName,
      rarity: preview.rarity,
      category: tab,
      baseId: base.id || base._id,
      baseName: base.name || base.item_name,

      // carry through useful base stats for ItemCard
      type: base.type || base.item_type || "",
      damage: base.damage || base.item_damage || "",
      range: base.range || base.item_range || "",
      ac: base.ac || base.armor_class || base.item_ac || "",
      properties: base.properties || base.item_properties || "",
      weight: base.weight || base.item_weight || "",
      cost: base.cost || base.item_cost || "",

      bonus: Number(bonus) || 0,
      material: materialKey || null,

      variantA: selA?.name || null,
      variantAKey: selA?.key || null,
      variantAOption: selAOpt || null,
      variantB: selB?.name || null,
      variantBKey: selB?.key || null,
      variantBOption: selBOpt || null,

      description,                 // full base + variant blurbs
      item_description: description,
      entries: preview.lines.filter(Boolean)
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

              {/* Rarity */}
              <div className="col-12 col-lg-6">
                <label className="form-label fw-semibold">Current Rarity</label>
                <input className="form-control" value={preview.rarity} readOnly />
              </div>

              {/* Material */}
              <div className="col-12 col-lg-6">
                <label className="form-label fw-semibold">Material (optional)</label>
                <select className="form-select" value={materialKey} onChange={(e) => setMaterialKey(e.target.value)}>
                  <option value="">— none —</option>
                  {materialChoices.map((m) => (<option key={m.key} value={m.key}>{m.name}</option>))}
                </select>
                {materialKey && <div className="form-text text-light mt-1">{materialText}</div>}
              </div>

              {/* +N */}
              <div className="col-12 col-lg-6">
                <label className="form-label fw-semibold">Bonus (optional)</label>
                <div className="d-flex gap-2">
                  <input className="form-control" value="+N" readOnly style={{ maxWidth: 120 }} />
                  <select className="form-select" value={String(bonus)} onChange={(e) => setBonus(Number(e.target.value))}>
                    {ENHANCEMENT.values.map((v) => (<option key={v} value={v}>{v === 0 ? "—" : v}</option>))}
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
                            {selA.options.map((o) => (<option key={String(o)} value={String(o)}>{title(o)}</option>))}
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
                            {selB.options.map((o) => (<option key={String(o)} value={String(o)}>{title(o)}</option>))}
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
                    <ul className="mb-0">
                      {preview.lines.map((ln, i) => <li key={i}>{ln}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer border-secondary">
            <button className="btn btn-outline-light" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!base} onClick={handleBuild}>Build Variant</button>
          </div>
        </div>
      </div>
    </div>
  );
}
