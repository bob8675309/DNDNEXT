// pages\npcs.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import CharacterSheetPanel from "../components/CharacterSheetPanel";
import { deriveEquippedItemEffects, hashEquippedRowsForKey } from "../utils/equipmentEffects";
import MapIconPicker from "../components/MapIconPicker";
import SpritePickerModal from "../components/SpritePickerModal";
import KindPicker from "../components/KindPicker";
import NewNpcModal from "../components/NewNpcModal";
import PortraitPickerModal from "../components/PortraitPickerModal";
import NpcPanel from "../components/character/CharacterInteractionPanel";
import { MAP_ICONS_BUCKET, LOCAL_FALLBACK_ICON, mapIconDisplay } from "../utils/mapIcons";
import { resolveCharacterPortrait } from "../utils/characterPortraits";

const glassPanelStyle = {
  background: "rgba(8, 10, 16, 0.88)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const MUTED = "rgba(255,255,255,0.72)";
const DIM = "rgba(255,255,255,0.60)";
const BORDER = "rgba(255,255,255,0.12)";

const NPC_SPRITE_BUCKET = "map-icons";

function publicNpcSpriteUrl(spritePath) {
  const clean = safeStr(spritePath);
  if (!clean) return LOCAL_FALLBACK_ICON;
  try {
    return supabase.storage.from(NPC_SPRITE_BUCKET).getPublicUrl(clean).data?.publicUrl || LOCAL_FALLBACK_ICON;
  } catch {
    return LOCAL_FALLBACK_ICON;
  }
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function isSupabaseMissingTable(err) {
  const msg = String(err?.message || "");
  return msg.includes("relation") && msg.includes("does not exist");
}