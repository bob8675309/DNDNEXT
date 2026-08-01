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

function toLogRow(row) {
  const result = row?.detail?.attack || row?.detail;
  const text = hasAttackRollBreakdown(result)
    ? formatAttackRollBreakdown(result, { attackName: attackName(row, result) })
    : "";
  return {
    id: String(row.id),
    summary: row.summary || "Attack roll",
    text,
  };
}

function samePortalTargets(current, next) {
  return current.length === next.length && current.every((target, index) => (
    target.node === next[index]?.node && target.row.id === next[index]?.row.id
  ));
}

export default function TacticalAttackResultPanel() {
  const router = useRouter();
  const [encounterId, setEncounterId] = useState("");
  const [rows, setRows] = useState([]);
  const [portalTargets, setPortalTargets] = useState([]);
  const activeRoute = router.pathname === "/encounters/combat";

  useEffect(() => {
    if (!activeRoute || typeof document === "undefined") {
      setEncounterId("");
      setPortalTargets([]);
      return undefined;
    }

    let currentSelect = null;
    const ownedNodes = new Set();

    const onEncounterChange = () => setEncounterId(String(currentSelect?.value || ""));

    const syncDom = () => {
      const nextSelect = document.querySelector("main.combat-page select");
      if (nextSelect !== currentSelect) {
        currentSelect?.removeEventListener("change", onEncounterChange);
        currentSelect = nextSelect;
        currentSelect?.addEventListener("change", onEncounterChange);
      }
      onEncounterChange();

      const articles = Array.from(document.querySelectorAll("main.combat-page .log-list > article"));
      const activeNodes = new Set();
      const nextTargets = [];

      rows.forEach((row, index) => {
        if (!row.text) return;
        const article = articles[index];
        if (!article) return;

        let mountNode = Array.from(article.children).find(
          (child) => child?.dataset?.tacticalAttackDetails === "true"
        );
        if (!mountNode) {
          mountNode = document.createElement("div");
          mountNode.dataset.tacticalAttackDetails = "true";
          article.append(mountNode);
          ownedNodes.add(mountNode);
        }
        mountNode.dataset.combatLogRowId = row.id;
        activeNodes.add(mountNode);
        nextTargets.push({ node: mountNode, row });
      });

      document.querySelectorAll("main.combat-page .log-list [data-tactical-attack-details='true']")
        .forEach((node) => {
          if (activeNodes.has(node)) return;
          node.remove();
          ownedNodes.delete(node);
        });

      setPortalTargets((current) => samePortalTargets(current, nextTargets) ? current : nextTargets);
    };

    syncDom();
    const observer = new MutationObserver(syncDom);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      currentSelect?.removeEventListener("change", onEncounterChange);
      ownedNodes.forEach((node) => node.remove());
      setPortalTargets([]);
    };
  }, [activeRoute, rows]);

  const loadRows = useCallback(async () => {
    if (!activeRoute || !encounterId) {
      setRows([]);
      return;
    }
    setRows([]);
    const { data, error } = await supabase
      .from("encounter_combat_log")
      .select("id,event_type,summary,detail")
      .eq("encounter_id", encounterId)
      .order("id", { ascending: false })
      .limit(40);
    if (error) return;
    setRows((data || []).map(toLogRow));
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

  if (!activeRoute) return null;

  return <>
    {portalTargets.map(({ node, row }) => createPortal(
      <details className="tactical-attack-log-details" aria-label={`Attack details for ${row.summary}`}>
        <summary>
          <span className="tactical-attack-log-details__closed">Details</span>
          <span className="tactical-attack-log-details__open">Hide</span>
        </summary>
        <div className="tactical-attack-log-details__math">{row.text}</div>
      </details>,
      node,
      row.id
    ))}
    <style jsx global>{`
      .combat-page .log-list article{position:relative;padding-right:82px;border-color:rgba(190,128,238,.38);background:linear-gradient(100deg,rgba(77,43,104,.24),rgba(10,12,14,.95) 58%);box-shadow:inset 3px 0 0 rgba(176,105,229,.58),0 7px 18px rgba(0,0,0,.14)}
      .combat-page .log-list article:hover{border-color:rgba(208,157,249,.56);background:linear-gradient(100deg,rgba(91,50,123,.3),rgba(10,12,14,.96) 62%)}
      .tactical-attack-log-details summary{position:absolute;top:8px;right:8px;list-style:none;cursor:pointer;border:1px solid rgba(208,174,255,.4);border-radius:999px;padding:3px 8px;background:#09090d;color:#e4cdfb;font-size:.61rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;user-select:none}
      .tactical-attack-log-details summary::-webkit-details-marker{display:none}
      .tactical-attack-log-details__open{display:none}
      .tactical-attack-log-details[open] .tactical-attack-log-details__closed{display:none}
      .tactical-attack-log-details[open] .tactical-attack-log-details__open{display:inline}
      .tactical-attack-log-details__math{margin-top:8px;padding:8px 10px;border-top:1px solid rgba(208,174,255,.2);border-radius:0 0 7px 7px;background:#08080b;color:#f6edff;font-size:.7rem;line-height:1.5}
      @media(max-width:520px){.combat-page .log-list article{padding-right:72px}.tactical-attack-log-details summary{right:6px}}
    `}</style>
  </>;
}
