// One-time, explicitly gated cleanup for DNDNext experimental preview branches.
// This executes ONLY via the dedicated GitHub Actions commit trigger.
// Deletes branch references, never Git commits, Vercel deployments or main.
import fs from 'node:fs';

const repo=process.env.GITHUB_REPOSITORY;
const archiveName='work/consolidated-encounter-research-20261030';
const head=process.env.GITHUB_SHA;
const token=process.env.GITHUB_TOKEN;
if(repo!=='bob8675309/DNDNEXT'||process.env.GITHUB_REF!=='refs/heads/'+archiveName
   ||process.env.DNDNEXT_BRANCH_CLEANUP_EXECUTE!=='YES_ARCHIVED_AND_VERIFIED'
   ||!token||!/^[a-f\d]{40}$/i.test(head)){
  throw new Error('Repository, branch, execution guard, head SHA or GitHub token is invalid');
}
const root='https://api.github.com/repos/'+repo;
const headers={
  Authorization:'Bearer '+token,
  Accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28',
  'User-Agent':'DNDNext-consolidated-branch-pruner'
};
const request=async (method,path,body)=>{
  const response=await fetch(root+path,{
    method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if(!response.ok){
    const str=(await response.text()).slice(0,250);
    throw new Error(method+' '+path+' -> HTTP '+response.status+' '+str);
  }
  if(response.status===204)return null;
  return response.json();
};
async function pages(path){
  const result=[];
  for(let page=1;page<=20;page++){
    const batch=await request('GET',path+(path.includes('?')?'&':'?')+'per_page=100&page='+page);
    if(!Array.isArray(batch))throw new Error('Expected a paginated list');
    result.push(...batch);
    if(batch.length<100)return result;
  }
  throw new Error('List pagination exceeded safety bound');
}
const protectedNames=new Set(['main','master','production','staging','develop',archiveName]);
const coveredCache=new Map();
async function covered(sha){
  if(!/^[a-f\d]{40}$/i.test(sha||''))return false;
  if(coveredCache.has(sha))return coveredCache.get(sha);
  const compare=await request('GET','/compare/'+sha+'...'+head);
  const ok=compare.behind_by===0&&['ahead','identical'].includes(compare.status);
  coveredCache.set(sha,ok);
  return ok;
}
console.log('Consolidation branch:',archiveName,'at',head);
const pulls=await pages('/pulls?state=open');
const eligiblePRs=[];
const blockedPRs=[];
for(const p of pulls){
  const own=p.head?.repo?.full_name===repo;
  const sameBranch=!protectedNames.has(p.head?.ref);
  const ok=own&&p.draft&&sameBranch&&await covered(p.head?.sha);
  (ok?eligiblePRs:blockedPRs).push(p);
}
// Never close anything if a newly opened/uncovered PR exists.
if(blockedPRs.length){
  throw new Error('Refusing cleanup: unresolved active/open PRs: '+blockedPRs.map(p=>p.number).join(','));
}
console.log('All',eligiblePRs.length,'existing open PR heads preserved by archive ancestry');
if(eligiblePRs.length<40)
  throw new Error('Expected ~46 open draft research PRs; aborting on unexpected count');
for(const pr of eligiblePRs){
  // Refresh PR state and head at the moment of closure.
  const live=await request('GET','/pulls/'+pr.number);
  if(live.state!=='open'||!live.draft||live.head.sha!==pr.head.sha||
    live.head.ref!==pr.head.ref||!await covered(live.head.sha))
    throw new Error('PR changed during cleanup: #'+pr.number);
  await request('PATCH','/pulls/'+pr.number,{state:'closed'});
  console.log('Closed archived draft PR #'+pr.number);
}
console.log('Draft PR preservation complete; listing branch references');
const branches=await pages('/branches');
const shaByName=new Map(branches.map(b=>[b.name,b.commit.sha]));
let deleted=0,notCovered=0,skipProtected=0,changed=0;
const MAX_DELETES=350;
for(const branch of branches){
  if(deleted>=MAX_DELETES)break;
  const name=branch.name,sha=branch.commit.sha;
  if(protectedNames.has(name)||branch.protected){skipProtected++;continue;}
  if(!await covered(sha)){notCovered++;continue;}
  // Make sure the branch still points at exactly the commit checked above.
  const live=await request('GET','/branches/'+encodeURIComponent(name));
  if(live.protected||live.commit.sha!==sha){changed++;continue;}
  // Additional protection: don't delete an actively-open PR head if one appeared.
  // All open PR heads were archived/closed above; run is intentionally serialized.
  try {
    await request('DELETE','/git/refs/heads/'+name.split('/').map(encodeURIComponent).join('/'));
    deleted++;
    console.log('Deleted verified-archived ref:',name,sha);
  }catch(err){
    console.log('Deletion rejected for',name,':',String(err).slice(0,180));
  }
}
const summary=[
  '# DNDNext branch retirement',
  '- Consolidated Git history commit: `'+head+'`',
  '- Source draft PRs closed after exact-head ancestry validation: **'+eligiblePRs.length+'**',
  '- Verified covered GitHub branch refs deleted: **'+deleted+'**',
  '- Unique/not-provably-covered branches retained: **'+notCovered+'**',
  '- Protected/active refs retained: **'+skipProtected+'**',
  '- Refs changed during cleanup, retained: **'+changed+'**',
  '- Deleted branch **references**, not Vercel preview deployments. Vercel retention handles those separately.',
  '- Production main and Supabase were untouched.'
].join('\n')+'\n';
console.log(summary);
if(process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
