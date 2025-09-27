// components/MagicVariantBuilder.js
import { useEffect, useMemo, useState } from "react";

/**
 * Classic Magic Variant Builder (rollback w/ requested tweaks)
 * - Tabs: Melee, Ranged, Armor, Shield, Ammunition (Weapon removed)
 * - Thrown weapons appear in BOTH Melee and Ranged tabs
 * - Base = mundane only, filtered by tab
 * - Material dropdown (Adamantine/Mithral/Silvered/Ruidium)
 * - +N enhancement
 * - Other A / Other B read from window.__MAGIC_VARIANTS__ (/items/magicvariants.json)
 * - Inline blurbs and rarity readout
 * - Vorpal gating requires +3
 */

// ----------------------------- helpers -----------------------------
const TABS = ["melee", "ranged", "armor", "shield", "ammunition"];
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

// ---- Melee/Ranged heuristics ----
// Ranged-only implements:
const TRUE_RANGED_ONLY = /(bow|crossbow|sling)/i;
// Classic thrown names (should appear in BOTH lists):
const THROWN_WORDS =
  /(throw|javelin|handaxe|light hammer|dagger|spear|trident|boomerang|dart|net)/i;

function isMeleeBase(it) {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  if (/ammunition/i.test(ui)) return false;

  const name = (it?.name || it?.item_name || "").toLowerCase();

  // Exclude true ranged-only implements from melee
  if (TRUE_RANGED_ONLY.test(ui) || TRUE_RANGED_ONLY.test(name)) return false;

  // Everything else weapon-y is allowed in melee (including thrown)
  return (
    /weapon/i.test(ui) ||
    /(club|mace|sword|axe|maul|flail|hammer|spear|staff|whip|scimitar|rapier|dagger|halberd|glaive|pike|morningstar)/i.test(
      name
    ) ||
    THROWN_WORDS.test(name)
  );
}

function isRangedBase(it) {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  if (/ammunition/i.test(ui)) return false;

  const name = (it?.name || it?.item_name || "").toLowerCase();

  // Ranged if tagged as such, is a bow/crossbow/sling, OR is a classic thrown weapon
  if (/ranged/i.test(ui)) return true;
  if (TRUE_RANGED_ONLY.test(ui) || TRUE_RANGED_ONLY.test(name)) return true;
  if (THROWN_WORDS.test(name)) return true;

  return false;
}

// Materials (XDMG/CRCotN wording kept)
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
      armor:
        "While you wear this armor, any Critical Hit against you becomes a normal hit.",
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
    weapon:
      "You have a +{N} bonus to attack and damage rolls made with this magic weapon.",
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

// ---------------------- load / normalize variants ----------------------
function useMagicVariants(open) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!open) return;
    try {
      const raw =
        (typeof window !== "undefined" && window.__MAGIC_VARIANTS__) || [];
      const out = [];
      for (const v of raw) {
        const name = String(v?.name || "").trim();
        if (!name) continue;
        const key = String(v?.key || name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_");
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
  // Map our Melee/Ranged tabs to "weapon" text bodies
  const kind = cat === "melee" || cat === "ranged" ? "weapon" : cat;
  let body =
    v.textByKind?.[kind] || v.textByKind?.weapon || v.textByKind?.armor || "";
  if (!body) return "";

  const valueKey = (opt ?? "").toString();
  const dc = v.dcByValue?.[valueKey] ?? v.dcByValue?.[Number(valueKey)] ?? "";
  const atk =
    v.attackByValue?.[valueKey] ?? v.attackByValue?.[Number(valueKey)] ?? "";

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

// ----------------------------- component -----------------------------
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
      const rarityRaw = String(it.rarity || it.item_rarity || "").toLowerCase();
      const mundane = !rarityRaw || rarityRaw === "none" || rarityRaw === "mundane";
      if (!mundane) return false;

      const ui = it.__cls?.uiType || it.__cls?.rawType || "";

      if (tab === "melee")
        return /weapon/i.test(ui) && !/ammunition/i.test(ui) && isMeleeBase(it);
      if (tab === "ranged")
        return /weapon/i.test(ui) && !/ammunition/i.test(ui) && isRangedBase(it);
      if (tab === "armor") return /armor/i.test(ui);
      if (tab === "shield") return /shield/i.test(ui);
      if (tab === "ammunition") return /ammunition/i.test(ui);
      return false;
    };
  }, [tab]);

  const baseChoices = useMemo(() => {
    return (allItems || [])
      .filter(mundaneFilter)
      .sort((a, b) =>
        String(a.name || a.item_name).localeCompare(String(b.name || b.item_name))
      );
  }, [allItems, mundaneFilter]);

  useEffect(() => {
    if (!baseChoices.length) {
      setBase(null);
      return;
    }
    if (
      base &&
      baseChoices.find((x) => (x.id || x.name) === (base.id || base.name))
    )
      return;
    setBase(baseChoices[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseChoices]);

  // Materials per tab
  const materialChoices = useMemo(() => {
    const kind = tab === "melee" || tab === "ranged" ? "weapon" : tab;
    return MATERIALS.filter((m) => m.appliesTo.includes(kind));
  }, [tab]);
  const materialText = useMemo(() => {
    if (!materialKey) return "";
    const kind = tab === "melee" || tab === "ranged" ? "weapon" : tab;
    const m = MATERIALS.find((x) => x.key === materialKey);
    return m?.textByKind?.[kind] || "";
  }, [materialKey, tab]);

  // Variant list (exclude enhancement/materials)
  const variantChoices = useMemo(() => {
    const kind = tab === "melee" || tab === "ranged" ? "weapon" : tab;
    const list = variants.filter(
      (v) =>
        v.appliesTo.includes(kind) &&
        v.key !== "enhancement" &&
        !MATERIAL_KEYS.has(v.key)
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

  const selA =
    useMemo(
      () => variantChoices.find((v) => v.key === selAKey) || null,
      [variantChoices, selAKey]
    );
  const selB =
    useMemo(
      () => variantChoices.find((v) => v.key === selBKey) || null,
      [variantChoices, selBKey]
    );
  useEffect(() => {
    setSelAOpt("");
  }, [selAKey]);
  useEffect(() => {
    setSelBOpt("");
  }, [selBKey]);

  // Name compose (prefixes & “of …” suffixes)
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
    if (materialKey)
      pre.push(MATERIALS.find((m) => m.key === materialKey)?.name || "");

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
    const kind = tab === "melee" || tab === "ranged" ? "weapon" : tab;

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
        lines.push(
          "This enchantment requires the item to already be +3 before it may be applied."
        );
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

  const descA = selA
    ? textForVariant(selA, tab === "melee" || tab === "ranged" ? "weapon" : tab, selAOpt)
    : "";
  const descB = selB
    ? textForVariant(selB, tab === "melee" || tab === "ranged" ? "weapon" : tab, selBOpt)
    : "";

  // Build object to return
  function handleBuild() {
    if (!base) return;
    const obj = {
      name: composedName,
      rarity: preview.rarity,
      baseId: base.id || base._id,
      baseName: base.name || base.item_name,
      category: tab, // melee | ranged | armor | shield | ammunition
      bonus: Number(bonus) || 0,
      material: materialKey || null,
      variantA: selA?.name || null,
      variantAKey: selA?.key || null,
      variantAOption: selAOpt || null,
      variantB: selB?.name || null,
      variantBKey: selB?.key || null,
      variantBOption: selBOpt || null,
      entries: preview.lines.filter(Boolean),
    };
    onBuild?.(obj);
  }

  // ------------------------------ UI (classic Bootstrap-ish) ------------------------------
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
            {/* Tab pills (Weapon removed → Melee + Ranged) */}
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
                      baseChoices.find((it) => (it.name || "") === val) ||
                      null;
                    setBase(next);
                  }}
                >
                  {baseChoices.map((it) => {
                    const id = it.id || it.name;
                    const nm = it.name || it.item_name;
                    return (
                      <option key={id} value={id}>
                        {nm}
                      </option>
                    );
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
                <select
                  className="form-select"
                  value={materialKey}
                  onChange={(e) => setMaterialKey(e.target.value)}
                >
                  <option value="">— none —</option>
                  {materialChoices.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {materialKey && (
                  <div className="form-text text-light mt-1">{materialText}</div>
                )}
              </div>

              {/* +N */}
              <div className="col-12 col-lg-6">
                <label className="form-label fw-semibold">Bonus (optional)</label>
                <div className="d-flex gap-2">
                  <input className="form-control" value="+N" readOnly style={{ maxWidth: 120 }} />
                  <select
                    className="form-select"
                    value={String(bonus)}
                    onChange={(e) => setBonus(Number(e.target.value))}
                  >
                    {ENHANCEMENT.values.map((v) => (
                      <option key={v} value={v}>
                        {v === 0 ? "—" : v}
                      </option>
                    ))}
                  </select>
                </div>
                {Number(bonus) > 0 && (
                  <div className="form-text text-light mt-1">
                    {ENHANCEMENT.textByKind[
                      tab === "melee" || tab === "ranged" ? "weapon" : tab
                    ].replace("{N}", String(bonus))}
                  </div>
                )}
              </div>

              {/* Other A */}
              <div className="col-12 col-lg-6">
                <label className="form-label fw-semibold">Other A (optional)</label>
                <select
                  className="form-select"
                  value={selAKey}
                  onChange={(e) => setSelAKey(e.target.value)}
                >
                  <option value="">— none —</option>
                  {variantChoices.map((v) => (
                    <option
                      key={v.key}
                      value={v.key}
                      disabled={requiresPlus3(v) && Number(bonus) < 3}
                    >
                      {v.name}
                      {requiresPlus3(v) ? " (requires +3)" : ""}
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
                          <select
                            className="form-select form-select-sm"
                            value={selAOpt}
                            onChange={(e) => setSelAOpt(e.target.value)}
                          >
                            <option value="">— select —</option>
                            {selA.options.map((o) => (
                              <option key={String(o)} value={String(o)}>
                                {title(o)}
                              </option>
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
                <select
                  className="form-select"
                  value={selBKey}
                  onChange={(e) => setSelBKey(e.target.value)}
                >
                  <option value="">— none —</option>
                  {variantChoices.map((v) => (
                    <option
                      key={v.key}
                      value={v.key}
                      disabled={requiresPlus3(v) && Number(bonus) < 3}
                    >
                      {v.name}
                      {requiresPlus3(v) ? " (requires +3)" : ""}
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
                          <select
                            className="form-select form-select-sm"
                            value={selBOpt}
                            onChange={(e) => setSelBOpt(e.target.value)}
                          >
                            <option value="">— select —</option>
                            {selB.options.map((o) => (
                              <option key={String(o)} value={String(o)}>
                                {title(o)}
                              </option>
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
                    <ul className="mb-0">
                      {preview.lines.map((ln, i) => (
                        <li key={i}>{ln}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>// components/MagicVariantBuilder.js
import { useEffect, useMemo, useState } from "react";

/**
 * Classic Magic Variant Builder (rollback + fixes)
 * - Tabs: Melee, Ranged, Thrown, Armor, Shield, Ammunition
 * - Thrown is split out of Ranged; blowgun/dart never appear in Melee
 * - Base = mundane only, filtered by tab
 * - Materials (+ Adamantine/Mithral/Silvered/Ruidium)
 * - +N enhancement
 * - Other A / Other B from window.__MAGIC_VARIANTS__ (merged in admin.js)
 * - textByKind now gracefully falls back to main entries (no more "As entry.")
 * - Preview includes base item description + stats; built item carries base stats through
 * - Vorpal gating: requires +3
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
const isEmpty = (s) => !s || !String(s).trim();
const looksAsEntry = (s) => /^\s*as\s+entry\.?\s*$/i.test(String(s || ""));

// Flatten a 5etools-style entries tree to plain text
function flattenEntries(entries) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (typeof node === "string") {
      // very light tag scrub
      out.push(node.replace(/\{@[^}]+}/g, (m) => {
        const inner = m.slice(2, -1).trim();
        const i = inner.indexOf(" ");
        if (i === -1) return inner;
        const tag = inner.slice(0, i).toLowerCase();
        const rest = inner.slice(i + 1);
        if (tag === "dc") return `DC ${rest}`;
        return rest.split("|")[0];
      }));
      return;
    }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node === "object") {
      if (node.entries) walk(node.entries);
      if (node.caption) out.push(String(node.caption));
      if (Array.isArray(node.rows)) node.rows.forEach((r) => Array.isArray(r) && out.push(r.join(" — ")));
    }
  };
  walk(entries);
  return out.join("\n\n").trim();
}

// Very light melee/ranged/thrown heuristics (uses classifyUi hints when present)
const RANGED_WORDS = /(bow|crossbow|sling|blowgun|dart)/i;
const THROWN_WORDS = /(javelin|handaxe|trident|spear|throwing|boomerang)/i;

function isThrownBase(it) {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  const name = (it?.name || it?.item_name || "").toLowerCase();
  const props = JSON.stringify(it || {}).toLowerCase();
  return /thrown/.test(props) || THROWN_WORDS.test(name) || /thrown/i.test(ui);
}
function isMeleeBase(it) {
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  const name = (it?.name || it?.item_name || "").toLowerCase();
  // never treat blowgun/dart as melee, even if mis-labeled upstream
  if (/(blowgun|dart)\b/.test(name)) return false;
  if (isThrownBase(it)) return false; // thrown lives in its own tab
  if (/ranged/i.test(ui)) return false;
  if (/melee/i.test(ui)) return true;
  if (RANGED_WORDS.test(name)) return false;
  return /weapon/i.test(ui) || /club|mace|sword|axe|maul|flail|hammer|spear|staff|whip|scimitar|rapier|dagger|halberd|glaive|pike|morningstar/i.test(name);
}
function isRangedBase(it) {
  if (isThrownBase(it)) return false; // thrown split out
  const ui = it?.__cls?.uiType || it?.__cls?.rawType || "";
  const name = (it?.name || it?.item_name || "").toLowerCase();
  return /ammunition/i.test(ui) ? false : /ranged/i.test(ui) || RANGED_WORDS.test(name) || /bow|crossbow|sling/i.test(ui);
}

// Materials (XDMG/CRCotN wording kept)
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
          entries: v?.entries || v?.text || v?.description || null,
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
  // Map our Melee/Ranged/Thrown tabs to "weapon" body
  const kind = (cat === "melee" || cat === "ranged" || cat === "thrown") ? "weapon" : cat;

  // Prefer kind-specific text if it's real text (not "As entry.")
  let body = v.textByKind?.[kind];
  if (looksAsEntry(body) || isEmpty(body)) body = "";

  if (!body) {
    // fall back to other kinds if they exist AND are real text
    const fallbackBodies = [
      v.textByKind?.weapon, v.textByKind?.armor, v.textByKind?.shield, v.textByKind?.ammunition,
    ].filter((b) => !looksAsEntry(b) && !isEmpty(b));
    body = fallbackBodies[0] || "";
  }

  if (!body) {
    // final fallback: flatten main entries
    const flat = flattenEntries(v.entries);
    body = flat || "";
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

// ----------------------------- component -----------------------------
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
    if (baseItem && isThrownBase(baseItem)) return "thrown";
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
      const rarityRaw = String(it.rarity || it.item_rarity || "").toLowerCase();
      const mundane = !rarityRaw || rarityRaw === "none" || rarityRaw === "mundane";
      if (!mundane) return false;
      const ui = it.__cls?.uiType || it.__cls?.rawType || "";

      if (tab === "melee") return (/weapon/i.test(ui) && !/ammunition/i.test(ui) && isMeleeBase(it));
      if (tab === "ranged") return (/weapon/i.test(ui) && !/ammunition/i.test(ui) && isRangedBase(it));
      if (tab === "thrown") return (/weapon/i.test(ui) && !/ammunition/i.test(ui) && isThrownBase(it));
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

  // Variant list (exclude enhancement/materials)
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

  // Name compose (prefixes & “of …” suffixes)
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

  // Preview lines + rarity (also prepend base description)
  const preview = useMemo(() => {
    const lines = [];
    const rarities = [];
    const kind = (tab === "melee" || tab === "ranged" || tab === "thrown") ? "weapon" : tab;

    // Base description first (if it exists)
    const baseDesc = String(base?.description || base?.item_description || "").trim();
    if (baseDesc) lines.push(baseDesc);

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
  }, [base, bonus, materialKey, selA, selAOpt, selB, selBOpt, tab]);

  const kindForBonus = (tab === "melee" || tab === "ranged" || tab === "thrown") ? "weapon" : tab;
  const descA = selA ? textForVariant(selA, kindForBonus, selAOpt) : "";
  const descB = selB ? textForVariant(selB, kindForBonus, selBOpt) : "";

  // Build object to return — carry base stats through so ItemCard can render nicely
  function handleBuild() {
    if (!base) return;
    const baseStats = {
      // best-effort pass-throughs used by ItemCard/other UI bits
      damage: base.damage ?? base.item_damage ?? undefined,
      damage_dice: base.damage_dice ?? base.item_damage_dice ?? undefined,
      damage_type: base.damage_type ?? base.item_damage_type ?? undefined,
      range: base.range ?? base.item_range ?? undefined,
      normal_range: base.normal_range ?? base.item_normal_range ?? undefined,
      long_range: base.long_range ?? base.item_long_range ?? undefined,
      ac: base.ac ?? base.item_ac ?? base.ac_base ?? undefined,
      properties: base.properties ?? base.item_properties ?? undefined,
      weight: base.weight ?? base.item_weight ?? undefined,
      cost: base.cost ?? base.item_cost ?? undefined,
      description: base.description ?? base.item_description ?? undefined,
    };

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
      // Put preview lines into description for ItemCard, preserving base text first
      description: preview.lines.filter(Boolean).join("\n"),
      entries: preview.lines.filter(Boolean),
      ...baseStats,
    };
    onBuild?.(obj);
  }

  // ------------------------------ UI (classic Bootstrap-ish) ------------------------------
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
                    {ENHANCEMENT.textByKind[kindForBonus].replace("{N}", String(bonus))}
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
            <button className="btn btn-primary" disabled={!base} onClick={handleBuild}>
              Build Variant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

            </div>
          </div>

          <div className="modal-footer border-secondary">
            <button className="btn btn-outline-light" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={!base} onClick={handleBuild}>
              Build Variant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
