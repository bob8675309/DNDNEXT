import { useEffect } from "react";
import NewNpcModalV2Refined from "./NewNpcModalV2Refined";

export default function NewNpcModalV2(props) {
  const show = Boolean(props?.show);

  useEffect(() => {
    if (!show || typeof document === "undefined" || typeof window === "undefined") return undefined;

    function allowRerollWithoutBrowserDialog(event) {
      const button = event.target?.closest?.("button");
      if (!button || button.textContent?.trim() !== "Reroll all six") return;

      const originalConfirm = window.confirm;
      const allowOnce = () => true;
      window.confirm = allowOnce;
      window.setTimeout(() => {
        if (window.confirm === allowOnce) window.confirm = originalConfirm;
      }, 0);
    }

    document.addEventListener("click", allowRerollWithoutBrowserDialog, true);
    return () => document.removeEventListener("click", allowRerollWithoutBrowserDialog, true);
  }, [show]);

  return (
    <>
      <NewNpcModalV2Refined {...props} />
      <style jsx global>{`
        .npc-forge-context-row-details {
          width: 100% !important;
          min-width: 0 !important;
          grid-template-columns: minmax(0, 1fr) !important;
        }

        .npc-forge-context-row.is-interactive:hover > .npc-forge-context-row-details,
        .npc-forge-context-row.is-interactive[open] > .npc-forge-context-row-details {
          display: flex !important;
          flex-direction: column !important;
          align-items: stretch !important;
        }

        .npc-forge-context-row-details > *,
        .npc-forge-context-row-details article,
        .npc-forge-context-choice-stack,
        .npc-forge-context-choice-stack section,
        .npc-forge-context-choice-grid,
        .npc-forge-context-choice-grid.feats {
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
        }

        .npc-forge-context-choice-grid.feats {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
        }

        .npc-forge-context-choice-grid.feats button {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          align-items: start !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          white-space: normal !important;
        }

        .npc-forge-context-choice-grid button strong,
        .npc-forge-context-choice-grid button small,
        .npc-forge-context-choice-grid button span,
        .npc-forge-context-row-details article p,
        .npc-forge-background-spell-body span {
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          overflow-wrap: anywhere !important;
          word-break: normal !important;
          white-space: normal !important;
        }

        .npc-forge-context-choice-grid.feats button span {
          max-height: 12rem !important;
          overflow: auto !important;
          padding-right: 4px !important;
          line-height: 1.55 !important;
        }

        .npc-forge-background-spell-body > div {
          grid-template-columns: 92px minmax(0, 1fr) !important;
        }

        .npc-forge-section:has(> .npc-forge-roll-pool) {
          display: flex !important;
          flex-direction: column !important;
        }

        .npc-forge-section:has(> .npc-forge-roll-pool) > * {
          order: 10;
        }

        .npc-forge-section:has(> .npc-forge-roll-pool) > .npc-forge-section-heading {
          order: 0;
        }

        .npc-forge-section:has(> .npc-forge-roll-pool) > .npc-forge-segmented:not(.compact) {
          order: 1;
        }

        .npc-forge-section:has(> .npc-forge-roll-pool) > .npc-forge-ability-drop-grid {
          order: 2;
          margin-top: 14px;
        }

        .npc-forge-section:has(> .npc-forge-roll-pool) > .npc-forge-allocation-instruction {
          order: 3;
          margin: 10px 0 0;
        }

        .npc-forge-section:has(> .npc-forge-roll-pool) > .npc-forge-roll-pool {
          order: 4;
          margin-top: 10px !important;
        }

        .npc-forge-section:has(> .npc-forge-roll-pool) > .npc-forge-subheading {
          order: 5;
        }

        .npc-forge-section:has(> .npc-forge-roll-pool) > .npc-forge-segmented.compact {
          order: 6;
        }

        @media (max-width: 720px) {
          .npc-forge-background-spell-body > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
