import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public", "npc-portraits");

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

function propSvg(kind, c) {
  if (kind === "smithing") return `
    <rect x="1080" y="610" width="58" height="760" rx="22" fill="#5f3b26" opacity=".92"/>
    <rect x="1004" y="535" width="272" height="104" rx="26" fill="#8f8a83" stroke="#f3cf8b" stroke-width="8" opacity=".96"/>
    <path d="M1040 1608h280l-82 116h-138z" fill="#333741" stroke="#d9aa6b" stroke-width="6" opacity=".95"/>
    <circle cx="180" cy="1475" r="310" fill="#ff7b22" opacity=".14"/><circle cx="180" cy="1475" r="190" fill="#ffb14e" opacity=".16"/>`;
  if (kind === "alchemy") return `
    <g opacity=".86"><rect x="90" y="320" width="1356" height="28" rx="14" fill="#5a3927"/><rect x="90" y="510" width="1356" height="28" rx="14" fill="#5a3927"/></g>
    ${Array.from({ length: 16 }, (_, i) => {
      const x = 132 + i * 82;
      const y = i % 2 ? 408 : 236;
      const colors = ["#51df98", "#7f5cff", "#f2aa3f", "#48aed7"];
      return `<rect x="${x}" y="${y}" width="42" height="104" rx="13" fill="${colors[i % colors.length]}" opacity=".55" stroke="#f4ffe9" stroke-width="3"/><rect x="${x + 11}" y="${y - 18}" width="20" height="20" fill="#493521" opacity=".8"/>`;
    }).join("\n")}
    <rect x="1030" y="1280" width="160" height="300" rx="44" fill="#50dc8c" opacity=".22" stroke="#caffdf" stroke-width="7"/><rect x="1082" y="1178" width="56" height="130" fill="#50dc8c" opacity=".16" stroke="#caffdf" stroke-width="5"/>`;
  if (kind === "enchanting") return `
    ${Array.from({ length: 34 }, (_, i) => `<circle cx="${100 + ((i * 137) % 1320)}" cy="${170 + ((i * 211) % 1660)}" r="${18 + (i % 4) * 8}" fill="none" stroke="#a77bff" stroke-width="3" opacity=".20"/>`).join("\n")}
    <path d="M1130 320l132 202-132 240-132-240z" fill="#9570ff" opacity=".34" stroke="#e9ddff" stroke-width="6"/><path d="M1130 320v442" stroke="#fff" stroke-width="5" opacity=".25"/>`;
  if (kind === "scribe") return `
    ${[280, 480, 1680].map((y) => `<rect x="82" y="${y}" width="1372" height="32" rx="14" fill="#5d3d26" opacity=".88"/>`).join("\n")}
    ${Array.from({ length: 28 }, (_, i) => `<rect x="${112 + (i % 14) * 94}" y="${(i < 14 ? 280 : 480) - (118 + (i % 5) * 26)}" width="48" height="${118 + (i % 5) * 26}" fill="${["#6c2832", "#2c405e", "#536332", "#6b451e"][i % 4]}" stroke="#d7b77b" stroke-width="3" opacity=".9"/>`).join("\n")}
    <rect x="980" y="1280" width="340" height="320" rx="20" fill="#ead7a3" stroke="#6b4423" stroke-width="6" opacity=".9"/><path d="M1010 1190l180 320M980 1130l86 60-52 26" stroke="#f8f6df" stroke-width="18" fill="none"/>`;
  if (kind === "merchant") return `
    ${Array.from({ length: 10 }, (_, i) => `<rect x="${i * 155}" y="0" width="155" height="282" fill="${i % 2 ? "#8a2a32" : "#e2bd75"}" opacity=".78"/>`).join("\n")}
    <rect x="0" y="268" width="1536" height="44" fill="#4d2c1d" opacity=".9"/>
    ${Array.from({ length: 38 }, (_, i) => `<ellipse cx="${95 + ((i * 113) % 1340)}" cy="${1500 + ((i * 47) % 330)}" rx="18" ry="11" fill="#dbae4b" stroke="#ffe5a0" stroke-width="2" opacity=".52"/>`).join("\n")}`;
  if (kind === "orc") return `<rect x="1072" y="340" width="58" height="1170" fill="#41291d" opacity=".92"/><path d="M1130 408l230 124-230 128z" fill="#731c1f" stroke="#d98c4d" stroke-width="6" opacity=".88"/>`;
  return `<circle cx="1170" cy="292" r="142" fill="#dfe3d2" opacity=".38"/><circle cx="1110" cy="248" r="142" fill="#152033" opacity=".58"/>`;
}

function portraitSvg(a) {
  const skin = a.skin || "#a97855";
  const hair = a.hair || "#2f211b";
  const beard = a.beard || "";
  const cloth = a.cloth || "#443052";
  const trim = a.trim || "#deb35f";
  const cx = 768;
  const cy = 745;
  const s = 455;
  const ears = a.ears ? `<path d="M596 700l-145 88 128 72zM940 700l145 88-128 72z" fill="${skin}" stroke="#251918" stroke-width="7" opacity=".96"/>` : `<ellipse cx="590" cy="765" rx="52" ry="72" fill="${skin}"/><ellipse cx="946" cy="765" rx="52" ry="72" fill="${skin}"/>`;
  const tusks = a.tusks ? `<path d="M705 865l-42 132 78-94zM831 865l42 132-78-94z" fill="#eadfbb" opacity=".96"/>` : "";
  const beardSvg = beard ? `<path d="M614 840q154 142 308 0q-36 296-154 368q-118-72-154-368z" fill="${beard}" opacity=".98"/><path d="M650 900q110 74 236 0" fill="none" stroke="#ffffff" stroke-width="7" opacity=".16"/>` : "";
  const glasses = a.glasses ? `<g fill="none" stroke="#dfbd73" stroke-width="8" opacity=".92"><circle cx="696" cy="748" r="48"/><circle cx="840" cy="748" r="48"/><path d="M744 748h48"/></g>` : "";
  const goggles = a.goggles ? `<g fill="none" stroke="#dfbd73" stroke-width="12" opacity=".95"><circle cx="696" cy="744" r="54"/><circle cx="840" cy="744" r="54"/><path d="M750 744h36"/></g>` : "";
  const hat = a.hat ? `<path d="M566 568h404l-70-120H636z" fill="#5a2e61" stroke="#ddb35c" stroke-width="7"/><rect x="515" y="560" width="506" height="74" rx="24" fill="#68326d" stroke="#ddb35c" stroke-width="7"/>` : "";
  const hood = a.hood ? `<path d="M768 420L520 1050h496z" fill="#252d40" opacity=".96"/><path d="M520 705q248-340 496 0" fill="none" stroke="#5c6c86" stroke-width="72" opacity=".75"/>` : "";
  const circlet = a.circlet ? `<path d="M628 594q140-72 280 0" fill="none" stroke="#e6bf66" stroke-width="11"/><circle cx="768" cy="582" r="22" fill="#9d78ff"/>` : "";
  const scar = a.scar ? `<path d="M718 610l108 155M866 780l68 82" stroke="#b44c43" stroke-width="13" stroke-linecap="round" opacity=".82"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 2048" width="1536" height="2048" role="img" aria-label="${esc(a.name)} fantasy NPC portrait">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a.bg1}"/><stop offset="1" stop-color="${a.bg2}"/></linearGradient>
    <radialGradient id="glow" cx="32%" cy="25%" r="68%"><stop offset="0" stop-color="${a.glow}" stop-opacity=".48"/><stop offset="1" stop-color="${a.glow}" stop-opacity="0"/></radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <rect width="1536" height="2048" fill="url(#bg)"/><rect width="1536" height="2048" fill="url(#glow)"/>
  <g opacity=".16">${Array.from({ length: 18 }, (_, i) => `<path d="M${-200 + i * 110} ${150 + (i % 7) * 210}l520 ${-70 + (i % 5) * 34}" stroke="#fff" stroke-width="${2 + (i % 3)}"/>`).join("")}</g>
  ${propSvg(a.kind, a)}
  <ellipse cx="768" cy="1515" rx="560" ry="485" fill="#05050a" opacity=".34"/>
  <ellipse cx="768" cy="1390" rx="690" ry="520" fill="#08070d" opacity=".46"/>
  <rect x="${cx - s * .5}" y="${cy + s * .68}" width="${s}" height="${s * .96}" rx="${s * .17}" fill="${cloth}" stroke="#000" stroke-opacity=".35" stroke-width="10"/>
  <ellipse cx="768" cy="1285" rx="620" ry="340" fill="#08070d" opacity=".48"/>
  <path d="M566 1080h404l134 560H432z" fill="${cloth}" stroke="#000" stroke-opacity=".35" stroke-width="9"/>
  <path d="M575 1070l-20 570M961 1070l20 570" stroke="${trim}" stroke-width="16" opacity=".86"/>
  <circle cx="768" cy="1168" r="62" fill="${trim}" opacity=".92"/>
  ${a.armor ? `<g opacity=".62">${[0,1,2,3,4].map((i) => `<rect x="610" y="${1120+i*72}" width="316" height="36" rx="18" fill="#c6beb0" stroke="#f7dea2" stroke-width="4"/>`).join("")}</g>` : ""}
  ${ears}
  <rect x="668" y="905" width="200" height="250" rx="72" fill="${skin}" stroke="#251918" stroke-opacity=".34" stroke-width="7"/>
  <ellipse cx="768" cy="732" rx="178" ry="226" fill="${skin}" stroke="#251918" stroke-opacity=".42" stroke-width="9"/>
  <path d="M586 650q182-230 364 0q-8-148-182-202q-166 56-182 202z" fill="${hair}"/>
  ${hood}
  ${hat}${circlet}${scar}
  <g>
    <path d="M654 720q44-28 92 0" stroke="#211614" stroke-width="14" stroke-linecap="round"/><path d="M790 720q48-28 92 0" stroke="#211614" stroke-width="14" stroke-linecap="round"/>
    <ellipse cx="698" cy="765" rx="42" ry="29" fill="#f2ead7"/><ellipse cx="838" cy="765" rx="42" ry="29" fill="#f2ead7"/>
    <circle cx="698" cy="768" r="15" fill="#141820"/><circle cx="838" cy="768" r="15" fill="#141820"/>
    <path d="M768 790l-34 95h68z" fill="#8c5a46" opacity=".42"/>
    <path d="M705 930q64 42 126 0" fill="none" stroke="#532922" stroke-width="9" stroke-linecap="round"/>
  </g>
  ${glasses}${goggles}${tusks}${beardSvg}
  <rect x="44" y="44" width="1448" height="1960" rx="90" fill="none" stroke="${trim}" stroke-width="12" opacity=".38"/>
  <rect x="74" y="74" width="1388" height="1900" rx="70" fill="none" stroke="#fff" stroke-width="3" opacity=".12"/>
</svg>`;
}

const assets = [
  { file: "defaults/smithing.svg", name: "Default Smithing Portrait", kind: "smithing", bg1: "#35140d", bg2: "#120c10", glow: "#e55f22", skin: "#9b6b4f", hair: "#2e1f18", beard: "#cbb99a", cloth: "#4b2c22", trim: "#e0a956", armor: true },
  { file: "defaults/alchemy.svg", name: "Default Alchemy Portrait", kind: "alchemy", bg1: "#0a2b20", bg2: "#090d15", glow: "#52db94", skin: "#806844", hair: "#22291e", cloth: "#214f3d", trim: "#92e8a2", ears: true, goggles: true },
  { file: "defaults/enchanting.svg", name: "Default Enchanting Portrait", kind: "enchanting", bg1: "#190e30", bg2: "#090816", glow: "#725be8", skin: "#ad8769", hair: "#e7dcc9", cloth: "#2c2356", trim: "#e2c171", ears: true, circlet: true },
  { file: "defaults/scribe.svg", name: "Default Scribe Portrait", kind: "scribe", bg1: "#332314", bg2: "#120d10", glow: "#cda052", skin: "#b48b67", hair: "#ddd6c4", beard: "#ddd6c4", cloth: "#573926", trim: "#dcbc72", glasses: true },
  { file: "defaults/merchant.svg", name: "Default Merchant Portrait", kind: "merchant", bg1: "#24162e", bg2: "#100d15", glow: "#e8a044", skin: "#a37452", hair: "#301c16", beard: "#503025", cloth: "#402650", trim: "#e3b158", hat: true },
  { file: "defaults/npc.svg", name: "Default NPC Portrait", kind: "generic", bg1: "#121824", bg2: "#0b0a12", glow: "#5479b4", skin: "#966f56", hair: "#262120", cloth: "#252d3a", trim: "#788da6", hood: true },
  { file: "library/smithing/dwarf-forgemaster.svg", name: "Dwarf Forgemaster", kind: "smithing", bg1: "#3b160e", bg2: "#140d10", glow: "#f07526", skin: "#9b6549", hair: "#251913", beard: "#d6c29d", cloth: "#553024", trim: "#f0b860", armor: true },
  { file: "library/alchemy/green-apothecary.svg", name: "Green Apothecary", kind: "alchemy", bg1: "#092c22", bg2: "#070e14", glow: "#54e0a0", skin: "#7a6a42", hair: "#1e2b1f", cloth: "#1f6047", trim: "#98f2a8", ears: true, goggles: true },
  { file: "library/enchanting/arcane-atelier-enchanter.svg", name: "Arcane Atelier Enchanter", kind: "enchanting", bg1: "#1c0f38", bg2: "#070716", glow: "#8f70ff", skin: "#b08366", hair: "#efe5d6", cloth: "#30216a", trim: "#efcd7b", ears: true, circlet: true },
  { file: "library/scribe/grayhall-archivist.svg", name: "Grayhall Archivist", kind: "scribe", bg1: "#362514", bg2: "#120d0f", glow: "#cea45f", skin: "#b98e69", hair: "#e2dccd", beard: "#e2dccd", cloth: "#5b3c27", trim: "#dec37e", glasses: true },
  { file: "library/merchants/market-factor.svg", name: "Market Factor", kind: "merchant", bg1: "#271630", bg2: "#100d14", glow: "#e7a74d", skin: "#aa7652", hair: "#2f1c15", beard: "#573426", cloth: "#4b2a5f", trim: "#eec06a", hat: true },
  { file: "library/monsters/orc-warlord.svg", name: "Orc Warlord", kind: "orc", bg1: "#241a12", bg2: "#0e090c", glow: "#ab3724", skin: "#5d7e46", hair: "#241b16", beard: "#2f281f", cloth: "#542d28", trim: "#d08e44", armor: true, ears: true, tusks: true, scar: true },
];

for (const asset of assets) {
  const target = path.join(ROOT, asset.file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, portraitSvg(asset), "utf8");
}

console.log(`Generated ${assets.length} NPC portrait SVG files in public/npc-portraits.`);
