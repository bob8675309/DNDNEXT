import { useMemo, useState } from "react";
import ItemCard from "./ItemCard";

export const EQUIPMENT_SLOTS = [
  { key: "face", label: "Face", hint: "Goggles, lenses, masks, spectacles", x: 7, y: 15 },
  { key: "throat", label: "Throat", hint: "Amulets, badges, collars, necklaces", x: 7, y: 29 },
  { key: "body", label: "Body", hint: "Armor, robes", x: 7, y: 43 },
  { key: "hands", label: "Hands", hint: "Gauntlets, gloves", x: 7, y: 57 },
  { key: "waist", label: "Waist", hint: "Belts, girdles, sashes", x: 7, y: 71 },
  { key: "feet", label: "Feet", hint: "Boots, sandals, shoes, slippers", x: 7, y: 85 },
  { key: "head", label: "Head", hint: "Circlets, crowns, hats, helmets", x: 74, y: 15 },
  { key: "shoulders", label: "Shoulders", hint: "Capes, cloaks, mantles, shawls", x: 74, y: 29 },
  { key: "torso", label: "Torso", hint: "Shirts, tunics, vests, vestments", x: 74, y: 43 },
  { key: "arms", label: "Arms", hint: "Armbands, bracelets, bracers", x: 74, y: 57 },
  { key: "ring_1", label: "Ring 1", hint: "Ring slot", x: 74, y: 71 },
  { key: "ring_2", label: "Ring 2", hint: "Ring slot", x: 84, y: 71 },
  { key: "weapon_1", label: "Weapon 1", hint: "Weapon, staff, rod, wand, shield", x: 70, y: 86 },
  { key: "weapon_2", label: "Weapon 2", hint: "Off-hand weapon, wand, shield", x: 80, y: 86 },
  { key: "weapon_3", label: "Weapon 3", hint: "Backup weapon, shield, focus", x: 90, y: 86 },
  { key: "misc_1", label: "Misc 1", hint: "Potion, scroll, focus, tool", x: 28, y: 86 },
  { key: "misc_2", label: "Misc 2", hint: "Potion, scroll, focus, tool", x: 38, y: 86 },
];

export const EQUIPMENT_SLOT_LABELS = Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot.key, slot.label]));

const WEAPON_SLOTS = ["weapon_1", "weapon_2", "weapon_3"];
const RING_SLOTS = ["ring_1", "ring_2"];
const MISC_SLOTS = ["misc_1", "misc_2"];

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
  const item = itemPayload(row);
  return safeStr(item.item_rarity || item.rarity || "common").toLowerCase().replace(/\s+/g, "-") || "common";
}

export default function EquipmentDiagram({ rows = [], ownerName = "Character", canManage = false, onUnequip }) {
  const [hoverKey, setHoverKey] = useState("");
  const assigned = useMemo(() => assignEquipmentSlots(rows), [rows]);
  const hoverRow = hoverKey ? assigned.get(hoverKey) : null;
  const equippedCount = useMemo(() => rows.filter((row) => !!row.is_equipped).length, [rows]);

  return (
    <section className="equipment-diagram" aria-label={`${ownerName} equipped gear diagram`}>
      <div className="equipment-diagram__shade" />
      <header className="equipment-diagram__header">
        <div>
          <div className="equipment-diagram__kicker">Equipment Loadout</div>
          <h2>{ownerName || "Character"}</h2>
        </div>
        <div className="equipment-diagram__summary">{equippedCount} equipped</div>
      </header>

      <div className="equipment-diagram__silhouette" aria-hidden="true">
        <span className="equipment-diagram__head" />
        <span className="equipment-diagram__body" />
        <span className="equipment-diagram__arm equipment-diagram__arm--left" />
        <span className="equipment-diagram__arm equipment-diagram__arm--right" />
        <span className="equipment-diagram__leg equipment-diagram__leg--left" />
        <span className="equipment-diagram__leg equipment-diagram__leg--right" />
      </div>

      {EQUIPMENT_SLOTS.map((slot) => {
        const row = assigned.get(slot.key);
        const filled = !!row;
        return (
          <div
            key={slot.key}
            className={`equipment-slot equipment-slot--${slot.key} ${filled ? "is-filled" : "is-empty"} ${filled ? `rarity-${rarityClass(row)}` : ""}`}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            onMouseEnter={() => setHoverKey(slot.key)}
            onMouseLeave={() => setHoverKey((current) => (current === slot.key ? "" : current))}
            onFocus={() => setHoverKey(slot.key)}
            onBlur={() => setHoverKey((current) => (current === slot.key ? "" : current))}
            tabIndex={0}
            title={filled ? itemName(row) : slot.hint}
          >
            <span className="equipment-slot__label">{slot.label}</span>
            <span className="equipment-slot__item">{filled ? itemName(row) : "Empty"}</span>
          </div>
        );
      })}

      <aside className="equipment-hover-card" aria-live="polite">
        {hoverRow ? (
          <>
            <div className="equipment-hover-card__label">Hovered slot</div>
            <div className="equipment-hover-card__card card-compact">
              <ItemCard item={{ ...itemPayload(hoverRow), card_payload: itemPayload(hoverRow), _invRow: hoverRow }} />
            </div>
            {canManage ? (
              <button type="button" className="btn btn-sm btn-outline-warning mt-2" onClick={() => onUnequip?.(hoverRow.id)}>
                Unequip
              </button>
            ) : null}
          </>
        ) : (
          <div className="equipment-hover-card__empty">Hover a filled slot to inspect the item.</div>
        )}
      </aside>
    </section>
  );
}
