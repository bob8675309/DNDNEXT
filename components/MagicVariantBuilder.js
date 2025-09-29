import { useEffect, useMemo, useState } from "react";

/**
 * Classic Magic Variant Builder (behavior fixes, same look)
 * - Tabs: Melee, Ranged, Thrown, Armor, Shield, Ammunition
 * - Base = mundane only, filtered properly by tab
 * - +N enhancement and Materials
 * - Variants merged from window.__MAGIC_VARIANTS__ (loaded by admin)
 * - Footer shows Damage, Range, Properties (incl. Versatile & Mastery)
 * - Naming: last variant becomes "of X" if needed, no duplicates
 * - Thrown weapons appear in both Melee and Thrown
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

const dmgTypeWord = (ch) => ({ B: "bludgeoning", P: "piercing", S: "slashing" }[String(ch || "").toUpperCase()] || "");

const PROPERTY_LABELS = {
  A: "Ammunition",
  AF: "Ammunition",
  BF: "Burst Fire",
  F: "Finesse",
  H: "Heavy",
  L: "Light",
  LD: "Loading",
  R: "Reach",
  RLD: "Reload",
  T: "Thrown",
  "2H": "Two-Handed",
  V: "Versatile",
  // S = “Special” usually explained by mastery text in 2024; we surface as “Special”
  S: "Special",
};

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

// Options metadata
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
        const appliesTo = Array.isArray(v?.appliesTo) && v.appliesTo.length ? v.appliesTo : ["weapon", "armor", "shield", "ammunition"];
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
  if (!body) {
    // fallback to “entries” first line if present in pack payloads
    const entry = Array.isArray(v.entries) && v.entries.length ? String(v.entries[0]) : "";
    body = entry;
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

// ---------------------- item stat extraction ----------------------
function isWeapon(it) { return !!it?.weapon || /weapon/i.test(it?.__cls?.uiType || ""); }
function isArmor(it) { return /armor/i.test(it?.__cls?.uiType || ""); }
function isShield(it){ return /shield/i.test(it?.__cls?.uiType || ""); }
function isAmmo(it)  { return /ammunition/i.test(it?.__cls?.uiType || ""); }

function hasThrown(it) {
  const props = Array.isArray(it?.property) ? it.property : [];
  return props.includes("T");
}

function weaponDamageText(it) {
  if (it?.damageText) return String(it.damageText);
  const d1 = it?.dmg1, d2 = it?.dmg2, typ = dmgTypeWord(it?.dmgType);
  if (!d1 && !typ) return "";
  let out = `${d1 || ""} ${typ}`.trim();
  if (d2) out += `; versatile (${d2})`;
  return out;
}
function weaponRangeText(it) {
  return it?.rangeText || "";
}
function weaponPropertiesText(it) {
  if (it?.propertiesText) return String(it.propertiesText);
  const props = Array.isArray(it?.property) ? it.property : [];
  const labels = props.map((p) => PROPERTY_LABELS[p] || p).filter(Boolean);
  const mastery = Array.isArray(it?.mastery) && it.mastery.length ? [`Mastery: ${it.mastery.join(", ")}`] : [];
  const all = [...labels, ...mastery];
  return all.join("; ");
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

  // Mundane filter by tab (tightened)
  const mundaneFilter = useMemo(() => {
    return (it) => {
      // rarity
      const rRaw = String(it?.rarity || it?.item_rarity || "").toLowerCase();
      const mundane = !rRaw || rRaw === "none" || rRaw === "mundane";
      if (!mundane) return false;

      // exclude trade goods / non-weapons sneaking in
      const label = it?.__cls?.uiType || "";
      if (/trade\s*goods/i.test(label)) return false;

      if (tab === "armor") return isArmor(it);
      if (tab === "shield") return isShield(it);
      if (tab === "ammunition") return isAmmo(it);

      // weapon categories must have damage dice
      const haveWeaponStats = isWeapon(it) && !!it?.dmg1;

      if (tab === "ranged") {
        return haveWeaponStats && /ranged/i.test(label);
      }
      if (tab === "thrown") {
        return haveWeaponStats && hasThrown(it);
      }
      // melee: not ranged label; still allow thrown to appear here (so they show in both)
      if (tab === "melee") {
        return haveWeaponStats && !/ranged/i.test(label);
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

  // Materials per tab
  const materialChoices = useMemo(() => {
    const kind = tab === "melee" || tab === "ranged" || tab === "thrown" ? "weapon" : tab;
    return MATERIALS.filter((m) => m.appliesTo.includes(kind));
  }, [tab]);
  const materialText = useMemo(() => {
    if (!materialKey) return "";
    const kind = tab === "melee" || tab === "ranged" || tab === "thrown" ? "weapon" : tab;
    const m = MATERIALS.find((x) => x.key === materialKey);
    return (m?.textByKind?.[kind]) || "";
  }, [materialKey, tab]);

  // Variant list (exclude enhancement/materials)
  const variantChoices = useMemo(() => {
    const kind = tab === "melee" || tab === "ranged" || tab === "thrown" ? "weapon" : tab;
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
    const n = v.name.trim();
    if (/\b of \b/i.test(n)) {
      const ofPart = ofWithOpt || n.split(/\b of \b/i)[1];
      return { prefix: n.split(/\b of \b/i)[0].trim() || "", ofPart: (ofPart || "").trim() };
    }
    return { prefix: n.replace(/\s*(sword|weapon)\s*$/i, "").trim(), ofPart: ofWithOpt ? ofWithOpt : "" };
  }
  const composedName = useMemo(() => {
    if (!base) return "";
    const baseName = String(base.name || base.item_name || "Item");
    const pre = [];
    if (Number(bonus) > 0) pre.push(`+${bonus}`);
    if (materialKey) pre.push(MATERIALS.find((m) => m.key === materialKey)?.name || "");

    const a = namePartsFor(selA, selAOpt);
    const b = namePartsFor(selB, selBOpt);

    const prefixes = [a.prefix, b.prefix].filter(Boolean);

    // Build suffix (of …) list; ensure at least the SECOND variant is an “of …”
    const suffixes = [];
    if (a.ofPart) suffixes.push(a.ofPart);
    if (b.ofPart) {
      if (!suffixes.includes(b.ofPart)) suffixes.push(b.ofPart);
    } else if (selB) {
      const plain = (b.prefix || selB?.name || "").trim();
      if (plain && !suffixes.includes(plain)) suffixes.push(plain);
    }

    // De-duplicate prefixes vs suffixes (e.g., “Flame Tongue” shouldn’t appear twice)
    const suffixSet = new Set(suffixes.map((s) => s.toLowerCase()));
    const cleanedPrefixes = prefixes.filter((p) => !suffixSet.has(p.toLowerCase()));

    const head = [pre.join(" ").trim(), cleanedPrefixes.join(" ")].filter(Boolean).join(" ").trim();
    const withBase = head ? `${head} ${baseName}` : baseName;
    return suffixes.length ? `${withBase} of ${suffixes.join(" and ")}` : withBase;
  }, [base, bonus, materialKey, selA, selAOpt, selB, selBOpt]);

  // Preview lines + rarity
  const preview = useMemo(() => {
    const lines = [];
    const rarities = [];
    const kind = tab === "melee" || tab === "ranged" || tab === "thrown" ? "weapon" : tab;

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

  const kindForText = (tab === "melee" || tab === "ranged" || tab === "thrown") ? "weapon" : tab;
  const descA = selA ? textForVariant(selA, kindForText, selAOpt) : "";
  const descB = selB ? textForVariant(selB, kindForText, selBOpt) : "";

  // Footer: base stats pulled from the base item
  const footerDamage = useMemo(() => (base ? weaponDamageText(base) : ""), [base]);
  const footerRange  = useMemo(() => (base ? weaponRangeText(base)  : ""), [base]);
  const footerProps  = useMemo(() => (base ? weaponPropertiesText(base): ""), [base]);

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
      // include base stat snapshot so the admin card can render it cleanly
      _baseStats: {
        damage: footerDamage || null,
        range: footerRange || null,
        properties: footerProps || null,
      },
    };
    onBuild?.(obj);
  }

  // ------------------------------ UI (unchanged look) ------------------------------
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
            {/* Tab pills */}
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
                    {ENHANCEMENT.textByKind[kindForText].replace("{N}", String(bonus))}
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

                  {/* Footer stats */}
                  <div className="row g-3 small text-muted">
                    <div className="col-12 col-md-4">
                      <div>Damage: <span className="text-light">{footerDamage || "—"}</span></div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div>Range: <span className="text-light">{footerRange || "—"}</span></div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div>Properties: <span className="text-light">{footerProps || "—"}</span></div>
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
