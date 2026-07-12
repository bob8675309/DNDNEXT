const NAME_POOLS = Object.freeze({
  human: {
    male: ["Alden", "Bram", "Corvin", "Darius", "Edric", "Garran", "Lucan", "Marek", "Rowan", "Tobin"],
    female: ["Adela", "Brina", "Celia", "Elara", "Helena", "Mira", "Nessa", "Sabine", "Talia", "Vera"],
    neutral: ["Ash", "Ellis", "Hollis", "Jules", "Morgan", "Perrin", "Quinn", "Reese", "Sage", "Wren"],
    family: ["Ashdown", "Blackmere", "Dunwell", "Fairweather", "Hawke", "Marrow", "Redfern", "Stone", "Vale", "Winter"],
  },
  dwarf: {
    male: ["Bardin", "Dorrik", "Fargrim", "Gormek", "Harbek", "Kildrak", "Orsik", "Rurik", "Thrain", "Vondal"],
    female: ["Brynna", "Dagna", "Eldeth", "Gunnloda", "Helja", "Ilga", "Kathra", "Marta", "Riswynn", "Vistra"],
    neutral: ["Ardin", "Brokk", "Dori", "Korin", "Marn", "Nori", "Runa", "Tarn", "Vori", "Zori"],
    family: ["Battlehammer", "Deepdelver", "Fireforge", "Granitehand", "Ironroot", "Oathstone", "Silvervein", "Stonehelm", "Truebeard", "Wintermantle"],
  },
  elf: {
    male: ["Adran", "Aelar", "Aramil", "Erevan", "Galinndan", "Ivellios", "Laucian", "Paelias", "Soveliss", "Theren"],
    female: ["Adrie", "Althaea", "Drusilia", "Enna", "Felosial", "Ielenia", "Keyleth", "Lia", "Meriele", "Shanairra"],
    neutral: ["Ari", "Cael", "Eli", "Iri", "Leth", "Naeris", "Quarion", "Rinn", "Syl", "Vael"],
    family: ["Amakiir", "Galanodel", "Holimion", "Ilphelkiir", "Liadon", "Meliamne", "Nailo", "Siannodel", "Waveborn", "Windwalker"],
  },
  gnome: {
    male: ["Alston", "Boddynock", "Dimble", "Fonkin", "Gimble", "Jebeddo", "Namfoodle", "Orryn", "Seebo", "Zook"],
    female: ["Bimpnottin", "Breena", "Caramip", "Ellyjobell", "Ellywick", "Lilli", "Loopmottin", "Mardnab", "Nissa", "Waywocket"],
    neutral: ["Bixi", "Dabble", "Fizz", "Jinx", "Mim", "Nim", "Pip", "Tink", "Wobble", "Zib"],
    family: ["Beren", "Daergel", "Folkor", "Garrick", "Nackle", "Murnig", "Ningel", "Raulnor", "Scheppen", "Timbers"],
  },
  halfling: {
    male: ["Alton", "Ander", "Cade", "Corrin", "Eldon", "Errich", "Garret", "Lyle", "Milo", "Osborn"],
    female: ["Andry", "Bree", "Callie", "Cora", "Euphemia", "Jillian", "Kithri", "Lavinia", "Lidda", "Seraphina"],
    neutral: ["Ari", "Bramble", "Dove", "Finch", "Merry", "Poppy", "Reed", "Robin", "Sunny", "Thistle"],
    family: ["Brushgather", "Goodbarrel", "Greenbottle", "Highhill", "Hilltopple", "Leagallow", "Oakshade", "Tealeaf", "Thorngage", "Underbough"],
  },
  orc: {
    male: ["Dench", "Feng", "Gell", "Henk", "Holg", "Imsh", "Keth", "Krusk", "Mhurren", "Ront"],
    female: ["Baggi", "Emen", "Engong", "Kansif", "Myev", "Neega", "Ovak", "Ownka", "Shautha", "Sutha"],
    neutral: ["Ark", "Bruk", "Dren", "Ghar", "Kesh", "Mog", "Narg", "Ruk", "Thok", "Varg"],
    family: ["Ash-Tusk", "Blackfang", "Bloodmark", "Bonecleaver", "Direfang", "Ironjaw", "Redhand", "Skullsplitter", "Stonehide", "Warsong"],
  },
  tiefling: {
    male: ["Akmenos", "Amnon", "Barakas", "Damakos", "Ekemon", "Iados", "Kairon", "Leucis", "Melech", "Therai"],
    female: ["Akta", "Anakis", "Bryseis", "Criella", "Damaia", "Ea", "Kallista", "Lerissa", "Makaria", "Nemeia"],
    neutral: ["Art", "Carrion", "Creed", "Despair", "Hope", "Music", "Nowhere", "Open", "Quest", "Reverence"],
    family: ["Ashvein", "Cinderborn", "Duskwhisper", "Emberfall", "Hellrune", "Nightglass", "Redstar", "Shadowbrand", "Thornfire", "Voidmark"],
  },
  dragonborn: {
    male: ["Arjhan", "Balasar", "Bharash", "Ghesh", "Heskan", "Kriv", "Medrash", "Mehen", "Nadarr", "Rhogar"],
    female: ["Akra", "Biri", "Daar", "Farideh", "Harann", "Havilar", "Jheri", "Kava", "Mishann", "Sora"],
    neutral: ["Arax", "Dren", "Keth", "Nym", "Rhaz", "Sarr", "Thava", "Vesh", "Xar", "Zhar"],
    family: ["Clethtinthiallor", "Daardendrian", "Delmirev", "Drachedandion", "Fenkenkabradon", "Kepeshkmolik", "Kerrhylon", "Kimbatuul", "Linxakasendalor", "Myastan"],
  },
  goliath: {
    male: ["Aukan", "Eglath", "Gauthak", "Ilikan", "Keothi", "Kuori", "Lo-Kag", "Manneo", "Maveith", "Nalla"],
    female: ["Gae-Al", "Gola", "Kolae", "Kuli", "Nimak", "Orilo", "Pethani", "Thalai", "Uthal", "Vamak"],
    neutral: ["Aru", "Bryn", "Doru", "Kesh", "Moru", "Naru", "Oru", "Tavi", "Uru", "Vori"],
    family: ["Bearkiller", "Dawncaller", "Fearless", "Horncarver", "Keeneye", "Lonehunter", "Skywatcher", "Stonebreaker", "Threadtwister", "Twice-Orphaned"],
  },
  aasimar: {
    male: ["Arael", "Cassiel", "Elyon", "Gavriel", "Ithuriel", "Malach", "Raziel", "Sariel", "Uriel", "Zadkiel"],
    female: ["Ariella", "Cassia", "Eliora", "Galatea", "Liora", "Naamah", "Raziel", "Seraphina", "Urielle", "Zaphira"],
    neutral: ["Aster", "Dawn", "Halo", "Lumen", "Mercy", "Nova", "Radiance", "Sol", "Vesper", "Zephyr"],
    family: ["Brightmantle", "Dawnshield", "Goldwing", "Lightbearer", "Moonward", "Radiant", "Silverstar", "Suncrest", "Truthbound", "Whiteflame"],
  },
  drow: {
    male: ["Berg'inyon", "Drizzt", "Elkantar", "Guldor", "Ilmryn", "Jarlaxle", "Kelnozz", "Nalfein", "Ryld", "Zaknafein"],
    female: ["Akordia", "Briza", "Eclavdra", "Ilharess", "Liriel", "Malice", "Quenthel", "Sabal", "Triel", "Vierna"],
    neutral: ["Alyrn", "Drin", "Ilyth", "Nym", "Ryl", "Sszin", "Taz", "Veld", "Xil", "Zin"],
    family: ["Auvryndar", "Baenre", "Do'Urden", "Hun'ett", "Mizzrym", "Oblodra", "Teken'duis", "Xorlarrin", "Zauvirr", "Zolond"],
  },
  goblin: {
    male: ["Brek", "Droop", "Fenk", "Grit", "Krix", "Nib", "Razz", "Snik", "Tark", "Vrek"],
    female: ["Bikka", "Driz", "Fenna", "Grikka", "Kazi", "Miz", "Nikka", "Rikka", "Tazzi", "Vexa"],
    neutral: ["Bip", "Crik", "Fiz", "Glim", "Nip", "Pox", "Rik", "Snip", "Tik", "Zig"],
    family: ["Ashnose", "Blacktooth", "Crackedpot", "Mudfoot", "Quickknife", "Ratcatcher", "Redcap", "Sharpstick", "Sootface", "Wormtongue"],
  },
  generic: {
    male: ["Arlen", "Bram", "Corren", "Darek", "Evin", "Garr", "Kael", "Marek", "Roran", "Tarin"],
    female: ["Ari", "Brenna", "Cerys", "Elira", "Kara", "Mira", "Nerys", "Rhea", "Tessa", "Vara"],
    neutral: ["Ash", "Ember", "Kestrel", "Lark", "Onyx", "Perrin", "Quill", "River", "Sable", "Vale"],
    family: ["Ashborn", "Blackwood", "Dawnmere", "Emberfall", "Frost", "Nightwind", "Ravencrest", "Stone", "Thorn", "Wilds"],
  },
});

function pick(values, random = Math.random) {
  const list = Array.isArray(values) && values.length ? values : [""];
  return list[Math.floor(random() * list.length)] || "";
}

function normalizeSpeciesKey(value = "") {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "generic";
  if (text.includes("drow")) return "drow";
  if (text.includes("goblin")) return "goblin";
  for (const key of Object.keys(NAME_POOLS)) {
    if (key !== "generic" && text.includes(key)) return key;
  }
  if (/(orc|half-orc)/.test(text)) return "orc";
  if (/(elf|eladrin|shadar-kai)/.test(text)) return "elf";
  if (/(dwarf|duergar)/.test(text)) return "dwarf";
  if (/(gnome|deep gnome)/.test(text)) return "gnome";
  if (/(halfling|kender)/.test(text)) return "halfling";
  if (/(aasimar|celestial)/.test(text)) return "aasimar";
  if (/(tiefling|fiend)/.test(text)) return "tiefling";
  if (/(dragonborn|kobold|draconic)/.test(text)) return "dragonborn";
  if (/(goliath|giant)/.test(text)) return "goliath";
  return "generic";
}

function normalizeGender(value = "") {
  const text = String(value || "").toLowerCase();
  if (text.startsWith("f")) return "female";
  if (text.startsWith("m")) return "male";
  return "neutral";
}

export function generateNpcName({ species = "", gender = "neutral", random = Math.random } = {}) {
  const speciesKey = normalizeSpeciesKey(species);
  const pool = NAME_POOLS[speciesKey] || NAME_POOLS.generic;
  const genderKey = normalizeGender(gender);
  const given = pick(pool[genderKey] || pool.neutral || NAME_POOLS.generic.neutral, random);
  const family = pick(pool.family || NAME_POOLS.generic.family, random);
  return [given, family].filter(Boolean).join(" ");
}

export function npcNamePoolKey(species = "") {
  return normalizeSpeciesKey(species);
}
