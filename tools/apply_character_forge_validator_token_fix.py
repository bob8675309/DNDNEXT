from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / "scripts/validate_npc_forge_v2_refined.mjs"
text = path.read_text(encoding="utf-8")
old = '  "Generate NPC story &amp; world fit",'
new = '  "Generate NPC story & world fit",'
count = text.count(old)
if count != 1:
    raise RuntimeError(f"Expected one legacy NPC story token, found {count}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("NPC Forge validator token reconciled.")
