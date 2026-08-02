function safeText(value) {
  return String(value ?? "").trim();
}

export function formatCharacterSheetRoll(roll) {
  if (!roll) return "";
  if (roll.summary && !Number.isFinite(Number(roll.total))) return String(roll.summary);

  const modifier = Number(roll.mod || 0);
  const modifierText = modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`;
  const mode = roll.mode && roll.mode !== "normal" ? String(roll.mode).toLowerCase() : "normal";
  const rolls = Array.isArray(roll.rolls) ? roll.rolls.map(Number).filter(Number.isFinite) : [];

  if (rolls.length >= 2 && mode !== "normal") {
    return `${roll.label || "Roll"}: d20 ${mode === "adv" ? "(Advantage)" : "(Disadvantage)"} [${rolls.join(", ")}] → ${roll.roll} ${modifierText} = ${roll.total}`;
  }

  if (Number.isFinite(Number(roll.roll)) && Number.isFinite(Number(roll.total))) {
    return `${roll.label || "Roll"}: d20 ${roll.roll} ${modifierText} = ${roll.total}`;
  }

  return safeText(roll.summary || roll.label || "Roll resolved.");
}

export function formatCharacterSheetDamage(roll) {
  const damage = roll?.damage;
  if (!damage || !Number.isFinite(Number(damage.total))) return "";

  const rolls = Array.isArray(damage.rolls) && damage.rolls.length ? ` [${damage.rolls.join(", ")}]` : "";
  const modifier = Number(damage.modifier || 0);
  const modifierText = modifier ? ` ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)}` : "";
  const dice = Number(damage.diceCount) > 0 && Number(damage.dieSize) > 0
    ? `${damage.diceCount}d${damage.dieSize}`
    : safeText(damage.formula) || "Damage";
  const type = safeText(damage.type);
  return `${dice}${rolls}${modifierText} = ${damage.total}${type ? ` ${type}` : ""}`;
}

export default function CharacterSheetRollResult({ roll, className = "", label = "Last roll" }) {
  if (!roll) return null;
  const damageText = formatCharacterSheetDamage(roll);

  return (
    <div className={`sheet-last-roll ${damageText ? "has-damage" : ""} ${className}`.trim()} role="status" aria-live="polite">
      <div className="sheet-last-roll__attack">
        <strong>{label}:</strong> {formatCharacterSheetRoll(roll)}
      </div>
      {damageText ? (
        <div className="sheet-last-roll__damage">
          <strong>Damage:</strong> {damageText}
        </div>
      ) : null}
    </div>
  );
}
