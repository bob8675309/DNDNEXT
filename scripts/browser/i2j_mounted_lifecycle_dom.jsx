import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import NewNpcModalV3 from "../../components/NewNpcModalV3";
import CharacterLevelUpChoices from "../../components/CharacterLevelUpChoices";
import { supabase } from "../../utils/supabaseClient";

function MountedLifecycleHost() {
  const [mode,setMode]=useState(null);
  useEffect(()=>{
    window.i2jMounted={
      async login(email,password){
        const result=await supabase.auth.signInWithPassword({email,password});
        if(result.error)throw new Error(result.error.message);
        setMode({kind:"forge"});
        return result.data.user.id;
      },
      async advance(id){
        const args={p_character_id:id};
        const begin=await supabase.rpc("begin_character_level_up_v1",args);
        if(begin.error)throw new Error(begin.error.message);
        const review=await supabase.rpc("get_character_level_up_review_v1",args);
        if(review.error)throw new Error(review.error.message);
        window.i2jMounted.completed=null;
        setMode({kind:"advance",id,review:review.data});
        return review.data;
      },
      spend(id,assignment){
        return supabase.rpc("update_character_spell_use_v1",{p_character_id:id,p_assignment_id:assignment,p_operation:"use"})
          .then(({data,error})=>({data,error}));
      },
    };
  },[]);
  return <main>
    {mode?.kind==="forge" && <NewNpcModalV3 show={true} mode="player"
      draftStorageScope="i2j-mounted-lifecycle" locations={[]} onClose={()=>setMode(null)}
      onCreated={row=>{window.i2jMounted.created=row;setMode(null);}} />}
    {mode?.kind==="advance" && <CharacterLevelUpChoices key={mode.review.session.id}
      character={{id:mode.id}} review={mode.review}
      onCompleted={result=>{window.i2jMounted.completed=result;setMode(null);}} />}
  </main>;
}

createRoot(document.getElementById("i2j-root")).render(<MountedLifecycleHost />);
