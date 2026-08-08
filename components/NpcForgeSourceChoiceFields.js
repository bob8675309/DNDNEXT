import SourceChoiceFields from "./SourceChoiceFields";
import { sourceChoiceGroupsForPlacement, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";

export default function NpcForgeSourceChoiceFields({ placement, ownerType = "", title = "Required source choices", empty = null }) {
  const { state, toggleChoice, setChoice } = useNpcForgeSourceChoices();
  const groups = sourceChoiceGroupsForPlacement(state, placement).filter((group) => !ownerType || group.ownerType === ownerType);
  return <SourceChoiceFields
    groups={groups}
    selections={state.selections || {}}
    title={title}
    empty={empty}
    onToggle={toggleChoice}
    onSet={setChoice}
  />;
}
