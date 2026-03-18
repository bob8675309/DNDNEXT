// components/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (v) => UUID_RE.test(String(v || "").trim());

const pickId = (x) => {
  if (!x) return null;
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  return x.id || x.uuid || x.character_id || x.npc_id || x.quest_id || x.name || x.title || null;
};

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
    cityStories: [
      {
        title: "Arena headliner",
        text: "An upset is expected tonight and the whole quarter is talking.",
      },
      {
        title: "Market opportunity",
        text: "Rare monster materials entered the quarter this morning.",
      },
      {
        title: "Residency rumor",
        text: "Several rising names are being discussed in higher circles.",
      },
      {
        title: "Quiet pressure",
        text: "Someone important is watching the rank board closely.",
      },
      {
        title: "Crowd swell",
        text: "The Arena Quarter is busier than normal ahead of dusk.",
      },
      {
        title: "Sponsor hunt",
        text: "Some local brokers are quietly shopping for new talent.",
      },
    ],
    rumors: [
      {
        title: "Heavy betting at the Twisted Horn",
        text: "The tavern is all in on an underdog and the crowd smells something unusual.",
      },
      {
        title: "Rare hide under guard",
        text: "A broker says a rare hide entered the city this morning under guard.",
      },
      {
        title: "Board watchers",
        text: "Someone high up has started watching the rank board more closely than usual.",
      },
      {
        title: "Satyr sponsor",
        text: "A performer is quietly looking for talented outsiders to back.",
      },
      {
        title: "Residency whispers",
        text: "Some names are being discussed behind doors they did not expect to reach yet.",
      },
      {
        title: "Quiet buyer",
        text: "A wealthy collector is searching for something very specific tonight.",
      },
    ],
    jobLeads: [
      {
        title: "Rare-hide procurement",
        text: "Vorga the Smith wants a rare hide suitable for a named weapon commission.",
      },
      {
        title: "Lost wager records",
        text: "Ask Kesh the Arena Bookkeeper about missing books tied to recent payouts.",
      },
      {
        title: "Prize beast escort",
        text: "Guide a dangerous animal through the Merchant Quarter before dusk.",
      },
      {
        title: "Sealed delivery",
        text: "Carry closed papers to the Residency Ward without opening them.",
      },
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
};

function toneClass(tone) {
  switch (tone) {
    case "amber":
      return "tone-amber";
    case "rose":
      return "tone-rose";
    case "emerald":
      return "tone-emerald";
    case "violet":
      return "tone-violet";
    case "cyan":
      return "tone-cyan";
    default:
      return "tone-stone";
  }
}

function normalizeTownKey(location) {
  return String(location?.slug || location?.name || "")
    .trim()
    .toLowerCase();
}

function buildGenericTownData(location, rosterChars, quests) {
  const npcs = (rosterChars || []).filter((c) => String(c?.kind) !== "merchant");
  const merchants = (rosterChars || []).filter((c) => String(c?.kind) === "merchant");

  const featuredPeople = [];
  for (const p of [...npcs.slice(0, 3), ...merchants.slice(0, 2)]) {
    featuredPeople.push({
      title: p?.name || "Unknown resident",
      text: [p?.role, p?.affiliation].filter(Boolean).join(" • ") || (p?.kind === "merchant" ? "Merchant present in town." : "Resident currently present."),
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

function useTownData(location, rosterChars, quests) {
  return useMemo(() => {
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
  }, [location, rosterChars, quests]);
}

function TownMapPanel({ mapLabels = [] }) {
  return (
    <div className="town-map-panel">
      <div className="town-map-panel__head">
        <div className="town-map-panel__kicker">Interactive city layout</div>
        <div className="town-map-panel__sub">Arena, market, church square, alchemist, cartography, and more</div>
      </div>
      <div className="town-map-panel__body">
        <div className="town-map-surface">
          <div className="shape shape--stone" style={{ left: "8%", top: "12%", width: 56, height: 40 }} />
          <div className="shape shape--stone" style={{ left: "28%", top: "18%", width: 64, height: 48, borderRadius: 18 }} />
          <div className="shape shape--rose" style={{ left: "52%", top: "15%", width: 96, height: 72, borderRadius: 22 }} />
          <div className="shape shape--stone" style={{ left: "74%", top: "25%", width: 64, height: 48 }} />
          <div className="shape shape--emerald" style={{ left: "18%", top: "39%", width: 48, height: 44 }} />
          <div className="shape shape--amber" style={{ left: "34%", top: "47%", width: 100, height: 72, borderRadius: 22 }} />
          <div className="shape shape--amber" style={{ left: "20%", top: "58%", width: 56, height: 48 }} />
          <div className="shape shape--violet" style={{ left: "42%", top: "65%", width: 64, height: 48 }} />
          <div className="shape shape--cyan" style={{ left: "67%", top: "69%", width: 100, height: 56, borderRadius: 20 }} />
          <div className="shape shape--river" style={{ right: "7%", top: "8%", bottom: "8%", width: 48, position: "absolute" }} />

          {mapLabels.map((m) => (
            <div
              key={m.label}
              className={`map-label ${toneClass(m.tone)}`}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SharedDrawer({ panel, openPanel, setOpenPanel }) {
  return (
    <div className={`shared-drawer ${toneClass(panel.tone)}`}>
      <div className="shared-drawer__head">
        <div>
          <div className="shared-drawer__kicker">Shared drawer</div>
          <div className="shared-drawer__title">{panel.drawerTitle}</div>
          <div className="shared-drawer__sub">{panel.drawerSubtitle}</div>
        </div>
        <div className="shared-drawer__meta">Scrollable</div>
      </div>

      <div className="drawer-tabs">
        {[
          ["stories", "City stories"],
          ["people", "Featured people"],
          ["jobs", "Jobs & quest leads"],
          ["rumors", "Tavern rumors"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setOpenPanel(id)}
            className={`drawer-tab ${openPanel === id ? "is-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="shared-drawer__list">
        {panel.items.map((item) => (
          <div key={item.title} className={`shared-drawer__item ${toneClass(panel.tone)}`}>
            <div className="shared-drawer__itemTitle">{item.title}</div>
            <div className="shared-drawer__itemText">{item.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactTeaser({ title, subtitle, featuredTitle, featuredText, tone = "amber", active = false, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`compact-teaser ${toneClass(tone)} ${active ? "is-active" : ""}`}>
      <div className="compact-teaser__head">
        <div>
          <div className="compact-teaser__title">{title}</div>
          <div className="compact-teaser__sub">{subtitle}</div>
        </div>
        <div className="compact-teaser__meta">{active ? "open" : "view"}</div>
      </div>
      <div className={`compact-teaser__featured ${toneClass(tone)}`}>
        <div className="compact-teaser__featuredTitle">{featuredTitle}</div>
        <div className="compact-teaser__featuredText">{featuredText}</div>
      </div>
    </button>
  );
}

export default function LocationSideBar({
  isOpen = true,
  onClose,
  location,
  onOpenNpc,
  onOpenMerchant,
  isAdmin = false,
  onReload,
  onDeleteLocation,
  offcanvasId = "locPanel",
}) {
  const [loading, setLoading] = useState(false);
  const [rosterChars, setRosterChars] = useState([]);
  const [quests, setQuests] = useState([]);
  const [openPanel, setOpenPanel] = useState("stories");

  const questKeys = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location?.quests]);

  useEffect(() => {
    let alive = true;

    const loadDetails = async () => {
      if (isOpen === false || !location?.id) return;

      setLoading(true);
      try {
        let rosterQ = supabase
          .from("characters")
          .select(
            [
              "id",
              "name",
              "kind",
              "race",
              "role",
              "affiliation",
              "status",
              "state",
              "location_id",
              "last_known_location_id",
              "projected_destination_id",
              "is_hidden",
              "map_icon_id",
            ].join(",")
          )
          .in("kind", ["npc", "merchant"])
          .eq("location_id", location.id)
          .order("name", { ascending: true });

        if (!isAdmin) rosterQ = rosterQ.neq("is_hidden", true);

        const { data: rosterData, error: rosterErr } = await rosterQ;
        if (rosterErr) console.warn("LocationSideBar: roster fetch failed:", rosterErr);

        let finalQuests = [];
        if (questKeys.length) {
          const { data, error } = await supabase.from("quests").select("id, title, status").in("id", questKeys);
          if (error) console.warn("LocationSideBar: quest fetch failed:", error);
          if (Array.isArray(data)) {
            const byId = new Map(data.map((q) => [q.id, q]));
            finalQuests = questKeys.map((id) => byId.get(id)).filter(Boolean);
          }
        }

        if (!alive) return;
        setRosterChars(Array.isArray(rosterData) ? rosterData : []);
        setQuests(finalQuests);
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadDetails();

    return () => {
      alive = false;
    };
  }, [isOpen, location?.id, questKeys, isAdmin]);

  const handleClose = () => {
    try {
      if (typeof window !== "undefined") {
        const el = document.getElementById(offcanvasId);
        const Offcanvas = window?.bootstrap?.Offcanvas;
        if (el && Offcanvas) {
          const inst = Offcanvas.getInstance(el) || new Offcanvas(el);
          inst.hide();
        }
      }
    } catch {
      // ignore
    }

    if (typeof onClose === "function") onClose();
  };

  const townData = useTownData(location, rosterChars, quests);

  const panels = useMemo(
    () => ({
      stories: {
        tone: "amber",
        title: "City stories",
        subtitle: "Rotating city stories that shift every in-game 24 hours.",
        featuredTitle: townData.cityStories?.[0]?.title || "No story",
        featuredText: townData.cityStories?.[0]?.text || "No story available.",
        drawerTone: "drawer-amber",
        drawerTitle: "City stories",
        drawerSubtitle: "Story feed",
        items: townData.cityStories || [],
      },
      people: {
        tone: "cyan",
        title: "Featured people",
        subtitle: "Rotating spotlight NPC; opens into the surfaced list.",
        featuredTitle: townData.people?.[0]?.title || "No person",
        featuredText: townData.people?.[0]?.text || "No featured person available.",
        drawerTone: "drawer-cyan",
        drawerTitle: "Featured people",
        drawerSubtitle: "Surfaced NPCs",
        items: townData.people || [],
      },
      jobs: {
        tone: "emerald",
        title: "Jobs & quest leads",
        subtitle: "Rotating top job; opens into the quest board.",
        featuredTitle: townData.jobLeads?.[0]?.title || "No job",
        featuredText: townData.jobLeads?.[0]?.text || "No job lead available.",
        drawerTone: "drawer-emerald",
        drawerTitle: "Jobs & quest leads",
        drawerSubtitle: "Quest board",
        items: townData.jobLeads || [],
      },
      rumors: {
        tone: "rose",
        title: "Tavern rumors",
        subtitle: "Rotating top rumor; opens into the tavern feed.",
        featuredTitle: townData.rumors?.[0]?.title || "No rumor",
        featuredText: townData.rumors?.[0]?.text || "No rumor available.",
        drawerTone: "drawer-rose",
        drawerTitle: "Tavern rumors",
        drawerSubtitle: "Rumor feed",
        items: townData.rumors || [],
      },
    }),
    [townData]
  );

  if (isOpen === false) return null;

  return (
    <div className="location-sidebar-v2">
      <div className="location-sidebar-v2__header">
        <div className="location-sidebar-v2__titleWrap">
          <div className="location-sidebar-v2__eyebrow">Overview</div>
          <div className="location-sidebar-v2__titleRow">
            <div>
              <div className="location-sidebar-v2__title">{location?.name || "Location"}</div>
              {location?.region ? <div className="location-sidebar-v2__subtitle">{location.region}</div> : null}
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
          {isAdmin && typeof onReload === "function" ? (
            <button type="button" className="btn btn-sm btn-outline-info" onClick={onReload} title="Reload locations">
              Reload
            </button>
          ) : null}
          {isAdmin && typeof onDeleteLocation === "function" ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => onDeleteLocation(location)}
              title="Delete this location"
            >
              Delete
            </button>
          ) : null}
          <button type="button" className="btn btn-sm btn-outline-light" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>

      {loading ? <div className="location-sidebar-v2__loading">Loading town data…</div> : null}

      <section className="summary-banner">
        <div className="summary-banner__kicker">City summary</div>
        <h2 className="summary-banner__headline">Overview can orient the player visually before it asks them to read</h2>
        <p className="summary-banner__body">{townData.summary}</p>
        <div className="summary-banner__stats">
          <BannerStat label="Population" value={townData.stats.population} tone="amber" />
          <BannerStat label="Morale" value={townData.stats.morale} tone="rose" />
          <BannerStat label="Defenses" value={townData.stats.defenses} tone="emerald" />
          <BannerStat label="Mood" value={townData.stats.mood} tone="violet" />
          <BannerStat label="Ruler" value={townData.stats.ruler} tone="cyan" />
          <BannerStat label="Known For" value={townData.stats.knownFor} tone="stone" />
        </div>
      </section>

      <div className="overview-top-grid">
        <SharedDrawer panel={panels[openPanel]} openPanel={openPanel} setOpenPanel={setOpenPanel} />
        <TownMapPanel mapLabels={townData.mapLabels} />
      </div>

      <div className="overview-bottom-grid">
        <CompactTeaser {...panels.stories} active={openPanel === "stories"} onClick={() => setOpenPanel("stories")} />
        <CompactTeaser {...panels.people} active={openPanel === "people"} onClick={() => setOpenPanel("people")} />
        <CompactTeaser {...panels.jobs} active={openPanel === "jobs"} onClick={() => setOpenPanel("jobs")} />
        <CompactTeaser {...panels.rumors} active={openPanel === "rumors"} onClick={() => setOpenPanel("rumors")} />
      </div>

      <style jsx>{`
        .location-sidebar-v2 {
          height: 100%;
          overflow-y: auto;
          background: linear-gradient(180deg, rgba(12, 14, 20, 0.95), rgba(8, 10, 14, 0.98));
          color: #f5f1e8;
          padding: 16px;
        }

        .location-sidebar-v2__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .location-sidebar-v2__eyebrow {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.28em;
          color: #8dd3ff;
          margin-bottom: 4px;
        }

        .location-sidebar-v2__title {
          font-size: 1.9rem;
          font-weight: 700;
          line-height: 1.1;
        }

        .location-sidebar-v2__subtitle {
          color: rgba(255,255,255,0.7);
          font-size: 0.95rem;
          margin-top: 4px;
        }

        .location-sidebar-v2__loading {
          color: rgba(255,255,255,0.7);
          font-size: 0.9rem;
          margin-bottom: 10px;
        }

        .summary-banner {
          border: 1px solid rgba(79, 189, 255, 0.22);
          background: linear-gradient(135deg, rgba(6, 8, 12, 0.95), rgba(20, 18, 16, 0.9));
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 16px;
        }

        .summary-banner__kicker {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.28em;
          color: #8dd3ff;
          margin-bottom: 10px;
        }

        .summary-banner__headline {
          font-size: 1.85rem;
          line-height: 1.15;
          margin: 0 0 10px;
        }

        .summary-banner__body {
          color: rgba(255,255,255,0.78);
          margin: 0 0 16px;
          max-width: 920px;
        }

        .summary-banner__stats {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }

        .overview-top-grid {
          display: grid;
          grid-template-columns: 0.82fr 1.18fr;
          gap: 16px;
          align-items: start;
          margin-bottom: 16px;
        }

        .overview-bottom-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .shared-drawer {
          min-height: 505px;
          border-radius: 24px;
          display: flex;
          flex-direction: column;
          padding: 14px;
        }

        .shared-drawer__head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }

        .shared-drawer__kicker {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.24em;
          color: rgba(255,255,255,0.6);
          margin-bottom: 3px;
        }

        .shared-drawer__title {
          font-size: 1.15rem;
          font-weight: 700;
        }

        .shared-drawer__sub,
        .shared-drawer__meta {
          color: rgba(255,255,255,0.62);
          font-size: 0.82rem;
        }

        .drawer-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
        }

        .drawer-tab {
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(14, 16, 22, 0.88);
          color: rgba(255,255,255,0.78);
          padding: 7px 11px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
        }

        .drawer-tab.is-active {
          border-color: rgba(255,255,255,0.32);
          background: rgba(35, 38, 48, 0.95);
          color: #fff;
        }

        .shared-drawer__list {
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 3px;
        }

        .shared-drawer__item {
          border-radius: 18px;
          padding: 14px;
        }

        .shared-drawer__itemTitle {
          font-size: 0.98rem;
          font-weight: 700;
        }

        .shared-drawer__itemText {
          margin-top: 8px;
          color: rgba(255,255,255,0.78);
          font-size: 0.9rem;
          line-height: 1.45;
        }

        .compact-teaser {
          border-radius: 22px;
          padding: 14px;
          text-align: left;
          width: 100%;
        }

        .compact-teaser__head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .compact-teaser__title {
          font-weight: 700;
        }

        .compact-teaser__sub,
        .compact-teaser__meta {
          font-size: 0.82rem;
          color: rgba(255,255,255,0.62);
        }

        .compact-teaser__featured {
          margin-top: 10px;
          border-radius: 18px;
          padding: 12px;
        }

        .compact-teaser__featuredTitle {
          font-size: 0.92rem;
          font-weight: 700;
        }

        .compact-teaser__featuredText {
          margin-top: 6px;
          color: rgba(255,255,255,0.78);
          font-size: 0.82rem;
          line-height: 1.45;
        }

        .town-map-panel {
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
          background: #090b10;
        }

        .town-map-panel__head {
          padding: 14px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .town-map-panel__kicker {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.22em;
          color: rgba(255,255,255,0.62);
        }

        .town-map-panel__sub {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.78);
          margin-top: 4px;
        }

        .town-map-panel__body {
          padding: 14px;
        }

        .town-map-surface {
          position: relative;
          height: 410px;
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          background: linear-gradient(135deg, rgba(74,58,38,0.92), rgba(40,34,28,0.96));
        }

        .shape {
          position: absolute;
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 14px;
          background: rgba(80, 80, 90, 0.42);
        }

        .shape--rose {
          border-color: rgba(244, 63, 94, 0.35);
          background: rgba(244, 63, 94, 0.12);
        }

        .shape--amber {
          border-color: rgba(245, 158, 11, 0.35);
          background: rgba(245, 158, 11, 0.12);
        }

        .shape--emerald {
          border-color: rgba(16, 185, 129, 0.35);
          background: rgba(16, 185, 129, 0.12);
        }

        .shape--violet {
          border-color: rgba(168, 85, 247, 0.35);
          background: rgba(168, 85, 247, 0.12);
        }

        .shape--cyan {
          border-color: rgba(34, 211, 238, 0.35);
          background: rgba(34, 211, 238, 0.12);
        }

        .shape--stone {
          background: rgba(140, 140, 155, 0.25);
        }

        .shape--river {
          border-radius: 999px;
        }

        .map-label {
          position: absolute;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: #fff;
          background: rgba(7, 8, 12, 0.92);
          border: 1px solid rgba(255,255,255,0.22);
          box-shadow: 0 8px 20px rgba(0,0,0,0.3);
          white-space: nowrap;
        }

        .tone-amber {
          border-color: rgba(245, 158, 11, 0.22);
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(10, 10, 14, 0.9));
        }

        .tone-rose {
          border-color: rgba(244, 63, 94, 0.22);
          background: linear-gradient(135deg, rgba(244, 63, 94, 0.1), rgba(10, 10, 14, 0.9));
        }

        .tone-emerald {
          border-color: rgba(16, 185, 129, 0.22);
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(10, 10, 14, 0.9));
        }

        .tone-violet {
          border-color: rgba(168, 85, 247, 0.22);
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(10, 10, 14, 0.9));
        }

        .tone-cyan {
          border-color: rgba(34, 211, 238, 0.22);
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.1), rgba(10, 10, 14, 0.9));
        }

        .tone-stone {
          border-color: rgba(255,255,255,0.12);
          background: rgba(20, 22, 30, 0.88);
        }

        @media (max-width: 1199px) {
          .summary-banner__stats,
          .overview-top-grid,
          .overview-bottom-grid {
            grid-template-columns: 1fr;
          }

          .shared-drawer {
            min-height: 420px;
          }

          .town-map-surface {
            height: 330px;
          }
        }
      `}</style>
    </div>
  );
}
