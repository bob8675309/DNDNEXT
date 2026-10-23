import { itemRuleReferenceForLabel } from "./itemRuleReferences.js";

const safe = (value) => String(value ?? "").trim();
const normalized = (value) => safe(value).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, " ").trim();

// Shared conditions and weapon masteries live in itemRuleReferences.js.
// This glossary supplies only the actions and core terms not covered there.
const CORE_RULE_REFERENCES = Object.freeze({
  attack: ["Attack", "Action", "Make a weapon attack or an Unarmed Strike. Class features such as Extra Attack can modify the number of attacks."],
  dash: ["Dash", "Action", "Gain extra movement this turn equal to your current Speed after modifiers. You may use a special movement Speed instead."],
  disengage: ["Disengage", "Action", "Your movement doesn't provoke Opportunity Attacks for the remainder of this turn."],
  dodge: ["Dodge", "Action", "Until your next turn begins, attacks against you have Disadvantage if you can see the attacker, and you have Advantage on Dexterity saves. These benefits end if you're Incapacitated or your Speed becomes 0."],
  help: ["Help", "Action", "Assist another creature with an eligible ability check or an attack against a nearby enemy, as described by the Help action."],
  hide: ["Hide", "Action", "Attempt a DC 15 Dexterity (Stealth) check while out of enemy sight and sufficiently obscured or behind cover. On success you gain the Invisible condition while hidden, until something reveals you."],
  influence: ["Influence", "Action", "Try to persuade, deceive, intimidate, or otherwise influence a creature. The DM determines its willingness and whether an ability check is needed."],
  magic: ["Magic", "Action", "Cast a spell with an action casting time, or activate a feature or magic item that requires the Magic action."],
  ready: ["Ready", "Action", "Choose a perceptible trigger and an action or movement to carry out using your Reaction before your next turn. Readying a spell requires Concentration."],
  search: ["Search", "Action", "Use a Wisdom check, such as Perception, to look for something not immediately obvious."],
  study: ["Study", "Action", "Use an Intelligence check to recall or investigate information, according to the subject."],
  utilize: ["Utilize", "Action", "Use an object that requires your action, rather than a simple free interaction."],
  concentration: ["Concentration", "Spell Rule", "Maintain one Concentration effect at a time. Taking damage calls for a Constitution save (DC 10 or half the damage, whichever is higher, maximum 30). Starting another Concentration effect, becoming Incapacitated, or dying ends it."],
  "difficult terrain": ["Difficult Terrain", "Movement Rule", "Moving 1 foot through Difficult Terrain costs 2 feet of movement. Multiple sources normally don't increase this further."],
  crawling: ["Crawling", "Movement Rule", "Each foot crawled costs 1 extra foot of movement, or 2 extra feet in Difficult Terrain."],
  advantage: ["Advantage", "D20 Test", "Roll two d20s and use the higher result. Multiple sources don't stack, and Disadvantage cancels Advantage."],
  disadvantage: ["Disadvantage", "D20 Test", "Roll two d20s and use the lower result. Multiple sources don't stack, and Advantage cancels Disadvantage."],
  "half cover": ["Half Cover", "Cover", "Gain +2 to AC and Dexterity saving throws against effects on the other side of the cover."],
  "three quarters cover": ["Three-Quarters Cover", "Cover", "Gain +5 to AC and Dexterity saving throws against effects on the other side of the cover."],
  "total cover": ["Total Cover", "Cover", "You normally can't be targeted directly by an attack or spell from behind Total Cover, although an area effect may reach you."],
  "saving throw": ["Saving Throw", "D20 Test", "Roll a d20 to resist an effect and add the relevant ability modifier and any applicable proficiency bonus. The effect states what happens on success or failure."],
  "unarmed strike": ["Unarmed Strike", "Attack", "Make a melee attack without a weapon, such as a punch, or attempt to Grapple or Shove a creature within 5 feet."],
  "bonus action": ["Bonus Action", "Turn Rule", "You can take one Bonus Action on your turn, but only if a rule gives you one."],
  reaction: ["Reaction", "Turn Rule", "Respond to a specified trigger, even on another creature's turn. You regain your Reaction at the start of your next turn."],
});
function coreRuleReference(key) {
  const row = CORE_RULE_REFERENCES[key];
  return row ? { title: row[0], kindLabel: row[1], source: "2024 core rules", description: row[2] } : null;
}

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
  else resolved = itemRuleReferenceForLabel(rawName)?.reference || coreRuleReference(key);

  const fallback = {
    title: safe(reference.label || rawName) || "Rules Reference",
    kindLabel: reference.kind === "creature" || reference.kind === "statblock" ? "Creature Reference"
      : reference.kind === "condition" ? "Condition"
        : reference.kind === "action" ? "Action"
          : "Rules Reference",
    source: safe(reference.source) || "Source Rule",
    description: `No standalone definition is indexed here for ${rawName || "this rule"}. Consult the named rule\'s source entry.`,
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
