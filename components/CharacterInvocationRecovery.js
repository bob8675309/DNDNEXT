import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import {
  normalizeSourceChoiceSelections,
  setSourceChoiceSelection,
  sourceChoiceGroupsComplete,
  toggleSourceChoiceSelection,
} from "../utils/playerForgeSourceChoices";
import SourceChoiceFields from "./SourceChoiceFields";

const safeText = (value) => String(value ?? "").trim();

function rpcUnavailable(error, functionName) {
  const message = safeText(error?.message).toLowerCase();
  const code = safeText(error?.code).toUpperCase();
  return code === "PGRST202" || code === "42883"
    || (message.includes("function") && message.includes(functionName.toLowerCase()) && (message.includes("not found") || message.includes("could not find") || message.includes("does not exist")));
}

export default function CharacterInvocationRecovery({ characterId = null, onRecovered = null }) {
  const [payload, setPayload] = useState(null);
  const [selections, setSelections] = useState({});
  const [loading, setLoading] = useState(Boolean(characterId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const groups = Array.isArray(payload?.groups) ? payload.groups : [];
  const complete = useMemo(() => sourceChoiceGroupsComplete(groups, selections), [groups, selections]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!characterId) {
        setPayload(null);
        setSelections({});
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      const result = await supabase.rpc("get_character_invocation_recovery_v1", { p_character_id: characterId });
      if (!active) return;
      if (result.error) {
        if (rpcUnavailable(result.error, "get_character_invocation_recovery_v1")) {
          setPayload(null);
          setSelections({});
        } else {
          setError(result.error.message || "Could not review legacy Invocation authority.");
        }
      } else {
        const next = result.data || null;
        const nextGroups = Array.isArray(next?.groups) ? next.groups : [];
        setPayload(next);
        setSelections(normalizeSourceChoiceSelections(nextGroups, next?.initialSelections || {}));
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [characterId]);

  function toggleChoice(groupId, fieldId, optionKey) {
    setSelections((current) => toggleSourceChoiceSelection(groups, current, groupId, fieldId, optionKey));
    setError("");
  }

  function setChoice(groupId, fieldId, optionKeys) {
    setSelections((current) => setSourceChoiceSelection(groups, current, groupId, fieldId, optionKeys));
    setError("");
  }

  async function recover() {
    if (!characterId || !payload?.required || !payload?.recoverable || !complete) return;
    setSaving(true);
    setError("");
    const { data, error: recoverError } = await supabase.rpc("recover_character_invocations_v1", {
      p_character_id: characterId,
      p_selections: selections,
    });
    if (recoverError) {
      setError(recoverError.message || "Could not normalize the current Invocation set.");
    } else {
      setPayload(data || null);
      if (!data?.required) {
        setSelections({});
        await onRecovered?.(data || null);
      }
    }
    setSaving(false);
  }

  if (loading) return <div className="small text-muted mb-2">Checking legacy Invocation authority…</div>;
  if (!payload?.required) return null;

  if (!payload.recoverable) {
    return (
      <div className="alert alert-warning py-2">
        <strong>Invocation history needs GM reconciliation.</strong>
        <div className="small mt-1">{payload.reason || "This legacy Warlock cannot be normalized automatically without risking incorrect permanent effects."}</div>
      </div>
    );
  }

  return (
    <section className="npc-card mb-3">
      <div className="spell-admin-kicker">One-time legacy migration</div>
      <div className="npc-card-title">Current Invocation Setup</div>
      <div className="small text-muted mb-3">
        {payload.reason || "Confirm the Invocations already on this character and complete any dependent choices."}
        {Number(payload.expected || 0) ? ` ${payload.expected} current Invocation${Number(payload.expected) === 1 ? "" : "s"} must be normalized.` : ""}
        {" "}This records current state only; it does not retrain or replace an Invocation.
      </div>
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      <SourceChoiceFields
        groups={groups}
        selections={selections}
        kicker="Current Warlock state"
        title="Confirm current Eldritch Invocations"
        onToggle={toggleChoice}
        onSet={setChoice}
      />
      <button type="button" className="btn btn-warning btn-sm mt-3" disabled={saving || !complete} onClick={recover}>
        {saving ? "Normalizing Invocations…" : "Confirm Current Invocations"}
      </button>
      {!complete ? <div className="small text-muted mt-2">Complete each required dependent choice before confirming.</div> : null}
    </section>
  );
}
