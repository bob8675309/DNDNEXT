import { ABILITY_LABELS } from "./characterCreation";

function text(value) { return String(value ?? "").trim(); }
function lower(value) { return text(value).toLowerCase(); }
function choice(values = []) { return values[Math.floor(Math.random() * values.length)] || ""; }
function unique(values = []) { return [...new Set(values.filter(Boolean))]; }

const LOCATION_THEMES = [
  { match: /gray hall/i, tags: ["dwarf", "smith", "artisan", "soldier", "fighter", "paladin", "guard", "noble"], tone: "fortified mountain capital", work: ["guild work", "defense contracts", "stone halls", "old family obligations"] },
  { match: /xul/i, tags: ["monster", "warlock", "rogue", "bard", "criminal", "merchant", "occult", "entertainer"], tone: "dangerous monster city", work: ["arena business", "strange clientele", "underworld contacts", "unusual bargains"] },
  { match: /fort tiber/i, tags: ["soldier", "fighter", "ranger", "paladin", "marine", "guard", "mercenary"], tone: "hard-pressed frontier fort", work: ["patrol duty", "supply work", "scouting", "frontier defense"] },
  { match: /mages spire/i, tags: ["wizard", "sorcerer", "warlock", "sage", "student", "scholar", "arcana", "scribe"], tone: "arcane center", work: ["research", "spellwork", "archival work", "dangerous magical errands"] },
  { match: /sacred tree/i, tags: ["druid", "ranger", "hermit", "fey", "nature", "survival", "herbal"], tone: "sacred natural refuge", work: ["caretaking", "foraging", "guiding travelers", "watching old paths"] },
  { match: /gleenwood/i, tags: ["druid", "ranger", "outlander", "hunter", "wood", "nature", "survival"], tone: "woodland settlement", work: ["woodland trade", "tracking", "local protection", "harvesting"] },
  { match: /storm peak/i, tags: ["goliath", "giant", "ranger", "barbarian", "climber", "outlander"], tone: "remote highland stronghold", work: ["mountain travel", "hunting", "weather watching", "guarding difficult passes"] },
  { match: /battlefield|front lines/i, tags: ["soldier", "fighter", "paladin", "ranger", "mercenary", "marine"], tone: "active war front", work: ["field duty", "courier work", "scouting", "keeping people alive between battles"] },
  { match: /dark shrine/i, tags: ["cleric", "warlock", "occult", "haunted", "religion", "spirit"], tone: "ominous religious site", work: ["watching pilgrims", "studying forbidden rites", "warding the grounds", "dealing with unsettling visitors"] },
  { match: /aboleth/i, tags: ["wizard", "warlock", "scholar", "investigator", "sage", "arcana", "history"], tone: "dangerous ancient site", work: ["research", "guard duty", "recovering relics", "tracking disturbing signs"] },
  { match: /ruins/i, tags: ["archaeologist", "ruined", "investigator", "rogue", "ranger", "history", "survival"], tone: "scarred ruins", work: ["salvage", "surveying", "watch duty", "helping survivors and scavengers"] },
  { match: /lake/i, tags: ["sailor", "fisher", "ranger", "druid", "marine", "water"], tone: "troubled lakeside region", work: ["fishing", "boat work", "shore patrol", "guiding travelers"] },
  { match: /mercia/i, tags: ["merchant", "noble", "soldier", "artisan", "criminal", "urban", "guard"], tone: "war-scarred realm", work: ["rebuilding", "trade", "watch work", "helping displaced families"] },
  { match: /doma/i, tags: ["merchant", "artisan", "bard", "noble", "urban", "scholar"], tone: "established settlement", work: ["local trade", "civic work", "craft business", "serving travelers"] },
];

function profileTokens({ species, background, classRow, skills = [], professions = [] } = {}) {
  return unique([
    species?.name, background?.name, classRow?.class_name,
    ...skills,
    ...professions.flatMap((entry) => [entry?.key, entry?.label, entry?.tool]),
  ]).map(lower).join(" ");
}

function locationScore(location, tokens) {
  const name = text(location?.name);
  const theme = LOCATION_THEMES.find((entry) => entry.match.test(name));
  if (!theme) return 1;
  return 2 + theme.tags.reduce((score, tag) => score + (tokens.includes(tag) ? 3 : 0), 0);
}

function chooseLocation(locations, tokens) {
  const candidates = (locations || []).filter((location) => location?.id != null && text(location?.name));
  if (!candidates.length) return null;
  const ranked = candidates.map((location) => ({ location, score: locationScore(location, tokens) })).sort((a, b) => b.score - a.score);
  const bestScore = ranked[0]?.score || 1;
  const best = ranked.filter((entry) => entry.score >= Math.max(2, bestScore - 1)).slice(0, 5);
  return choice(best.length ? best : ranked)?.location || candidates[0];
}

function themeFor(location) {
  return LOCATION_THEMES.find((entry) => entry.match.test(text(location?.name))) || { tone: "settlement", work: ["local work", "helping travelers", "watching neighborhood affairs"] };
}

function classRole(classRow) {
  const value = lower(classRow?.class_name);
  if (!value || value === "no adventuring class") return "local specialist";
  const roles = {
    barbarian: "hard-bitten enforcer", bard: "performer and information broker", cleric: "community spiritual guide", druid: "keeper of wild places",
    fighter: "trained guard or veteran", monk: "disciplined wanderer", paladin: "sworn protector", ranger: "scout and pathfinder",
    rogue: "discreet fixer", sorcerer: "innate magical talent", warlock: "occult problem-solver", wizard: "learned arcane specialist",
  };
  return roles[value] || `${text(classRow?.class_name)} specialist`;
}

function appearanceFor(speciesName, classRow) {
  const species = text(speciesName) || "person";
  const className = lower(classRow?.class_name);
  const gear = className.includes("wizard") ? "ink-stained cuffs and carefully protected notes" : className.includes("fighter") || className.includes("paladin") ? "well-maintained travel gear marked by hard use" : className.includes("ranger") || className.includes("druid") ? "weathered field gear and practical layers" : "practical clothing shaped by daily work";
  return `${species} with ${gear}. ${choice(["Their posture is alert without being theatrical.", "They carry themself like someone accustomed to being interrupted by problems.", "Their equipment is useful first and decorative second."])}`;
}

export function generateNpcStory({ locations = [], species = null, background = null, classRow = null, skills = [], professions = [], level = 1 } = {}) {
  const tokens = profileTokens({ species, background, classRow, skills, professions });
  const location = chooseLocation(locations, tokens);
  const locationName = text(location?.name) || "the region";
  const theme = themeFor(location);
  const work = choice(theme.work);
  const role = classRole(classRow);
  const backgroundName = text(background?.name) || "local background";
  const speciesName = text(species?.name) || "local";
  const trainedProfession = professions.find((entry) => Number(entry?.rank || 0) > 0);
  const professionHook = trainedProfession ? ` Their ${text(trainedProfession.label || trainedProfession.key)} training gives them a practical reason to remain useful here.` : "";
  const skillHook = skills.length ? ` They are especially known for ${skills.slice(0, 2).map((skill) => text(skill).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()).join(" and ")}.` : "";

  const ideals = choice(["People survive when neighbors make themselves useful.", "Knowledge matters only when it can prevent the next disaster.", "A promise is worth more than a comfortable excuse.", "The community comes before personal glory.", "Everyone deserves a chance to rebuild after losing something important."]);
  const flaw = choice(["They take responsibility for problems that are not really theirs.", "They distrust plans made by people who will not share the risk.", "They hold grudges longer than they admit.", "They become stubborn when their competence is questioned.", "They hide uncertainty behind dry confidence."]);
  const bond = choice([`They will not abandon ${locationName} while people there still depend on them.`, `Someone in ${locationName} once saved their life, and the debt still matters.`, `Their livelihood and closest relationships are rooted in ${locationName}.`, `They are protecting a person or small group in ${locationName} from a threat most outsiders have not noticed.`]);
  const motivation = choice([`Make ${locationName} safer without becoming another local tyrant.`, `Build enough influence in ${locationName} to protect people who lack it.`, `Find the truth behind a problem quietly spreading through ${locationName}.`, `Earn a stable future in ${locationName} after an unsettled past.`, `Keep a dangerous obligation from following them into ${locationName}.`]);
  const secret = choice([`They have evidence that someone important in ${locationName} is lying about a recent event.`, `They quietly owe a favor to someone they would rather never meet again.`, `A past mistake connected to their ${backgroundName} life could damage their standing if exposed.`, `They have been keeping one suspicious discovery to themself until they know whom to trust.`]);

  return {
    locationId: location?.id != null ? String(location.id) : "",
    description: `${speciesName} ${role} based in ${locationName}. They are usually encountered around ${work} and have a reputation for being useful when ordinary solutions fail.`,
    appearance: appearanceFor(speciesName, classRow),
    backgroundNarrative: `Their ${backgroundName} past eventually brought them to ${locationName}, a ${theme.tone}. Rather than remaining a passing stranger, they found a role through ${work}.${professionHook}${skillHook} Their current life gives them ties, obligations, and local knowledge that can draw adventurers into existing problems without making them the center of the world.`,
    motivation,
    personalityTraits: choice(["Observant, practical, and slow to waste words.", "Friendly in routine matters but sharply focused when danger appears.", "Curious about strangers, especially when their stories do not quite add up.", "Calm under pressure and more comfortable helping than commanding.", "Restless when there is useful work left undone."]),
    ideals,
    bonds: bond,
    flaws: flaw,
    quirk: choice(["Keeps a small notebook of names, favors, and unfinished tasks.", "Always checks doors, windows, or exits when entering a room.", "Collects minor local tokens rather than valuable souvenirs.", "Has a habit of preparing tea, tools, or supplies before serious conversations.", "Remembers small personal details about people long after meeting them."]),
    mannerism: choice(["Pauses before answering difficult questions.", "Speaks with their hands when explaining a practical problem.", "Frequently glances toward the busiest part of the room.", "Lowers their voice when discussing anything they consider important."]),
    voice: choice(["Measured and matter-of-fact.", "Warm but concise.", "Low, dry, and slightly sardonic.", "Direct, with little patience for ceremony.", "Thoughtful, often phrasing advice as a question."]),
    secret,
    attacks: Number(level || 1) > 1 ? `Uses the normal combat options and class features of a level ${Number(level || 1)} ${text(classRow?.class_name) || "character"}; prefers practical actions that fit their role in ${locationName}.` : `Uses ordinary attacks, actions, and any level 1 ${text(classRow?.class_name) || "class"} features appropriate to the situation.`,
    equipment: choice([`Travel gear suited to ${locationName}, tools for ${work}, and a few personal keepsakes.`, `Practical local clothing, a working kit, food for a short journey, and whatever weapons or tools their training requires.`, `Well-used equipment maintained with care, plus supplies connected to ${work}.`]),
    treasure: choice(["A modest purse, a useful local contact, and one sentimental keepsake.", "Enough coin for routine expenses, a written favor, and a small item tied to their past.", "Little loose coin, but a cache of practical supplies and a debt someone locally owes them."]),
  };
}

export function generatedStoryLocationLabel(locations = [], locationId = "") {
  return text((locations || []).find((location) => String(location.id) === String(locationId))?.name);
}
