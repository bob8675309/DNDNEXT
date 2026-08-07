export const safeText = (value) => String(value ?? "").trim();
export const normalized = (value) => safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export const slug = (value) => normalized(value).replace(/\s+/g, "-");
export const unique = (values = []) => [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];

export const WARLOCK_INVOCATION_PROGRESSION_XPHB = Object.freeze([1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10]);
export const WARLOCK_INVOCATION_PROGRESSION_PHB = Object.freeze([0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8]);
export const BATTLE_MASTER_MANEUVER_PROGRESSION = Object.freeze([0, 0, 3, 3, 3, 3, 5, 5, 5, 7, 7, 7, 7, 7, 9, 9, 9, 9, 9, 9]);
export const SORCERER_METAMAGIC_PROGRESSION_XPHB = Object.freeze([0, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 6, 6, 6, 6]);
export const SORCERER_METAMAGIC_PROGRESSION_PHB = Object.freeze([0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4]);
export const ARTIFICER_PLAN_PROGRESSION_EFA = Object.freeze([0, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8]);
export const ARCANE_SHOT_PROGRESSION = Object.freeze([0, 0, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6]);
export const RUNE_KNIGHT_PROGRESSION = Object.freeze([0, 0, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5]);
export const FOUR_ELEMENTS_DISCIPLINE_PROGRESSION = Object.freeze([0, 0, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5]);

export const OPTION_SUMMARIES = Object.freeze({
  "agonizing blast": "Add Charisma to one known Warlock damage cantrip's damage rolls.",
  "armor of shadows": "Cast Mage Armor on yourself without spending a spell slot.",
  "ascendant step": "Cast Levitate on yourself without spending a spell slot.",
  "devils sight": "See normally in darkness, including magical darkness, to the feature's listed range.",
  "devouring blade": "Attack three times with your pact weapon when you take the Attack action.",
  "eldritch mind": "Gain advantage on Constitution saves made to maintain Concentration.",
  "eldritch smite": "Spend a Pact Magic slot after a pact-weapon hit for extra force damage and a knockdown.",
  "eldritch spear": "Increase the range of a chosen known Warlock damage cantrip.",
  "fiendish vigor": "Cast False Life on yourself without spending a spell slot.",
  "gaze of two minds": "Perceive through a willing creature and cast from its space while maintaining the link.",
  "gift of the depths": "Gain a swimming speed, breathe underwater, and cast Water Breathing without a slot.",
  "gift of the protectors": "Record names in your tome so a recorded creature can avoid dropping to 0 Hit Points once.",
  "investment of the chain master": "Empower your familiar and command its attack with a Bonus Action.",
  "lessons of the first ones": "Gain an Origin feat for which you qualify. This invocation is repeatable.",
  "lifedrinker": "Your pact weapon deals extra necrotic, psychic, or radiant damage and can restore Hit Points.",
  "mask of many faces": "Cast Disguise Self without spending a spell slot.",
  "master of myriad forms": "Cast Alter Self without spending a spell slot.",
  "misty visions": "Cast Silent Image without spending a spell slot.",
  "one with shadows": "Become Invisible in dim light or darkness until you move, act, or react.",
  "otherworldly leap": "Cast Jump on yourself without spending a spell slot.",
  "pact of the blade": "Conjure or bond a pact weapon and use Charisma for its attack and damage rolls.",
  "pact of the chain": "Learn Find Familiar and gain expanded familiar forms and pact-specific commands.",
  "pact of the tome": "Gain a Book of Shadows containing chosen cantrips and level-1 rituals.",
  "repelling blast": "Push a creature hit by a chosen Warlock damage cantrip.",
  "thirsting blade": "Attack twice with your pact weapon when you take the Attack action.",
  "visions of distant realms": "Cast Arcane Eye without spending a spell slot.",
  "whispers of the grave": "Cast Speak with Dead without spending a spell slot.",
  "witch sight": "See a creature's true form despite shapechanging or illusion within the feature's range.",
  "ambush": "Add a Superiority Die to a Stealth check or Initiative roll.",
  "bait and switch": "Swap places with a willing nearby creature and grant one of you an AC bonus.",
  "commanders strike": "Direct an ally to use its Reaction to make an attack.",
  "commanding presence": "Add a Superiority Die to selected Charisma checks.",
  "disarming attack": "Add damage and force the target to save or drop an object.",
  "distracting strike": "Add damage and give the next allied attacker advantage against the target.",
  "evasive footwork": "Add a Superiority Die to AC while moving.",
  "feinting attack": "Use a Bonus Action to gain advantage and add damage to your next attack.",
  "goading attack": "Add damage and hinder the target's attacks against creatures other than you.",
  "lunging attack": "Increase an attack's reach and add the Superiority Die to its damage.",
  "maneuvering attack": "Add damage and let an ally move with reduced opportunity-attack risk.",
  "menacing attack": "Add damage and frighten the target on a failed save.",
  "parry": "Use a Reaction and Superiority Die to reduce melee damage taken.",
  "precision attack": "Add a Superiority Die to an attack roll.",
  "pushing attack": "Add damage and push the target on a failed save.",
  "rally": "Use a Bonus Action to grant an ally Temporary Hit Points.",
  "riposte": "Use a Reaction to attack a creature that misses you in melee.",
  "sweeping attack": "Damage a second nearby creature after a melee weapon hit.",
  "tactical assessment": "Add a Superiority Die to selected Investigation, History, or Insight checks.",
  "trip attack": "Add damage and knock the target Prone on a failed save.",
  "careful spell": "Protect chosen creatures from the worst effects of one of your saving-throw spells.",
  "distant spell": "Increase a spell's range or give a touch spell a short range.",
  "empowered spell": "Reroll a limited number of a spell's damage dice.",
  "extended spell": "Extend a spell's duration and improve Concentration protection after casting it.",
  "heightened spell": "Impose disadvantage on one target's saves against the spell.",
  "quickened spell": "Change an eligible spell's casting time to a Bonus Action.",
  "seeking spell": "Reroll a missed spell attack.",
  "subtle spell": "Cast without verbal, somatic, or most material components.",
  "transmuted spell": "Change one listed elemental damage type to another listed type.",
  "twinned spell": "Increase the number of targets of an eligible spell.",
});

export const INVOCATION_PREREQUISITES = Object.freeze({
  "agonizing blast": { minLevel: 2, followup: "Choose the affected known Warlock damage cantrip on the Spells step." },
  "ascendant step": { minLevel: 5 },
  "devils sight": { minLevel: 2 },
  "devouring blade": { minLevel: 12, requires: "Pact of the Blade" },
  "eldritch smite": { minLevel: 5, requires: "Pact of the Blade" },
  "eldritch spear": { minLevel: 2, followup: "Choose the affected known Warlock damage cantrip on the Spells step." },
  "fiendish vigor": { minLevel: 2 },
  "gift of the depths": { minLevel: 5 },
  "gift of the protectors": { minLevel: 9, requires: "Pact of the Tome" },
  "investment of the chain master": { minLevel: 5, requires: "Pact of the Chain" },
  "lessons of the first ones": { minLevel: 2, followup: "Choose the granted Origin feat in this choice card." },
  "lifedrinker": { minLevel: 9, requires: "Pact of the Blade" },
  "mask of many faces": { minLevel: 2 },
  "master of myriad forms": { minLevel: 5 },
  "one with shadows": { minLevel: 5 },
  "otherworldly leap": { minLevel: 2 },
  "repelling blast": { minLevel: 2, followup: "Choose the affected known Warlock damage cantrip on the Spells step." },
  "thirsting blade": { minLevel: 5, requires: "Pact of the Blade" },
  "visions of distant realms": { minLevel: 15 },
  "whispers of the grave": { minLevel: 7 },
  "witch sight": { minLevel: 15 },
});

export const CLASS_OPTION_PREREQUISITES = Object.freeze({
  "hill rune": { minLevel: 7 },
  "storm rune": { minLevel: 7 },
  "breath of winter": { minLevel: 17 },
  "clench of the north wind": { minLevel: 6 },
  "eternal mountain defense": { minLevel: 17 },
  "flames of the phoenix": { minLevel: 11 },
  "gong of the summit": { minLevel: 6 },
  "mist stance": { minLevel: 11 },
  "ride the wind": { minLevel: 11 },
  "river of hungry flame": { minLevel: 17 },
  "wave of rolling earth": { minLevel: 17 },
});
