from pathlib import Path

path = Path("pages/items.js")
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    '  const affinityTags = Array.from(new Set([...(effect.affinity_tags || []), effect.element].filter(Boolean)));',
    '  const affinityTags = Array.from(new Set([...(effect.affinity_tags || []), effect.element].filter(Boolean).map(smithingElementTagKey)));',
    'normalize and deduplicate affinity tags',
)

replace_once(
    '      <div className="craft-alchemy-card-description">{profile.flavor || material.raw?.payload?.flavor || material.raw?.card_payload?.flavor || material.description || material.raw?.item_description || `Prepared ${profile.materialClass || material.category || "crafting"} stock.`}</div>',
    '      <div className="craft-alchemy-card-description">{profile.flavor || material.raw?.payload?.flavor || material.raw?.card_payload?.flavor || material.description || material.notes || material.raw?.item_description || `Prepared ${profile.materialClass || material.category || "crafting"} stock.`}</div>',
    'use material notes as flavor fallback',
)

flavor_replacements = {
    '["Iron Ore", "Ore / Metal", "Mundane", "standard smithing stock"]': '["Iron Ore", "Ore / Metal", "Mundane", "Rust-red ore shot through with dark metallic veins and coarse stone."]',
    '["Steel Ingot", "Ore / Metal", "Mundane", "standard forged metal stock"]': '["Steel Ingot", "Ore / Metal", "Mundane", "A clean gray ingot with blue temper lines and a clear bell-like ring."]',
    '["Silver Ingot", "Ore / Metal", "Uncommon", "silvered weapon and ritual metal stock"]': '["Silver Ingot", "Ore / Metal", "Uncommon", "A bright white ingot that stays cool beside the forge and tarnishes only at the edges."]',
    '["Mithral Ingot", "Ore / Metal", "Rare", "lightweight armor and fine weapon stock"]': '["Mithral Ingot", "Ore / Metal", "Rare", "A moon-bright ingot that feels almost weightless, yet rings like tempered steel."]',
    '["Adamantine Bar", "Ore / Metal", "Very Rare", "hard metal stock for adamantine weapons and armor"]': '["Adamantine Bar", "Ore / Metal", "Very Rare", "A dense charcoal-black bar that shrugs off scratches, sparks, and lesser tools."]',
    '["Ruidium Shard", "Ore / Metal", "Very Rare", "volatile red crystal metal stock"]': '["Ruidium Shard", "Ore / Metal", "Very Rare", "A translucent crimson crystal-metal shard that pulses with unsettling psychic heat."]',
    '["Generic Monster Part", "Monster Part", "Common", "basic tooth, claw, hide, bone, or ichor catalyst"]': '["Generic Monster Part", "Monster Part", "Common", "A sorted bundle of horn, bone, tooth, and hide harvested from common beasts."]',
    '["Dire Beast Hide", "Monster Part", "Uncommon", "rugged monster hide catalyst"]': '["Dire Beast Hide", "Monster Part", "Uncommon", "Thick scarred hide with coarse fur still caught along its armored grain."]',
    '["Troll Heart", "Monster Part", "Rare", "regenerative monster catalyst"]': '["Troll Heart", "Monster Part", "Rare", "A preserved green-black heart whose torn fibers slowly pull themselves together."]',
    '["Arcane Catalyst", "Catalyst", "Common", "basic magical stabilizer"]': '["Arcane Catalyst", "Catalyst", "Common", "A thumb-sized ceramic focus etched with simple stabilizing runes."]',
    '["Sigil Dust", "Catalyst", "Uncommon", "rune and formula stabilizer"]': '["Sigil Dust", "Catalyst", "Uncommon", "Fine silver-violet powder that settles into rune-shaped lines when scattered."]',
    '["Refined Mana Crystal", "Catalyst", "Rare", "charged enchantment focus"]': '["Refined Mana Crystal", "Catalyst", "Rare", "A clear blue crystal cut to hold a steady reservoir of arcane charge."]',
    '["Planar Core", "Catalyst", "Very Rare", "planar essence stabilizer"]': '["Planar Core", "Catalyst", "Very Rare", "A dense faceted core whose inner colors shift toward distant planes."]',
    '["Elder Star Shard", "Catalyst", "Legendary", "legendary enchantment catalyst"]': '["Elder Star Shard", "Catalyst", "Legendary", "A black stellar fragment dusted with lights that move like an ancient sky."]',
    '["Alchemical Salt", "Reagent", "Common", "basic reagent and preservative"]': '["Alchemical Salt", "Reagent", "Common", "Dry silver-white grains that crackle softly when exposed to active magic."]',
    '["Clearwater Reagent", "Reagent", "Uncommon", "clean reagent base"]': '["Clearwater Reagent", "Reagent", "Uncommon", "A perfectly clear liquid that leaves glass spotless and carries no scent."]',
    '["Diamond Dew", "Reagent", "Rare", "rare reagent for high-grade formulas"]': '["Diamond Dew", "Reagent", "Rare", "Heavy crystal-clear droplets that bead like tiny cut gems instead of flowing."]',
    '["Aether Oil", "Reagent", "Very Rare", "ethereal reagent oil"]': '["Aether Oil", "Reagent", "Very Rare", "Pale iridescent oil that briefly slips out of phase when the vial is shaken."]',
    '["Primal Quintessence", "Reagent", "Legendary", "legendary universal reagent"]': '["Primal Quintessence", "Reagent", "Legendary", "A luminous fluid whose color changes with every nearby element and spell."]',
}
for old, new in flavor_replacements.items():
    replace_once(old, new, f"flavor row {old}")

required = [
    '.map(smithingElementTagKey)',
    'material.notes || material.raw?.item_description',
    'Rust-red ore shot through with dark metallic veins',
    'A luminous fluid whose color changes with every nearby element and spell.',
]
for token in required:
    if token not in text:
        raise RuntimeError(f"verification token missing: {token}")

path.write_text(text)
print("smithing card polish v4 follow-up applied", len(text), text.count("\\n") + 1)
