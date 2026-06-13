from pathlib import Path

lines = Path('pages/items.js').read_text().splitlines()
markers = [
  'function temperRecipes',
  'function temperTierForRecipe',
  'function hydrateSmithingPlanWithExisting',
  'function existingSmithingSelectionMap',
  'function CraftPlansTab',
  'function CraftPlanPreview',
  'function characterName',
  'selectSafe("characters"',
  'function enchantingSectionsForRecipe',
  'function RecipeTable',
  'submitPreviewCraftPlan',
  'supabase.channel',
  'postgres_changes',
]
out = [f'lines={len(lines)}']
for marker in markers:
    hits = [i for i, line in enumerate(lines, 1) if marker.lower() in line.lower()]
    out.append(f'\n## {marker} ({len(hits)} hits)')
    for line_no in hits[:20]:
        start = max(1, line_no - 18)
        end = min(len(lines), line_no + 70)
        out.append(f'\n### line {line_no}')
        out.extend(f'{n:05d}: {lines[n-1]}' for n in range(start, end + 1))
Path('diagnostics').mkdir(exist_ok=True)
Path('diagnostics/items_v6_markers.txt').write_text('\n'.join(out))
