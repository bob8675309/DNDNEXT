import NpcForgeContextPanelRefined from "./NpcForgeContextPanelRefined";
import NpcForgeClassGuide from "./NpcForgeClassGuide";

export default function NpcForgeContextPanel(props) {
  const activeClass = props?.detail?.type === "class" && props.detail.option
    ? props.detail.option
    : props?.stepKey === "class" || Number(props?.step) === 2
      ? props?.selectedClass
      : null;
  return activeClass
    ? <NpcForgeClassGuide selectedClass={activeClass} level={props?.draft?.level || 1} />
    : <NpcForgeContextPanelRefined {...props} />;
}
