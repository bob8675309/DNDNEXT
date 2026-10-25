import { useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";

// Campaign rule configuration only. Magic/equipment effects are untouched.
export default function AdminAttunementSetting() {
  const [enabled, setEnabled] = useState(false);
  const [maxItems, setMaxItems] = useState(3);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const requestInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error: loadError } = await supabase
          .from("campaign_item_pool_settings")
          .select("attunement_enabled,attunement_max_items")
          .eq("id", 1)
          .maybeSingle();
        if (loadError) throw loadError;
        if (!data) throw new Error("Campaign attunement settings have not been installed.");
        if (active) {
          setEnabled(data.attunement_enabled === true);
          setMaxItems(Number(data.attunement_max_items) || 3);
        }
      } catch (err) {
        if (active) setError(err?.message || "Unable to load the attunement setting.");
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => { active = false; };
  }, []);

  async function changeRule(nextEnabled) {
    if (!loaded || error || requestInFlight.current) return;
    requestInFlight.current = true;
    setSaving(true);
    setMessage("");
    try {
      const { data, error: saveError } = await supabase.rpc("set_campaign_attunement_rule_v1", {
        p_enabled: Boolean(nextEnabled),
      });
      if (saveError) throw saveError;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result || typeof result.enabled !== "boolean" || Number(result.max_items) !== 3) {
        throw new Error("The campaign setting response was incomplete.");
      }
      setEnabled(result.enabled);
      setMaxItems(Number(result.max_items));
      setMessage(result.enabled
        ? "Optional attunement limit configured. Magic-item selection and bonus enforcement are not enabled yet."
        : "Attunement is OFF. Existing magic gear and equipment are unchanged.");
    } catch (err) {
      setError(err?.message || "Unable to update optional attunement.");
    } finally {
      setSaving(false);
      requestInFlight.current = false;
    }
  }

  return (
    <section className="card bg-dark text-light border-secondary mb-3" aria-label="Optional attunement campaign setting">
      <div className="card-body py-3 d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
        <div>
          <div className="small text-uppercase text-info fw-bold mb-1">Campaign magic item rules</div>
          <div className="fw-semibold">Optional Attunement</div>
          <div className="small text-muted">
            OFF: no attunement limit. ON: configure a limit of {maxItems} magic items per character.
            Equipment slots always remain separate.
          </div>
          <div className="small text-warning mt-1">
            The item-selection and effect-limit integration is still in development.
            This switch does not currently disable any equipped magic items or bonuses.
          </div>
        </div>
        <div className="d-flex align-items-center gap-3">
          <span className={enabled ? "badge text-bg-warning" : "badge text-bg-secondary"}>
            {!loaded || error ? "Unavailable" : enabled ? "ON · " + maxItems + " items configured" : "OFF"}
          </span>
          <div className="form-check form-switch m-0">
            <input
              id="campaign-attunement-enabled"
              type="checkbox"
              role="switch"
              className="form-check-input"
              checked={enabled}
              disabled={!loaded || Boolean(error) || saving}
              onChange={(event) => changeRule(event.target.checked)}
              aria-label="Enable optional magic item attunement limit"
            />
            <label className="form-check-label small" htmlFor="campaign-attunement-enabled">
              {saving ? "Updating…" : "Enable attunement limit"}
            </label>
          </div>
        </div>
      </div>
      {message ? <div className="card-footer py-2 small text-success" role="status">{message}</div> : null}
      {error ? <div className="card-footer py-2 small text-danger" role="alert">{error}</div> : null}
    </section>
  );
}
