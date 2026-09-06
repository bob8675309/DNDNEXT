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

const STANDARD_CLASS_SUMMARIES = Object.freeze({
  artificer: "Artificers turn practical knowledge into magical invention, combining careful study with tools, crafted devices, and adaptable spellwork. They excel at solving problems before and during an adventure, improving equipment, supporting allies, and shaping a personal specialty around the way they build, experiment, and apply magic.",
  barbarian: "Barbarians meet danger with raw physical power, instinct, and extraordinary resilience. Their defining battle fury lets them endure punishment and hit with frightening force, while their primal path determines whether that ferocity comes from ancestors, nature, divine influence, supernatural transformation, or another source of untamed strength.",
  bard: "Bards turn talent, lore, and force of personality into versatile magic. They inspire companions, undermine enemies, and adapt to unfamiliar problems with an unusually broad range of skills. A bard's chosen college shapes whether that creativity is expressed through performance, swordplay, secrets, eloquence, supernatural tales, or another specialized tradition.",
  cleric: "Clerics wield divine magic through devotion to a deity, sacred ideal, cosmic force, or spiritual calling. They can protect and restore their companions while bringing formidable magic against their enemies. Their divine domain gives that faith a distinct expression, shaping the miracles, combat role, and sacred responsibilities that define the cleric's path.",
  druid: "Druids draw magic from the living world and the primal forces that move through it. They combine versatile nature magic with transformation, survival, and control of the battlefield. A druidic circle emphasizes a particular relationship with nature, from shapeshifting and elemental power to stars, spores, dreams, wildfire, or other ancient traditions.",
  fighter: "Fighters are disciplined combatants whose strength comes from training, battlefield awareness, and mastery of weapons and armor. They can be straightforward front-line defenders or highly technical specialists, adapting their tactics to the encounter at hand. Their martial archetype determines the techniques, supernatural talents, or specialized training that set them apart.",
  monk: "Monks transform disciplined training into remarkable speed, precision, and control over body and spirit. They fight effectively with martial arts, movement, and focused inner power rather than relying on heavy equipment. A monastic tradition determines how that discipline develops, from weapon mastery and shadow to elemental, spiritual, or supernatural techniques.",
  paladin: "Paladins bind martial training to a powerful oath, turning conviction into protective and destructive divine magic. They stand comfortably on the front line, shielding allies, confronting dangerous foes, and delivering decisive bursts of power. The oath they swear defines both their supernatural gifts and the ideals they are expected to uphold.",
  ranger: "Rangers are adaptable warriors and explorers who thrive where civilization gives way to dangerous wilderness. They combine weapon skill, survival expertise, mobility, and nature-oriented magic to track threats and control difficult terrain. Their archetype shapes the quarry, environment, companion, supernatural gift, or specialized hunting style they bring to an adventuring party.",
  rogue: "Rogues rely on precision, timing, mobility, and a deep collection of practical skills rather than brute force. They are experts at exploiting openings, bypassing obstacles, and approaching danger on their own terms. A rogue archetype can emphasize stealth, investigation, deception, magic, swashbuckling, assassination, psychic talent, or another highly specialized tradecraft.",
  sorcerer: "Sorcerers possess magic as an intrinsic part of who they are rather than learning it through formal study. Their spellcasting is flexible and personal, shaped by metamagic and the supernatural origin of their power. That origin might come from dragons, wild magic, cosmic forces, strange bloodlines, divine influence, or another transformative source.",
  warlock: "Warlocks gain occult power through a pact, bargain, bond, or forbidden connection with an extraordinary patron. Their compact spellcasting is reinforced by invocations and other customizable gifts, allowing two warlocks to develop very differently. Patron and pact choices shape the magic, abilities, obligations, and strange advantages that define the character.",
  wizard: "Wizards master arcane magic through disciplined study, experimentation, and carefully recorded formulae. Their spellbooks let them prepare a broad range of magic for the challenges ahead, making them exceptionally versatile problem-solvers. As their knowledge grows, wizards specialize in magical traditions that refine how they study, shape, defend against, and deploy spells.",
});

export function classPresentationSummary(classRow = {}, fallback = "") {
  const special = SPECIAL_CLASS_SUMMARIES[keyFor(classRow)];
  const imported = text(classRow?.summary);
  const standard = STANDARD_CLASS_SUMMARIES[keyFor(classRow)];
  return special || (imported.length >= 180 ? imported : standard || imported || fallback);
}

export function classPrimaryAbilities(classRow = {}) {
  const imported = Array.isArray(classRow?.primary_abilities) ? classRow.primary_abilities.filter(Boolean) : [];
  if (imported.length) return imported;
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
