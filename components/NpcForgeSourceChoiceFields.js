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
  const groups = sourceChoiceGroupsForPlacement(state, placement).filter((group) => {
    if (!ownerType) return true;
    if (group.ownerType === ownerType) return true;
    return ownerType === "feat" && Boolean(group.metadata?.surfaceWithFeatChoices);
  });
  const embeddedPlacement = placement === "species" || placement === "background";
  const effectiveTitle = ownerType === "feat" && groups.some((group) => group.metadata?.primaryFeatGrant)
    ? "Species feat and feat-granted choices"
    : title;

  useEffect(() => {
    setPreviewTarget(currentForgePreview());
  }, [placement, ownerType, groups.length]);

  // Species and Background choices are rendered inside their owning purple rule cards by
  // NpcForgeContextPanelRefined. Keeping this wrapper mounted preserves registration and
  // completion authority without repeating the same decisions in a second yellow panel.
  if (embeddedPlacement) return null;

  const fields = <SourceChoiceFields
    groups={groups}
    selections={state.selections || {}}
    title={effectiveTitle}
    empty={empty}
    onToggle={toggleChoice}
    onSet={setChoice}
  />;

  // Resolver-only source groups on later steps still belong in the right information rail.
  // Falling back inline preserves standalone/test rendering when no Forge preview exists.
  return previewTarget ? createPortal(fields, previewTarget) : fields;
}
