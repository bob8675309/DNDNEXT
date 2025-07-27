// /pages/map.js

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import MapOverlay from "../components/MapOverlay";
import Image from "next/image";
import MerchantPanel from "../components/MerchantPanel";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function MapPage() {
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [overlayOpen, setOverlayOpen] = useState(false);

  useEffect(() => {
    async function fetchMerchants() {
      let { data, error } = await supabase.from("merchants").select("*");
      if (!error && data) {
        // Parse roaming_spot if stored as JSON string
        data = data.map(m =>
          typeof m.roaming_spot === "string"
            ? { ...m, roaming_spot: JSON.parse(m.roaming_spot) }
            : m
        );
        setMerchants(data);
      }
    }
    fetchMerchants();
  }, []);

  function handleMerchantClick(merchant) {
    setSelectedMerchant(merchant);
    setOverlayOpen(true);
  }

  return (
    <div className="relative w-full min-h-screen bg-black flex">
      {/* Map Image */}
      <div className="relative flex-1">
        <Image
          src="/Wmap.jpg"
          alt="DnD Reginal Map"
          layout="fill"
          objectFit="contain"
          priority
        />
        {/* Merchants */}
        {merchants.map((merchant) =>
          merchant.roaming_spot && merchant.roaming_spot.x !== undefined && merchant.roaming_spot.y !== undefined ? (
            <button
              key={merchant.id}
              className="absolute z-20 group"
              style={{
                left: `${merchant.roaming_spot.x}%`,
                top: `${merchant.roaming_spot.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              onClick={() => handleMerchantClick(merchant)}
              title={merchant.name}
            >
              <span className="flex flex-col items-center">
                <span className="bg-yellow-400 border-2 border-yellow-900 shadow-lg rounded-full p-2 group-hover:scale-110 transition-transform">
                  {merchant.icon ? (
                    <img
                      src={merchant.icon}
                      alt={merchant.name}
                      className="w-7 h-7 rounded-full"
                    />
                  ) : (
                    <span className="text-2xl">🛒</span>
                  )}
                </span>
                <span className="mt-1 text-xs text-yellow-100 drop-shadow font-bold bg-black/70 px-1 rounded">
                  {merchant.name}
                </span>
              </span>
            </button>
          ) : null
        )}
      </div>
      {/* Overlay */}
      {selectedMerchant && (
        <MapOverlay
          open={overlayOpen}
          onClose={() => setOverlayOpen(false)}
          title={selectedMerchant.name}
        >
          <MerchantPanel merchant={selectedMerchant} />
        </MapOverlay>
      )}
    </div>
  );
}