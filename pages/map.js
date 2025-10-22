import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "../utils/supabaseClient.js";
import MerchantPanel from "../components/MerchantPanel";
import LocationSideBar from "../components/LocationSideBar";

const MapOverlay = dynamic(() => import("../components/MapOverlay"), { ssr: false });

export default function MapPage() {
  const [merchants, setMerchants] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: ms } = await supabase.from("merchants").select("*");
      setMerchants(ms || []);
      const { data: ls } = await supabase.from("locations").select("*");
      setLocations(ls || []);
    })();
  }, []);

  const onSelectMerchant = (m) => setSelected(m);

  return (
    <div className="container-fluid map-page">
      <div className="map-shell my-3">
        <div className="map-wrap">
          <img className="map-img" src="/map.jpg" alt="World map" />
          <div className="map-overlay">
            <MapOverlay
              merchants={merchants}
              locations={locations}
              onSelectMerchant={onSelectMerchant}
            />
          </div>
        </div>
      </div>

      {selected && (
        <div
          className="offcanvas offcanvas-end show position-static border-0 loc-panel"
          id="merchantPanel"
          style={{ width: 420 }}
        >
          <div className="offcanvas-header">
            <h5 className="offcanvas-title">{selected.name}’s Wares</h5>
            <button type="button" className="btn-close" onClick={() => setSelected(null)} />
          </div>
          <div className="offcanvas-body">
            <MerchantPanel merchant={selected} isAdmin={true} />
          </div>
        </div>
      )}

      {/* Example: if you also show a location info sidebar */}
      {/* <LocationSideBar location={someLocation} merchantsHere={merchantsHere} onSelectMerchant={onSelectMerchant} /> */}
    </div>
  );
}
