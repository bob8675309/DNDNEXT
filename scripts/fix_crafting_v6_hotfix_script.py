from pathlib import Path

path = Path("scripts/patch_crafting_v6_hotfix.py")
text = path.read_text()
old = '''replace_once(
''' + "'''  const selectedMaterialCount = selectedMaterialList.filter((material) => material.inventory_item_id).length;'''" + ''',
''' + "'''  const selectedMaterialCount = selectedMaterialList.filter((material) => material.name).length;'''" + ''',
"count virtual selections",
)'''
new = '''count_snippet = "  const selectedMaterialCount = selectedMaterialList.filter((material) => material.inventory_item_id).length;"
replacement_snippet = "  const selectedMaterialCount = selectedMaterialList.filter((material) => material.name).length;"
count = text.count(count_snippet)
if count != 2:
    raise RuntimeError(f"count virtual selections: expected 2 matches, found {count}")
text = text.replace(count_snippet, replacement_snippet)'''
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise RuntimeError("counter replacement block was not found")
path.write_text(text)
