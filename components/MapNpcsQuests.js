// components/MapNpcsQuests.js
import { useEffect, useMemo, useState } from "react";

function labelOf(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") return v.name || v.title || v.label || v.id || "";
  return String(v);
}

function normalize(list) {
  return (Array.isArray(list) ? list : [])
    .map(labelOf)
    .map((s) => String(s || "").trim())
    .filter(Boolean);
}

function Section({ title, count, emptyText, children, right }) {
  return (
    <div className="loc-sec">
      <div className="loc-sec-title">
        <span>{title}</span>
        <div className="d-flex align-items-center gap-2">
          {right}
          <span className="badge-soft">{count}</span>
        </div>
      </div>

      {count === 0 ? (
        <div className="small text-muted">{emptyText}</div>
      ) : (
        children
      )}
    </div>
  );
}

export default function MapNpcsQuests({ npcNames = [], questTitles = [] }) {
  const npcs = useMemo(() => normalize(npcNames), [npcNames]);
  const quests = useMemo(() => normalize(questTitles), [questTitles]);

  const [tab, setTab] = useState("npcs");

  useEffect(() => {
    if (tab === "npcs" && npcs.length === 0 && quests.length > 0) setTab("quests");
    if (tab === "quests" && quests.length === 0 && npcs.length > 0) setTab("npcs");
  }, [tab, npcs.length, quests.length]);

  const tabs = (
    <div className="btn-group btn-group-sm" role="group" aria-label="NPCs and Quests">
      <button
        type="button"
        className={`btn ${tab === "npcs" ? "btn-info" : "btn-outline-info"}`}
        onClick={() => setTab("npcs")}
        disabled={npcs.length === 0}
      >
        NPCs
      </button>
      <button
        type="button"
        className={`btn ${tab === "quests" ? "btn-info" : "btn-outline-info"}`}
        onClick={() => setTab("quests")}
        disabled={quests.length === 0}
      >
        Quests
      </button>
    </div>
  );

  return tab === "npcs" ? (
    <Section title="NPCs" count={npcs.length} emptyText="No NPCs are tagged here yet." right={tabs}>
      <div className="list-group list-group-flush">
        {npcs.map((n, i) => (
          <div key={`${n}-${i}`} className="list-group-item loc-list-row">
            <span className="me-2">👤</span>
            <span className="flex-grow-1">{n}</span>
          </div>
        ))}
      </div>
    </Section>
  ) : (
    <Section title="Quests" count={quests.length} emptyText="No quests are tagged here yet." right={tabs}>
      <div className="list-group list-group-flush">
        {quests.map((q, i) => (
          <div key={`${q}-${i}`} className="list-group-item loc-list-row">
            <span className="me-2">📜</span>
            <span className="flex-grow-1">{q}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}
