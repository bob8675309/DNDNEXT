import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "pages", "npcs.js");
let source = fs.readFileSync(target, "utf8");
const marker = "delete_character_v1";

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

if (!source.includes(marker)) {
  replaceOnce(
`  // Reload NPC list when a new NPC has been created via the builder
  async function handleNewNpcCreated() {
    await loadNpcs();
    setShowNewNpcModal(false);
  }

  // Delete a character and dependent rows (schema has no ON DELETE CASCADE)
  async function handleDeleteNpc(characterId) {
    if (!characterId) return;

    const npc = npcs.find((n) => String(n.id) === String(characterId));
    const name = (npc && npc.name) ? npc.name : "this character";

    if (typeof window !== "undefined") {
      const ok = window.confirm("Delete " + name + "? This cannot be undone.");
      if (!ok) return;
    }

    try {
      setErrorMessage("");
      // Delete dependents first
      await supabase.from("character_notes").delete().eq("character_id", characterId);
      await supabase.from("character_permissions").delete().eq("character_id", characterId);
      await supabase.from("character_stock").delete().eq("character_id", characterId);
      await supabase.from("character_sheets").delete().eq("character_id", characterId);
      await supabase.from("inventory_items").delete().eq("character_id", characterId);

      const { error } = await supabase.from("characters").delete().eq("id", characterId);
      if (error) throw error;

      setNpcs((prev) => prev.filter((c) => String(c.id) !== String(characterId)));
      if (selectedNpc && String(selectedNpc.id) === String(characterId)) {
        setSelectedNpc(null);
      }
    } catch (err) {
      console.error("Delete NPC error", err);
      setErrorMessage(err && err.message ? err.message : "Failed to delete character");
    }
  }`,
`  // Reload the unified character roster after the NPC Forge creates a character.
  async function handleNewNpcCreated(created) {
    await Promise.all([loadNpcs(), loadMerchants(), loadMerchantProfiles()]);
    setShowNewNpcModal(false);
    if (created?.id) {
      setSelectedKey(keyOf(created.kind === "merchant" ? "merchant" : "npc", created.id));
    }
  }

  // Use the canonical server-side delete path. It cleans owner-model inventory,
  // relies on database cascades for character dependents, and protects Mog.
  async function handleDeleteNpc(characterId) {
    if (!characterId || !isAdmin) return;

    const entity = roster.find((entry) => String(entry.id) === String(characterId)) || selected;
    const name = entity?.name || "this character";
    if (String(name).trim().toLowerCase() === "mog") {
      setErr("Mog is protected and cannot be deleted.");
      return;
    }

    if (typeof window !== "undefined") {
      const ok = window.confirm("Delete " + name + "? Personal inventory, stock, notes, permissions, and sheet data will also be removed. This cannot be undone.");
      if (!ok) return;
    }

    setErr("");
    const { error } = await supabase.rpc("delete_character_v1", { p_character_id: characterId });
    if (error) {
      console.error("Delete character error", error);
      setErr(error.message || "Failed to delete character.");
      return;
    }

    setSelectedKey(null);
    await Promise.all([loadNpcs(), loadMerchants(), loadMerchantProfiles()]);
  }`,
    "Canonical create/delete handlers"
  );

  replaceOnce(
`  if (!roster.length) {
    return (
      <div className="container-fluid my-3 npcs-page">
        <div style={{ color: MUTED }}>No NPCs or merchants found.</div>
      </div>
    );
  }
`,
`  // Keep the page shell available when the roster is empty so an administrator
  // can create the first canonical character from the NPC Forge.
`,
    "Empty-roster creator access"
  );

  replaceOnce(
`                  title="Create new NPC"
                >
                  New NPC`,
`                  title="Create a canonical NPC or merchant"
                >
                  New Character`,
    "Creator button label"
  );

  replaceOnce(
`            <div className="list-group flex-grow-1 overflow-auto npc-roster-list">
              {roster.map((r) => {`,
`            <div className="list-group flex-grow-1 overflow-auto npc-roster-list">
              {!roster.length ? <div className="p-3 small npc-muted">No NPCs or merchants found. Use New Character to create one.</div> : null}
              {roster.map((r) => {`,
    "Empty roster message"
  );

  replaceOnce(
`                      onDelete={() => handleDeleteNpc(selected?.id)}`,
`                      onDelete={isAdmin && String(selected?.name || "").trim().toLowerCase() !== "mog" ? () => handleDeleteNpc(selected?.id) : null}`,
    "Mog-safe delete control"
  );

  replaceOnce(
`    <NewNpcModal
        show={showNewNpcModal}
        onClose={() => setShowNewNpcModal(false)}
        onCreated={handleNewNpcCreated}
      />`,
`    <NewNpcModal
        show={showNewNpcModal}
        locations={locations}
        onClose={() => setShowNewNpcModal(false)}
        onCreated={handleNewNpcCreated}
      />`,
    "NPC Forge location options"
  );

  fs.writeFileSync(target, source, "utf8");
  console.log("Connected the NPC page to the canonical NPC Forge create/delete paths.");
} else {
  console.log("NPC Forge page integration already present.");
}

for (const token of [
  'supabase.rpc("delete_character_v1"',
  'locations={locations}',
  'New Character',
  'Mog is protected',
  'handleNewNpcCreated(created)',
]) {
  if (!source.includes(token)) throw new Error(`NPC Forge page validation failed: ${token}`);
}

for (const forbidden of ["setErrorMessage(", "selectedNpc", "setSelectedNpc", '.eq("character_id", characterId)']) {
  if (source.includes(forbidden)) throw new Error(`Stale NPC delete path remains: ${forbidden}`);
}
