import { useEffect, useMemo, useState } from "react";

/**
 * Magic Variant Builder (patched)
 * - Strictly mundane bases (weapon/armor/shield/ammunition)
 * - Materials in Material dropdown (Adamantine, Mithral, Silvered, Ruidium)
 * - "+N" bonus field
 * - Other A / Other B now read from /items/magicvariants.json (window.__MAGIC_VARIANTS__)
 *   and display their rules text under the select and in the preview.
 * - Supports options (e.g., Armor of Resistance, Ammunition of Slaying, Enspelled X)
 * - Vorpal gating: requires +3
 */

/* ──────────────────────────────────────────────────────────────────────────
  Helpers
────────────────────────────────────────────────────────────────────────── */
const CATEGORY = ["weapon", "armor", "shield", "ammunition"]; // tabs
const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];
const title = (s) => (s ? String(s).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "");
const lower = (s) => String(s || "").toLowerCase();
const normRarity = (r) => {
  const x = lower(r);
  if (x.includes("legend")) return "Legendary";
  if (x.includes("very")) return "Very Rare";
  if (x.includes("rare")) return "Rare";
  if (x.includes("uncommon")) return "Uncommon";
  if (x.includes("common")) return "Common";
  return "";
};

// Materials live here (kept simple and consistent with XDMG wording)
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
        "An alchemical process has bonded silver to this magic weapon. When you score a Critical Hit against a shape‑shifted creature, roll one additional damage die of the weapon’s normal damage type.",
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

// +N enhancement (kept as a separate control)
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

// Recognize variants that require +3 first
const requiresPlus3 = (v) => /\bvorpal\b/i.test(v?.key || v?.name || "");

// Which variants should be offered as an extra OPTION picker and how to label/title
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

/* ──────────────────────────────────────────────────────────────────────────
  Load / normalize magicvariants.json (injected by pages/admin.js)
────────────────────────────────────────────────────────────────────────── */
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
        const appliesTo = Array.isArray(v?.appliesTo) && v.appliesTo.length ? v.appliesTo : CATEGORY;
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

// Build a one-line description for a variant selection
function textForVariant(v, cat, opt) {
  if (!v) return "";
  // Choose correct body
  let body = v.textByKind?.[cat] || v.textByKind?.weapon || v.textByKind?.armor || "";
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

function rarityForVariant(v, opt, cat) {
  if (!v) return "";
  if (v.rarityByValue && opt != null) {
    const r = v.rarityByValue[String(opt)] ?? v.rarityByValue[Number(opt)];
    return normRarity(r);
  }
  return normRarity(v.rarity);
}

/* ──────────────────────────────────────────────────────────────────────────
  Modal shell (tiny, no deps)
────────────────────────────────────────────────────────────────────────── */
function ModalShell({ open, onClose, titleText, children }) {
  if (!open) return null;
  return (
    <div className="mvb-overlay" role="dialog" aria-modal="true" aria-label={titleText}>
      <div className="mvb-modal">
        <div className="mvb-header">
          <h3 className="m-0">{titleText}</h3>
          <button className="mvb-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="mvb-body">{children}</div>
      </div>
      <style jsx>{`
        .mvb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 1050; display: flex; align-items: flex-start; justify-content: center; padding: 2rem; overflow: auto; }
        .mvb-modal { background: #141625; color: #fff; border: 1px solid #2a2f45; border-radius: 12px; width: min(980px, 100%); box-shadow: 0 20px 60px rgba(0,0,0,.5); }
        .mvb-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #2a2f45; }
        .mvb-body { padding: 16px; }
        .mvb-close { background: transparent; border: 0; color: #9aa4bf; font-size: 22px; cursor: pointer; }
        .mvb-close:hover { color: #fff; }
        .mvb-preview { background:#0f1220; border:1px solid #2a2f45; border-radius:8px; padding:12px; color:#fff; }
        .mvb-title { font-weight:700; margin-bottom:6px; }
        .mvb-ul { padding-left:18px; margin:0; }
      `}</style>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
  Main component
────────────────────────────────────────────────────────────────────────── */
export default function MagicVariantBuilder({ open, onClose, baseItem, allItems = [], onBuild }) {
  const variants = useMagicVariants(open);

  // Category from base item
  const defaultCategory = useMemo(() => {
    const t = baseItem?.__cls?.uiType || "";
    if (/shield/i.test(t)) return "shield";
    if (/armor/i.test(t)) return "armor";
    if (/ammunition/i.test(t)) return "ammunition";
    return "weapon";
  }, [baseItem]);

  const [cat, setCat] = useState(defaultCategory);
  const [base, setBase] = useState(baseItem || null);
  const [bonus, setBonus] = useState(0);
  const [materialKey, setMaterialKey] = useState("");
  const [selAKey, setSelAKey] = useState("");
  const [selAOpt, setSelAOpt] = useState("");
  const [selBKey, setSelBKey] = useState("");
  const [selBOpt, setSelBOpt] = useState("");

  // Reset base when changing category
  const mundaneFilter = useMemo(() => {
    return (it) => {
      const name = (it.name || it.item_name || "");
      const rarityRaw = String(it.rarity || it.item_rarity || "").toLowerCase();
      const rarityIsMundane = !rarityRaw || rarityRaw === "none" || rarityRaw === "mundane";
      const ui = it.__cls?.uiType || it.__cls?.rawType || "";
      if (!rarityIsMundane) return false;
      if (cat === "weapon") return /weapon/i.test(ui) && !/ammunition/i.test(ui);
      if (cat === "armor") return /armor/i.test(ui);
      if (cat === "shield") return /shield/i.test(ui);
      if (cat === "ammunition") return /ammunition/i.test(ui);
      return false;
    };
  }, [cat]);

  const baseChoices = useMemo(() => {
    return (allItems || [])
      .filter(mundaneFilter)
      .sort((a, b) => String(a.name || a.item_name).localeCompare(String(b.name || b.item_name)));
  }, [allItems, mundaneFilter]);

  useEffect(() => {
    if (!baseChoices.length) { setBase(null); return; }
    if (base && baseChoices.find((x) => (x.id || x.name) === (base.id || base.name))) return;
    setBase(baseChoices[0]);
  }, [baseChoices]);

  // Material choices per category
  const materialChoices = useMemo(() => MATERIALS.filter((m) => m.appliesTo.includes(cat)), [cat]);
  const materialText = useMemo(() => {
    if (!materialKey) return "";
    const m = MATERIALS.find((x) => x.key === materialKey);
    return (m?.textByKind?.[cat]) || "";
  }, [materialKey, cat]);

  // Variant lists for Other A/B (exclude enhancement + materials)
  const variantChoices = useMemo(() => {
    const list = variants.filter((v) => v.appliesTo.includes(cat) && v.key !== "enhancement" && !MATERIAL_KEYS.has(v.key));
    // Deduplicate by name
    const seen = new Set();
    const out = [];
    for (const v of list) {
      const id = v.key + "::" + v.name;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(v);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [variants, cat]);

  const selA = useMemo(() => variantChoices.find((v) => v.key === selAKey) || null, [variantChoices, selAKey]);
  const selB = useMemo(() => variantChoices.find((v) => v.key === selBKey) || null, [variantChoices, selBKey]);

  useEffect(() => { setSelAOpt(""); }, [selAKey]);
  useEffect(() => { setSelBOpt(""); }, [selBKey]);

  // Compose display name (prefix + of-parts)
  function namePartsFor(v, opt) {
    if (!v) return { prefix: "", ofPart: "" };
    const meta = optionMetaForVariant(v);
    const ofWithOpt = meta && opt ? meta.titleFmt(opt) : null;
    const n = v.name;
    if (/\b of \b/i.test(n)) {
      // Use the portion after "of" as a suffix, with option injected
      const ofPart = ofWithOpt || n.split(/\b of \b/i)[1];
      return { prefix: "", ofPart: ofPart.trim() };
    }
    // Otherwise treat as a prefix (e.g., Dancing, Flame Tongue, Vorpal, Vicious)
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

  // Preview lines and computed rarity (highest)
  const preview = useMemo(() => {
    const lines = [];
    const rarities = [];

    if (Number(bonus) > 0) {
      lines.push(ENHANCEMENT.textByKind[cat].replace("{N}", String(bonus)));
      rarities.push(ENHANCEMENT.rarityByValue[bonus]);
    }

    if (materialKey) {
      const m = MATERIALS.find((x) => x.key === materialKey);
      if (m?.textByKind?.[cat]) lines.push(m.textByKind[cat]);
      if (m?.rarity) rarities.push(m.rarity);
    }

    function addVariant(v, opt) {
      if (!v) return;
      if (requiresPlus3(v) && Number(bonus) < 3) {
        lines.push("This enchantment requires the item to already be +3 before it may be applied.");
      }
      const blurb = textForVariant(v, cat, opt);
      if (blurb) lines.push(blurb);
      const r = rarityForVariant(v, opt, cat);
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
  }, [bonus, materialKey, selA, selAOpt, selB, selBOpt, cat]);

  // Under-select blurbs
  const descA = selA ? textForVariant(selA, cat, selAOpt) : "";
  const descB = selB ? textForVariant(selB, cat, selBOpt) : "";

  // Build object returned to Admin when "Build Variant" is clicked
  function handleBuild() {
    if (!base) return;
    const obj = {
      name: composedName,
      rarity: preview.rarity,
      baseId: base.id || base._id,
      baseName: base.name || base.item_name,
      category: cat,
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

  // UI
  return (
    <ModalShell open={open} onClose={onClose} titleText="Build Magic Variant">
      {/* Category pills */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {CATEGORY.map((k) => (
          <button
            key={k}
            className={`btn btn-sm ${cat === k ? "btn-light text-dark" : "btn-outline-light"}`}
            onClick={() => {
              setCat(k);
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
        {/* Base item */}
        <div className="col-12 col-lg-6">
          <label className="form-label fw-semibold">Base {cat === "ammunition" ? "Ammunition" : cat === "armor" ? "Armor" : cat === "shield" ? "Shield" : "Weapon"} (mundane)</label>
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
          <select className="form-select" value={materialKey} onChange={(e) => setMaterialKey(e.target.value)}>
            <option value="">— none —</option>
            {materialChoices.map((m) => (
              <option key={m.key} value={m.key}>
                {m.name}
              </option>
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
                <option key={v} value={v}>
                  {v === 0 ? "—" : v}
                </option>
              ))}
            </select>
          </div>
          {Number(bonus) > 0 && (
            <div className="form-text text-light mt-1">{ENHANCEMENT.textByKind[cat].replace("{N}", String(bonus))}</div>
          )}
        </div>

        {/* Other A */}
        <div className="col-12 col-lg-6">
          <label className="form-label fw-semibold">Other A (optional)</label>
          <select className="form-select" value={selAKey} onChange={(e) => setSelAKey(e.target.value)}>
            <option value="">— none —</option>
            {variantChoices.map((v) => (
              <option key={v.key} value={v.key} disabled={requiresPlus3(v) && Number(bonus) < 3}>
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
                    <select className="form-select form-select-sm" value={selAOpt} onChange={(e) => setSelAOpt(e.target.value)}>
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
          <select className="form-select" value={selBKey} onChange={(e) => setSelBKey(e.target.value)}>
            <option value="">— none —</option>
            {variantChoices.map((v) => (
              <option key={v.key} value={v.key} disabled={requiresPlus3(v) && Number(bonus) < 3}>
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
                    <select className="form-select form-select-sm" value={selBOpt} onChange={(e) => setSelBOpt(e.target.value)}>
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
        <div className="mvb-preview mt-2">
          <div className="mvb-title">{composedName}</div>
          {preview.lines.length === 0 ? (
            <div className="text-muted">Choose options to see details.</div>
          ) : (
            <ul className="mvb-ul">
              {preview.lines.map((ln, i) => (
                <li key={i}>{ln}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="d-flex justify-content-end gap-2 mt-3">
        <button className="btn btn-outline-light" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleBuild} disabled={!base}>
          Build Variant
        </button>
      </div>
    </ModalShell>
  );
}
