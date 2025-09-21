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
 * Helpers / constants
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

const RESIST_TYPES = ["Acid","Cold","Fire","Force","Lightning","Necrotic","Poison","Psychic","Radiant","Thunder"];
const SLAY_TYPES = ["Aberrations","Beasts","Celestials","Constructs","Dragons","Elementals","Humanoids","Fey","Fiends","Giants","Monstrosities","Oozes","Plants","Undead"];

function normalizeRarity(r) {
  const x = String(r||"").toLowerCase();
  if (x.includes("legend")) return "Legendary";
  if (x.includes("very")) return "Very Rare";
  if (x.includes("rare")) return "Rare";
  if (x.includes("uncommon")) return "Uncommon";
  if (x.includes("common")) return "Common";
  return "—";
}
const RARITY_ORDER = ["Common","Uncommon","Rare","Very Rare","Legendary"];

// Robust 5eTools-ish entry flattener → array of plain strings
function flattenEntries(node) {
  if (!node) return [];
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap((n) => flattenEntries(n));
  if (typeof node === "object") {
    if (Array.isArray(node.entries)) return flattenEntries(node.entries);
    if (Array.isArray(node.items)) return flattenEntries(node.items);
    if (typeof node.entry === "string") return [node.entry];
    if (node.type === "list" && Array.isArray(node.items)) return flattenEntries(node.items);
    if (node.name && typeof node.entry === "string") return [`${node.name}. ${node.entry}`];
    // last‑ditch: try common keys
    const vals = [node.text, node.value, node.caption].filter((v) => typeof v === "string");
    return vals.length ? vals : [];
  }
  return [];
}

// Guess category from the variant's name
function guessCategoryFromName(n) {
  const s = n.toLowerCase();
  if (s.includes("shield")) return "shield";
  if (s.includes("armor")) return "armor";
  if (s.includes("ammunition") || s.includes("arrow") || s.includes("bolt")) return "ammunition";
  return "weapon";
}

// Read window.__MAGIC_VARIANTS__ and normalize to a compact list the builder can use
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
        if (!name || names.has(name)) continue;
        names.add(name);
        const entries = Array.isArray(v?.inherits?.entries)
          ? v.inherits.entries
          : Array.isArray(v?.entries) ? v.entries : [];
        cleaned.push({
          name,
          rarity: normalizeRarity(v?.inherits?.rarity || v?.rarity),
          // store both the raw entries and a pre‑flattened preview for speed
          descRaw: entries,
          desc: flattenEntries(entries),
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

// Variants that need an extra {OPTION} picker and how to format the name
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

// Mundane filter + robust type checks
function isMundane(it) {
  const r = String(it?.rarity || it?.item_rarity || "").toLowerCase();
  return !r || r === "none" || r === "mundane";
}
function isWeapon(it) {
  const ui = (it?.__cls?.uiType || it?.__cls?.rawType || "").toLowerCase();
  if (!ui) return false;
  if (/ammunition/.test(ui)) return false;
  return /weapon/.test(ui);
}
function isArmor(it){
  const ui = (it?.__cls?.uiType || it?.__cls?.rawType || "").toLowerCase();
  return /armor/.test(ui);
}
function isShield(it){
  const ui = (it?.__cls?.uiType || it?.__cls?.rawType || "").toLowerCase();
  return /shield/.test(ui);
}
function isAmmo(it){
  const ui = (it?.__cls?.uiType || it?.__cls?.rawType || "").toLowerCase();
  return /ammunition/.test(ui);
}

/** ──────────────────────────────
 * Main component
 * ───────────────────────────── */
export default function MagicVariantBuilder({ open, onClose, baseItem, allItems = [], onBuild }) {
  // default tab from base item
  const defaultCategory = useMemo(() => {
    const t = baseItem?.__cls?.uiType || baseItem?.__cls?.rawType || "";
    if (/shield/i.test(t)) return "shield";
    if (/armor/i.test(t)) return "armor";
    if (/ammunition/i.test(t)) return "ammunition";
    return "weapon";
  }, [baseItem]);

  const [cat, setCat] = useState(defaultCategory);
  const [base, setBase] = useState(baseItem || null);
  const [mat, setMat] = useState("");
  const [bonus, setBonus] = useState(0);
  const [varA, setVarA] = useState("");
  const [varAOpt, setVarAOpt] = useState("");
  const [varB, setVarB] = useState("");
  const [varBOpt, setVarBOpt] = useState("");

  const canon = useCanonicalVariants(open);

  // Candidate mundane bases only
  const baseChoices = useMemo(() => {
    const list = (allItems||[]).filter((it) => {
      if (!isMundane(it)) return false; // **critical**: only mundane bases
      switch (cat) {
        case "weapon": return isWeapon(it);
        case "armor": return isArmor(it);
        case "shield": return isShield(it);
        case "ammunition": return isAmmo(it);
        default: return false;
      }
    });
    return list.sort((a,b) => String(a.name||a.item_name).localeCompare(String(b.name||b.item_name)));
  }, [allItems, cat]);

  useEffect(() => {
    if (base && baseChoices.includes(base)) return;
    setBase(baseChoices[0] || null);
  }, [baseChoices]); // eslint-disable-line

  // Material choices per tab
  const materialChoices = useMemo(() => MATERIALS.filter((m) => m.appliesTo.includes(cat)), [cat]);

  // Pull canonical variants for this category, dropping +N and material‑prefixed entries
  const otherVariantChoices = useMemo(() => {
    const list = canon.filter((v) => v.category === cat);
    const keep = list.filter((v) => {
      const low = v.name.toLowerCase();
      if (low.startsWith("+1 ") || low.startsWith("+2 ") || low.startsWith("+3 ")) return false;
      if (MATERIALS.some((m) => low.startsWith(m.name.toLowerCase()))) return false;
      return true;
    });
    const seen = new Set();
    const unique = [];
    for (const v of keep) {
      if (seen.has(v.name)) continue; seen.add(v.name);
      unique.push({ key: v.name, label: v.name, rarity: v.rarity, desc: v.desc, raw: v.descRaw });
    }
    unique.sort((a,b) => a.label.localeCompare(b.label));
    return unique;
  }, [canon, cat]);

  const aMeta = optionMeta(varA);
  const bMeta = optionMeta(varB);

  useEffect(() => { setVarAOpt(""); }, [varA]);
  useEffect(() => { setVarBOpt(""); }, [varB]);

  // Naming: "+3 Mithral Breastplate of Cold Resistance"
  const displayName = useMemo(() => {
    if (!base) return "";
    const baseName = String(base.name || base.item_name || "Item");

    const pre = [];
    if (Number(bonus) > 0) pre.push(`+${bonus}`);
    if (mat) { const m = MATERIALS.find((x) => x.key === mat); if (m) pre.push(m.name); }

    const prefixes = [];
    const ofParts = [];

    const addBits = (vName, opt) => {
      if (!vName) return;
      const n = vName.trim();
      const meta = optionMeta(n);
      const ofWithOpt = meta && opt ? meta.titleFmt(opt) : null;

      if (isPrefixVariant(n)) {
        prefixes.push(n.replace(/\s*(sword|weapon)\s*$/i, "").trim());
      } else if (/ of /i.test(n)) {
        const part = n.split(/ of /i)[1]?.trim() || n;
        ofParts.push(ofWithOpt || part);
      } else {
        prefixes.push(n.replace(/\s*(sword|weapon)\s*$/i, "").trim());
      }
    };

    addBits(varA, varAOpt);
    addBits(varB, varBOpt);

    const head = `${pre.concat(prefixes).join(" ").trim()} ${baseName}`.trim();
    return ofParts.length ? `${head} of ${ofParts.join(" And ")}` : head;
  }, [base, bonus, mat, varA, varAOpt, varB, varBOpt]);

  // Compose preview text + computed rarity
  const preview = useMemo(() => {
    const lines = [];
    const rarities = [];

    if (Number(bonus) > 0 && ENHANCEMENT.textByKind[cat]) {
      lines.push(ENHANCEMENT.textByKind[cat].replace("{N}", String(bonus)));
      rarities.push(ENHANCEMENT.rarityByValue[bonus]);
    }

    if (mat) {
      const m = MATERIALS.find((x) => x.key === mat);
      const t = m?.text?.[cat];
      if (t) lines.push(t);
      if (m?.rarity) rarities.push(m.rarity);
    }

    const addVariantLines = (vName, opt) => {
      if (!vName) return;
      const v = otherVariantChoices.find((o) => o.label === vName);
      if (!v) return;

      const flat = Array.isArray(v.desc) ? v.desc : [];
      for (const ln of flat) if (typeof ln === "string" && ln.trim()) lines.push(ln.trim());

      if (requiresPlus3(vName) && Number(bonus) < 3) {
        lines.push("This enchantment requires the item to already be +3 before it may be applied.");
      }

      const meta = optionMeta(vName);
      if (meta && opt) {
        if (/resist/i.test(meta.key)) lines.push(`While wearing/using this item, you have Resistance to ${opt} damage.`);
        if (/slay/i.test(meta.key)) lines.push(`If a ${opt} is damaged by this ammunition, it must save or take extra damage.`);
      }

      if (v.rarity) rarities.push(v.rarity);
    };

    addVariantLines(varA, varAOpt);
    addVariantLines(varB, varBOpt);

    const highest = rarities.reduce((acc, r) => {
      const a = RARITY_ORDER.indexOf(acc);
      const b = RARITY_ORDER.indexOf(r || "—");
      return b > a ? r : acc;
    }, "—");

    return { lines, rarity: highest === "—" ? "none" : highest };
  }, [bonus, cat, mat, otherVariantChoices, varA, varAOpt, varB, varBOpt]);

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
      entries: preview.lines.filter(Boolean)
    };
    onBuild?.(obj);
  }

  // UI helpers
  const materialDesc = useMemo(() => {
    if (!mat) return "";
    const m = MATERIALS.find((x) => x.key === mat);
    return (m?.text?.[cat]) || "";
  }, [mat, cat]);

  const descA = useMemo(() => {
    const v = otherVariantChoices.find((o) => o.label === varA);
    if (!v) return "";
    const s = (v.desc||[]).join(" \n• ");
    return s ? `• ${s}` : "";
  }, [varA, otherVariantChoices]);
  const descB = useMemo(() => {
    const v = otherVariantChoices.find((o) => o.label === varB);
    if (!v) return "";
    const s = (v.desc||[]).join(" \n• ");
    return s ? `• ${s}` : "";
  }, [varB, otherVariantChoices]);

  return (
    <ModalShell open={open} onClose={onClose} title="Build Magic Variant">
      {/* Category pills */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {CATEGORY.map((k) => (
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
          <select className="form-select" value={base?.id || base?.name || ""} onChange={(e) => {
            const val = e.target.value;
            const next = baseChoices.find((it) => (it.id||it.name) === val) || baseChoices.find((it) => (it.name||"") === val) || null;
            setBase(next);
          }}>
            {baseChoices.map((it) => {
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
          <select className="form-select" value={mat} onChange={(e)=>setMat(e.target.value)}>
            <option value="">— none —</option>
            {materialChoices.map((m) => (<option key={m.key} value={m.key}>{m.name}</option>))}
          </select>
          {mat && <div className="form-text text-light mt-1">{materialDesc}</div>}
        </div>

        {/* +N */}
        <div className="col-12 col-lg-6">
          <label className="form-label fw-semibold">Bonus (optional)</label>
          <div className="d-flex gap-2">
            <input className="form-control" value="+N" readOnly style={{maxWidth:120}} />
            <select className="form-select" value={String(bonus)} onChange={(e)=>setBonus(Number(e.target.value))}>
              <option value="0">—</option>
              {ENHANCEMENT.values.map((v) => <option key={v} value={v}>{v}</option>)}
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
          <select className="form-select" value={varA} onChange={(e)=>setVarA(e.target.value)}>
            <option value="">— none —</option>
            {otherVariantChoices.map((v) => (
              <option key={v.key} value={v.label} disabled={requiresPlus3(v.label) && Number(bonus) < 3}>
                {v.label}{requiresPlus3(v.label) ? " (requires +3)" : ""}
              </option>
            ))}
          </select>
          {aMeta && varA && (
            <div className="mt-2">
              <label className="form-label small">{aMeta.label}</label>
              <select className="form-select form-select-sm" value={varAOpt} onChange={(e)=>setVarAOpt(e.target.value)}>
                <option value="">— select —</option>
                {aMeta.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}
          {descA && <div className="small mt-2" style={{whiteSpace:"pre-wrap"}}>{descA}</div>}
        </div>

        {/* Other B */}
        <div className="col-12 col-lg-6">
          <label className="form-label fw-semibold">Other B (optional)</label>
          <select className="form-select" value={varB} onChange={(e)=>setVarB(e.target.value)}>
            <option value="">— none —</option>
            {otherVariantChoices.map((v) => (
              <option key={v.key} value={v.label} disabled={requiresPlus3(v.label) && Number(bonus) < 3}>
                {v.label}{requiresPlus3(v.label) ? " (requires +3)" : ""}
              </option>
            ))}
          </select>
          {bMeta && varB && (
            <div className="mt-2">
              <label className="form-label small">{bMeta.label}</label>
              <select className="form-select form-select-sm" value={varBOpt} onChange={(e)=>setVarBOpt(e.target.value)}>
                <option value="">— select —</option>
                {bMeta.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}
          {descB && <div className="small mt-2" style={{whiteSpace:"pre-wrap"}}>{descB}</div>}
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
        <button className="btn btn-primary" onClick={handleBuild} disabled={!base} title={!base ? "Choose a base item first" : "Create the variant"}>Build Variant</button>
      </div>

      <style jsx>{`
        .mvb-preview{background:#0f1220; border:1px solid #2a2f45; border-radius:8px; padding:12px; color:#fff;}
        .mvb-title{font-weight:700; margin-bottom:6px;}
        .mvb-ul{padding-left:18px; margin:0;}
      `}</style>
    </ModalShell>
  );
}
