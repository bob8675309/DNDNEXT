#!/usr/bin/env node
// Derives CI-only Next Pages Router page from exact original pages/admin/activity.js.
// Never commit or replace the original page or mount this in production.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const originalPath=path.join(root,"pages/admin/activity.js");
const gitBlob=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0").update(s).digest("hex");
export const PR334_ORIGINAL_PAGE_SHA="47fe5943e6e0f7f0759016125c6100f671a0c732";
export const PR334_TEMP_PAGE="pages/admin/__pr334_site_activity_research.jsx";
export function derivePr334SiteActivityProbe(){
 const original=readFileSync(originalPath,"utf8");
 assert.equal(gitBlob(original),PR334_ORIGINAL_PAGE_SHA,"Original site activity page source drift");
 const begin=original.indexOf("  const loadActivity = useCallback(async () => {");
 const end=original.indexOf("  const accountCount = useMemo(",begin);
 assert.ok(begin>0&&end>begin,"Original Next page effect anchors changed");
 const behavior=String.raw`
  // Temporary actor-epoch protected research behavior; original JSX below
  // is preserved; original live route and original security SQL are untouched.
  const loadActivity = useCallback(async () => {
    const ticket=epochRef.current, actor=actorRef.current;
    if(!actor){setRows([]);setAuthorized(false);setLoading(false);return;}
    setLoading(true);setError("");
    const {data,error:reportError}=await supabase.rpc("p13_research_get_recent_site_activity_v1");
    if(ticket!==epochRef.current)return;
    const {data:identity,error:userError}=await supabase.auth.getUser();
    if(ticket!==epochRef.current||userError||identity?.user?.id!==actor){
      setRows([]);setAuthorized(false);setLoading(false);return;
    }
    if(reportError){
      setRows([]);setAuthorized(false);setError(reportError.message||"Could not load recent activity.");
      setLoading(false);return;
    }
    setRows(Array.isArray(data)?data:[]);setLoading(false);
  }, []);

  useEffect(() => {
    let active=true;
    async function authorize(){
      const ticket=++epochRef.current;
      actorRef.current=null;setRows([]);setAuthorized(null);setError("");setLoading(true);
      const {data:identity,error:identityError}=await supabase.auth.getUser();
      if(!active||ticket!==epochRef.current)return;
      if(identityError||!identity?.user?.id){setAuthorized(false);setLoading(false);return;}
      const {data:allowed,error:roleError}=await supabase.rpc("p13_research_current_actor_is_manager_v1");
      if(!active||ticket!==epochRef.current)return;
      if(roleError||allowed!==true){setAuthorized(false);setLoading(false);return;}
      actorRef.current=identity.user.id;setAuthorized(true);await loadActivity();
    }
    // Auth callback invalidates previous responses synchronously. Supabase APIs
    // are called later, outside the auth-state callback's own auth lock.
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{
      ++epochRef.current;actorRef.current=null;
      setRows([]);setAuthorized(null);setError("");setLoading(true);
      setTimeout(()=>{if(active)void authorize();},0);
    });
    void authorize();
    return()=>{active=false;++epochRef.current;actorRef.current=null;subscription.unsubscribe();};
  },[loadActivity]);

  useEffect(()=>{
    window.__PR334_SITE_TEST__={
      login:async(email,password)=>{
        const {data,error}=await supabase.auth.signInWithPassword({email,password});
        if(error)throw new Error(error.message);return data?.user?.id||null;
      },
      logout:async()=>{
        const {error}=await supabase.auth.signOut();
        if(error)throw new Error(error.message);return true;
      },
      currentUser:async()=>{
        const {data,error}=await supabase.auth.getUser();
        return error?null:data?.user?.id||null;
      },
      rawVisit:async()=>{
        const {data,error}=await supabase.from("site_visit_activity").select("visitor_key,user_id").limit(1);
        return {data,error:error?.code||null};
      }
    };
    return()=>{delete window.__PR334_SITE_TEST__;};
  },[]);

`;
 let output=original.slice(0,begin)+behavior+original.slice(end);
 const once=(a,b)=>{
  assert.equal(output.split(a).length-1,1,"Original page changed one-off anchor: "+a.slice(0,48));
  output=output.replace(a,b);
 };
 once('import { useCallback, useEffect, useMemo, useState } from "react";',
      'import { useCallback, useEffect, useMemo, useRef, useState } from "react";');
 once('  const [error, setError] = useState("");',
      '  const [error, setError] = useState("");\n  const epochRef=useRef(0);\n  const actorRef=useRef(null);');
 once('<main className="container-fluid py-4 px-3 px-lg-4">',
      '<main className="container-fluid py-4 px-3 px-lg-4" data-testid="pr334-site-activity-page">');
 once('Admin access is required to view site activity.',
      'Application Game Master access is required to view site activity.');
 assert.match(output,/p13_research_get_recent_site_activity_v1/);
 assert.match(output,/onAuthStateChange/);
 assert.doesNotMatch(output,/supabase\.rpc\("is_admin"\)/);
 assert.equal(gitBlob(readFileSync(originalPath,"utf8")),PR334_ORIGINAL_PAGE_SHA);
 return output;
}
