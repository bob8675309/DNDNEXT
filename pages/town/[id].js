import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppNavbar from "../../components/AppNavbar";
import TownSheet from "../../components/TownSheet";
import { supabase } from "../../utils/supabaseClient";
import { pickId } from "../../utils/townData";

function normalizeMapRow(row, kind) {
  return {
    id: row?.id,
    key: row?.key || row?.id,
    name: row?.name,
    x: Number(row?.x ?? 50),
    y: Number(row?.y ?? 50),
    tone: row?.tone || "stone",
    targetPanel: row?.target_panel || null,
    category: row?.category || null,
    kind,
    notes: row?.notes || null,
    isVisible: row?.is_visible !== false,
  };
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
  const [storedFlags, setStoredFlags] = useState([]);

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

        const [{ data: labelRows, error: labelErr }, { data: flagRows, error: flagErr }] = await Promise.all([
          supabase.from("town_map_labels").select("*").eq("location_id", id).order("sort_order", { ascending: true }),
          supabase.from("town_map_flags").select("*").eq("location_id", id).order("created_at", { ascending: true }),
        ]);
        if (labelErr) console.warn("town_map_labels load skipped", labelErr.message);
        if (flagErr) console.warn("town_map_flags load skipped", flagErr.message);
        if (!alive) return;
        setStoredLabels((labelRows || []).map((row) => normalizeMapRow(row, "label")));
        setStoredFlags((flagRows || []).map((row) => normalizeMapRow(row, "flag")));
      } catch (err) {
        console.error("TownPage load failed", err);
        if (alive) setLocation(null);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [id]);

  async function handleSaveMapData({ labels, flags }) {
    if (!id) return;
    const labelRows = (labels || []).map((item, idx) => ({
      id: item.id?.startsWith("label-") ? null : item.id,
      location_id: id,
      key: item.key || item.id,
      name: item.name,
      x: Number(item.x ?? 50),
      y: Number(item.y ?? 50),
      tone: item.tone || "stone",
      target_panel: item.targetPanel || null,
      category: item.category || null,
      is_visible: item.isVisible !== false,
      sort_order: idx,
    }));
    const flagRows = (flags || []).map((item, idx) => ({
      id: item.id?.startsWith("flag-") ? null : item.id,
      location_id: id,
      name: item.name,
      x: Number(item.x ?? 50),
      y: Number(item.y ?? 50),
      tone: item.tone || "amber",
      notes: item.notes || null,
      category: item.category || null,
      is_visible: item.isVisible !== false,
      sort_order: idx,
    }));

    const { error: delLabelErr } = await supabase.from("town_map_labels").delete().eq("location_id", id);
    if (delLabelErr) throw delLabelErr;
    const { error: delFlagErr } = await supabase.from("town_map_flags").delete().eq("location_id", id);
    if (delFlagErr) throw delFlagErr;

    if (labelRows.length) {
      const { error: insLabelErr } = await supabase.from("town_map_labels").insert(labelRows);
      if (insLabelErr) throw insLabelErr;
    }
    if (flagRows.length) {
      const { error: insFlagErr } = await supabase.from("town_map_flags").insert(flagRows);
      if (insFlagErr) throw insFlagErr;
    }

    setStoredLabels(labels);
    setStoredFlags(flags);
  }

  return (
    <>
      <AppNavbar />
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
            storedFlags={storedFlags}
            onSaveMapData={handleSaveMapData}
          />
        ) : (
          <div className="town-route-page__loading">Town not found.</div>
        )}
      </div>
    </>
  );
}
