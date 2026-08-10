import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SourceChoiceFields from "./SourceChoiceFields";
import { sourceChoiceGroupsForPlacement, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";

function currentForgePreview() {
  if (typeof document === "undefined") return null;
  const modals = [...document.querySelectorAll(".npc-forge-modal-v2")];
  const activeModal = modals.find((modal) => modal.getClientRects().length > 0) || modals[0] || null;
  return activeModal?.querySelector(".npc-forge-preview") || null;
}

export default function NpcForgeSourceChoiceFields({ placement, ownerType = "", title = "Required source choices", empty = null }) {
  const { state, toggleChoice, setChoice } = useNpcForgeSourceChoices();
  const [previewTarget, setPreviewTarget] = useState(null);
  const groups = sourceChoiceGroupsForPlacement(state, placement).filter((group) => !ownerType || group.ownerType === ownerType);

  useEffect(() => {
    setPreviewTarget(currentForgePreview());
  }, [placement, ownerType, groups.length]);

  const fields = <SourceChoiceFields
    groups={groups}
    selections={state.selections || {}}
    title={title}
    empty={empty}
    onToggle={toggleChoice}
    onSet={setChoice}
  />;

  // Player Forge keeps source-owned decision panels in the right information rail.
  // Falling back inline preserves standalone/test rendering when no Forge preview exists.
  return previewTarget ? createPortal(fields, previewTarget) : fields;
}
