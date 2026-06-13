from pathlib import Path

path = Path("pages/items.js")
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


# State and catalog loading.
replace_once(
    '  const [alchemySection, setAlchemySection] = useState("All");\n  const [alchemyGroup, setAlchemyGroup] = useState("All");',
    '  const [alchemySection, setAlchemySection] = useState("All");\n  const [alchemyGroup, setAlchemyGroup] = useState("All");\n  const [enchantingSection, setEnchantingSection] = useState("All");',
    "enchanting state",
)
replace_once(
    '        const [authResponse, itemsJson, alchemyCatalogJson, coreVariants, hbVariants, dbRecipes, inventoryRows, plantRows, plantCatalogRows, dbCatalogRows, knownRows, craftPlanRows, craftAttemptRows, characterRows, recipeRuleRows, materialEffectRows, locationRows, forageTableRows, forageEntryRows] = await Promise.all([',
    '        const [authResponse, itemsJson, flavorOverrides, alchemyCatalogJson, coreVariants, hbVariants, dbRecipes, inventoryRows, plantRows, plantCatalogRows, dbCatalogRows, knownRows, craftPlanRows, craftAttemptRows, characterRows, recipeRuleRows, materialEffectRows, locationRows, forageTableRows, forageEntryRows] = await Promise.all([',
    "load destructuring",
)
replace_once(
    '          json("/items/all-items.json", true),\n          json("/items/alchemy-catalog.json"),',
    '          json("/items/all-items.json", true),\n          json("/items/flavor-overrides.json"),\n          json("/items/alchemy-catalog.json"),',
    "flavor override fetch",
)
replace_once(
    '          ...rows(itemsJson).filter(isForgeItem).map(forgeRecipe),',
    '          ...rows(itemsJson).filter(isForgeItem).map((item) => forgeRecipe(item, flavorOverrides || {})),',
    "forge flavor integration",
)
replace_once(
    '        const dbAlchemyCatalogRows = rows(dbCatalogRows).filter((row) => row?.payload?.alchemy);',
    '        const dbAlchemyCatalogRows = rows(dbCatalogRows).filter((row) => row?.payload?.alchemy || row?.payload?.smithing);',
    "smithing catalog rows",
)

# Counts and recipe filtering.
marker = '  const filteredRecipes = useMemo(() => recipes.filter((r) => {'
addition = '''  const enchantingSectionCounts = useMemo(() => {
    const counts = Object.fromEntries(ENCHANTING_SECTIONS.map((section) => [section, 0]));
    recipes.filter((recipe) => recipe.discipline === "Enchanting").forEach((recipe) => {
      counts.All += 1;
      enchantingSectionsForRecipe(recipe).forEach((section) => {
        counts[section] = (counts[section] || 0) + 1;
      });
    });
    return counts;
  }, [recipes]);
'''
if addition not in text:
    replace_once(marker, addition + marker, "enchanting counts")
replace_once(
    '    const groupMatch = alchemyGroup === "All" || (r.discipline === "Alchemy" && alchemyGroupForRecipe(r) === alchemyGroup);\n    return disciplineMatch && sectionMatch && groupMatch && (rarityFilter === "All" || r.rarity === rarityFilter) && (knowledge !== "Known" || r.known) && (knowledge !== "Reference" || !r.known) && matches(r, query);',
    '    const groupMatch = alchemyGroup === "All" || (r.discipline === "Alchemy" && alchemyGroupForRecipe(r) === alchemyGroup);\n    const enchantingMatch = enchantingSection === "All" || (r.discipline === "Enchanting" && enchantingSectionsForRecipe(r).includes(enchantingSection));\n    return disciplineMatch && sectionMatch && groupMatch && enchantingMatch && (rarityFilter === "All" || r.rarity === rarityFilter) && (knowledge !== "Known" || r.known) && (knowledge !== "Reference" || !r.known) && matches(r, query);',
    "enchanting filter",
)
replace_once(
    '  }), [recipes, discipline, alchemySection, alchemyGroup, rarityFilter, knowledge, query]);',
    '  }), [recipes, discipline, alchemySection, alchemyGroup, enchantingSection, rarityFilter, knowledge, query]);',
    "enchanting filter dependencies",
)

# Reset logic and category selection.
replace_once(
    '      setAlchemySection("All");\n      setAlchemyGroup("All");',
    '      setAlchemySection("All");\n      setAlchemyGroup("All");\n      setEnchantingSection("All");',
    "router reset",
)
replace_once(
    '  const clear = () => { setQuery(""); setDiscipline("All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All"); };',
    '  const clear = () => { setQuery(""); setDiscipline("All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); };',
    "clear reset",
)
replace_once(
    '      setDiscipline("All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All");',
    '      setDiscipline("All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All");',
    "quick all reset",
)
replace_once(
    '      setDiscipline(p); setKnowledge("All"); setAlchemySection("All"); setAlchemyGroup("All");',
    '      setDiscipline(p); setKnowledge("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All");',
    "quick discipline reset",
)
replace_once(
    '''  function chooseAlchemySection(section) {''',
    '''  function chooseEnchantingSection(section) {
    setDiscipline("Enchanting");
    setKnowledge("All");
    setEnchantingSection(section);
    setCraftingRecipeId(null);
    const next = recipes.find((recipe) => recipe.discipline === "Enchanting" && (section === "All" || enchantingSectionsForRecipe(recipe).includes(section)));
    if (next) setSelected(next);
  }

  function chooseAlchemySection(section) {''',
    "enchanting chooser",
)
replace_once(
    '    <div className="craft-controls"><div className="craft-control-wide"><label className="form-label fw-semibold">Search</label><input className="form-control craft-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes, enchants, reagents, monster parts…" /></div><div><label className="form-label fw-semibold">Discipline</label><select className="form-select craft-input" value={discipline} onChange={(e) => { const next = e.target.value; setDiscipline(next); if (next !== "Alchemy") { setAlchemySection("All"); setAlchemyGroup("All"); } }}>{disciplineOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></div>',
    '    <div className="craft-controls"><div className="craft-control-wide"><label className="form-label fw-semibold">Search</label><input className="form-control craft-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes, enchants, reagents, monster parts…" /></div><div><label className="form-label fw-semibold">Discipline</label><select className="form-select craft-input" value={discipline} onChange={(e) => { const next = e.target.value; setDiscipline(next); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); }}>{disciplineOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></div>',
    "discipline control reset",
)

# Enchanting category bar.
alchemy_bar = '''    {discipline === "Alchemy" && activeTab === "recipes" ? (
      <div className="craft-alchemy-section-bar" aria-label="Alchemy recipe sections">'''
enchanting_bar = '''    {discipline === "Enchanting" && activeTab === "recipes" ? (
      <div className="craft-alchemy-section-bar craft-enchanting-section-bar" aria-label="Enchanting item categories">
        <div>
          <div className="craft-kicker">Enchanting Categories</div>
          <div className="craft-alchemy-section-note">Filter magical traits by the physical item type they can be bound to.</div>
        </div>
        <div className="craft-alchemy-section-buttons">
          {ENCHANTING_SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              className={cls("craft-alchemy-section-button", "craft-enchanting-section-button", enchantingSection === section && "active")}
              onClick={() => chooseEnchantingSection(section)}
            >
              <span>{section}</span>
              <strong>{enchantingSectionCounts[section] || 0}</strong>
            </button>
          ))}
        </div>
      </div>
    ) : null}
'''
if enchanting_bar not in text:
    replace_once(alchemy_bar, enchanting_bar + alchemy_bar, "enchanting category bar")

# Context propagation for any remaining legacy preview calculations.
text = text.replace(
    'calculateCraftAttemptPreview(activeRecipe, plan, selectedMaterials, recipeRules, materialEffects);',
    'calculateCraftAttemptPreview(activeRecipe, plan, selectedMaterials, recipeRules, materialEffects, baseItem);',
)

# Styling.
css = '''

        /* Enchanting categories, fantasy materials, elemental tempering, and rich forge previews */
        .craft-enchanting-section-bar{border-color:rgba(167,139,250,.52);background:linear-gradient(135deg,rgba(103,58,183,.18),rgba(26,21,42,.95))}
        .craft-enchanting-section-button.active{border-color:#a78bfa;background:rgba(139,92,246,.25);box-shadow:0 0 0 1px rgba(167,139,250,.18) inset}
        .craft-enchanting-section-button strong{background:rgba(167,139,250,.18);color:#e7dcff}
        .craft-material-dual-effects{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
        .craft-material-dual-effects>div{min-width:0;padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(8,12,22,.38)}
        .craft-material-dual-effects strong,.craft-material-dual-effects span{display:block}
        .craft-material-dual-effects strong{color:#ffd98a;font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
        .craft-material-dual-effects span{color:#e7dfed;font-size:11px;line-height:1.4;overflow-wrap:anywhere}
        .craft-forge-item-preview{border-color:var(--workflow-border);background:linear-gradient(145deg,var(--workflow-soft),rgba(20,17,31,.92))}
        .craft-forge-flavor{color:#fff8ff;padding:10px;border:1px solid rgba(255,214,115,.3);border-radius:9px;background:rgba(22,25,36,.72);line-height:1.45}
        .craft-forge-rules{margin-top:9px;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(35,40,53,.64);color:#ece7f5;white-space:pre-line;line-height:1.45}
        .craft-forge-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
        .craft-forge-stat-grid>div{min-width:0;padding:8px 9px;border:1px dashed rgba(255,255,255,.11);border-radius:8px;background:rgba(15,19,29,.55)}
        .craft-forge-stat-grid span,.craft-forge-stat-grid strong{display:block}
        .craft-forge-stat-grid span{color:#aca2bf;font-size:9px;text-transform:uppercase;letter-spacing:.07em}
        .craft-forge-stat-grid strong{color:#fff;margin-top:3px;overflow-wrap:anywhere}
        .craft-temper-preview{border-color:rgba(255,159,67,.45);background:linear-gradient(145deg,rgba(255,121,38,.12),rgba(25,20,34,.92))}
        .craft-temper-preview-row{display:grid;gap:3px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.08)}
        .craft-temper-preview-row:last-of-type{border-bottom:0}
        .craft-temper-preview-row strong{color:#ffd08a}
        .craft-temper-preview-row span{color:#e7dfed;font-size:11px;line-height:1.4}
        @media(max-width:760px){.craft-material-dual-effects,.craft-forge-stat-grid{grid-template-columns:1fr}}
'''
marker = '\n    `}</style></div>;'
if 'Enchanting categories, fantasy materials, elemental tempering, and rich forge previews' not in text:
    replace_once(marker, css + marker, "crafting v2 styles")

required = [
    'const ENCHANTING_SECTIONS',
    'const SMITHING_MATERIAL_CATALOG',
    'function temperMaterialSlotsForRecipe',
    'craft-enchanting-section-bar',
    'Pattern Item Details',
    'Elemental Temper Stack',
    'json("/items/flavor-overrides.json")',
]
for token in required:
    if token not in text:
        raise RuntimeError(f"missing verification token: {token}")

path.write_text(text)
print("phase4 ok", len(text), text.count("\\n") + 1)
