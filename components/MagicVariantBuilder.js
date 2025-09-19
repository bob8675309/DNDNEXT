// components/MagicVariantBuilder.js
import { useEffect, useMemo, useState } from "react";
import Modal from "react-bootstrap/Modal";

/** ----------------------------- Catalog Helpers ----------------------------- **/

// Friendly category keys used by the UI
const KINDS = ["weapon", "armor", "shield", "ammunition"];

// Material options by kind
const MATERIALS = {
  weapon:    ["Adamantine", "Silvered", "Ruidium"],
  armor:     ["Mithral", "Adamantine", "Ruidium"],
  shield:    [], // no canonical material templates in XDMG for shields
  ammunition:["Adamantine", "Silvered"],
};

// Known “other” variants by kind (deduped before display)
const OTHER_VARIANTS = {
  weapon: [
    "Vicious Weapon",
    "Vorpal Sword",
    "Flame Tongue",
    "Dancing Sword",
    "Weapon of Warning",
    "Sword of Sharpness",
    "Sword of Wounding",
    "Sword of Vengeance",
    "Sword of Life Stealing",
    "Weapon of Agonizing Paralysis",
    "Weapon of Throne's Command",
    "Sylvan Talon",
    "Ruidium Weapon", // note: shown as “Other”, but functionally a material; we hide it from here below
  ],
  armor: [
    "Armor of Resistance",
    "Mithral Armor", // treat as material; we hide it from here below
    "Adamantine Armor", // treat as material; hide below
    "Ruidium Armor",    // treat as material; hide below
    "Mariner's Armor",
    "Cast-Off Armor",
    "Smoldering Armor",
    "Zephyr Armor",
  ],
  shield: [
    // keep this flexible for additions later
  ],
  ammunition: [
    "Ammunition of Slaying",
    "Walloping Ammunition",
    "Winged Ammunition",
  ],
};

// Map “lookups” for material items -> the neat one-word we show in the Material dropdown
const MATERIAL_LOOKUP = {
  "Adamantine Weapon": "Adamantine",
  "Adamantine Armor": "Adamantine",
  "Adamantine Ammunition": "Adamantine",
  "Mithral Armor": "Mithral",
  "Silvered Weapon": "Silvered",
  "Silvered Ammunition": "Silvered",
  "Ruidium Weapon": "Ruidium",
  "Ruidium Armor": "Ruidium",
};

// Variants that require a minimum enhancement to be applied (we *don’t* grant that bonus here)
const ENHANCEMENT_PREREQS = {
  "Vorpal Sword": 3,
  "Weapon of Agonizing Paralysis": 3,
  "Sword of Retribution": 3,
  "Weapon of Throne's Command": 1,
};

// Variants that expose a {OPTION} picker
const VARIANT_OPTION_DEFS = {
  "Armor of Resistance": {
    label: "Damage Type",
    values: [
      "Acid","Cold","Fire","Force","Lightning",
      "Necrotic","Poison","Psychic","Radiant","Thunder"
    ],
    // For name building
    nameSuffix: (val) => `of ${val} Resistance`,
  },
  "Ammunition of Slaying": {
    label: "Creature Type",
    values: [
      "Aberrations","Beasts","Celestials","Constructs","Dragons","Elementals",
      "Humanoids","Fey","Fiends","Giants","Monstrosities","Oozes","Plants","Undead"
    ],
    nameSuffix: (val) => `of ${val} Slaying`,
  },
};

// Helper: return true if item looks like a sword (for “Dancing Sword”, “Vorpal Sword”, etc.)
const isSword = (baseName) => /sword\b/i.test(baseName);

// Prefer XDMG text if we can load it. We keep a tiny in-memory cache.
let _VARIANT_TEXT_CACHE = null;
async function loadCanonical() {
  if (_VARIANT_TEXT_CACHE) return _VARIANT_TEXT_CACHE;
  try {
    // Try the XDMG-first canonical file path
    const r = await fetch("/items/magicvariants.canonical.xdmg.json");
    if (r.ok) {
      const data = await r.json();
      _VARIANT_TEXT_CACHE = Array.isArray(data?.variants) ? data.variants : data;
      return _VARIANT_TEXT_CACHE;
    }
  } catch {}
  // Fallback: old path if present
  try {
    const r2 = await fetch("/items/magicvariants.json");
    if (r2.ok) {
      const data = await r2.json();
      _VARIANT_TEXT_CACHE = Array.isArray(data?.variants) ? data.variants : data;
      return _VARIANT_TEXT_CACHE;
    }
  } catch {}
  _VARIANT_TEXT_CACHE = [];
  return _VARIANT_TEXT_CACHE;
}

function findVariantText(variants, name, kind) {
  if (!variants?.length) return null;
  const norm = (s) => String(s || "").toLowerCase();
  // Try exact name + kind
  let hit = variants.find(v => norm(v.name) === norm(name) && (!v.appliesTo || v.appliesTo.includes(kind)));
  if (hit?.textByKind?.[kind]) return hit.textByKind[kind];
  if (hit?.text) return hit.text;
  // Try name only
  hit = variants.find(v => norm(v.name) === norm(name));
  if (hit?.textByKind?.[kind]) return hit.textByKind[kind];
  return hit?.text || null;
}

/** ----------------------------- Component ----------------------------- **/

export default function MagicVariantBuilder({
  open,
  onClose,
  baseItem,
  allItems = [],
  onBuild,
}) {
  const [kind, setKind] = useState("weapon");
  const [material, setMaterial] = useState(""); // Adamantine, Mithral, Silvered, Ruidium
  const [bonus, setBonus] = useState(0);        // +N (0 = none)
  const [otherA, setOtherA] = useState("");     // freeform pick from OTHER_VARIANTS
  const [otherB, setOtherB] = useState("");
  const [options, setOptions] = useState({});   // { "Armor of Resistance": "Cold", ... }
  const [catalog, setCatalog] = useState([]);

  // Load canonical variant text, prefer XDMG
  useEffect(() => {
    let dead = false;
    (async () => {
      const data = await loadCanonical();
      if (!dead) setCatalog(data || []);
    })();
    return () => { dead = true; };
  }, []);

  // Sync initial kind from selected base item
  useEffect(() => {
    if (!baseItem) return;
    const t = (baseItem.__cls?.uiType || "").toLowerCase();
    if (t.includes("weapon")) setKind("weapon");
    else if (t.includes("shield")) setKind("shield");
    else if (t.includes("ammunition")) setKind("ammunition");
    else setKind("armor");
  }, [baseItem]);

  // Base choices filtered to current kind and Mundane-ish
  const baseChoices = useMemo(() => {
    const isMundane = (it) => {
      const r = String(it.rarity || it.item_rarity || "").toLowerCase();
      return !r || r === "none" || r === "mundane" || r === "common";
    };
    const matchesKind = (it) => {
      const ui = (it.__cls?.uiType || "").toLowerCase();
      if (kind === "weapon") return ui.includes("weapon") && !ui.includes("ammunition");
      if (kind === "armor")  return ui.includes("armor") && !ui.includes("shield");
      if (kind === "shield") return ui.includes("shield");
      if (kind === "ammunition") return ui.includes("ammunition");
      return false;
    };
    const list = (allItems || []).filter((it) => matchesKind(it) && isMundane(it));
    // put current base item at top if present
    if (baseItem) {
      const name = baseItem.name || baseItem.item_name;
      list.sort((a, b) => (b === baseItem ? 1 : 0) - (a === baseItem ? 1 : 0) || String(a.name||a.item_name).localeCompare(String(b.name||b.item_name)));
    }
    return list;
  }, [allItems, baseItem, kind]);

  // Other variants lists (deduped, minus materials—we show those only in Material)
  const otherList = useMemo(() => {
    const seen = new Set();
    const out = [];
    const raw = OTHER_VARIANTS[kind] || [];
    for (const n of raw) {
      // hide any that are actually “materials” (we show in Material dropdown)
      if (MATERIAL_LOOKUP[n]) continue;
      if (!seen.has(n)) { seen.add(n); out.push(n); }
    }
    return out.sort((a,b)=>a.localeCompare(b));
  }, [kind]);

  // Optionally filter “sword-only” variants depending on base
  const filteredOtherList = useMemo(() => {
    const baseName = String(baseItem?.name || baseItem?.item_name || "");
    return otherList.filter((n) => {
      if (/Dancing Sword|Vorpal Sword|Sword of Sharpness|Sword of Wounding|Sword of Vengeance|Sword of Life Stealing/i.test(n)) {
        return isSword(baseName);
      }
      return true;
    });
  }, [otherList, baseItem]);

  // Option pickers required?
  const optionDefA = VARIANT_OPTION_DEFS[otherA];
  const optionDefB = VARIANT_OPTION_DEFS[otherB];

  // Enhancement prereq enforcement
  const prereqA = ENHANCEMENT_PREREQS[otherA] || 0;
  const prereqB = ENHANCEMENT_PREREQS[otherB] || 0;
  const unmetA = prereqA && bonus < prereqA;
  const unmetB = prereqB && bonus < prereqB;

  // Build a clean name
  const baseName = String(baseItem?.name || baseItem?.item_name || "").trim() || (kind === "armor" ? "Armor" : kind === "shield" ? "Shield" : kind === "ammunition" ? "Ammunition" : "Weapon");

  function composeName() {
    const partsPrefix = [];
    if (bonus > 0) partsPrefix.push(`+${bonus}`);
    if (material) partsPrefix.push(material);
    const core = `${partsPrefix.join(" ")} ${baseName}`.trim();

    const suffixes = [];
    const humanSuffix = (variant, opt) => {
      if (!variant) return "";
      // Use variant-specific naming when present
      const def = VARIANT_OPTION_DEFS[variant];
      if (def && opt) return def.nameSuffix(opt);

      // Generic rule: keep the item’s “of …” part
      if (/Armor of Resistance/i.test(variant)) {
        return `of ${opt || "{OPTION}"} Resistance`;
      }
      if (/Ammunition of Slaying/i.test(variant)) {
        return `of ${opt || "{OPTION}"} Slaying`;
      }
      // Strip leading “Weapon ”/“Sword ”/“Armor ” when sensible
      const m = variant
        .replace(/^Weapon of /i, "of ")
        .replace(/^Sword of /i, "of ")
        .replace(/^Armor of /i, "of ")
        .replace(/^\w+ Sword$/i, (s) => `of ${s.replace(/ Sword$/i," Sword")}`);
      return m;
    };

    if (otherA) suffixes.push(humanSuffix(otherA, options[otherA]));
    if (otherB) suffixes.push(humanSuffix(otherB, options[otherB]));

    let suffix = suffixes.filter(Boolean).join(" of ");
    // If there’s a second “of …”, join it with “ and …”
    if (suffixes.length >= 2) {
      // turn "of X of Y" -> "of X and Y"
      suffix = suffix.replace(/ of ([^]+) of ([^]+)$/i, " of $1 and $2");
    }
    return (suffix ? `${core} ${suffix}` : core).replace(/\s+/g, " ").trim();
  }

  // Pull XDMG text for the preview
  const materialText = useMemo(() => {
    if (!material) return "";
    const want = `${material} ${kind === "weapon" ? "Weapon"
                : kind === "armor" ? "Armor"
                : kind === "ammunition" ? "Ammunition" : ""}`.trim();
    return findVariantText(catalog, want, kind) || ""; // may be empty if not found
  }, [material, catalog, kind]);

  const textA = useMemo(() => findVariantText(catalog, otherA, kind) || "", [catalog, otherA, kind]);
  const textB = useMemo(() => findVariantText(catalog, otherB, kind) || "", [catalog, otherB, kind]);

  // Current rarity (very simple — you likely have a smarter map elsewhere)
  const rarity = useMemo(() => {
    // Basic rule-of-thumb by +N (matches XDMG armament tables)
    const byBonus = { 0: "none", 1: "uncommon", 2: "rare", 3: "very rare" };
    let r = byBonus[bonus] || "none";
    // Some variants have fixed rarities in XDMG, but we keep this light for now.
    return r;
  }, [bonus]);

  const canBuild = baseItem && (!unmetA && !unmetB);

  function handleBuild() {
    if (!canBuild) return;
    const built = {
      name: composeName(),
      rarity,
      // carry basic fields from base
      baseId: baseItem?.id,
      baseName,
      kind,
      enhancement: bonus,
      material: material || null,
      variants: [otherA, otherB].filter(Boolean).map((n) => ({ name: n, option: options[n] || null })),
      // stash long text so Admin preview looks great
      entries: [
        bonus > 0 ? (kind === "armor" ? `You have a +${bonus} bonus to Armor Class while wearing this armor.` :
                      kind === "shield" ? `While holding this shield, you have a +${bonus} bonus to AC.` :
                      kind === "ammunition" ? `You have a +${bonus} bonus to attack and damage rolls made with this piece of magic ammunition.` :
                      `You have a +${bonus} bonus to attack and damage rolls made with this magic weapon.`) : "",
        materialText,
        // Variant A text (and show prereq note if any)
        otherA ? ((unmetA ? "" : textA) + (ENHANCEMENT_PREREQS[otherA] ? `\nRequires at least +${ENHANCEMENT_PREREQS[otherA]} enhancement to apply.` : "")) : "",
        // Variant B text
        otherB ? ((unmetB ? "" : textB) + (ENHANCEMENT_PREREQS[otherB] ? `\nRequires at least +${ENHANCEMENT_PREREQS[otherB]} enhancement to apply.` : "")) : "",
      ].filter(Boolean),
    };
    onBuild?.(built);
  }

  return (
    <Modal show={open} onHide={onClose} centered size="lg" className="mvb-modal">
      <div className="p-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h5 m-0">Build Magic Variant</h2>
          <button className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
        </div>

        {/* Kind pills */}
        <div className="d-flex gap-2 mb-3">
          {KINDS.map(k => (
            <button
              key={k}
              type="button"
              className={`btn btn-sm ${kind === k ? "btn-light text-dark" : "btn-outline-light"}`}
              onClick={() => { setKind(k); setMaterial(""); setOtherA(""); setOtherB(""); setOptions({}); }}
            >
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>

        {/* Base */}
        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <label className="form-label fw-semibold">Base {kind === "ammunition" ? "Ammunition" : kind === "shield" ? "Shield" : kind === "armor" ? "Armor" : "Weapon"} (mundane)</label>
            <select
              className="form-select"
              value={baseItem?.id || ""}
              onChange={(e) => {
                const id = e.target.value;
                const next = baseChoices.find(i => String(i.id) === id);
                // reset swords-only picks if switching away
                if (next) {
                  if (!isSword(next.name || next.item_name)) {
                    if (/sword/i.test(otherA)) setOtherA("");
                    if (/sword/i.test(otherB)) setOtherB("");
                  }
                }
                // NOTE: parent passes baseItem, we mirror by lookup id here
                // For simplicity we store a shallow copy
                // (Admin passes onBuild the composite anyway)
              }}
            >
              {[baseItem, ...baseChoices.filter(i => i !== baseItem)].filter(Boolean).map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name || it.item_name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-lg-3">
            <label className="form-label fw-semibold">Bonus (optional)</label>
            <div className="input-group">
              <span className="input-group-text">+N</span>
              <input
                type="number"
                min={0}
                max={3}
                className="form-control"
                value={bonus}
                onChange={(e) => setBonus(Math.max(0, Math.min(3, Number(e.target.value)||0)))}
              />
            </div>
            <div className="form-text">Current Rarity: <span className="text-white">{rarity}</span></div>
          </div>
        </div>

        {/* Material */}
        <div className="row g-3 mt-1">
          <div className="col-12 col-lg-6">
            <label className="form-label fw-semibold">Material (optional)</label>
            <select
              className="form-select"
              value={material || ""}
              onChange={(e) => setMaterial(e.target.value)}
            >
              <option value="">— none —</option>
              {(MATERIALS[kind] || []).map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
            {material && materialText && (
              <div className="form-text mt-1 white">{materialText}</div>
            )}
          </div>

          {/* Other A */}
          <div className="col-12 col-lg-6">
            <label className="form-label fw-semibold">Other A (optional)</label>
            <select
              className="form-select"
              value={otherA || ""}
              onChange={(e) => { setOtherA(e.target.value); setOptions(o => ({...o, [e.target.value]: undefined})); }}
            >
              <option value="">— none —</option>
              {filteredOtherList.map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
            {optionDefA && (
              <div className="mt-2">
                <label className="form-label small">{optionDefA.label}</label>
                <select
                  className="form-select form-select-sm"
                  value={options[otherA] || ""}
                  onChange={(e)=>setOptions(o=>({...o,[otherA]:e.target.value}))}
                >
                  <option value="">— select —</option>
                  {optionDefA.values.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
            {otherA && (
              <div className="form-text mt-1 white">
                {textA || "—"}
                {prereqA ? <div className={`mt-1 ${unmetA ? "text-warning" : "text-success"}`}>
                  Requires at least +{prereqA} enhancement to apply.
                </div> : null}
              </div>
            )}
          </div>
        </div>

        {/* Other B */}
        <div className="row g-3 mt-1">
          <div className="col-12">
            <label className="form-label fw-semibold">Other B (optional)</label>
            <select
              className="form-select"
              value={otherB || ""}
              onChange={(e) => { setOtherB(e.target.value); setOptions(o => ({...o, [e.target.value]: undefined})); }}
            >
              <option value="">— none —</option>
              {filteredOtherList.map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
            {optionDefB && (
              <div className="mt-2">
                <label className="form-label small">{optionDefB.label}</label>
                <select
                  className="form-select form-select-sm"
                  value={options[otherB] || ""}
                  onChange={(e)=>setOptions(o=>({...o,[otherB]:e.target.value}))}
                >
                  <option value="">— select —</option>
                  {optionDefB.values.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
            {otherB && (
              <div className="form-text mt-1 white">
                {textB || "—"}
                {prereqB ? <div className={`mt-1 ${unmetB ? "text-warning" : "text-success"}`}>
                  Requires at least +{prereqB} enhancement to apply.
                </div> : null}
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="mt-3">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <h3 className="h6 m-0">Preview</h3>
            <span className="badge bg-secondary text-uppercase">{rarity}</span>
          </div>
          <div className="p-3 border rounded bg-dark-subtle text-white">
            <div className="fw-semibold mb-2">{composeName()}</div>
            <div className="small" style={{whiteSpace:"pre-wrap"}}>
              {[
                bonus > 0 ? (kind === "armor" ? `You have a +${bonus} bonus to Armor Class while wearing this armor.` :
                                kind === "shield" ? `While holding this shield, you have a +${bonus} bonus to AC.` :
                                kind === "ammunition" ? `You have a +${bonus} bonus to attack and damage rolls made with this piece of magic ammunition.` :
                                `You have a +${bonus} bonus to attack and damage rolls made with this magic weapon.`) : null,
                materialText || null,
                otherA && !unmetA ? textA : null,
                otherB && !unmetB ? textB : null,
                unmetA ? `This enchantment requires at least +${prereqA} enhancement.` : null,
                unmetB ? `This enchantment requires at least +${prereqB} enhancement.` : null,
              ].filter(Boolean).join("\n\n")}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button className="btn btn-outline-light" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!canBuild}
            onClick={handleBuild}
            title={(!baseItem && "Pick a base item") || (unmetA && "Other A needs higher +N") || (unmetB && "Other B needs higher +N") || "Create this variant"}
          >
            Build Variant
          </button>
        </div>
      </div>
    </Modal>
  );
}
