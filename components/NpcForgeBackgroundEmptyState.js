import { FaBookOpen, FaFeatherAlt, FaStar } from "react-icons/fa";

const ART_ROOT = "/ui/forge/backgrounds";

export default function NpcForgeBackgroundEmptyState() {
  return <div className="npc-forge-background-empty-state" aria-label="Choose a Background">
    <header>
      <span className="npc-forge-background-empty-state__crest"><FaBookOpen aria-hidden="true" /></span>
      <div><small>Background</small><h2>Choose a Background</h2><p>Select a background from the catalogue to see its history, granted skills, tools, languages, feat, and source-owned choices here.</p></div>
    </header>
    <section>
      <span><FaFeatherAlt aria-hidden="true" /></span>
      <div><strong>Your life before adventuring</strong><p>The Background dossier will stay in this same presentation when you make a selection—there is no separate legacy information view to switch away from.</p></div>
    </section>
    <div className="npc-forge-background-empty-state__cards">
      <article><FaStar aria-hidden="true" /><div><strong>History &amp; grants</strong><small>Skills, tools, languages, and the Origin feat appear together.</small></div></article>
      <article><FaBookOpen aria-hidden="true" /><div><strong>Source-backed rules</strong><small>Choices remain attached to the Background or feat that grants them.</small></div></article>
    </div>
    <style jsx global>{`
      .npc-forge-background-empty-state{--bg-empty-banner:url("${ART_ROOT}/banners/bg-banner-travel.webp");display:grid;gap:10px;width:100%;min-width:0;padding:8px 10px 16px;color:#fff}.npc-forge-background-empty-state>header{display:grid;grid-template-columns:72px minmax(0,1fr);align-items:center;gap:14px;min-height:112px;padding:14px 16px;border:1px solid rgba(160,111,229,.32);border-radius:11px;background-image:linear-gradient(90deg,rgba(9,13,23,.96),rgba(12,17,30,.86) 48%,rgba(11,17,29,.5) 100%),var(--bg-empty-banner);background-size:cover;background-position:center right;box-shadow:inset 0 1px rgba(255,255,255,.035)}.npc-forge-background-empty-state__crest{display:grid;place-items:center;width:64px;height:72px;border:1px solid rgba(211,170,89,.4);border-radius:18px 18px 24px 24px;color:#e2c578;background:rgba(44,31,60,.72);font-size:1.55rem}.npc-forge-background-empty-state>header>div{display:grid;gap:4px}.npc-forge-background-empty-state>header small{color:#cdb5f5;font-size:.56rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.npc-forge-background-empty-state>header h2{margin:0;color:#fff4df;font-family:Georgia,"Times New Roman",serif;font-size:1.45rem}.npc-forge-background-empty-state>header p{max-width:68ch;margin:2px 0 0;color:rgba(255,255,255,.78);font-size:.72rem;line-height:1.5}.npc-forge-background-empty-state>section{display:grid;grid-template-columns:44px minmax(0,1fr);gap:11px;align-items:start;padding:11px 14px;border:1px solid rgba(168,108,255,.28);border-left:3px solid #a86cff;border-radius:9px;background:linear-gradient(90deg,rgba(72,36,99,.23),rgba(15,21,32,.85))}.npc-forge-background-empty-state>section>span{display:grid;place-items:center;width:38px;height:38px;border:1px solid rgba(168,108,255,.32);border-radius:50%;color:#d4b8ff;background:rgba(126,72,199,.12)}.npc-forge-background-empty-state>section>div{display:grid;gap:4px}.npc-forge-background-empty-state>section strong{color:#d8b8ff;font-size:.58rem;letter-spacing:.08em;text-transform:uppercase}.npc-forge-background-empty-state>section p{margin:0;color:rgba(255,255,255,.75);font-size:.69rem;line-height:1.5}.npc-forge-background-empty-state__cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.npc-forge-background-empty-state__cards article{display:grid;grid-template-columns:32px minmax(0,1fr);gap:9px;align-items:center;padding:10px 11px;border:1px solid rgba(192,155,94,.2);border-radius:9px;background:linear-gradient(135deg,rgba(17,27,43,.96),rgba(11,17,29,.92))}.npc-forge-background-empty-state__cards article>svg{color:#d5ba78;font-size:1.05rem}.npc-forge-background-empty-state__cards article>div{display:grid;gap:2px}.npc-forge-background-empty-state__cards strong{font-size:.68rem}.npc-forge-background-empty-state__cards small{color:rgba(255,255,255,.58);font-size:.59rem;line-height:1.4}@media(max-width:720px){.npc-forge-background-empty-state__cards{grid-template-columns:1fr}.npc-forge-background-empty-state>header{grid-template-columns:56px minmax(0,1fr)}.npc-forge-background-empty-state__crest{width:52px;height:60px}}
    `}</style>
  </div>;
}
