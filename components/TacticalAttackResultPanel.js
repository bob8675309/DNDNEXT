import { useCallback, useEffect, useState } from "react";
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
      }
      onEncounterChange();

      if (nextPanel !== currentPanel || !mountNode?.isConnected) {
        mountNode?.remove();
        currentPanel = nextPanel;
        mountNode = null;
        if (currentPanel) {
          mountNode = document.createElement("div");
          mountNode.dataset.tacticalAttackResultPanel = "true";
          const logHead = currentPanel.querySelector(".log-head");
          if (logHead) logHead.insertAdjacentElement("afterend", mountNode);
          else currentPanel.prepend(mountNode);
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
    setRows((data || []).map(toDisplayRow).filter(Boolean).slice(0, 1));
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

  if (!activeRoute || !portalNode || !latest) return null;

  return createPortal(
    <details className="tactical-attack-result" aria-live="polite" aria-label="Latest attack math details">
      <summary>
        <span className="tactical-attack-result__summary">
          <small>Latest attack</small>
          <strong>R{latest.round} T{latest.turnIndex} • {latest.summary}</strong>
        </span>
        <span className="tactical-attack-result__toggle">
          <span className="tactical-attack-result__closed">Details</span>
          <span className="tactical-attack-result__open">Hide</span>
        </span>
      </summary>
      <div className="tactical-attack-result__breakdown">{latest.text}</div>
      <style jsx global>{`
        .tactical-attack-result{margin:8px 0 10px;border:1px solid rgba(208,174,255,.34);border-radius:8px;background:#09090d;box-shadow:inset 3px 0 0 rgba(174,112,232,.58);overflow:hidden}
        .tactical-attack-result summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 9px;cursor:pointer;list-style:none;background:linear-gradient(90deg,rgba(94,57,125,.26),rgba(16,13,20,.94));user-select:none}
        .tactical-attack-result summary::-webkit-details-marker{display:none}
        .tactical-attack-result__summary{display:flex;align-items:center;gap:8px;min-width:0}
        .tactical-attack-result__summary small{flex:0 0 auto;font-size:.61rem;text-transform:uppercase;letter-spacing:.1em;color:#d8baf7;font-weight:800}
        .tactical-attack-result__summary strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.69rem;color:#f3f0e8;font-weight:600}
        .tactical-attack-result__toggle{flex:0 0 auto;border:1px solid rgba(208,174,255,.34);border-radius:999px;padding:3px 7px;background:rgba(9,9,13,.68);font-size:.62rem;color:#dfc8f8;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
        .tactical-attack-result__open{display:none}
        .tactical-attack-result[open] .tactical-attack-result__closed{display:none}
        .tactical-attack-result[open] .tactical-attack-result__open{display:inline}
        .tactical-attack-result__breakdown{padding:8px 10px;border-top:1px solid rgba(208,174,255,.18);background:#08080b;font-size:.72rem;line-height:1.5;color:#f6edff}
      `}</style>
    </details>,
    portalNode
  );
}
