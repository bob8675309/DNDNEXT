// DNDNext campaign-owned item balance overrides.
//
// Source imports stay intact, but these campaign variants must survive a full
// catalog rebuild/seed instead of being reverted to upstream rarity/text.
const RESISTANCE_RING_RE = /^Ring of (Acid|Cold|Fire|Force|Lightning|Necrotic|Poison|Psychic|Radiant|Thunder) Resistance$/i;

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function ringDescription(elementLabel) {
  return [
    `While wearing this ring, you have Resistance to ${elementLabel} damage.`,
    `Each time you take ${elementLabel} damage, apply Resistance first, then reduce the remaining damage by 10 (minimum 0).`,
  ].join("\n\n");
}

const PETRIFICATION_BOMB_EFFECT = [
  "Initial Saving Throw",
  "Each creature in a 10-foot-radius cloud makes a Constitution saving throw. On a success, the bomb has no effect on that creature. On a failure, the creature is Restrained as its flesh begins to harden.",
  "Subsequent Saves",
  "At the end of each of its turns, a Restrained creature affected by the bomb makes another Constitution saving throw. Track successes and failures independently; they do not need to be consecutive.",
  "3 Successes",
  "The effect ends on that creature.",
  "3 Failures",
  "The creature is turned to stone and gains the Petrified condition.",
].join("\n\n");

export function applyCampaignItemRuleOverrides(input = {}) {
  const out = clone(input) || {};
  const payloadMode = Boolean(out.payload && typeof out.payload === "object" && !Array.isArray(out.payload));
  const payload = payloadMode ? { ...out.payload } : out;
  const name = String(payload.item_name || payload.name || out.item_name || out.name || "").trim();
  const match = name.match(RESISTANCE_RING_RE);

  if (!match && name.toLowerCase() === "bomb of petrification") {
    const alchemy = payload.alchemy && typeof payload.alchemy === "object" ? { ...payload.alchemy } : {};
    Object.assign(payload, {
      item_description: PETRIFICATION_BOMB_EFFECT,
      rulesShort: PETRIFICATION_BOMB_EFFECT,
      flavor: "Iron sphere with a stub wick; even cold, it smells of charcoal and saltpeter.",
      duration: "Until resolved",
      duration_text: "Until resolved",
      effect: PETRIFICATION_BOMB_EFFECT,
      effect_text: PETRIFICATION_BOMB_EFFECT,
      alchemy: {
        ...alchemy,
        effect: PETRIFICATION_BOMB_EFFECT,
        duration: "Until resolved",
        rider_duration: "Until resolved",
        rider_save: "Constitution",
        rider_repeat_save: "End of each turn; 3 successes end the effect, 3 failures cause Petrified",
        condition_riders: ["Restrained", "Petrified"],
        save_progression: {
          initialFailureCondition: "Restrained",
          repeatTiming: "End of each turn",
          successesToEnd: 3,
          failuresToPetrify: 3,
          terminalFailureCondition: "Petrified",
          consecutiveRequired: false,
        },
      },
    });
    if (payloadMode) out.payload = payload;
    return out;
  }

  if (!match) return out;

  const elementLabel = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  const element = elementLabel.toLowerCase();
  const description = ringDescription(elementLabel);

  Object.assign(payload, {
    item_name: name,
    name: payload.name || name,
    item_type: "Wondrous Item",
    uiType: "Wondrous Item",
    uiSubKind: "Ring",
    rarity: "uncommon",
    item_rarity: "uncommon",
    price_gp: 2000,
    resist: [element],
    damageReductionByType: { [element]: 10 },
    damageReductionBeforeResistance: false,
    campaignRuleVariant: "DNDNext elemental resistance ring",
    item_description: description,
    rulesShort: description,
  });

  if (!payloadMode) return payload;

  out.payload = payload;
  out.item_name = name;
  out.item_type = "Wondrous Item";
  out.item_rarity = "uncommon";
  out.price_gp = 2000;
  return out;
}
