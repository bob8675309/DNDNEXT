function valueOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function rollData(result) {
  return result?.attackRoll || result || {};
}

function sourceLabels(result) {
  const roll = rollData(result);
  const advantage = [];
  const disadvantage = [];

  if (
    result?.guidingBoltAdvantage ||
    result?.guidingBoltEffectConsumed ||
    roll?.guidingBoltAdvantage ||
    roll?.guidingBoltEffectConsumed
  ) advantage.push("Guiding Bolt");

  if (result?.dodging) disadvantage.push("Dodge");
  if (
    result?.viciousMockeryDisadvantage ||
    result?.viciousMockeryEffectConsumed ||
    roll?.viciousMockeryDisadvantage ||
    roll?.viciousMockeryEffectConsumed
  ) disadvantage.push("Vicious Mockery");

  return {
    advantage: unique(advantage),
    disadvantage: unique(disadvantage),
  };
}

function modeText(result) {
  const roll = rollData(result);
  const advantage = Boolean(result?.advantage ?? roll?.advantage);
  const disadvantage = Boolean(result?.disadvantage ?? roll?.disadvantage);
  const canceled = Boolean(
    result?.advantageCanceledByDisadvantage ?? roll?.advantageCanceledByDisadvantage
  );
  const sources = sourceLabels(result);

  if (canceled || (advantage && disadvantage)) {
    const sourceText = [
      sources.advantage.length ? `${sources.advantage.join(" + ")} Advantage` : "Advantage",
      sources.disadvantage.length ? `${sources.disadvantage.join(" + ")} Disadvantage` : "Disadvantage",
    ].join(" canceled by ");
    return `Normal roll (${sourceText})`;
  }

  if (advantage) {
    return `Advantage${sources.advantage.length ? ` (${sources.advantage.join(" + ")})` : ""}`;
  }

  if (disadvantage) {
    return `Disadvantage${sources.disadvantage.length ? ` (${sources.disadvantage.join(" + ")})` : ""}`;
  }

  return "Normal roll";
}

function damageData(result) {
  const nested = result?.damage && typeof result.damage === "object" ? result.damage : null;
  const amount = valueOrNull(nested?.damage ?? result?.damage ?? result?.rawDamage) ?? 0;
  const type = String(result?.damageType || nested?.damageType || "").trim();
  return {
    amount,
    type,
    immune: Boolean(result?.immune ?? nested?.immune),
    resistant: Boolean(result?.resistant ?? nested?.resistant),
    vulnerable: Boolean(result?.vulnerable ?? nested?.vulnerable),
  };
}

function modifierMath(kept, bonus, total) {
  if (kept === null && total === null) return "Total ?";
  if (bonus === null || kept === null) return `Total ${total ?? kept ?? "?"}`;
  const operator = bonus >= 0 ? "+" : "−";
  return `${kept} ${operator} ${Math.abs(bonus)} = ${total ?? kept + bonus}`;
}

export function hasAttackRollBreakdown(result) {
  const roll = rollData(result);
  return Boolean(
    result &&
    (
      valueOrNull(roll?.firstRoll) !== null ||
      valueOrNull(roll?.secondRoll) !== null ||
      valueOrNull(roll?.roll) !== null ||
      valueOrNull(result?.roll) !== null
    ) &&
    valueOrNull(result?.targetAc) !== null
  );
}

export function formatAttackRollBreakdown(result, options = {}) {
  if (!hasAttackRollBreakdown(result)) return "";

  const roll = rollData(result);
  const first = valueOrNull(roll?.firstRoll ?? result?.firstRoll ?? result?.roll);
  const second = valueOrNull(roll?.secondRoll ?? result?.secondRoll);
  const kept = valueOrNull(roll?.roll ?? result?.roll ?? first);
  const bonus = valueOrNull(result?.attackBonus ?? roll?.attackBonus);
  const total = valueOrNull(result?.total) ?? (kept !== null && bonus !== null ? kept + bonus : kept);
  const targetAc = valueOrNull(result?.targetAc);
  const baseTargetAc = valueOrNull(result?.baseTargetAc);
  const coverAcBonus = valueOrNull(result?.coverAcBonus) ?? 0;
  const attackName = String(options.attackName || result?.weapon || result?.spell || "Attack").trim();
  const rolls = second !== null
    ? `rolled ${first ?? "?"} and ${second}, kept ${kept ?? "?"}`
    : `rolled ${kept ?? first ?? "?"}`;
  const acText = coverAcBonus > 0 && baseTargetAc !== null
    ? `AC ${targetAc ?? "?"} (base ${baseTargetAc} + ${coverAcBonus} cover)`
    : `AC ${targetAc ?? "?"}`;

  let outcome = "Miss.";
  if (result?.hit) {
    const damage = damageData(result);
    const affinity = damage.immune
      ? " Target was immune."
      : damage.resistant
        ? " Resistance reduced the damage."
        : damage.vulnerable
          ? " Vulnerability increased the damage."
          : "";
    const damageText = damage.type ? `${damage.amount} ${damage.type} damage` : `${damage.amount} damage`;
    outcome = `${result?.critical ? "Critical hit" : "Hit"} for ${damageText}.${affinity}`;
  }

  return `${attackName} • ${modeText(result)} — ${rolls}. ${modifierMath(kept, bonus, total)} vs ${acText}. ${outcome}`;
}
