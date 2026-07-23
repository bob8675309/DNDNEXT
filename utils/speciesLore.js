import { normalizeSpeciesArtworkKey } from "./speciesArtwork.js";

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

export const SPECIES_LORE_OVERRIDES = Object.freeze({
  bullywug: "Bullywugs are amphibious folk at home in wetlands, flooded ruins, and reed-choked waterways. Their powerful legs, swimming ability, and patient stillness make them capable scouts and survivors far beyond the marsh.",
  "custom-lineage": "Custom Lineage represents a person whose ancestry, transformation, or unusual origin is defined by the player rather than one fixed people. Their size and appearance can vary widely, and the traits chosen for them explain how that singular heritage shaped their life.",
  faerie: "Faeries are Small, graceful fey folk who typically stand only two to three feet tall. Their pointed ears, fine humanlike or elven features, and four gossamer wings give them a delicate appearance, though their courage and personalities are every bit as large as those of taller peoples.",
  fairy: "Fairies are Small, graceful fey folk who typically stand only two to three feet tall. Their pointed ears, fine humanlike or elven features, and four gossamer wings give them a delicate appearance, though their courage and personalities are every bit as large as those of taller peoples.",
  gnoll: "Gnolls are hyena-headed humanoids with keen senses, powerful builds, and strong communal instincts. Those who choose an adventurer's life may carry the customs of a pack, clan, or adopted community while deciding what their people's future should become.",
  "gnome-deep": "Deep gnomes, also called svirfneblin, are Small subterranean folk shaped by generations in the Underdark. Their muted coloring, caution, and affinity for concealment help them endure in lightless places filled with far larger dangers.",
  grimlock: "Grimlocks are eyeless subterranean humanoids who perceive their surroundings through extraordinary hearing and smell. Their pale, rugged bodies and life in deep caverns can seem unsettling to surface folk, but their lack of sight is no impediment to awareness.",
  grung: "Grung are Small, brightly colored frog folk adapted to humid forests and wetlands. Adhesive hands and feet make them gifted climbers, while the natural secretions on their skin demand care around companions who are not immune to them.",
  kithkin: "Kithkin are short folk with stout legs, long arms, and sturdy torsos. Their broad faces, round ears, and large expressive eyes give them a vaguely ursine appearance. Most kithkin are linked by an empathic web that lets them sense the feelings of nearby kithkin, and many trust one another implicitly because of that connection. Some temporarily or permanently leave the web after trauma or for other personal reasons, but kithkin still typically consider betrayal of their own a heinous crime.",
  "kuo-toa": "Kuo-toa are fishlike amphibious folk whose communities thrive in lightless waters, sea caves, and drowned ruins. Their unusual senses and intense traditions have allowed them to survive where surface peoples rarely venture.",
  "sea-elf": "Sea elves are aquatic elves shaped by life beneath the waves. Gills, webbed extremities, subtle fins, and an effortless swimming gait distinguish them from their land-dwelling kin, though they remain fully bipedal.",
  "shadar-kai": "Shadar-kai are elves transformed by the Shadowfell and bound to the service or influence of the Raven Queen. Their pale features, shadowed dress, and grave bearing reflect that bleak realm, while their magic lets them step briefly through darkness.",
  skeleton: "Skeleton adventurers are intelligent undead whose spirits or animating will remain anchored to coherent bones. They do not breathe or age as living folk do, but they still carry memories, purpose, language, and the ability to choose their own path.",
  troglodyte: "Troglodytes are sturdy subterranean reptilian humanoids with chameleon-like hides, natural armor, and powerful defensive musk. Their hunched posture, clawed limbs, and heavy tail suit life in cramped caverns without preventing them from using tools or traveling among other peoples.",
  "yuan-ti-pureblood": "Yuan-ti purebloods appear predominantly human, but serpent eyes, fine patches of scales, forked tongues, or subtle fangs reveal their transformed ancestry. Their restrained appearance distinguishes them from yuan-ti whose bodies display far more pronounced snake traits.",
  zombie: "Zombie adventurers are intelligent undead sustained by stubborn animating force rather than ordinary life. Their damaged flesh and deathless endurance are unmistakable, yet they retain language, equipment, judgment, and personal purpose.",
});

export function speciesFlavorLore(species = "") {
  const option = species && typeof species === "object" ? species : null;
  const name = String(option?.name || species || "This species").trim() || "This species";
  const key = normalizeSpeciesArtworkKey(name);
  const authoredOverride = SPECIES_LORE_OVERRIDES[key];
  if (authoredOverride) return authoredOverride;
  const importedLore = String(option?.lore || option?.metadata?.lore || "").trim();
  if (importedLore) return importedLore;
  return SPECIES_FLAVOR_LORE[key]
    || `${name} adventurers bring the customs, stories, and distinctive gifts of their people into the wider world. Consider what their home taught them—and what could persuade them to leave it behind.`;
}
