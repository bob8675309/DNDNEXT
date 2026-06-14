from pathlib import Path

path = Path("pages/items.js")
text = path.read_text()
old = '{!smithingPreview.riders?.length ? <div className="craft-bullet muted">Choose an Initial Temper or later temper essence to add elemental damage.</div> : null}'
new = '{!smithingPreview.convertedBaseType && !smithingPreview.riders?.length ? <div className="craft-bullet muted">Choose an Initial Temper or later temper essence to add elemental damage.</div> : null}'
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise RuntimeError("converted-damage empty hint was not found")
path.write_text(text)
