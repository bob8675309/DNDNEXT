
import { useMemo, useState } from "react";
import Link from "next/link";
import { buildTownData } from "../utils/townData";

function toneClass(tone) {
  switch (tone) {
    case "amber": return "tone-amber";
    case "rose": return "tone-rose";
    case "emerald": return "tone-emerald";
    case "violet": return "tone-violet";
    case "cyan": return "tone-cyan";
    default: return "tone-stone";
  }
}

function BannerStat({ label, value, tone = "stone" }) {
  return (
    <div className={`town-banner-stat ${toneClass(tone)}`}>
      <div className="town-banner-stat__label">{label}</div>
      <div className="town-banner-stat__value">{value}</div>
    </div>
  );
}

function SharedDrawer({ panel, openPanel, setOpenPanel }) {
  const tabs = [
    ["stories", "City stories"],
    ["people", "Featured people"],
    ["jobs", "Jobs & quest leads"],
    ["rumors", "Tavern rumors"],
  ];
  return (
    <div className={`town-shared-drawer ${toneClass(panel.tone)}`}>
      <div className="town-shared-drawer__head">
        <div>
          <div className="town-shared-drawer__kicker">Shared drawer</div>
          <div className="town-shared-drawer__title">{panel.drawerTitle}</div>
          <div className="town-shared-drawer__sub">{panel.drawerSubtitle}</div>
        </div>
        <div className="town-shared-drawer__meta">Scrollable</div>
      </div>
      <div className="town-drawer-tabs">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setOpenPanel(id)} className={`town-drawer-tab ${openPanel === id ? "is-active" : ""}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="town-shared-drawer__list">
        {panel.items.map((item) => (
          <div key={item.title} className={`town-drawer-item ${toneClass(panel.tone)}`}>
            <div className="town-drawer-item__title">{item.title}</div>
            <div className="town-drawer-item__text">{item.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
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
            <div key={m.label} className={`map-label ${toneClass(m.tone)}`} style={{ left: `${m.x}%`, top: `${m.y}%` }}>{m.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompactTeaser({ title, subtitle, featuredTitle, featuredText, tone = "amber", active = false, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`town-compact-teaser ${toneClass(tone)} ${active ? "is-active" : ""}`}>
      <div className="town-compact-teaser__head">
        <div>
          <div className="town-compact-teaser__title">{title}</div>
          <div className="town-compact-teaser__sub">{subtitle}</div>
        </div>
        <div className="town-compact-teaser__meta">{active ? "open" : "view"}</div>
      </div>
      <div className={`town-compact-teaser__featured ${toneClass(tone)}`}>
        <div className="town-compact-teaser__featuredTitle">{featuredTitle}</div>
        <div className="town-compact-teaser__featuredText">{featuredText}</div>
      </div>
    </button>
  );
}

export default function TownSheet({ location, rosterChars = [], quests = [], backHref = "/map" }) {
  const townData = useMemo(() => buildTownData(location, rosterChars, quests), [location, rosterChars, quests]);
  const [openPanel, setOpenPanel] = useState("stories");
  const panels = useMemo(() => ({
    stories: {
      tone: "amber",
      title: "City stories",
      subtitle: "Rotating city stories that shift every in-game 24 hours.",
      featuredTitle: townData.cityStories?.[0]?.title || "No story",
      featuredText: townData.cityStories?.[0]?.text || "No story available.",
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
      drawerTitle: "Tavern rumors",
      drawerSubtitle: "Rumor feed",
      items: townData.rumors || [],
    },
  }), [townData]);

  return (
    <div className="town-sheet-page">
      <div className="town-sheet-page__topbar">
        <Link href={backHref} className="btn btn-outline-light btn-sm">Back to Map</Link>
        <div className="town-sheet-page__titleWrap">
          <div className="town-sheet-page__eyebrow">Town Sheet</div>
          <h1 className="town-sheet-page__title">{location?.name || "Town"}</h1>
        </div>
      </div>

      <section className="town-summary-banner">
        <div className="town-summary-banner__kicker">City summary</div>
        <h2 className="town-summary-banner__headline">Overview can orient the player visually before it asks them to read</h2>
        <p className="town-summary-banner__body">{townData.summary}</p>
        <div className="town-summary-banner__stats">
          <BannerStat label="Population" value={townData.stats.population} tone="amber" />
          <BannerStat label="Morale" value={townData.stats.morale} tone="rose" />
          <BannerStat label="Defenses" value={townData.stats.defenses} tone="emerald" />
          <BannerStat label="Mood" value={townData.stats.mood} tone="violet" />
          <BannerStat label="Ruler" value={townData.stats.ruler} tone="cyan" />
          <BannerStat label="Known For" value={townData.stats.knownFor} tone="stone" />
        </div>
      </section>

      <div className="town-sheet-grid-top">
        <SharedDrawer panel={panels[openPanel]} openPanel={openPanel} setOpenPanel={setOpenPanel} />
        <TownMapPanel mapLabels={townData.mapLabels} />
      </div>

      <div className="town-sheet-grid-bottom">
        <CompactTeaser {...panels.stories} active={openPanel === "stories"} onClick={() => setOpenPanel("stories")} />
        <CompactTeaser {...panels.people} active={openPanel === "people"} onClick={() => setOpenPanel("people")} />
        <CompactTeaser {...panels.jobs} active={openPanel === "jobs"} onClick={() => setOpenPanel("jobs")} />
        <CompactTeaser {...panels.rumors} active={openPanel === "rumors"} onClick={() => setOpenPanel("rumors")} />
      </div>
    </div>
  );
}
