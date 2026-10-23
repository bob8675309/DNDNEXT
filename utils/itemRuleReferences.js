// Shared player-facing rule references for ItemCard text and stat fields.
// Definitions are intentionally compact; the source item/feature remains authoritative.

function safe(value = "") { return String(value ?? "").trim(); }

const CONDITIONS = Object.freeze({
  blinded: { title: "Blinded", source: "2024 core rules", description: "A Blinded creature can’t see and automatically fails checks that require sight. Attack rolls against it have Advantage, and its attack rolls have Disadvantage." },
  charmed: { title: "Charmed", source: "2024 core rules", description: "A Charmed creature can’t attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has Advantage on social checks made to interact with it." },
  dazed: { title: "Dazed", source: "Grim Hollow Campaign Guide", description: "A Dazed creature can’t maintain Concentration. If it was concentrating when it became Dazed, that Concentration ends." },
  deafened: { title: "Deafened", source: "2024 core rules", description: "A Deafened creature can’t hear and automatically fails checks that require hearing." },
  exhaustion: { title: "Exhaustion", source: "2024 core rules", description: "Each Exhaustion level gives a −2 penalty to D20 Tests and reduces Speed by 5 feet. At level 6, you die. A Long Rest removes one level." },
  fatigued: { title: "Fatigued", source: "Source-defined condition", description: "Fatigued is not one universal condition in the current DNDNext rules catalog. The effect that applies Fatigued is the authority for its penalties and duration.", notes: ["This reference deliberately avoids inventing a campaign-wide Fatigued rule."] },
  frightened: { title: "Frightened", source: "2024 core rules", description: "A Frightened creature has Disadvantage on ability checks and attack rolls while the source of its fear is within line of sight, and it can’t willingly move closer to that source." },
  grappled: { title: "Grappled", source: "2024 core rules", description: "Your Speed becomes 0. You have Disadvantage on attacks against targets other than the grappler. The grappler can drag you at an extra movement cost. You can use an action to try to escape; the grapple also ends if the grappler becomes Incapacitated or you're moved beyond its reach." },
  invisible: { title: "Invisible", source: "2024 core rules", description: "You have Advantage on Initiative. Effects that require seeing you can't target you unless their creator can see you. Your attacks have Advantage and attacks against you have Disadvantage, except against a creature that can see you." },
  incapacitated: { title: "Incapacitated", source: "2024 core rules", description: "You can't take actions, Bonus Actions, or Reactions; your Concentration ends; and you can't speak. If you're Incapacitated when you roll Initiative, the roll has Disadvantage." },
  paralyzed: { title: "Paralyzed", source: "2024 core rules", description: "A Paralyzed creature is Incapacitated, can’t move, and automatically fails Strength and Dexterity saving throws. Attacks against it have Advantage, and a hit from within 5 feet is a Critical Hit." },
  petrified: { title: "Petrified", source: "2024 core rules", description: "You and your nonmagical possessions become solid material, usually stone; your weight increases tenfold and you stop aging. You're Incapacitated, Speed 0, and automatically fail Strength and Dexterity saves. Attacks against you have Advantage. You resist all damage and are immune to the Poisoned condition." },
  poisoned: { title: "Poisoned", source: "2024 core rules", description: "A Poisoned creature has Disadvantage on attack rolls and ability checks." },
  prone: { title: "Prone", source: "2024 core rules", description: "Movement: Crawl (each foot costs 1 extra foot) or spend half your Speed to stand and end Prone; you can't stand if your Speed is 0. Your attacks: Disadvantage. Attacks against you: Advantage if the attacker is within 5 feet; otherwise Disadvantage." },
  restrained: { title: "Restrained", source: "2024 core rules", description: "A Restrained creature’s Speed is 0. Attacks against it have Advantage, its attacks have Disadvantage, and it has Disadvantage on Dexterity saving throws." },
  stunned: { title: "Stunned", source: "2024 core rules", description: "You are Incapacitated, automatically fail Strength and Dexterity saving throws, and attack rolls against you have Advantage. Stunned itself does not reduce Speed to 0." },
  unconscious: { title: "Unconscious", source: "2024 core rules", description: "You're Incapacitated and Prone, drop held items, and are unaware of your surroundings. Your Speed is 0; attacks against you have Advantage; you automatically fail Strength and Dexterity saves. Hits from within 5 feet are Critical Hits. You remain Prone when you regain consciousness." },
  bleeding: { title: "Bleeding", source: "Grim Hollow Campaign Guide", description: "A Bleeding creature can’t regain Hit Points except by spending Hit Point Dice or completing a Long Rest. The Grim Hollow condition ends after the rest specified by its source rule." },
});

const CORE_MASTERIES = Object.freeze({
  cleave: { title: "Cleave", source: "2024 Weapon Mastery", description: "After you hit with the weapon, Cleave can let you make a follow-up attack against a second nearby creature that is also within the weapon’s reach. The extra hit follows the mastery’s damage-modifier rule." },
  graze: { title: "Graze", source: "2024 Weapon Mastery", description: "When you miss with the weapon, Graze still deals damage equal to the ability modifier used for the attack. That damage is the weapon’s normal damage type." },
  nick: { title: "Nick", source: "2024 Weapon Mastery", description: "Nick lets the extra attack from the Light weapon property occur as part of the Attack action instead of costing a Bonus Action, subject to the mastery’s once-per-turn limit." },
  push: { title: "Push", source: "2024 Weapon Mastery", description: "When you hit an eligible creature, Push can move it up to 10 feet straight away from you." },
  sap: { title: "Sap", source: "2024 Weapon Mastery", description: "After you hit a creature, Sap gives it Disadvantage on its next attack roll before the start of your next turn." },
  slow: { title: "Slow", source: "2024 Weapon Mastery", description: "After you hit a creature, Slow reduces its Speed by 10 feet until the start of your next turn. Repeated Slow effects don’t stack with themselves." },
  topple: { title: "Topple", source: "2024 Weapon Mastery", description: "When you hit, Topple can force the target to make a Constitution saving throw against your mastery DC. On a failure, the target falls Prone." },
  vex: { title: "Vex", source: "2024 Weapon Mastery", description: "When you hit a creature, Vex gives you Advantage on your next attack roll against that creature before the end of your next turn." },
});

const GRIM_HOLLOW_MASTERIES = Object.freeze({
  brutal: { title: "Brutal", source: "Grim Hollow: Player’s Guide (2024)", description: "A Brutal weapon scores Critical Hits on a natural 19 or 20. If your Critical Range is already wider, widen it by 1 more point. A Critical Hit with the weapon also deals one additional weapon damage die." },
  defending: { title: "Defending", source: "Grim Hollow: Player’s Guide (2024)", description: "When a melee attack hits you while you wield a Defending weapon, you can use your Reaction, roll 1d4, and add the result to your AC against the triggering attack." },
  disarming: { title: "Disarming", source: "Grim Hollow: Player’s Guide (2024)", description: "After you hit with a Disarming weapon during the Attack action, you can use a Bonus Action that turn to contest the target with opposed attack rolls. If you win and the held weapon can be dropped, it falls in the target’s space." },
  entangling: { title: "Entangling", source: "Grim Hollow: Player’s Guide (2024)", description: "Entangling weapons can catch and control a target after a hit. Use the Grim Hollow mastery’s grapple procedure and escape rules for the weapon." },
  returning: { title: "Returning", source: "Grim Hollow: Player’s Guide (2024)", description: "After you make a ranged attack with a Returning weapon, it returns to you whether the attack hits or misses; you can catch it if you have a free hand." },
  scatter: { title: "Scatter", source: "Grim Hollow: Player’s Guide (2024)", description: "A Scatter weapon can damage creatures near the original target when you hit. The affected distance is the Scatter value printed with the mastery, and the secondary damage follows the source rule." },
  set: { title: "Set", source: "Grim Hollow: Player’s Guide (2024)", description: "While wielding a Set weapon, when a target enters your reach you can use your Reaction to make a melee attack with that weapon against the target." },
  "strong-draw": { title: "Strong-Draw", source: "Grim Hollow: Player’s Guide (2024)", description: "A Strong-Draw weapon requires Strength 13 or higher to avoid Disadvantage on its attack rolls. You add both your Strength and Dexterity modifiers to its damage." },
  swift: { title: "Swift", source: "Grim Hollow: Player’s Guide (2024)", description: "After you miss with a Swift weapon, your first attack with it against the same target before the end of your next turn has Advantage. If that attack hits, it deals an extra 1d4 of the weapon’s normal damage type." },
});

const REFERENCES = Object.freeze({ ...CONDITIONS, ...CORE_MASTERIES, ...GRIM_HOLLOW_MASTERIES });

export const ITEM_RULE_REFERENCE_TERMS = Object.freeze(
  Object.values(REFERENCES).map((entry) => entry.title).sort((a, b) => b.length - a.length)
);

export function itemRuleReferenceForLabel(label = "", item = {}) {
  const base = safe(label).replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!base) return null;
  const key = base.toLowerCase();
  const entry = REFERENCES[key];
  if (!entry) return null;
  const mastery = Boolean(CORE_MASTERIES[key] || GRIM_HOLLOW_MASTERIES[key]);
  return {
    type: "rulesReference",
    reference: {
      kind: mastery ? "mastery" : "condition",
      kindLabel: mastery ? "Weapon Mastery" : "Condition",
      title: entry.title,
      source: entry.source || safe(item?.source || item?.item_source) || "Source Rule",
      description: entry.description,
      notes: entry.notes || [],
    },
  };
}

export function isKnownItemRuleReference(label = "") { return Boolean(itemRuleReferenceForLabel(label)); }
