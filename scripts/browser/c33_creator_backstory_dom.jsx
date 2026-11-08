// Real original CreatorBackstoryPanel rendered in pinned local Chromium.
// Authentication and every table/RPC call use disposable GoTrue/PostgREST.
// No fake admin claims, mocked Supabase, production URLs, or app runtime edits.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import CreatorBackstoryPanel from "../../components/CreatorBackstoryPanel";
import NpcPanel from "../../components/NpcPanel";
import { supabase } from "../../utils/supabaseClient";

// Only Next routing and unmounted dynamic views use browser-only test adapters.
// Original NpcPanel, Sheet, Supabase Auth/RLS are never mocked.
function PrivateStoryBrowserHost() {
  const [profileEnabled, setProfileEnabled] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [characterId, setCharacterId] = useState(String(window.__C33_CHARACTER_ID__ || ""));
  const [sessionVersion, setSessionVersion] = useState(0);
  useEffect(() => {
    window.__C33_AUTH_LOGIN__ = async (email,password) => {
      const r = await supabase.auth.signInWithPassword({ email, password });
      if (r.error) throw new Error("Local GoTrue login refused: " + r.error.message);
      // Never accept a caller-supplied Admin flag; obtain GM status from
      // the installed source-original, authenticated is_admin RPC.
      const adminResult = await supabase.rpc("is_admin", { uid: r.data?.user?.id });
      setAdmin(!adminResult.error && adminResult.data === true);
      setSessionVersion(x=>x+1);
      return r.data?.user?.id || null;
    };
    window.__C33_AUTH_LOGOUT__ = async () => {
      const r = await supabase.auth.signOut();
      if (r.error) throw new Error("Local GoTrue logout refused: " + r.error.message);
      setAdmin(false);
      setSessionVersion(x=>x+1);
    };
    window.__C33_OPEN_NPC_PROFILE__ = () => setProfileEnabled(true);
    window.__C33_CHANGE_CHARACTER__ = (id) => setCharacterId(String(id || ""));
    window.__C33_BROWSER_READY__ = true;
  }, []);
  return <main><h1>C3.3 authenticated original private-backstory UI</h1>
    <CreatorBackstoryPanel key={characterId + ":" + sessionVersion} characterId={characterId}/>
    {profileEnabled ? <NpcPanel
        key={"npc:"+sessionVersion}
        npc={{ id: String(window.__C33_PROFILE_ID__), name: "C3P source NPC", kind: "npc" }}
        isAdmin={admin}
        locations={[]}
        initialView="profile"
        onClose={() => setProfileEnabled(false)}
      /> : null}
  </main>;
}

createRoot(document.getElementById("c33-browser-root")).render(<PrivateStoryBrowserHost/>);
