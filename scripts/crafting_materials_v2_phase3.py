from pathlib import Path

path=Path('pages/items.js')
text=path.read_text()

def replace_once(old,new,label):
    global text
    c=text.count(old)
    if c!=1: raise RuntimeError(f'{label}: expected 1 found {c}')
    text=text.replace(old,new,1)

replace_once(
'''function requiredMaterialCategoriesForRecipe(recipe) {
  const alchemySlots = alchemyMaterialSlotsForRecipe(recipe);''',
'''function requiredMaterialCategoriesForRecipe(recipe, baseItem = null) {
  if (recipe?.discipline === "Smithing" && recipe?.kind === "temper") return temperMaterialSlotsForRecipe(recipe, baseItem);
  const alchemySlots = alchemyMaterialSlotsForRecipe(recipe);''',
'required categories signature')

old_allowed='''function materialAllowedForDiscipline(material, discipline = "") {
  if (!material) return false;
  const d = String(discipline || "").toLowerCase();
  if (!d || d === "alchemy") return true;
  const category = String(material.category || "").toLowerCase();
  const blob = materialSearchBlob(material);
  if (hasExplicitAlchemyPayload(material)) return false;
  if (d === "smithing") {
    if (category === "ore / metal") return true;
    if (category === "catalyst") return !/(potion|brew|herb|plant|reagent|essence|extract|tincture)/.test(blob);
    if (category === "monster part") return !/(venom|poison|bile|mucus|fluid|blood extract|alchemical)/.test(blob);
    return false;
  }
  if (d === "enchanting") {
    if (category === "catalyst" || category === "monster part") return true;
    if (category === "ore / metal") return /(mithral|adamant|silver|ruidium|crystal|shard|gem|arcane|planar|star)/.test(blob);
    return false;
  }
  return true;
}'''
new_allowed='''function materialAllowedForRecipe(material, recipe = {}) {
  if (!material) return false;
  const d = String(recipe.discipline || "").toLowerCase();
  const category = String(material.category || "").toLowerCase();
  const blob = materialSearchBlob(material);
  const profile = smithingProfile(material);
  if (!d || d === "alchemy") return true;
  if (d === "smithing" && recipe.kind === "temper" && isElementalTemperMaterial(material)) return true;
  if (d === "smithing" && Object.keys(profile).length) return true;
  if (hasExplicitAlchemyPayload(material)) return false;
  if (d === "smithing") {
    if (["ore / metal", "material"].includes(category)) return true;
    if (category === "catalyst") return !/(potion|brew|herb|plant|extract|tincture)/.test(blob);
    if (category === "monster part") return !/(venom|poison|bile|mucus|fluid|blood extract|alchemical)/.test(blob);
    return false;
  }
  if (d === "enchanting") {
    if (category === "catalyst" || category === "monster part") return true;
    if (category === "ore / metal" || category === "material") return /(mithral|adamant|silver|ruidium|orichalcum|cold iron|obsidian|blood glass|star metal|stygian|moonsilver|riverine|crystal|shard|gem|arcane|planar)/.test(blob);
    return false;
  }
  return true;
}
function materialAllowedForDiscipline(material, discipline = "") {
  return materialAllowedForRecipe(material, { discipline });
}'''
replace_once(old_allowed,new_allowed,'material allowed')

replace_once('function buildCraftBenchPlan(recipe, materials = []) {','function buildCraftBenchPlan(recipe, materials = [], baseItem = null) {','plan signature')
replace_once('  const categories = requiredMaterialCategoriesForRecipe(recipe);','  const categories = requiredMaterialCategoriesForRecipe(recipe, baseItem);','plan categories')
replace_once(
'''      .filter((material) => recipe.discipline === "Alchemy" ? materialMeetsAlchemySlot(material, slot) : materialMatchesCategory(material, slot.category))''',
'''      .filter((material) => {
        if (recipe.discipline === "Alchemy") return materialMeetsAlchemySlot(material, slot);
        if (slot.temper_elemental) return isElementalTemperMaterial(material);
        if (Array.isArray(slot.allowed_categories)) return slot.allowed_categories.some((category) => materialMatchesCategory(material, category));
        return materialMatchesCategory(material, slot.category);
      })''',
'plan candidate filter')

replace_once(
'''      slot_type: entry.slot_type || entry.slotType || (entry.family === "any" ? "modifier" : "core"),
      potency_rank:''',
'''      slot_type: entry.slot_type || entry.slotType || (entry.family === "any" ? "modifier" : "core"),
      temper_elemental: Boolean(entry.temper_elemental),
      temper_stage: entry.temper_stage || null,
      bonus_damage_pct: entry.bonus_damage_pct || null,
      temper_element: selected ? elementalDamageTypeForMaterial(selected) || null : null,
      smithing: selected ? smithingProfile(selected) : null,
      potency_rank:''',
'selected payload metadata')
replace_once(
'''      slot_allowed_families: entry.allowed_families || entry.allowedFamilies || [],
      optional: entry.required === false,''',
'''      slot_allowed_families: entry.allowed_families || entry.allowedFamilies || [],
      temper_elemental: Boolean(entry.temper_elemental),
      temper_stage: entry.temper_stage || null,
      bonus_damage_pct: entry.bonus_damage_pct || null,
      temper_element: elementalDamageTypeForMaterial(selected) || null,
      smithing: smithingProfile(selected),
      optional: entry.required === false,''',
'selected object metadata')

replace_once(
'function calculateCraftAttemptPreview(recipe, plan, selectedMaterials = {}, recipeRules = [], materialEffects = []) {',
'function calculateCraftAttemptPreview(recipe, plan, selectedMaterials = {}, recipeRules = [], materialEffects = [], baseItem = null) {',
'attempt signature')
replace_once(
'''    const alchemyEffect = isAlchemy ? alchemyMaterialSpecificEffect(material, effectiveRecipe) : null;
    const effect = alchemyEffect || materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {''',
'''    const alchemyEffect = isAlchemy ? alchemyMaterialSpecificEffect(material, effectiveRecipe) : null;
    const physicalEffect = !isAlchemy && material.temper_elemental
      ? temperMaterialEffect(material, material)
      : !isAlchemy ? smithingMaterialEffect(material, baseItem) : null;
    const effect = alchemyEffect || physicalEffect || materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {''',
'attempt physical effect')
replace_once(
'''      risk_score: effect.risk_score || 0,
    };''',
'''      risk_score: effect.risk_score || 0,
      element: effect.element || null,
      temper_stage: effect.temper_stage || null,
      bonus_damage_pct: effect.bonus_damage_pct || 0,
      offensive_summary: effect.offensive_summary || null,
      defensive_summary: effect.defensive_summary || null,
    };''',
'attempt metadata')
replace_once(
'''    material_effects: materialBreakdown,
    check_ability:''',
'''    material_effects: materialBreakdown,
    temper_preview: materialBreakdown.filter((item) => item.temper_stage).sort((a, b) => a.temper_stage - b.temper_stage),
    temper_total_bonus_pct: materialBreakdown.reduce((sum, item) => sum + Number(item.bonus_damage_pct || 0), 0),
    check_ability:''',
'temper preview return')

start=text.index('function PhysicalMaterialEffectCard(')
end=text.index('\nfunction RecipePreview(',start)
new_card=r'''function PhysicalMaterialEffectCard({ material, materialEffects = [], quantityLabel = "", compact = false, discipline = "Crafting", baseItem = null, slot = {} }) {
  if (!material) return null;
  const profile = smithingProfile(material);
  const effect = slot?.temper_elemental
    ? temperMaterialEffect(material, slot)
    : smithingMaterialEffect(material, baseItem) || materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {
      name: `${material.category || "Material"} Contribution`,
      dc_modifier: 1,
      effect_summary: "Adds a minor material property determined by the selected recipe.",
      risk_summary: "Requires correct tools and handling.",
    };
  const itemRarity = rarity(material.rarity || "Common") || "Common";
  const dcModifier = Number(effect.dc_modifier || 0);
  return (
    <div className={cls("craft-material-effect-row", "craft-specific-material-effect-row", "craft-alchemy-effect-card", "craft-physical-effect-card", compact && "compact", rarityClassName(itemRarity))}>
      <div className="craft-alchemy-item-head">
        <div className="craft-alchemy-item-title-block">
          <strong>{material.name}</strong>
          <span className="craft-ingredient-family-pill craft-ingredient-family-pill-under-name">{slot?.temper_elemental ? `Temper +${slot.temper_stage}` : profile.materialClass || material.category || material.type || "Material"}</span>
        </div>
        <div className="craft-effect-card-badges">
          <span className={cls("craft-ingredient-quality-pill", rarityClassName(itemRarity))}>{itemRarity}</span>
          {effect.element ? <span className="craft-ingredient-theme-pill">{titleCase(effect.element)}</span> : null}
          {quantityLabel ? <span className="craft-ingredient-qty-pill">{quantityLabel}</span> : null}
        </div>
      </div>
      <div className="craft-alchemy-card-description">{material.notes || material.description || material.raw?.item_description || "Prepared crafting stock."}</div>
      <div className="craft-alchemy-card-divider" />
      <div className="craft-alchemy-impact-label">{slot?.temper_elemental ? "Temper impact" : discipline === "Smithing" ? "Forge impact" : "Binding impact"}</div>
      <div className="craft-ingredient-impact-chips craft-material-impact-chips">
        <i>{effect.name || "Material effect"}</i>
        {effect.bonus_damage_pct ? <i>+{effect.bonus_damage_pct}% base damage</i> : null}
        <i>{dcModifier ? `Craft DC ${dcModifier > 0 ? "+" : ""}${dcModifier}` : "No Craft DC change"}</i>
      </div>
      {profile.offensive && profile.defensive ? (
        <div className="craft-material-dual-effects">
          <div><strong>Weapon / Ammo</strong><span>{profile.offensive}</span></div>
          <div><strong>Armor / Shield</strong><span>{profile.defensive}</span></div>
        </div>
      ) : <div className="craft-material-specific-summary">{effect.effect_summary || "Adds a recipe-appropriate crafted property."}</div>}
      {!compact && effect.risk_summary ? <div className="craft-physical-risk-note"><strong>Handling:</strong> {effect.risk_summary}</div> : null}
    </div>
  );
}
'''
text=text[:start]+new_card+text[end:]

replace_once(
'  const planningResources = allPlanningResources.filter((material) => materialAllowedForDiscipline(material, recipe.discipline));',
'  const planningResources = allPlanningResources.filter((material) => materialAllowedForRecipe(material, recipe));',
'preview resource filter')
replace_once('  const plan = buildCraftBenchPlan(recipe, planningResources);','  const plan = buildCraftBenchPlan(recipe, planningResources, baseItem);','preview plan')
replace_once(
'  const attemptPreview = calculateCraftAttemptPreview(recipe, plan, selectedMaterials, recipeRules, materialEffects);',
'  const attemptPreview = calculateCraftAttemptPreview(recipe, plan, selectedMaterials, recipeRules, materialEffects, baseItem);',
'preview attempt')
replace_once(
'''          <select className="form-select craft-input" value={baseItemId} onChange={(event) => setBaseItemId(event.target.value)}>''',
'''          <select className="form-select craft-input" value={baseItemId} onChange={(event) => { setBaseItemId(event.target.value); setSelectedMaterials({}); setOpenSlotKey(""); }}>''',
'base item onChange')
text=text.replace('material={selectedCandidate} materialEffects={materialEffects} quantityLabel={selectedQuantityLabel} discipline={recipe.discipline}', 'material={selectedCandidate} materialEffects={materialEffects} quantityLabel={selectedQuantityLabel} discipline={recipe.discipline} baseItem={baseItem} slot={slot}')
text=text.replace('material={candidate} materialEffects={materialEffects} quantityLabel={available ? candidate.is_admin_virtual ? "∞ admin" : `x${candidate.quantity || 1}` : "Not owned"} compact discipline={recipe.discipline}', 'material={candidate} materialEffects={materialEffects} quantityLabel={available ? candidate.is_admin_virtual ? "∞ admin" : `x${candidate.quantity || 1}` : "Not owned"} compact discipline={recipe.discipline} baseItem={baseItem} slot={slot}')

old_branch='''      ) : (
        <div className="craft-preview-grid">
          <div className="craft-section craft-section-card">
            <div className="craft-section-title">Requirements</div>
            {reqs.length ? reqs.map((line, idx) => <div className="craft-bullet" key={idx}>• {line}</div>) : <div className="craft-bullet muted">—</div>}
          </div>
          <div className="craft-section craft-section-card">
            <div className="craft-section-title">Components / Notes</div>
            {comps.length ? comps.map((line, idx) => <div className="craft-bullet" key={idx}>• {line}</div>) : <div className="craft-bullet muted">Optional materials and catalysts decided by the DM.</div>}
          </div>
        </div>
      )}'''
new_branch='''      ) : (
        <>
          {recipe.item_preview ? (
            <div className="craft-section craft-section-card craft-forge-item-preview mt-3">
              <div className="craft-section-title">Pattern Item Details</div>
              <div className="craft-forge-flavor">{recipe.item_preview.flavor || recipe.item_preview.rules || "No catalog flavor text is available for this pattern."}</div>
              {recipe.item_preview.rules && recipe.item_preview.rules !== recipe.item_preview.flavor ? <div className="craft-forge-rules">{recipe.item_preview.rules}</div> : null}
              <div className="craft-forge-stat-grid">
                <div><span>Damage</span><strong>{recipe.item_preview.damage || "—"}</strong></div>
                <div><span>Range / AC</span><strong>{recipe.item_preview.range || recipe.item_preview.ac || "—"}</strong></div>
                <div><span>Properties</span><strong>{(recipe.item_preview.properties || []).join(", ") || "—"}</strong></div>
                <div><span>Cost</span><strong>{recipe.item_preview.costGp == null ? "—" : `${recipe.item_preview.costGp} gp`}</strong></div>
                <div><span>Weight</span><strong>{recipe.item_preview.weightLb == null ? "—" : `${recipe.item_preview.weightLb} lb`}</strong></div>
                <div><span>Type</span><strong>{titleCase(recipe.item_preview.family || recipe.item_preview.itemType || recipe.category)}</strong></div>
                <div><span>Source</span><strong>{recipe.item_preview.source || recipe.source || "—"}</strong></div>
              </div>
            </div>
          ) : null}
          {attemptPreview.temper_preview?.length ? (
            <div className="craft-section craft-section-card craft-temper-preview mt-3">
              <div className="craft-section-title">Elemental Temper Stack</div>
              {attemptPreview.temper_preview.map((temper) => (
                <div className="craft-temper-preview-row" key={`${temper.temper_stage}-${temper.inventory_item_id}`}>
                  <strong>Temper +{temper.temper_stage}: {titleCase(temper.element)}</strong>
                  <span>{temper.effect_summary}</span>
                </div>
              ))}
              <div className="craft-preview-chip-row mt-2"><span className="craft-chip craft-chip-gold">Stacked elemental bonus: {attemptPreview.temper_total_bonus_pct}% of base weapon damage</span></div>
            </div>
          ) : null}
          <div className="craft-preview-grid">
            <div className="craft-section craft-section-card">
              <div className="craft-section-title">Requirements</div>
              {reqs.length ? reqs.map((line, idx) => <div className="craft-bullet" key={idx}>• {line}</div>) : <div className="craft-bullet muted">—</div>}
            </div>
            <div className="craft-section craft-section-card">
              <div className="craft-section-title">Components / Notes</div>
              {comps.length ? comps.map((line, idx) => <div className="craft-bullet" key={idx}>• {line}</div>) : <div className="craft-bullet muted">Optional materials and catalysts decided by the DM.</div>}
            </div>
          </div>
        </>
      )}'''
replace_once(old_branch,new_branch,'rich preview branch')

path.write_text(text)
print('phase3 ok',len(text),text.count('\n')+1)
