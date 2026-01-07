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
    // Always attempt assignment even if ownerType/ownerId not provided
    setLoading(true);
    setError(null);
    try {
      // Determine final owner type/id. If none provided, default to current logged-in player
      let finalType = ownerType;
      let finalId = ownerId;
      if (!finalType || !finalId) {
        // Try to get current user from supabase auth
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user || null;
        if (!user) {
          throw new Error("No target owner selected and no logged-in user found");
        }
        finalType = "player";
        finalId = user.id;
      }
      const cardPayload = extractCardPayload(item);
      // Required item metadata. Attempt to populate from the item object or payload.
      const itemId = String(item?.id || cardPayload?.id || cardPayload?.item_id || Date.now());
      const itemName = item?.name || item?.item_name || cardPayload?.item_name || cardPayload?.name || "Unnamed Item";
      const itemType = item?.item_type || item?.type || cardPayload?.item_type || cardPayload?.type || null;
      const itemRarity = item?.rarity || item?.item_rarity || cardPayload?.rarity || cardPayload?.item_rarity || null;
      const itemDescription = item?.item_description || cardPayload?.item_description || null;
      const itemWeight = item?.item_weight || item?.weight || cardPayload?.weight || null;
      const itemCost = item?.item_cost || item?.cost || item?.value || cardPayload?.cost || null;

      const insertData = {
        owner_type: finalType,
        owner_id: String(finalId),
        is_equipped: false,
        card_payload: cardPayload,
        item_id: itemId,
        item_name: itemName,
        item_type: itemType,
        item_rarity: itemRarity,
        item_description: itemDescription,
        item_weight: itemWeight,
        item_cost: itemCost,
      };
      // For legacy player inventories, also set user_id
      if (finalType === "player") insertData.user_id = finalId;
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