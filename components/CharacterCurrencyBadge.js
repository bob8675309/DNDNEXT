import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

export default function CharacterCurrencyBadge({ characterId }) {
  const [currency, setCurrency] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadCurrency() {
    if (!characterId) {
      setCurrency(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("get_character_currency_v1", {
      p_character_id: characterId,
    });
    if (rpcError) {
      if (String(rpcError.code || "") !== "42501" && String(rpcError.code || "") !== "PGRST202") {
        setError(rpcError.message || "Could not load character currency.");
      }
      setCurrency(null);
    } else {
      setCurrency(data && typeof data === "object" ? data : null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadCurrency();
    // Character switches must never retain another character's balance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  if (!characterId || (!loading && !error && !currency?.hasBalance)) return null;

  const breakdown = currency?.sourceBreakdown && typeof currency.sourceBreakdown === "object" ? currency.sourceBreakdown : {};
  const higherLevel = Number(breakdown.higherLevelCopper || 0);
  const title = [
    "Character-scoped currency",
    higherLevel > 0 ? `Includes ${Math.floor(higherLevel / 100).toLocaleString()} gp higher-level starting wealth` : "",
  ].filter(Boolean).join(" • ");

  return <section className="character-currency-badge" aria-label="Character currency" title={title}>
    <div>
      <span>Character Coin</span>
      <strong>{loading ? "Loading…" : currency?.display || "0 gp"}</strong>
    </div>
    <button type="button" onClick={loadCurrency} disabled={loading} aria-label="Refresh character currency">↻</button>
    {error ? <small>{error}</small> : null}
    <style jsx global>{`
      .character-currency-badge{margin:8px 12px;padding:8px 10px;border:1px solid rgba(255,209,102,.28);border-radius:9px;background:rgba(121,91,24,.09);display:flex;align-items:center;justify-content:space-between;gap:10px;color:#fff}.character-currency-badge>div{display:grid;gap:1px}.character-currency-badge span{color:rgba(255,255,255,.48);font-size:.59rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase}.character-currency-badge strong{color:#ffe7a4;font-size:.78rem}.character-currency-badge button{border:1px solid rgba(255,209,102,.3);border-radius:7px;background:rgba(121,91,24,.12);color:#ffe7a4;min-width:30px;height:28px}.character-currency-badge small{grid-column:1/-1;color:#ffb9b9;font-size:.62rem}
    `}</style>
  </section>;
}
