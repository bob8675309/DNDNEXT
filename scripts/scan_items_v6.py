from pathlib import Path

lines = Path('pages/items.js').read_text().splitlines()
markers = ['Create Draft Craft Plan','Attempt Report','Craft Plan Queue','Plan Status','No character selected yet','Enchanting Categories','Troll Heart','craft-element-tag','temperTierForRecipe','Temper +1','Temper +2','Temper +3','craft_plan','craftPlan','selectedCharacter','characterOptions']
out = [f'lines={len(lines)}']
for marker in markers:
    hits = [i for i, line in enumerate(lines, 1) if marker.lower() in line.lower()]
    out.append(f'\n## {marker} ({len(hits)} hits)')
    for line_no in hits[:20]:
        start = max(1, line_no - 8)
        end = min(len(lines), line_no + 16)
        out.append(f'\n### line {line_no}')
        out.extend(f'{n:05d}: {lines[n-1]}' for n in range(start, end + 1))
Path('diagnostics').mkdir(exist_ok=True)
Path('diagnostics/items_v6_markers.txt').write_text('\n'.join(out))
