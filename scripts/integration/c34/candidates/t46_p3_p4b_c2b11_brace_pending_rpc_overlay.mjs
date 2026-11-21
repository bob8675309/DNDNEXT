// C34 B11-BRACE: disposable only; derive from exact accepted B11 source.
import assert from "node:assert/strict";
import {buildB11StockUiOverlay} from "./t46_p3_p4b_c2b11_stock_ui_overlay.mjs";
function one(s,a,b,what){assert.equal(s.split(a).length,2,"BRACE drift "+what);return s.replace(a,b)}
function region(s,a,b,value,what){
 assert.equal(s.split(a).length,2,"BRACE begin drift "+what);
 const i=s.indexOf(a),j=s.indexOf(b,i+a.length);
 assert.ok(j>i,"BRACE end drift "+what);
 return s.slice(0,i)+value+s.slice(j);
}
export function buildB11BraceOverlay(bytes,{guarded=false}={}){
 let s=buildB11StockUiOverlay(bytes,{guarded});
 if(!guarded)s=one(s,'import useWallet from "../utils/useWallet";',
  'import useWallet from "../utils/c34/useWalletT28P2Research";',
  "original test-only guarded wallet reuse");
 const scope=`  // B11-BRACE: scope by actor AND merchant AND epoch, not just UUIDs.
  // Already dispatched signed SQL can commit to an old merchant after logout;
  // we suppress only its late CLIENT effects, never claim to cancel SQL.
  const b11ScopeRef=useRef({actor:null,merchant:null,epoch:0});
  const b11AuthOverrideRef=useRef(undefined);
  const b11PendingRef=useRef(null);
  const b11ReadSeqRef=useRef(0);
  const b11Actor=b11AuthOverrideRef.current===undefined?(uid||null):b11AuthOverrideRef.current;
  const b11Merchant=merchant?.id||null;
  if(b11ScopeRef.current.actor!==b11Actor||
     b11ScopeRef.current.merchant!==b11Merchant){
    b11ScopeRef.current={actor:b11Actor,merchant:b11Merchant,
      epoch:b11ScopeRef.current.epoch+1};
    b11PendingRef.current=null;
  }
  const b11Matches=t=>Boolean(t&&t.actor&&t.merchant&&
    t.actor===b11ScopeRef.current.actor&&
    t.merchant===b11ScopeRef.current.merchant&&
    t.epoch===b11ScopeRef.current.epoch);
  const b11Pending=t=>b11PendingRef.current===t&&b11Matches(t);
  async function b11Current(t){
    if(!b11Matches(t))return false;
    const {data,error}=await supabase.auth.getUser();
    return !error&&data?.user?.id===t.actor&&b11Matches(t);
  }
  const b11Start=label=>{
    const ticket={...b11ScopeRef.current};
    if(!ticket.actor||!ticket.merchant||b11Pending(b11PendingRef.current))return null;
    b11PendingRef.current=ticket;setBusyId(label);setErr("");
    return ticket;
  };
  const b11Finish=t=>{
    if(!b11Pending(t))return;
    b11PendingRef.current=null;setBusyId(null);
  };
  useEffect(()=>{
    let live=true;
    const {data}=supabase.auth.onAuthStateChange((event,session)=>{
      if(!live)return;
      const next=session?.user?.id||null;
      if(event==="INITIAL_SESSION"&&next===b11ScopeRef.current.actor)return;
      if(!["SIGNED_IN","SIGNED_OUT","USER_UPDATED","INITIAL_SESSION"].includes(event)
         && next===b11ScopeRef.current.actor)return;
      b11AuthOverrideRef.current=next;
      b11ScopeRef.current={actor:next,merchant:b11ScopeRef.current.merchant,
        epoch:b11ScopeRef.current.epoch+1};
      b11PendingRef.current=null;b11ReadSeqRef.current++;
      setBusyId(null);setErr("");setStock([]);setRestockText("");setNotice(null);
    });
    return ()=>{live=false;data?.subscription?.unsubscribe();
      b11PendingRef.current=null;b11ReadSeqRef.current++;};
  },[]);
  useEffect(()=>{
    b11PendingRef.current=null;b11ReadSeqRef.current++;
    setBusyId(null);setErr("");setRestockText("");
  },[merchant?.id]);
`;
 s=region(s,"  const b11ScopeRef = useRef(null);",
  "  const [loading, setLoading] = useState(true);",scope,"actor scope");
 if(!guarded){
  const reader=`  const fetchStock=useCallback(async()=>{
    const ticket={...b11ScopeRef.current};
    const seq=++b11ReadSeqRef.current;
    if(!ticket.actor||!ticket.merchant||ticket.merchant!==merchant?.id){
      setStock([]);setLoading(false);return {committed:false};
    }
    setLoading(true);
    const {data,error}=await supabase.from("character_stock").select("*")
      .eq("character_id",ticket.merchant).order("display_name",{ascending:true});
    if(seq!==b11ReadSeqRef.current||!b11Matches(ticket))
      return {committed:false};
    if(error){setStock([]);setErr(error.message||"Stock read failed");}
    else setStock(data||[]);
    setLoading(false);return {committed:!error};
  },[merchant?.id,b11Actor]);
  useEffect(()=>{
    b11ReadSeqRef.current++;setStock([]);
    if(merchant?.id&&b11Actor)void fetchStock();
    else setLoading(false);
    return ()=>{b11ReadSeqRef.current++;};
  },[fetchStock,merchant?.id,b11Actor]);

`;
  s=region(s,"  const fetchStock = useCallback(async () => {",
    "  // Handle video: 1s delay before first play",reader,"original stock read");
 }
 const debug=`  // Discarded with CI overlay. No production debug endpoint.
  useEffect(()=>{
    if(typeof window==="undefined")return;
    window.__b11BraceDebug=()=>({
      actor:b11ScopeRef.current.actor,merchant:b11ScopeRef.current.merchant,
      epoch:b11ScopeRef.current.epoch,busy:busyId,error:err,gp,
      pending:b11PendingRef.current!==null,
      stock:stock.map(x=>({id:x.id,character_id:x.character_id,
        display_name:x.display_name,qty:x.qty}))
    });
    return ()=>{delete window.__b11BraceDebug;};
  },[busyId,err,gp,stock,merchant?.id]);
`;
 s=one(s,"  const videoRef = useRef(null);",
  "  const videoRef = useRef(null);\n"+debug,"debug state");
 const patch=(start,end,label)=>{
  const i=s.indexOf(start),j=s.indexOf(end,i+start.length);
  assert.ok(i>=0&&j>i,"BRACE missing action "+label);
  let piece=s.slice(i,j);
  const busy=label==="remove"
   ? '    setBusyId('+String.fromCharCode(96)+'rm:'+'$'+'{stockId}'+String.fromCharCode(96)+');\n    setErr("");'
   : '    setBusyId("'+label+'");\n    setErr("");';
  const replacement='    const b11Ticket=b11Start('+
   (label==="remove"?'"rm:"+stockId':'"'+label+'"')+');\n    if(!b11Ticket)return;';
  // remove variant is already a complete expression in replacement above.
  const correct=label==="remove"
   ? '    const b11Ticket=b11Start("rm:"+stockId);\n    if(!b11Ticket)return;'
   : replacement;
  piece=one(piece,busy,correct,label+" busy");
  piece=one(piece,'      const b11Scope = {actor:uid,merchant:merchant?.id};',
   '      const b11Scope=b11Ticket;',label+" action");
  piece=one(piece,'      if(!(await b11Current(b11Scope))) return;',
   '      if(!b11Pending(b11Scope)||!(await b11Current(b11Scope))) return;',
   label+" settle");
  const failure=label==="remove"?"Remove failed":label==="add"?"Add failed":"Dump failed";
  const old='    } catch (e) {\n      console.error(e);\n      setErr(e.message || "'+failure+'");\n    } finally {\n      setBusyId(null);\n    }';
  const safe='    } catch (e) {\n      if(b11Pending(b11Ticket)){\n        console.error(e);setErr(e.message || "'+failure+'");\n      }\n    } finally {\n      b11Finish(b11Ticket);\n    }';
  piece=one(piece,old,safe,label+" catch/finally");
  s=s.slice(0,i)+piece+s.slice(j);
 };
 patch("  async function dumpAll() {","  // Admin: add item by name or JSON;","dump");
 patch("  async function addItem() {","  async function changeQty(","add");
 patch("  async function removeRow(stockId) {","  if (!merchant) return null;","remove");
 assert.match(s,/b11Pending\(b11Scope\)/);
 assert.match(s,/__b11BraceDebug/);
 assert.ok(!/\.from\(["']character_stock["']\)\s*\.(?:insert|delete|update)\(/.test(s));
 return s;
}
