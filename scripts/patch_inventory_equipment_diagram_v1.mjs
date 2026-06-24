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
    `      // Apply what we have from direct SELECTs.
      setPlayers(pRows);
      setNpcs(cRows.filter((r) => r.kind === "npc"));
      setMerchants(cRows.filter((r) => r.kind === "merchant"));`,
    `      // Apply what we have from direct SELECTs. Admins keep the full browser lists.
      setPlayers(pRows);
      setNpcs(cRows.filter((r) => r.kind === "npc"));
      setMerchants(cRows.filter((r) => r.kind === "merchant"));

      // Normal players can only SELECT their own players row through RLS, so use a
      // SECURITY DEFINER target-list RPC for item sending. This keeps the admin
      // inventory browser unchanged while giving players legal send targets.
      if (!admin) {
        try {
          const { data: sendRows, error: sendErr } = await supabase.rpc("list_item_send_targets_v1");
          if (sendErr) throw sendErr;
          const all = sendRows || [];
          setPlayers(all.filter((r) => r.kind === "player").map((r) => ({ user_id: r.id, name: r.name })));
          setNpcs(all.filter((r) => r.kind === "npc").map((r) => ({ id: r.id, name: r.name, kind: "npc" })));
          setMerchants([]);
        } catch (e) {
          console.warn("RPC list_item_send_targets_v1 unavailable; using direct target lists.", e);
        }
      }`,
    "inventory send target rpc list"
  );

  source = replaceOnce(
    source,
    `  async function toggleEquipped(rowId, nextVal) {
    if (!canManage && !(isOwnInventory && ownerType === "player")) return;

    const { error } = await supabase.from("inventory_items").update({ is_equipped: nextVal }).eq("id", rowId);
    if (error) console.error("toggleEquipped", error);
  }`,
    `  async function toggleEquipped(rowId, nextVal) {
    if (!canManage && !(isOwnInventory && ownerType === "player")) return;

    const row = rows.find((r) => r.id === rowId);
    const patch = {
      is_equipped: nextVal,
      equip_slot: nextVal ? (row?.equip_slot || inferEquipmentSlot(row, new Set(rows.filter((r) => r.is_equipped && r.id !== rowId).map((r) => r.equip_slot).filter(Boolean)))) : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("inventory_items").update(patch).eq("id", rowId);
    if (error) console.error("toggleEquipped", error);
    else await fetchInventory();
  }

  async function assignEquipSlot(rowId, nextSlot) {
    if (!canManage && !(isOwnInventory && ownerType === "player")) return;
    if (!EQUIPMENT_SLOTS.some((slot) => slot.key === nextSlot)) return;

    const { error } = await supabase
      .from("inventory_items")
      .update({ is_equipped: true, equip_slot: nextSlot, updated_at: new Date().toISOString() })
      .eq("id", rowId);

    if (error) console.error("assignEquipSlot", error);
    else await fetchInventory();
  }`,
    "inventory equip slot update helpers"
  );

  source = replaceOnce(
    source,
    `  async function transferToTarget(rowId, targetKey) {
    const target = parseTargetKey(targetKey);
    if (!target) return;

    setErrorMsg(null);

    try {
      const patch = {
        owner_type: target.type,
        owner_id: target.id,
        updated_at: new Date().toISOString(),
        user_id: target.type === "player" ? target.id : null,
      };

      const { error } = await supabase.from("inventory_items").update(patch).eq("id", rowId);

      if (error) throw error;

      await fetchInventory();
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message || "Move failed");
    }
  }`,
    `  async function transferToTarget(rowId, targetKey, options = {}) {
    const target = parseTargetKey(targetKey);
    if (!target) return;

    setErrorMsg(null);

    try {
      const { error } = await supabase.rpc("transfer_inventory_item_v1", {
        p_item_id: rowId,
        p_target_type: target.type,
        p_target_id: target.id,
      });

      if (error) {
        // Backward-compatible fallback for admin/non-player moves if the RPC has
        // not been installed in a local/dev database yet.
        if (!canTransferOut) throw error;
        const patch = {
          owner_type: target.type,
          owner_id: target.id,
          updated_at: new Date().toISOString(),
          user_id: target.type === "player" ? target.id : null,
          is_equipped: false,
          equip_slot: null,
        };
        const fallback = await supabase.from("inventory_items").update(patch).eq("id", rowId);
        if (fallback.error) throw fallback.error;
      }

      await fetchInventory();
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message || "Move failed");
      if (options.rethrow) throw e;
    }
  }`,
    "inventory transfer rpc helper"
  );

  source = replaceOnce(
    source,
    `        <>
          <h2 className="h6 mb-3">Inventory</h2>`,
    `        <>
          <EquipmentDiagram
            rows={rows}
            ownerName={ownerMeta?.name || "Character"}
            canManage={isOwnInventory || canManage}
            canTransfer={isOwnInventory || canManage || canTransferOut}
            transferTargets={[
              ...players
                .filter((p) => p.user_id && !(ownerType === "player" && p.user_id === ownerId))
                .map((p) => ({ key: \`player:\${p.user_id}\`, label: p.name || "Player", group: "Players" })),
              ...npcs
                .filter((n) => n.id && !(ownerType === "npc" && String(n.id) === String(ownerId)))
                .map((n) => ({ key: \`npc:\${n.id}\`, label: n.name || "NPC", group: "NPCs" })),
              ...(isAdmin
                ? merchants
                    .filter((m) => m.id && !(ownerType === "merchant" && String(m.id) === String(ownerId)))
                    .map((m) => ({ key: \`merchant:\${m.id}\`, label: m.name || "Merchant", group: "Merchants" }))
                : []),
            ]}
            onTransferItem={(rowId, targetKey) => transferToTarget(rowId, targetKey, { rethrow: true })}
            onUnequip={(rowId) => toggleEquipped(rowId, false)}
            onToggleEquip={toggleEquipped}
            onAssignEquipSlot={assignEquipSlot}
          />

          <h2 className="h6 mb-3">Inventory List</h2>`,
    "inventory render equipment workbench"
  );

  source = replaceOnce(
    source,
    `                        {(isOwnInventory || canManage) && (
                          <button
                            className={\`btn btn-sm \${row.is_equipped ? "btn-success" : "btn-outline-light"}\`}
                            onClick={() => toggleEquipped(row.id, !row.is_equipped)}
                          >
                            {row.is_equipped ? "Equipped" : "Equip"}
                          </button>
                        )}`,
    `                        {(isOwnInventory || canManage) && (
                          <>
                            <button
                              className={\`btn btn-sm \${row.is_equipped ? "btn-success" : "btn-outline-light"}\`}
                              onClick={() => toggleEquipped(row.id, !row.is_equipped)}
                            >
                              {row.is_equipped ? "Equipped" : "Equip"}
                            </button>

                            {row.is_equipped ? (
                              <select
                                className="form-select form-select-sm equipment-slot-picker"
                                value={row.equip_slot || inferEquipmentSlot(row)}
                                onChange={(e) => assignEquipSlot(row.id, e.target.value)}
                                title="Choose where this item is equipped on the diagram"
                              >
                                {EQUIPMENT_SLOTS.map((slot) => (
                                  <option key={slot.key} value={slot.key}>
                                    {slot.label}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </>
                        )}`,
    "inventory item equip slot selector"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched inventory equipment workbench UI.");
  }
}

if (changedAny) {
  console.log("Applied inventory equipment workbench patch.");
} else {
  console.log("Inventory equipment workbench patch already current.");
}
