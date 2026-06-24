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

function replaceBetween(source, start, end, replacement, label) {
  if (source.includes(replacement)) return source;
  const startIndex = source.indexOf(start);
  if (startIndex < 0) {
    console.warn(`${label}: start anchor not found; leaving unchanged.`);
    return source;
  }
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0) {
    console.warn(`${label}: end anchor not found; leaving unchanged.`);
    return source;
  }
  return source.slice(0, startIndex) + replacement + source.slice(endIndex);
}

let changedAny = false;

{
  const rel = "components/NpcPanel.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    'import CharacterSheetPanel from "./CharacterSheetPanel";\nimport ItemCard from "./ItemCard";',
    'import CharacterSheetPanel from "./CharacterSheetPanel";\nimport EquipmentDiagram, { EQUIPMENT_SLOTS, inferEquipmentSlot } from "./EquipmentDiagram";',
    "NpcPanel equipment workbench import"
  );

  source = replaceOnce(
    source,
    '  const [inventoryAccess, setInventoryAccess] = useState({ checked: false, canView: false, canManage: false });\n  const [lastRoll, setLastRoll] = useState(null);',
    '  const [inventoryAccess, setInventoryAccess] = useState({ checked: false, canView: false, canManage: false });\n  const [transferTargets, setTransferTargets] = useState([]);\n  const [lastRoll, setLastRoll] = useState(null);',
    "NpcPanel transfer target state"
  );

  source = replaceOnce(
    source,
    `  useEffect(() => {
    if (!inventoryAccess.checked) return;
    loadInventoryRows();
  }, [inventoryAccess.checked, loadInventoryRows]);`,
    `  useEffect(() => {
    if (!inventoryAccess.checked) return;
    loadInventoryRows();
  }, [inventoryAccess.checked, loadInventoryRows]);

  useEffect(() => {
    let cancelled = false;

    async function loadTransferTargets() {
      if (!inventoryAccess.checked) {
        setTransferTargets([]);
        return;
      }

      const { data, error } = await supabase.rpc("list_item_send_targets_v1");
      if (cancelled) return;

      if (error) {
        console.warn("Failed to load item send targets", error.message || error);
        setTransferTargets([]);
        return;
      }

      setTransferTargets(
        (data || []).map((row) => ({
          key: \`\${row.kind}:\${row.id}\`,
          label: row.name || row.id || "Target",
          group: row.kind === "player" ? "Players" : row.kind === "merchant" ? "Merchants" : "NPCs",
        }))
      );
    }

    loadTransferTargets();
    return () => {
      cancelled = true;
    };
  }, [inventoryAccess.checked]);`,
    "NpcPanel inventory send target loader"
  );

  source = replaceOnce(
    source,
    `  async function toggleEquipped(rowId, nextVal) {
    if (!inventoryAccess.canManage) return;

    const { error } = await supabase.from("inventory_items").update({ is_equipped: nextVal }).eq("id", rowId);
    if (error) {
      alert(error.message || "Failed to update item.");
      return;
    }
    await loadInventoryRows();
  }`,
    `  async function toggleEquipped(rowId, nextVal) {
    if (!inventoryAccess.canManage) return;

    const row = inventoryRows.find((entry) => String(entry.id) === String(rowId));
    const occupied = new Set(
      inventoryRows
        .filter((entry) => entry.is_equipped && String(entry.id) !== String(rowId))
        .map((entry) => entry.equip_slot)
        .filter(Boolean)
    );
    const patch = {
      is_equipped: nextVal,
      equip_slot: nextVal ? (row?.equip_slot || inferEquipmentSlot(row, occupied)) : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("inventory_items").update(patch).eq("id", rowId);
    if (error) {
      alert(error.message || "Failed to update item.");
      return;
    }
    await loadInventoryRows();
  }

  async function assignEquipSlot(rowId, nextSlot) {
    if (!inventoryAccess.canManage) return;
    if (!EQUIPMENT_SLOTS.some((slot) => slot.key === nextSlot)) return;

    const { error } = await supabase
      .from("inventory_items")
      .update({ is_equipped: true, equip_slot: nextSlot, updated_at: new Date().toISOString() })
      .eq("id", rowId);

    if (error) {
      alert(error.message || "Failed to place item.");
      return;
    }
    await loadInventoryRows();
  }

  function parseTargetKey(key) {
    const value = safeStr(key);
    const idx = value.indexOf(":");
    if (idx <= 0) return null;
    const type = value.slice(0, idx);
    const id = value.slice(idx + 1);
    if (!type || !id) return null;
    return { type, id };
  }

  async function transferInventoryItem(rowId, targetKey) {
    const target = parseTargetKey(targetKey);
    if (!target) throw new Error("Choose a target.");

    const { error } = await supabase.rpc("transfer_inventory_item_v1", {
      p_item_id: rowId,
      p_target_type: target.type,
      p_target_id: target.id,
    });

    if (error) throw error;
    await loadInventoryRows();
  }`,
    "NpcPanel inventory equip and transfer helpers"
  );

  const inventoryRenderer = `  function renderInventoryPanel() {
    if (!inventoryAccess.checked || inventoryLoading) {
      return <div className="npc-card"><div className="text-muted">Loading inventory…</div></div>;
    }

    if (!inventoryAccess.canView) {
      return <div className="npc-card"><div className="text-warning">You do not have permission to view this inventory.</div></div>;
    }

    const currentOwnerKey = npcId ? \`\${ownerType}:\${npcId}\` : "";
    const panelTransferTargets = transferTargets.filter((target) => target.key !== currentOwnerKey);

    return (
      <div className="npc-panel-inventory-workbench">
        <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2 px-1">
          <div>
            <div className="fw-semibold">Inventory</div>
            <div className="small text-muted">Manage this character without leaving the map.</div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={loadInventoryRows} disabled={inventoryLoading}>
            Refresh
          </button>
        </div>

        {inventoryErr ? <div className="alert alert-danger py-2">{inventoryErr}</div> : null}

        <EquipmentDiagram
          rows={inventoryRows}
          ownerName={view.name || "Character"}
          canManage={inventoryAccess.canManage}
          canTransfer={inventoryAccess.canManage || isAdmin}
          transferTargets={panelTransferTargets}
          onTransferItem={transferInventoryItem}
          onUnequip={(rowId) => toggleEquipped(rowId, false)}
          onToggleEquip={toggleEquipped}
          onAssignEquipSlot={assignEquipSlot}
        />

        {inventoryHref ? (
          <div className="small text-muted mt-2 px-1">
            Full inventory URL remains available for deep links: <code>{inventoryHref}</code>
          </div>
        ) : null}
      </div>
    );
  }`;

  source = replaceBetween(
    source,
    "  function renderInventoryPanel() {",
    '\n\n  return (\n    <div className="npc-panel-inner">',
    `${inventoryRenderer}\n\n  return (\n    <div className="npc-panel-inner">`,
    "NpcPanel inventory renderer"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched NpcPanel inventory workbench.");
  }
}

{
  const rel = "styles/npc-profile-panel.css";
  let source = read(rel);
  const before = source;

  const css = `

#npcPanel .npc-panel-inventory-workbench {
  min-width: 0;
}

#npcPanel .npc-panel-inventory-workbench .equipment-workbench {
  --eq-top-panel-height: clamp(560px, 52vw, 720px);
  grid-template-columns: minmax(600px, 1.35fr) minmax(160px, 0.28fr) minmax(300px, 0.62fr) !important;
  gap: 0.65rem !important;
  margin: 0 !important;
  max-width: none !important;
}

#npcPanel .npc-panel-inventory-workbench .equipment-workbench__stage-card,
#npcPanel .npc-panel-inventory-workbench .equipment-workbench__browser-card,
#npcPanel .npc-panel-inventory-workbench .equipment-workbench__detail-card {
  min-width: 0 !important;
}

#npcPanel .npc-panel-inventory-workbench .equipment-workbench__stage-head {
  margin-bottom: 0.6rem !important;
}

#npcPanel .npc-panel-inventory-workbench .equipment-workbench__stage {
  min-height: 0 !important;
}

#npcPanel .npc-panel-inventory-workbench .equipment-workbench__drag-help {
  display: none !important;
}

@media (max-width: 1220px) {
  #npcPanel .npc-panel-inventory-workbench .equipment-workbench {
    grid-template-columns: minmax(520px, 1fr) minmax(150px, 0.28fr) minmax(270px, 0.55fr) !important;
  }
}

@media (max-width: 980px) {
  #npcPanel .npc-panel-inventory-workbench .equipment-workbench {
    grid-template-columns: 1fr !important;
  }

  #npcPanel .npc-panel-inventory-workbench .equipment-workbench__browser-card,
  #npcPanel .npc-panel-inventory-workbench .equipment-workbench__detail-card {
    grid-column: auto !important;
  }
}
`;

  if (!source.includes(".npc-panel-inventory-workbench")) {
    source += css;
  }

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched NPC panel inventory workbench CSS.");
  }
}

if (changedAny) {
  console.log("Applied NPC profile inventory workbench patch.");
} else {
  console.log("NPC profile inventory workbench patch already current.");
}
