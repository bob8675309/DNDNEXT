from pathlib import Path

path = Path("scripts/validate_player_sheet_actions.mjs")
source = path.read_text(encoding="utf-8")

old_declaration = 'const npcPanelSource = fs.readFileSync(path.join(root, "components/NpcPanel.js"), "utf8");\nconst sheetSource = fs.readFileSync(path.join(root, "components/CharacterSheet5e.js"), "utf8");\n'
new_declaration = 'const npcPanelSource = fs.readFileSync(path.join(root, "components/NpcPanel.js"), "utf8");\nconst rollResultSource = fs.readFileSync(path.join(root, "components/CharacterSheetRollResult.js"), "utf8");\nconst sheetSource = fs.readFileSync(path.join(root, "components/CharacterSheet5e.js"), "utf8");\n'

old_assertion = '''for (const token of [
  "sheet-last-roll__attack",
  "sheet-last-roll__damage",
  "damageRollSummary(lastRoll)",
]) expect(npcPanelSource.includes(token), `combined attack/damage roll banner missing ${JSON.stringify(token)}`);
'''
new_assertion = '''expect(npcPanelSource.includes('<CharacterSheetRollResult roll={lastRoll}'), "NPC/player panel must use the shared roll-result component");
for (const token of [
  "sheet-last-roll__attack",
  "sheet-last-roll__damage",
  "formatCharacterSheetDamage",
]) expect(rollResultSource.includes(token), `shared combined attack/damage roll banner missing ${JSON.stringify(token)}`);
'''

for old, new, label in [
    (old_declaration, new_declaration, "shared roll source declaration"),
    (old_assertion, new_assertion, "shared roll assertions"),
]:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one {label} anchor, found {count}")
    source = source.replace(old, new, 1)

path.write_text(source, encoding="utf-8")
print("Player sheet validator updated for the shared roll-result component.")
