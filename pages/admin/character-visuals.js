import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CharacterVisualsPanel from "../../components/CharacterVisualsPanel";
import { supabase } from "../../utils/supabaseClient";

function text(value) { return String(value ?? "").trim(); }

export default function CharacterVisualsAdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      if (!sessionData?.session?.user) { setAuthChecked(true); return; }
      const { data } = await supabase.rpc("is_admin");
      if (!active) return;
      setIsAdmin(Boolean(data));
      setAuthChecked(true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authChecked || !isAdmin) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      const { data, error: loadError } = await supabase
        .from("characters")
        .select("id,name,kind,race,role,affiliation,status,portrait_library_id,portrait_url,portrait_storage_path,portrait_thumb_url,portrait_shop_url,portrait_source,image_url,visual_asset_id,sprite_key,sprite_path,sprite_scale")
        .order("name");
      if (!active) return;
      if (loadError) setError(loadError.message || "Could not load characters.");
      const rows = data || [];
      setCharacters(rows);
      setSelectedId((current) => current && rows.some((row) => String(row.id) === String(current)) ? current : String(rows[0]?.id || ""));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [authChecked, isAdmin]);

  const filtered = useMemo(() => {
    const q = text(query).toLowerCase();
    if (!q) return characters;
    return characters.filter((row) => [row.name, row.kind, row.race, row.role, row.affiliation].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [characters, query]);

  const selected = useMemo(() => characters.find((row) => String(row.id) === String(selectedId)) || null, [characters, selectedId]);

  if (!authChecked) return <main className="container my-4"><div className="text-muted">Checking admin access…</div></main>;
  if (!isAdmin) return <main className="container my-4"><h1 className="h4">Character Visuals</h1><p className="text-muted">Admin access is required.</p></main>;

  return (
    <main className="container-fluid my-3 px-3 admin-dark character-visuals-admin">
      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
        <div><div className="spell-admin-kicker">Character Visuals</div><h1 className="h3 mb-1">Portrait &amp; Sprite Assignment</h1><div className="small text-muted">Portraits and sprites are independent. Use the sprite library page to register and curate production assets.</div></div>
        <div className="d-flex gap-2 flex-wrap"><Link href="/admin/sprite-assets" className="btn btn-sm btn-outline-info">Sprite Library</Link><Link href="/admin" className="btn btn-sm btn-outline-light">Admin</Link></div>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="row g-3">
        <div className="col-12 col-xl-3">
          <section className="npc-card character-visual-roster">
            <div className="npc-card-title">Characters</div>
            <input className="form-control form-control-sm mb-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, race, role…" />
            {loading ? <div className="text-muted">Loading…</div> : null}
            <div className="character-visual-roster-list">
              {filtered.map((row) => <button key={row.id} type="button" className={String(row.id) === String(selectedId) ? "is-current" : ""} onClick={() => setSelectedId(String(row.id))}><strong>{row.name || "Character"}</strong><small>{[row.kind, row.race, row.role].filter(Boolean).join(" • ")}</small></button>)}
              {!loading && !filtered.length ? <div className="text-muted small">No characters match this search.</div> : null}
            </div>
          </section>
        </div>
        <div className="col-12 col-xl-9">
          {selected ? <CharacterVisualsPanel key={selected.id} character={selected} canEdit /> : <section className="npc-card"><div className="text-muted">Select a character to manage its portrait and sprite.</div></section>}
        </div>
      </div>

      <style jsx>{`
        .character-visual-roster{position:sticky;top:1rem;max-height:86vh;overflow:hidden;display:flex;flex-direction:column}.character-visual-roster-list{display:grid;gap:.35rem;overflow:auto;min-height:0}.character-visual-roster-list button{display:grid;gap:.15rem;text-align:left;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.025);color:#eee;border-radius:.6rem;padding:.55rem}.character-visual-roster-list button:hover,.character-visual-roster-list button.is-current{border-color:#aa66ff;background:rgba(137,75,255,.14)}.character-visual-roster-list small{color:rgba(255,255,255,.58)}@media(max-width:1199px){.character-visual-roster{position:static;max-height:none}.character-visual-roster-list{max-height:40vh}}
      `}</style>
    </main>
  );
}
