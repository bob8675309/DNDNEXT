// /components/AssignItemButton.js
// Button for admins to assign items to a character (player, NPC, or merchant).
// When clicked, inserts a new inventory_items row with proper ownership fields.

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AssignItemButton({ item, ownerType, ownerId, children, className = "", onAssigned = () => {} }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Extract mechanical fields from item if present to preserve bonuses
  function extractCardPayload(it) {
    // Clone the provided item (may be from search results or catalog)
    const base = { ...(it || {}) };
    const payload = { ...base.card_payload, ...base };
    // If the item has known numeric bonus fields, include them directly
    if (base.bonusAc) payload.bonusAc = base.bonusAc;
    if (base.bonusSavingThrow) payload.bonusSavingThrow = base.bonusSavingThrow;
    if (base.bonusAbilityCheck) payload.bonusAbilityCheck = base.bonusAbilityCheck;
    // Also include any custom modifiers for future support
    if (base.modifiers) payload.modifiers = base.modifiers;
    return payload;
  }

  async function handleAssign() {
    if (!ownerType || !ownerId) return;
    setLoading(true);
    setError(null);
    try {
      const cardPayload = extractCardPayload(item);
      const insertData = {
        owner_type: ownerType,
        owner_id: String(ownerId),
        is_equipped: false,
        card_payload: cardPayload,
      };
      // For legacy player inventories, also set user_id
      if (ownerType === "player") insertData.user_id = ownerId;
      const { error } = await supabase.from("inventory_items").insert(insertData);
      if (error) throw error;
      onAssigned();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className={`btn btn-sm btn-primary ${className}`} onClick={handleAssign} disabled={loading}>
        {loading ? "Assigning…" : children || "Assign"}
      </button>
      {error && <div className="text-danger mt-1 small">{error}</div>}
    </>
  );
}