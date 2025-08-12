// pages/items.js (or wherever you load the grid)
import { supabase } from '../utils/supabaseClient';
import { loadItemsIndex } from '../utils/itemsIndex';

async function loadInventory() {
  const [{ byKey, norm }] = await Promise.all([loadItemsIndex()]);
  const { data: rows, error } = await supabase
    .from('inventory_items')
    .select('id, item_name, item_type, item_rarity, item_description, item_weight, item_cost')
    .order('item_name', { ascending: true });

  if (error) throw error;

  // merge missing fields from index
  const merged = (rows || []).map(r => {
    const ref = byKey[norm(r.item_name)];
    if (!ref) return r;
    return {
      ...r,
      item_type:        r.item_type        ?? ref.type ?? ref.category ?? null,
      item_rarity:      r.item_rarity      ?? ref.rarity ?? null,
      item_description: r.item_description ?? ref.description ?? null,
      item_weight:      r.item_weight      ?? (ref.weight ?? null),
      item_cost:        r.item_cost        ?? (ref.cost ?? ref.price ?? null),
    };
  });

  setItems(merged); // whatever your state setter is
}
