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
  [/\bAcquisitions Incorporated\b/gi, "an adventuring company"],
  [/\bKrynn\b/gi, "the wider world"],
  [/\bOrder of the White Robes\b/gi, "a benevolent magical tradition"],
  [/\bOrder of the Red Robes\b/gi, "a balance-minded magical tradition"],
  [/\bOrder of the Black Robes\b/gi, "an ambitious magical tradition"],
  [/\bWizards of High Sorcery\b/gi, "mages of the order"],
  [/\bMages of High Sorcery\b/gi, "the high-sorcery order"],
  [/\bTower of High Sorcery\b/gi, "tower maintained by the order"],
  [/\bAnnam\b/gi, "the ancient creator of giantkind"],
  [/\bLorwyn\b/gi, "a sunlit realm"],
  [/\bShadowmoor\b/gi, "a shadowed realm"],
  [/\bEirdu\b/gi, "a revered solar spirit"],
  [/\bDomains? of Dread\b/gi, "cursed realms"],
  [/\bthe Mists\b/g, "the supernatural mists"],
  [/\bOutlands\b/gi, "planar borderlands"],
  [/\bSilverymoon\b/gi, "another prosperous city"],
  [/\bSilverwatch\b/gi, "city watch"],
  [/\bSpellguard\b/gi, "arcane patrol"],
  [/\bCity of Splendors\b/gi, "great city"],
  [/\bZhentarim\b/gi, "a large mercenary company"],
  [/\bWitchlight Carnival\b/gi, "a traveling fey carnival"],
  [/\bMister Witch and Mister Light\b/gi, "the carnival's mysterious owners"],
  [/\bChosen of Uthgar\b/gi, "traditionalist leaders"],
  [/\bUthgardt\b/gi, "traditional tribal"],
  [/\bUthgar\b/gi, "an ancestral hero"],
  [/\bHarpers\b/gi, "wandering allies"],
  [/\bFirst Circle\b/gi, "old gods"],
  [/\bWildspace\b/gi, "the starry void"],
  [/\bSilver Void\b/gi, "the astral void"],
  [/\bSpace Hamster\b/gi, "fearless voidbeast"],
  [/\bBoo['’]s Astral Menagerie\b/gi, "an astral bestiary"],
  [/\bacross the Realms\b/gi, "throughout the wider world"],
]);

export const BLOCKED_BACKGROUND_LOCATIONS = Object.freeze([
  "Ten-Towns", "Icewind Dale", "Baldur's Gate", "Waterdeep", "Waterdhavian", "Sword Coast",
  "Forgotten Realms", "Faerûn", "Wildemount", "Eberron", "Khorvaire", "Ravnica", "Theros",
  "Dwendalian", "Xhorhas", "Zadash", "Rexxentrum", "Anauroch", "Myth Drannor", "Evermeet",
  "Great Glacier", "Great Ice", "Reghed Glacier", "Halruaa", "Chondalwood", "Chondath",
  "Chondathan", "Candlekeep", "Cormyr", "Galifar", "Gavony", "Kessig", "Lhazaar", "Luskan",
  "Menagerie Coast", "Mintarn", "Moonshae", "Moonshavian", "Mournland", "Mror", "Mulhorand",
  "Mulhorandi", "Naktamun", "Neverwinter", "Rashemen", "Rashemi", "Rock of Bral", "Sossal",
  "Sundabar", "Tethyr", "Thesk", "Turmish", "Vilhon Reach", "Wildspace", "Silver Void",
  "Boo's Astral Menagerie", "Space Hamster", "across the Realms",
]);

export const BACKGROUND_NAME_ALIASES = Object.freeze({
  "lorwyn-expert": "Sunlit Realm Expert",
  "shadowmoor-expert": "Gloam Realm Expert",
  "uthgardt-tribe-member": "Tribe Member",
  "waterdhavian-noble": "Cosmopolitan Noble",
  "witchlight-hand": "Carnival Hand",
  "wildspacer": "Voidfarer",
});

export const BACKGROUND_LORE_OVERRIDES = Object.freeze({
  "ice-fisher": "You come from a proud line of fishers who work frozen lakes and dangerous winter waters. It is an honest but unforgiving trade: you learned to judge thin ice, wrestle heavy catches from freezing water, maintain simple gear, and endure long hours of cold without losing focus. Those experiences toughened both your body and your patience for a life of adventuring.",
  "failed-merchant": "Maybe you come from a long line of merchants, or perhaps you were an entrepreneur striking out on your own. Either way, the venture ended badly. Bad luck, outside pressure, or poor judgment cost you nearly everything, but failure left you with useful contacts and hard-earned experience. You are free of that old business and ready to turn what you learned toward a new life of adventure.",
  "mage-of-high-sorcery": "Your talent for magic drew the attention of an established order devoted to studying magic and preventing its misuse. You trained among accomplished spellcasters and learned that magical power carries obligations as well as opportunity. The order contains several traditions with very different philosophies, and your own studies may eventually pull you toward one of them—or force you to define a path of your own.",
  "rune-carver": "You have dedicated your life to runecraft: the art of binding fragments of elemental and supernatural power into carefully shaped symbols. Whether a master taught you or you learned by studying ancient engravings, your craft combines patient scholarship, practical artistry, and a respect for traditions older than most kingdoms.",
  "athlete": "You strive to perfect yourself physically and in the execution of everything you do. Competition lights a fire in your blood, and the roar of a crowd drives you forward. Tales of your exploits may open doors or loosen tongues, and wherever people gather for contests of strength, speed, endurance, or skill, accomplished athletes command attention and respect.",
  "mist-wanderer": "You once knew your home, but supernatural mists carried you into a cursed realm and eventually from one strange domain to another. Since then you have learned to travel through hostile, shifting places where ordinary roads cannot be trusted. The experience changed you, yet you still seek a path home and take comfort in the rare communities of fellow wanderers you meet along the way.",
  "city-watch": "You served as a community's first line of defense against crime. Rather than watching distant borders, you learned local laws, patrol routes, neighborhood tensions, and the habits of people who prey on ordinary citizens. Your former watch might have been a modest town guard, a disciplined city patrol, or a specialized unit trained for unusual threats.",
  "clan-crafter": "You learned a skilled craft inside a close-knit tradition where workmanship, reputation, and apprenticeship carry great weight. Years under demanding masters taught you patience and exacting standards. Whether you were born into that community or earned your place through talent, your maker's mark now connects you to craftspeople, patrons, rivals, and obligations far beyond your old workshop.",
  "mercenary-veteran": "You fought for coin as part of one or more mercenary companies and know the risks, routines, and hard bargains of a soldier-for-hire. You can read a company's emblem, recognize the signs of professional troops, and trade stories about employers, campaigns, and old comrades. Adventuring offers greater freedom, but the habits and contacts of mercenary life remain useful.",
  "uthgardt-tribe-member": "You were shaped by a people who value tradition, cooperation, survival, and loyalty to the old ways. Your community's customs taught you how to live from the land and how much identity can rest in shared stories, taboos, and ancestral obligations. Leaving home may have made you an emissary, an exile, or simply someone carrying those traditions into a wider world.",
  "witchlight-hand": "You joined a traveling fey carnival while young and grew up among performers, roustabouts, animal handlers, stagehands, and strange attractions. You learned to work hard behind the scenes while the carnival moved from place to place. The wonder eventually became routine, and now the road beyond the carnival gates promises adventures the old circuit no longer can.",
  "wildspacer": "You were raised among asteroid miners, moon farmers, remote settlements, and crews that cross the starry void between worlds. Life aboard voidfaring vessels taught you to work in cramped quarters, face strange creatures without panic, and adapt when ordinary ideas of weather, distance, and gravity no longer apply. Those years left you unusually comfortable with the hazards of travel beyond a world's sky.",
});

const BACKGROUND_FEATURE_NAME_ALIASES = Object.freeze({
  "clan-crafter|respect-of-the-stout-folk": "Clan Respect",
  "uthgardt-tribe-member|uthgardt-heritage": "Tribal Heritage",
  "wildspacer|wildspace-adaptation": "Void Adaptation",
});

const BACKGROUND_FEATURE_OVERRIDES = Object.freeze({
  "astral-drifter|divine-contact": "You gain the Magic Initiate feat and must choose Cleric for it. During your travels through the Astral Sea, you crossed paths with a wandering deity who shared a secret or obscure piece of cosmic lore with you. Work with your Game Master to decide who the deity was and what knowledge the encounter left behind.",
  "athlete|echoes-of-victory": "Your past victories earned you admirers among spectators, fellow athletes, and trainers. When visiting a settlement within 100 miles of where you grew up, there is a 50% chance you can find someone who recognizes your reputation and is willing to provide information or temporary shelter. Between adventures, you can compete in athletic events sufficient to maintain a comfortable lifestyle.",
  "clan-crafter|respect-of-the-stout-folk": "Your reputation as a trained clan artisan earns respect among communities that share or honor your craft tradition. In settlements where that tradition is established, you can usually secure modest room and board, and local craftspeople are inclined to offer practical assistance.",
  "mage-of-high-sorcery|initiate-of-high-sorcery": "You gain the Initiate of High Sorcery feat. In addition, the order provides free, modest lodging and food at any occupied tower it maintains, and you can usually claim one night's hospitality at the home of a member of the order.",
  "marine|steady": "You can move for twice the normal amount of travel time, up to 16 hours each day, before becoming subject to forced-march effects. In addition, you can automatically find a safe route for landing a boat on shore, provided such a route exists.",
  "mercenary-veteran|mercenary-life": "You know mercenary life well enough to identify companies by their emblems and recall useful information about their reputation and recent employers. You know where soldiers-for-hire gather in settlements, and between adventures you can find mercenary work sufficient to maintain a comfortable lifestyle.",
  "uthgardt-tribe-member|uthgardt-heritage": "You are exceptionally familiar with wilderness terrain and natural resources. When you forage in wilderness, you can find twice as much food and water as you normally would. You can also call on the hospitality of your people and communities allied with them.",
  "waterdhavian-noble|kept-in-style": "Your family or house maintains enough standing and credit in the region where it is known to cover ordinary expenses. In settlements where your house has influence, your name and signet can maintain a comfortable lifestyle without the usual daily cost, or reduce the cost of a wealthier lifestyle by the same amount. This support cannot be converted into income.",
  "wildspacer|wildspace-adaptation": "You gain the Tough feat. In addition, you are accustomed to zero gravity: being weightless does not impose disadvantage on your melee attack rolls.",
  "witchlight-hand|carnival-fixture": "The traveling carnival provides you with free, modest lodging and food. You may also wander through the carnival and partake of its ordinary attractions at no cost, provided you do not disrupt performances or cause trouble.",
});

function slug(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function featureKey(backgroundName = "", featureName = "") {
  return `${slug(backgroundName)}|${slug(featureName)}`;
}

export function playerFacingBackgroundName(name = "") {
  return BACKGROUND_NAME_ALIASES[slug(name)] || String(name || "").trim();
}

export function playerFacingBackgroundFeatureName(backgroundName = "", featureName = "") {
  return BACKGROUND_FEATURE_NAME_ALIASES[featureKey(backgroundName, featureName)] || String(featureName || "").trim();
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

function neutralizeText(value = "") {
  let text = removeSourceDirections(value);
  for (const [pattern, replacement] of LOCATION_REPLACEMENTS) text = text.replace(pattern, replacement);
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

export function neutralizeBackgroundLore(name = "", value = "") {
  const override = BACKGROUND_LORE_OVERRIDES[slug(name)];
  return override || neutralizeText(value);
}

export function neutralizeBackgroundFeature(backgroundName = "", featureName = "", value = "") {
  const override = BACKGROUND_FEATURE_OVERRIDES[featureKey(backgroundName, featureName)];
  return override || neutralizeText(value);
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
