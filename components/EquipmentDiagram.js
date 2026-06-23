import { useMemo, useRef, useState } from "react";
import ItemCard from "./ItemCard";

export const EQUIPMENT_SLOTS = [
  { key: "face", label: "Face", hint: "Goggles, lenses, masks, spectacles", x: 3.8, y: 12, tx: 48, ty: 27 },
  { key: "throat", label: "Throat", hint: "Amulets, badges, collars, necklaces", x: 3.8, y: 24.5, tx: 49, ty: 37 },
  { key: "body", label: "Body", hint: "Armor, robes", x: 3.8, y: 37, tx: 48, ty: 49 },
  { key: "hands", label: "Hands", hint: "Gauntlets, gloves", x: 3.8, y: 49.5, tx: 45, ty: 60 },
  { key: "waist", label: "Waist", hint: "Belts, girdles, sashes", x: 3.8, y: 62, tx: 49, ty: 69 },
  { key: "feet", label: "Feet", hint: "Boots, sandals, shoes, slippers", x: 3.8, y: 74.5, tx: 50, ty: 82 },
  { key: "head", label: "Head", hint: "Circlets, crowns, hats, helmets", x: 73.5, y: 12, tx: 57, ty: 25 },
  { key: "shoulders", label: "Shoulders", hint: "Capes, cloaks, mantles, shawls", x: 73.5, y: 24.5, tx: 58, ty: 37 },
  { key: "torso", label: "Torso", hint: "Shirts, tunics, vests, vestments", x: 73.5, y: 37, tx: 60, ty: 49 },
  { key: "arms", label: "Arms", hint: "Armbands, bracelets, bracers", x: 73.5, y: 49.5, tx: 60, ty: 60 },
  { key: "ring_1", label: "Ring 1", hint: "Ring slot", x: 69, y: 62, tx: 60, ty: 69 },
  { key: "ring_2", label: "Ring 2", hint: "Ring slot", x: 83.8, y: 62, tx: 61, ty: 69 },
  { key: "misc_1", label: "Misc 1", hint: "Potion, scroll, focus, tool", x: 25, y: 87, tx: 45, ty: 81 },
  { key: "misc_2", label: "Misc 2", hint: "Potion, scroll, focus, tool", x: 40.5, y: 87, tx: 47, ty: 81 },
  { key: "weapon_1", label: "Weapon 1", hint: "Weapon, staff, rod, wand, shield", x: 56, y: 87, tx: 56, ty: 78 },
  { key: "weapon_2", label: "Weapon 2", hint: "Off-hand weapon, wand, shield", x: 70.8, y: 87, tx: 58, ty: 78 },
  { key: "weapon_3", label: "Weapon 3", hint: "Backup weapon, shield, focus", x: 85.6, y: 87, tx: 60, ty: 78 },
];

export const EQUIPMENT_SLOT_LABELS = Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot.key, slot.label]));

const WEAPON_SLOTS = ["weapon_1", "weapon_2", "weapon_3"];
const RING_SLOTS = ["ring_1", "ring_2"];
const MISC_SLOTS = ["misc_1", "misc_2"];
const DRAG_MIME = "application/x-dndnext-inventory-id";

function safeStr(value) {
  return String(value ?? "").trim();
}

function itemPayload(row) {
  return {
    ...(row?.card_payload && typeof row.card_payload === "object" ? row.card_payload : {}),
    ...row,
  };
}

function itemName(row) {
  const item = itemPayload(row);
  return safeStr(item.item_name || item.name || row?.item_name || row?.name || "Unnamed Item");
}

function itemRarity(row) {
  const item = itemPayload(row);
  return safeStr(item.item_rarity || item.rarity || "common");
}

function itemBlob(row) {
  const item = itemPayload(row);
  return [
    item.item_name,
    item.name,
    item.item_type,
    item.type,
    item.category,
    item.uiType,
    item.base_type,
    item.item_description,
    item.rarity,
    item.item_rarity,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function firstFree(keys, occupied) {
  return keys.find((key) => !occupied.has(key)) || keys[0];
}

export function inferEquipmentSlot(row, occupied = new Set()) {
  const explicit = safeStr(row?.equip_slot || row?.equipped_slot || itemPayload(row).equip_slot || itemPayload(row).equipped_slot).toLowerCase();
  if (EQUIPMENT_SLOT_LABELS[explicit]) return explicit;

  const blob = itemBlob(row);
  if (/\b(helmet|helm|hat|cap|crown|circlet|headband|phylacter|diadem)\b/.test(blob)) return "head";
  if (/\b(goggles|spectacles|mask|lens|lenses|eye|visor|face)\b/.test(blob)) return "face";
  if (/\b(amulet|necklace|pendant|brooch|collar|medal|medallion|scarab|torc|throat)\b/.test(blob)) return "throat";
  if (/\b(cloak|cape|mantle|shawl|shoulder)\b/.test(blob)) return "shoulders";
  if (/\b(armor|armour|chain mail|chainmail|plate|breastplate|mail|scale mail|leather armor|robe)\b/.test(blob)) return "body";
  if (/\b(shirt|tunic|vest|vestment|torso)\b/.test(blob)) return "torso";
  if (/\b(bracer|bracelet|armband|arms?)\b/.test(blob)) return "arms";
  if (/\b(gauntlet|glove|hands?)\b/.test(blob)) return "hands";
  if (/\b(belt|girdle|sash|waist)\b/.test(blob)) return "waist";
  if (/\b(boot|boots|sandals|shoes|slippers|feet)\b/.test(blob)) return "feet";
  if (/\bring\b/.test(blob)) return firstFree(RING_SLOTS, occupied);
  if (/\b(weapon|sword|axe|ax|mace|staff|wand|rod|bow|crossbow|dagger|spear|shield|greatsword|longsword|shortsword|warhammer|scimitar|rapier)\b/.test(blob)) return firstFree(WEAPON_SLOTS, occupied);
  return firstFree(MISC_SLOTS, occupied);
}

export function assignEquipmentSlots(rows = []) {
  const occupied = new Set();
  const assigned = new Map();

  for (const row of rows.filter((r) => !!r?.is_equipped)) {
    let key = inferEquipmentSlot(row, occupied);
    if (occupied.has(key)) {
      if (key.startsWith("weapon")) key = firstFree(WEAPON_SLOTS, occupied);
      else if (key.startsWith("ring")) key = firstFree(RING_SLOTS, occupied);
      else if (key.startsWith("misc")) key = firstFree(MISC_SLOTS, occupied);
    }

    if (!occupied.has(key)) {
      assigned.set(key, row);
      occupied.add(key);
    } else {
      const fallback = firstFree([...MISC_SLOTS, ...WEAPON_SLOTS], occupied);
      if (!occupied.has(fallback)) {
        assigned.set(fallback, row);
        occupied.add(fallback);
      }
    }
  }

  return assigned;
}

function rarityClass(row) {
  return itemRarity(row).toLowerCase().replace(/\s+/g, "-") || "common";
}

function slotItemLabel(row) {
  const name = itemName(row);
  return name.length > 28 ? `${name.slice(0, 25)}…` : name;
}

function sortRowsForBrowser(rows) {
  return [...rows].sort((a, b) => {
    if (!!b.is_equipped !== !!a.is_equipped) return Number(!!b.is_equipped) - Number(!!a.is_equipped);
    return itemName(a).localeCompare(itemName(b));
  });
}

function equipmentItemForCard(row) {
  const payload = itemPayload(row);
  return { ...payload, card_payload: payload, _invRow: row };
}

function slotLabelForRow(row, fallback = "") {
  const key = safeStr(row?.equip_slot || fallback || inferEquipmentSlot(row)).toLowerCase();
  return EQUIPMENT_SLOT_LABELS[key] || "Unassigned";
}

export default function EquipmentDiagram({
  rows = [],
  ownerName = "Character",
  canManage = false,
  onUnequip,
  onToggleEquip,
  onAssignEquipSlot,
}) {
  const assigned = useMemo(() => assignEquipmentSlots(rows), [rows]);
  const browserRows = useMemo(() => sortRowsForBrowser(rows), [rows]);
  const equippedRows = useMemo(() => rows.filter((row) => !!row.is_equipped), [rows]);
  const [hoverKey, setHoverKey] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [dragState, setDragState] = useState(null);
  const dragHandledRef = useRef(false);

  const hoverRow = hoverKey ? assigned.get(hoverKey) : null;
  const selectedRow = useMemo(() => {
    if (selectedId) {
      const found = rows.find((row) => String(row.id) === String(selectedId));
      if (found) return found;
    }
    return hoverRow || equippedRows[0] || browserRows[0] || null;
  }, [selectedId, rows, hoverRow, equippedRows, browserRows]);

  const filteredRows = useMemo(() => {
    if (filter === "equipped") return browserRows.filter((row) => !!row.is_equipped);
    if (filter === "unequipped") return browserRows.filter((row) => !row.is_equipped);
    if (filter === "magic") {
      return browserRows.filter((row) => !["", "common", "mundane", "none"].includes(itemRarity(row).toLowerCase()));
    }
    return browserRows;
  }, [browserRows, filter]);

  const equippedCount = equippedRows.length;

  function selectRow(row) {
    if (!row?.id) return;
    setSelectedId(row.id);
  }

  function selectedSlotValue(row) {
    if (!row) return "misc_1";
    return safeStr(row.equip_slot || inferEquipmentSlot(row)).toLowerCase() || "misc_1";
  }

  function beginDrag(event, row, originSlot = "") {
    if (!canManage || !row?.id) {
      event.preventDefault();
      return;
    }
    dragHandledRef.current = false;
    setDragState({ rowId: row.id, originSlot });
    setSelectedId(row.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_MIME, String(row.id));
    event.dataTransfer.setData("text/plain", itemName(row));
  }

  function draggedRowFromEvent(event) {
    const rowId = dragState?.rowId || event.dataTransfer.getData(DRAG_MIME);
    if (!rowId) return null;
    return rows.find((row) => String(row.id) === String(rowId)) || null;
  }

  function allowSlotDrop(event) {
    if (!canManage) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function dropOnSlot(event, slot) {
    if (!canManage) return;
    event.preventDefault();
    const row = draggedRowFromEvent(event);
    if (!row?.id) return;
    dragHandledRef.current = true;
    setSelectedId(row.id);
    onAssignEquipSlot?.(row.id, slot.key);
  }

  function endDrag() {
    if (dragState?.originSlot && !dragHandledRef.current) {
      onUnequip?.(dragState.rowId);
    }
    dragHandledRef.current = false;
    setDragState(null);
  }

  return (
    <section className={`equipment-workbench ${dragState?.rowId ? "is-dragging" : ""}`} aria-label={`${ownerName} inventory equipment workbench`}>
      <div className="equipment-workbench__stage-card">
        <header className="equipment-workbench__stage-head">
          <div>
            <div className="equipment-workbench__kicker">Equipment Stage</div>
            <h2>{ownerName || "Character"}</h2>
            <p>Drag items into slots to equip. Drag equipped slot items out to unequip.</p>
          </div>
          <div className="equipment-workbench__summary">{equippedCount} equipped</div>
        </header>

        <div className="equipment-workbench__stage">
          <div className="equipment-workbench__stage-shade" />
          <div className="equipment-workbench__silhouette" aria-hidden="true">
            <span className="equipment-workbench__crown" />
            <span className="equipment-workbench__head" />
            <span className="equipment-workbench__body" />
            <span className="equipment-workbench__arm equipment-workbench__arm--left" />
            <span className="equipment-workbench__arm equipment-workbench__arm--right" />
            <span className="equipment-workbench__leg equipment-workbench__leg--left" />
            <span className="equipment-workbench__leg equipment-workbench__leg--right" />
          </div>

          {EQUIPMENT_SLOTS.map((slot) => {
            const row = assigned.get(slot.key);
            const filled = !!row;
            const isActive = selectedRow?.id && row?.id && String(selectedRow.id) === String(row.id);
            return (
              <button
                key={slot.key}
                type="button"
                className={`equipment-stage-slot equipment-stage-slot--${slot.key} ${filled ? "is-filled" : "is-empty"} ${isActive ? "is-active" : ""} ${dragState?.rowId ? "is-drop-target" : ""} ${filled ? `rarity-${rarityClass(row)}` : ""}`}
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                draggable={canManage && filled}
                onDragStart={(event) => filled ? beginDrag(event, row, slot.key) : event.preventDefault()}
                onDragEnd={endDrag}
                onDragOver={allowSlotDrop}
                onDrop={(event) => dropOnSlot(event, slot)}
                onMouseEnter={() => setHoverKey(slot.key)}
                onMouseLeave={() => setHoverKey((current) => (current === slot.key ? "" : current))}
                onFocus={() => setHoverKey(slot.key)}
                onBlur={() => setHoverKey((current) => (current === slot.key ? "" : current))}
                onClick={() => filled ? selectRow(row) : null}
                title={filled ? `${itemName(row)} — drag out to unequip` : `${slot.hint} — drop item here`}
              >
                <span className="equipment-stage-slot__label">{slot.label}</span>
                <span className="equipment-stage-slot__item">{filled ? slotItemLabel(row) : "Empty"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="equipment-workbench__browser-card">
        <header className="equipment-workbench__panel-head equipment-workbench__panel-head--compact">
          <div className="equipment-workbench__kicker">Backpack</div>
          <span>{rows.length} items</span>
        </header>

        <input className="equipment-workbench__search" value="" readOnly placeholder="Search items, tags, rarity, equipped state…" />

        <div className="equipment-workbench__filters" role="tablist" aria-label="Inventory filters">
          {["all", "equipped", "unequipped", "magic"].map((key) => (
            <button key={key} type="button" className={filter === key ? "is-active" : ""} onClick={() => setFilter(key)}>
              {key === "all" ? "All" : key === "unequipped" ? "Carried" : key[0].toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>

        <div className="equipment-workbench__grid" role="list">
          {filteredRows.map((row) => {
            const isSelected = selectedRow?.id && String(selectedRow.id) === String(row.id);
            return (
              <button
                key={row.id || itemName(row)}
                type="button"
                role="listitem"
                className={`equipment-inventory-card ${row.is_equipped ? "is-equipped" : ""} ${isSelected ? "is-selected" : ""} rarity-${rarityClass(row)}`}
                draggable={canManage}
                onDragStart={(event) => beginDrag(event, row)}
                onDragEnd={endDrag}
                onClick={() => selectRow(row)}
                title={canManage ? `${itemName(row)} — drag to a slot` : itemName(row)}
              >
                <span className="equipment-inventory-card__name">{itemName(row)}</span>
                <span className="equipment-inventory-card__meta">
                  {row.is_equipped ? `${slotLabelForRow(row)} • equipped` : `${itemRarity(row) || "Common"} • carried`}
                </span>
                {row.is_equipped ? <span className="equipment-inventory-card__badge">Equipped</span> : null}
              </button>
            );
          })}
          {!filteredRows.length ? <div className="equipment-workbench__empty">No items match this filter.</div> : null}
        </div>
      </aside>

      <aside className="equipment-workbench__detail-card">
        <header className="equipment-workbench__panel-head equipment-workbench__panel-head--compact">
          <div className="equipment-workbench__kicker">Selected Item</div>
          {selectedRow ? <span>{selectedRow.is_equipped ? slotLabelForRow(selectedRow) : "Carried"}</span> : null}
        </header>

        {selectedRow ? (
          <>
            <div className="equipment-workbench__item-preview card-compact">
              <ItemCard item={equipmentItemForCard(selectedRow)} />
            </div>
            <div className="equipment-workbench__drag-help">
              Drag from Backpack to a slot to equip or move. Drag an equipped slot item out of the stage to unequip.
            </div>
          </>
        ) : (
          <div className="equipment-workbench__empty">No inventory items available.</div>
        )}
      </aside>
    </section>
  );
}
