export async function loadCharacterSecrets(supabase, characterIds) {
  const ids = [...new Set((characterIds || []).filter(Boolean).map(String))];
  if (!ids.length) return new Map();

  const { data, error } = await supabase.rpc("get_character_secrets_v1", {
    p_character_ids: ids,
  });
  if (error) throw error;
  return new Map((data || []).map((row) => [String(row.character_id), row.secret || ""]));
}

export async function saveCharacterSecret(supabase, characterId, secret) {
  const { error } = await supabase.rpc("set_character_secret_v1", {
    p_character_id: characterId,
    p_secret: String(secret || "").trim() || null,
  });
  if (error) throw error;
}
