import fs from "node:fs";

const path = "pages/npcs.js";
let source = fs.readFileSync(path, "utf8");

function replaceExact(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one anchor, found ${count}`);
  source = source.replace(before, after);
}

replaceExact(
`  const sheetRequestRef = useRef(0);
  const equipmentRequestRef = useRef(0);
  const notesRequestRef = useRef(0);

  // selected sheet + notes
  const [sheet, setSheet] = useState(null);
  const [sheetLoading, setSheetLoading] = useState(false);`,
`  const sheetRequestRef = useRef(0);
  const equipmentRequestRef = useRef(0);
  const notesRequestRef = useRef(0);
  const sheetAbortRef = useRef(null);

  // selected sheet + notes
  const [sheet, setSheet] = useState(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetLoadError, setSheetLoadError] = useState("");
  const [sheetReloadToken, setSheetReloadToken] = useState(0);`,
"sheet load state"
);

replaceExact(
`  const selectCharacterKey = useCallback((nextKey) => {
    const normalized = normalizeNpcSelectionKey(nextKey);
    if (selectedKeyRef.current === normalized) return;

    selectedKeyRef.current = normalized;
    sheetRequestRef.current += 1;
    equipmentRequestRef.current += 1;
    notesRequestRef.current += 1;

    // Clear every identity-bound surface in the same React batch as the
    // selection change. The next character must never inherit the prior
    // character's draft, armor, equipment, notes, or roll result.
    setSheet(null);
    setSheetDraft({});
    setSheetEditMode(false);
    setEquippedRows([]);
    setNotes([]);
    setLastRoll(null);
    setSheetLoading(Boolean(normalized));
    setSelectedKey(normalized || null);
  }, []);`,
`  const retrySelectedSheet = useCallback(() => {
    const normalized = normalizeNpcSelectionKey(selectedKeyRef.current);
    if (!normalized) return;

    sheetAbortRef.current?.abort();
    sheetRequestRef.current += 1;
    setSheetLoadError("");
    setSheetLoading(true);
    setSheetReloadToken((value) => value + 1);
  }, []);

  const selectCharacterKey = useCallback((nextKey) => {
    const normalized = normalizeNpcSelectionKey(nextKey);
    if (selectedKeyRef.current === normalized) return;

    sheetAbortRef.current?.abort();
    selectedKeyRef.current = normalized;
    sheetRequestRef.current += 1;
    equipmentRequestRef.current += 1;
    notesRequestRef.current += 1;

    // Clear every identity-bound surface in the same React batch as the
    // selection change. The next character must never inherit the prior
    // character's draft, armor, equipment, notes, or roll result.
    setSheet(null);
    setSheetDraft({});
    setSheetEditMode(false);
    setEquippedRows([]);
    setNotes([]);
    setLastRoll(null);
    setSheetLoadError("");
    setSheetLoading(Boolean(normalized));
    setSelectedKey(normalized || null);
  }, []);`,
"selection and retry transaction"
);

const oldLoader = `  const loadSelectedSheet = useCallback(async (key) => {
    const requestedKey = normalizeNpcSelectionKey(key);
    if (!requestedKey) {
      setSheetLoading(false);
      return null;
    }

    const parsed = parseKey(requestedKey);
    const id = parsed?.id || null;
    if (!id) {
      setSheetLoading(false);
      return null;
    }

    const requestId = ++sheetRequestRef.current;
    try {
      const { data, error } = await supabase
        .from("character_sheets")
        .select("sheet")
        .eq("character_id", id)
        .maybeSingle();

      if (!isCurrentNpcSelectionRequest({
        activeKey: selectedKeyRef.current,
        requestedKey,
        activeRequestId: sheetRequestRef.current,
        requestId,
      })) return null;

      if (error && !isSupabaseMissingTable(error)) console.error(error);

      const next = data?.sheet || {};
      setSheet(next);
      setSheetDraft(deepClone(next));
      setSheetEditMode(false);
      return next;
    } finally {
      if (isCurrentNpcSelectionRequest({
        activeKey: selectedKeyRef.current,
        requestedKey,
        activeRequestId: sheetRequestRef.current,
        requestId,
      })) setSheetLoading(false);
    }
  }, []);`;

const newLoader = `  const loadSelectedSheet = useCallback(async (key) => {
    const requestedKey = normalizeNpcSelectionKey(key);
    if (!requestedKey) {
      setSheetLoadError("");
      setSheetLoading(false);
      return null;
    }

    const parsed = parseKey(requestedKey);
    const id = parsed?.id || null;
    if (!id) {
      setSheetLoadError("The selected character does not have a valid sheet identity.");
      setSheetLoading(false);
      return null;
    }

    sheetAbortRef.current?.abort();
    const controller = new AbortController();
    sheetAbortRef.current = controller;
    const requestId = ++sheetRequestRef.current;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);
    const isCurrentRequest = () => isCurrentNpcSelectionRequest({
      activeKey: selectedKeyRef.current,
      requestedKey,
      activeRequestId: sheetRequestRef.current,
      requestId,
    });

    try {
      const { data, error } = await supabase
        .from("character_sheets")
        .select("sheet")
        .eq("character_id", id)
        .abortSignal(controller.signal)
        .maybeSingle();

      if (!isCurrentRequest()) return null;

      if (error) {
        if (!controller.signal.aborted && !isSupabaseMissingTable(error)) console.error(error);
        setSheetLoadError(
          timedOut
            ? "The selected character sheet took too long to load."
            : error.message || "The selected character sheet could not be loaded."
        );
        return null;
      }

      const next = data?.sheet || {};
      setSheetLoadError("");
      setSheet(next);
      setSheetDraft(deepClone(next));
      setSheetEditMode(false);
      return next;
    } catch (error) {
      if (!isCurrentRequest()) return null;
      if (!controller.signal.aborted) console.error(error);
      setSheetLoadError(
        timedOut
          ? "The selected character sheet took too long to load."
          : error?.message || "The selected character sheet could not be loaded."
      );
      return null;
    } finally {
      clearTimeout(timeoutId);
      if (sheetAbortRef.current === controller) sheetAbortRef.current = null;
      if (isCurrentRequest()) setSheetLoading(false);
    }
  }, []);`;
replaceExact(oldLoader, newLoader, "bounded sheet loader");

replaceExact(
`  /* reload selected sheet + notes when selection changes */
  useEffect(() => {
    const requestedKey = normalizeNpcSelectionKey(selectedKey);
    if (!requestedKey) {
      setSheetLoading(false);
      return;
    }

    void Promise.allSettled([
      loadSelectedSheet(requestedKey),
      loadSelectedNotes(requestedKey),
    ]);
  }, [selectedKey, loadSelectedSheet, loadSelectedNotes]);`,
`  /* Reload the selected sheet independently from notes. Notes availability
     must never restart or supersede the active sheet request. */
  useEffect(() => {
    const requestedKey = normalizeNpcSelectionKey(selectedKey);
    if (!requestedKey) {
      setSheetLoadError("");
      setSheetLoading(false);
      return;
    }

    void loadSelectedSheet(requestedKey);
  }, [selectedKey, sheetReloadToken, loadSelectedSheet]);

  useEffect(() => {
    const requestedKey = normalizeNpcSelectionKey(selectedKey);
    if (!requestedKey) return;
    void loadSelectedNotes(requestedKey);
  }, [selectedKey, loadSelectedNotes]);`,
"separate sheet and notes effects"
);

replaceExact(
`                    onClick={() => selectCharacterKey(keyOf(r.type, r.id))}`,
`                    onClick={() => {
                      if (active && (sheetLoading || sheetLoadError)) retrySelectedSheet();
                      else selectCharacterKey(keyOf(r.type, r.id));
                    }}`,
"active-row retry"
);

replaceExact(
`                    {sheetLoading ? (
                      <div className="p-3 text-muted" role="status">Loading the selected character sheet…</div>
                    ) : (
                    <CharacterSheetPanel`,
`                    {sheetLoading ? (
                      <div className="p-3 text-muted" role="status">Loading the selected character sheet…</div>
                    ) : sheetLoadError ? (
                      <div className="p-3" role="alert">
                        <div className="text-warning mb-2">{sheetLoadError}</div>
                        <button type="button" className="btn btn-sm btn-outline-light" onClick={retrySelectedSheet}>
                          Retry sheet
                        </button>
                      </div>
                    ) : (
                    <CharacterSheetPanel`,
"sheet recovery UI"
);

fs.writeFileSync(path, source);
console.log("Applied NPC sheet load timeout and retry recovery.");
