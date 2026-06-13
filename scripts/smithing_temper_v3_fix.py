from pathlib import Path

path = Path("pages/items.js")
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)

replace_once(
    '      inventory_item_id: selected?.id || null,\n      name: selected?.name || null,\n      quantity_required: 1,',
    '      inventory_item_id: selected?.existing_work ? null : selected?.id || null,\n      name: selected?.name || null,\n      quantity_required: selected?.existing_work ? 0 : 1,',
    'do not consume completed smithing history',
)

replace_once(
    '  const materialRecord = selected.find((entry) => entry?.slot_key === "craft-material" || entry?.slot_type === "physical") || (Array.isArray(smithing.materials) ? smithing.materials[0] : null);',
    '  const materialRecord = selected.find((entry) => (entry?.slot_key === "craft-material" || entry?.slot_type === "physical") && (entry?.name || entry?.inventory_item_id || entry?.effect)) || (Array.isArray(smithing.materials) ? smithing.materials.find((entry) => entry?.name || entry?.effect) : null);',
    'ignore empty material history slots',
)
replace_once(
    '    ...selected.filter((entry) => entry?.temper_elemental || entry?.slot_type === "temper"),',
    '    ...selected.filter((entry) => (entry?.temper_elemental || entry?.slot_type === "temper") && (entry?.name || entry?.inventory_item_id || entry?.temper_element || entry?.element)),',
    'ignore empty temper history slots',
)

replace_once(
    '      <div className="craft-alchemy-card-description">{material.notes || material.description || material.raw?.item_description || "Prepared crafting stock."}</div>',
    '      <div className="craft-alchemy-card-description">{profile.flavor || material.raw?.payload?.flavor || material.raw?.card_payload?.flavor || material.description || material.raw?.item_description || `Prepared ${profile.materialClass || material.category || "crafting"} stock.`}</div>',
    'neutral physical material description',
)

required = [
    'inventory_item_id: selected?.existing_work ? null',
    'quantity_required: selected?.existing_work ? 0 : 1',
    'Prepared ${profile.materialClass || material.category || "crafting"} stock.',
]
for token in required:
    if token not in text:
        raise RuntimeError(f"missing verification token: {token}")

path.write_text(text)
print("smithing temper v3 fixes applied", len(text), text.count("\\n") + 1)
