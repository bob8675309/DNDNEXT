const text = (value) => String(value ?? "").trim();
const keyFor = (classRow = {}) => text(classRow?.class_key).toLowerCase();

const SPECIAL_CLASS_SUMMARIES = Object.freeze({
  "monster-hunter": "A tactical martial hunter who records dangerous creatures in a personal Monster Grimoire, combines weapon mastery with Studied Response reaction attacks, and expands that specialized knowledge as their experience grows. At level 3 the hunter joins the Carver, Devourer, Occultist, or Trapper Guild, shifting the class toward fearless frontline combat, monster-derived adaptations, occult countermeasures, or prepared gadgets and traps.",
  mystic: "An Intelligence-focused psionic adept who turns disciplined thought into supernatural effects through talents, psi points, psychic focus, and psionic disciplines rather than conventional spellcasting. A Mystic Order is chosen at level 1—Avatar, Awakened, Immortal, Nomad, Soul Knife, or Wu Jen—and shapes how that mental power inspires allies, manipulates minds, reinforces the body, explores, fights, or controls the natural world.",
  "expert-sidekick": "A support-oriented NPC sidekick built around broad proficiency, timely assistance, mobility, and Expertise. The Expert can Help as a Bonus Action, develops Cunning Action, and grows into a versatile problem-solver beside the adventuring party.",
  "warrior-sidekick": "A combat-focused NPC sidekick trained to stand beside adventurers in a fight. The Warrior chooses an Attacker or Defender role at level 1 and develops dependable offense and durability through features such as Second Wind and Improved Critical.",
  "spellcaster-sidekick": "A magic-focused NPC sidekick that chooses a Mage, Healer, or Prodigy role at level 1. That role determines its spell list and spellcasting ability—Intelligence, Wisdom, or Charisma—while the class advances a compact spellcasting progression alongside its sidekick features.",
  civilian: "A character without an adventuring class: a townsperson, professional, official, artisan, scholar, attendant, or other ordinary person whose identity comes from species, background, skills, profession, and story rather than class progression.",
});

export function classPresentationSummary(classRow = {}, fallback = "") {
  const special = SPECIAL_CLASS_SUMMARIES[keyFor(classRow)];
  return special || text(classRow?.summary) || fallback;
}

export function classPrimaryAbilities(classRow = {}) {
  const imported = Array.isArray(classRow?.primary_abilities) ? classRow.primary_abilities.filter(Boolean) : [];
  if (imported.length) return imported;
  // Some imported class rows contain the complete source rules but omit the
  // compact primary_abilities presentation field used by the Forge header.
  if (keyFor(classRow) === "artificer") return ["int"];
  if (keyFor(classRow) === "mystic") return ["int"];
  return [];
}

export function classMagicPresentation(classRow = {}, abilityLabels = {}) {
  const key = keyFor(classRow);
  if (key === "mystic") return "Psionics • Intelligence";
  if (key === "monster-hunter") return "Guild-dependent";
  if (key === "spellcaster-sidekick") return "Role-based • Int / Wis / Cha";
  const ability = text(classRow?.spellcasting_ability);
  return ability ? (abilityLabels[ability] || ability) : "None at base class";
}

export function isSidekickClass(classRow = {}) {
  return keyFor(classRow).endsWith("-sidekick");
}