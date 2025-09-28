// components/MagicVariantBuilder.js
import { useEffect, useMemo, useState } from "react";

/**
 * Classic Magic Variant Builder
 * - Tabs: Melee, Ranged, Thrown, Armor, Shield, Ammunition
 * - Strict UI-type filters (no name sniff unless UI-type is missing)
 * - Thrown = own tab; removed from Melee/Ranged lists
 * - Materials (+N) + Other A/B (with options) from Admin-provided catalog
 * - Text fallback: prefer textByKind; if empty/“as entry”, use full entries[]
 * - Result object includes base stats (damage, AC, properties, range, weight, cost)
 * - Name rule: last enchant becomes “of …” (e.g. “+2 Adamantine Dancing Longbow of Flame Tongue”)
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

// ---------------- materials / +N ----------------
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
    ammunition: "You have a +{N} bonus to attack and damage rolls made with this ammunition; once it hits, it’s no longer magical.",
  },
};

const requiresPlus3 = (v) => /\bvorpal\b/i.test(v?.key || v?.name || "");

// ---------------- options meta ----------------
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

// ---------------- thrown / UI-type detection ----------------
const THROWN_NAME = /(javelin|dart|boomerang|chakram|throwing|throwing hammer|light hammer)/i;
const HAS_THROWN = (it) => {
  const props = String(it.properties || it.item_properties || "").toLowerCase();
  return props.includes("thrown") || THROWN_NAME.test(String(it.name || it.item_name || ""));
};
const uiTypeOf = (it) => it?.__cls?.uiType || it?.__cls?.rawType || "";

// strict filters: rely on uiType when present
function isMelee(it) {
  const ui = uiTypeOf(it);
  if (ui) return ui === "Melee Weapon";
  // fallback only if uiType missing
  return /melee/i.test(ui) || /weapon/i.test(ui);
}
function isRanged(it) {
  const ui = uiTypeOf(it);
  if (ui) return ui === "Ranged Weapon";
  return /ranged/i.test(ui);
}
function isArmor(it) {
  const ui = uiTypeOf(it);
  return ui === "Armor";
}
function isShield(it) {
  const ui = uiTypeOf(it);
  return ui === "Shield";
}
function isAmmo(it) {
  const ui = uiTypeOf(it);
  return ui === "Ammunition";
}

// ---------------- variants loader ----------------
function useMagicVariants(open, variantsFromAdmin) {
  const [list, setList] = useState([]);
  // If Admin passes a catalog, prefer it and react to changes
  useEffect(() => {
    if (!open) return;
    if (Array.isArray(variantsFromAdmin) && variantsFromAdmin.length) {
      setList(variantsFromAdmin);
      return;
    }
    try {
      const raw = (typeof window !== "undefined" && window.__MAGIC_VARIANTS__) || [];
      setList(Array.isArray(raw) ? raw : []);
    } catch {
      setList([]);
    }
  }, [open, variantsFromAdmin]);
  return list;
}

// text body: prefer textByKind; when empty/“as entry”, use entries[]
function bodyForVariant(v, kind) {
  const tk = v?.textByKind?.[kind] || v?.textByKind?.weapon || v?.textByKind?.armor || "";
  const looksUseless = !tk || /^\s*as\s+entry\.?\s*$/i.test(tk);
  if (!looksUseless) return tk;
  const arr = Array.isArray(v?.entries) ? v.entries : v?.entries ? [v.entries] : [];
  return arr.map(String).join(" ").trim();
}
function textForVariant(v, cat, opt) {
  if (!v) return "";
  const kind = cat === "melee" || cat === "ranged" || cat === "thrown" ? "weapon" : cat;
  let body = bodyForVariant(v, kind);
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

// small flavor sprinkles for the composed description
const FLAIR = {
  flame_tongue: "Faint ember-bright runes trace along the edge, smouldering when called to flame.",
  dancing: "Subtle gyroscopic grooves and sigils allow the weapon to hover and weave through the air.",
  adamantine: "The metal has a deep, matte sheen and feels unusually dense to the touch.",
  silvered: "A pale gleam betrays a fine alchemical silvering worked into the steel.",
};

// ---------------- component ----------------
export default function MagicVariantBuilder({
  open,
  onClose,
  baseItem,
  allItems = [],
  variantsCatalog = [], // NEW: Admin passes merged variants directly
  onBuild,
}) {
  const variants = useMagicVariants(open, variantsCatalog);

  // default tab from base
  const defaultTab = useMemo(() => {
    const t = uiTypeOf(baseItem);
    if (/Shield/i.test(t)) return "shield";
    if (/Armor/i.test(t)) return "armor";
    if (/Ammunition/i.test(t)) return "ammunition";
    if (/Ranged Weapon/i.test(t)) return HAS_THROWN(baseItem) ? "thrown" : "ranged";
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

  // mundane filter
  const mundaneFilter = useMemo(() => {
    return (it) => {
      const rRaw = String(it.rarity || it.item_rarity || "").toLowerCase();
      const mundane = !rRaw || rRaw === "none" || rRaw === "mundane";
      if (!mundane) return false;

      // Hard filter by UI type to keep “Trade Goods” out
      if (tab === "melee") return isMelee(it) && !HAS_THROWN(it);
      if (tab === "ranged") return isRanged(it) && !HAS_THROWN(it) && !isAmmo(it);
      if (tab === "thrown") return (isMelee(it) || isRanged(it)) && HAS_THROWN(it);
      if (tab === "armor") return isArmor(it);
      if (tab === "shield") return isShield(it);
      if (tab === "ammunition") return isAmmo(it);
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

  // materials by tab
  const matKind = tab === "melee" || tab === "ranged" || tab === "thrown" ? "weapon" : tab;
  const materialChoices = useMemo(() => MATERIALS.filter((m) => m.appliesTo.includes(matKind)), [matKind]);
  const materialText = useMemo(() => {
    if (!materialKey) return "";
    const m = MATERIALS.find((x) => x.key === materialKey);
    return (m?.textByKind?.[matKind]) || "";
  }, [materialKey, matKind]);

  // variants list
  const variantChoices = useMemo(() => {
    const kind = matKind; // weapon/armor/shield/ammunition
    const list = variants.filter(
      (v) => Array.isArray(v.appliesTo) ? v.appliesTo.includes(kind) : true
    ).filter((v) => v.key !== "enhancement" && !MATERIAL_KEYS.has(v.key));
    const seen = new Set();
    const out = [];
    for (const v of list) {
      const id = (v.key || v.name) + "::" + (v.name || "");
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(v);
    }
    return out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [variants, matKind]);

  const selA = useMemo(() => variantChoices.find((v) => v.key === selAKey) || null, [variantChoices, selAKey]);
  const selB = useMemo(() => variantChoices.find((v) => v.key === selBKey) || null, [variantChoices, selBKey]);

  useEffect(() => { setSelAOpt(""); }, [selAKey]);
  useEffect(() => { setSelBOpt(""); }, [selBKey]);

  // name composition (last enchant becomes "of …")
  function labelFor(v, opt) {
    if (!v) return "";
    const meta = optionMetaForVariant(v);
    const optLabel = meta && opt ? meta.titleFmt(opt) : null;
    return optLabel || v.name || "";
  }
  const composedName = useMemo(() => {
    if (!base) return "";
    const baseName = String(base.name || base.item_name || "Item");
    const pre = [];
    if (Number(bonus) > 0) pre.push(`+${bonus}`);
    if (materialKey) pre.push(MATERIALS.find((m) => m.key === materialKey)?.name || "");

    const a = labelFor(selA, selAOpt);
    const b = labelFor(selB, selBOpt);

    const prefixPieces = [a, b].filter(Boolean).map((s) => s).filter((s) => !/\bof\b/i.test(s));
    const suffixCandidate = b || a || "";
    const suffix = suffixCandidate && !/\bof\b/i.test(suffixCandidate) ? suffixCandidate : suffixCandidate.replace(/.*\bof\b\s*/i, "");
    const left = [pre.join(" ").trim(), prefixPieces.join(" ").trim()].filter(Boolean).join(" ").trim();
    const withBase = left ? `${left} ${baseName}` : baseName;
    return suffix ? `${withBase} of ${suffix.replace(/^of\s+/i, "").trim()}` : withBase;
  }, [base, bonus, materialKey, selA, selAOpt, selB, selBOpt]);

  // preview + rarity
  const preview = useMemo(() => {
    const lines = [];
    const rarities = [];
    const kind = matKind;

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
  }, [bonus, materialKey, selA, selAOpt, selB, selBOpt, matKind]);

  // base stat helpers for the result object and on-screen preview chips
  function baseStat(it, ...keys) {
    for (const k of keys) {
      const v = it?.[k];
      if (v != null && v !== "") return v;
    }
    return "";
  }

  // Build result
  function handleBuild() {
    if (!base) return;
    const baseName = base.name || base.item_name || "Item";

    // pull base stats so the preview card has real numbers
    const damage = baseStat(base, "damage", "item_damage");
    const range = baseStat(base, "range", "item_range");
    const ac = baseStat(base, "ac", "armor_class", "item_ac");
    const properties = baseStat(base, "properties", "item_properties");
    const weight = baseStat(base, "weight", "item_weight");
    const cost = baseStat(base, "cost", "item_cost");
    const type = baseStat(base, "type", "item_type") || uiTypeOf(base);

    // composed rules text (bullet list) + base flavor + light flair
    const flavor = String(base.description || base.item_description || "").trim();
    const flairBits = [];
    if (materialKey) flairBits.push(FLAIR[materialKey]);
    [selA, selB].forEach((v) => {
      const k = (v?.key || "").toLowerCase();
      if (FLAIR[k]) flairBits.push(FLAIR[k]);
    });
    const flavorPlus = [flavor, ...flairBits.filter(Boolean)].filter(Boolean).join("\n\n");
    const rules = preview.lines.filter(Boolean).map((s) => `• ${s}`).join("\n");

    const description = [flavorPlus, rules].filter(Boolean).join("\n\n");

    const obj = {
      id: `VAR-${Date.now()}`,
      name: composedName,
      rarity: preview.rarity,
      type,
      // keep the base type/category flags handy
      category: tab, // melee | ranged | thrown | armor | shield | ammunition

      // copy base stats so ItemCard can render a complete line
      damage,
      range,
      ac,
      properties,
      weight,
      cost,

      // text
      description,
      item_description: description,

      // trace back to base
      baseId: base.id || base._id,
      baseName,

      // structured knobs (for downstream use, if any)
      bonus: Number(bonus) || 0,
      material: materialKey || null,
      variantA: selA?.name || null,
      variantAKey: selA?.key || null,
      variantAOption: selAOpt || null,
      variantB: selB?.name || null,
      variantBKey: selB?.key || null,
      variantBOption: selBOpt || null,

      // convenience for auditing
      entries: preview.lines.filter(Boolean),
      __isVariant: true,
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
                    {ENHANCEMENT.textByKind[matKind].replace("{N}", String(bonus))}
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
                  const desc = textForVariant(selA, matKind, selAOpt);
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
                  const desc = textForVariant(selB, matKind, selBOpt);
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

                  {/* Base stats at a glance */}
                  <div className="small text-muted">
                    {matKind === "weapon" && (base?.damage || base?.item_damage) ? <>Damage: <span className="text-light">{base?.damage || base?.item_damage}</span></> : null}
                    {matKind === "armor" && (base?.ac || base?.armor_class || base?.item_ac) ? <>AC: <span className="text-light">{base?.ac || base?.armor_class || base?.item_ac}</span></> : null}
                    {base?.properties || base?.item_properties ? <><br />Properties: <span className="text-light">{base?.properties || base?.item_properties}</span></> : null}
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
