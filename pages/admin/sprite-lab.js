import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "../../styles/SpriteProductionLab.module.css";
import { supabase } from "../../utils/supabaseClient";
import {
  SPRITE_COLUMNS,
  SPRITE_DIRECTION_LABELS,
  SPRITE_DIRECTION_ORDER,
  SPRITE_FPS,
  SPRITE_FRAME_HEIGHT,
  SPRITE_FRAME_WIDTH,
  SPRITE_ROWS,
  SPRITE_SHEET_HEIGHT,
  SPRITE_SHEET_WIDTH,
  SPRITE_WALK_SEQUENCE,
  spriteCellStyle,
  spriteRuntimeMetadata,
  validateSpriteDimensions,
  validateSpriteTransparency,
} from "../../utils/spriteProductionContract";

function inspectImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Choose a PNG sprite sheet."));
      return;
    }
    if (file.type !== "image/png" && !/\.png$/i.test(file.name || "")) {
      reject(new Error("Sprite sheets must be PNG files."));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const dimensionErrors = validateSpriteDimensions(image.naturalWidth, image.naturalHeight);
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const alphaValues = [];
        for (let index = 3; index < pixels.length; index += 64) alphaValues.push(pixels[index]);
        const transparencyErrors = validateSpriteTransparency(alphaValues);
        resolve({
          objectUrl,
          width: image.naturalWidth,
          height: image.naturalHeight,
          dimensionErrors,
          transparencyErrors,
          valid: dimensionErrors.length === 0 && transparencyErrors.length === 0,
        });
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode the PNG."));
    };
    image.src = objectUrl;
  });
}

function SpriteFrame({ imageUrl, row, column, scale = 2 }) {
  const frameStyle = spriteCellStyle({ row, column, scale });
  return (
    <span
      className={styles.spriteFrame}
      style={{
        ...frameStyle,
        backgroundImage: imageUrl ? `url(${imageUrl})` : "none",
      }}
      aria-hidden="true"
    />
  );
}

export default function SpriteProductionLabPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inspection, setInspection] = useState(null);
  const [error, setError] = useState("");
  const [walking, setWalking] = useState(true);
  const [frameTick, setFrameTick] = useState(0);
  const [scale, setScale] = useState(2);
  const [checks, setChecks] = useState({
    directions: false,
    pivots: false,
    silhouettes: false,
    loop: false,
    equipment: false,
    smallSize: false,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      if (!sessionData?.session?.user) {
        setAuthChecked(true);
        return;
      }
      const { data } = await supabase.rpc("is_admin");
      if (!active) return;
      setIsAdmin(Boolean(data));
      setAuthChecked(true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!walking || !inspection?.objectUrl) return undefined;
    const interval = Math.max(80, Math.round(1000 / SPRITE_FPS));
    const timer = setInterval(() => setFrameTick((value) => value + 1), interval);
    return () => clearInterval(timer);
  }, [inspection?.objectUrl, walking]);

  useEffect(() => () => {
    if (inspection?.objectUrl) URL.revokeObjectURL(inspection.objectUrl);
  }, [inspection?.objectUrl]);

  const currentColumn = walking
    ? SPRITE_WALK_SEQUENCE[frameTick % SPRITE_WALK_SEQUENCE.length]
    : 0;

  const allManualChecksPass = useMemo(
    () => Object.values(checks).every(Boolean),
    [checks]
  );

  async function chooseFile(event) {
    const file = event.target.files?.[0] || null;
    setError("");
    setFrameTick(0);
    setChecks({ directions: false, pivots: false, silhouettes: false, loop: false, equipment: false, smallSize: false });
    if (inspection?.objectUrl) URL.revokeObjectURL(inspection.objectUrl);
    setInspection(null);
    if (!file) return;
    try {
      setInspection(await inspectImage(file));
    } catch (nextError) {
      setError(nextError.message || "Sprite inspection failed.");
    }
  }

  function patchCheck(key) {
    setChecks((current) => ({ ...current, [key]: !current[key] }));
  }

  function downloadMetadata() {
    const payload = JSON.stringify({
      name: "Dawn Whiteflame — production prototype",
      sheet_width: SPRITE_SHEET_WIDTH,
      sheet_height: SPRITE_SHEET_HEIGHT,
      columns: SPRITE_COLUMNS,
      rows: SPRITE_ROWS,
      ...spriteRuntimeMetadata(),
      manual_qa: checks,
    }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "dawn-whiteflame-sprite-metadata.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!authChecked) return <main className={styles.page}>Checking admin access…</main>;
  if (!isAdmin) return <main className={styles.page}><h1>Sprite Production Lab</h1><p>Admin access is required.</p></main>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Sprite Production Lab</h1>
          <p>
            Canonical DNDNext atlas: 4 columns × 8 rows, 64×64 cells, transparent PNG. Row order is South, Southwest,
            West, Northwest, North, Northeast, East, Southeast. Column 1 is idle; columns 2–4 are walk frames.
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link href="/admin/sprite-assets" className="btn btn-sm btn-outline-light">Sprite Library</Link>
          <Link href="/admin" className="btn btn-sm btn-outline-light">Admin</Link>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.controls}>
          <label>
            Production PNG
            <input type="file" accept="image/png,.png" onChange={chooseFile} />
          </label>
          <label>
            Preview scale
            <select value={scale} onChange={(event) => setScale(Number(event.target.value))}>
              <option value={1}>1× — runtime pixels</option>
              <option value={2}>2× — QA</option>
              <option value={3}>3× — close inspection</option>
            </select>
          </label>
          <button type="button" onClick={() => { setWalking((value) => !value); setFrameTick(0); }} disabled={!inspection?.valid}>
            {walking ? "Show idle" : "Animate walk"}
          </button>
          <button type="button" onClick={downloadMetadata} disabled={!inspection?.valid || !allManualChecksPass}>
            Download approved metadata
          </button>
        </div>

        {error ? <div className={`${styles.statusItem} ${styles.fail}`}>{error}</div> : null}
        {inspection ? (
          <div className={styles.statusGrid}>
            <div className={`${styles.statusItem} ${inspection.dimensionErrors.length ? styles.fail : styles.pass}`}>
              Dimensions: {inspection.width}×{inspection.height}px — {inspection.dimensionErrors.length ? inspection.dimensionErrors.join(" ") : "PASS"}
            </div>
            <div className={`${styles.statusItem} ${inspection.transparencyErrors.length ? styles.fail : styles.pass}`}>
              Transparency: {inspection.transparencyErrors.length ? inspection.transparencyErrors.join(" ") : "PASS"}
            </div>
            <div className={`${styles.statusItem} ${inspection.valid ? styles.pass : styles.fail}`}>
              Automatic gate: {inspection.valid ? "PASS" : "FAIL"}
            </div>
            <div className={`${styles.statusItem} ${allManualChecksPass ? styles.pass : styles.fail}`}>
              Manual QA: {allManualChecksPass ? "APPROVED" : "INCOMPLETE"}
            </div>
          </div>
        ) : null}
      </section>

      <section className={styles.panel}>
        <h2 className="h5">Column 1 directional spin test</h2>
        <p className={styles.note}>Read only the idle frames from left to right. The figure must rotate smoothly around one fixed vertical axis with no duplicated facing.</p>
        <div className={styles.firstColumn}>
          {SPRITE_DIRECTION_ORDER.map((direction, row) => (
            <div className={styles.idleCell} key={direction}>
              <div className={styles.previewStage}>
                <SpriteFrame imageUrl={inspection?.objectUrl} row={row} column={0} scale={1.5} />
              </div>
              <span>{row + 1}. {SPRITE_DIRECTION_LABELS[direction]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className="h5">Eight-row animation test</h2>
        <p className={styles.note}>All rows use the same frame clock. Watch for foot sliding, body-size changes, weapon-length drift, hand swapping, or snapping at the loop boundary.</p>
        <div className={styles.directionGrid}>
          {SPRITE_DIRECTION_ORDER.map((direction, row) => (
            <article className={styles.directionCard} key={direction}>
              <div className={styles.directionTitle}>
                <strong>{SPRITE_DIRECTION_LABELS[direction]}</strong>
                <span>row {row + 1} · frame {currentColumn + 1}</span>
              </div>
              <div className={styles.previewStage}>
                <SpriteFrame imageUrl={inspection?.objectUrl} row={row} column={currentColumn} scale={scale} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className="h5">Manual approval gate</h2>
        <div className={styles.checklist}>
          <label><input type="checkbox" checked={checks.directions} onChange={() => patchCheck("directions")} />Column 1 reads S → SW → W → NW → N → NE → E → SE with no repeated facing.</label>
          <label><input type="checkbox" checked={checks.pivots} onChange={() => patchCheck("pivots")} />Feet remain on a consistent baseline and the body stays centered in every cell.</label>
          <label><input type="checkbox" checked={checks.silhouettes} onChange={() => patchCheck("silhouettes")} />Every direction has a distinct readable silhouette at runtime size.</label>
          <label><input type="checkbox" checked={checks.loop} onChange={() => patchCheck("loop")} />The 0 → 1 → 2 → 3 → 2 → 1 walk loop has no visible snap or foot slide.</label>
          <label><input type="checkbox" checked={checks.equipment} onChange={() => patchCheck("equipment")} />Staff, weapon hand, costume details, and asymmetric features remain consistent across all directions.</label>
          <label><input type="checkbox" checked={checks.smallSize} onChange={() => patchCheck("smallSize")} />The character remains readable at 1× battle-board size without blur or detail flicker.</label>
        </div>
      </section>
    </main>
  );
}
