const safe = (value) => String(value ?? "").trim();
const normalized = (value) => safe(value).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, " ").trim();

const SIMPLE_RULE_REFERENCES = Object.freeze({
  deafened: {
    title: "Deafened",
    kindLabel: "Condition",
    source: "Core Rules",
    description: "A Deafened creature can't hear and automatically fails any ability check that requires hearing.",
  },
  incapacitated: {
    title: "Incapacitated",
    kindLabel: "Condition",
    source: "Core Rules",
    description: "An Incapacitated creature can't take actions, Bonus Actions, or Reactions, can't maintain Concentration, and can't speak.",
  },
  "difficult terrain": {
    title: "Difficult Terrain",
    kindLabel: "Movement Rule",
    source: "Core Rules",
    description: "Every foot of movement in Difficult Terrain costs 1 extra foot. Multiple sources of Difficult Terrain don't add together unless a rule says otherwise.",
  },
  dodge: {
    title: "Dodge",
    kindLabel: "Action",
    source: "Core Rules",
    description: "Until the start of your next turn, attack rolls against you have Disadvantage if you can see the attacker, and you make Dexterity saving throws with Advantage. You lose this benefit if you are Incapacitated or your Speed is 0.",
  },
});

function bestialSpiritReference(source = "XPHB") {
  const xphb = safe(source).toUpperCase() === "XPHB";
  return {
    title: "Bestial Spirit",
    kindLabel: "Summoned Stat Block",
    source: xphb ? "XPHB" : safe(source) || "TCE",
    description: "Summon Beast uses this stat block. Choose Air, Land, or Water when you cast the spell; that choice changes Hit Points, movement, and which traits apply.",
    statBlock: {
      sizeType: "Small Beast",
      alignment: xphb ? "Neutral" : "Unaligned",
      armorClass: "11 + the spell's level",
      hitPoints: "20 (Air) or 30 (Land/Water) + 5 for each spell level above 2",
      speed: "30 ft.; Climb 30 ft. (Land); Fly 60 ft. (Air); Swim 30 ft. (Water)",
      abilities: [
        ["STR", "18", "+4"],
        ["DEX", "11", "+0"],
        ["CON", "16", "+3"],
        ["INT", "4", "−3"],
        ["WIS", "14", "+2"],
        ["CHA", "5", "−3"],
      ],
      senses: "Darkvision 60 ft.; Passive Perception 12",
      languages: xphb ? "Understands the languages you know" : "Understands the languages you speak",
      proficiencyBonus: "Equals your Proficiency Bonus",
      traits: [
        ["Flyby (Air Only)", "The spirit doesn't provoke Opportunity Attacks when it flies out of an enemy's reach."],
        ["Pack Tactics (Land and Water Only)", "The spirit has Advantage on an attack roll against a creature if at least one ally is within 5 feet of the creature and that ally isn't Incapacitated."],
        ["Water Breathing (Water Only)", "The spirit can breathe only underwater."],
      ],
      actions: [
        ["Multiattack", `The spirit makes a number of ${xphb ? "Rend" : "Maul"} attacks equal to half the spell's level, rounded down.`],
        [xphb ? "Rend" : "Maul", `Melee attack using your spell attack modifier; reach 5 ft. Hit: 1d8 + 4 + the spell's level Piercing damage.`],
      ],
    },
  };
}

function hinderedReference(spell = {}) {
  if (normalized(spell?.name) === "rime s binding ice") {
    return {
      title: "Hindered by Ice",
      kindLabel: "Spell Debuff",
      source: safe(spell?.source) || "FTD",
      description: "In Rime's Binding Ice, being hindered by the ice reduces the creature's Speed to 0 for up to 1 minute. The effect ends early when that creature, or another creature within reach, uses an action to break away the ice.",
    };
  }
  return {
    title: "Hindered",
    kindLabel: "Rules Reference",
    source: safe(spell?.source) || "Source Rule",
    description: "Hindered is descriptive wording rather than a universal condition here. The surrounding spell or feature defines the exact penalty, duration, and way to end it.",
  };
}

export function spellRuleReferenceDetail(reference = {}, spell = {}) {
  const rawName = safe(reference.name || reference.label);
  const key = normalized(rawName);
  let resolved = null;

  if (key === "bestial spirit") resolved = bestialSpiritReference(reference.source || spell?.source || "XPHB");
  else if (key === "hindered" || key === "hinder") resolved = hinderedReference(spell);
  else resolved = SIMPLE_RULE_REFERENCES[key] || null;

  const fallback = {
    title: safe(reference.label || rawName) || "Rules Reference",
    kindLabel: reference.kind === "creature" || reference.kind === "statblock" ? "Creature Reference"
      : reference.kind === "condition" ? "Condition"
        : reference.kind === "action" ? "Action"
          : "Rules Reference",
    source: safe(reference.source) || "Source Rule",
    description: `This rule is referenced by ${safe(spell?.name) || "the selected spell"}. Its exact effect remains governed by the source text shown on the spell card.`,
  };

  return {
    type: "rulesReference",
    reference: {
      ...fallback,
      ...(resolved || {}),
      referenceKind: reference.kind || "rule",
      spellName: safe(spell?.name),
    },
  };
}
