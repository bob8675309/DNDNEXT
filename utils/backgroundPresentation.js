import { formatPlayerFacingText } from "./playerFacingText.js";

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

function thematicFallback(name = "") {
  const lower = String(name).toLowerCase();
  if (/spy|agent|operative|informant|faction/.test(lower)) return `Your years as ${name} taught you to trade in trust, secrets, and carefully managed identities. Decide who recruited you, which loyalty matters most, and what information could still place you in danger.`;
  if (/knight|soldier|marine|mercenary|veteran|legion|military/.test(lower)) return `Life as ${name} placed you inside a disciplined martial tradition with its own duties, comrades, and scars. Decide which campaign defined you and whether your former allegiance is a source of pride, regret, or unfinished business.`;
  if (/scholar|student|research|archae|anthrop|histor|lore|sage|academic/.test(lower)) return `As ${name}, you pursued knowledge through study, travel, or firsthand investigation. Your work connected you to mentors, institutions, and a discovery whose importance may only now be becoming clear.`;
  if (/guild|artisan|craft|smith|maker|engineer|trader|merchant/.test(lower)) return `Your life as ${name} was built through practiced skill, professional relationships, and a reputation earned one job at a time. Former patrons, rivals, debts, and unfinished work offer natural ties to the wider world.`;
  if (/wander|traveler|far traveler|refugee|outlander|nomad|drifter|planar|astral/.test(lower)) return `As ${name}, you learned to live between places and cultures. The journey changed how you see ordinary life, while the homeland, route, or people left behind remain a powerful part of your story.`;
  if (/priest|faith|temple|devotee|cult|initiate|chosen|religious/.test(lower)) return `Your time as ${name} bound you to a faith, mystery, or sacred community. Decide what revelation or duty shaped you, who shares your beliefs, and what could cause your devotion to deepen—or fracture.`;
  if (/criminal|bounty|smuggler|pirate|urchin|outlaw|gambler|grifter/.test(lower)) return `Surviving as ${name} required nerve, useful contacts, and a flexible relationship with authority. Someone from that life may still consider you a partner, a debtor, a rival, or a loose end.`;
  if (/entertain|artist|perform|gladiator|athlete|celebrity|courtier/.test(lower)) return `As ${name}, you learned how reputation and public attention can change a person's fortunes. Your admirers, competitors, and most memorable performance still shape how others receive you.`;
  return `Your life as ${name} shaped the habits, relationships, and hard-earned experience you carried into adventuring. Decide who taught you, what ended that chapter of your life, and which person, place, or obligation still connects you to it.`;
}

export function backgroundStoryDescription(background = {}) {
  const key = slug(background.name || background.key);
  const imported = importedNarrative(background.description);
  if (imported) return imported;
  return BACKGROUND_LORE[key] || thematicFallback(background.name || "this background");
}

export { importedNarrative };
