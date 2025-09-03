// components/VariantBuilder.jsx
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, Trash2, Shield, Swords, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const RARITY_ORDER = ["common","uncommon","rare","very rare","legendary","artifact"];
const isVestigeName = (n) => /\b(dormant|awakened|exalted)\b/i.test(n || "");
const isMundaneWeaponOrArmor = (it) => {
  if (!it || typeof it !== "object") return false;
  const r = String(it.rarity || "none").toLowerCase();
  if (r !== "none") return false;
  const t = String(it.uiType || it.type || "");
  return /weapon|armor|shield/i.test(t);
};
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
const deepMerge = (target, patch) => {
  if (patch == null) return target;
  const out = { ...target };
  for (const [k, v] of Object.entries(patch)) {
    if (v == null) continue;
    const cur = out[k];
    if (Array.isArray(v)) out[k] = uniq([...(Array.isArray(cur) ? cur : []), ...v]);
    else if (typeof v === "object" && !Array.isArray(v)) out[k] = deepMerge(cur || {}, v);
    else out[k] = v;
  }
  return out;
};
const getRarityRank = (r) => {
  const i = RARITY_ORDER.indexOf(String(r || "").toLowerCase());
  return i === -1 ? -1 : i;
};
const pickMaxRarity = (a, b) => (getRarityRank(b) > getRarityRank(a) ? b : a);
const normBonus = (val) => {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const m = String(val).match(/[+-]?(\d+)/);
  return m ? Number(m[1]) : null;
};
function renderVariantName(baseName, variants) {
  const prefixes = [], suffixOf = [], extras = [];
  variants.forEach((v) => {
    if (!v) return;
    const nm = String(v.name || v.label || "").trim();
    if (v.nameTemplate) {
      let out = v.nameTemplate.replaceAll("{base}", baseName).replaceAll("{name}", nm);
      const b = normBonus(v.bonusWeapon || v.bonusAc || v.bonusSpellAttack);
      if (b != null) out = out.replaceAll("{bonus}", String(b));
      baseName = out;
      return;
    }
    if (/^\+\d/.test(nm)) prefixes.push(nm);
    else if (/\bof\b/i.test(nm)) suffixOf.push(nm.replace(/^[^o]*of\s+/i, "of "));
    else if (v.prefix) prefixes.push(v.prefix);
    else if (v.of) suffixOf.push("of " + v.of);
    else if (v.suffix) suffixOf.push(v.suffix.startsWith("of ") ? v.suffix : "of " + v.suffix);
    else extras.push(nm);
  });
  const pre = prefixes.concat(extras).join(" ").trim();
  const suf = suffixOf.join(" and ").trim();
  return [pre, baseName, suf].filter(Boolean).join(pre ? " " : "").replace(/\s+of\s+$/, "");
}
function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a);
  a.click(); a.remove(); URL.revokeObjectURL(url);
}
function composeItem(base, variantList, allItems) {
  if (!base) return null;
  const variants = variantList.filter(Boolean);
  const out = JSON.parse(JSON.stringify(base));
  out._composed = true;
  out.baseItem = base.baseItem || base.name;
  let accRarity = "common";
  variants.forEach((v) => (accRarity = pickMaxRarity(accRarity, v.rarity)));
  out.rarity = accRarity;
  variants.forEach((v) => {
    const generic = { ...(v.effects || {}), ...(v.delta || {}), ...(v.mod || {}), ...v };
    ["name","id","category","tags","source","page","prefix","suffix","of","nameTemplate","rarity"]
      .forEach((k) => delete generic[k]);
    ["bonusWeapon","bonusAc","bonusShield","bonusSpellAttack","bonusSpellSaveDc"].forEach((k) => {
      const curN = normBonus(out[k]);
      const nextN = normBonus(v[k] ?? generic[k]);
      if (nextN != null && (curN == null || nextN > curN)) out[k] = `+${nextN}`;
      delete generic[k];
    });
    ["property","resist","conditionImmune","miscTags","mastery"].forEach((k) => {
      const cur = Array.isArray(out[k]) ? out[k] : [];
      const nxt = Array.isArray(v[k]) ? v[k] : [];
      out[k] = uniq([...cur, ...nxt]);
      delete generic[k];
    });
    const entryBits = [];
    if (v.entries?.length) entryBits.push(...v.entries);
    if (typeof v.item_description === "string") entryBits.push(v.item_description);
    if (entryBits.length) {
      out.entries = [...(out.entries || []), ...entryBits];
      out.item_description = [
        ...(Array.isArray(out.item_description) ? out.item_description : [out.item_description].filter(Boolean)),
        ...entryBits,
      ].join("\n\n");
    }
    Object.assign(out, deepMerge(out, generic));
  });
  out.name = renderVariantName(base.name, variants);
  if (allItems?.length) {
    const canon = allItems.find((x) => String(x.name).toLowerCase() === out.name.toLowerCase());
    if (canon && String(canon.rarity || "none").toLowerCase() !== "none") {
      out._matchesCanon = true;
      out._canonSource = `${canon.source || ""}${canon.page ? ` p.${canon.page}` : ""}`.trim();
    }
  }
  if (variants.length > 0 && out.rarity === "none") out.rarity = "uncommon";
  return out;
}

function SearchList({ items, onSelect, icon, placeholder = "Search..." }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((it) => it.label.toLowerCase().includes(s)) : items;
  }, [q, items]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">{icon}{placeholder}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to filter" />
        <ScrollArea className="h-72 rounded-md border p-2">
          <div className="space-y-1">
            {filtered.map((it) => (
              <button
                key={it.id}
                className="w-full text-left px-2 py-1 rounded hover:bg-muted/60"
                onClick={() => onSelect(it)}
                title={it.hint || it.label}
              >
                <span className="font-medium">{it.label}</span>
                {it.sub && <span className="text-xs text-muted-foreground"> — {it.sub}</span>}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-sm text-muted-foreground py-4 text-center">No matches</div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function Pill({ children }) {
  return <Badge variant="secondary" className="rounded-2xl px-3 py-1 text-xs">{children}</Badge>;
}

// 🔧 accepts onApply(newItem) — our single addition
export default function VariantBuilder({ allItems, magicVariants, onApply }) {
  allItems = allItems || (typeof window !== "undefined" ? window.__ALL_ITEMS__ : []) || [];
  magicVariants = magicVariants || (typeof window !== "undefined" ? window.__MAGIC_VARIANTS__ : []) || [];

  const bases = useMemo(() => (
    allItems.filter(isMundaneWeaponOrArmor)
      .map((b, i) => ({ id: `b-${i}`, raw: b, label: b.name, sub: b.uiType || b.type || "", hint: b.propertiesText || "" }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ), [allItems]);

  const variants = useMemo(() => (
    magicVariants.filter((v) => v && v.name && !isVestigeName(v.name))
      .map((v, i) => ({ id: `v-${i}`, raw: v, label: v.name, sub: v.rarity || "", hint: (v.entries && v.entries[0]) || "" }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ), [magicVariants]);

  const [selectedBase, setSelectedBase] = useState(null);
  const [selectedVariants, setSelectedVariants] = useState([]);
  const composed = useMemo(
    () => composeItem(selectedBase?.raw, selectedVariants, allItems),
    [selectedBase, selectedVariants, allItems]
  );

  const addVariant = (v) => {
    if (!v?.raw) return;
    if (selectedVariants.length >= 4) return;
    setSelectedVariants((prev) => (prev.find((x) => x.name === v.raw.name) ? prev : [...prev, v.raw]));
  };
  const removeVariant = (name) => setSelectedVariants((prev) => prev.filter((x) => x.name !== name));
  const clearAll = () => setSelectedVariants([]);

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="col-span-1">
        <SearchList items={bases} onSelect={setSelectedBase} placeholder="Choose base (weapon/armor)" icon={<Swords className="w-4 h-4" />} />
      </div>

      <div className="col-span-1">
        <SearchList items={variants} onSelect={addVariant} placeholder="Add up to 4 variants" icon={<Sparkles className="w-4 h-4" />} />
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedVariants.map((v) => (
            <motion.div layout key={v.name}>
              <Badge variant="outline" className="gap-2">
                {v.name}
                <button className="ml-2" onClick={() => removeVariant(v.name)} title="Remove">
                  <Trash2 className="w-3 h-3" />
                </button>
              </Badge>
            </motion.div>
          ))}
          {selectedVariants.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 px-2">Clear</Button>
          )}
        </div>
      </div>

      <div className="col-span-1">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" /> Result</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedBase && <div className="text-sm text-muted-foreground">Pick a base to begin.</div>}
            {selectedBase && (
              <div className="space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Name</div>
                  <div className="text-lg font-semibold">{composed?.name || selectedBase.label}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><div className="text-xs uppercase tracking-wider text-muted-foreground">Base</div><div>{selectedBase.label}</div></div>
                  <div><div className="text-xs uppercase tracking-wider text-muted-foreground">Rarity</div><div>{(composed?.rarity || "uncommon").replace(/\b\w/g, (m) => m.toUpperCase())}</div></div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Bonuses</div>
                    <div className="space-x-2">
                      {composed?.bonusWeapon && <Pill>Attack/Damage {composed.bonusWeapon}</Pill>}
                      {composed?.bonusAc && <Pill>AC {composed.bonusAc}</Pill>}
                      {composed?.bonusSpellAttack && <Pill>Spell ATK {composed.bonusSpellAttack}</Pill>}
                      {composed?.bonusSpellSaveDc && <Pill>Save DC {composed.bonusSpellSaveDc}</Pill>}
                      {!composed?.bonusWeapon && !composed?.bonusAc && !composed?.bonusSpellAttack && !composed?.bonusSpellSaveDc && (<span className="text-muted-foreground">—</span>)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Traits</div>
                    <div className="flex flex-wrap gap-1">
                      {(composed?.property || []).slice(0, 6).map((p) => (<Pill key={p}>{p}</Pill>))}
                      {(composed?.property || []).length === 0 && <span className="text-muted-foreground">—</span>}
                    </div>
                  </div>
                </div>

                {composed?._matchesCanon && (
                  <div className="text-xs p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
                    Heads-up: this name matches a canon magic item in your database ({composed._canonSource}).
                    Keeping it as a composed variant per your rule, but consider linking to the real item if desired.
                  </div>
                )}

                <Separator className="my-2" />

                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">JSON</div>
                <ScrollArea className="h-56 rounded-md border">
                  <pre className="text-xs p-3 whitespace-pre-wrap">
                    {JSON.stringify(composed || selectedBase.raw, null, 2)}
                  </pre>
                </ScrollArea>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      downloadJSON(
                        `${(composed?.name || selectedBase.label).replace(/[^a-z0-9]+/gi, "-")}.json`,
                        composed || selectedBase.raw
                      )
                    }
                  >
                    <Download className="w-4 h-4 mr-2" /> Export JSON
                  </Button>

                  {/* ✅ new: hand back to Admin */}
                  {onApply && composed && (
                    <Button size="sm" variant="secondary" onClick={() => onApply(composed)}>
                      Use in Admin
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="col-span-1 lg:col-span-3 text-xs text-muted-foreground pt-1">
        <strong>Rules of the road:</strong> Bases are strictly mundane Weapon/Armor/Shield items
        pulled from <code>all-items.json</code>. Variants are taken from <code>magicvariants.json</code>
        and merged conservatively (arrays union, numeric bonuses keep the highest). We never coerce
        existing magic items into variant form. Vestige states are hidden from the variant list.
      </div>
    </div>
  );
}
