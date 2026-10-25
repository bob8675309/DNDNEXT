import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";

// Campaign rule configuration only. Magic/equipment effects are untouched.
// The server is authoritative for both the toggle and readiness flags.
function parseRuleStatus(value) {
  const status = Array.isArray(value) ? value[0] : value;
  if (!status || typeof status.enabled !== "boolean" ||
      Number(status.max_items) !== 3 ||
      typeof status.selection_ready !== "boolean" ||
      typeof status.effects_enforced !== "boolean") {
    throw new Error("The campaign attunement status is incomplete or unavailable.");
  }
  return status;
}

export default function AdminAttunementSetting() {
  const [rule, setRule] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmIncompleteEnable, setConfirmIncompleteEnable] = useState(false);
  const requestInFlight = useRef(false);
  const statusRequestRef = useRef(0);

  const refreshStatus = useCallback(async () => {
    if (requestInFlight.current) return;
    const requestId = ++statusRequestRef.current;
    setLoaded(false);
    setError("");
    setMessage("");
    setConfirmIncompleteEnable(false);
    try {
      const { data, error: readError } = await supabase.rpc("get_campaign_attunement_rule_status_v1");
      if (readError) throw readError;
      const next = parseRuleStatus(data);
      if (statusRequestRef.current !== requestId) return;
      setRule(next);
      setLoadFailed(false);
    } catch (err) {
      if (statusRequestRef.current !== requestId) return;
      setRule(null);
      setLoadFailed(true);
      setError(err?.message || "Unable to read campaign attunement status.");
    } finally {
      if (statusRequestRef.current === requestId) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    return () => { statusRequestRef.current += 1; };
  }, [refreshStatus]);

  async function changeRule(nextEnabled) {
    if (!loaded || loadFailed || requestInFlight.current || !rule) return;
    requestInFlight.current = true;
    setSaving(true);
    setConfirmIncompleteEnable(false);
    setMessage("");
    setError("");
    try {
      const { data, error: saveError } = await supabase.rpc("set_campaign_attunement_rule_v1", {
        p_enabled: Boolean(nextEnabled),
      });
      if (saveError) throw saveError;
      const next = parseRuleStatus(data);
      setRule(next);
      setMessage(next.enabled
        ? next.effects_enforced
          ? "Optional attunement is ON and the server reports effect enforcement ready."
          : "Configuration is ON. Extra equipped magic-item bonuses are NOT yet suppressed."
        : "Attunement is OFF. Existing magic gear and equipment effects are unchanged.");
    } catch (err) {
      setError(err?.message || "Unable to update optional attunement.");
      // A failed RPC could have committed before a network response was lost.
      // Never claim the previous value remains authoritative.
      setRule(null);
      setLoadFailed(true);
    } finally {
      setSaving(false);
      requestInFlight.current = false;
    }
  }

  const ready = loaded && !loadFailed && Boolean(rule);
  const configuredOn = rule?.enabled === true;
  const effectsReady = rule?.effects_enforced === true;

  return (
    <section className="card bg-dark text-light border-secondary mb-3" aria-label="Optional attunement campaign setting">
      <div className="card-body py-3 d-flex flex-column gap-3">
        <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
          <div>
            <div className="small text-uppercase text-info fw-bold mb-1">Campaign magic item rules</div>
            <div className="fw-semibold">Optional Attunement</div>
            <div className="small text-muted">
              OFF: normal equipped magic effects. ON: choose up to three magic items per character through Inventory.
              Physical equipment slots always remain separate.
            </div>
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className={configuredOn ? "badge text-bg-warning" : "badge text-bg-secondary"}>
              {!ready ? "Unavailable" : configuredOn ? "ON · 3 configured" : "OFF"}
            </span>
            <div className="form-check form-switch m-0">
              <input
                id="campaign-attunement-enabled"
                type="checkbox"
                role="switch"
                className="form-check-input"
                checked={configuredOn}
                disabled={!ready || saving}
                onChange={(event) => {
                  if (event.target.checked && !effectsReady) setConfirmIncompleteEnable(true);
                  else changeRule(event.target.checked);
                }}
                aria-label="Enable optional magic item attunement limit"
              />
              <label className="form-check-label small" htmlFor="campaign-attunement-enabled">
                {saving ? "Updating…" : "Enable attunement limit"}
              </label>
            </div>
          </div>
        </div>
        {ready ? (
          <div className="small border-top border-secondary pt-2" aria-label="Attunement implementation readiness">
            <span className="me-3">Selection integration: <strong>{rule.selection_ready ? "Verified" : "Pending validation"}</strong></span>
            <span>Gameplay bonus enforcement: <strong>{effectsReady ? "Verified" : "Not yet active"}</strong></span>
            {!effectsReady ? (
              <div className="text-warning mt-1" role="status">
                Enabling this rule currently saves a campaign preference only. It does not prevent additional equipped magic items from granting bonuses.
              </div>
            ) : null}
          </div>
        ) : null}
        {confirmIncompleteEnable && ready && !effectsReady ? (
          <div className="border border-warning rounded p-2" role="group" aria-label="Confirm incomplete attunement configuration">
            <div className="small mb-2">
              The effects engine does not yet enforce this limit. Turn ON the configuration for testing anyway?
              This will not unequip, remove, or suppress existing items.
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <button type="button" className="btn btn-sm btn-outline-warning" disabled={saving} onClick={() => changeRule(true)}>
                Enable configuration only
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={saving} onClick={() => setConfirmIncompleteEnable(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={saving || !loaded}
            onClick={refreshStatus}>
            Refresh status
          </button>
          {!ready ? <span className="small text-muted">Unavailable until the required database functions are deployed and authorized.</span> : null}
        </div>
      </div>
      {message ? <div className="card-footer py-2 small text-success" role="status">{message}</div> : null}
      {error ? <div className="card-footer py-2 small text-danger" role="alert">{error}</div> : null}
    </section>
  );
}
