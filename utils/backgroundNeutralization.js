const LOCATION_REPLACEMENTS = Object.freeze([
  [/\bOuter City['’]s Twin Songs neighborhood\b/gi, "an outlying neighborhood"],
  [/\bTen-Towns in Icewind Dale\b/gi, "remote settlements in a frozen northern region"],
  [/\bIcewind Dale\b/gi, "a frozen northern region"],
  [/\bTen-Towns\b/gi, "remote northern settlements"],
  [/\bBaldur['’]s Gate\b/gi, "a sprawling trade city"],
  [/\bWaterdeep\b/gi, "a great cosmopolitan city"],
  [/\bWaterdhavian\b/gi, "cosmopolitan"],
  [/\bSword Coast\b/gi, "the western coast"],
  [/\bForgotten Realms\b/gi, "the wider world"],
  [/\bFaer[uû]n\b/gi, "the wider world"],
  [/\bWildemount\b/gi, "the wider world"],
  [/\bEberron\b/gi, "the wider world"],
  [/\bKhorvaire\b/gi, "the wider world"],
  [/\bRavnica\b/gi, "a vast metropolis"],
  [/\bRavnican\b/gi, "metropolitan"],
  [/\bTheros\b/gi, "the wider world"],
  [/\bDwendalian Empire\b/gi, "the ruling empire"],
  [/\bDwendalian\b/gi, "imperial"],
  [/\bBiting North\b/gi, "the far north"],
  [/\bClovis Concord\b/gi, "a neighboring coastal alliance"],
  [/\bXhorhas\b/gi, "hostile borderlands"],
  [/\bZadash\b/gi, "a large imperial city"],
  [/\bRexxentrum\b/gi, "the imperial capital"],
  [/\bAnauroch\b/gi, "a great desert"],
  [/\bMyth Drannor\b/gi, "a ruined magical city"],
  [/\bEvermeet\b/gi, "a distant elven homeland"],
  [/\bGreat Glacier\b/gi, "a vast glacier"],
  [/\bGreat Ice\b/gi, "the frozen wastes"],
  [/\bReghed Glacier\b/gi, "a northern glacier"],
  [/\bHalruaa\b/gi, "a distant mage-ruled land"],
  [/\bHalruaans\b/gi, "the people of a mage-ruled land"],
  [/\bChondalwood\b/gi, "a deep southern forest"],
  [/\bChondath\b/gi, "a distant homeland"],
  [/\bChondathan\b/gi, "coastal"],
  [/\bCandlekeep\b/gi, "a renowned library"],
  [/\bCormyr\b/gi, "a well-ordered kingdom"],
  [/\bGalifar\b/gi, "a fallen kingdom"],
  [/\bGavony\b/gi, "a rural province"],
  [/\bKessig\b/gi, "a wild frontier province"],
  [/\bLhazaar Principalities\b/gi, "a chain of maritime principalities"],
  [/\bLhazaar\b/gi, "maritime principalities"],
  [/\bLuskan\b/gi, "a lawless northern port"],
  [/\bMenagerie Coast\b/gi, "a lively coastal region"],
  [/\bMintarn\b/gi, "an island stronghold"],
  [/\bMoonshae Isles\b/gi, "a misty island chain"],
  [/\bMoonshae\b/gi, "a misty island chain"],
  [/\bMoonshavian\b/gi, "islander"],
  [/\bMournland\b/gi, "a magical wasteland"],
  [/\bMror Holds\b/gi, "mountain strongholds"],
  [/\bMror\b/gi, "mountain strongholds"],
  [/\bMulhorand\b/gi, "an ancient desert kingdom"],
  [/\bMulhorandi\b/gi, "desert-kingdom"],
  [/\bNaktamun\b/gi, "a carefully ordered city-state"],
  [/\bNeverwinter\b/gi, "a rebuilt northern city"],
  [/\bRashemen\b/gi, "a rugged eastern homeland"],
  [/\bRashemi\b/gi, "frontier"],
  [/\bRock of Bral\b/gi, "a remote asteroid settlement"],
  [/\bSigil\b/gi, "a planar crossroads city"],
  [/\bSossal\b/gi, "a remote frozen land"],
  [/\bSundabar\b/gi, "a fortified northern city"],
  [/\bTethyr\b/gi, "a southern kingdom"],
  [/\bThesk\b/gi, "an eastern trade land"],
  [/\bTurmish\b/gi, "a coastal republic"],
  [/\bVilhon Reach\b/gi, "a broad coastal region"],
  [/\bOuter City\b/gi, "outer districts"],
  [/\bLower City\b/gi, "working districts"],
  [/\bUpper City\b/gi, "wealthy districts"],
  [/\bHigh Hall\b/gi, "the civic archives"],
  [/\bBloomridge\b/gi, "a fashionable neighborhood"],
  [/\bOasis Theater\b/gi, "a celebrated theater"],
  [/\bTwin Songs\b/gi, "an outlying neighborhood"],
]);

export const BLOCKED_BACKGROUND_LOCATIONS = Object.freeze([
  "Ten-Towns",
  "Icewind Dale",
  "Baldur's Gate",
  "Waterdeep",
  "Waterdhavian",
  "Sword Coast",
  "Forgotten Realms",
  "Faerûn",
  "Wildemount",
  "Eberron",
  "Khorvaire",
  "Ravnica",
  "Theros",
  "Dwendalian",
  "Xhorhas",
  "Zadash",
  "Rexxentrum",
  "Anauroch",
  "Myth Drannor",
  "Evermeet",
  "Great Glacier",
  "Great Ice",
  "Reghed Glacier",
  "Halruaa",
  "Chondalwood",
  "Chondath",
  "Chondathan",
  "Candlekeep",
  "Cormyr",
  "Galifar",
  "Gavony",
  "Kessig",
  "Lhazaar",
  "Luskan",
  "Menagerie Coast",
  "Mintarn",
  "Moonshae",
  "Moonshavian",
  "Mournland",
  "Mror",
  "Mulhorand",
  "Mulhorandi",
  "Naktamun",
  "Neverwinter",
  "Rashemen",
  "Rashemi",
  "Rock of Bral",
  "Sossal",
  "Sundabar",
  "Tethyr",
  "Thesk",
  "Turmish",
  "Vilhon Reach",
]);

export const BACKGROUND_LORE_OVERRIDES = Object.freeze({
  "ice-fisher": "You come from a proud line of fishers who work frozen lakes and dangerous winter waters. It is an honest but unforgiving trade: you learned to judge thin ice, wrestle heavy catches from freezing water, maintain simple gear, and endure long hours of cold without losing focus. Those experiences toughened both your body and your patience for a life of adventuring.",
});

function slug(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function removeSourceDirections(text = "") {
  return String(text)
    .replace(/(?:^|(?<=[.!?]\s))See the ["“][^"”]+["”] section[^.!?]*[.!?]\s*/gi, "")
    .replace(/(?:^|(?<=[.!?]\s))The Gods of the Multiverse section[^.!?]*[.!?]\s*/gi, "")
    .replace(/\s*\((?:described|detailed) in [^)]+\)/gi, "")
    .replace(/\s+from the Player['’]s Handbook setting/gi, "")
    .replace(/\s+from the Player['’]s Handbook/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function neutralizeBackgroundLore(name = "", value = "") {
  const override = BACKGROUND_LORE_OVERRIDES[slug(name)];
  if (override) return override;

  let text = removeSourceDirections(value);
  for (const [pattern, replacement] of LOCATION_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text
    .replace(/\bthe wider world setting\b/gi, "the wider world")
    .replace(/\bthe the\b/gi, "the")
    .replace(/\ba a\b/gi, "a")
    .replace(/\bthe a\b/gi, "a")
    .replace(/\bdistricts['’]s\b/gi, "district's")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function campaignLocationReferenceCount(value = "") {
  const text = String(value);
  return LOCATION_REPLACEMENTS.reduce((count, [pattern]) => {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    return count + [...text.matchAll(new RegExp(pattern.source, flags))].length;
  }, 0);
}

export function genericBackgroundLore(name = "") {
  const label = String(name || "this background")
    .replace(/^Baldur['’]s Gate\s+/i, "")
    .replace(/^Waterdhavian\s+/i, "")
    .replace(/^(?:Chondathan|Rashemi|Mulhorandi|Lorwyn|Shadowmoor)\s+/i, "")
    .trim();
  const lower = label.toLowerCase();
  if (/spy|agent|operative|informant|faction/.test(lower)) return `Your years as ${label} taught you to trade in trust, secrets, and carefully managed identities. Decide who recruited you, which loyalty matters most, and what information could still place you in danger.`;
  if (/knight|soldier|marine|mercenary|veteran|legion|military/.test(lower)) return `Life as ${label} placed you inside a disciplined martial tradition with its own duties, comrades, and scars. Decide which campaign defined you and whether your former allegiance is a source of pride, regret, or unfinished business.`;
  if (/scholar|student|research|archae|anthrop|histor|lore|sage|academic/.test(lower)) return `As ${label}, you pursued knowledge through study, travel, or firsthand investigation. Your work connected you to mentors, institutions, and a discovery whose importance may only now be becoming clear.`;
  if (/guild|artisan|craft|smith|maker|engineer|trader|merchant/.test(lower)) return `Your life as ${label} was built through practiced skill, professional relationships, and a reputation earned one job at a time. Former patrons, rivals, debts, and unfinished work offer natural ties to the wider world.`;
  if (/noble|courtier|vassal|heir|scion|house agent/.test(lower)) return `You were raised around status, obligation, reputation, and the long memory of an influential family or court. Your name and manners can open doors, but they also bind you to inherited duties, ambitious relatives, old alliances, and enemies you did not choose.`;
  if (/tribe|clan|foundling/.test(lower)) return `You were shaped by a close-knit people whose traditions, shared labor, and survival depended on cooperation. Decide which custom you still honor, who taught it to you, and whether leaving home made you an emissary, an exile, or a seeker of greater deeds.`;
  if (/wander|traveler|far traveler|refugee|outlander|nomad|drifter|planar|astral/.test(lower)) return `As ${label}, you learned to live between places and cultures. The journey changed how you see ordinary life, while the homeland, route, or people left behind remain a powerful part of your story.`;
  if (/priest|faith|temple|devotee|cult|initiate|chosen|religious|acolyte/.test(lower)) return `Your time as ${label} bound you to a faith, mystery, or sacred community. Decide what revelation or duty shaped you, who shares your beliefs, and what could cause your devotion to deepen—or fracture.`;
  if (/criminal|bounty|smuggler|pirate|urchin|outlaw|gambler|grifter/.test(lower)) return `Surviving as ${label} required nerve, useful contacts, and a flexible relationship with authority. Someone from that life may still consider you a partner, a debtor, a rival, or a loose end.`;
  if (/entertain|artist|perform|gladiator|athlete|celebrity|courtier/.test(lower)) return `As ${label}, you learned how reputation and public attention can change a person's fortunes. Your admirers, competitors, and most memorable performance still shape how others receive you.`;
  return `Your life as ${label} shaped the habits, relationships, and hard-earned experience you carried into adventuring. Decide who taught you, what ended that chapter of your life, and which person, place, or obligation still connects you to it.`;
}
