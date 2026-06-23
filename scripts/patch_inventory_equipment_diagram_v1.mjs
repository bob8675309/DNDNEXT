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

{
  const rel = "pages/inventory.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    'import ItemCard from "@/components/ItemCard";\nimport OfferTradeButton from "@/components/OfferTradeButton";',
    'import ItemCard from "@/components/ItemCard";\nimport EquipmentDiagram, { EQUIPMENT_SLOTS, inferEquipmentSlot } from "@/components/EquipmentDiagram";\nimport OfferTradeButton from "@/components/OfferTradeButton";',
    "inventory equipment diagram import"
  );

  source = replaceOnce(
    source,
    `  async function toggleEquipped(rowId, nextVal) {\n    if (!canManage && !(isOwnInventory && ownerType === "player")) return;\n\n    const { error } = await supabase.from("inventory_items").update({ is_equipped: nextVal }).eq("id", rowId);\n    if (error) console.error("toggleEquipped", error);\n  }`,
    `  async function toggleEquipped(rowId, nextVal) {\n    if (!canManage && !(isOwnInventory && ownerType === "player")) return;\n\n    const row = rows.find((r) => r.id === rowId);\n    const patch = {\n      is_equipped: nextVal,\n      equip_slot: nextVal ? (row?.equip_slot || inferEquipmentSlot(row, new Set(rows.filter((r) => r.is_equipped && r.id !== rowId).map((r) => r.equip_slot).filter(Boolean)))) : null,\n      updated_at: new Date().toISOString(),\n    };\n\n    const { error } = await supabase.from("inventory_items").update(patch).eq("id", rowId);\n    if (error) console.error("toggleEquipped", error);\n    else await fetchInventory();\n  }\n\n  async function assignEquipSlot(rowId, nextSlot) {\n    if (!canManage && !(isOwnInventory && ownerType === "player")) return;\n    if (!EQUIPMENT_SLOTS.some((slot) => slot.key === nextSlot)) return;\n\n    const { error } = await supabase\n      .from("inventory_items")\n      .update({ is_equipped: true, equip_slot: nextSlot, updated_at: new Date().toISOString() })\n      .eq("id", rowId);\n\n    if (error) console.error("assignEquipSlot", error);\n    else await fetchInventory();\n  }`,
    "inventory equip slot update helpers"
  );

  source = replaceOnce(
    source,
    `        <>\n          <h2 className="h6 mb-3">Inventory</h2>`,
    `        <>\n          <EquipmentDiagram\n            rows={rows}\n            ownerName={ownerMeta?.name || "Character"}\n            canManage={isOwnInventory || canManage}\n            onUnequip={(rowId) => toggleEquipped(rowId, false)}\n          />\n\n          <h2 className="h6 mb-3">Inventory</h2>`,
    "inventory render equipment diagram"
  );

  source = replaceOnce(
    source,
    `                          <button\n                            className={\`btn btn-sm \${row.is_equipped ? "btn-success" : "btn-outline-light"}\`}\n                            onClick={() => toggleEquipped(row.id, !row.is_equipped)}\n                          >\n                            {row.is_equipped ? "Equipped" : "Equip"}\n                          </button>`,
    `                          <button\n                            className={\`btn btn-sm \${row.is_equipped ? "btn-success" : "btn-outline-light"}\`}\n                            onClick={() => toggleEquipped(row.id, !row.is_equipped)}\n                          >\n                            {row.is_equipped ? "Equipped" : "Equip"}\n                          </button>\n\n                          {row.is_equipped ? (\n                            <select\n                              className="form-select form-select-sm equipment-slot-picker"\n                              value={row.equip_slot || inferEquipmentSlot(row)}\n                              onChange={(e) => assignEquipSlot(row.id, e.target.value)}\n                              title="Choose where this item is equipped on the diagram"\n                            >\n                              {EQUIPMENT_SLOTS.map((slot) => (\n                                <option key={slot.key} value={slot.key}>\n                                  {slot.label}\n                                </option>\n                              ))}\n                            </select>\n                          ) : null}`,
    "inventory item equip slot selector"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched inventory equipment diagram UI.");
  }
}

if (changedAny) {
  console.log("Applied inventory equipment diagram patch.");
} else {
  console.log("Inventory equipment diagram patch already current.");
}
