import { useEffect, useMemo, useState } from "react";

/** ──────────────────────────────
 * Tiny local modal (no packages)
 * ───────────────────────────── */
function ModalShell({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="mvb-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mvb-modal">
        <div className="mvb-header">
          <h3 className="m-0">{title}</h3>
          <button className="mvb-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="mvb-body">{children}</div>
      </div>

      <style jsx>{`
        .mvb-overlay{position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:1050;
          display:flex; align-items:flex-start; justify-content:center; padding:2rem; overflow:auto;}
        .mvb-modal{background:#141625; color:#fff; border:1px solid #2a2f45; border-radius:12px;
          width:min(980px,100%); box-shadow:0 20px 60px rgba(0,0,0,.5);}
        .mvb-header{display:flex; align-items:center; justify-content:space-between;
          padding:12px 16px; border-bottom:1px solid #2a2f45}
        .mvb-body{padding:16px}
        .mvb-close{background:transparent; border:0; color:#9aa4bf; font-size:22px; cursor:pointer}
        .mvb-close:hover{color:#fff}
      `}</style>
    </div>
  );
}

/** ──────────────────────────────
 * Helpers / data
 * ───────────────────────────── */
const CATEGORY = ["weapon", "armor", "shield", "ammunition"];

const MATERIALS = [
  { key: "adamantine", name: "Adamantine", appliesTo: ["weapon","armor","ammunition"], rarity: "Uncommon",
    text: {
      weapon: "This weapon (or ammunition) is made of adamantine. Whenever it hits an object, the hit is a Critical Hit.",
      armor:  "While wearing this armor, any Critical Hit against you becomes a normal hit.",
      ammunition: "When this ammunition hits an object, the hit is a Critical Hit.",
    }
  },
  { key: "mithral", name: "Mithral", appliesTo: ["armor"], rarity: "Uncommon",
    text: {
      armor: "Mithral is a light, flexible metal. If the base armor normally imposes Disadvantage on Dexterity (Stealth) checks or has a Strength requirement, the mithral version doesn’t."
    }
  },
  { key: "silvered", name: "Silvered", appliesTo: ["weapon","ammunition"], rarity: "Common",
    text: {
      weapon: "An alchemical process has bonded silver to this weapon. When you score a Critical Hit against a shape-shifter, the weapon deals one additional die of damage.",
      ammunition: "Silvered ammunition can overcome some resistances. Ten pieces can be silvered at added cost."
    }
  },
  { key: "ruidium", name: "Ruidium", appliesTo: ["weapon","armor"], rarity: "Very Rare",
    text: {
      weapon: "Ruidium veining grants a swim speed and the ability to breathe water. Strikes deal an extra 2d6 Psychic damage. Risk of Ruidium Corruption on natural 1 attack rolls.",
      armor: "Gain Resistance to Psychic damage, a swim speed, and water breathing. Risk of Ruidium Corruption on natural 1 saving throws."
    }
  },
];

const ENHANCEMENT = { // XDMG rarities
  values: [1,2,3],
  rarityByValue: {1:"Uncommon", 2:"Rare", 3:"Very Rare"},
  textByKind: {
    weapon: "You have a +{N} bonus to attack and damage rolls made with this magic weapon.",
    armor:  "You have a +{N} bonus to Armor Class while wearing this armor.",
    shield: "While holding this shield, you have a +{N} bonus to Armor Class.",
    ammunition: "You have a +{N} bonus to attack and damage with this ammunition; once it hits, it’s no longer magical."
  }
};

// Variants we special‑case for options / gating / naming
const RESIST_TYPES = ["Acid","Cold","Fire","Force","Lightning","Necrotic","Poison","Psychic","Radiant","Thunder"];
const SLAY_TYPES = ["Aberrations","Beasts","Celestials","Constructs","Dragons","Elementals","Humanoids","Fey","Fiends","Giants","Monstrosities","Oozes","Plants","Undead"];

function normalizeRarity(r) {
  const x = String(r||"").toLowerCase();
  if (x.includes("legend")) return "Legendary";
  if (x.includes("very")) return "Very Rare";
  if (x.includes("rare")) return "Rare";
  if (x.includes("uncommon")) return "Uncommon";
  if (x.includes("common")) return "Common";
  if (x.includes("mundane")) return "Mundane";
  return "—";
}
const RARITY_ORDER = ["Common","Uncommon","Rare","Very Rare","Legendary","Artifact"];

// Category checks that avoid Wondrous Items etc.
function fitsCategory(it, cat) {
  const ui = String(it?.__cls?.uiType || it?.__cls?.rawType || it?.type || "").toLowerCase();
  const name = String(it?.name || it?.item_name || "").toLowerCase();
  const notWondrous = !/wondrous/.test(ui) && !/wondrous/.test(name);
  if (!notWondrous) return false;
  if (cat === "weapon") {
    // Allow "weapon", "melee weapon", or "ranged weapon" but not ammunition
    return (/weapon/.test(ui) || /melee/.test(ui) || /ranged/.test(ui)) && !/ammunition|ammo|arrow|bolt/.test(ui);
  }
  if (cat === "armor") return /armor/.test(ui);
  if (cat === "shield") return /shield/.test(ui);
  if (cat === "ammunition") return /ammunition|ammo|arrow|bolt/.test(ui);
  return false;
}

// Strict Mundane detection like the working older build
function isMundane(it) {
  // Many data shapes: tier, item_tier, rarity, item_rarity, tags, magic flags
  const bag = [it?.tier, it?.item_tier, it?.rarity, it?.item_rarity, it?.rarity_name, it?.__cls?.tier]
    .filter(Boolean)
    .map(s => String(s).toLowerCase());

  // Hard exclusions first
  const anyIsMagicish = bag.some(t => /(artifact|legend|very\s*rare|rare|uncommon)/.test(t));
  if (anyIsMagicish) return false;
  if (String(it?.requires_attunement || it?.attunement || "").trim()) return false;

  const typeStr = String(it?.type || it?.__cls?.uiType || "").toLowerCase();
  if (/wondrous/.test(typeStr)) return false;

  // Prefer explicit Mundane flag when present
  if (bag.some(t => /mundane/.test(t))) return true;

  // Fallbacks: allow truly non‑magic mundane base gear sometimes marked "Common"
  const name = String(it?.name || it?.item_name || "").toLowerCase();
  const looksLikeBaseGear = /club|dagger|sword|axe|mace|spear|bow|crossbow|hammer|staff|gladius|glaive|greataxe|greatsword|halberd|javelin|lance|maul|pick|pike|quarterstaff|rapier|scimitar|shortsword|sickle|trident|warhammer|whip|yklwa|breastplate|chain|plate|leather|scale|shield/.test(name);
  const hasNoMagicFlags = !/blackrazor|avernus|holy avenger|vorpal|dancing|flame tongue|vicious|sharpness|sword of|bane|slaying|oathbow|sun blade|frost brand|defender|dwarven thrower|trident of/.test(name);
  const claimsCommonOnly = bag.some(t => /common/.test(t));
  if (looksLikeBaseGear && hasNoMagicFlags && (claimsCommonOnly || bag.length === 0)) return true;

  return false; // default to exclude if uncertain
}

// Rough heuristics to route canonical variants to a category
function guessCategoryFromName(n) {
  const s = n.toLowerCase();
  if (s.includes("shield")) return "shield";
  if (s.includes("armor")) return "armor";
  if (s.includes("ammunition") || s.includes("arrow") || s.includes("bolt")) return "ammunition";
  return "weapon";
}

// Parse window.__MAGIC_VARIANTS__ (if Admin loaded it) to a clean list
function useCanonicalVariants(open) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!open) return;
    try {
      const raw = (typeof window !== "undefined" && window.__MAGIC_VARIANTS__) || [];
      const names = new Set();
      const cleaned = [];
      for (const v of raw) {
        const name = String(v?.name || "").trim();
        if (!name) continue;
        if (names.has(name)) continue;
        names.add(name);
        cleaned.push({
          name,
          rarity: normalizeRarity(v?.inherits?.rarity || v?.rarity),
          desc: Array.isArray(v?.inherits?.entries) ? v.inherits.entries : (Array.isArray(v?.entries) ? v.entries : []),
          category: guessCategoryFromName(name)
        });
      }
      setList(cleaned);
    } catch {
      setList([]);
    }
  }, [open]);
  return list;
}

// Variants that need an extra {OPTION} picker and how to format the title piece
function optionMeta(name) {
  const n = String(name||"").toLowerCase();
  if (n === "armor of resistance") {
    return { key: "resist", label: "Resistance Type", options: RESIST_TYPES, titleFmt: (opt) => `${opt} Resistance` };
  }
  if (n === "ammunition of slaying" || n === "arrow of slaying (*)") {
    return { key: "slay", label: "Creature Type", options: SLAY_TYPES, titleFmt: (opt) => `Slaying (${opt})` };
  }
  return null;
}

// Some big‑name prefixes + gating
function isPrefixVariant(name) {
  const n = String(name||"").toLowerCase();
  return (
    n.startsWith("dancing ") ||
    n.startsWith("flame tongue") ||
    n.startsWith("vorpal ") ||
    n.startsWith("vicious ") ||
    n.startsWith("moon-touched") ||
    n.startsWith("sylvan talon")
  );
}
function requiresPlus3(name) { return /^vorpal\b/i.test(String(name||"")); }

/** ──────────────────────────────
 * Main Builder
 * ───────────────────────────── */
export default function MagicVariantBuilder({ open, onClose, baseItem, allItems = [], onBuild }) {
  // category from base item or default to weapon
  const defaultCategory = useMemo(() => {
    const t = baseItem?.__cls?.uiType || "";
    if (/shield/i.test(t)) return "shield";
    if (/armor/i.test(t)) return "armor";
    if (/ammunition/i.test(t)) return "ammunition";
    return "weapon";
  }, [baseItem]);

  const [cat, setCat] = useState(defaultCategory);
  const [base, setBase] = useState(baseItem || null);

  const [mat, setMat] = useState("");          // material key
  const [bonus, setBonus] = useState(0);       // 0,1,2,3
  const [varA, setVarA] = useState("");        // other variant A (by name)
  const [varAOpt, setVarAOpt] = useState("");  // chosen {OPTION} for A (if any)
  const [varB, setVarB] = useState("");        // other variant B
  const [varBOpt, setVarBOpt] = useState("");

  // canonical variants (if Admin loaded them)
  const canon = useCanonicalVariants(open);

  // Keep base item aligned with chosen category
  const baseChoices = useMemo(() => {
    // 1) filter by category; 2) require mundane; 3) strong exclusions for named magic
    const arr = (allItems || []).filter(it => fitsCategory(it, cat) && isMundane(it));

    // Fallback: if nothing found (in case of data shape changes), try a relaxed pass but still ban named magic
    if (arr.length === 0) {
      const relaxed = (allItems || []).filter(it => fitsCategory(it, cat)).filter(it => {
        const name = String(it?.name || it?.item_name || "").toLowerCase();
        const notNamedMagic = !/blackrazor|blade of avernus|holy avenger|sun blade|oathbow|frost brand|flame tongue|defender|vorpal|dancing|sword of|trident of|dwarven thrower/.test(name);
        const noAttunement = !String(it?.attunement || it?.requires_attunement || "").trim();
        const r = normalizeRarity(it?.rarity || it?.item_rarity || it?.tier || it?.item_tier || it?.rarity_name);
        const mundaneish = r === "Mundane" || r === "Common" || r === "—";
        return notNamedMagic && noAttunement && mundaneish;
      });
      return relaxed.sort((a,b) => String(a.name||a.item_name).localeCompare(String(b.name||b.item_name)));
    }

    return arr.sort((a,b) => String(a.name||a.item_name).localeCompare(String(b.name||b.item_name)));
  }, [allItems, cat]);

  useEffect(() => {
    if (base && baseChoices.includes(base)) return;
    setBase(baseChoices[0] || null);
  }, [baseChoices]); // eslint-disable-line

  // Material options for the chosen category
  const materialChoices = useMemo(
    () => MATERIALS.filter(m => m.appliesTo.includes(cat)),
    [cat]
  );

  // Build list of other variants using canonical names + a few rules
  const otherVariantChoices = useMemo(() => {
    const list = canon.filter(v => v.category === cat);

    // Weed out materials and pure +N things if they sneak in via canon
    const keep = list.filter(v => {
      const low = v.name.toLowerCase();
      if (low.startsWith("+1 ") || low.startsWith("+2 ") || low.startsWith("+3 ")) return false;
      if (MATERIALS.some(m => low.startsWith(m.name.toLowerCase()))) return false;
      return true;
    });

    // Deduplicate by clean label
    const seen = new Set();
    const unique = [];
    for (const v of keep) {
      const key = v.name;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ label: v.name, rarity: v.rarity, desc: v.desc });
    }

    // Sort alphabetically for easier scanning
    unique.sort((a,b) => a.label.localeCompare(b.label));

    return unique;
  }, [canon, cat]);

  // Enforce Vorpal gating
  const varAisDisabled = (name) => requiresPlus3(name) && Number(bonus) < 3;
  const varBisDisabled = (name) => requiresPlus3(name) && Number(bonus) < 3;

  // Set/clear sub-options when the variant changes
  useEffect(() => { setVarAOpt(""); }, [varA]);
  useEffect(() => { setVarBOpt(""); }, [varB]);

  // Compose the display name (e.g., “+3 Mithral Breastplate of Acid Resistance”)
  const displayName = useMemo(() => {
    if (!base) return "";

    const baseName = String(base.name || base.item_name || "Item");

    const piecesPre = [];
    if (Number(bonus) > 0) piecesPre.push(`+${bonus}`);
    if (mat) {
      const m = MATERIALS.find(x => x.key === mat);
      if (m) piecesPre.push(m.name);
    }

    // Collect prefixes (“Dancing”, “Vorpal”, …) and “of” parts (“… of Warning”)
    const prefixes = [];
    const ofParts = [];

    function addVariantBits(vName, opt) {
      if (!vName) return;
      const n = vName.trim();

      // {OPTION} aware titles
      const meta = optionMeta(n);
      const ofWithOpt = meta && opt ? meta.titleFmt(opt) : null;

      if (isPrefixVariant(n)) {
        // e.g. “Vorpal Sword” → “Vorpal”
        prefixes.push(n.replace(/\s*(sword|weapon)\s*$/i, "").trim());
      } else if (/ of /i.test(n)) {
        const part = n.split(/ of /i)[1]?.trim() || n;
        ofParts.push(ofWithOpt || part);
      } else {
        // Fallback: treat as prefix (“Sylvan Talon”, etc.)
        prefixes.push(n.replace(/\s*(sword|weapon)\s*$/i, "").trim());
      }
    }

    addVariantBits(varA, varAOpt);
    addVariantBits(varB, varBOpt);

    const pre = (piecesPre.concat(prefixes)).join(" ").trim();
    const head = pre ? `${pre} ${baseName}` : baseName;
    return ofParts.length ? `${head} of ${ofParts.join(" And ")}` : head;
  }, [base, bonus, mat, varA, varAOpt, varB, varBOpt]);

  // Build the preview description list + computed rarity
  const preview = useMemo(() => {
    const lines = [];
    let rarities = [];

    // enhancement
    if (Number(bonus) > 0 && ENHANCEMENT.textByKind[cat]) {
      lines.push(ENHANCEMENT.textByKind[cat].replace("{N}", String(bonus)));
      rarities.push(ENHANCEMENT.rarityByValue[bonus]);
    }

    // material
    if (mat) {
      const m = MATERIALS.find(x => x.key === mat);
      const t = m?.text?.[cat];
      if (t) lines.push(t);
      if (m?.rarity) rarities.push(m.rarity);
    }

    // other variants
    function addVariantText(vName, opt) {
      if (!vName) return;
      const v = otherVariantChoices.find(o => o.label === vName);
      if (!v) return;

      // include canonical description (first few entries as joined text)
      if (Array.isArray(v.desc) && v.desc.length) {
        const joined = v.desc
          .map(e => (typeof e === "string" ? e : (e?.entries ? (Array.isArray(e.entries) ? e.entries.join(" ") : "") : "")))
          .join(" ");
        if (joined) lines.push(joined);
      }

      // gating text
      if (requiresPlus3(vName) && Number(bonus) < 3) {
        lines.push("This item must have a +3 before this enchant may be applied.");
      }

      // Option hint line
      const meta = optionMeta(vName);
      if (meta && opt) {
        if (/resist/i.test(meta.key)) {
          lines.push(`While wearing/using this item, you have Resistance to ${opt} damage.`);
        }
        if (/slay/i.test(meta.key)) {
          lines.push(`If a ${opt} is damaged by this ammunition, it must save or take extra damage.`);
        }
      }

      if (v.rarity) rarities.push(v.rarity);
    }
    addVariantText(varA, varAOpt);
    addVariantText(varB, varBOpt);

    // compute highest rarity
    const highest = rarities.reduce((acc, r) => {
      const a = RARITY_ORDER.indexOf(acc);
      const b = RARITY_ORDER.indexOf(r || "—");
      return b > a ? r : acc;
    }, "—");

    return { lines, rarity: highest === "—" ? "none" : highest };
  }, [bonus, cat, mat, otherVariantChoices, varA, varAOpt, varB, varBOpt]);

  // Build object to return when “Build Variant” is clicked
  function handleBuild() {
    if (!base) return;
    const obj = {
      name: displayName,
      rarity: preview.rarity,
      baseId: base.id || base._id,
      baseName: base.name || base.item_name,
      category: cat,
      bonus,
      material: mat || null,
      variantA: varA || null,
      variantAOption: varAOpt || null,
      variantB: varB || null,
      variantBOption: varBOpt || null,
      // minimal text blob you can save; card component will format
      entries: preview.lines.filter(Boolean)
    };
    onBuild?.(obj);
  }

  // UI bits
  const materialDesc = useMemo(() => {
    if (!mat) return "";
    const m = MATERIALS.find(x => x.key === mat);
    return (m?.text?.[cat]) || "";
  }, [mat, cat]);

  const aMeta = optionMeta(varA);
  const bMeta = optionMeta(varB);

  return (
    <ModalShell open={open} onClose={onClose} title="Build Magic Variant">
      {/* Category pills */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {CATEGORY.map(k => (
          <button
            key={k}
            className={`btn btn-sm ${cat === k ? "btn-light text-dark" : "btn-outline-light"}`}
            onClick={() => { setCat(k); setMat(""); setVarA(""); setVarB(""); }}
          >
            {k[0].toUpperCase()+k.slice(1)}
          </button>
        ))}
      </div>

      {/* Base item */}
      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <label className="form-label fw-semibold">Base {cat === "ammunition" ? "Ammunition" : cat === "armor" ? "Armor" : cat === "shield" ? "Shield" : "Weapon"} (mundane)</label>
          <select
            className="form-select text-white"
            value={base?.id || base?.name || ""}
            onChange={(e) => {
              const val = e.target.value;
              const next = baseChoices.find(it => (it.id||it.name) === val) || baseChoices.find(it => (it.name||"") === val) || null;
              setBase(next);
            }}
          >
            {baseChoices.map(it => {
              const id = it.id || it.name;
              const nm = it.name || it.item_name;
              return <option key={id} value={id}>{nm}</option>;
            })}
          </select>
        </div>

        <div className="col-12 col-lg-6">
          <label className="form-label fw-semibold">Current Rarity</label>
          <input className="form-control" value={preview.rarity} readOnly />
        </div>

        {/* Material */}
        <div className="col-12 col-lg-6">
          <label className="form-label fw-semibold">Material (optional)</label>
          <select className="form-select text-white" value={mat} onChange={(e)=>setMat(e.target.value)}>
            <option value="">— none —</option>
            {materialChoices.map(m => (<option key={m.key} value={m.key}>{m.name}</option>))}
          </select>
          {mat && <div className="form-text text-light mt-1">{materialDesc}</div>}
        </div>

        {/* +N */}
        <div className="col-12 col-lg-6">
          <label className="form-label fw-semibold">Bonus (optional)</label>
          <div className="d-flex gap-2">
            <input className="form-control" value="+N" readOnly style={{maxWidth:120}} />
            <select className="form-select text-white" value={String(bonus)} onChange={(e)=>setBonus(Number(e.target.value))}>
              <option value="0">—</option>
              {ENHANCEMENT.values.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          {Number(bonus) > 0 && (
            <div className="form-text text-light mt-1">
              {ENHANCEMENT.textByKind[cat].replace("{N}", String(bonus))}
            </div>
          )}
        </div>

        {/* Other A */}
        <div className="col-12 col-lg-6">
          <label className="form-label fw-semibold">Other A (optional)</label>
          <select
            className="form-select text-white"
            value={varA}
            onChange={(e)=>setVarA(e.target.value)}
          >
            <option value="">— none —</option>
            {otherVariantChoices.map(v => (
              <option key={v.label} value={v.label} disabled={varAisDisabled(v.label)}>
                {v.label}{requiresPlus3(v.label) ? " (requires +3)" : ""}
              </option>
            ))}
          </select>
          {aMeta && varA && (
            <div className="mt-2">
              <label className="form-label small">{aMeta.label}</label>
              <select className="form-select form-select-sm text-white" value={varAOpt} onChange={(e)=>setVarAOpt(e.target.value)}>
                <option value="">— select —</option>
                {aMeta.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Other B */}
        <div className="col-12 col-lg-6">
          <label className="form-label fw-semibold">Other B (optional)</label>
          <select
            className="form-select text-white"
            value={varB}
            onChange={(e)=>setVarB(e.target.value)}
          >
            <option value="">— none —</option>
            {otherVariantChoices.map(v => (
              <option key={v.label} value={v.label} disabled={varBisDisabled(v.label)}>
                {v.label}{requiresPlus3(v.label) ? " (requires +3)" : ""}
              </option>
            ))}
          </select>
          {bMeta && varB && (
            <div className="mt-2">
              <label className="form-label small">{bMeta.label}</label>
              <select className="form-select form-select-sm text-white" value={varBOpt} onChange={(e)=>setVarBOpt(e.target.value)}>
                <option value="">— select —</option>
                {bMeta.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="mt-3">
        <div className="d-flex align-items-center justify-content-between">
          <h5 className="m-0">Preview</h5>
          <span className="badge bg-secondary">{preview.rarity}</span>
        </div>
        <div className="mvb-preview mt-2">
          <div className="mvb-title">{displayName}</div>
          {preview.lines.length === 0 ? (
            <div className="text-muted">Choose options to see details.</div>
          ) : (
            <ul className="mvb-ul">
              {preview.lines.map((ln, i) => <li key={i}>{ln}</li>)}
            </ul>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="d-flex justify-content-end gap-2 mt-3">
        <button className="btn btn-outline-light" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-primary"
          onClick={handleBuild}
          disabled={!base}
          title={!base ? "Choose a base item first" : "Create the variant"}
        >
          Build Variant
        </button>
      </div>

      <style jsx>{`
        .mvb-preview{background:#0f1220; border:1px solid #2a2f45; border-radius:8px; padding:12px; color:#fff;}
        .mvb-title{font-weight:700; margin-bottom:6px;}
        .mvb-ul{padding-left:18px; margin:0;}
      `}</style>
    </ModalShell>
  );
}
