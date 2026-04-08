import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { buildTownData } from "../utils/townData";
import styles from "./TownSheet.module.scss";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function toneKey(tone) {
  switch (tone) {
    case "amber":
      return styles.toneAmber;
    case "rose":
      return styles.toneRose;
    case "emerald":
      return styles.toneEmerald;
    case "violet":
      return styles.toneViolet;
    case "cyan":
      return styles.toneCyan;
    default:
      return styles.toneStone;
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
    <div className={cls(styles.bannerStat, toneKey(tone))}>
      <div className={styles.eyebrow}>{label}</div>
      <div className={styles.bannerValue}>{value}</div>
    </div>
  );
}

function CompactTeaser({ kicker, title, subtitle, featured, tone, active, onOpen }) {
  return (
    <button
      type="button"
      className={cls(styles.teaserCard, toneKey(tone), active && styles.teaserCardActive)}
      onClick={onOpen}
    >
      <div className={styles.teaserHead}>
        <div>
          <div className={styles.eyebrow}>{kicker}</div>
          <div className={styles.teaserTitle}>{title}</div>
          <div className={styles.muted}>{subtitle}</div>
        </div>
        <div className={styles.teaserMeta}>{active ? "open" : "view"}</div>
      </div>
      {featured ? (
        <div className={cls(styles.teaserFeatured, toneKey(tone))}>
          <div className={styles.drawerItemTitle}>{featured.title}</div>
          <div className={styles.drawerItemText}>{featured.text}</div>
        </div>
      ) : null}
    </button>
  );
}

function DrawerTabs({ openPanel, setOpenPanel }) {
  const tabs = [
    ["stories", "City stories"],
    ["people", "Featured people"],
    ["jobs", "Jobs & quest leads"],
    ["rumors", "Tavern rumors"],
  ];

  return (
    <div className={styles.drawerTabs}>
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={cls(styles.drawerTab, openPanel === id && styles.drawerTabActive)}
          onClick={() => setOpenPanel(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SharedDrawerContent({ panel }) {
  return (
    <div className={styles.drawerItems}>
      {(panel.items || []).map((item, idx) => (
        <div key={`${item.title}-${idx}`} className={cls(styles.drawerItem, toneKey(panel.tone))}>
          <div className={styles.drawerItemTitle}>{item.title}</div>
          <div className={styles.drawerItemText}>{item.text}</div>
        </div>
      ))}
    </div>
  );
}

function AdminDrawer({
  dirty,
  editMode,
  setEditMode,
  labels,
  selectedItem,
  onSelect,
  onChangeSelected,
  onDeleteSelected,
  onBeginDiscoveryPlacement,
  onSave,
  mapToolsOpen,
  setMapToolsOpen,
  mapImage,
  onReplaceMap,
  onDeleteMap,
  imageMeta,
}) {
  return (
    <div className={styles.adminStack}>
      <section className={styles.adminCard}>
        <div className={styles.adminCardHead}>
          <div>
            <div className={styles.adminCardTitle}>City layout map editor</div>
            <div className={styles.muted}>Map labels and discoveries live in the shared drawer when admin tools are on.</div>
          </div>
          <button
            type="button"
            className={cls(styles.toggle, editMode && styles.toggleOn)}
            onClick={() => setEditMode((v) => !v)}
            aria-pressed={editMode}
            title="Toggle edit mode"
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>

        <div className={styles.adminActions}>
          <button type="button" className="btn btn-sm btn-outline-warning" onClick={onBeginDiscoveryPlacement}>
            Add Discovery
          </button>
          <button type="button" className="btn btn-sm btn-warning" onClick={onSave} disabled={!dirty}>
            Save Changes
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
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
                  className={selectedItem?.id === item.id ? styles.selectedRow : ""}
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
          <div className={styles.formGrid}>
            <label className={styles.formField}>
              <span>Name</span>
              <input className="form-control form-control-sm" value={selectedItem.name || ""} onChange={(e) => onChangeSelected({ name: e.target.value })} />
            </label>
            <label className={styles.formField}>
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
            <label className={styles.formField}>
              <span>Type</span>
              <select className="form-select form-select-sm" value={selectedItem.labelType || "location"} onChange={(e) => onChangeSelected({ labelType: e.target.value })}>
                <option value="location">Location</option>
                <option value="discovery">Discovery</option>
              </select>
            </label>
            <label className={styles.formField}>
              <span>Drawer target</span>
              <select className="form-select form-select-sm" value={selectedItem.targetPanel || ""} onChange={(e) => onChangeSelected({ targetPanel: e.target.value || null })}>
                <option value="">None</option>
                <option value="stories">City stories</option>
                <option value="people">Featured people</option>
                <option value="jobs">Jobs & quest leads</option>
                <option value="rumors">Tavern rumors</option>
              </select>
            </label>
            <label className={cls(styles.formField, styles.formFieldWide)}>
              <span>Notes</span>
              <input className="form-control form-control-sm" value={selectedItem.notes || ""} onChange={(e) => onChangeSelected({ notes: e.target.value })} />
            </label>
            <div className={cls(styles.coordText, styles.formFieldWide)}>X {selectedItem.x.toFixed(1)} • Y {selectedItem.y.toFixed(1)}</div>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDeleteSelected}>
              Delete Label
            </button>
          </div>
        ) : null}
      </section>

      <section className={styles.adminCard}>
        <div className={styles.adminCardHead}>
          <div>
            <div className={styles.adminCardTitle}>Map tools</div>
            <div className={styles.muted}>Replace or clear the town image without leaving the drawer.</div>
          </div>
          <button
            type="button"
            className={cls(styles.toggle, mapToolsOpen && styles.toggleOn)}
            onClick={() => setMapToolsOpen((v) => !v)}
            aria-pressed={mapToolsOpen}
            title="Toggle map tools"
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>

        {mapToolsOpen ? (
          <div className={styles.mapTools}>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDeleteMap}>
              Delete Map
            </button>
            <label className={styles.uploadBox}>
              <span>Drop a new map image or click to browse.</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onReplaceMap} />
            </label>
            <div className={styles.metaText}>
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
  );
}

function SharedDrawer({ panel, openPanel, setOpenPanel, adminToolsVisible, adminDrawerProps }) {
  const title = adminToolsVisible ? "City layout map editor" : panel.drawerTitle;
  const subtitle = adminToolsVisible
    ? "Editing controls live here so the map and drawer remain two clean equal-height panes."
    : panel.drawerSubtitle;

  return (
    <div className={cls(styles.drawerPane, adminToolsVisible && styles.drawerPaneAdmin)}>
      <div className={styles.drawerHead}>
        <div>
          <div className={styles.eyebrow}>Shared drawer</div>
          <div className={styles.drawerTitle}>{title}</div>
          <div className={styles.muted}>{subtitle}</div>
        </div>
        <div className={styles.drawerMeta}>{adminToolsVisible ? "admin tools" : "one open at a time"}</div>
      </div>

      {!adminToolsVisible ? <DrawerTabs openPanel={openPanel} setOpenPanel={setOpenPanel} /> : null}

      <div className={styles.drawerScroll}>
        {adminToolsVisible ? <AdminDrawer {...adminDrawerProps} /> : <SharedDrawerContent panel={panel} />}
      </div>
    </div>
  );
}

function MapLabel({ item, selected, onPointerDown, onClick }) {
  return (
    <button
      type="button"
      className={cls(styles.mapLabel, toneKey(item.tone), selected && styles.mapLabelSelected)}
      style={{ left: `${item.x}%`, top: `${item.y}%` }}
      onPointerDown={onPointerDown}
      onClick={onClick}
      title={item.notes || item.name}
    >
      {item.labelType === "discovery" ? <span className={styles.mapLabelFlag}>⚑</span> : null}
      <span>{item.name}</span>
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
    <div className={styles.mapPane}>
      <div className={styles.mapHead}>
        <div>
          <div className={styles.eyebrow}>Interactive city layout</div>
          <div className={styles.muted}>Map-first overview with editable overlays and player-visible discoveries.</div>
        </div>
        {isAdmin ? (
          <button
            type="button"
            className={cls(styles.adminToggle, adminToolsVisible && styles.adminToggleOn)}
            onClick={() => setAdminToolsVisible((v) => !v)}
            aria-pressed={adminToolsVisible}
          >
            <span className={styles.adminToggleLabel}>Show Admin Tools</span>
            <span className={cls(styles.toggle, adminToolsVisible && styles.toggleOn)}>
              <span className={styles.toggleKnob} />
            </span>
          </button>
        ) : null}
      </div>

      <div className={styles.mapBody}>
        <div
          ref={surfaceRef}
          className={cls(styles.mapSurface, mapImage && styles.mapSurfaceHasImage, placingDiscovery && styles.mapSurfacePlacing)}
          style={backgroundStyle}
          onClick={handleMapClick}
        >
          {!mapImage ? <div className={styles.emptyText}>No stored town map yet. Upload one from map tools.</div> : null}

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
          <div className={styles.metaText}>Stored natural size: {imageNaturalSize.width} × {imageNaturalSize.height}</div>
        ) : null}
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
  const [adminToolsVisible, setAdminToolsVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [placingDiscovery, setPlacingDiscovery] = useState(false);
  const [mapToolsOpen, setMapToolsOpen] = useState(true);
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
    setAdminToolsVisible(true);
  }

  async function handleSave() {
    if (typeof onSaveMapData !== "function") return;
    await onSaveMapData({ labels });
    setDirty(false);
  }

  const adminDrawerProps = {
    dirty,
    editMode,
    setEditMode,
    labels,
    selectedItem,
    onSelect: setSelectedId,
    onChangeSelected: handleChangeSelected,
    onDeleteSelected: handleDeleteSelected,
    onBeginDiscoveryPlacement: () => setPlacingDiscovery((v) => !v),
    onSave: handleSave,
    mapToolsOpen,
    setMapToolsOpen,
    mapImage: mapImageUrl,
    onReplaceMap: onReplaceMapImage,
    onDeleteMap: onDeleteMapImage,
    imageMeta: imageNaturalSize,
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <Link href={backHref || "/map"} className="btn btn-sm btn-outline-light">
          Back to Map
        </Link>
        <div>
          <div className={styles.eyebrow}>Town sheet</div>
          <h1 className={styles.pageTitle}>{location?.name || "Town"}</h1>
        </div>
      </div>

      <section className={styles.summaryBanner}>
        <div className={styles.eyebrow}>City summary</div>
        <h2 className={styles.summaryHeadline}>Overview can orient the player visually before it asks them to read</h2>
        <p className={styles.summaryBody}>{townData.summary}</p>
        <div className={styles.summaryStats}>
          {stats.map(([label, value, tone]) => (
            <BannerStat key={label} label={label} value={value} tone={tone} />
          ))}
        </div>
      </section>

      <section className={styles.topPaneRow}>
        <SharedDrawer
          panel={activePanel}
          openPanel={openPanel}
          setOpenPanel={setOpenPanel}
          adminToolsVisible={adminToolsVisible}
          adminDrawerProps={adminDrawerProps}
        />
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
      </section>

      <section className={styles.teaserGrid}>
        <CompactTeaser
          kicker="City stories"
          title={panels.stories.teaserTitle}
          subtitle={panels.stories.teaserSubtitle}
          featured={featured.stories}
          tone={panels.stories.tone}
          active={openPanel === "stories" && !adminToolsVisible}
          onOpen={() => {
            setAdminToolsVisible(false);
            setOpenPanel("stories");
          }}
        />
        <CompactTeaser
          kicker="Featured people"
          title={panels.people.teaserTitle}
          subtitle={panels.people.teaserSubtitle}
          featured={featured.people}
          tone={panels.people.tone}
          active={openPanel === "people" && !adminToolsVisible}
          onOpen={() => {
            setAdminToolsVisible(false);
            setOpenPanel("people");
          }}
        />
        <CompactTeaser
          kicker="Jobs & quest leads"
          title={panels.jobs.teaserTitle}
          subtitle={panels.jobs.teaserSubtitle}
          featured={featured.jobs}
          tone={panels.jobs.tone}
          active={openPanel === "jobs" && !adminToolsVisible}
          onOpen={() => {
            setAdminToolsVisible(false);
            setOpenPanel("jobs");
          }}
        />
        <CompactTeaser
          kicker="Tavern rumors"
          title={panels.rumors.teaserTitle}
          subtitle={panels.rumors.teaserSubtitle}
          featured={featured.rumors}
          tone={panels.rumors.tone}
          active={openPanel === "rumors" && !adminToolsVisible}
          onOpen={() => {
            setAdminToolsVisible(false);
            setOpenPanel("rumors");
          }}
        />
      </section>
    </div>
  );
}
