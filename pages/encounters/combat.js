import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EncounterTurnBoard from "../../components/encounter/EncounterTurnBoard";
import { hexDistance } from "../../utils/encounterHex";
import { supabase } from "../../utils/supabaseClient";

const SUPPORTED_SPELL_KEYS = new Set([
  "fire-bolt|xphb",
  "cure-wounds|xphb",
  "sacred-flame|xphb",
  "toll-the-dead|xphb",
  "poison-spray|xphb",
  "false-life|xphb",
  "inflict-wounds|xphb",
  "shocking-grasp|xphb",
  "ray-of-frost|xphb",
  "chill-touch|xphb",
  "mind-sliver|xphb",
]);

function requestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-0000-4000-8000-000000000000`.slice(0, 36);
}

function bonusLabel(value) {
  const n = Number(value || 0);
  return n >= 0 ? `+${n}` : String(n);
}

function affinityText(data) {
  if (data?.immune) return " Target was immune.";
  if (data?.resistant) return " Resistance reduced the damage.";
  if (data?.vulnerable) return " Vulnerability increased the damage.";
  return "";
}

function spellKey(row) {
  return String(row?.spellKey || "").toLowerCase();
}

function mindSliverPenaltyText(profile) {
  const penalty = Number(profile?.savePenalty || 0);
  if (penalty <= 0) return "";
  const base = profile?.baseSaveBonus;
  return ` • Mind Sliver −${penalty}${base != null ? ` (base ${bonusLabel(base)})` : ""}`;
}

export default function EncounterCombatPage() {
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [encounter, setEncounter] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [terrain, setTerrain] = useState([]);
  const [objects, setObjects] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [log, setLog] = useState([]);
  const [canControl, setCanControl] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [targeting, setTargeting] = useState(null);
  const [weapons, setWeapons] = useState([]);
  const [weaponId, setWeaponId] = useState("");
  const [spellProfile, setSpellProfile] = useState(null);
  const [spellAssignmentId, setSpellAssignmentId] = useState("");
  const [spellTargetId, setSpellTargetId] = useState("");
  const [spellSlotLevel, setSpellSlotLevel] = useState("");
  const [saveAbility, setSaveAbility] = useState("dex");
  const [saveDc, setSaveDc] = useState("15");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const active = useMemo(
    () => participants.find((p) => String(p.id) === String(encounter?.active_participant_id || "")) || null,
    [participants, encounter?.active_participant_id]
  );
  const targets = useMemo(
    () => participants.filter((p) => !p.is_defeated && String(p.id) !== String(active?.id || "")),
    [participants, active?.id]
  );
  const target = useMemo(() => targets.find((p) => String(p.id) === String(targetId)) || null, [targets, targetId]);
  const weapon = useMemo(() => weapons.find((row) => String(row.inventoryItemId) === String(weaponId)) || null, [weapons, weaponId]);
  const supportedSpells = useMemo(
    () => (Array.isArray(spellProfile?.knownSpells) ? spellProfile.knownSpells : []).filter(
      (row) => row?.source === "XPHB" && row?.sourceType === "class" && SUPPORTED_SPELL_KEYS.has(spellKey(row))
    ),
    [spellProfile]
  );
  const selectedSpell = useMemo(
    () => supportedSpells.find((row) => String(row.assignmentId) === String(spellAssignmentId)) || supportedSpells[0] || null,
    [supportedSpells, spellAssignmentId]
  );
  const selectedSpellKey = spellKey(selectedSpell);
  const spellTargets = useMemo(() => {
    if (!active || !selectedSpell) return [];
    if (selectedSpellKey === "false-life|xphb") return [active];
    if (selectedSpellKey === "cure-wounds|xphb") return participants;
    return participants.filter((p) => !p.is_defeated && String(p.id) !== String(active.id));
  }, [active, participants, selectedSpell, selectedSpellKey]);
  const spellTarget = useMemo(
    () => spellTargets.find((p) => String(p.id) === String(spellTargetId)) || null,
    [spellTargets, spellTargetId]
  );
  const spellTargetWounded = Boolean(
    spellTarget
      && spellTarget.current_hp != null
      && spellTarget.max_hp != null
      && Number(spellTarget.current_hp) < Number(spellTarget.max_hp)
  );
  const spellSlotOptions = useMemo(() => {
    if (!selectedSpell || Number(selectedSpell.level || 0) === 0) return [];
    return (Array.isArray(spellProfile?.slotSnapshot) ? spellProfile.slotSnapshot : [])
      .filter((row) => Number(row.slotLevel || 0) >= Number(selectedSpell.level || 0) && Number(row.remaining || 0) > 0)
      .sort((a, b) => Number(a.slotLevel || 0) - Number(b.slotLevel || 0));
  }, [selectedSpell, spellProfile]);
  const selectedSpellPrepared = Boolean(
    selectedSpell && (Number(selectedSpell.level || 0) === 0 || selectedSpell.prepared || selectedSpell.alwaysAvailable)
  );
  const targetDistance = active && target
    ? hexDistance(
      { q: Number(active.q || 0), r: Number(active.r || 0) },
      { q: Number(target.q || 0), r: Number(target.r || 0) }
    )
    : null;
  const targetDistanceFt = targetDistance == null ? null : targetDistance * 5;
  const spellTargetDistance = active && spellTarget
    ? hexDistance(
      { q: Number(active.q || 0), r: Number(active.r || 0) },
      { q: Number(spellTarget.q || 0), r: Number(spellTarget.r || 0) }
    )
    : null;
  const spellTargetDistanceFt = spellTargetDistance == null ? null : spellTargetDistance * 5;
  const spellRangeFt = selectedSpellKey === "fire-bolt|xphb"
    ? 120
    : selectedSpellKey === "sacred-flame|xphb" ? 60
      : selectedSpellKey === "toll-the-dead|xphb" ? 60
        : selectedSpellKey === "ray-of-frost|xphb" ? 60
          : selectedSpellKey === "mind-sliver|xphb" ? 60
            : selectedSpellKey === "poison-spray|xphb" ? 30
              : ["cure-wounds|xphb", "inflict-wounds|xphb", "shocking-grasp|xphb", "chill-touch|xphb"].includes(selectedSpellKey) ? 5 : 0;
  const spellInRange = Boolean(
    selectedSpell && spellTarget && spellTargetDistanceFt != null && spellTargetDistanceFt <= spellRangeFt
  );
  const spellHasSlot = Number(selectedSpell?.level || 0) === 0
    || spellSlotOptions.some((row) => String(row.slotLevel) === String(spellSlotLevel));
  const falseLifeBlockedByTempHp = selectedSpellKey === "false-life|xphb" && Number(active?.temp_hp || 0) > 0;
  const falseLifeUpcastBonus = selectedSpellKey === "false-life|xphb"
    ? Math.max(0, (Number(spellSlotLevel || 1) - 1) * 5)
    : 0;
  const inflictWoundsDiceCount = selectedSpellKey === "inflict-wounds|xphb"
    ? Math.max(2, Number(spellSlotLevel || 1) + 1)
    : 0;
  const shockingGraspDiceCount = selectedSpellKey === "shocking-grasp|xphb"
    ? Number(spellProfile?.classLevel || 1) >= 17 ? 4
      : Number(spellProfile?.classLevel || 1) >= 11 ? 3
        : Number(spellProfile?.classLevel || 1) >= 5 ? 2 : 1
    : 0;
  const rayOfFrostDiceCount = selectedSpellKey === "ray-of-frost|xphb"
    ? Number(spellProfile?.classLevel || 1) >= 17 ? 4
      : Number(spellProfile?.classLevel || 1) >= 11 ? 3
        : Number(spellProfile?.classLevel || 1) >= 5 ? 2 : 1
    : 0;
  const chillTouchDiceCount = selectedSpellKey === "chill-touch|xphb"
    ? Number(spellProfile?.classLevel || 1) >= 17 ? 4
      : Number(spellProfile?.classLevel || 1) >= 11 ? 3
        : Number(spellProfile?.classLevel || 1) >= 5 ? 2 : 1
    : 0;
  const mindSliverDiceCount = selectedSpellKey === "mind-sliver|xphb"
    ? Number(spellProfile?.classLevel || 1) >= 17 ? 4
      : Number(spellProfile?.classLevel || 1) >= 11 ? 3
        : Number(spellProfile?.classLevel || 1) >= 5 ? 2 : 1
    : 0;
  const canCastSelectedSpell = Boolean(
    canControl
      && active?.action_available
      && selectedSpell
      && selectedSpellPrepared
      && spellTarget
      && spellInRange
      && spellHasSlot
      && !falseLifeBlockedByTempHp
      && !saving
  );
  const moveAllowance = Number(active?.speed_ft || 30) + Number(active?.movement_bonus_ft || 0);
  const remainingFt = Math.max(0, moveAllowance - Number(active?.movement_spent_ft || 0));
  const weaponMaxRange = weapon ? Number((weapon.isRanged || weapon.isThrown) ? weapon.longRangeFt : weapon.reachFt) : 0;
  const weaponNormalRange = weapon ? Number((weapon.isRanged || weapon.isThrown) ? weapon.normalRangeFt : weapon.reachFt) : 0;
  const hasLos = targeting ? Boolean(targeting.hasLineOfSight) : true;
  const weaponInRange = Boolean(weapon && target && targetDistanceFt <= weaponMaxRange && hasLos);
  const weaponLongRange = Boolean(weaponInRange && targetDistanceFt > weaponNormalRange);
  const effectiveTargetAc = target ? Number(target.armor_class || 10) + Number(targeting?.coverAcBonus || 0) : null;

  const loadSessions = useCallback(async () => {
    const res = await supabase
      .from("encounters")
      .select("id,map_id,name,status,round,turn_index,active_participant_id,phase,version,updated_at")
      .neq("status", "archived")
      .order("updated_at", { ascending: false });
    if (res.error) throw res.error;
    const rows = res.data || [];
    setSessions(rows);
    setSessionId((current) => current && rows.some((r) => String(r.id) === String(current))
      ? current
      : (rows.find((r) => r.status === "active")?.id || rows[0]?.id || ""));
  }, []);

  const loadEncounter = useCallback(async (id) => {
    if (!id) {
      setEncounter(null);
      setParticipants([]);
      setLog([]);
      setTargeting(null);
      return;
    }
    const enc = await supabase
      .from("encounters")
      .select("id,map_id,name,status,round,turn_index,active_participant_id,phase,version,updated_at")
      .eq("id", id)
      .single();
    if (enc.error) throw enc.error;
    const [mapRes, terrainRes, objectRes, participantRes, logRes] = await Promise.all([
      supabase.from("encounter_maps").select("id,name,description,hex_size,radius").eq("id", enc.data.map_id).single(),
      supabase.from("encounter_hex_overrides").select("map_id,q,r,terrain_type,movement_multiplier,elevation,hazard_key").eq("map_id", enc.data.map_id),
      supabase.from("encounter_map_objects").select("id,map_id,object_type,q,r,blocks_movement,blocks_los,cover_level").eq("map_id", enc.data.map_id),
      supabase.from("encounter_participants")
        .select("id,encounter_id,character_id,display_name,team,controller_user_id,q,r,facing,initiative,current_hp,max_hp,temp_hp,armor_class,movement_spent_ft,movement_bonus_ft,speed_ft,action_available,bonus_action_available,reaction_available,disengaged,dodging,is_hidden,is_defeated,sprite_asset_id,state,updated_at")
        .eq("encounter_id", id)
        .order("initiative", { ascending: false, nullsFirst: false }),
      supabase.from("encounter_combat_log")
        .select("id,encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail,created_at")
        .eq("encounter_id", id)
        .order("id", { ascending: false })
        .limit(40),
    ]);
    if (mapRes.error) throw mapRes.error;
    if (terrainRes.error) throw terrainRes.error;
    if (objectRes.error) throw objectRes.error;
    if (participantRes.error) throw participantRes.error;
    if (logRes.error) throw logRes.error;
    setEncounter(enc.data);
    setMapData(mapRes.data);
    setTerrain(terrainRes.data || []);
    setObjects(objectRes.data || []);
    setParticipants(participantRes.data || []);
    setLog(logRes.data || []);
  }, []);

  const loadWeapons = useCallback(async (participantId) => {
    if (!participantId) {
      setWeapons([]);
      setWeaponId("");
      return;
    }
    const { data, error } = await supabase.rpc("encounter_equipped_weapon_profiles_v1", { p_participant_id: participantId });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    setWeapons(rows);
    setWeaponId((current) => current && rows.some((row) => String(row.inventoryItemId) === String(current))
      ? current
      : (rows[0]?.inventoryItemId || ""));
  }, []);

  const loadSpellcastingProfile = useCallback(async (participantId) => {
    if (!participantId) {
      setSpellProfile(null);
      setSpellAssignmentId("");
      setSpellTargetId("");
      setSpellSlotLevel("");
      return;
    }
    const { data, error } = await supabase.rpc("encounter_spellcasting_profile_v1", { p_participant_id: participantId });
    if (error) throw error;
    setSpellProfile(data || null);
  }, []);

  const loadTargeting = useCallback(async (attackerId, nextTargetId) => {
    if (!attackerId || !nextTargetId) {
      setTargeting(null);
      return;
    }
    const { data, error } = await supabase.rpc("encounter_targeting_context_v1", {
      p_attacker_id: attackerId,
      p_target_id: nextTargetId,
    });
    if (error) throw error;
    setTargeting(data || null);
  }, []);

  useEffect(() => {
    loadSessions().catch((e) => setMessage(e?.message || "Could not load encounters."));
  }, [loadSessions]);
  useEffect(() => {
    loadEncounter(sessionId).catch((e) => setMessage(e?.message || "Could not load combat state."));
  }, [loadEncounter, sessionId]);
  useEffect(() => {
    let cancelled = false;
    if (!active?.id) {
      setCanControl(false);
      setWeapons([]);
      setWeaponId("");
      setSpellProfile(null);
      setSpellAssignmentId("");
      setTargeting(null);
      return undefined;
    }
    supabase.rpc("encounter_can_control_participant_v1", { p_participant_id: active.id }).then(({ data, error }) => {
      if (cancelled) return;
      const allowed = !error && Boolean(data);
      setCanControl(allowed);
      if (allowed) {
        loadWeapons(active.id).catch((e) => setMessage(e?.message || "Could not load equipped weapons."));
        loadSpellcastingProfile(active.id).catch((e) => setMessage(e?.message || "Could not load tactical spellcasting profile."));
      } else {
        setWeapons([]);
        setWeaponId("");
        setSpellProfile(null);
        setSpellAssignmentId("");
        setSpellTargetId("");
        setSpellSlotLevel("");
        setTargeting(null);
      }
    });
    return () => { cancelled = true; };
  }, [active?.id, loadWeapons, loadSpellcastingProfile]);
  useEffect(() => {
    setTargetId((current) => targets.some((p) => String(p.id) === String(current)) ? current : (targets[0]?.id || ""));
  }, [targets]);
  useEffect(() => {
    setSpellAssignmentId((current) => current && supportedSpells.some((row) => String(row.assignmentId) === String(current))
      ? current
      : (supportedSpells[0]?.assignmentId || ""));
  }, [supportedSpells]);
  useEffect(() => {
    setSpellTargetId((current) => {
      if (current && spellTargets.some((p) => String(p.id) === String(current))) return current;
      if (selectedSpellKey === "false-life|xphb" && active) return active.id;
      if (selectedSpellKey === "cure-wounds|xphb" && active && spellTargets.some((p) => String(p.id) === String(active.id))) return active.id;
      return spellTargets[0]?.id || "";
    });
  }, [active, selectedSpellKey, spellTargets]);
  useEffect(() => {
    setSpellSlotLevel((current) => current && spellSlotOptions.some((row) => String(row.slotLevel) === String(current))
      ? current
      : (spellSlotOptions[0]?.slotLevel ? String(spellSlotOptions[0].slotLevel) : ""));
  }, [spellSlotOptions]);
  useEffect(() => {
    if (!canControl || !active?.id || !target?.id) {
      setTargeting(null);
      return;
    }
    loadTargeting(active.id, target.id).catch((e) => {
      setTargeting(null);
      setMessage(e?.message || "Could not resolve line of sight.");
    });
  }, [canControl, active?.id, target?.id, encounter?.version, loadTargeting]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const channel = supabase.channel(`encounter-combat-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "encounters", filter: `id=eq.${sessionId}` }, () => {
        loadSessions().catch(() => {});
        loadEncounter(sessionId).catch(() => {});
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "encounter_participants", filter: `encounter_id=eq.${sessionId}` }, () => loadEncounter(sessionId).catch(() => {}))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "encounter_combat_log", filter: `encounter_id=eq.${sessionId}` }, () => loadEncounter(sessionId).catch(() => {}))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, loadSessions, loadEncounter]);

  useEffect(() => {
    if (!active?.id || !canControl) return undefined;
    const participantId = active.id;
    const channel = supabase.channel(`encounter-spell-slots-${participantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "encounter_spell_slots", filter: `participant_id=eq.${participantId}` }, () => loadSpellcastingProfile(participantId).catch(() => {}))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [active?.id, canControl, loadSpellcastingProfile]);

  async function runRpc(name, args, success) {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc(name, args);
      if (error) throw error;
      setMessage(typeof success === "function" ? success(data) : success);
      await loadEncounter(sessionId);
      if (active?.id && canControl) await Promise.all([loadWeapons(active.id), loadSpellcastingProfile(active.id)]);
    } catch (error) {
      setMessage(error?.message || "Combat action rejected.");
    } finally {
      setSaving(false);
    }
  }

  function coreAction(action) {
    if (!active) return;
    return runRpc(
      "encounter_use_core_action_v1",
      { p_participant_id: active.id, p_action: action, p_request_id: requestId() },
      `${action[0].toUpperCase()}${action.slice(1)} accepted.`
    );
  }

  function unarmedStrike() {
    if (!active || !target) return;
    return runRpc(
      "encounter_unarmed_strike_v1",
      { p_attacker_id: active.id, p_target_id: target.id, p_request_id: requestId() },
      (data) => data?.hit
        ? `Hit for ${data.damage} damage.${affinityText(data)}`
        : `Missed with ${data?.total ?? "?"} vs AC ${data?.targetAc ?? "?"}.`
    );
  }

  function weaponAttack() {
    if (!active || !target || !weapon) return;
    return runRpc(
      "encounter_weapon_attack_v1",
      {
        p_attacker_id: active.id,
        p_target_id: target.id,
        p_inventory_item_id: weapon.inventoryItemId,
        p_request_id: requestId(),
      },
      (data) => data?.hit
        ? `${data.weapon} hit for ${data.damage} ${data.damageType} damage.${affinityText(data)}`
        : `${data?.weapon || weapon.name} missed with ${data?.total ?? "?"} vs AC ${data?.targetAc ?? "?"}.`
    );
  }

  function castSpell() {
    if (!active || !selectedSpell || !spellTarget || !canCastSelectedSpell) return;
    const key = spellKey(selectedSpell);
    const slotLevel = Number(selectedSpell.level || 0) === 0 ? null : Number(spellSlotLevel);
    const rpcName = key === "mind-sliver|xphb"
      ? "encounter_cast_spell_v10"
      : key === "chill-touch|xphb"
        ? "encounter_cast_spell_v9"
        : key === "ray-of-frost|xphb"
          ? "encounter_cast_spell_v8"
          : key === "shocking-grasp|xphb"
            ? "encounter_cast_spell_v7"
            : key === "inflict-wounds|xphb"
              ? "encounter_cast_spell_v6"
              : key === "false-life|xphb"
                ? "encounter_cast_spell_v5"
                : key === "poison-spray|xphb"
                  ? "encounter_cast_spell_v4"
                  : key === "toll-the-dead|xphb"
                    ? "encounter_cast_spell_v3"
                    : key === "sacred-flame|xphb" ? "encounter_cast_spell_v2" : "encounter_cast_spell_v1";
    return runRpc(rpcName, {
      p_caster_id: active.id,
      p_assignment_id: selectedSpell.assignmentId,
      p_target_id: spellTarget.id,
      p_slot_level: slotLevel,
      p_request_id: requestId(),
    }, (data) => {
      if (key === "fire-bolt|xphb") {
        if (data?.hit) return `Fire Bolt hit for ${data?.damage?.damage ?? data?.rawDamage ?? 0} fire damage.${affinityText(data?.damage || data)}`;
        return `Fire Bolt missed with ${data?.total ?? "?"} vs AC ${data?.targetAc ?? "?"}.`;
      }
      if (key === "sacred-flame|xphb") {
        if (data?.saveSuccess) return `Sacred Flame: ${spellTarget.display_name} saved with ${data?.saveTotal ?? "?"} vs DC ${data?.saveDc ?? spellProfile?.spellSaveDc ?? "?"}.`;
        return `Sacred Flame: DEX save ${data?.saveTotal ?? "?"} vs DC ${data?.saveDc ?? spellProfile?.spellSaveDc ?? "?"}; ${data?.damage?.damage ?? data?.rawDamage ?? 0} radiant damage.${affinityText(data?.damage || data)}`;
      }
      if (key === "toll-the-dead|xphb") {
        if (data?.saveSuccess) return `Toll the Dead: ${spellTarget.display_name} saved with ${data?.saveTotal ?? "?"} vs DC ${data?.saveDc ?? spellProfile?.spellSaveDc ?? "?"}.`;
        return `Toll the Dead: WIS save ${data?.saveTotal ?? "?"} vs DC ${data?.saveDc ?? spellProfile?.spellSaveDc ?? "?"}; ${data?.damage?.damage ?? data?.rawDamage ?? 0} necrotic damage (${data?.damageDice || (data?.targetWasWounded ? "1d12" : "1d8")}${data?.targetWasWounded ? ", wounded target" : ", full-health target"}).${affinityText(data?.damage || data)}`;
      }
      if (key === "poison-spray|xphb") {
        const attackTotal = data?.total ?? (Number(data?.roll || 0) + Number(data?.attackBonus || 0));
        if (data?.hit) return `Poison Spray hit for ${data?.damage?.damage ?? data?.rawDamage ?? 0} poison damage${data?.critical ? ` (${data?.damageDice || "critical"} critical)` : ` (${data?.damageDice || "1d12"})`}.${affinityText(data?.damage || data)}`;
        return `Poison Spray missed with ${attackTotal || "?"} vs AC ${data?.targetAc ?? "?"}${data?.disadvantage ? " at disadvantage" : ""}.`;
      }
      if (key === "false-life|xphb") {
        return `False Life granted ${data?.temporaryHpGranted ?? 0} Temporary HP${data?.upcastBonus ? ` (${data.temporaryHpDice} + ${data.upcastBonus} upcast)` : ` (${data?.temporaryHpDice || "2d4+4"})`}${data?.slotRemaining != null ? ` • ${data.slotRemaining}/${data.slotMax} level ${data.slotLevel} slots remain` : ""}.`;
      }
      if (key === "inflict-wounds|xphb") {
        const dealt = data?.damage?.damage ?? data?.rawDamage ?? 0;
        const saveText = data?.saveSuccess ? "successful save • half damage" : "failed save • full damage";
        const affinity = affinityText(data?.damage || data);
        return `Inflict Wounds: CON save ${data?.saveTotal ?? "?"} vs DC ${data?.saveDc ?? spellProfile?.spellSaveDc ?? "?"} • ${saveText}; ${dealt} necrotic damage (${data?.damageDice || `${Number(data?.slotLevel || 1) + 1}d10`})${data?.slotRemaining != null ? ` • ${data.slotRemaining}/${data.slotMax} level ${data.slotLevel} slots remain` : ""}.${affinity}`;
      }
      if (key === "shocking-grasp|xphb") {
        const attackTotal = data?.total ?? (Number(data?.roll || 0) + Number(data?.attackBonus || 0));
        if (data?.hit) return `Shocking Grasp hit for ${data?.damage?.damage ?? data?.rawDamage ?? 0} lightning damage (${data?.damageDice || "1d8"}) and suppressed Opportunity Attacks until ${spellTarget.display_name}'s next turn starts.${affinityText(data?.damage || data)}`;
        return `Shocking Grasp missed with ${attackTotal || "?"} vs AC ${data?.targetAc ?? "?"}${data?.disadvantage ? " at disadvantage" : ""}.`;
      }
      if (key === "ray-of-frost|xphb") {
        const attackTotal = data?.total ?? (Number(data?.roll || 0) + Number(data?.attackBonus || 0));
        if (data?.hit) return `Ray of Frost hit for ${data?.damage?.damage ?? data?.rawDamage ?? 0} cold damage (${data?.damageDice || "1d8"}) and reduced ${spellTarget.display_name}'s Speed by 10 feet until the start of your next turn (${data?.targetSpeedBeforeFt ?? "?"} → ${data?.targetSpeedAfterFt ?? "?"} ft.).${affinityText(data?.damage || data)}`;
        return `Ray of Frost missed with ${attackTotal || "?"} vs AC ${data?.targetAc ?? "?"}${data?.disadvantage ? " at disadvantage" : ""}.`;
      }
      if (key === "chill-touch|xphb") {
        const attackTotal = data?.total ?? (Number(data?.roll || 0) + Number(data?.attackBonus || 0));
        if (data?.hit) return `Chill Touch hit for ${data?.damage?.damage ?? data?.rawDamage ?? 0} necrotic damage (${data?.damageDice || "1d10"}) and ${spellTarget.display_name} cannot regain Hit Points until the end of your next turn.${affinityText(data?.damage || data)}`;
        return `Chill Touch missed with ${attackTotal || "?"} vs AC ${data?.targetAc ?? "?"}${data?.disadvantage ? " at disadvantage" : ""}.`;
      }
      if (key === "mind-sliver|xphb") {
        const consumed = mindSliverPenaltyText(data?.saveProfile);
        if (data?.saveSuccess) return `Mind Sliver: ${spellTarget.display_name} resisted with INT ${data?.saveTotal ?? "?"} vs DC ${data?.saveDc ?? spellProfile?.spellSaveDc ?? "?"}${consumed}.`;
        return `Mind Sliver: INT save ${data?.saveTotal ?? "?"} vs DC ${data?.saveDc ?? spellProfile?.spellSaveDc ?? "?"}${consumed}; ${data?.damage?.damage ?? data?.rawDamage ?? 0} psychic damage (${data?.damageDice || "1d6"}) • next saving throw −1d4 before the end of your next turn.${affinityText(data?.damage || data)}`;
      }
      const healed = data?.healing?.healing ?? 0;
      if (data?.healing?.healingPrevented) {
        return `Cure Wounds was cast, but ${spellTarget.display_name} could not regain Hit Points${data?.slotRemaining != null ? ` • ${data.slotRemaining}/${data.slotMax} level ${data.slotLevel} slots remain` : ""}.`;
      }
      return `Cure Wounds restored ${healed} HP${data?.slotRemaining != null ? ` • ${data.slotRemaining}/${data.slotMax} level ${data.slotLevel} slots remain` : ""}.`;
    });
  }

  function rollSave() {
    if (!active) return;
    const dc = Number(saveDc);
    if (!Number.isInteger(dc) || dc < 1 || dc > 40) {
      setMessage("Save DC must be a whole number from 1 to 40.");
      return;
    }
    return runRpc(
      "encounter_roll_save_v1",
      {
        p_participant_id: active.id,
        p_ability: saveAbility,
        p_dc: dc,
        p_request_id: requestId(),
        p_source_participant_id: target?.id || null,
      },
      (data) => `${String(data?.ability || saveAbility).toUpperCase()} save ${data?.total ?? "?"} vs DC ${data?.dc ?? dc}: ${data?.success ? "success" : "failure"}${data?.coverBonus ? ` (cover ${bonusLabel(data.coverBonus)})` : ""}${mindSliverPenaltyText(data?.profile)}.`
    );
  }

  return (
    <main className="combat-page">
      <header className="combat-header">
        <div>
          <div className="kicker">TACTICAL ENCOUNTER • PHASE 1R</div>
          <h1>Combat Actions & Spells</h1>
          <p>Weapons, attacks, healing, Temporary HP, reviewed spell attacks and saves, and timed tactical effects now include target-turn Opportunity Attack suppression, source-turn Speed reduction, source-turn-end healing prevention, and one-shot saving-throw penalties. Movement remains authoritative on the Turn Movement surface.</p>
        </div>
        <nav>
          <Link href="/encounters/play">Turn Movement</Link>
          <Link href="/encounters/live">GM Staging</Link>
          <Link href="/encounters">Map Workshop</Link>
        </nav>
      </header>
      {message ? <div className="message">{message}</div> : null}
      <section className="layout">
        <aside className="sidebar">
          <div className="panel">
            <div className="kicker">Encounter</div>
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              <option value="">Select encounter</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name} • {s.status}</option>)}
            </select>
            {encounter ? <div className="meta"><strong>{encounter.name}</strong><span>Round {encounter.round} • Turn {Number(encounter.turn_index || 0) + 1}</span></div> : null}
          </div>

          <div className="panel">
            <div className="kicker">Active participant</div>
            {active ? <>
              <h2>{active.display_name}</h2>
              <div className="read"><span>HP</span><strong>{active.current_hp ?? "—"}{active.max_hp != null ? `/${active.max_hp}` : ""}{active.temp_hp ? ` +${active.temp_hp}` : ""}</strong></div>
              <div className="read"><span>AC</span><strong>{active.armor_class ?? "—"}</strong></div>
              <div className="read"><span>Movement</span><strong>{remainingFt} ft.</strong></div>
              <div className="resource-row">
                <span className={active.action_available ? "on" : "off"}>Action</span>
                <span className={active.bonus_action_available ? "on" : "off"}>Bonus</span>
                <span className={active.reaction_available ? "on" : "off"}>Reaction</span>
              </div>
              <div className={`control ${canControl ? "yes" : "no"}`}>{canControl ? "You control this turn" : "View only"}</div>
            </> : <p>No active participant.</p>}
          </div>

          {active ? <div className="panel">
            <div className="kicker">Core actions</div>
            <div className="action-grid">
              <button onClick={() => coreAction("dash")} disabled={!canControl || !active.action_available || saving}>Dash</button>
              <button onClick={() => coreAction("disengage")} disabled={!canControl || !active.action_available || saving}>Disengage</button>
              <button onClick={() => coreAction("dodge")} disabled={!canControl || !active.action_available || saving}>Dodge</button>
            </div>
            <div className="effects">
              {active.movement_bonus_ft ? <span>Dash +{active.movement_bonus_ft} ft.</span> : null}
              {active.disengaged ? <span>Disengaged</span> : null}
              {active.dodging ? <span>Dodging</span> : null}
            </div>
          </div> : null}

          {active ? <div className="panel">
            <div className="kicker">Target & line of sight</div>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Choose target</option>
              {targets.map((p) => <option key={p.id} value={p.id}>{p.display_name} • {p.team} • HP {p.current_hp ?? "?"}{p.max_hp != null ? `/${p.max_hp}` : ""}</option>)}
            </select>
            {target ? <>
              <div className="read"><span>Distance</span><strong>{targetDistanceFt} ft.</strong></div>
              <div className="read"><span>LOS</span><strong className={hasLos ? "good" : "bad"}>{hasLos ? "Clear" : "Blocked"}</strong></div>
              <div className="read"><span>Cover</span><strong>{String(targeting?.coverLevel || "none").replace("_", " ")}</strong></div>
              <div className="read"><span>Effective AC</span><strong>{effectiveTargetAc ?? "—"}{targeting?.coverAcBonus ? ` (${bonusLabel(targeting.coverAcBonus)} cover)` : ""}</strong></div>
            </> : null}
          </div> : null}

          {active ? <div className="panel weapon-card">
            <div className="kicker">Equipped weapons</div>
            {weapons.length ? <>
              <select value={weaponId} onChange={(e) => setWeaponId(e.target.value)}>
                {weapons.map((row) => <option key={row.inventoryItemId} value={row.inventoryItemId}>{row.name}</option>)}
              </select>
              {weapon ? <div className="weapon-stats">
                <span>{weapon.damageDice} {weapon.damageType}</span>
                <span>Attack {bonusLabel(weapon.attackBonus)}</span>
                <span>{weapon.proficient ? "Proficient" : "Not proficient"}</span>
                <span>{weapon.isRanged ? `${weapon.normalRangeFt}/${weapon.longRangeFt} ft.` : weapon.isThrown ? `Reach ${weapon.reachFt}; throw ${weapon.normalRangeFt}/${weapon.longRangeFt} ft.` : `Reach ${weapon.reachFt} ft.`}</span>
                {weapon.magicBonus ? <span>Magic {bonusLabel(weapon.magicBonus)}</span> : null}
                {weaponLongRange ? <span className="warn">Long range • disadvantage</span> : null}
                {targeting?.coverAcBonus ? <span className="warn">Cover {bonusLabel(targeting.coverAcBonus)} AC</span> : null}
                {target && !hasLos ? <span className="blocked">No line of sight</span> : null}
              </div> : null}
              <button className="attack" onClick={weaponAttack} disabled={!canControl || !active.action_available || !target || !weaponInRange || saving}>Attack with {weapon?.name || "weapon"}</button>
              {target && weapon && !weaponInRange ? <p className="warn-text">{!hasLos ? "Target has total cover / blocked line of sight." : "Target is beyond this weapon's supported reach/range."}</p> : null}
            </> : <p>No supported equipped weapon is available. Equip a weapon in Inventory to expose its canonical attack profile here.</p>}
          </div> : null}

          {active ? <div className="panel spell-card">
            <div className="kicker">Known tactical spells</div>
            {!canControl ? <p>Spell controls are available to the participant&apos;s controller on the active turn.</p> : !spellProfile?.isClassCaster ? <p>This participant has no canonical class spellcasting profile.</p> : <>
              <div className="spell-stats">
                <span>Spell attack {bonusLabel(spellProfile.spellAttackBonus)}</span>
                <span>Save DC {spellProfile.spellSaveDc ?? "—"}</span>
                <span>{spellProfile.className} {spellProfile.classLevel}</span>
              </div>
              <div className="slot-row">
                {(spellProfile.slotSnapshot || []).length
                  ? spellProfile.slotSnapshot.map((row) => <span key={`${row.poolKey}-${row.slotLevel}`}>L{row.slotLevel} {row.remaining}/{row.max}</span>)
                  : <span>Cantrips / no slot pool</span>}
              </div>
              {supportedSpells.length ? <>
                <select value={spellAssignmentId} onChange={(e) => setSpellAssignmentId(e.target.value)}>
                  {supportedSpells.map((row) => <option key={row.assignmentId} value={row.assignmentId}>{row.name} • {Number(row.level || 0) === 0 ? "Cantrip" : `Level ${row.level}`}{Number(row.level || 0) > 0 && !(row.prepared || row.alwaysAvailable) ? " • not prepared" : ""}</option>)}
                </select>
                {selectedSpell ? <>
                  <div className="read"><span>Cast</span><strong>Action</strong></div>
                  <div className="read"><span>Range</span><strong>{selectedSpell.rangeText || `${spellRangeFt} ft.`}</strong></div>
                  {selectedSpellKey === "sacred-flame|xphb" ? <>
                    <div className="read"><span>Save</span><strong>DEX vs DC {spellProfile.spellSaveDc ?? "—"}</strong></div>
                    <p className="spell-rule">Sacred Flame ignores Half and Three-Quarters Cover on this Dexterity save. Total cover still blocks line of sight.</p>
                  </> : null}
                  {selectedSpellKey === "toll-the-dead|xphb" ? <>
                    <div className="read"><span>Save</span><strong>WIS vs DC {spellProfile.spellSaveDc ?? "—"}</strong></div>
                    <p className="spell-rule">Toll the Dead: a full-health target uses d8; a target missing any HP uses d12. Cover does not modify this Wisdom save; total cover still blocks line of sight.</p>
                  </> : null}
                  {selectedSpellKey === "poison-spray|xphb" ? <>
                    <div className="read"><span>Attack</span><strong>{bonusLabel(spellProfile.spellAttackBonus)} vs AC</strong></div>
                    <p className="spell-rule">Poison Spray makes a ranged spell attack. Dodge imposes disadvantage, Half and Three-Quarters Cover increase AC, and close-quarters ranged spell attacks remain GM-assisted. Total cover still blocks line of sight.</p>
                  </> : null}
                  {selectedSpellKey === "false-life|xphb" ? <>
                    <div className="read"><span>Effect</span><strong>2d4 + 4 Temporary HP{falseLifeUpcastBonus ? ` + ${falseLifeUpcastBonus}` : ""}</strong></div>
                    <p className="spell-rule">False Life targets only the caster. Each slot level above 1 adds 5 Temporary HP. Existing Temporary HP is not stacked or replaced automatically; that choice remains GM-assisted.</p>
                  </> : null}
                  {selectedSpellKey === "inflict-wounds|xphb" ? <>
                    <div className="read"><span>Save</span><strong>CON vs DC {spellProfile.spellSaveDc ?? "—"}</strong></div>
                    <div className="read"><span>Damage</span><strong>{inflictWoundsDiceCount}d10 necrotic</strong></div>
                    <p className="spell-rule">Inflict Wounds is Touch range: 2d10 Necrotic damage at level 1, plus 1d10 for each slot level above 1. A successful Constitution save takes half the rolled damage. Cover does not modify this save; Total Cover or blocked line of sight still prevents the cast.</p>
                  </> : null}
                  {selectedSpellKey === "shocking-grasp|xphb" ? <>
                    <div className="read"><span>Attack</span><strong>{bonusLabel(spellProfile.spellAttackBonus)} vs AC</strong></div>
                    <div className="read"><span>Damage</span><strong>{shockingGraspDiceCount}d8 lightning</strong></div>
                    <p className="spell-rule">Shocking Grasp makes a Touch-range melee spell attack. Dodge imposes disadvantage and cover can increase AC. On a hit, the target cannot make Opportunity Attacks until the start of its next turn; its general Reaction is not spent or disabled.</p>
                  </> : null}
                  {selectedSpellKey === "ray-of-frost|xphb" ? <>
                    <div className="read"><span>Attack</span><strong>{bonusLabel(spellProfile.spellAttackBonus)} vs AC</strong></div>
                    <div className="read"><span>Damage</span><strong>{rayOfFrostDiceCount}d8 cold</strong></div>
                    <p className="spell-rule">Ray of Frost makes a ranged spell attack at 60 feet. Dodge imposes disadvantage, Half and Three-Quarters Cover increase AC, and close-quarters ranged spell attacks remain GM-assisted. On a hit, the target&apos;s Speed is reduced by 10 feet until the start of the caster&apos;s next turn.</p>
                  </> : null}
                  {selectedSpellKey === "chill-touch|xphb" ? <>
                    <div className="read"><span>Attack</span><strong>{bonusLabel(spellProfile.spellAttackBonus)} vs AC</strong></div>
                    <div className="read"><span>Damage</span><strong>{chillTouchDiceCount}d10 necrotic</strong></div>
                    <p className="spell-rule">Chill Touch makes a Touch-range melee spell attack. Dodge imposes disadvantage and cover can increase AC. On a hit, the target cannot regain Hit Points until the end of the caster&apos;s next turn.</p>
                  </> : null}
                  {selectedSpellKey === "mind-sliver|xphb" ? <>
                    <div className="read"><span>Save</span><strong>INT vs DC {spellProfile.spellSaveDc ?? "—"}</strong></div>
                    <div className="read"><span>Damage</span><strong>{mindSliverDiceCount}d6 psychic</strong></div>
                    <p className="spell-rule">Mind Sliver forces an Intelligence saving throw at 60 feet. Cover and Dodge do not modify this save. On a failed save, the target takes Psychic damage and subtracts 1d4 from its next saving throw before the end of the caster&apos;s next turn; that next real saving throw consumes the penalty.</p>
                  </> : null}
                  <select className="spell-target" value={spellTargetId} onChange={(e) => setSpellTargetId(e.target.value)}>
                    <option value="">Choose spell target</option>
                    {spellTargets.map((p) => <option key={p.id} value={p.id}>{p.display_name}{String(p.id) === String(active.id) ? " • self" : ""} • {p.team} • HP {p.current_hp ?? "?"}{p.max_hp != null ? `/${p.max_hp}` : ""}</option>)}
                  </select>
                  {spellTarget ? <>
                    <div className="read"><span>Target distance</span><strong>{spellTargetDistanceFt} ft.</strong></div>
                    {selectedSpellKey === "toll-the-dead|xphb" ? <div className="read"><span>Toll damage die</span><strong>{spellTargetWounded ? "d12 • wounded" : "d8 • full health"}</strong></div> : null}
                    {selectedSpellKey === "poison-spray|xphb" ? <div className="read"><span>Base damage</span><strong>1d12 poison</strong></div> : null}
                    {selectedSpellKey === "false-life|xphb" ? <div className="read"><span>Current Temporary HP</span><strong>{Number(active.temp_hp || 0)}</strong></div> : null}
                    {selectedSpellKey === "inflict-wounds|xphb" ? <div className="read"><span>Selected-slot damage</span><strong>{inflictWoundsDiceCount}d10 necrotic • half on save</strong></div> : null}
                    {selectedSpellKey === "shocking-grasp|xphb" ? <div className="read"><span>On hit</span><strong>{shockingGraspDiceCount}d8 lightning • suppress Opportunity Attacks</strong></div> : null}
                    {selectedSpellKey === "ray-of-frost|xphb" ? <>
                      <div className="read"><span>Current Speed</span><strong>{Number(spellTarget.speed_ft || 0)} ft.</strong></div>
                      <div className="read"><span>On hit</span><strong>{rayOfFrostDiceCount}d8 cold • Speed −10 ft.</strong></div>
                    </> : null}
                    {selectedSpellKey === "chill-touch|xphb" ? <div className="read"><span>On hit</span><strong>{chillTouchDiceCount}d10 necrotic • cannot regain HP</strong></div> : null}
                    {selectedSpellKey === "mind-sliver|xphb" ? <div className="read"><span>On failed save</span><strong>{mindSliverDiceCount}d6 psychic • next save −1d4</strong></div> : null}
                  </> : null}
                  {Number(selectedSpell.level || 0) > 0 ? <select className="spell-slot" value={spellSlotLevel} onChange={(e) => setSpellSlotLevel(e.target.value)}>
                    <option value="">Choose spell slot</option>
                    {spellSlotOptions.map((row) => <option key={`${row.poolKey}-${row.slotLevel}`} value={row.slotLevel}>Level {row.slotLevel} • {row.remaining}/{row.max} remaining</option>)}
                  </select> : null}
                  <button className="spell-cast" onClick={castSpell} disabled={!canCastSelectedSpell}>Cast {selectedSpell.name}</button>
                  {!selectedSpellPrepared ? <p className="warn-text">This leveled spell is Known but not prepared/always available, so the server will not cast it.</p> : null}
                  {selectedSpellPrepared && Number(selectedSpell.level || 0) > 0 && !spellSlotOptions.length ? <p className="warn-text">No legal remaining spell slot is available.</p> : null}
                  {spellTarget && !spellInRange ? <p className="warn-text">Target is beyond this adapter&apos;s supported range.</p> : null}
                  {falseLifeBlockedByTempHp ? <p className="warn-text">False Life automation is blocked while the caster already has Temporary HP; keep or replace that pool through GM-assisted play.</p> : null}
                  <p>Fire Bolt, Cure Wounds, Sacred Flame, Toll the Dead, Poison Spray, False Life, Inflict Wounds, Shocking Grasp, Ray of Frost, Chill Touch, and Mind Sliver are the current reviewed tactical adapters. Other Known spells stay available through Spellbook/GM-assisted play until their rules are validated.</p>
                </> : null}
              </> : <p>No currently assigned Known spell has an approved tactical adapter. The full spellbook remains unchanged.</p>}
            </>}
          </div> : null}

          {active ? <div className="panel">
            <div className="kicker">Fallback attack</div>
            <h2>Unarmed Strike</h2>
            <button className="attack" onClick={unarmedStrike} disabled={!canControl || !active.action_available || !target || targetDistance > 1 || !hasLos || saving}>Unarmed Strike</button>
            <p>Strength + proficiency vs AC including cover. Typed damage uses the same server damage-affinity primitive as weapon attacks.</p>
          </div> : null}

          {active ? <div className="panel">
            <div className="kicker">Manual saving throw</div>
            <div className="save-grid">
              <select value={saveAbility} onChange={(e) => setSaveAbility(e.target.value)}>
                <option value="str">Strength</option>
                <option value="dex">Dexterity</option>
                <option value="con">Constitution</option>
                <option value="int">Intelligence</option>
                <option value="wis">Wisdom</option>
                <option value="cha">Charisma</option>
              </select>
              <input inputMode="numeric" value={saveDc} onChange={(e) => setSaveDc(e.target.value)} aria-label="Saving throw DC" />
            </div>
            <button onClick={rollSave} disabled={!canControl || saving}>Roll Save</button>
            <p>The server derives the ability modifier and class save proficiency. If the selected target is the source, Dexterity saves also receive server-resolved cover bonuses. An active Mind Sliver penalty is consumed automatically by the next real saving throw.</p>
          </div> : null}
        </aside>

        <section className="main-column">
          <div className="board-panel">
            {mapData ? <EncounterTurnBoard
              radius={mapData.radius || 6}
              hexSize={mapData.hex_size || 38}
              terrainOverrides={terrain}
              objects={objects}
              participants={participants}
              activeParticipantId={encounter?.active_participant_id}
              path={[]}
              targetingLine={targeting?.line || []}
              targetingBlockedHex={targeting?.blockingHex || null}
            /> : <div className="empty">Select an encounter.</div>}
          </div>
          <div className="log-panel">
            <div className="log-head"><span>Combat log</span><strong>{log.length} recent events</strong></div>
            {log.length ? <div className="log-list">{log.map((row) => <article key={row.id}>
              <div><strong>R{row.round} T{Number(row.turn_index || 0) + 1}</strong><span>{row.event_type.replaceAll("_", " ")}</span></div>
              <p>{row.summary}</p>
              {row.event_type !== "spell_cast" && row.detail?.damageType && row.detail?.hit ? <small>{row.detail.rawDamage !== row.detail.damage ? `${row.detail.rawDamage} → ` : ""}{row.detail.damage} {row.detail.damageType} damage{row.detail.immune ? " • immune" : row.detail.resistant ? " • resisted" : row.detail.vulnerable ? " • vulnerable" : ""}</small> : null}
              {row.event_type === "spell_cast" && row.detail?.damageType && row.detail?.hit ? <small>{row.detail.rawDamage !== row.detail?.damage?.damage ? `${row.detail.rawDamage} → ` : ""}{row.detail?.damage?.damage ?? row.detail.rawDamage} {row.detail.damageType} damage{row.detail?.damage?.immune ? " • immune" : row.detail?.damage?.resistant ? " • resisted" : row.detail?.damage?.vulnerable ? " • vulnerable" : ""}</small> : null}
              {row.event_type === "spell_cast" && String(row.detail?.spellKey || "").toLowerCase() === "poison-spray|xphb" ? <small>Ranged spell attack {Number(row.detail?.roll || 0) + Number(row.detail?.attackBonus || 0)} vs AC {row.detail?.targetAc ?? "?"} • {row.detail?.hit ? "hit" : "miss"}{row.detail?.disadvantage ? " • disadvantage" : ""}{row.detail?.coverAcBonus ? ` • cover +${row.detail.coverAcBonus} AC` : ""}{row.detail?.critical ? ` • critical • ${row.detail.damageDice}` : ""}</small> : null}
              {row.event_type === "spell_cast" && String(row.detail?.spellKey || "").toLowerCase() === "shocking-grasp|xphb" ? <small>Melee spell attack {Number(row.detail?.roll || 0) + Number(row.detail?.attackBonus || 0)} vs AC {row.detail?.targetAc ?? "?"} • {row.detail?.hit ? "hit" : "miss"}{row.detail?.disadvantage ? " • disadvantage" : ""}{row.detail?.coverAcBonus ? ` • cover +${row.detail.coverAcBonus} AC` : ""}{row.detail?.critical ? ` • critical • ${row.detail.damageDice}` : ""}{row.detail?.opportunityAttackSuppressed ? " • Opportunity Attacks suppressed until target turn start" : ""}</small> : null}
              {row.event_type === "spell_cast" && String(row.detail?.spellKey || "").toLowerCase() === "ray-of-frost|xphb" ? <small>Ranged spell attack {Number(row.detail?.roll || 0) + Number(row.detail?.attackBonus || 0)} vs AC {row.detail?.targetAc ?? "?"} • {row.detail?.hit ? "hit" : "miss"}{row.detail?.disadvantage ? " • disadvantage" : ""}{row.detail?.coverAcBonus ? ` • cover +${row.detail.coverAcBonus} AC` : ""}{row.detail?.critical ? ` • critical • ${row.detail.damageDice}` : ""}{row.detail?.speedPenaltyFt ? ` • Speed ${row.detail.targetSpeedBeforeFt ?? "?"} → ${row.detail.targetSpeedAfterFt ?? "?"} ft. until source turn start` : ""}</small> : null}
              {row.event_type === "spell_cast" && String(row.detail?.spellKey || "").toLowerCase() === "chill-touch|xphb" ? <small>Melee spell attack {Number(row.detail?.roll || 0) + Number(row.detail?.attackBonus || 0)} vs AC {row.detail?.targetAc ?? "?"} • {row.detail?.hit ? "hit" : "miss"}{row.detail?.disadvantage ? " • disadvantage" : ""}{row.detail?.coverAcBonus ? ` • cover +${row.detail.coverAcBonus} AC` : ""}{row.detail?.critical ? ` • critical • ${row.detail.damageDice}` : ""}{row.detail?.healingPrevented ? " • cannot regain HP until source next turn end" : ""}</small> : null}
              {row.event_type === "spell_cast" && row.detail?.saveAbility ? <small>{String(row.detail.saveAbility).toUpperCase()} {row.detail.saveTotal} vs DC {row.detail.saveDc} • {row.detail.saveSuccess ? "success" : "failure"}{row.detail.saveAdvantage ? " • advantage" : ""}{row.detail.ignoresHalfAndThreeQuarterCoverForSave ? " • cover ignored" : ""}{row.detail.halfDamageOnSuccessfulSave && row.detail.saveSuccess ? " • half damage" : ""}{mindSliverPenaltyText(row.detail?.saveProfile)}{String(row.detail?.spellKey || "").toLowerCase() === "toll-the-dead|xphb" ? ` • ${row.detail.targetWasWounded ? "wounded" : "full health"} • ${row.detail.damageDice}` : ""}</small> : null}
              {row.event_type === "spell_cast" && String(row.detail?.spellKey || "").toLowerCase() === "mind-sliver|xphb" && row.detail?.nextSavePenaltyApplied ? <small>Mind Sliver rider • next saving throw −1d4 before source next turn end</small> : null}
              {row.event_type === "spell_cast" && row.detail?.saveAbility && row.detail?.damageType && (!row.detail?.saveSuccess || row.detail?.halfDamageOnSuccessfulSave) ? <small>{row.detail.fullDamageRoll != null && row.detail.fullDamageRoll !== row.detail.rawDamage ? `${row.detail.fullDamageRoll} roll → ${row.detail.rawDamage} after save → ` : row.detail.rawDamage !== row.detail?.damage?.damage ? `${row.detail.rawDamage} → ` : ""}{row.detail?.damage?.damage ?? row.detail.rawDamage} {row.detail.damageType} damage{row.detail?.damage?.immune ? " • immune" : row.detail?.damage?.resistant ? " • resisted" : row.detail?.damage?.vulnerable ? " • vulnerable" : ""}{row.detail?.slotLevel ? ` • level ${row.detail.slotLevel} slot` : ""}</small> : null}
              {row.event_type === "spell_cast" && row.detail?.healing?.healing != null ? <small>{row.detail.healing.healingPrevented ? `Healing prevented • ${row.detail.healing.requestedHealing ?? 0} HP attempted` : `${row.detail.healing.healing} HP restored`}{row.detail.slotLevel ? ` • level ${row.detail.slotLevel} slot` : ""}</small> : null}
              {row.event_type === "spell_cast" && row.detail?.temporaryHpGranted != null ? <small>{row.detail.temporaryHpGranted} Temporary HP • {row.detail.temporaryHpDice || "2d4+4"}{row.detail.upcastBonus ? ` + ${row.detail.upcastBonus} upcast` : ""}{row.detail.slotLevel ? ` • level ${row.detail.slotLevel} slot` : ""}</small> : null}
              {row.event_type === "saving_throw" ? <small>{String(row.detail?.ability || "").toUpperCase()} {row.detail?.total} vs DC {row.detail?.dc} • {row.detail?.success ? "success" : "failure"}{mindSliverPenaltyText(row.detail?.profile)}</small> : null}
              {row.event_type === "effect_consumed" && row.detail?.effectKey === "mind_sliver_save_penalty" ? <small>Mind Sliver −{row.detail?.savePenalty ?? "?"} applied to {String(row.detail?.ability || "save").toUpperCase()} save • effect consumed</small> : null}
            </article>)}</div> : <p className="empty-log">No combat actions yet.</p>}
          </div>
        </section>
      </section>
      <style jsx>{`
        .combat-page{min-height:100vh;background:radial-gradient(circle at 74% 4%,rgba(91,55,55,.25),transparent 34%),linear-gradient(180deg,#090a0c,#111311 58%,#080a0b);color:#f3f0e8;padding:24px}.combat-header{max-width:1600px;margin:0 auto 14px;display:flex;justify-content:space-between;gap:20px;padding:18px 20px;border:1px solid rgba(190,151,89,.22);border-radius:14px;background:rgba(12,14,16,.92)}.combat-header h1{margin:4px 0;font-size:2rem}.combat-header p{margin:0;color:rgba(255,255,255,.62)}.combat-header nav{display:flex;gap:8px;flex-wrap:wrap}.combat-header nav :global(a){height:max-content;border:1px solid rgba(208,174,255,.25);border-radius:8px;padding:7px 10px;color:#e6d5fb;text-decoration:none}.kicker{font-size:.65rem;letter-spacing:.12em;color:#c8aee5;font-weight:800}.message{max-width:1600px;margin:0 auto 14px;border:1px solid rgba(208,174,255,.24);background:rgba(94,57,125,.16);border-radius:9px;padding:9px 12px}.layout{max-width:1600px;margin:0 auto;display:grid;grid-template-columns:340px minmax(0,1fr);gap:16px}.sidebar,.main-column{display:grid;align-content:start;gap:12px}.panel,.board-panel,.log-panel{border:1px solid rgba(255,255,255,.09);background:rgba(13,16,17,.92);border-radius:13px;box-shadow:0 15px 40px rgba(0,0,0,.25)}.panel{padding:15px}.panel h2{font-size:1rem;margin:5px 0 12px}.panel p{font-size:.72rem;line-height:1.5;color:rgba(255,255,255,.58)}.panel select,.panel input{width:100%;background:#090c0e;border:1px solid rgba(255,255,255,.14);color:#eee;border-radius:8px;padding:8px}.meta{display:grid;margin-top:10px}.meta span{font-size:.72rem;color:rgba(255,255,255,.55)}.read{display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.07);padding-top:8px;margin-top:8px;font-size:.76rem}.read span{color:rgba(255,255,255,.56)}.read .good{color:#a9ebc1}.read .bad{color:#ffaaa0}.resource-row,.effects,.weapon-stats,.spell-stats,.slot-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.resource-row span,.effects span,.weapon-stats span,.spell-stats span,.slot-row span{border-radius:999px;padding:4px 7px;font-size:.66rem;border:1px solid rgba(255,255,255,.1)}.resource-row .on{color:#a9ebc1;background:rgba(52,113,75,.18)}.resource-row .off{color:#d69b96;background:rgba(120,55,55,.18)}.effects span,.weapon-stats span,.spell-stats span,.slot-row span{color:#e8d4ff;border-color:rgba(210,174,255,.25)}.weapon-stats .warn{color:#ffd39b;border-color:rgba(255,190,110,.35)}.weapon-stats .blocked{color:#ffaaa0;border-color:rgba(255,130,120,.4)}.warn-text{color:#e9b57b!important}.spell-rule{color:#d9c2ff!important}.control{margin-top:10px;padding:7px 9px;border-radius:7px;font-size:.72rem}.control.yes{color:#a9ebc1;background:rgba(52,113,75,.18)}.control.no{color:#d69b96;background:rgba(120,55,55,.15)}.action-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.save-grid{display:grid;grid-template-columns:1fr 80px;gap:7px;margin-bottom:8px}.spell-card select{margin-top:8px}.panel button{border:1px solid rgba(208,174,255,.25);background:rgba(118,76,153,.18);color:#eadbff;border-radius:8px;padding:8px;font-size:.72rem}.panel button:disabled{opacity:.4}.panel .attack,.panel .spell-cast{width:100%;margin-top:10px;border-color:rgba(242,148,134,.3);background:rgba(128,58,52,.2);color:#ffd0ca}.panel .spell-cast{border-color:rgba(190,151,255,.35);background:rgba(91,62,132,.22);color:#eadbff}.board-panel{padding:12px;min-width:0}.log-panel{padding:14px}.log-head{display:flex;justify-content:space-between;gap:12px}.log-head span{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#c8aee5}.log-head strong{font-size:.75rem;color:rgba(255,255,255,.58)}.log-list{display:grid;gap:7px;margin-top:10px;max-height:340px;overflow:auto}.log-list article{border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:8px 10px;background:rgba(255,255,255,.02)}.log-list article>div{display:flex;gap:8px}.log-list article strong{font-size:.68rem;color:#e9d9af}.log-list article span{font-size:.68rem;color:rgba(255,255,255,.48);text-transform:capitalize}.log-list p{margin:4px 0 0;font-size:.76rem}.log-list small{display:block;margin-top:3px;color:#d9b88a;font-size:.68rem}.empty,.empty-log{padding:28px;color:rgba(255,255,255,.5)}@media(max-width:980px){.layout{grid-template-columns:1fr}.combat-header{display:grid}}@media(max-width:520px){.action-grid{grid-template-columns:1fr}.save-grid{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
