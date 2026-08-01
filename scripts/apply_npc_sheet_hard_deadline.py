from pathlib import Path

path = Path("pages/npcs.js")
source = path.read_text(encoding="utf-8")

old_import = 'import { isCurrentNpcSelectionRequest, normalizeNpcSelectionKey } from "../utils/npcSelectionGuard";\n'
new_import = old_import + 'import { settleWithDeadline } from "../utils/settleWithDeadline";\n'
if old_import not in source:
    raise SystemExit("NPC selection guard import anchor not found")
if 'from "../utils/settleWithDeadline"' not in source:
    source = source.replace(old_import, new_import, 1)

old_loader = '''  const loadSelectedSheet = useCallback(async (key) => {
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
  }, []);
'''

new_loader = '''  const loadSelectedSheet = useCallback(async (key) => {
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
    const isCurrentRequest = () => isCurrentNpcSelectionRequest({
      activeKey: selectedKeyRef.current,
      requestedKey,
      activeRequestId: sheetRequestRef.current,
      requestId,
    });

    try {
      const request = supabase
        .from("character_sheets")
        .select("sheet")
        .eq("character_id", id)
        .abortSignal(controller.signal)
        .maybeSingle();
      const outcome = await settleWithDeadline(request, {
        timeoutMs: 8000,
        onTimeout: () => controller.abort(),
      });

      if (!isCurrentRequest()) return null;

      if (outcome.status === "timeout") {
        setSheetLoadError("The selected character sheet took too long to load.");
        return null;
      }

      if (outcome.status === "rejected") {
        if (!controller.signal.aborted) console.error(outcome.reason);
        setSheetLoadError(
          controller.signal.aborted
            ? "The selected character sheet took too long to load."
            : outcome.reason?.message || "The selected character sheet could not be loaded."
        );
        return null;
      }

      const { data, error } = outcome.value || {};
      if (error) {
        if (!isSupabaseMissingTable(error)) console.error(error);
        setSheetLoadError(error.message || "The selected character sheet could not be loaded.");
        return null;
      }

      const next = data?.sheet || {};
      setSheetLoadError("");
      setSheet(next);
      setSheetDraft(deepClone(next));
      setSheetEditMode(false);
      return next;
    } finally {
      if (sheetAbortRef.current === controller) sheetAbortRef.current = null;
      if (isCurrentRequest()) setSheetLoading(false);
    }
  }, []);
'''

if old_loader not in source:
    raise SystemExit("Current NPC sheet loader anchor not found")
source = source.replace(old_loader, new_loader, 1)

old_raw = '''                    <details className="mt-2">
                      <summary className="small" style={{ color: DIM, cursor: "pointer" }}>
                        View raw sheet JSON
                      </summary>
                      <pre
                        className="mt-2 p-2 rounded"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid ${BORDER}`,
                          color: "rgba(255,255,255,0.88)",
                        }}
                      >
                        {JSON.stringify(sheetDraft || {}, null, 2)}
                      </pre>
                    </details>
'''
new_raw = '''                    {!sheetLoading && !sheetLoadError ? (
                      <details className="mt-2">
                        <summary className="small" style={{ color: DIM, cursor: "pointer" }}>
                          View raw sheet JSON
                        </summary>
                        <pre
                          className="mt-2 p-2 rounded"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${BORDER}`,
                            color: "rgba(255,255,255,0.88)",
                          }}
                        >
                          {JSON.stringify(sheetDraft || {}, null, 2)}
                        </pre>
                      </details>
                    ) : null}
'''
if old_raw not in source:
    raise SystemExit("Raw sheet disclosure anchor not found")
source = source.replace(old_raw, new_raw, 1)

path.write_text(source, encoding="utf-8")
