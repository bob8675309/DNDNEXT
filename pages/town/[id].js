
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppNavbar from "../../components/AppNavbar";
import TownSheet from "../../components/TownSheet";
import { supabase } from "../../utils/supabaseClient";
import { pickId } from "../../utils/townData";

export default function TownPage() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [rosterChars, setRosterChars] = useState([]);
  const [quests, setQuests] = useState([]);

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

  return (
    <>
      <AppNavbar />
      <div className="container-fluid py-3 town-route-page">
        {loading ? (
          <div className="town-route-page__loading">Loading town sheet…</div>
        ) : location ? (
          <TownSheet location={location} rosterChars={rosterChars} quests={quests} backHref={`/map?location=${location.id}`} />
        ) : (
          <div className="town-route-page__loading">Town not found.</div>
        )}
      </div>
    </>
  );
}
