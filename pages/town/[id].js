import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import TownSheet from "../../components/TownSheet";
import { supabase } from "../../utils/supabaseClient";
import { pickId } from "../../utils/townData";

function normalizeMapRow(row) {
  return {
    id: row?.id,
    key: row?.key || row?.id,
    name: row?.name,
    x: Number(row?.x ?? 50),
    y: Number(row?.y ?? 50),
    tone: row?.tone || "stone",
    targetPanel: row?.target_panel || null,
    category: row?.category || null,
    labelType: row?.label_type || "location",
    notes: row?.notes || null,
    isVisible: row?.is_visible !== false,
  };
}

function objectPathFromStored(path) {
  if (!path) return "";
  const trimmed = String(path).trim();
  if (!trimmed) return "";
  return trimmed.replace(/^town-maps\//i, "").replace(/^\/+/, "");
}

async function getImageDimensions(file) {
  if (!file) return { width: null, height: null };
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: null, height: null });
    };
    img.src = objectUrl;
  });
}

export default function TownPage() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [location, setLocation] = useState(null);
  const [rosterChars, setRosterChars] = useState([]);
  const [quests, setQuests] = useState([]);
  const [storedLabels, setStoredLabels] = useState([]);
  const [pendingMapFile, setPendingMapFile] = useState(null);
  const [mapFileInputKey, setMapFileInputKey] = useState(0);
  const [mapApplyState, setMapApplyState] = useState({ status: "idle", message: "" });

  const mapImageUrl = useMemo(() => {
    const objectPath = objectPathFromStored(location?.town_map_image_path);
    if (!objectPath) return null;
    try {
      const { data } = supabase.storage.from("town-maps").getPublicUrl(objectPath);
      return data?.publicUrl || null;
    } catch {
      return null;
    }
  }, [location?.town_map_image_path]);

  const imageNaturalSize = useMemo(
    () => ({
      width: Number(location?.town_map_image_width || 0) || null,
      height: Number(location?.town_map_image_height || 0) || null,
    }),
    [location?.town_map_image_width, location?.town_map_image_height]
  );

  const questKeys = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location?.quests]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getSession();
        const user = authData?.session?.user || null;
        let admin = false;
        if (user?.id) {
          const { data: isAdminRpc } = await supabase.rpc("is_admin", { uid: user.id });
          admin = !!isAdminRpc;
        }
        if (alive) setIsAdmin(admin);

        const { data: loc, error: locErr } = await supabase.from("locations").select("*").eq("id", id).single();
        if (locErr) throw locErr;
        if (!alive) return;
        setLocation(loc);

        const { data: rosterData } = await supabase
          .from("characters")
          .select("id,name,kind,race,role,affiliation,status,state,location_id,last_known_location_id,projected_destination_id,is_hidden,map_icon_id")
          .in("kind", ["npc", "merchant"])
          .eq("location_id", id)
          .order("name", { ascending: true });
        if (!alive) return;
        setRosterChars(Array.isArray(rosterData) ? rosterData : []);

        const rawQuestKeys = Array.isArray(loc?.quests) ? loc.quests.map(pickId).filter(Boolean) : [];
        if (rawQuestKeys.length) {
          const { data: questData } = await supabase.from("quests").select("id, title, status").in("id", rawQuestKeys);
          if (!alive) return;
          const byId = new Map((questData || []).map((q) => [q.id, q]));
          setQuests(rawQuestKeys.map((qid) => byId.get(qid)).filter(Boolean));
        } else {
          setQuests([]);
        }

        const { data: labelRows, error: labelErr } = await supabase
          .from("town_map_labels")
          .select("*")
          .eq("location_id", id)
          .order("sort_order", { ascending: true });
        if (labelErr) console.warn("town_map_labels load skipped", labelErr.message);
        if (!alive) return;
        setStoredLabels((labelRows || []).map(normalizeMapRow));
      } catch (err) {
        console.error("TownPage load failed", err);
        if (alive) setLocation(null);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  async function handleSaveMapData({ labels }) {
    if (!id) return;
    const labelRows = (labels || []).map((item, idx) => ({
      id: String(item.id || "").includes("-") && String(item.id).startsWith(item.labelType || "") ? null : item.id,
      location_id: id,
      key: item.key || item.id,
      name: item.name,
      x: Number(item.x ?? 50),
      y: Number(item.y ?? 50),
      tone: item.tone || "stone",
      target_panel: item.labelType === "location" ? item.targetPanel || null : null,
      category: item.category || null,
      label_type: item.labelType || "location",
      notes: item.notes || null,
      is_visible: item.isVisible !== false,
      sort_order: idx,
    }));

    const { error: delLabelErr } = await supabase.from("town_map_labels").delete().eq("location_id", id);
    if (delLabelErr) throw delLabelErr;

    if (labelRows.length) {
      const { error: insLabelErr } = await supabase.from("town_map_labels").insert(labelRows);
      if (insLabelErr) throw insLabelErr;
    }

    setStoredLabels(labels);
  }

  function handleSelectMapImage(event) {
    const file = event?.target?.files?.[0] || null;
    if (!file) {
      setPendingMapFile(null);
      setMapApplyState({ status: "idle", message: "" });
      return;
    }

    setPendingMapFile(file);
    setMapApplyState({
      status: "selected",
      message: `Selected ${file.name}. Click Apply Map to upload and switch the town map.`,
    });
  }

  function handleClearPendingMap() {
    setPendingMapFile(null);
    setMapFileInputKey((v) => v + 1);
    setMapApplyState({ status: "idle", message: "" });
  }

  async function handleApplyMapImage() {
    if (!pendingMapFile || !id) return;
    const file = pendingMapFile;
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const objectPath = `town-${id}-${Date.now()}.${ext}`;
    setMapApplyState({ status: "uploading", message: `Uploading ${file.name}...` });

    try {
      const dims = await getImageDimensions(file);

      const { error: uploadErr } = await supabase.storage
        .from("town-maps")
        .upload(objectPath, file, { upsert: true, contentType: file.type || undefined });
      if (uploadErr) throw uploadErr;

      const prevPath = objectPathFromStored(location?.town_map_image_path);
      const { data: updated, error: updErr } = await supabase
        .from("locations")
        .update({
          town_map_image_path: objectPath,
          town_map_image_width: dims.width,
          town_map_image_height: dims.height,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (updErr) throw updErr;

      if (prevPath && prevPath !== objectPath) {
        await supabase.storage.from("town-maps").remove([prevPath]).catch(() => null);
      }

      setLocation(updated);
      setPendingMapFile(null);
      setMapFileInputKey((v) => v + 1);
      setMapApplyState({ status: "success", message: `Applied new town map: ${file.name}` });
    } catch (err) {
      console.error("Town map upload failed", err);
      setMapApplyState({
        status: "error",
        message: err?.message || "Town map upload failed. Check storage permissions and the locations table update.",
      });
    }
  }

  async function handleDeleteMapImage() {
    if (!id) return;
    setMapApplyState({ status: "deleting", message: "Removing stored town map..." });
    try {
      const prevPath = objectPathFromStored(location?.town_map_image_path);
      if (prevPath) {
        await supabase.storage.from("town-maps").remove([prevPath]).catch(() => null);
      }
      const { data: updated, error } = await supabase
        .from("locations")
        .update({
          town_map_image_path: null,
          town_map_image_width: null,
          town_map_image_height: null,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      setLocation(updated);
      setPendingMapFile(null);
      setMapFileInputKey((v) => v + 1);
      setMapApplyState({ status: "success", message: "Stored town map removed. Fallback map will be shown if this town has one." });
    } catch (err) {
      console.error("Town map delete failed", err);
      setMapApplyState({ status: "error", message: err?.message || "Failed to delete stored town map." });
    }
  }

  return (
    <div className="container-fluid py-3 town-route-page">
      {loading ? (
        <div className="town-route-page__loading">Loading town sheet…</div>
      ) : location ? (
        <TownSheet
          location={location}
          rosterChars={rosterChars}
          quests={quests}
          backHref={`/map?location=${location.id}`}
          isAdmin={isAdmin}
          storedLabels={storedLabels}
          onSaveMapData={handleSaveMapData}
          mapImageUrl={mapImageUrl}
          imageNaturalSize={imageNaturalSize}
          onSelectMapImage={handleSelectMapImage}
          onApplyMapImage={handleApplyMapImage}
          onClearPendingMap={handleClearPendingMap}
          onDeleteMapImage={handleDeleteMapImage}
          pendingMapFileName={pendingMapFile?.name || ""}
          mapApplyState={mapApplyState}
          mapFileInputKey={mapFileInputKey}
        />
      ) : (
        <div className="town-route-page__loading">Town not found.</div>
      )}
    </div>
  );
}
