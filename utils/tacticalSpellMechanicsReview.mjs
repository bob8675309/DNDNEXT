// Tactical spell EXECUTION FAMILY AUDIT (not a spellcasting adapter).
// Conservative, source-bound categorization from canonical catalog metadata.
// No classification ever authorizes a cast. Only a separately reviewed,
// server-enforced RPC and the existing exact supported-key whitelist can do that.
const XPHB = "XPHB";
const RANGED = "Ranged Spell Attack";
const MELEE = "Melee Spell Attack";

// These entries were manually reviewed against the catalog's XPHB spell
// descriptions/scaling. They are NOT an executable rules implementation.
export const XPHB_ATTACK_EXCEPTIONS = Object.freeze({
  "eldritch-blast|XPHB": ["multi-ranged-spell-attacks", "beams-scale-with-character-level", "individual-target-selection", "warlock-invocation-binding"],
  "scorching-ray|XPHB": ["multi-ranged-spell-attacks", "rays-scale-with-slot-level", "individual-target-selection"],
  "steel-wind-strike|XPHB": ["multi-melee-spell-attacks", "distinct-targets-only", "post-attack-teleport"],
  "chromatic-orb|XPHB": ["ranged-spell-attack-with-chain", "selected-damage-type", "conditional-leaps", "rebound-target-restrictions"],
  "ice-knife|XPHB": ["attack-plus-area-save", "explosion-on-hit-or-miss", "secondary-save-damage"],
  "witch-bolt|XPHB": ["ranged-spell-attack-with-duration", "concentration", "later-turn-damage"],
  "melfs-acid-arrow|XPHB": ["ranged-spell-attack-with-delayed-damage", "later-turn-damage", "miss-rider"],
  "sorcerous-burst|XPHB": ["ranged-spell-attack-with-exploding-dice", "selected-damage-type", "conditional-extra-dice"],
  "produce-flame|XPHB": ["persistent-light-with-optional-attack", "nonstandard-action-economy"],
  "starry-wisp|XPHB": ["ranged-spell-attack-with-rider", "revealing-light"],
  "ray-of-sickness|XPHB": ["ranged-spell-attack-with-rider", "poisoned-condition"],
  "ray-of-frost|XPHB": ["ranged-spell-attack-with-rider", "speed-reduction"],
  "thorn-whip|XPHB": ["melee-spell-attack-with-rider", "forced-movement", "non-touch-range"],
  "shocking-grasp|XPHB": ["melee-spell-attack-with-rider", "opportunity-attack-denial"],
  "chill-touch|XPHB": ["melee-spell-attack-with-rider", "healing-denial"],
  "guiding-bolt|XPHB": ["ranged-spell-attack-with-rider", "one-shot-advantage"],
  "flame-blade|XPHB": ["persistent-spell-attack", "repeatable-later-turn-attacks", "concentration"],
  "spiritual-weapon|XPHB": ["persistent-spell-attack", "repeatable-later-turn-attacks", "concentration"],
  "vampiric-touch|XPHB": ["melee-spell-attack-with-healing", "damage-based-self-healing", "concentration"],
  "grasping-vine|XPHB": ["persistent-spell-attack", "grapple", "concentration"],
  "bigbys-hand|XPHB": ["persistent-summoned-effect", "multiple-mode-attack-and-save", "concentration"],
  "mordenkainens-sword|XPHB": ["persistent-spell-attack", "repeatable-later-turn-attacks", "concentration"]
});

// Specials whose catalog attack_type is EMPTY but that are not ordinary
// single-target saves or damage spells. Avoid inferring a family from dice.
export const XPHB_NON_ATTACK_EXCEPTIONS = Object.freeze({
  "magic-missile|XPHB": ["auto-hit-allocated-projectiles", "no-attack-roll", "slot-scaled-projectile-count"],
  "fireball|XPHB": ["point-origin-area-save", "sphere", "save-for-half", "slot-scaled-damage"],
  "healing-word|XPHB": ["single-target-healing", "bonus-action", "slot-spending"],
  "mass-healing-word|XPHB": ["multiple-target-healing", "bonus-action", "slot-spending"],
  "burning-hands|XPHB": ["cone-area-save", "save-for-half"],
  "lightning-bolt|XPHB": ["line-area-save", "save-for-half"],
  "acid-splash|XPHB": ["selected-target-area-save", "limited-number-of-targets"],
  "word-of-radiance|XPHB": ["emanation-area-save", "selective-targeting"]
});

function normalizedIdentity(spell) {
  if (!spell || typeof spell !== "object" || typeof spell.spell_key !== "string" ||
      typeof spell.source !== "string") return null;
  const key=spell.spell_key.trim();
  const source=spell.source.trim();
  const lastSeparator=key.lastIndexOf("|");
  if (lastSeparator <= 0 || key.slice(lastSeparator+1) !== source) return null;
  return { key, source };
}
function isFilled(x) {return typeof x === "string" && x.trim() !== "";}
function hasArray(x) {return Array.isArray(x) && x.length>0;}
function familyFromSignals(spell) {
  if (isFilled(spell.attack_type)) {
    if (spell.attack_type===RANGED) return "single-ranged-spell-attack-review";
    if (spell.attack_type===MELEE) return "single-melee-spell-attack-review";
    return "nonstandard-attack-review";
  }
  if (hasArray(spell.saving_throw_abilities)) {
    return isFilled(spell.area_type)
      ? "area-saving-throw-review"
      : "save-or-area-shape-review";
  }
  if (isFilled(spell.healing_dice)) return "healing-or-support-review";
  if (isFilled(spell.damage_dice)) return "damage-without-attack-review";
  return "utility-control-duration-or-other-review";
}

export function classifyTacticalSpellForReview(spell, approvedAdapterKeys = []) {
  const identity=normalizedIdentity(spell);
  if (!identity) return { key:null, source:null, family:"invalid-catalog-identity", status:"manual-review", approved:false, exceptions:[] };
  const {key,source}=identity;
  const approvedSet = new Set(Array.isArray(approvedAdapterKeys) ? approvedAdapterKeys.map(x => typeof x === "string" ? x.toLowerCase() : null).filter(Boolean) : []);
  // Whitelist membership is a descriptive report of current UI contracts.
  // It does not confer RPC EXECUTE or authorization privileges.
  const approved=source===XPHB && approvedSet.has(key.toLowerCase());
  if (source!==XPHB) return {
    key,source,family:"alternate-source-edition-review",status:"manual-review",approved:false,exceptions:[]
  };
  const details=XPHB_ATTACK_EXCEPTIONS[key] || XPHB_NON_ATTACK_EXCEPTIONS[key] || null;
  const family=details?.[0] || familyFromSignals(spell);
  return {
    key,source,family,
    status:approved ? "existing-reviewed-adapter" : "manual-review",
    approved, exceptions:details ? details.slice(1) : [],
    catalogueSignals:{
      attackType:isFilled(spell.attack_type)?spell.attack_type:null,
      hasSavingThrow:hasArray(spell.saving_throw_abilities),
      hasAreaType:isFilled(spell.area_type),
      hasDamageDice:isFilled(spell.damage_dice),
      hasHealingDice:isFilled(spell.healing_dice),
      concentration:spell.concentration===true
    }
  };
}
