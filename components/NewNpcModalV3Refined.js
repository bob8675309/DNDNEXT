import { useEffect, useRef } from "react";
import NpcForgeEquipmentStep from "./NpcForgeEquipmentStep";
import NpcForgeFeatChoiceRegistrar from "./NpcForgeFeatChoiceRegistrar";
import NpcForgeHumanVersatileRegistrar from "./NpcForgeHumanVersatileRegistrar";
import NpcForgePortraitPickerModal from "./NpcForgePortraitPickerModal";
import NpcForgeStepContent from "./NpcForgeStepContent";
import { NpcForgeControllerProvider } from "./NpcForgeControllerContext";
import useNpcForgeTrainingRoutedController from "./useNpcForgeTrainingRoutedController";

const RESET_APP_WINDOW_EVENT = "dndnext:reset-app-window";
const FORGE_WINDOW_STYLE_PROPERTIES = ["position", "left", "top", "width", "height", "max-width", "max-height", "right", "bottom", "transform"];
const HEADER_RESET_INTERACTIVE_SELECTOR = "button,a,input,textarea,select,option,label,summary,[role='button'],[contenteditable='true'],[contenteditable='']";
const DOUBLE_TAP_WINDOW_MS = 440;
const DOUBLE_TAP_DISTANCE_PX = 40;

function requestForgeWindowReset() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RESET_APP_WINDOW_EVENT, { detail: { scope: "forge" } }));
}

function resetForgeWindowElement(modal) {
  if (!modal) return;
  modal.classList.remove("is-app-windowed", "is-app-window-dragging", "is-app-window-resizing");
  delete modal.dataset.appWindowed;
  FORGE_WINDOW_STYLE_PROPERTIES.forEach((property) => modal.style.removeProperty(property));
}

function isInteractiveHeaderTarget(target) {
  return Boolean(target?.closest?.(HEADER_RESET_INTERACTIVE_SELECTOR));
}

// Compatibility/source ownership markers for the shared Forge validators:
// const STEP_LABELS = Object.freeze(["Species", "Background", "Class", "Abilities", "Training", "Identity", "Story", "Review"]);
// step === 5 Identity; step === 6 Story
// Starting level may be set from 1 to 20.
// portraitLibraryId visualAssetId creationRequestId creation_request_id recoverCreatedCharacter
// You can safely retry. Choose a portrait for this character. Generate NPC story & world fit
// identity: { name: draft.name, role: draft.role, affiliation: draft.affiliation
// spriteAsset: selection.spriteAsset || null; supabase.rpc("create_character_v1"
// resolveBackgroundFeatOptions; const selectedBackgroundFeat = useMemo; const backgroundSpellList = selectedBackground?.spellList || [];
// const backgroundExpandedSpellNames = selectedBackground?.expandedSpellNames || []; originFeat: selectedBackgroundFeat?.name || null;
// backgroundFeatChoice: selectedBackgroundFeat?.name || null; backgroundExpandedSpells: backgroundExpandedSpellNames; backgroundSpellList

export default function NewNpcModalV3Refined({ show, onClose, onCreated, locations = [], mode = "npc", createCharacter = null, onReset = null }) {
  const controller = useNpcForgeTrainingRoutedController({ show, onClose, onCreated, locations, mode, createCharacter, onReset });
  const { playerMode, STEP_LABELS, step, setStep, setDetail, setError, stepKey, creating, loadingCatalogs, error, handleClose, handleReset, handleBack, handleNext, handleCreate, draft, equipmentModel, patch, portraitPickerOpen, setPortraitPickerOpen, choosePortrait, speciesOptions, chooseSpecies } = controller;
  const catalogLoadSeenRef = useRef(false);
  const modalRef = useRef(null);
  const lastHeaderTapRef = useRef({ time: 0, x: 0, y: 0 });

  function restoreForgeGeometry(event = null) {
    if (!playerMode || creating || isInteractiveHeaderTarget(event?.target)) return;
    resetForgeWindowElement(modalRef.current);
    requestForgeWindowReset();
  }

  function handleHeaderDoubleClick(event) {
    if (event.button != null && event.button !== 0) return;
    restoreForgeGeometry(event);
  }

  function handleHeaderPointerUp(event) {
    if (!playerMode || creating || !["touch", "pen"].includes(String(event.pointerType || "")) || isInteractiveHeaderTarget(event.target)) return;
    const now = Date.now();
    const previous = lastHeaderTapRef.current;
    const dx = Number(event.clientX || 0) - Number(previous.x || 0);
    const dy = Number(event.clientY || 0) - Number(previous.y || 0);
    const closeEnough = Math.hypot(dx, dy) <= DOUBLE_TAP_DISTANCE_PX;
    if (previous.time && now - previous.time <= DOUBLE_TAP_WINDOW_MS && closeEnough) {
      lastHeaderTapRef.current = { time: 0, x: 0, y: 0 };
      restoreForgeGeometry(event);
      event.preventDefault();
      return;
    }
    lastHeaderTapRef.current = { time: now, x: Number(event.clientX || 0), y: Number(event.clientY || 0) };
  }

  useEffect(() => {
    if (!show || typeof window === "undefined") return undefined;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      resetForgeWindowElement(modalRef.current);
      requestForgeWindowReset();
      secondFrame = window.requestAnimationFrame(() => {
        resetForgeWindowElement(modalRef.current);
        requestForgeWindowReset();
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [show]);

  useEffect(() => {
    if (!show || typeof document === "undefined") return undefined;
    function closeCompletedChoiceOnOutsidePointer(event) {
      const modal = modalRef.current;
      if (!modal) return;
      modal.querySelectorAll("details.npc-forge-species-fact-choice.is-complete[open]").forEach((details) => {
        if (!details.contains(event.target)) details.open = false;
      });
    }
    document.addEventListener("pointerdown", closeCompletedChoiceOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeCompletedChoiceOnOutsidePointer, true);
  }, [show]);

  useEffect(() => {
    if (!show) {
      catalogLoadSeenRef.current = false;
      lastHeaderTapRef.current = { time: 0, x: 0, y: 0 };
      return;
    }
    if (loadingCatalogs) {
      catalogLoadSeenRef.current = true;
      return;
    }
    if (!catalogLoadSeenRef.current || draft.speciesOptionId) return;
    const initialSpecies = (speciesOptions || []).find((option) => !playerMode || !/^human\s*\(/i.test(String(option?.name || "").trim()));
    if (initialSpecies) chooseSpecies(initialSpecies);
  }, [show, loadingCatalogs, draft.speciesOptionId, speciesOptions, playerMode, chooseSpecies]);

  useEffect(() => {
    if (!show) return undefined;
    function onEscape(event) {
      if ((event.key !== "Escape" && event.code !== "Escape" && event.keyCode !== 27) || creating) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      handleClose();
    }
    document.addEventListener("keydown", onEscape, true);
    return () => document.removeEventListener("keydown", onEscape, true);
  }, [show, creating, handleClose]);

  if (!show) return null;
  return <NpcForgeControllerProvider controller={controller}><div className="npc-forge-backdrop" role="presentation"><div ref={modalRef} className={`npc-forge-modal npc-forge-modal-v2 ${playerMode ? "is-player-mode" : "is-npc-mode"}`} role="dialog" aria-modal="true">
    <NpcForgeFeatChoiceRegistrar playerMode={playerMode} controller={controller} />
    <NpcForgeHumanVersatileRegistrar playerMode={playerMode} controller={controller} />
    <header className="npc-forge-header" onDoubleClick={handleHeaderDoubleClick} onPointerUp={handleHeaderPointerUp}><div>{playerMode ? <h2 title="Double-click or double-tap this header to restore the Forge window">Character Forge</h2> : <><div className="npc-forge-kicker">Canonical character system</div><h2>NPC Forge</h2><p>Build the rules first, then finish identity and placement.</p></>}</div><div className="npc-forge-header-actions"><button type="button" className="btn btn-sm btn-outline-warning" onClick={handleReset} disabled={creating}>Reset</button><button type="button" className="btn btn-sm btn-outline-light" onClick={handleClose} disabled={creating}>Close</button></div></header>
    <nav className="npc-forge-steps" aria-label="Character creation steps">{STEP_LABELS.map((label, index) => <button key={label} type="button" className={`${index === step ? "is-current" : ""} ${index < step ? "is-complete" : ""}`} onClick={() => { if (index <= step) { setStep(index); setDetail(null); setError(""); } }} disabled={creating || index > step}><span>{index + 1}</span>{label}</button>)}</nav>
    {stepKey === "equipment" ? <NpcForgeEquipmentStep model={equipmentModel} selection={draft.startingEquipment || {}} onChange={(startingEquipment) => patch({ startingEquipment })} /> : <NpcForgeStepContent controller={controller} />}
    {error ? <div className="npc-forge-error" role="alert">{error}</div> : null}
    <footer className="npc-forge-footer"><button type="button" className="btn btn-outline-light" onClick={handleClose} disabled={creating}>Cancel</button><div>{step > 0 ? <button type="button" className="btn btn-outline-light" onClick={handleBack} disabled={creating}>Back</button> : null}{step < STEP_LABELS.length - 1 ? <button type="button" className="btn btn-primary" onClick={handleNext} disabled={creating || loadingCatalogs}>Continue</button> : <button type="button" className="btn btn-success" onClick={handleCreate} disabled={creating}>{creating ? "Forging Character..." : playerMode ? "Create Player Character" : `Create ${draft.kind === "merchant" ? "Merchant" : "NPC"}`}</button>}</div></footer>
    <NpcForgePortraitPickerModal show={portraitPickerOpen} currentPortraitId={draft.portraitLibraryId} onClose={() => setPortraitPickerOpen(false)} onSelect={choosePortrait} />
    <style jsx global>{`
      .npc-forge-modal-v2 .npc-forge-body{grid-template-columns:minmax(0,57fr) minmax(470px,43fr)}.npc-forge-body.npc-forge-step-abilities{grid-template-columns:minmax(0,75fr) minmax(320px,25fr)}.npc-forge-body.npc-forge-step-spells{grid-template-columns:minmax(0,72fr) minmax(300px,28fr)}.npc-forge-body.npc-forge-step-identity,.npc-forge-body.npc-forge-step-story,.npc-forge-body.npc-forge-step-review{grid-template-columns:1fr}.npc-forge-body.npc-forge-step-identity .npc-forge-preview,.npc-forge-body.npc-forge-step-story .npc-forge-preview,.npc-forge-body.npc-forge-step-review .npc-forge-preview{display:none}.npc-forge-modal-v2.is-player-mode:not(.is-app-windowed){width:min(1540px,calc(100vw - 40px));max-width:none}.npc-forge-modal-v2.is-player-mode{border-radius:13px}.npc-forge-modal-v2.is-player-mode .npc-forge-header{align-items:center;padding:10px 14px}.npc-forge-modal-v2.is-player-mode .npc-forge-header>div:first-child{display:flex;align-items:center;min-height:32px}.npc-forge-modal-v2.is-player-mode .npc-forge-header h2{margin:0}.npc-forge-modal-v2.is-player-mode .npc-forge-steps{padding-inline:14px}.npc-forge-modal-v2.is-player-mode .npc-forge-workspace{padding:14px}.npc-forge-modal-v2.is-player-mode .npc-forge-preview{padding:12px 14px}.npc-forge-modal-v2.is-player-mode .npc-forge-footer{padding:10px 14px max(10px,env(safe-area-inset-bottom))}.npc-forge-workspace-note{padding:11px 13px;border-left:3px solid #58d6c7;border-radius:8px;color:rgba(255,255,255,.66);background:rgba(88,214,199,.07);font-size:.76rem;line-height:1.5}
      .npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"]>summary{min-height:42px;padding:6px 9px}.npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"] .npc-forge-species-fact-copy{gap:1px}.npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"] .npc-forge-species-fact-copy small{font-size:.5rem}.npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"] .npc-forge-species-fact-copy strong{font-size:.6rem;line-height:1.25}.npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"] .npc-forge-species-fact-choice__body{gap:4px;padding:5px 8px 7px}.npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"] .npc-forge-species-fact-choice__body>p{margin:0;color:rgba(255,255,255,.56);font-size:.5rem;line-height:1.3}.npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"] .npc-forge-embedded-choice{gap:4px;margin-top:2px}.npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"] .npc-forge-embedded-choice.is-compact>section{gap:4px;padding:5px 6px}.npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"] .npc-forge-embedded-choice__field{gap:4px}.npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"] .npc-forge-embedded-choice__slots{grid-template-columns:repeat(2,minmax(120px,1fr));gap:5px}.npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"] .npc-forge-embedded-choice__slots label{gap:2px}.npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"] .npc-forge-embedded-choice__slots label>span{font-size:.49rem}.npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"] .npc-forge-embedded-choice__slots select{padding:4px 6px;font-size:.56rem}
      .npc-forge-roll-card.refined{appearance:none;width:100%;cursor:grab;text-align:center}.npc-forge-roll-card.refined.is-selected{border-color:#a86cff;box-shadow:0 0 0 3px rgba(168,108,255,.18)}.npc-forge-allocation-instruction{margin:12px 0 8px;padding:9px 11px;border-radius:8px;color:#d9c5fa;background:rgba(126,72,199,.1);font-size:.72rem}.npc-forge-ability-drop-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.npc-forge-ability-drop-grid button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 10px;min-height:82px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:11px;color:rgba(255,255,255,.72);background:rgba(255,255,255,.026);text-align:left}.npc-forge-ability-drop-grid strong{grid-row:1/3;grid-column:2;color:#fff3ce;font-size:1.45rem}.npc-forge-ability-drop-grid em{grid-column:1/-1;font-size:.65rem;font-style:normal}.npc-forge-story-actions button{padding:7px 11px;border:1px solid rgba(88,214,199,.44);border-radius:8px;color:#c9fff7;background:rgba(42,136,124,.12)}.npc-forge-identity-art{display:grid;grid-template-columns:110px minmax(0,1fr);gap:14px;align-items:center;padding:12px;border:1px solid rgba(168,108,255,.28);border-radius:11px;background:rgba(126,72,199,.07)}.npc-forge-identity-art>img,.npc-forge-identity-art-empty{width:110px;height:145px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,.12)}.npc-forge-identity-art>div{display:grid;gap:6px}.npc-forge-identity-art button{justify-self:start}@media(max-width:1220px){.npc-forge-modal-v2 .npc-forge-body{grid-template-columns:minmax(0,3fr) minmax(380px,2fr)}}@media(max-width:980px){.npc-forge-modal-v2 .npc-forge-body,.npc-forge-body.npc-forge-step-abilities,.npc-forge-body.npc-forge-step-spells,.npc-forge-body.npc-forge-step-equipment{grid-template-columns:1fr}.npc-forge-ability-drop-grid{grid-template-columns:repeat(2,minmax(0,1fr)}}@media(max-width:720px){.npc-forge-body.npc-forge-step-species.is-player-mode .npc-forge-species-fact-choice[data-icon-kind="languages"] .npc-forge-embedded-choice__slots{grid-template-columns:1fr}.npc-forge-ability-drop-grid{grid-template-columns:1fr}.npc-forge-identity-art{grid-template-columns:1fr}}
    `}</style>
  </div></div></NpcForgeControllerProvider>;
}
