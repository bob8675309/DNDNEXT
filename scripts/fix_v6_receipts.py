from pathlib import Path

path = Path("pages/items.js")
text = path.read_text()

pairs = [
    ('attempt?.roll_total ?? requestedCraftRoll(normalized) || "—"', '(attempt?.roll_total ?? requestedCraftRoll(normalized)) || "—"'),
    ('attempt?.dc ?? savedCraftDc(normalized) || "—"', '(attempt?.dc ?? savedCraftDc(normalized)) || "—"'),
    ('attempt?.roll_total ?? requestedCraftRoll(plan) || "—"', '(attempt?.roll_total ?? requestedCraftRoll(plan)) || "—"'),
    ('attempt?.dc ?? savedCraftDc(plan) || "—"', '(attempt?.dc ?? savedCraftDc(plan)) || "—"'),
]

for old, new in pairs:
    if old in text:
        text = text.replace(old, new, 1)
    elif new not in text:
        raise RuntimeError("Receipt fallback expression was not found")

path.write_text(text)
