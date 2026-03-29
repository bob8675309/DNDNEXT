
const TOWN_OVERRIDES = {
  xul: {
    summary:
      "Xul rewards those who make themselves useful, dangerous, entertaining, or profitable. Arena rank shapes public status, traders respond to reputation, and powerful people pay attention when a name starts to matter.",
    stats: {
      population: "Large, dense, mixed-monster city",
      morale: "High energy, status-driven",
      defenses: "City watch, arena security, controlled force",
      mood: "Charged, competitive, opportunistic",
      ruler: "Joey",
      knownFor: "Arena ranks, monster trade, spectacle",
    },
    services: ["Arena", "Markets", "Smithy", "Cartography", "Alchemist", "Twisted Horn"],
    cityStories: [
      { title: "Arena headliner", text: "An upset is expected tonight and the whole quarter is talking." },
      { title: "Market opportunity", text: "Rare monster materials entered the quarter this morning." },
      { title: "Residency rumor", text: "Several rising names are being discussed in higher circles." },
      { title: "Quiet pressure", text: "Someone important is watching the rank board closely." },
      { title: "Crowd swell", text: "The Arena Quarter is busier than normal ahead of dusk." },
      { title: "Sponsor hunt", text: "Some local brokers are quietly shopping for new talent." },
    ],
    rumors: [
      { title: "Heavy betting at the Twisted Horn", text: "The tavern is all in on an underdog and the crowd smells something unusual." },
      { title: "Rare hide under guard", text: "A broker says a rare hide entered the city this morning under guard." },
      { title: "Board watchers", text: "Someone high up has started watching the rank board more closely than usual." },
      { title: "Satyr sponsor", text: "A performer is quietly looking for talented outsiders to back." },
      { title: "Residency whispers", text: "Some names are being discussed behind doors they did not expect to reach yet." },
      { title: "Quiet buyer", text: "A wealthy collector is searching for something very specific tonight." },
    ],
    jobLeads: [
      { title: "Rare-hide procurement", text: "Vorga the Smith wants a rare hide suitable for a named weapon commission." },
      { title: "Lost wager records", text: "Ask Kesh the Arena Bookkeeper about missing books tied to recent payouts." },
      { title: "Prize beast escort", text: "Guide a dangerous animal through the Merchant Quarter before dusk." },
      { title: "Sealed delivery", text: "Carry closed papers to the Residency Ward without opening them." },
    ],
    people: [
      { title: "Joey", text: "Ruler and attention magnet at the top of the city." },
      { title: "Kesh", text: "Arena Bookkeeper handling ranks, payouts, and disputes." },
      { title: "Vorga", text: "Smith tied to custom weapon requests and rare materials." },
      { title: "Satyr Bard", text: "Potential mentor and social connector for performers." },
    ],
    mapLabels: [
      { label: "Arena", x: 58, y: 16, tone: "rose" },
      { label: "Market Square", x: 38, y: 50, tone: "amber" },
      { label: "Alchemist", x: 16, y: 36, tone: "emerald" },
      { label: "Smithy", x: 20, y: 58, tone: "amber" },
      { label: "Cartography", x: 18, y: 18, tone: "stone" },
      { label: "Church Square", x: 77, y: 28, tone: "stone" },
      { label: "Merchant Gate", x: 70, y: 72, tone: "cyan" },
      { label: "Twisted Horn", x: 44, y: 67, tone: "violet" },
    ],
  },
}

export function pickId(x) {
  if (!x) return null;
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  return x.id || x.uuid || x.character_id || x.npc_id || x.quest_id || x.name || x.title || null;
}

export function normalizeTownKey(location) {
  return String(location?.slug || location?.name || "").trim().toLowerCase();
}

function buildGenericTownData(location, rosterChars, quests) {
  const npcs = (rosterChars || []).filter((c) => String(c?.kind) !== "merchant");
  const merchants = (rosterChars || []).filter((c) => String(c?.kind) === "merchant");
  const featuredPeople = [];
  for (const p of [...npcs.slice(0, 3), ...merchants.slice(0, 2)]) {
    featuredPeople.push({
      title: p?.name || "Unknown resident",
      text:
        [p?.role, p?.affiliation].filter(Boolean).join(" • ") ||
        (p?.kind === "merchant" ? "Merchant present in town." : "Resident currently present."),
    });
  }
  if (!featuredPeople.length) {
    featuredPeople.push({ title: "No surfaced NPCs", text: "No named residents are currently surfaced for this location." });
  }

  const jobLeads = [];
  for (const q of quests || []) {
    jobLeads.push({
      title: q?.title || "Untitled quest",
      text: q?.status ? `Quest status: ${q.status}.` : "Quest currently listed for this location.",
    });
  }
  if (!jobLeads.length) {
    jobLeads.push({ title: "No posted jobs", text: "No quest leads are currently attached to this location." });
  }

  const desc = location?.description || "A known location on the map.";
  return {
    summary: desc,
    stats: {
      population: location?.population || "Unknown",
      morale: location?.morale || "Unrecorded",
      defenses: location?.defenses || "Unrecorded",
      mood: location?.mood || "Unrecorded",
      ruler: location?.ruler || location?.government || "Local authority unknown",
      knownFor: location?.known_for || location?.region || "Regional significance not yet described",
    },
    services: ["Inn & Tavern", "Marketplace", "Smithy", "Temple / Healer", "Stables", "Job Board"],
    cityStories: [
      { title: "Current location note", text: desc },
      { title: "People present", text: `${npcs.length} NPCs and ${merchants.length} merchants currently surfaced here.` },
    ],
    rumors: [
      { title: "Town talk", text: desc },
      { title: "Map chatter", text: "Players can inspect the roster, available quests, and current notable places from overview." },
    ],
    jobLeads,
    people: featuredPeople,
    mapLabels: [
      { label: "Inn", x: 18, y: 24, tone: "stone" },
      { label: "Market", x: 42, y: 52, tone: "amber" },
      { label: "Smithy", x: 22, y: 60, tone: "emerald" },
      { label: "Shrine", x: 73, y: 28, tone: "stone" },
      { label: "Gate", x: 70, y: 72, tone: "cyan" },
    ],
  };
}

export function buildTownData(location, rosterChars, quests) {
  const key = normalizeTownKey(location);
  const override = TOWN_OVERRIDES[key];
  if (!override) return buildGenericTownData(location, rosterChars, quests);

  const mergedPeople = [...override.people];
  for (const p of (rosterChars || []).slice(0, 4)) {
    const name = p?.name || "Unknown";
    if (!mergedPeople.some((x) => x.title === name)) {
      mergedPeople.push({
        title: name,
        text: [p?.role, p?.affiliation].filter(Boolean).join(" • ") || "Currently present in town.",
      });
    }
  }

  const mergedJobs = [...override.jobLeads];
  for (const q of quests || []) {
    const name = q?.title || "Untitled quest";
    if (!mergedJobs.some((x) => x.title === name)) {
      mergedJobs.push({ title: name, text: q?.status ? `Quest status: ${q.status}.` : "Quest currently listed for this location." });
    }
  }

  return {
    ...override,
    people: mergedPeople,
    jobLeads: mergedJobs,
  };
}
