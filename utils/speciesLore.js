import { normalizeSpeciesArtworkKey } from "./speciesArtwork";

const SPECIES_FLAVOR_LORE = {
  aarakocra: "Born to open skies and high places, aarakocra often view the ground-bound world with restless curiosity. Many become scouts, messengers, or wanderers who treasure freedom above comfort.",
  aasimar: "Aasimar carry a trace of the Upper Planes within them, often revealed through luminous eyes, an uncanny presence, or moments of celestial transformation. That inheritance can feel like a calling, a burden, or both.",
  aetherborn: "Aetherborn are brief, brilliant lives given form from magical aether. Knowing that their time may be short, many pursue experience, purpose, and sensation with an intensity that longer-lived peoples rarely match.",
  "astral-elf": "Astral elves are shaped by long ages beneath the silver light of the Astral Sea. Their communities preserve ancient traditions, while individual wanderers often leave timeless realms in search of change, urgency, and wonder.",
  autognome: "Autognomes are ingenious mechanical folk built with individual quirks, purposes, and personalities. Whether following their original design or choosing a new path, they tend to meet the wider world with practical curiosity.",
  aven: "Aven are winged folk whose cultures often prize keen observation, decisive action, and strong communal bonds. Their settlements may rise above crowded cities or stand watch over broad, windswept frontiers.",
  dragonborn: "Dragonborn inherit the presence and elemental power of dragons without being bound to draconic destiny. Honor, clan, ambition, and self-mastery shape many dragonborn lives, though each decides what those ideals mean.",
  dwarf: "Dwarven communities are renowned for enduring bonds, careful craft, and histories measured across generations. A dwarf adventurer may carry a clan's hopes, an old oath, or simply the determination to build a legacy of their own.",
  elf: "Elves experience the world through long lives, deep memory, and traditions entwined with magic and nature. Even a young elf may carry centuries of culture while still searching for the people and purpose that feel like home.",
  gnome: "Gnomes are often driven by invention, story, magic, or an irrepressible need to understand how things work. Their small communities can be lively places where curiosity is treated as both a virtue and a survival skill.",
  goliath: "Goliaths descend from giant-touched peoples who learned to thrive where strength alone was never enough. Many value contribution, fair challenge, and the quiet confidence earned by protecting those who share the journey.",
  halfling: "Halflings often build their lives around comfort, community, and the courage to protect both. Those who take to the road tend to carry home with them in habits, stories, and an unexpected steadiness when danger arrives.",
  human: "Humans are found in nearly every land, building cultures as varied as the worlds they inhabit. Their short generations and restless adaptability often push them to create, explore, and change the course of history quickly.",
  orc: "Orcs are a passionate and resilient people whose strength is matched by fierce loyalty and an enduring will to survive. Their heroes are often remembered for decisive deeds, protected communities, and lives lived without hesitation.",
  tiefling: "Tieflings bear a supernatural legacy that may appear in horns, tails, unusual eyes, or stranger signs. Others may judge that inheritance at a glance, but every tiefling chooses whether it becomes identity, obstacle, weapon, or footnote.",
};

export function speciesFlavorLore(species = "") {
  const option = species && typeof species === "object" ? species : null;
  const name = String(option?.name || species || "This species").trim() || "This species";
  const importedLore = String(option?.lore || option?.metadata?.lore || "").trim();
  if (importedLore) return importedLore;
  return SPECIES_FLAVOR_LORE[normalizeSpeciesArtworkKey(name)]
    || `${name} adventurers bring the customs, stories, and distinctive gifts of their people into the wider world. Consider what their home taught them—and what could persuade them to leave it behind.`;
}
