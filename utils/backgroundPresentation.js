import { formatPlayerFacingText } from "./playerFacingText.js";
import { BACKGROUND_LORE_CATALOG } from "./backgroundLoreCatalog.js";
import { genericBackgroundLore, neutralizeBackgroundLore } from "./backgroundNeutralization.js";

const MECHANICAL_HEADINGS = /^(?:ability scores?|feat|skill proficiencies?|tool proficiencies?|languages?|equipment)\s*:?\.?$/i;
const MECHANICAL_START = /^(?:choose a or b|skill proficiencies?|tool proficiencies?|ability scores?|equipment|languages?)\s*:/i;

const BACKGROUND_LORE = Object.freeze({
  acolyte: "You spent formative years in the service of a faith, temple, or sacred order. Decide what you believed, which duties shaped you, and whether you left with a blessing, a burden, or unanswered questions.",
  artisan: "You learned a skilled trade through long practice, exacting standards, and the realities of earning a living from your hands. Your old guild, customers, rivals, or unfinished masterpiece may still pull you back.",
  charlatan: "You learned how quickly confidence can become currency. False identities, practiced stories, and a sharp eye for desire kept you fed—but someone may still remember the person you pretended to be.",
  criminal: "You survived outside the law and learned the customs, debts, and quiet signals of the underworld. Decide what crime first drew you in, who still expects your loyalty, and what might finally make you walk away.",
  entertainer: "You lived by holding an audience's attention, whether through music, theater, dance, spectacle, or daring performance. Applause opened doors, but fame also created rivals, admirers, and expectations.",
  farmer: "Your life was measured in seasons, hard work, and responsibility for land, animals, or family. You understand that survival is built through patience—and you know exactly what home is worth protecting.",
  guard: "You stood watch over a person, place, or community and learned to notice danger before others did. The post you held, the people beside you, and the threat that got through still shape your instincts.",
  guide: "You made dangerous journeys possible for others. Trails, weather, landmarks, and local customs became a second language, and you may still carry responsibility for someone you once led into the unknown.",
  hermit: "You withdrew from ordinary society for contemplation, study, healing, exile, or revelation. Solitude changed what you value, and returning to the world may test the truth you thought you found.",
  merchant: "You learned that every road, harbor, and market has its own rules. Bargains built your reputation, but old partners, unpaid debts, rare opportunities, and hard-won contacts travel with you.",
  noble: "You were raised among privilege, obligation, reputation, and the long memory of a recognized house. Your name can open doors, but it also ties you to family ambitions and inherited enemies.",
  sage: "You devoted yourself to questions most people never think to ask. Libraries, mentors, fieldwork, or forbidden records taught you how knowledge is preserved—and how dangerous the wrong discovery can become.",
  sailor: "You learned to trust a crew, read changing weather, and work while the world moved beneath your feet. A former ship, captain, port, or voyage may remain the strongest claim on your loyalty.",
  scribe: "You preserved words that others could not afford to lose. Copying, translating, and organizing records taught you patience and precision, and perhaps placed one secret in your hands that was never meant to survive.",
  soldier: "Military service taught you discipline, endurance, and reliance on the people beside you. Your old unit, commander, campaign, victory, or defeat remains part of who you are long after the fighting ended.",
  wayfarer: "Roads, crowds, and uncertain shelter taught you to adapt quickly and travel lightly. You know how to disappear into a settlement, find what you need, and recognize others who live without a secure place in the world.",
});

function slug(value = "") {
  return String(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function catalogLore(background = {}) {
  const nameKey = slug(background.name || background.key);
  const source = String(background.source || "").toUpperCase();
  const exact = BACKGROUND_LORE_CATALOG[`${nameKey}|${source}`];
  if (exact?.lore) return exact.lore;
  return Object.entries(BACKGROUND_LORE_CATALOG)
    .find(([key]) => key.startsWith(`${nameKey}|`))?.[1]?.lore || "";
}

function importedNarrative(description = "") {
  const blocks = formatPlayerFacingText(description).split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const candidates = blocks.filter((block) => {
    if (MECHANICAL_HEADINGS.test(block) || MECHANICAL_START.test(block)) return false;
    if (/^(?:strength|dexterity|constitution|intelligence|wisdom|charisma)(?:\s*,|\s+and|$)/i.test(block)) return false;
    if (/^(?:choose one|choose two|none listed|\d+\s*gp)/i.test(block)) return false;
    const words = block.split(/\s+/).length;
    return words >= 18 && /[.!?]/.test(block);
  });
  return candidates.slice(0, 2).join("\n\n");
}

export function backgroundStoryDescription(background = {}) {
  const key = slug(background.name || background.key);
  const storedLore = formatPlayerFacingText(background.lore || background.metadata?.lore, "");
  if (storedLore) return neutralizeBackgroundLore(background.name || background.key, storedLore);
  const imported = importedNarrative(background.description);
  if (imported) return neutralizeBackgroundLore(background.name || background.key, imported);
  const sourceLore = catalogLore(background);
  if (sourceLore) return neutralizeBackgroundLore(background.name || background.key, sourceLore);
  return BACKGROUND_LORE[key] || genericBackgroundLore(background.name || "this background");
}

export { importedNarrative };
