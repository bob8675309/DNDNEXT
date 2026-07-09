import { useEffect, useState } from "react";
import Link from "next/link";
import CharacterSpellbookAdminPanel from "../../components/CharacterSpellbookAdminPanel";
import { supabase } from "../../utils/supabaseClient";

export default function AdminSpellbooksPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;

    async function checkAdmin() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) {
          if (alive) setAuthChecked(true);
          return;
        }

        const { data, error } = await supabase.rpc("is_admin");
        if (error) throw error;
        if (alive) {
          setIsAdmin(Boolean(data));
          setAuthChecked(true);
        }
      } catch {
        if (alive) setAuthChecked(true);
      }
    }

    checkAdmin();
    return () => { alive = false; };
  }, []);

  if (!authChecked) {
    return <main className="container my-4 admin-dark"><div className="text-muted">Checking admin access...</div></main>;
  }

  if (!isAdmin) {
    return (
      <main className="container my-4 admin-dark">
        <h1 className="h4">Spellbooks</h1>
        <p className="text-muted">Admin access is required.</p>
      </main>
    );
  }

  return (
    <main className="container-fluid my-3 px-3 admin-dark spell-admin-page">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <div className="spell-admin-kicker">Magic Database</div>
          <h1 className="h3 mb-0">Character Spellbooks</h1>
          <div className="text-muted small">Assign catalog spells to NPCs and merchants, then track prepared and always-available spell access.</div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link className="btn btn-outline-light btn-sm" href="/admin/spells">Spell Catalog</Link>
          <Link className="btn btn-outline-light btn-sm" href="/admin">Admin Dashboard</Link>
        </div>
      </div>

      <CharacterSpellbookAdminPanel />
    </main>
  );
}
