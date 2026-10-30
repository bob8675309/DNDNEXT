// Rules-only helper for deterministic tests and future presentation.
// The authoritative implementation must remain inside the database.
export const eldritchBlastBeamCount = (characterLevel) => {
  if (!Number.isInteger(characterLevel) || characterLevel < 1 || characterLevel > 20) {
    throw new RangeError("A canonical character level from 1 through 20 is required");
  }
  return characterLevel >= 17 ? 4 : characterLevel >= 11 ? 3 : characterLevel >= 5 ? 2 : 1;
};
export const agonizingBlastModifier = ({ invocationOptionKey, chosenSpellKey, spellKey, charismaScore }) => {
  if (String(invocationOptionKey).toLowerCase() !== "optional-feature:agonizing-blast|xphb") return 0;
  if (!spellKey || !chosenSpellKey || String(chosenSpellKey).toLowerCase() !== String(spellKey).toLowerCase()) return 0;
  if (!Number.isInteger(charismaScore) || charismaScore < 1 || charismaScore > 30) {
    throw new RangeError("Canonical Charisma score required");
  }
  return Math.floor((charismaScore - 10) / 2);
};
