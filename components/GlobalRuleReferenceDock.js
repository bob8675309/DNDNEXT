import { useEffect, useState } from "react";
import NpcForgeClassFeatureDock from "./NpcForgeClassFeatureDock";

export default function GlobalRuleReferenceDock() {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleReference = (event) => {
      const next = event?.detail;
      if (next?.type !== "rulesReference" || !next?.reference) return;
      setDetail({ ...next, reference: { ...next.reference } });
    };
    window.addEventListener("dndnext:rule-reference", handleReference);
    return () => window.removeEventListener("dndnext:rule-reference", handleReference);
  }, []);

  return <NpcForgeClassFeatureDock panelRole="feature" detail={detail} selectedClass={null} />;
}
