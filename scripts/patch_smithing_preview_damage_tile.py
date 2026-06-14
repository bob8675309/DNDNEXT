from pathlib import Path

path = Path("pages/items.js")
text = path.read_text()
old = '<div><span>Damage</span><strong>{recipe.item_preview.damage || "—"}</strong></div>'
new = '<div><span>Damage</span><strong>{smithingPreview?.kind === "offensive" && smithingPreview.finalDamage ? `${smithingPreview.finalDamage} ${titleCase(smithingPreview.finalDamageType)}${smithingPreview.finalSecondaryDamage ? `, versatile (${smithingPreview.finalSecondaryDamage})` : ""}` : recipe.item_preview.damage || "—"}</strong></div>'
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise RuntimeError("smithing preview damage tile was not found")
path.write_text(text)
