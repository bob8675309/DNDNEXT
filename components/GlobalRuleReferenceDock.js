import { useEffect, useRef, useState } from "react";
import NpcForgeClassFeatureDock from "./NpcForgeClassFeatureDock";

export default function GlobalRuleReferenceDock() {
  const [detail, setDetail] = useState(null);
  const sequence = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleReference = (event) => {
      const next = event?.detail;
      if (next?.type !== "rulesReference" || !next?.reference) return;
      sequence.current += 1;
      setDetail({ ...next, reference: { ...next.reference }, __globalRuleReferenceInstance: sequence.current });
    };
    window.addEventListener("dndnext:rule-reference", handleReference);
    return () => window.removeEventListener("dndnext:rule-reference", handleReference);
  }, []);

  return <NpcForgeClassFeatureDock key={detail?.__globalRuleReferenceInstance || "empty"} panelRole="feature" detail={detail} selectedClass={null} />;
}
