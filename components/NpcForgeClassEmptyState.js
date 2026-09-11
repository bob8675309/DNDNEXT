import classEmptyStateArtwork from "../utils/forgeGeneratedArt/classEmptyState";

const EMPTY_ROWS = [1, 2, 3];

export default function NpcForgeClassEmptyState() {
  return <section className="npc-forge-class-empty" aria-label="Choose a class">
    <div className="npc-forge-class-empty__art" style={{ backgroundImage: `url(${classEmptyStateArtwork})` }} aria-hidden="true" />
    <div className="npc-forge-class-empty__veil" aria-hidden="true" />
    <div className="npc-forge-class-empty__tabs" aria-hidden="true">
      <span className="is-active">Class Overview</span>
      <span>Detailed Guide</span>
    </div>
    <header className="npc-forge-class-empty__hero">
      <div className="npc-forge-class-empty__sigil" aria-hidden="true">✦</div>
      <h2>Choose a class</h2>
      <p>Classes define your character&apos;s path—unlock unique abilities, shape your role in the world, and determine how you grow.</p>
      <div className="npc-forge-class-empty__facts" aria-label="Class facts become available after selection">
        <div><span aria-hidden="true">◆</span><small>Hit Die</small><strong>—</strong></div>
        <div><span aria-hidden="true">⬟</span><small>Primary Ability</small><strong>—</strong></div>
        <div><span aria-hidden="true">✦</span><small>Role</small><strong>—</strong></div>
      </div>
    </header>
    <div className="npc-forge-class-empty__lower">
      <section className="npc-forge-class-empty__progression">
        <h3><span aria-hidden="true">▧</span> Class Progression</h3>
        <div className="npc-forge-class-empty__table" role="presentation">
          <div className="is-head"><span>Level</span><span>PB</span><span>Features</span><span>Cantrips</span><span>Known / Prepared</span><span>Spell Slots</span></div>
          {EMPTY_ROWS.map((level) => <div key={level}><b>{level}</b><span>+2</span><em>Features will appear here</em><span>—</span><span>—</span><span>—</span></div>)}
        </div>
        <p>Progression details become available once a class is selected.</p>
      </section>
      <aside className="npc-forge-class-empty__features">
        <h3><span aria-hidden="true">▧</span> Class Features</h3>
        <div className="npc-forge-class-empty__feature-sigil" aria-hidden="true">◇</div>
        <strong>No class selected</strong>
        <p>Select a class from the list to explore its features, abilities, subclasses, and unique mechanics.</p>
      </aside>
    </div>
  </section>;
}
