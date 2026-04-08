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

function normalizeOverlayItem(item, fallbackType = "location") {
  return {
    id: item?.id || uid(fallbackType),
    key: item?.key || item?.id || uid(fallbackType),
    name: item?.name || item?.label || "New label",
    x: Number(item?.x ?? 50),
    y: Number(item?.y ?? 50),
    tone: item?.tone || (fallbackType === "discovery" ? "amber" : "stone"),
    targetPanel: item?.targetPanel || item?.target_panel || null,
    category: item?.category || null,
    labelType: item?.labelType || item?.label_type || fallbackType,
    notes: item?.notes || null,
    isVisible: item?.isVisible !== false && item?.is_visible !== false,
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

function CompactTeaser({ kicker, title, subtitle, featured, tone, active, onOpen }) {
  return (
    <button type="button" className={`town-compact-teaser ${toneClass(tone)} ${active ? "is-active" : ""}`} onClick={onOpen}>
      <div className="town-compact-teaser__head">
        <div>
          <div className="town-compact-teaser__kicker">{kicker}</div>
          <div className="town-compact-teaser__title">{title}</div>
          <div className="town-compact-teaser__sub">{subtitle}</div>
        </div>
        <div className="town-compact-teaser__meta">{active ? "open" : "view"}</div>
      </div>
      {featured ? (
        <div className={`town-compact-teaser__featured ${toneClass(tone)}`}>
          <div className="town-compact-teaser__featuredTitle">{featured.title}</div>
          <div className="town-compact-teaser__featuredText">{featured.text}</div>
        </div>
      ) : null}
    </button>
  );
}

function SharedDrawer({
  panel,
  openPanel,
  setOpenPanel,
  isAdmin = false,
  adminToolsVisible = false,
  editMode,
  setEditMode,
  saveEnabled,
  onSave,
  labels,
  selectedItem,
  onSelect,
  onChangeSelected,
  onDeleteSelected,
  onBeginDiscoveryPlacement,
  mapToolsOpen,
  setMapToolsOpen,
  mapImage,
  onReplaceMap,
  onDeleteMap,
  imageMeta,
  placingDiscovery,
}) {
  const tabs = [
    ["stories", "City stories"],
    ["people", "Featured people"],
    ["jobs", "Jobs & quest leads"],
    ["rumors", "Tavern rumors"],
  ];

  if (isAdmin && adminToolsVisible) {
    return (
      <div className={`town-shared-drawer town-shared-drawer--admin ${toneClass(panel.tone)}`}>
        <div className="town-shared-drawer__head">
          <div>
            <div className="town-shared-drawer__kicker">Shared drawer</div>
            <div className="town-shared-drawer__title">City layout editor</div>
            <div className="town-shared-drawer__sub">
              Admin mode is active. Map editor menus now live here instead of opening beside the map.
            </div>
          </div>
          <div className="town-shared-drawer__meta">admin mode</div>
        </div>

        <div className="town-shared-drawer__modeRow">
          <button type="button" className="town-drawer-modeBadge is-active">Layout editor</button>
          <button
            type="button"
            className={`town-admin-toggle ${editMode ? "is-on" : "is-off"}`}
            onClick={() => setEditMode((v) => !v)}
            title="Toggle edit mode"
          >
            <span className="town-admin-toggle__knob" />
          </button>
        </div>

        <div className="town-shared-drawer__scroll">
          <section className="town-admin-card town-admin-card--drawer">
            <div className="town-admin-card__head">
              <div>
                <div className="town-admin-card__title">Edit Map Labels</div>
                <div className="town-admin-card__sub">
                  Select a label to edit it. The table scrolls inside the drawer instead of stretching the page.
                </div>
              </div>
            </div>

            <div className="town-admin-tableWrap">
              <table className="town-admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>X</th>
                    <th>Y</th>
                    <th>Tone</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {labels.map((item) => (
                    <tr
                      key={item.id}
                      className={selectedItem?.id === item.id ? "is-selected" : ""}
                      onClick={() => onSelect(item.id)}
                    >
                      <td>{item.name}</td>
                      <td>{Math.round(item.x)}</td>
                      <td>{Math.round(item.y)}</td>
                      <td>{item.tone}</td>
                      <td>{item.labelType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedItem ? (
              <div className="town-admin-editForm">
                <label>
                  <span>Name</span>
                  <input className="form-control form-control-sm" value={selectedItem.name || ""} onChange={(e) => onChangeSelected({ name: e.target.value })} />
                </label>
                <label>
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
                <label>
                  <span>Type</span>
                  <select className="form-select form-select-sm" value={selectedItem.labelType || "location"} onChange={(e) => onChangeSelected({ labelType: e.target.value })}>
                    <option value="location">Location</option>
                    <option value="discovery">Discovery</option>
                  </select>
                </label>
                <label>
                  <span>Drawer target</span>
                  <select className="form-select form-select-sm" value={selectedItem.targetPanel || ""} onChange={(e) => onChangeSelected({ targetPanel: e.target.value || null })}>
                    <option value="">None</option>
                    <option value="stories">City stories</option>
                    <option value="people">Featured people</option>
                    <option value="jobs">Jobs & quest leads</option>
                    <option value="rumors">Tavern rumors</option>
                  </select>
                </label>
                <label className="town-admin-editForm__wide">
                  <span>Notes</span>
                  <input className="form-control form-control-sm" value={selectedItem.notes || ""} onChange={(e) => onChangeSelected({ notes: e.target.value })} />
                </label>
                <div className="town-admin-editForm__coords">
                  X {selectedItem.x.toFixed(1)} • Y {selectedItem.y.toFixed(1)}
                  {placingDiscovery ? " • Click the map to place the new discovery" : ""}
                </div>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDeleteSelected}>Delete Label</button>
              </div>
            ) : (
              <div className="town-admin-card__sub town-admin-emptyHint">
                Select a label from the table to edit it.
              </div>
            )}
          </section>

          <section className="town-admin-card town-admin-card--drawer">
            <div className="town-admin-card__head">
              <div>
                <div className="town-admin-card__title">Map Tools</div>
                <div className="town-admin-card__sub">Replace, delete, and preview the base map image.</div>
              </div>
              <button
                type="button"
                className={`town-admin-toggle ${mapToolsOpen ? "is-on" : "is-off"}`}
                onClick={() => setMapToolsOpen((v) => !v)}
              >
                <span className="town-admin-toggle__knob" />
              </button>
            </div>

            {mapToolsOpen ? (
              <div className="town-admin-mapTools">
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDeleteMap}>Delete Map</button>
                <label className="town-admin-upload">
                  <span>Drop a new map image or click to browse.</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onReplaceMap} />
                </label>
                <div className="town-admin-mapMeta">
                  {mapImage ? (
                    <>
                      <div>Current map is stored in Supabase.</div>
                      <div>Natural size: {imageMeta?.width || "?"} × {imageMeta?.height || "?"}</div>
                    </>
                  ) : (
                    <div>No stored map image for this town yet.</div>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <div className="town-shared-drawer__footer town-shared-drawer__footer--admin">
          <button type="button" className="btn btn-sm btn-outline-warning" onClick={onBeginDiscoveryPlacement}>
            {placingDiscovery ? "Placing Discovery…" : "Add Discovery"}
          </button>
          <button type="button" className="btn btn-sm btn-warning" onClick={onSave} disabled={!saveEnabled}>
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`town-shared-drawer ${toneClass(panel.tone)}`}>
      <div className="town-shared-drawer__head">
        <div>
          <div className="town-shared-drawer__kicker">Shared drawer</div>
          <div className="town-shared-drawer__title">{panel.drawerTitle}</div>
          <div className="town-shared-drawer__sub">{panel.drawerSubtitle}</div>
        </div>
        <div className="town-shared-drawer__meta">one open at a time</div>
      </div>

      <div className="town-shared-drawer__body">
        <div className="town-drawer-tabs">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`town-drawer-tab ${openPanel === id ? "is-active" : ""}`}
              onClick={() => setOpenPanel(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="town-shared-drawer__list">
          {(panel.items || []).map((item, idx) => (
            <div key={`${item.title}-${idx}`} className={`town-drawer-item ${toneClass(panel.tone)}`}>
              <div className="town-drawer-item__title">{item.title}</div>
              <div className="town-drawer-item__text">{item.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapLabel({ item, selected, onPointerDown, onClick }) {
  return (
    <button
      type="button"
      className={`town-map-label ${toneClass(item.tone)} ${selected ? "is-selected" : ""}`}
      style={{ left: `${item.x}%`, top: `${item.y}%` }}
      onPointerDown={onPointerDown}
      onClick={onClick}
      title={item.notes || item.name}
    >
      {item.labelType === "discovery" ? <span className="town-map-label__flag">⚑</span> : null}
      <span className="town-map-label__text">{item.name}</span>
    </button>
  );
}

function TownMapPanel({
  mapImage,
  imageNaturalSize,
  labels,
  isAdmin,
  editMode,
  placingDiscovery,
  selectedId,
  setSelectedId,
  onMoveItem,
  onAddDiscovery,
  onOpenPanel,
  adminToolsVisible,
  setAdminToolsVisible,
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
      onMoveItem(dragRef.current.id, { x, y });
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

  function beginDrag(item, e) {
    if (!(isAdmin && editMode)) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { id: item.id };
    setSelectedId(item.id);
  }

  function handleMapClick(e) {
    if (!(isAdmin && placingDiscovery) || !surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100));
    onAddDiscovery({ x, y });
  }

  const backgroundStyle = mapImage
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(9,11,16,0.14), rgba(9,11,16,0.28)), url(${mapImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  return (
    <div className="town-map-paneWrap">
      <div className="town-map-panel">
        <div className="town-map-panel__head town-map-panel__head--withToggle">
          <div>
            <div className="town-map-panel__kicker">Interactive city layout</div>
            <div className="town-map-panel__sub">Map-first overview with editable overlays and player-visible discoveries.</div>
          </div>
          {isAdmin ? (
            <div className="town-map-panel__adminToggleWrap">
              <span className="town-map-panel__adminToggleLabel">Show Admin Tools</span>
              <button
                type="button"
                className={`town-admin-toggle ${adminToolsVisible ? "is-on" : "is-off"}`}
                onClick={() => setAdminToolsVisible((v) => !v)}
              >
                <span className="town-admin-toggle__knob" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="town-map-panel__body">
          <div
            ref={surfaceRef}
            className={`town-map-surface ${mapImage ? "has-town-image" : ""} ${placingDiscovery ? "is-placing-discovery" : ""}`}
            style={backgroundStyle}
            onClick={handleMapClick}
          >
            {!mapImage ? <div className="town-map-surface__empty">No stored town map yet. Upload one from Map Tools.</div> : null}

            {labels.filter((item) => item.isVisible !== false).map((item) => (
              <MapLabel
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onPointerDown={(e) => beginDrag(item, e)}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedId(item.id);
                  if (item.labelType === "location" && item.targetPanel) onOpenPanel(item.targetPanel);
                }}
              />
            ))}
          </div>
          {imageNaturalSize?.width && imageNaturalSize?.height ? (
            <div className="town-map-panel__meta">Stored natural size: {imageNaturalSize.width} × {imageNaturalSize.height}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function TownSheet({
  location,
  rosterChars,
  quests,
  backHref,
  isAdmin = false,
  storedLabels = [],
  onSaveMapData,
  mapImageUrl,
  imageNaturalSize,
  onReplaceMapImage,
  onDeleteMapImage,
}) {
  const townData = useMemo(() => buildTownData(location, rosterChars, quests), [location, rosterChars, quests]);
  const [openPanel, setOpenPanel] = useState("people");
  const [labels, setLabels] = useState(() => {
    const src = storedLabels?.length ? storedLabels : townData.mapLabels || [];
    return src.map((item) => normalizeOverlayItem(item, item?.labelType || item?.label_type || "location"));
  });
  const [selectedId, setSelectedId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [placingDiscovery, setPlacingDiscovery] = useState(false);
  const [mapToolsOpen, setMapToolsOpen] = useState(true);
  const [adminToolsVisible, setAdminToolsVisible] = useState(false);
  const prevStoredKey = useMemo(() => JSON.stringify(storedLabels || []), [storedLabels]);

  useEffect(() => {
    const src = storedLabels?.length ? storedLabels : townData.mapLabels || [];
    setLabels(src.map((item) => normalizeOverlayItem(item, item?.labelType || item?.label_type || "location")));
    setDirty(false);
  }, [prevStoredKey, townData.mapLabels]);

  const stats = [
    ["Population", townData.stats.population, "amber"],
    ["Morale", townData.stats.morale, "rose"],
    ["Defenses", townData.stats.defenses, "emerald"],
    ["Mood", townData.stats.mood, "violet"],
    ["Ruler", townData.stats.ruler, "cyan"],
    ["Known for", townData.stats.knownFor, "stone"],
  ];

  const panels = {
    stories: {
      tone: "amber",
      drawerTitle: "City stories",
      drawerSubtitle: "Rotating city stories that shift every in-game 24 hours.",
      teaserTitle: "City stories",
      teaserSubtitle: "Rotating top city story; opens into the broader story feed",
      items: townData.cityStories,
    },
    people: {
      tone: "cyan",
      drawerTitle: "Featured people",
      drawerSubtitle: "Surfaced NPCs and notable figures players should recognize.",
      teaserTitle: "Featured people",
      teaserSubtitle: "Rotating spotlight NPC; opens into the surfaced list",
      items: townData.people,
    },
    jobs: {
      tone: "emerald",
      drawerTitle: "Jobs & quest leads",
      drawerSubtitle: "Rotating job board with expandable quest hooks.",
      teaserTitle: "Jobs & quest leads",
      teaserSubtitle: "Rotating top job; opens into the quest board",
      items: townData.jobLeads,
    },
    rumors: {
      tone: "rose",
      drawerTitle: "Tavern rumors",
      drawerSubtitle: "Rotating top rumor; opens into the tavern feed.",
      teaserTitle: "Tavern rumors",
      teaserSubtitle: "Rotating top rumor; opens into the tavern feed",
      items: townData.rumors,
    },
  };

  const activePanel = panels[openPanel] || panels.people;
  const featured = {
    stories: townData.cityStories?.[0],
    people: townData.people?.[0],
    jobs: townData.jobLeads?.[0],
    rumors: townData.rumors?.[0],
  };
  const selectedItem = labels.find((item) => item.id === selectedId) || null;

  function updateItem(id, patch) {
    setLabels((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setDirty(true);
  }

  function handleChangeSelected(patch) {
    if (!selectedItem) return;
    updateItem(selectedItem.id, patch);
  }

  function handleDeleteSelected() {
    if (!selectedItem) return;
    setLabels((prev) => prev.filter((item) => item.id !== selectedItem.id));
    setSelectedId(null);
    setDirty(true);
  }

  function handleAddDiscovery(pos) {
    const next = normalizeOverlayItem({
      id: uid("discovery"),
      key: uid("discovery-key"),
      name: "New Discovery",
      x: pos.x,
      y: pos.y,
      tone: "amber",
      labelType: "discovery",
      notes: "",
    }, "discovery");
    setLabels((prev) => [...prev, next]);
    setSelectedId(next.id);
    setDirty(true);
    setPlacingDiscovery(false);
    setEditMode(true);
  }

  async function handleSave() {
    if (typeof onSaveMapData !== "function") return;
    await onSaveMapData({ labels });
    setDirty(false);
  }

  return (
    <div className="town-sheet-page">
      <div className="town-sheet-page__topbar">
        <Link href={backHref || "/map"} className="btn btn-sm btn-outline-light">Back to Map</Link>
        <div>
          <div className="town-sheet-page__eyebrow">Town sheet</div>
          <h1 className="town-sheet-page__title">{location?.name || "Town"}</h1>
        </div>
      </div>

      <section className="town-summary-banner">
        <div className="town-summary-banner__kicker">City summary</div>
        <h2 className="town-summary-banner__headline">Overview can orient the player visually before it asks them to read</h2>
        <p className="town-summary-banner__body">{townData.summary}</p>
        <div className="town-summary-banner__stats">
          {stats.map(([label, value, tone]) => <BannerStat key={label} label={label} value={value} tone={tone} />)}
        </div>
      </section>

      <section className="town-sheet-workspace town-sheet-workspace--mapPopout town-sheet-workspace--drawerAdmin">
        <div className="town-sheet-main town-sheet-main--full">
          <div className="town-sheet-grid-top target-layout town-sheet-grid-top--locked">
            <div className="town-sheet-grid-top__drawerCol town-sheet-grid-top__drawerCol--wide">
              <SharedDrawer
                panel={activePanel}
                openPanel={openPanel}
                setOpenPanel={setOpenPanel}
                isAdmin={isAdmin}
                adminToolsVisible={adminToolsVisible}
                editMode={editMode}
                setEditMode={setEditMode}
                saveEnabled={dirty}
                onSave={handleSave}
                labels={labels}
                selectedItem={selectedItem}
                onSelect={setSelectedId}
                onChangeSelected={handleChangeSelected}
                onDeleteSelected={handleDeleteSelected}
                onBeginDiscoveryPlacement={() => setPlacingDiscovery((v) => !v)}
                mapToolsOpen={mapToolsOpen}
                setMapToolsOpen={setMapToolsOpen}
                mapImage={mapImageUrl}
                onReplaceMap={onReplaceMapImage}
                onDeleteMap={onDeleteMapImage}
                imageMeta={imageNaturalSize}
                placingDiscovery={placingDiscovery}
              />
            </div>
            <TownMapPanel
              mapImage={mapImageUrl || townData.mapImage || null}
              imageNaturalSize={imageNaturalSize}
              labels={labels}
              isAdmin={isAdmin}
              editMode={editMode}
              placingDiscovery={placingDiscovery}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              onMoveItem={(id, patch) => updateItem(id, patch)}
              onAddDiscovery={handleAddDiscovery}
              onOpenPanel={setOpenPanel}
              adminToolsVisible={adminToolsVisible}
              setAdminToolsVisible={setAdminToolsVisible}
            />
          </div>

          <div className="town-sheet-grid-bottom town-sheet-grid-bottom--expanded town-sheet-grid-bottom--stable">
            <CompactTeaser
              kicker="City stories"
              title={panels.stories.teaserTitle}
              subtitle={panels.stories.teaserSubtitle}
              featured={featured.stories}
              tone={panels.stories.tone}
              active={openPanel === "stories"}
              onOpen={() => setOpenPanel("stories")}
            />
            <CompactTeaser
              kicker="Featured people"
              title={panels.people.teaserTitle}
              subtitle={panels.people.teaserSubtitle}
              featured={featured.people}
              tone={panels.people.tone}
              active={openPanel === "people"}
              onOpen={() => setOpenPanel("people")}
            />
            <CompactTeaser
              kicker="Jobs & quest leads"
              title={panels.jobs.teaserTitle}
              subtitle={panels.jobs.teaserSubtitle}
              featured={featured.jobs}
              tone={panels.jobs.tone}
              active={openPanel === "jobs"}
              onOpen={() => setOpenPanel("jobs")}
            />
            <CompactTeaser
              kicker="Tavern rumors"
              title={panels.rumors.teaserTitle}
              subtitle={panels.rumors.teaserSubtitle}
              featured={featured.rumors}
              tone={panels.rumors.tone}
              active={openPanel === "rumors"}
              onOpen={() => setOpenPanel("rumors")}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
