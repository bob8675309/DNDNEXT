// Real original CreatorBackstoryPanel rendered in pinned local Chromium.
// Authentication and every table/RPC call use disposable GoTrue/PostgREST.
// No fake admin claims, mocked Supabase, production URLs, or app runtime edits.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import CreatorBackstoryPanel from "../../components/CreatorBackstoryPanel";
import { supabase } from "../../utils/supabaseClient";

function PrivateStoryBrowserHost() {
  const [characterId, setCharacterId] = useState(String(window.__C33_CHARACTER_ID__ || ""));
  const [sessionVersion, setSessionVersion] = useState(0);
  useEffect(() => {
    window.__C33_AUTH_LOGIN__ = async (email,password) => {
      const r = await supabase.auth.signInWithPassword({ email, password });
      if (r.error) throw new Error("Local GoTrue login refused: " + r.error.message);
      setSessionVersion(x=>x+1);
      return r.data?.user?.id || null;
    };
    window.__C33_AUTH_LOGOUT__ = async () => {
      const r = await supabase.auth.signOut();
      if (r.error) throw new Error("Local GoTrue logout refused: " + r.error.message);
      setSessionVersion(x=>x+1);
    };
    window.__C33_CHANGE_CHARACTER__ = (id) => setCharacterId(String(id || ""));
    window.__C33_BROWSER_READY__ = true;
  }, []);
  return <main><h1>C3.3 authenticated original private-backstory UI</h1>
    <CreatorBackstoryPanel key={characterId + ":" + sessionVersion} characterId={characterId}/>
  </main>;
}

createRoot(document.getElementById("c33-browser-root")).render(<PrivateStoryBrowserHost/>);
