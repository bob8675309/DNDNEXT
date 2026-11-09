// C3F real original unified NewNpcModalV3 (no replacement form, no
// mocked Supabase). Signed local GoTrue and PostgREST are required.
// This browser component lives ONLY in the disposable test bundle.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import NewNpcModalV3 from "../../components/NewNpcModalV3";
import { supabase } from "../../utils/supabaseClient";

function ForgeOriginalBrowserHost() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [done, setDone] = useState(null);
  useEffect(() => {
    window.__C33F_LOGIN__ = async (email,password) => {
      const result = await supabase.auth.signInWithPassword({email,password});
      if(result.error) throw new Error("Disposable GoTrue refused player sign-in: " + result.error.message);
      setLoggedIn(true);
      return result.data.user.id;
    };
    window.__C33F_CREATED__ = null;
    window.__C33F_HOST_READY__ = true;
  }, []);
  const onCreated = (row) => {
    window.__C33F_CREATED__ = row;
    setDone(row);
  };
  return <main>
    <h1>C3F Original Player Character Forge browser fixture</h1>
    {!loggedIn ? <p>Sign in through disposable GoTrue before mounting the original Forge.</p> :
      <NewNpcModalV3
        show={true}
        mode="player"
        draftStorageScope="c33-full-original-form"
        locations={[]}
        onCreated={onCreated}
        onClose={()=>{throw new Error("Unexpected Forge closure");}}
      />}
    {done?.id ? <p id="c33-original-form-created" data-character-id={done.id}>
      Character created with original v3 source flow</p> : null}
  </main>;
}
createRoot(document.getElementById("c33f-root")).render(<ForgeOriginalBrowserHost/>);
