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

for doc_path in [
    Path("docs/Source_Patch_Pipeline_Audit.md"),
    Path("docs/Town_Crafter_Current_Status.md"),
]:
    doc = doc_path.read_text(encoding="utf-8")
    old = "scripts/validate_player_sheet_actions.mjs\n"
    new = "scripts/validate_player_sheet_actions.mjs\nscripts/validate_npc_sheet_action_parity.mjs\n"
    count = doc.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one active-runner anchor in {doc_path}, found {count}")
    doc_path.write_text(doc.replace(old, new, 1), encoding="utf-8")

print("Player sheet validator and handoff ledgers updated for the shared NPC roll/action parity contract.")
