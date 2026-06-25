import fs from "node:fs";
import path from "node:path";

const rel = "components/NpcPanel.js";
const file = path.join(process.cwd(), rel);
let source = fs.readFileSync(file, "utf8");
const before = source;

function replaceIfPresent(search, replacement) {
  if (source.includes(search)) {
    source = source.replace(search, replacement);
  }
}

if (source.includes("portraitPickerOpen")) {
  if (!source.includes('import PortraitPickerModal from "./PortraitPickerModal";')) {
    replaceIfPresent(
      'import CharacterSheetPanel from "./CharacterSheetPanel";\n',
      'import CharacterSheetPanel from "./CharacterSheetPanel";\nimport PortraitPickerModal from "./PortraitPickerModal";\n'
    );
  }

  replaceIfPresent(
    '  const [inventoryAccess, setInventoryAccess] = useState({ checked: false, canView: false, canManage: false });\n  const [transferTargets, setTransferTargets] = useState([]);\n  const [lastRoll, setLastRoll] = useState(null);',
    '  const [inventoryAccess, setInventoryAccess] = useState({ checked: false, canView: false, canManage: false, canEdit: false });\n  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);\n  const [transferTargets, setTransferTargets] = useState([]);\n  const [lastRoll, setLastRoll] = useState(null);'
  );

  replaceIfPresent(
    '  const [inventoryAccess, setInventoryAccess] = useState({ checked: false, canView: false, canManage: false, canEdit: false });\n  const [transferTargets, setTransferTargets] = useState([]);\n  const [lastRoll, setLastRoll] = useState(null);',
    '  const [inventoryAccess, setInventoryAccess] = useState({ checked: false, canView: false, canManage: false, canEdit: false });\n  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);\n  const [transferTargets, setTransferTargets] = useState([]);\n  const [lastRoll, setLastRoll] = useState(null);'
  );

  source = source.replaceAll(
    'setInventoryAccess({ checked: true, canView: false, canManage: false });',
    'setInventoryAccess({ checked: true, canView: false, canManage: false, canEdit: false });'
  );

  source = source.replaceAll(
    'setInventoryAccess({ checked: true, canView: true, canManage: true });',
    'setInventoryAccess({ checked: true, canView: true, canManage: true, canEdit: true });'
  );

  replaceIfPresent(
    '      const can = !!data?.can_inventory || !!data?.can_edit;\n      setInventoryAccess({ checked: true, canView: can, canManage: can });',
    '      const can = !!data?.can_inventory || !!data?.can_edit;\n      setInventoryAccess({ checked: true, canView: can, canManage: can, canEdit: !!data?.can_edit });'
  );

  if (!source.includes("const canChangePortrait =")) {
    replaceIfPresent(
      '  const portrait = useMemo(() => resolveCharacterPortrait(view, supabase), [view]);\n  const equippedEquipmentText = useMemo(() => (equippedRows || []).map(pickItemName).filter(Boolean).join("\\n"), [equippedRows]);',
      '  const portrait = useMemo(() => resolveCharacterPortrait(view, supabase), [view]);\n  const canChangePortrait = !!isAdmin || !!inventoryAccess.canEdit;\n  const equippedEquipmentText = useMemo(() => (equippedRows || []).map(pickItemName).filter(Boolean).join("\\n"), [equippedRows]);'
    );
  }
}

if (source !== before) {
  fs.writeFileSync(file, source, "utf8");
  console.log("Patched NpcPanel portrait picker state hotfix.");
} else {
  console.log("NpcPanel portrait picker state hotfix already current.");
}
