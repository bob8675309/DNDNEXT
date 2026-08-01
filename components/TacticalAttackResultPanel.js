import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabaseClient";
import {
  formatAttackRollBreakdown,
  hasAttackRollBreakdown,
} from "../utils/encounterAttackResult";

function attackName(row, result) {
  if (row?.event_type === "unarmed_strike") return "Unarmed Strike";
  if (row?.event_type === "opportunity_attack") return result?.weapon || "Opportunity Attack";
  return result?.weapon || row?.detail?.spell || result?.spell || "Attack";
}

function toDisplayRow(row) {
  const result = row?.detail?.attack || row?.detail;
  if (!hasAttackRollBreakdown(result)) return null;
  return {
    id: row.id,
    round: row.round,
    turnIndex: Number(row.turn_index || 0) + 1,
    summary: row.summary,
    text: formatAttackRollBreakdown(result, { attackName: attackName(row, result) }),
  };
}

export default function TacticalAttackResultPanel() {
  const router = useRouter();
  const [portalNode, setPortalNode] = useState(null);
  const [encounterId, setEncounterId] = useState("");
  const [rows, setRows] = useState([]);
  const activeRoute = router.pathname === "/encounters/combat";

  useEffect(() => {
    if (!activeRoute || typeof document === "undefined") {
      setPortalNode(null);
      setEncounterId("");
      return undefined;
    }

    let currentSelect = null;
    let currentPanel = null;
    let mountNode = null;

    const onEncounterChange = () => setEncounterId(String(currentSelect?.value || ""));

    const syncDom = () => {
      const nextPanel = document.querySelector("main.combat-page .log-panel");
      const nextSelect = document.querySelector("main.combat-page select");

      if (nextSelect !== currentSelect) {
        currentSelect?.removeEventListener("change", onEncounterChange);
        currentSelect = nextSelect;
        currentSelect?.addEventListener("change", onEncounterChange);
        onEncounterChange();
      }

      if (nextPanel !== currentPanel || !mountNode?.isConnected) {
        mountNode?.remove();
        currentPanel = nextPanel;
        mountNode = null;
        if (currentPanel) {
          mountNode = document.createElement("div");
          mountNode.dataset.tacticalAttackResultPanel = "true";
          currentPanel.prepend(mountNode);
        }
        setPortalNode(mountNode);
      }
    };

    syncDom();
    const observer = new MutationObserver(syncDom);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      currentSelect?.removeEventListener("change", onEncounterChange);
      mountNode?.remove();
      setPortalNode(null);
    };
  }, [activeRoute]);

  const loadRows = useCallback(async () => {
    if (!activeRoute || !encounterId) {
      setRows([]);
      return;
    }
    const { data, error } = await supabase
      .from("encounter_combat_log")
      .select("id,round,turn_index,event_type,summary,detail,created_at")
      .eq("encounter_id", encounterId)
      .order("id", { ascending: false })
      .limit(30);
    if (error) return;
    setRows((data || []).map(toDisplayRow).filter(Boolean).slice(0, 3));
  }, [activeRoute, encounterId]);

  useEffect(() => {
    void loadRows();
    if (!activeRoute || !encounterId) return undefined;

    const channel = supabase
      .channel(`tactical-attack-result-${encounterId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "encounter_combat_log", filter: `encounter_id=eq.${encounterId}` },
        () => { void loadRows(); }
      )
      .subscribe();
    const fallback = window.setInterval(() => { void loadRows(); }, 2500);

    return () => {
      window.clearInterval(fallback);
      supabase.removeChannel(channel);
    };
  }, [activeRoute, encounterId, loadRows]);

  const latest = rows[0] || null;
  const older = useMemo(() => rows.slice(1), [rows]);

  if (!activeRoute || !portalNode || !latest) return null;

  return createPortal(
    <section className="tactical-attack-result" aria-live="polite" aria-label="Latest attack roll breakdown">
      <div className="tactical-attack-result__head">
        <span>Latest attack roll</span>
        <strong>R{latest.round} T{latest.turnIndex}</strong>
      </div>
      <p>{latest.summary}</p>
      <div className="tactical-attack-result__breakdown">{latest.text}</div>
      {older.length ? <details>
        <summary>Previous attack rolls</summary>
        {older.map((row) => <div className="tactical-attack-result__older" key={row.id}>
          <strong>R{row.round} T{row.turnIndex}</strong>
          <span>{row.text}</span>
        </div>)}
      </details> : null}
      <style jsx global>{`
        .tactical-attack-result{margin-bottom:12px;padding:11px 12px;border:1px solid rgba(208,174,255,.32);border-radius:10px;background:linear-gradient(135deg,rgba(94,57,125,.24),rgba(33,27,42,.72));box-shadow:0 10px 28px rgba(0,0,0,.22)}
        .tactical-attack-result__head{display:flex;justify-content:space-between;gap:12px;align-items:center}.tactical-attack-result__head span{font-size:.67rem;text-transform:uppercase;letter-spacing:.12em;color:#d8baf7;font-weight:800}.tactical-attack-result__head strong{font-size:.7rem;color:#e9d9af}.tactical-attack-result p{margin:6px 0 7px;font-size:.76rem;color:#f3f0e8}.tactical-attack-result__breakdown{padding:8px 10px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(8,9,12,.46);font-size:.73rem;line-height:1.5;color:#f6edff}.tactical-attack-result details{margin-top:8px}.tactical-attack-result summary{cursor:pointer;font-size:.68rem;color:#cbb7df}.tactical-attack-result__older{display:grid;grid-template-columns:auto 1fr;gap:8px;margin-top:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,.08);font-size:.66rem;line-height:1.4}.tactical-attack-result__older strong{color:#e9d9af}.tactical-attack-result__older span{color:rgba(255,255,255,.72)}
      `}</style>
    </section>,
    portalNode
  );
}
