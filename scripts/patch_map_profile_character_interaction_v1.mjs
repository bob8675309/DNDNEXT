import fs from "node:fs";
import path from "node:path";

const rel = "components/MapPageClient.js";
const file = path.join(process.cwd(), rel);
let source = fs.readFileSync(file, "utf8");
const before = source;

function replaceRequired(beforeText, afterText, label) {
  if (source.includes(afterText)) return;
  const count = source.split(beforeText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(beforeText, afterText);
}

function requireToken(token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

function requireAbsent(token, label) {
  if (source.includes(token)) throw new Error(`${label}: forbidden ${token}`);
}

replaceRequired(
  'const NpcPanel = dynamic(() => import("./NpcPanel"), { ssr: false });',
  'const CharacterInteractionPanel = dynamic(() => import("./character/CharacterInteractionPanel"), { ssr: false });',
  "Map profile CharacterInteractionPanel dynamic import"
);

replaceRequired(
  `            <NpcPanel
              key={selNpc?.id || "npc"}
              npc={selNpc}
              isAdmin={isAdmin}
              locations={locs}
              onClose={() => {
                setSelNpc(null);
                hideOffcanvas("npcPanel");
                router.replace(
                  { pathname: router.pathname, query: nextQuery(router, { npc: null }) },
                  undefined,
                  { shallow: true }
                );
              }}
              onOpenDrawer={(id) => {
                setLocationDrawerDefaultTab("npcs");
                setLocationDrawerOpen(true);
                if (id) setFocusNpcInDrawerId(id);
              }}
              onBrowseWares={(row) => {
                const id = row?.id;
                if (!id) return;
                // Use the row we already have (may come from LocationSideBar), but fall back to map merchants if needed.
                const m = row || (merchants || []).find((r) => String(r.id) === String(id)) || null;
                if (!m) return;
                setSelMerchant(m);
                showExclusiveOffcanvas("merchantPanel");
                router.replace(
                  { pathname: router.pathname, query: nextQuery(router, { merchant: m.id, npc: id, location: null }) },
                  undefined,
                  { shallow: true }
                );
              }}
            />`,
  `            <CharacterInteractionPanel
              key={selNpc?.id || "npc"}
              character={{
                ...(selNpc || {}),
                kind: selNpc?.kind || selNpc?.type || (selNpc?.inventory || selNpc?.storefront_enabled ? "merchant" : undefined),
              }}
              isAdmin={isAdmin}
              locations={locs}
              onClose={() => {
                setSelNpc(null);
                hideOffcanvas("npcPanel");
                router.replace(
                  { pathname: router.pathname, query: nextQuery(router, { npc: null }) },
                  undefined,
                  { shallow: true }
                );
              }}
              onOpenDrawer={(id) => {
                setLocationDrawerDefaultTab("npcs");
                setLocationDrawerOpen(true);
                if (id) setFocusNpcInDrawerId(id);
              }}
              onBrowseWares={(row) => {
                const id = row?.id;
                if (!id) return;
                // Use the row we already have (may come from LocationSideBar), but fall back to map merchants if needed.
                const m = row || (merchants || []).find((r) => String(r.id) === String(id)) || null;
                if (!m) return;
                setSelMerchant(m);
                showExclusiveOffcanvas("merchantPanel");
                router.replace(
                  { pathname: router.pathname, query: nextQuery(router, { merchant: m.id, npc: id, location: null }) },
                  undefined,
                  { shallow: true }
                );
              }}
            />`,
  "Map profile panel renders shared CharacterInteractionPanel"
);

for (const token of [
  'const CharacterInteractionPanel = dynamic(() => import("./character/CharacterInteractionPanel"), { ssr: false });',
  '<CharacterInteractionPanel',
  'character={{',
  'kind: selNpc?.kind || selNpc?.type || (selNpc?.inventory || selNpc?.storefront_enabled ? "merchant" : undefined)',
  'onClose={() => {',
  'showExclusiveOffcanvas("merchantPanel");',
]) requireToken(token, "Map profile CharacterInteractionPanel patch");

for (const token of [
  'const NpcPanel = dynamic(() => import("./NpcPanel"), { ssr: false });',
  '<NpcPanel\n              key={selNpc?.id || "npc"}',
]) requireAbsent(token, "Map profile CharacterInteractionPanel patch");

if (source !== before) {
  fs.writeFileSync(file, source, "utf8");
  console.log("Patched map NPC profile panel to use CharacterInteractionPanel.");
} else {
  console.log("Map NPC profile panel already uses CharacterInteractionPanel.");
}
