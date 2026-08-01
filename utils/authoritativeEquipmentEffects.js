const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function numericObject(value) {
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [key, raw] of Object.entries(value)) {
    const number = Number(raw);
    if (Number.isFinite(number)) result[String(key).toLowerCase()] = number;
  }
  return result;
}

export function characterIdFromEffectsKey(effectsKey) {
  const match = String(effectsKey || "").match(UUID_RE);
  return match?.[0] || "";
}

export function authoritativeEffectsRevision(authoritative) {
  if (!authoritative || typeof authoritative !== "object") return "local";
  const ids = Array.isArray(authoritative.equippedItemIds)
    ? authoritative.equippedItemIds.map((id) => String(id || "")).filter(Boolean).sort()
    : [];
  return `v${finiteNumber(authoritative.schemaVersion, 1)}:${ids.join(",")}`;
}

export function mergeAuthoritativeEquipmentEffects(localEffects, authoritative) {
  const local = localEffects && typeof localEffects === "object" ? localEffects : {};
  if (!authoritative || typeof authoritative !== "object") return local;

  const localEquipment = local.equipment && typeof local.equipment === "object" ? local.equipment : {};
  const ac = authoritative.ac && typeof authoritative.ac === "object" ? authoritative.ac : {};
  const abilities = authoritative.abilities && typeof authoritative.abilities === "object" ? authoritative.abilities : {};

  const scoreBonuses = {};
  const modifierBonuses = {};
  for (const key of ABILITY_KEYS) {
    const ability = abilities[key] && typeof abilities[key] === "object" ? abilities[key] : {};
    scoreBonuses[key] = finiteNumber(ability.scoreBonus, finiteNumber(local?.abilities?.[key], 0));
    modifierBonuses[key] = finiteNumber(ability.modBonus, finiteNumber(local?.abilityMods?.[key], 0));
  }

  const localArmor = localEquipment.armor && typeof localEquipment.armor === "object" ? localEquipment.armor : null;
  const localShield = localEquipment.shield && typeof localEquipment.shield === "object" ? localEquipment.shield : null;
  const armorItemId = String(ac.armorItemId || "").trim();
  const shieldItemId = String(ac.shieldItemId || "").trim();

  const armor = armorItemId
    ? {
        ...(localArmor || {}),
        name: String(ac.armorName || localArmor?.name || "Armor"),
        category: String(ac.armorCategory || localArmor?.category || "").toLowerCase() || null,
        baseAc: finiteNumber(ac.armorBase, finiteNumber(localArmor?.baseAc, 0)),
        inventoryItemId: armorItemId,
      }
    : null;

  const shield = shieldItemId
    ? {
        ...(localShield || {}),
        name: String(ac.shieldName || localShield?.name || "Shield"),
        bonusAc: finiteNumber(ac.shieldBonus, finiteNumber(localShield?.bonusAc, 0)),
        inventoryItemId: shieldItemId,
      }
    : null;

  return {
    ...local,
    ac: finiteNumber(ac.otherBonus, finiteNumber(local.ac, 0)),
    savesAll: finiteNumber(authoritative.savesAll, finiteNumber(local.savesAll, 0)),
    saves: numericObject(authoritative.saves),
    skillsAll: finiteNumber(authoritative.skillsAll, finiteNumber(local.skillsAll, 0)),
    skills: numericObject(authoritative.skills),
    abilities: scoreBonuses,
    abilityMods: modifierBonuses,
    initiative: finiteNumber(authoritative.initiative, finiteNumber(local.initiative, 0)),
    equipment: {
      ...localEquipment,
      armor,
      shield,
    },
  };
}

export async function loadAuthoritativeEquipmentEffects(supabase, characterId) {
  const id = String(characterId || "").trim();
  if (!id) return null;
  const { data, error } = await supabase.rpc("character_equipment_effects_v1", {
    p_character_id: id,
  });
  if (error) throw error;
  return data && typeof data === "object" ? data : null;
}
