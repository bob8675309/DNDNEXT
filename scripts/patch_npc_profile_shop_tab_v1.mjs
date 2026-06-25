import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function write(rel, source) {
  fs.writeFileSync(path.join(process.cwd(), rel), source, "utf8");
}

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) {
    console.warn(`${label}: expected one match, found ${count}; leaving unchanged.`);
    return source;
  }
  return source.replace(before, after);
}

let changedAny = false;

// -----------------------------------------------------------------------------
// CharacterSheetPanel: let Store use an in-panel action just like Profile.
// -----------------------------------------------------------------------------
{
  const rel = "components/CharacterSheetPanel.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    '  storeHref = null,\n  storeText = "Store",',
    '  storeHref = null,\n  onOpenStore = null,\n  storeText = "Store",',
    "CharacterSheetPanel onOpenStore prop"
  );

  source = replaceOnce(
    source,
    `          {storeHref ? (
            <a
              className="btn btn-sm me-2"
              href={storeHref}
              target="_blank"
              rel="noreferrer"
              title="Open this character's storefront"
              style={{ backgroundColor: "#12c6ff", border: "0", color: "#001019" }}
            >
              {storeText}
            </a>
          ) : null}`,
    `          {typeof onOpenStore === "function" ? (
            <button
              type="button"
              className="btn btn-sm me-2"
              onClick={onOpenStore}
              title="Open this character's storefront"
              style={{ backgroundColor: "#12c6ff", border: "0", color: "#001019" }}
            >
              {storeText}
            </button>
          ) : storeHref ? (
            <a
              className="btn btn-sm me-2"
              href={storeHref}
              target="_blank"
              rel="noreferrer"
              title="Open this character's storefront"
              style={{ backgroundColor: "#12c6ff", border: "0", color: "#001019" }}
            >
              {storeText}
            </a>
          ) : null}`,
    "CharacterSheetPanel store action"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched CharacterSheetPanel store action.");
  }
}

// -----------------------------------------------------------------------------
// NpcPanel: add a first-class Shop tab and render MerchantPanel inside it.
// -----------------------------------------------------------------------------
{
  const rel = "components/NpcPanel.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    'import CharacterSheetPanel from "./CharacterSheetPanel";\nimport PortraitPickerModal from "./PortraitPickerModal";',
    'import CharacterSheetPanel from "./CharacterSheetPanel";\nimport MerchantPanel from "./MerchantPanel";\nimport PortraitPickerModal from "./PortraitPickerModal";',
    "NpcPanel MerchantPanel import"
  );

  source = replaceOnce(
    source,
    'export default function NpcPanel({ npc, isAdmin = false, locations = [], onClose, onOpenDrawer, onBrowseWares }) {',
    'export default function NpcPanel({ npc, isAdmin = false, locations = [], onClose, onOpenDrawer, onBrowseWares, initialView = "profile" }) {',
    "NpcPanel initialView prop"
  );

  source = replaceOnce(
    source,
    '  const [activeView, setActiveView] = useState("profile");',
    '  const [activeView, setActiveView] = useState(initialView || "profile");',
    "NpcPanel initial active view"
  );

  source = replaceOnce(
    source,
    `  const npcId = npc?.id || null;

  useEffect(() => {`,
    `  const npcId = npc?.id || null;

  useEffect(() => {
    const next = initialView || "profile";
    setActiveView(next === "shop" ? "shop" : next === "inventory" ? "inventory" : next === "sheet" ? "sheet" : "profile");
  }, [npcId, initialView]);

  useEffect(() => {`,
    "NpcPanel sync initialView"
  );

  source = replaceOnce(
    source,
    `  const ownerType = ownerTypeFor(fullNpc || npc, npc);

  useEffect(() => {`,
    `  const ownerType = ownerTypeFor(fullNpc || npc, npc);
  const isMerchantView = String((fullNpc || npc)?.kind || (fullNpc || npc)?.type || "").toLowerCase() === "merchant";

  useEffect(() => {`,
    "NpcPanel merchant view flag"
  );

  source = replaceOnce(
    source,
    `  function renderInventoryPanel() {`,
    `  function renderShopPanel() {
    if (!isMerchantView) {
      return <div className="npc-card"><div className="text-muted">This character does not have a storefront.</div></div>;
    }

    return (
      <div className="npc-panel-shop-view">
        <MerchantPanel
          merchant={view}
          isAdmin={isAdmin}
          locations={locations}
          onBackToProfile={() => setActiveView("profile")}
        />
      </div>
    );
  }

  function renderInventoryPanel() {`,
    "NpcPanel renderShopPanel"
  );

  source = replaceOnce(
    source,
    `              <button type="button" className={\`btn ${activeView === "profile" ? "btn-primary" : "btn-outline-light"}\`} onClick={() => setActiveView("profile")}>Profile</button>
              <button type="button" className={\`btn ${activeView === "sheet" ? "btn-primary" : "btn-outline-light"}\`} onClick={() => setActiveView("sheet")}>Sheet & Rolls</button>
              <button type="button" className={\`btn ${activeView === "inventory" ? "btn-primary" : "btn-outline-light"}\`} onClick={() => setActiveView("inventory")}>Inventory</button>`,
    `              <button type="button" className={\`btn ${activeView === "profile" ? "btn-primary" : "btn-outline-light"}\`} onClick={() => setActiveView("profile")}>Profile</button>
              <button type="button" className={\`btn ${activeView === "sheet" ? "btn-primary" : "btn-outline-light"}\`} onClick={() => setActiveView("sheet")}>Sheet & Rolls</button>
              <button type="button" className={\`btn ${activeView === "inventory" ? "btn-primary" : "btn-outline-light"}\`} onClick={() => setActiveView("inventory")}>Inventory</button>
              {isMerchantView ? <button type="button" className={\`btn ${activeView === "shop" ? "btn-primary" : "btn-outline-light"}\`} onClick={() => setActiveView("shop")}>Shop</button> : null}`,
    "NpcPanel shop tab button"
  );

  source = replaceOnce(
    source,
    `      ) : activeView === "inventory" ? (
        <div className="npc-panel-body d-block">
          {renderInventoryPanel()}
        </div>
      ) : (`,
    `      ) : activeView === "inventory" ? (
        <div className="npc-panel-body d-block">
          {renderInventoryPanel()}
        </div>
      ) : activeView === "shop" ? (
        <div className="npc-panel-body d-block">
          {renderShopPanel()}
        </div>
      ) : (`,
    "NpcPanel shop branch"
  );

  source = replaceOnce(
    source,
    `                {String(view.kind || "").toLowerCase() === "merchant" ? (
                  <button type="button" className="btn btn-sm btn-warning" onClick={() => { if (npcId) onBrowseWares?.(view); }}>Let me browse your wares.</button>
                ) : null}`,
    `                {isMerchantView ? (
                  <button type="button" className="btn btn-sm btn-warning" onClick={() => setActiveView("shop")}>Let me browse your wares.</button>
                ) : null}`,
    "NpcPanel wares button opens shop tab"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched NpcPanel in-panel shop tab.");
  }
}

// -----------------------------------------------------------------------------
// NPC page generated profile overlay: let Profile and Store choose the starting tab.
// This runs after patch_npc_page_profile_layout_v1, which creates profilePanelOpen.
// -----------------------------------------------------------------------------
{
  const rel = "pages/npcs.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    '  const [profilePanelOpen, setProfilePanelOpen] = useState(false);',
    '  const [profilePanelOpen, setProfilePanelOpen] = useState(false);\n  const [profilePanelInitialView, setProfilePanelInitialView] = useState("profile");',
    "NPC page profile initial view state"
  );

  source = replaceOnce(
    source,
    '                       onOpenProfile={() => setProfilePanelOpen(true)}',
    '                       onOpenProfile={() => { setProfilePanelInitialView("profile"); setProfilePanelOpen(true); }}',
    "NPC page profile opens profile tab"
  );

  source = replaceOnce(
    source,
    '                       storeHref={selected?.type === "merchant" && selected?.id && selected?.storefront_enabled ? `/map?merchant=${selected.id}` : null}',
    '                       storeHref={selected?.type === "merchant" && selected?.id && selected?.storefront_enabled ? `/map?merchant=${selected.id}` : null}\n                       onOpenStore={selected?.type === "merchant" && selected?.id && selected?.storefront_enabled ? () => { setProfilePanelInitialView("shop"); setProfilePanelOpen(true); } : null}',
    "NPC page store opens profile shop tab"
  );

  source = replaceOnce(
    source,
    `            onClose={() => setProfilePanelOpen(false)}
            onOpenDrawer={() => {}}
            onBrowseWares={(merchant) => {
              if (merchant?.id) window.location.href = \`/map?merchant=\${encodeURIComponent(merchant.id)}\`;
            }}
          />`,
    `            initialView={profilePanelInitialView}
            onClose={() => setProfilePanelOpen(false)}
            onOpenDrawer={() => {}}
            onBrowseWares={() => setProfilePanelInitialView("shop")}
          />`,
    "NPC page passes profile initial tab"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched NPC page Store button to open in-panel shop.");
  }
}

if (changedAny) {
  console.log("Applied NPC profile shop tab patch.");
} else {
  console.log("NPC profile shop tab patch already current.");
}
