from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    target = Path(path)
    source = target.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one {label} anchor, found {count}")
    target.write_text(source.replace(old, new, 1), encoding="utf-8")


replace_once(
    "components/NpcPanel.js",
    '''function rollSummary(roll) {
  if (!roll) return "";
  if (roll.summary) return String(roll.summary);
  const mod = Number(roll.mod || 0);
  const modText = mod >= 0 ? `+${mod}` : `${mod}`;
  const mode = roll.mode && roll.mode !== "normal" ? ` (${String(roll.mode).toUpperCase()})` : "";
  const rolls = Array.isArray(roll.rolls) && roll.rolls.length ? ` [${roll.rolls.join(", ")}]` : "";
  return `${roll.label}${mode}: ${roll.roll}${rolls} ${modText} = ${roll.total}`;
}

function damageRollSummary(roll) {
  const damage = roll?.damage;
  if (!damage || !Number.isFinite(Number(damage.total))) return "";
  const rolls = Array.isArray(damage.rolls) && damage.rolls.length ? ` [${damage.rolls.join(", ")}]` : "";
  const modifier = Number(damage.modifier || 0);
  const modifierText = modifier ? ` ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)}` : "";
  const type = safeStr(damage.type);
  const dice = Number(damage.diceCount) > 0 && Number(damage.dieSize) > 0
    ? `${damage.diceCount}d${damage.dieSize}`
    : damage.formula || "Damage";
  return `${dice}${rolls}${modifierText} = ${damage.total}${type ? ` ${type}` : ""}`;
}

''',
    "",
    "obsolete inline roll helpers",
)

replace_once(
    "utils/characterSheetActions.js",
    '''      propertyText || null,
      mastery ? `Weapon Mastery: ${mastery}` : null,
''',
    '''      propertyText || null,
      modes.length > 1 ? "Use the mode pill to toggle this weapon between Melee and Thrown." : null,
      mastery ? `Weapon Mastery: ${mastery}` : null,
''',
    "dual-use weapon detail text",
)

replace_once(
    "scripts/validate_player_sheet_actions.mjs",
    '''expectEqual(javelinThrown.mode, "thrown", "Javelin pill resolves its thrown mode");
expect(javelinThrown.detail.includes("Thrown 30/120 ft."), "Varges Javelin thrown range");
''',
    '''expectEqual(javelinThrown.mode, "thrown", "Javelin pill resolves its thrown mode");
expect(javelinThrown.detail.includes("Thrown 30/120 ft."), "Varges Javelin thrown range");
expect(javelinMelee.details.some((line) => line.includes("toggle this weapon between Melee and Thrown")), "dual-use weapon details explain the mode pill");
''',
    "dual-use weapon detail validation",
)

print("NPC sheet final cleanup patch applied.")
