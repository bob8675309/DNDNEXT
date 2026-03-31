
import { useEffect, useMemo, useRef, useState } from "react";
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

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeItem(item, fallbackKind = "label") {
  return {
    id: item?.id || uid(fallbackKind),
    key: item?.key || item?.id || uid(fallbackKind),
    name: item?.name || item?.label || "New marker",
    x: Number(item?.x ?? 50),
    y: Number(item?.y ?? 50),
    tone: item?.tone || "stone",
    targetPanel: item?.targetPanel || null,
    category: item?.category || null,
    kind: item?.kind || fallbackKind,
    icon: item?.icon || null,
    notes: item?.notes || null,
    isVisible: item?.isVisible !== false,
  };
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

function MapMarker({ item, onPointerDown, onClick, selected }) {
  const style = { left: `${item.x}%`, top: `${item.y}%` };
  if (item.kind === "flag") {
    return (
      <button
        type="button"
        className={`town-flag-marker ${toneClass(item.tone)} ${selected ? "is-selected" : ""}`}
        style={style}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        <span className="town-flag-marker__pin">⚑</span>
        <span className="town-flag-marker__name">{item.name}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`map-label ${toneClass(item.tone)} ${selected ? "is-selected" : ""}`}
      style={style}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {item.name}
    </button>
  );
}

function MapEditorPanel({
  isAdmin,
  editMode,
  setEditMode,
  placeFlagMode,
  setPlaceFlagMode,
  dirty,
  onSave,
  selectedItem,
  onChangeSelected,
  onDeleteSelected,
}) {
  if (!isAdmin) return null;
  return (
    <div className="town-map-editor">
      <div className="town-map-editor__toolbar">
        <button type="button" className={`btn btn-sm ${editMode ? "btn-info" : "btn-outline-info"}`} onClick={() => setEditMode((v) => !v)}>
          {editMode ? "Finish Editing" : "Edit Map"}
        </button>
        <button type="button" className={`btn btn-sm ${placeFlagMode ? "btn-warning" : "btn-outline-warning"}`} onClick={() => setPlaceFlagMode((v) => !v)}>
          {placeFlagMode ? "Cancel Flag Placement" : "Add Flag"}
        </button>
        <button type="button" className="btn btn-sm btn-success" onClick={onSave} disabled={!dirty}>
          Save Map Changes
        </button>
      </div>
      <div className="town-map-editor__hint">
        Edit mode lets you drag baked-in labels. Add Flag lets you click a point on the map to drop a temporary or semi-permanent marker players can see.
      </div>
      {selectedItem ? (
        <div className="town-map-editor__card">
          <div className="town-map-editor__cardTitle">Selected {selectedItem.kind === "flag" ? "flag" : "label"}</div>
          <div className="town-map-editor__grid">
            <label className="town-map-editor__field">
              <span>Name</span>
              <input className="form-control form-control-sm" value={selectedItem.name || ""} onChange={(e) => onChangeSelected({ name: e.target.value })} />
            </label>
            <label className="town-map-editor__field">
              <span>Tone</span>
              <select className="form-select form-select-sm" value={selectedItem.tone || "stone"} onChange={(e) => onChangeSelected({ tone: e.target.value })}>
                <option value="stone">Stone</option>
                <option value="amber">Amber</option>
                <option value="rose">Rose</option>
                <option value="emerald">Emerald</option>
                <option value="violet">Violet</option>
                <option value="cyan">Cyan</option>
              </select>
            </label>
            {selectedItem.kind === "label" ? (
              <label className="town-map-editor__field town-map-editor__field--wide">
                <span>Drawer target</span>
                <select className="form-select form-select-sm" value={selectedItem.targetPanel || ""} onChange={(e) => onChangeSelected({ targetPanel: e.target.value || null })}>
                  <option value="">None</option>
                  <option value="stories">City stories</option>
                  <option value="people">Featured people</option>
                  <option value="jobs">Jobs & quest leads</option>
                  <option value="rumors">Tavern rumors</option>
                </select>
              </label>
            ) : (
              <label className="town-map-editor__field town-map-editor__field--wide">
                <span>Notes</span>
                <input className="form-control form-control-sm" value={selectedItem.notes || ""} onChange={(e) => onChangeSelected({ notes: e.target.value })} />
              </label>
            )}
          </div>
          <div className="town-map-editor__coords">X {selectedItem.x.toFixed(1)} • Y {selectedItem.y.toFixed(1)}</div>
          {selectedItem.kind === "flag" ? (
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDeleteSelected}>Delete Flag</button>
          ) : null}
        </div>
      ) : (
        <div className="town-map-editor__card town-map-editor__card--empty">Select a label or flag to rename it, retone it, or change its drawer target.</div>
      )}
    </div>
  );
}

function TownMapPanel({
  mapImage,
  labels,
  flags,
  isAdmin,
  editMode,
  placeFlagMode,
  setOpenPanel,
  selectedId,
  setSelectedId,
  onMoveItem,
  onAddFlag,
}) {
  const surfaceRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    function handleMove(e) {
      if (!dragRef.current || !surfaceRef.current) return;
      const rect = surfaceRef.current.getBoundingClientRect();
      const clientX = e.touches?.[0]?.clientX ?? e.clientX;
      const clientY = e.touches?.[0]?.clientY ?? e.clientY;
      const x = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(2, Math.min(98, ((clientY - rect.top) / rect.height) * 100));
      onMoveItem(dragRef.current.kind, dragRef.current.id, { x, y });
    }
    function handleUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [onMoveItem]);

  function beginDrag(kind, item, e) {
    if (!isAdmin || !editMode) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind, id: item.id };
    setSelectedId(item.id);
  }

  function handleSurfaceClick(e) {
    if (!(isAdmin && placeFlagMode) || !surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAddFlag({ x, y });
  }

  const backgroundStyle = mapImage
    ? { backgroundImage: `linear-gradient(180deg, rgba(9, 11, 16, 0.18), rgba(9, 11, 16, 0.44)), url(${mapImage})` }
    : undefined;

  return (
    <div className="town-map-panel">
      <div className="town-map-panel__head">
        <div className="town-map-panel__kicker">Interactive city layout</div>
        <div className="town-map-panel__sub">Editable baked-in labels plus player-visible flags for temporary discoveries.</div>
      </div>
      <div className="town-map-panel__body">
        <div
          ref={surfaceRef}
          className={`town-map-surface ${mapImage ? "has-town-image" : ""} ${placeFlagMode ? "is-placing-flag" : ""}`}
          style={backgroundStyle}
          onClick={handleSurfaceClick}
        >
          {!mapImage ? (
            <>
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
            </>
          ) : null}
          {labels.filter((item) => item.isVisible !== false).map((item) => (
            <MapMarker
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onPointerDown={(e) => beginDrag("label", item, e)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedId(item.id);
                if (!(isAdmin && editMode) && item.targetPanel) setOpenPanel(item.targetPanel);
              }}
            />
          ))}
          {flags.filter((item) => item.isVisible !== false).map((item) => (
            <MapMarker
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onPointerDown={(e) => beginDrag("flag", item, e)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedId(item.id);
              }}
            />
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

export default function TownSheet({
  location,
  rosterChars = [],
  quests = [],
  backHref = "/map",
  isAdmin = false,
  storedLabels = [],
  storedFlags = [],
  onSaveMapData,
}) {
  const townData = useMemo(() => buildTownData(location, rosterChars, quests), [location, rosterChars, quests]);
  const [openPanel, setOpenPanel] = useState("stories");
  const [editMode, setEditMode] = useState(false);
  const [placeFlagMode, setPlaceFlagMode] = useState(false);
  const [labels, setLabels] = useState([]);
  const [flags, setFlags] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextLabels = (storedLabels?.length ? storedLabels : townData.mapLabels || []).map((item) => normalizeItem(item, "label"));
    const nextFlags = (storedFlags || []).map((item) => normalizeItem(item, "flag"));
    setLabels(nextLabels);
    setFlags(nextFlags);
    setSelectedId(null);
  }, [storedLabels, storedFlags, townData.mapLabels]);

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

  const selectedItem = useMemo(() => labels.find((x) => x.id === selectedId) || flags.find((x) => x.id === selectedId) || null, [labels, flags, selectedId]);

  const dirty = useMemo(() => true, [labels, flags]);

  function updateSelected(patch) {
    if (!selectedItem) return;
    const setter = selectedItem.kind === "flag" ? setFlags : setLabels;
    setter((prev) => prev.map((item) => (item.id === selectedItem.id ? { ...item, ...patch } : item)));
  }

  function moveItem(kind, id, patch) {
    const setter = kind === "flag" ? setFlags : setLabels;
    setter((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addFlag({ x, y }) {
    const next = normalizeItem({ id: uid("flag"), name: "New Flag", x, y, tone: "amber", kind: "flag" }, "flag");
    setFlags((prev) => [...prev, next]);
    setSelectedId(next.id);
    setPlaceFlagMode(false);
  }

  function deleteSelected() {
    if (!selectedItem || selectedItem.kind !== "flag") return;
    setFlags((prev) => prev.filter((item) => item.id !== selectedItem.id));
    setSelectedId(null);
  }

  async function handleSave() {
    if (!onSaveMapData) return;
    setSaving(true);
    try {
      await onSaveMapData({ labels, flags });
      if (typeof window !== "undefined") window.alert("Town map changes saved.");
    } catch (err) {
      console.error("TownSheet save failed", err);
      if (typeof window !== "undefined") window.alert(`Failed to save town map changes: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  }

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
        <div className="town-sheet-grid-top__drawerCol">
          <SharedDrawer panel={panels[openPanel]} openPanel={openPanel} setOpenPanel={setOpenPanel} />
          <MapEditorPanel
            isAdmin={isAdmin}
            editMode={editMode}
            setEditMode={setEditMode}
            placeFlagMode={placeFlagMode}
            setPlaceFlagMode={setPlaceFlagMode}
            dirty={dirty && !saving}
            onSave={handleSave}
            selectedItem={selectedItem}
            onChangeSelected={updateSelected}
            onDeleteSelected={deleteSelected}
          />
        </div>
        <TownMapPanel
          mapImage={townData.mapImage}
          labels={labels}
          flags={flags}
          isAdmin={isAdmin}
          editMode={editMode}
          placeFlagMode={placeFlagMode}
          setOpenPanel={setOpenPanel}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          onMoveItem={moveItem}
          onAddFlag={addFlag}
        />
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
