// /components/Map.js

import Image from "next/image";

export default function Map({ mapSrc = "/map.png", children }) {
  return (
    <div className="relative w-full h-full min-h-[600px] bg-black">
      <Image
        src={mapSrc}
        alt="DnD World Map"
        layout="fill"
        objectFit="contain"
        priority
      />
      {children}
    </div>
  );
}