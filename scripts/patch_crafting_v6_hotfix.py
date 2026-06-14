from pathlib import Path

path = Path("pages/items.js")
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
'''    const selected = (entry.candidates || []).find((candidate) => String(candidate.id) === String(selectedId)) || null;
    return {
      category: entry.category,''',
'''    const selected = (entry.candidates || []).find((candidate) => String(candidate.id) === String(selectedId)) || null;
    const isAdminVirtual = Boolean(selected?.is_admin_virtual || String(selected?.id || "").startsWith("catalog-"));
    return {
      category: entry.category,''',
"detect virtual admin stock",
)

replace_once(
'''      inventory_item_id: selected?.existing_work ? null : selected?.id || null,
      name: selected?.name || null,
      quantity_required: selected?.existing_work ? 0 : 1,''',
'''      inventory_item_id: selected?.existing_work || isAdminVirtual ? null : selected?.id || null,
      virtual_catalog_id: isAdminVirtual ? selected?.id || null : null,
      is_admin_virtual: isAdminVirtual,
      name: selected?.name || null,
      quantity_required: selected?.existing_work || isAdminVirtual ? 0 : 1,''',
"do not consume virtual stock",
)

replace_once(
'''function formatScaledWeaponDamage(baseDice = null, pct = 0) {
  if (!baseDice || !pct) return `${pct}% of base weapon damage`;
  const scaledCount = Number(baseDice.count || 0) * Number(pct || 0) / 100;
  if (Number.isInteger(scaledCount) && scaledCount > 0) return `${scaledCount}d${baseDice.size}`;
  return `${pct}% of ${baseDice.count}d${baseDice.size}`;
}''',
'''function formatScaledWeaponDamage(baseDice = null, pct = 0) {
  if (!baseDice || !pct) return `${pct}% of base weapon damage`;
  const scaledCount = Number(baseDice.count || 0) * Number(pct || 0) / 100;
  if (scaledCount <= 0) return `${pct}% of ${baseDice.count}d${baseDice.size}`;
  return `${Math.max(1, Math.ceil(scaledCount - 1e-9))}d${baseDice.size}`;
}
function weaponSecondaryDamageProfile(recipe = {}, baseItem = null) {
  const payload = baseItem?.payload || baseItem?.raw?.card_payload || {};
  const source = payload.dmg2 || payload.damage2 || baseItem?.raw?.dmg2 || recipe?.dmg2 || recipe?.catalog_item?.dmg2 || "";
  return parseDiceExpression(source);
}''',
"render concrete scaled smithing dice",
)

replace_once(
'''  const rawBaseDice = weaponBaseDamageProfile(recipe, baseItem);
  const baseDice = applySmithingWeaponDieSteps(rawBaseDice, profile);''',
'''  const rawBaseDice = weaponBaseDamageProfile(recipe, baseItem);
  const baseDice = applySmithingWeaponDieSteps(rawBaseDice, profile);
  const rawSecondaryDice = weaponSecondaryDamageProfile(recipe, baseItem);
  const secondaryDice = applySmithingWeaponDieSteps(rawSecondaryDice, profile);''',
"load secondary weapon damage",
)

replace_once(
'''  const saveDcPerEffectPct = Math.max(1, Number(profile.saveDcPerEffectPct || 100));
  const affinitySaveDcBonus = Math.floor(matchingEffectPct / saveDcPerEffectPct);
  return {
    kind: "offensive",
    material: physical ? smithingMaterialBaseName(physical) : null,
    materialQuality: physical ? smithingMaterialQuality(physical) : null,
    baseDamage: baseDice ? `${baseDice.count}d${baseDice.size}` : recipe?.item_preview?.damage || baseItem?.payload?.damageText || "Base weapon damage",
    baseType,
    convertedBaseType: convertsBase,
    riders: Object.entries(riders).map(([element, pct]) => ({ element, pct, dice: formatScaledWeaponDamage(baseDice, pct) })),
    affinityEffectPct: matchingEffectPct,
    affinitySaveDcBonus,
    saveDcPerEffectPct,
    materialDieSteps: Number(profile?.weaponMechanics?.dieSteps || 0),
  };
}''',
'''  const saveDcPerEffectPct = Math.max(1, Number(profile.saveDcPerEffectPct || 100));
  const affinitySaveDcBonus = Math.floor(matchingEffectPct / saveDcPerEffectPct);
  const convertedEffectPct = convertsBase ? Number(riders[baseType] || 100) : 0;
  const finalDamage = convertsBase ? formatScaledWeaponDamage(baseDice, convertedEffectPct) : (baseDice ? `${baseDice.count}d${baseDice.size}` : recipe?.item_preview?.damage || baseItem?.payload?.damageText || "Base weapon damage");
  const finalSecondaryDamage = convertsBase && secondaryDice ? formatScaledWeaponDamage(secondaryDice, convertedEffectPct) : null;
  const riderEntries = Object.entries(riders)
    .filter(([element]) => !(convertsBase && element === baseType))
    .map(([element, pct]) => ({ element, pct, dice: formatScaledWeaponDamage(baseDice, pct) }));
  return {
    kind: "offensive",
    material: physical ? smithingMaterialBaseName(physical) : null,
    materialQuality: physical ? smithingMaterialQuality(physical) : null,
    baseDamage: baseDice ? `${baseDice.count}d${baseDice.size}` : recipe?.item_preview?.damage || baseItem?.payload?.damageText || "Base weapon damage",
    baseType,
    convertedBaseType: convertsBase,
    convertedEffectPct,
    finalDamage,
    finalSecondaryDamage,
    finalDamageType: baseType,
    riders: riderEntries,
    affinityEffectPct: matchingEffectPct,
    affinitySaveDcBonus,
    saveDcPerEffectPct,
    materialDieSteps: Number(profile?.weaponMechanics?.dieSteps || 0),
  };
}
function recipeWithSmithingResult(recipe = {}, preview = null) {
  if (recipe?.discipline !== "Smithing" || preview?.kind !== "offensive" || !preview?.finalDamage || !preview?.finalDamageType) return recipe;
  const damageType = String(preview.finalDamageType).toLowerCase();
  const versatileText = preview.finalSecondaryDamage ? `, versatile (${preview.finalSecondaryDamage})` : "";
  const damageText = `${preview.finalDamage} ${damageType}${versatileText}`;
  return {
    ...recipe,
    dmg1: preview.finalDamage,
    dmg2: preview.finalSecondaryDamage || recipe.dmg2,
    dmgType: damageType,
    damageType,
    damage_type: damageType,
    smithing_result: preview,
    item_preview: recipe.item_preview ? { ...recipe.item_preview, damage: damageText } : recipe.item_preview,
    catalog_item: recipe.catalog_item ? {
      ...recipe.catalog_item,
      dmg1: preview.finalDamage,
      dmg2: preview.finalSecondaryDamage || recipe.catalog_item.dmg2,
      dmgType: damageType,
      damageType,
      damage_type: damageType,
      damageText,
      smithing_result: preview,
    } : recipe.catalog_item,
  };
}''',
"consolidate matching converted damage and persist result",
)

replace_once(
'''      const basePayload = craftPlanInsertPayload(recipe, plan, {
        targetCharacter,
        baseItem,
        selectedMaterials,
        resultItemName: displayedResultName,
        automationPreview: { ...attemptPreview, output_quantity: finalOutputQuantity, final_effect_preview: alchemyProductPreview },
      });''',
'''      const recipeForPayload = recipeWithSmithingResult(recipe, smithingPreview);
      const basePayload = craftPlanInsertPayload(recipeForPayload, plan, {
        targetCharacter,
        baseItem,
        selectedMaterials,
        resultItemName: displayedResultName,
        automationPreview: { ...attemptPreview, output_quantity: finalOutputQuantity, final_effect_preview: alchemyProductPreview || smithingPreview },
      });''',
"persist smithing result payload",
)

replace_once(
'''  const selectedMaterialCount = selectedMaterialList.filter((material) => material.inventory_item_id).length;''',
'''  const selectedMaterialCount = selectedMaterialList.filter((material) => material.name).length;''',
"count virtual selections",
)

replace_once(
'''                  <div className="craft-smithing-damage-line"><strong>Base weapon:</strong> {smithingPreview.baseDamage} {titleCase(smithingPreview.baseType)}{smithingPreview.materialDieSteps ? ` (material die +${smithingPreview.materialDieSteps} steps)` : ""}{smithingPreview.convertedBaseType ? " (converted by material affinity and Initial Temper)" : ""}</div>
                  {(smithingPreview.riders || []).map((rider) => <div className="craft-temper-preview-row" key={rider.element}><strong>{titleCase(rider.element)} damage: {rider.dice}</strong><span>{rider.pct}% of base weapon damage after material affinity.</span></div>)}''',
'''                  {smithingPreview.convertedBaseType ? (
                    <div className="craft-temper-preview-row craft-smithing-final-damage-row">
                      <strong>Final damage: {smithingPreview.finalDamage} {titleCase(smithingPreview.finalDamageType)}{smithingPreview.finalSecondaryDamage ? `, versatile (${smithingPreview.finalSecondaryDamage})` : ""}</strong>
                      <span>{smithingPreview.convertedEffectPct}% matched effect converts the base damage and rounds up to whole weapon dice.</span>
                    </div>
                  ) : <div className="craft-smithing-damage-line"><strong>Base weapon:</strong> {smithingPreview.baseDamage} {titleCase(smithingPreview.baseType)}{smithingPreview.materialDieSteps ? ` (material die +${smithingPreview.materialDieSteps} steps)` : ""}</div>}
                  {(smithingPreview.riders || []).map((rider) => <div className="craft-temper-preview-row" key={rider.element}><strong>{titleCase(rider.element)} damage: {rider.dice}</strong><span>{rider.pct}% of base weapon damage after material affinity.</span></div>)}''',
"show consolidated final smithing damage",
)

required = [
    "const isAdminVirtual = Boolean",
    "virtual_catalog_id",
    "function recipeWithSmithingResult",
    "finalDamageType",
    "Final damage:",
    "alchemyProductPreview || smithingPreview",
]
for token in required:
    if token not in text:
        raise RuntimeError(f"missing verification token: {token}")

path.write_text(text)
print("applied crafting v6 hotfix")
