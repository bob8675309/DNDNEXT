import { normalizeSpeciesArtworkKey } from "./speciesArtwork.js";

const SPECIES_FLAVOR_LORE = {
  aarakocra: "Born to open skies and high places, aarakocra often view the ground-bound world with restless curiosity. Many become scouts, messengers, or wanderers who treasure freedom above comfort.",
  aasimar: "Aasimar carry a trace of the Upper Planes within them, often revealed through luminous eyes, an uncanny presence, or moments of celestial transformation. That inheritance can feel like a calling, a burden, or both.",
  aetherborn: "Aetherborn are brief, brilliant lives given form from magical aether. Knowing that their time may be short, many pursue experience, purpose, and sensation with an intensity that longer-lived peoples rarely match.",
  "astral-elf": "Astral elves are shaped by long ages beneath the silver light of the Astral Sea. Their communities preserve ancient traditions, while individual wanderers often leave timeless realms in search of change, urgency, and wonder.",
  autognome: "Autognomes are ingenious mechanical folk built with individual quirks, purposes, and personalities. Whether following their original design or choosing a new path, they tend to meet the wider world with practical curiosity.",
  aven: "Aven are lean, winged humanoids with avian heads and strong traditions of aerial movement. Their keen eyes and command of open space make them natural scouts, travelers, and skirmishers.",
  dragonborn: "Dragonborn inherit the presence and elemental power of dragons without being bound to draconic destiny. Scales, breath, and resistance reflect a chosen draconic ancestry, while every dragonborn defines that legacy for themself.",
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
  faerie: "Faeries are Small, graceful fey folk with fine humanoid features and gossamer wings. Their appearance can be delicate or strange, but their magic and personalities are every bit as vivid as those of taller peoples.",
  fairy: "Fairies are Small, graceful fey folk with fine humanoid features and gossamer wings. Their appearance can be delicate or strange, but their magic and personalities are every bit as vivid as those of taller peoples.",
  gnoll: "Gnolls are hyena-headed humanoids with keen senses, powerful builds, and strong communal instincts. Those who choose an adventurer's life may carry the customs of a pack, clan, or adopted community while deciding what their people's future should become.",
  "gnome-deep": "Deep gnomes, also called svirfneblin, are Small subterranean folk shaped by generations in the Underdark. Their muted coloring, caution, and affinity for concealment help them endure in lightless places filled with far larger dangers.",
  grimlock: "Grimlocks are eyeless subterranean humanoids who perceive their surroundings through extraordinary hearing and smell. Their pale, rugged bodies and life in deep caverns can seem unsettling to surface folk, but their lack of sight is no impediment to awareness.",
  grung: "Grung are Small, brightly colored frog folk adapted to humid forests and wetlands. Adhesive hands and feet make them gifted climbers, while the natural secretions on their skin demand care around companions who are not immune to them.",
  kithkin: "Kithkin are short, sturdy folk whose broad faces and large expressive eyes give them a distinctive appearance. Many share an empathic awareness of nearby kithkin, encouraging unusually close communal bonds.",
  "kuo-toa": "Kuo-toa are fishlike amphibious folk whose communities thrive in lightless waters, sea caves, and drowned ruins. Their unusual senses and intense traditions have allowed them to survive where surface peoples rarely venture.",
  "sea-elf": "Sea elves are aquatic elves shaped by life beneath the waves. Gills, webbed extremities, subtle fins, and an effortless swimming gait distinguish them from their land-dwelling kin, though they remain fully bipedal.",
  "shadar-kai": "Shadar-kai are elves transformed by the Shadowfell and bound to its bleak influence. Their pale features, shadowed dress, and grave bearing reflect that realm, while their magic lets them step briefly through darkness.",
  skeleton: "Skeleton adventurers are intelligent undead whose spirits or animating will remain anchored to coherent bones. They do not breathe or age as living folk do, but they still carry memories, purpose, language, and the ability to choose their own path.",
  troglodyte: "Troglodytes are sturdy subterranean reptilian humanoids with chameleon-like hides, natural armor, and powerful defensive musk. Their hunched posture, clawed limbs, and heavy tail suit life in cramped caverns without preventing them from using tools or traveling among other peoples.",
  "yuan-ti-pureblood": "Yuan-ti purebloods appear predominantly human, but serpent eyes, fine patches of scales, forked tongues, or subtle fangs reveal their transformed ancestry. Their restrained appearance distinguishes them from yuan-ti whose bodies display far more pronounced snake traits.",
  zombie: "Zombie adventurers are intelligent undead sustained by stubborn animating force rather than ordinary life. Their damaged flesh and deathless endurance are unmistakable, yet they retain language, equipment, judgment, and personal purpose.",

  // Source-family children. These paraphrase identity/mechanics from the reviewed
  // 5etools race/fluff data while intentionally omitting adventure-, faction-, and plot-specific copy.
  "air-genasi": "Air genasi bear visible or subtle signs of elemental air: wind-tossed hair, cool skin, or a voice like a passing breeze. They can hold their breath indefinitely, resist lightning, and call on magic that moves through the air.",
  "earth-genasi": "Earth genasi reflect the steadiness of stone and soil, sometimes through mineral-toned skin or crystal-like features. They move confidently across difficult ground and draw on protective, earthbound magic.",
  "fire-genasi": "Fire genasi carry elemental flame in their appearance and magic, often showing ember-bright eyes, warm skin, or hair that seems to flicker. Their lineage resists fire and answers naturally to flame-shaping spells.",
  "water-genasi": "Water genasi show an affinity for rivers, rain, and the sea through aquatic coloring or fluid features. They breathe both air and water, swim naturally, resist acid, and wield water-shaped magic.",

  "black-dragonborn": "Black Dragonborn reflect an acid-linked draconic ancestry, commonly marked by dark scales and sharp, imposing features. Their breath and resistance both carry that corrosive elemental affinity.",
  "blue-dragonborn": "Blue Dragonborn carry a lightning-linked ancestry, often displayed through deep blue scales and pronounced horns or crests. Their breath weapon and resistance channel electrical power.",
  "brass-dragonborn": "Brass Dragonborn bear warm metallic scales and a fire-linked ancestry. Their draconic breath and resistance manifest as searing heat.",
  "bronze-dragonborn": "Bronze Dragonborn carry burnished metallic scales and a lightning-linked ancestry. Their breath and resistance express the crackling force of storms.",
  "copper-dragonborn": "Copper Dragonborn show reddish-brown metallic scales and an acid-linked ancestry. Their breath weapon and resistance reflect that corrosive draconic heritage.",
  "gold-dragonborn": "Gold Dragonborn bear bright metallic scales and a fire-linked ancestry. Their breath weapon and resistance express the intense heat associated with golden dragons.",
  "green-dragonborn": "Green Dragonborn carry a poison-linked ancestry, often shown through green scales and sweeping draconic features. Their breath and resistance are shaped by poisonous energy.",
  "red-dragonborn": "Red Dragonborn bear vivid red scales and a fire-linked ancestry. Their breath weapon and resistance channel the raw heat of draconic flame.",
  "silver-dragonborn": "Silver Dragonborn carry pale metallic scales and a cold-linked ancestry. Their breath and resistance manifest as numbing, wintry power.",
  "white-dragonborn": "White Dragonborn reflect a cold-linked ancestry through pale scales and frostlike coloring. Their breath weapon and resistance channel bitter cold.",
  "amethyst-gem-dragonborn": "Amethyst Gem Dragonborn carry crystalline violet features and a force-linked gem ancestry. Their gem heritage also brings the psionic gifts and temporary flight associated with Gem Dragonborn.",
  "crystal-gem-dragonborn": "Crystal Gem Dragonborn show luminous, translucent features and a radiant-linked gem ancestry. Their heritage combines radiant power with the psionic gifts of Gem Dragonborn.",
  "emerald-gem-dragonborn": "Emerald Gem Dragonborn bear green crystalline features and a psychic-linked gem ancestry. Their heritage combines psychic power with the psionic gifts of Gem Dragonborn.",
  "sapphire-gem-dragonborn": "Sapphire Gem Dragonborn display deep blue crystalline features and a thunder-linked gem ancestry. Their heritage combines thunderous power with the psionic gifts of Gem Dragonborn.",
  "topaz-gem-dragonborn": "Topaz Gem Dragonborn carry amber-gold crystalline features and a necrotic-linked gem ancestry. Their heritage combines necrotic power with the psionic gifts of Gem Dragonborn.",

  "hawk-headed-aven": "Hawk-Headed Aven have the heads of hawks or similar birds of prey and compact wings suited to quick, controlled flight. Keen sight and precision at range distinguish this subrace.",
  "ibis-headed-aven": "Ibis-Headed Aven have long-necked ibis features and broad, angular wings suited to graceful soaring. Their lineage emphasizes disciplined thought and an unusual aptitude for Intelligence-based tasks.",

  drow: "Drow are an elven lineage adapted to darkness, with exceptional Darkvision and innate magic that develops from dancing lights into stronger shadow-and-faerie effects. Their appearance often includes pale hair and dark or cool-toned skin.",
  "high-elf": "High Elves are an elven lineage steeped in arcane tradition. Their innate magic begins with a flexible cantrip and develops into utility and teleportation spells as they gain experience.",
  "wood-elf": "Wood Elves are swift-footed elves with a strong affinity for wilderness magic. Their lineage combines increased speed with nature-oriented innate spells.",
  "forest-gnome": "Forest Gnomes express their magic through subtle illusion and an affinity for small animals. Their lineage favors quiet cleverness, woodland awareness, and unobtrusive magic.",
  "rock-gnome": "Rock Gnomes turn curiosity toward practical invention. Their lineage combines small-scale magic with an instinct for mending, prestidigitation, and clever mechanical devices.",

  "beasthide-shifter": "Beasthide Shifters manifest a thickened, durable bestial form when they shift. Their transformation emphasizes toughness, temporary vitality, and added protection.",
  "longtooth-shifter": "Longtooth Shifters develop pronounced fangs when transformed. Their shifting form is built for close combat and gives them a natural biting attack.",
  "swiftstride-shifter": "Swiftstride Shifters become leaner and faster when transformed. Their shifting form emphasizes movement, quick repositioning, and speed under pressure.",
  "wildhunt-shifter": "Wildhunt Shifters manifest heightened instincts and awareness. Their shifting form sharpens Wisdom-based perception and makes it harder for nearby enemies to gain an edge against them.",

  "lorwyn-fairy": "Lorwyn Fairies are bright-winged fey whose lineage emphasizes their natural flight and innate faerie magic without the deeper darkness adaptation of their Shadowmoor kin.",
  "shadowmoor-fairy": "Shadowmoor Fairies are dusk-adapted fey whose lineage adds powerful Darkvision to the shared gifts of flight and faerie magic.",
  "lorwyn-kithkin": "Lorwyn Kithkin emphasize the close communal awareness common to their people, relying on shared feeling, trust, and sturdy resolve rather than darkness-adapted senses.",
  "shadowmoor-kithkin": "Shadowmoor Kithkin retain their people's strong empathic bonds while also possessing the deep Darkvision associated with their shadowed lineage.",

  "human-innistrad": "Innistrad Humans are presented as adaptable mortals shaped by communities accustomed to persistent supernatural danger. Their source keeps human versatility at the center of the character rather than adding a supernatural lineage.",
  "human-ixalan": "Ixalan Humans represent several far-ranging human cultures with a strong tradition of exploration, navigation, and conflict across difficult frontiers. Their source retains human flexibility while offering its own cultural framing.",
  "human-kaladesh": "Kaladesh Humans come from an inventive, cosmopolitan tradition where craft, experimentation, and adaptation are ordinary parts of life. Their source presents human versatility through that creative lens.",
  "human-zendikar": "Zendikar Humans are seasoned by hazardous wilderness and long-distance travel. Their source presents human adaptability through cultures accustomed to exploration and survival in unstable terrain.",
  "dwarf-kaladesh": "Kaladesh Dwarves combine traditional dwarven endurance with a culture strongly associated with craft and ambitious construction. Their source keeps the sturdy dwarven frame while presenting its own social and technical traditions.",
  "elf-kaladesh": "Kaladesh Elves combine long-lived elven perspective with a strong concern for living systems and the places where nature meets invention. Their source presents distinct elven traditions without replacing core elven identity.",
  "elf-zendikar": "Zendikar Elves are adapted to dangerous wilderness, difficult journeys, and communities that survive through mobility and close knowledge of the land. Their source presents several distinct elven traditions within that broader heritage.",
  "orc-ixalan": "Ixalan Orcs are powerfully built, intimidating humanoids whose source emphasizes seafaring toughness and relentless endurance. Their physical resilience makes them difficult to put down even after a devastating blow.",
  "minotaur-amonkhet": "Amonkhet Minotaurs are broad, horned humanoids built for direct physical action. Their source emphasizes speed, power, and the momentum of a forceful charge without requiring any particular personal outlook.",
  "goblin-dankwood": "Dankwood Goblins are Small, quick-lived goblins with the familiar sharp senses of their people and an unusual affinity for small animals. They can communicate simple ideas to Small or smaller beasts through sounds and gestures.",
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

export function speciesCatalogSummary(species = "", maxLength = 108) {
  const lore = speciesFlavorLore(species).replace(/\s+/g, " ").trim();
  if (!lore) return "";
  const firstSentence = lore.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || lore;
  if (firstSentence.length <= maxLength) return firstSentence;
  const clipped = firstSentence.slice(0, Math.max(24, maxLength - 1)).replace(/\s+\S*$/, "").trim();
  return `${clipped || firstSentence.slice(0, maxLength - 1).trim()}…`;
}
