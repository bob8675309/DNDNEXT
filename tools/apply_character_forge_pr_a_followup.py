from pathlib import Path

root = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    target = root / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "scripts/validate_npc_forge_v2_refined.mjs",
    '  "Generate NPC story &amp; world fit",',
    '  "Generate NPC story & world fit",',
)

replace_once(
    ".github/workflows/validate-npc-forge.yml",
    '      - "utils/playerCharacterForgeGuard.js"\n',
    '      - "utils/playerCharacterForgeGuard.js"\n      - "utils/characterPortraits.js"\n',
)
replace_once(
    ".github/workflows/validate-npc-forge.yml",
    '      - "scripts/node_relative_js_loader.mjs"\n',
    '      - "scripts/node_relative_js_loader.mjs"\n      - "scripts/generate_npc_portrait_pack.mjs"\n',
)
replace_once(
    ".github/workflows/validate-npc-forge.yml",
    '          node --check utils/craftingProfessions.js\n',
    '          node --check utils/craftingProfessions.js\n          node --check utils/characterPortraits.js\n',
)

print("Character Forge PR A follow-up applied.")
