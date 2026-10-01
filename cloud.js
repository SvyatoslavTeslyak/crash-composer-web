const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await window.ComposerAuth.ready;
const client=window.ComposerAuth.client;
const button=$('#cloud-configurations'),dialog=document.createElement('dialog');dialog.className='share-dialog cloud-dialog';dialog.setAttribute('aria-labelledby','cloud-title');document.body.append(dialog);
let cloudMode=!window.ComposerAuth.local,member=null,session=null,versions=[],notices=[],busy=false,refreshId=0,currentDraft=null,published=null,basePayload={},loadError='';
// Changes has two scopes, each with its own draft, sent versions and release: the selected
// game's own changes, and the brands every game shares ("shared", once the cloud has it).
const SHARED='shared';let scope='game',sharedThere=false,sharedState=null;
const game=()=>scope===SHARED?SHARED:window.ComposerTarget.value;
const scopeTitle=()=>scope===SHARED?'Brands · all games':ComposerTarget.entry().title;
const check=result=>{if(result.error)throw Error(result.error.message);return result.data};
async function rpc(name,args){return check(await client.rpc(name,args))}
async function draft(id){const value=check(await client.from('composer_drafts').select('*').eq('game_id',id).single());return value}
function clean(values,source){
 if(!values||typeof values!=='object'||Object.keys(values).some(k=>!['en','fr','ht'].includes(k)))throw Error('Invalid languages');
 for(const value of Object.values(values)){if(typeof value!=='string'||value.length>8000||/[<>]/.test(value))throw Error('Use plain text or Markdown, without HTML');if(value&&(value.match(/\{\w+\}/g)||[]).sort().join()!==(source.match(/\{\w+\}/g)||[]).sort().join())throw Error('Keep source variables unchanged')}
}
window.ComposerCloud={
 get enabled(){return cloudMode},
 async translations(id,options){
  await window.ComposerAuth.ready;
  if(!client||!window.ComposerAuth.session)throw Error('Sign in to Cloud to access the draft.');
  if(id==='kit')throw Error('Cloud drafts are per game. Select a game.');
  const response=await fetch('translations?game='+encodeURIComponent(id),{cache:'no-store'});if(!response.ok)throw Error('Local translation schema is unavailable');const base=await response.json();
  let saved=await draft(id);
  if(options?.method==='POST'){
   if(!window.ComposerAuth.canEdit(id))throw Error('You have read-only access to this game.');
   const body=JSON.parse(options.body);if(body.revision!=='cloud:'+saved.revision)throw Error('Cloud draft changed. Reload before saving.');
   const translations={...body.overrides};for(const [key,values] of Object.entries(body.entries||{}))translations[key]={...translations[key],...values};
   for(const [key,values] of Object.entries(translations)){if(!base.catalog.entries[key])throw Error('Unknown translation key: '+key);clean(values,base.catalog.entries[key].source)}
   window.ComposerUX?.status('saving');
   try{saved=await rpc('composer_save_draft',{p_game:id,p_revision:saved.revision,p_payload:{...saved.payload,translations}});}catch(error){window.ComposerUX?.status('error',error.message);throw error}
   window.dispatchEvent(new CustomEvent('composer-draft-saved',{detail:{game:id,section:'translations',revision:saved.revision}}));
  }
  return {catalog:base.catalog,overrides:saved.payload.translations||{},revision:'cloud:'+saved.revision};
 }
};
function canSwitch(){return !document.querySelector('.workspace-dirty')&&!window.ComposerLook?.dirty}

const sectionNames={translations:'Translations',design:'Design',audio:'Sounds'};
const feedback=document.createElement('span');feedback.id='changes-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');button.after(feedback);
const isReviewer=()=>ComposerAuth.member?.role!=='art_director'&&ComposerAuth.has('drafts.review',game());
let feedbackTimer;
let localConfig=null,releases=[];
let authors=new Map(),contributors=[],contributorsError=false;
function authorName(id){return authors.get(id)||(id===session?.user?.id?(session.user.user_metadata?.full_name||session.user.email):null)||'Unknown author'}
function authorLine(label,id,time){return '<p class="review-author">'+esc(label)+' <strong>'+esc(authorName(id))+'</strong>'+(time?' <span>· '+esc(new Date(time).toLocaleString())+'</span>':'')+'</p>'}
function notify(text){feedback.textContent=text;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>feedback.textContent='',7000)}
const dirty=()=>!canSwitch();
function flat(value,path='',out={}){
 if(value&&typeof value==='object'){
  if(Array.isArray(value)){value.forEach((v,i)=>flat(v,path+'/'+(v?.id||String(i+1)),out))}
  else for(const [k,v] of Object.entries(value))flat(v,path+'/'+k,out);
 }else out[path]=value;
 return out;
}
function changes(payload,baseline){
 return Object.keys(sectionNames).map(section=>{
  // Missing sections mean no overrides, not deletion of the shipped library.
  if(!payload?.[section])return {section,rows:[]};
  const before=flat(baseline?.[section]||{}),after=flat(payload[section]);
  return {section,rows:[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>!(section==='design'&&(k==='/selection'||k.startsWith('/selection/')))&&before[k]!==after[k]).map(path=>({path,before:before[path],after:after[path]}))};
 });
}
function draftChanges(){return changes(currentDraft?.payload,{...basePayload,...published?.payload})}
function sentVersions(){return versions.filter(v=>['submitted','approved'].includes(v.status)&&Number(v.revision)>Number(published?.revision||0)).sort((a,b)=>Number(b.revision)-Number(a.revision))}
function editingBaseline(){return {...basePayload,...published?.payload,...sentVersions()[0]?.payload}}
function newChanges(){return changes({...basePayload,...currentDraft?.payload},editingBaseline())}
function returnedVersion(){return versions.find(v=>v.status==='rejected'&&Number(v.revision)===Number(currentDraft?.revision))}
function renderProgress(){
 const review=isReviewer(),pending=versions.filter(v=>v.status==='submitted').length;
 const awaiting=review?0:sentVersions().filter(v=>v.status==='submitted').length;
 const unsent=canSubmit()?1:0;
 const count=review?pending+unsent:newChanges().reduce((sum,g)=>sum+g.rows.length,0);
 // An Admin sees on the button itself what is left between an accepted version and the sites.
 const flag=releaseFlag();
 const states=[];
 if(flag)states.push(['release',flag.label+': '+flag.title]);
 if(scope==='game'&&sharedState)states.push(['shared','Brands · all games: '+sharedState.label]);
 if(awaiting)states.push(['awaiting',awaiting+' awaiting review']);
 if(count)states.push(['saved',count+(review?' to review':' saved '+(count===1?'change':'changes')+', not sent')]);
 button.innerHTML=(states.length?'<span class="changes-dot '+states[0][0]+'" aria-hidden="true"></span>':'')+'<span>Changes</span>'+(count?'<span class="changes-badge" aria-hidden="true">'+(count>99?'99+':count)+'</span>':'');
 window.ComposerUX?.refresh();
 button.setAttribute('aria-label','Changes'+(count?', '+count+(review?' to review':' saved changes'):'')+(awaiting?', '+awaiting+' awaiting review':''));
 button.disabled=busy;
 button.title=states.length?states.map(x=>x[1]).join('\n'):'Nothing waiting to be published';
 button.hidden=!review&&!ComposerAuth.has('drafts.submit',game());
}
const showValue=v=>v===undefined?'Not set':v===null?'Default':v===true?'On':v===false?'Off':String(v);
function reviewGroup(section,row,payload,baseline){
 const p=row.path.split('/').filter(Boolean),labels=baseline?._labels;
 const pretty=v=>String(v||'Setting').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
 if(section==='translations')return {key:p[0],title:labels?.translations?.[p[0]]||p[0],category:'Languages',label:({en:'English',fr:'French',ht:'Creole'}[p[1]]||p[1])};
 if(section==='audio')return {key:p.slice(0,3).join('/'),title:(p[0]==='kit'?'Interface sounds':'Scene sounds')+' · '+(labels?.events?.[p[0]]?.[p[2]]||pretty(p[2])),category:'Sound settings',label:p.slice(3).map(v=>({volume_db:'Volume (dB)',pitch_jitter:'Pitch variation',takes:'Take',enabled:'Enabled'})[v]||pretty(v)).join(' · ')};
 const brand=payload?.design?.brands?.[p[1]]||baseline?.design?.brands?.[p[1]],title=brand?.title||labels?.brands?.[p[1]]||pretty(p[1]);
 const theme=p[2]==='themes',tail=p.slice(theme?4:2),themeId=p[3];
 const category=({roles:'Colors',overrides:'Component styles',fonts:'Fonts'})[tail[0]]||'General';
 return {key:p.slice(0,theme?4:2).join('/'),title:title+(theme?' · '+(brand?.themes?.[themeId]?.title||baseline?.design?.brands?.[p[1]]?.themes?.[themeId]?.title||pretty(themeId)):' · Brand'),category,label:tail.slice(['roles','overrides','fonts'].includes(tail[0])?1:0).map(pretty).join(' · ')||'Brand'};
}
function reviewValue(value){
 const swatch=typeof value==='string'&&/^#[0-9a-f]{3,8}$/i.test(value)?'<span class="review-swatch" style="background:'+value+'" aria-hidden="true"></span>':'';
 return swatch+esc(showValue(value));
}
function diffHTML(payload,baseline){
 const sections=changes(payload,baseline).filter(g=>g.rows.length);
 return sections.map(section=>{
  const groups=new Map();
  for(const row of section.rows){const info=reviewGroup(section.section,row,payload,baseline);if(!groups.has(info.key))groups.set(info.key,{title:info.title,count:0,categories:new Map()});const group=groups.get(info.key);group.count++;if(!group.categories.has(info.category))group.categories.set(info.category,[]);group.categories.get(info.category).push({...row,label:info.label})}
  return '<section class="review-section"><h3>'+sectionNames[section.section]+' <small>'+section.rows.length+' changes</small></h3>'+[...groups].map(([key,g])=>'<details class="review-group" data-review-group="'+esc(section.section+'/'+key)+'" open><summary><span>'+esc(g.title)+'</span><span class="review-count">'+g.count+'</span></summary>'+[...g.categories].map(([category,rows])=>'<div class="review-category"><h4>'+esc(category)+'</h4><table class="review-changes"><thead><tr><th>Setting</th><th>Before</th><th>After</th></tr></thead><tbody>'+rows.map(r=>'<tr><th>'+esc(r.label)+'</th><td>'+reviewValue(r.before)+'</td><td>'+reviewValue(r.after)+'</td></tr>').join('')+'</tbody></table></div>').join('')+'</details>').join('')+'</section>';
 }).join('')||'<p>No saved changes compared with the published version.</p>';
}

function message(text){const status=dialog.querySelector('[role=status]');if(status)status.textContent=text}
function canSubmit(){return !loadError&&!!currentDraft&&!dirty()&&newChanges().some(g=>g.rows.length)&&!versions.some(v=>Number(v.revision)===Number(currentDraft.revision))&&ComposerAuth.has('drafts.submit',game())}
function canDiscard(){return ComposerAuth.member?.role==='admin'&&!!currentDraft&&(dirty()||draftChanges().some(g=>g.rows.length)||versions.some(v=>['submitted','approved'].includes(v.status)))}
function busyControls(){const hint=$('#cloud-save-hint');if(hint)hint.textContent=dirty()?'Save your open edits to include them in this list.':!canSubmit()&&versions.some(v=>Number(v.revision)===Number(currentDraft?.revision))?returnedVersion()?'Returned by Admin. Make your corrections and save before sending again.':'':'';const submit=$('#cloud-submit');if(submit){submit.disabled=busy||!canSubmit();submit.title=dirty()?'Save your open edits first':canSubmit()?'Send saved changes to Admin':'No new saved changes to send'}for(const b of dialog.querySelectorAll('button:not([data-close]):not(#cloud-submit)'))b.disabled=busy;const ownDiscard=$('#cloud-discard-unsent');if(ownDiscard)ownDiscard.disabled=busy||(!dirty()&&!newChanges().some(g=>g.rows.length));const discard=$('#cloud-discard');if(discard)discard.disabled=busy||!canDiscard();const apply=$('#cloud-apply-draft');if(apply)apply.disabled=busy||!canApplyDraft();renderProgress()}
async function run(fn){if(busy)return;busy=true;busyControls();try{await fn()}catch(e){message(e.message);notify(e.message)}finally{busy=false;busyControls();renderProgress()}}
async function refresh(){
 const request=++refreshId,id=game();if(!client||ComposerAuth.local)return;
 sharedThere=!!(await window.ComposerDraftEditors?.shared?.().catch(()=>false))&&ComposerAuth.has('workspace.view',SHARED);
 if(id==='kit'){currentDraft=null;versions=[];published=null;basePayload={};loadError='';render();return}
 const auth=check(await client.auth.getSession());session=auth.session;
 member=session?check(await client.from('composer_members').select('role,active').eq('user_id',session.user.id).maybeSingle()):null;
 if(session&&member?.active){
  const [v,n,d,p,a]=await Promise.all([client.from('composer_versions').select('*').eq('game_id',id).order('submitted_at',{ascending:false}).limit(20),client.from('composer_notifications').select('id,kind,version_id,read_at,created_at').order('created_at',{ascending:false}).limit(30),draft(id),client.from('composer_versions').select('*').eq('game_id',id).eq('status','published').order('revision',{ascending:false}).limit(1),ComposerAuth.member?.role==='admin'?Promise.resolve(client.rpc('composer_list_members')).catch(()=>({data:[]})):Promise.resolve({data:[]})]);
  let attribution={data:[]};if(ComposerAuth.member?.role==='admin')try{attribution=await client.rpc('composer_draft_contributors',{p_game:id,p_revision:d.revision})}catch{attribution={error:true}}
  const baseline=await window.ComposerDraftEditors.baseline(d.payload,id);
  if(request!==refreshId||id!==game())return;
  const receipts=await client.from('composer_releases').select('version_id,published_at,git_commit').order('published_at',{ascending:false}).limit(100);
  if(request!==refreshId||id!==game())return;
  releases=receipts.error?[]:receipts.data||[];
  // Which version this machine's configuration file holds and how far it has got: read from
  // the file and git, so it is still known after a reload.
  const local=localRelease()?await fetch('release/status?game='+encodeURIComponent(id)).then(r=>r.ok?r.json():null).catch(()=>null):null;
  if(request!==refreshId||id!==game())return;
  localConfig=local;
  if(scope==='game'&&sharedThere){const summary=await sharedSummary().catch(()=>null);if(request!==refreshId||id!==game())return;sharedState=summary}
  contributors=attribution.data||[];contributorsError=!!attribution.error;
  authors=new Map((a.error?[]:a.data||[]).map(person=>[person.user_id,person.name?person.name+' ('+person.email+')':person.email]));versions=check(v);notices=check(n);currentDraft=d;published=check(p)[0]||null;basePayload=baseline;loadError='';
 }else{versions=[];notices=[];currentDraft=null;localConfig=null}
 render();
}
function jsonView(payload,title='JSON of this version'){return '<details class="review-json"><summary>'+esc(title)+'</summary><pre tabindex="0">'+esc(JSON.stringify(payload,null,2))+'</pre></details>'}
function localRelease(){return !window.ComposerHosting&&['127.0.0.1','localhost'].includes(location.hostname)}
// An accepted version's road to the sites, and where it stands on this machine: accepted, then
// applied to the local configuration file, committed, pushed. A step that is done reads as a
// fact with a tick; one still to do reads as a numbered action, so neither can be taken for
// the other. Only a version that is not the one in the local file offers Apply locally.
const STEPS_DONE=['Accepted','Applied locally','Committed','Pushed'],STEPS_TODO=['Accept','Apply locally','Commit','Push'];
function canRelease(){return ComposerAuth.member?.role==='admin'&&ComposerAuth.has('releases.publish',game())&&localRelease()}
const releaseStep=v=>localConfig?.version_id===v.id?({uncommitted:2,committed:3,pushed:4}[localConfig.state]||1):v.status==='approved'?1:0;
const releaseSteps=done=>'<ol class="release-steps" aria-label="Release progress">'+STEPS_DONE.map((label,i)=>i<done?'<li class="done">✓ '+label+'</li>':'<li class="'+(i===done?'next':'todo')+'">'+(i+1)+'. '+STEPS_TODO[i]+(i===done?' · next':'')+'</li>').join('')+'</ol>';
const localFile=()=>'<code>'+esc(localConfig.path)+'</code>';
function releaseActions(v){
 if(!canRelease())return '';
 const done=releaseStep(v);
 if(done<2){
  // Another version is already in the local file: say what applying this one does to it.
  const other=localConfig&&localConfig.state!=='none'&&localConfig.version_id!==v.id;
  const note=!other?'':localConfig.state==='uncommitted'?'Not applied yet. '+localFile()+' holds revision '+esc(localConfig.revision)+', applied earlier and not committed; applying this version replaces it.':'Not applied yet. '+localFile()+' holds revision '+esc(localConfig.revision)+'; applying this version writes revision '+esc(v.revision)+' over it.';
  return releaseSteps(done)+(note?'<p class="review-intro">'+note+'</p>':'')+'<div class="release-action"><button class="wb-button primary" data-apply="'+esc(v.id)+'">Apply locally</button></div>';
 }
 const next=done===2?'This version is written to '+localFile()+'. Next: commit and push that file. Pushing publishes it to Composer web and Showcase.'
  :done===3?localFile()+' is committed. Next: push to GitHub. Pushing publishes it to Composer web and Showcase.'
  :localFile()+' is pushed. GitHub is publishing it; this version moves to Published history when that is done.';
 return releaseSteps(done)+'<p class="review-applied" role="status">'+next+'</p>';
}
// The shared brands in two words, shown while a game's changes are open: what is waiting there.
async function sharedSummary(){
 const [d,v]=await Promise.all([draft(SHARED),client.from('composer_versions').select('id,revision,status').eq('game_id',SHARED).order('revision',{ascending:false}).limit(20)]);
 const list=check(v),latest=list.find(x=>x.status==='published'),newer=x=>Number(x.revision)>Number(latest?.revision||0);
 const admin=ComposerAuth.member?.role==='admin'&&ComposerAuth.has('releases.publish',SHARED)&&localRelease();
 const local=admin?await fetch('release/status?game='+SHARED).then(r=>r.ok?r.json():null).catch(()=>null):null;
 const accepted=list.filter(x=>x.status==='approved'&&newer(x)),waiting=list.filter(x=>x.status==='submitted'&&newer(x)).length;
 if(admin&&accepted.some(x=>x.id!==local?.version_id))return {label:'Not applied'};
 if(admin&&local?.state==='uncommitted')return {label:'Not committed'};
 if(admin&&local?.state==='committed')return {label:'Not pushed'};
 if(waiting&&ComposerAuth.has('drafts.review',SHARED))return {label:waiting+' to review'};
 // Saved but not sent: the draft has moved on from every version of it.
 if(Number(d.revision)>0&&!list.some(x=>Number(x.revision)===Number(d.revision)))return {label:'Saved, not sent'};
 return null;
}
// The same, in two words, for the Changes button: the first thing still to do on this computer.
function releaseFlag(){
 if(!canRelease()||!localConfig)return null;
 if(versions.some(v=>v.status==='approved'&&v.id!==localConfig.version_id))return {label:'Not applied',title:'An accepted version is not applied on this computer yet.'};
 if(localConfig.state==='uncommitted')return {label:'Not committed',title:localConfig.path+' is applied but not committed. Commit and push it to publish.'};
 if(localConfig.state==='committed')return {label:'Not pushed',title:localConfig.path+' is committed but not pushed. Push to publish.'};
 return null;
}
// What an Admin must not miss, said first: the local configuration file is applied but not
// committed, or committed but not pushed, or an accepted version is still waiting to be applied.
function localBanner(){
 if(!canRelease()||!localConfig)return '';
 const waiting=versions.filter(v=>v.status==='approved'&&v.id!==localConfig.version_id),lines=[];
 if(waiting.length){
  // A newer accepted version comes first: committing the file as it is would publish the old one.
  const held=localConfig.state==='none'?'':' '+localFile()+' still holds revision '+esc(localConfig.revision)+(localConfig.state==='uncommitted'?', applied earlier and not committed':'')+'.';
  lines.push('<strong>Not applied.</strong> '+(waiting.length===1?'Accepted revision '+esc(waiting[0].revision)+' is':waiting.length+' accepted versions are')+' not applied on this computer yet.'+held+' Apply locally below, then commit and push.');
 }
 else if(localConfig.state==='uncommitted')lines.push('<strong>Not committed.</strong> '+localFile()+' holds revision '+esc(localConfig.revision)+', applied on this computer but not committed. Commit and push it to publish. <button class="wb-button primary" id="copy-publish">Copy publish commands</button>');
 else if(localConfig.state==='committed')lines.push('<strong>Not pushed.</strong> '+localFile()+' (revision '+esc(localConfig.revision)+') is committed here but not pushed. Push to GitHub to publish.');
 else if(localConfig.state==='pushed'&&published?.id!==localConfig.version_id)lines.push('<strong>Publishing.</strong> '+localFile()+' (revision '+esc(localConfig.revision)+') is pushed; GitHub is publishing it.');
 return lines.length?'<aside class="local-banner" role="status" aria-label="Local configuration">'+lines.map(line=>'<p>'+line+'</p>').join('')+'</aside>':'';
}
function canApplyDraft(){return canRelease()&&!loadError&&!dirty()&&!!currentDraft&&draftChanges().some(g=>g.rows.length)&&!versions.some(v=>Number(v.revision)===Number(currentDraft.revision)&&['rejected','published'].includes(v.status))}
function draftReview(){
 // A saved state that has already been sent or accepted is the version listed above; showing
 // it again here, with a second Apply locally, only made one change look like two.
 if(versions.some(v=>Number(v.revision)===Number(currentDraft?.revision)&&['submitted','approved'].includes(v.status)))return '';
 if(!draftChanges().some(g=>g.rows.length))return '<p class="review-intro">No saved changes to apply.</p>';
 const names=[...new Set(contributors.map(item=>authorName(item.actor)))];
 return '<section class="review-queue"><h3>All saved changes</h3><p class="review-intro">'+(scope===SHARED?'This applies the complete saved brands for every game':'This applies the complete saved state for this game')+', including teammates’ changes. Review everything below before applying.</p>'+authorLine('Last saved by',currentDraft?.updated_by,currentDraft?.updated_at)+'<p class="review-author">'+(contributorsError?'Contributor history unavailable.':names.length?'Contributors since the last publication: '+names.map(esc).join(', '):'No tracked contributor history.')+' Older edits may have no attribution.</p>'+diffHTML({...basePayload,...currentDraft.payload},{...basePayload,...published?.payload})+'<p id="cloud-save-hint"></p>'+(localRelease()?'<button class="wb-button primary" id="cloud-apply-draft">Apply locally</button>':'')+'</section>';
}
async function applyVersion(versionId,id){
 const auth=check(await client.auth.getSession());const response=await fetch('release/apply',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.session.access_token},body:JSON.stringify({version_id:versionId})});const data=await response.json();if(!response.ok)throw Error(data.message||'Could not apply configuration');await refresh();message('Applied locally: '+data.path+'. Review, commit and push to publish.');notify('Configuration ready to commit');
}
function reviewStatus(status,count){const accepted=status==='approved';return '<span class="review-status '+(accepted?'accepted':'awaiting')+'"'+(accepted?' title="Accepted by Admin; not published yet"':'')+'>'+(accepted?'Accepted':'Awaiting review')+(count?' · '+count:'')+'</span>'}
function publicationHistory(){
 const items=versions.filter(v=>v.status==='published');if(published&&!items.some(v=>v.id===published.id))items.unshift(published);
 return items.length?'<details class="review-history"><summary>Published history · '+items.length+'</summary>'+items.map(v=>{const r=releases.find(r=>r.version_id===v.id);return '<p>Revision '+esc(v.revision)+(r?.published_at?' · '+esc(new Date(r.published_at).toLocaleString()):'')+'</p>'}).join('')+(scope===SHARED?'':'<a target="_blank" rel="noopener" href="https://svyatoslavteslyak.github.io/game-showcase/games/'+encodeURIComponent(game())+'/index.html">Open published game ↗</a>')+'</details>':'';
}
function reviewVersions(){
 const groups=[['submitted','Needs review','Apply locally accepts this version and writes it to this game’s configuration file on this computer. Use Discard all changes to reset unpublished changes for this game.'],['approved','Accepted · not published','Accepted by Admin. It is published once its configuration file is applied here, committed and pushed.']];
 return groups.map(([status,title,hint])=>{const items=sentVersions().filter(v=>v.status===status);return items.length?'<section class="review-queue" data-review-status="'+status+'"><h3>'+title+' <span class="review-count">'+items.length+'</span></h3><p class="review-intro">'+hint+'</p><div class="cloud-list">'+items.map(v=>'<article><strong>'+esc(v.summary)+'</strong>'+authorLine('Sent by',v.submitted_by,v.submitted_at)+diffHTML(v.payload,{...basePayload,...published?.payload})+jsonView({schema_version:1,game_id:v.game_id,version_id:v.id,revision:v.revision,payload:v.payload})+'<div class="share-actions">'+releaseActions(v)+'</div>'+'</article>').join('')+'</div></section>':''}).join('');
}

function render(){
 renderProgress();if(!isReviewer()&&!ComposerAuth.has('drafts.submit',game())){if(dialog.open)dialog.close();return}
 const collapsed=new Set([...dialog.querySelectorAll('[data-review-group]:not([open])')].map(el=>el.dataset.reviewGroup));
 const sentExpanded=dialog.querySelector('.review-sent')?.open;
 const sent=sentVersions(),newCount=newChanges().reduce((sum,g)=>sum+g.rows.length,0);
 dialog.innerHTML='<header><div><small>'+esc(scopeTitle())+'</small><div class="review-heading"><h2 id="cloud-title">Changes</h2>'+(!isReviewer()?['submitted','approved'].map(status=>{const count=sent.filter(v=>v.status===status).length;return count?reviewStatus(status,count):''}).join(''):'')+'</div></div><button class="wb-button" data-close aria-label="Close">✕</button></header>'+
 (sharedThere?'<div class="scope-tabs" role="group" aria-label="Whose changes"><button type="button" class="wb-button" data-scope="game" aria-pressed="'+(scope==='game')+'">'+esc(ComposerTarget.entry().title)+'</button><button type="button" class="wb-button" data-scope="'+SHARED+'" aria-pressed="'+(scope===SHARED)+'">Brands · all games'+(scope==='game'&&sharedState?' <span class="changes-flag shared">'+esc(sharedState.label)+'</span>':'')+'</button></div><p class="review-intro scope-about">'+(scope===SHARED?'Brands, their colours, faces and seasons belong to every game. A change here is reviewed and published once, for all of them.':'This game’s own changes: its texts, sounds, and any season or faces it keeps for itself.')+'</p>':'')+
 '<button class="wb-button" id="cloud-refresh">Refresh</button>'+
 (ComposerAuth.member?.role==='admin'?' <button class="wb-button discard-changes" id="cloud-discard">Discard all changes</button>':'')+localBanner()+
 (ComposerAuth.member?.role==='admin'&&ComposerAuth.has('releases.publish',game())&&!localRelease()?'<aside class="review-local-note" aria-label="Publishing changes"><strong>Publish from local Composer</strong><p>You can review changes here. To publish them, open local Composer and sign in with the same Admin account. In Changes, review all saved changes or a sent version and click <b>Apply locally</b>, then commit and push the configuration file. GitHub will update Composer web and Showcase automatically.</p></aside>':'')+
 (isReviewer()?reviewVersions():'')+
 (!isReviewer()?'<p class="review-intro">Review your saved changes, then send them to Admin. This game draft is shared with your team.</p>':'')+
 '<div id="draft-changes">'+(isReviewer()?draftReview():
 (newCount?'<h3 class="review-new-title">'+(returnedVersion()?'Returned for changes':'New changes')+' <span class="review-count">'+newCount+'</span></h3>'+diffHTML({...basePayload,...currentDraft?.payload},editingBaseline()):'<div class="review-empty"><strong>'+(sent.length?'All changes sent':'No new changes')+'</strong><p>'+(sent.length?'Your changes are with Admin. You can keep editing; only new edits will appear here.':'Saved edits will appear here when you change texts, design or sounds.')+'</p></div>'))+'</div>'+

 (!isReviewer()?'<div class="review-send"><p id="cloud-save-hint"></p><button class="wb-button discard-changes" id="cloud-discard-unsent">Discard unsent changes</button><button class="wb-button primary" id="cloud-submit"'+(!newCount?' hidden':'')+'>Send changes</button></div>'+ (sent.length?'<details class="review-sent"><summary><span>Sent to Admin</span><span class="review-count">'+sent.length+'</span></summary><p>Already sent. These changes are not included in your red counter.</p>'+sent.map(v=>'<details class="review-sent-version"><summary><span class="review-version-label"><strong>View changes</strong><time>'+esc(new Date(v.submitted_at).toLocaleString())+'</time></span>'+reviewStatus(v.status)+'</summary>'+diffHTML(v.payload,{...basePayload,...published?.payload})+jsonView(v.payload)+'</details>').join('')+'</details>':''):'')+
 publicationHistory()+
 '<p role="status" aria-live="polite"></p>';
 if(sentExpanded&&dialog.querySelector('.review-sent'))dialog.querySelector('.review-sent').open=true;
 for(const group of dialog.querySelectorAll('[data-review-group]'))if(collapsed.has(group.dataset.reviewGroup))group.open=false;
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();$('#cloud-refresh').onclick=()=>run(refresh);
 $('#cloud-discard')?.addEventListener('click',()=>{if(!canDiscard()||busy)return;const id=game(),revision=currentDraft.revision;if(!confirm('Discard all unpublished changes for '+scopeTitle()+'? This includes shared draft edits, open edits in this window, and sent or approved versions. The published game stays unchanged.'))return;run(async()=>{await rpc('composer_discard_changes',{p_game:id,p_revision:revision});location.reload()})});
 $('#cloud-discard-unsent')?.addEventListener('click',()=>{
  if(busy)return;
  if(!confirm('Discard your unsent edits for '+scopeTitle()+'? Your tracked edits and unsaved edits in this window will be reset. Sent versions and other people’s changes will stay. Older edits without authorship history will be preserved.'))return;
  run(async()=>{if(!newChanges().some(g=>g.rows.length)&&dirty()){location.reload();return}await rpc('composer_discard_unsent',{p_game:game(),p_revision:currentDraft.revision});location.reload()});
 });
 for(const b of dialog.querySelectorAll('[data-apply]'))b.onclick=()=>{
  if(!confirm('Apply this sent version to the local game configuration? Review the file, then commit and push to publish.'))return;
  const id=game();run(()=>applyVersion(b.dataset.apply,id));
 };
 $('#cloud-apply-draft')?.addEventListener('click',()=>{
  if(busy||!canApplyDraft())return;
  const id=game(),revision=currentDraft.revision;
  if(!confirm('Apply all reviewed saved changes, including teammates’ edits, to the local configuration? This does not publish.'))return;
  run(async()=>{const version=await rpc('composer_accept_draft',{p_game:id,p_revision:revision});try{await applyVersion(version.id,id)}catch(error){await refresh();throw error}});
 });
 $('#cloud-submit')?.addEventListener('click',sendChanges);
 dialog.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{
  if(busy||b.dataset.scope===scope)return;
  if(dirty()){message('Save or cancel your open edits before switching.');return}
  setScope(b.dataset.scope);render();run(refresh);
 });
 $('#copy-publish')?.addEventListener('click',async()=>{const path=localConfig?.path;if(!/^configurations\/[a-z][a-z0-9_]*\.json$/.test(path))return;try{await navigator.clipboard.writeText('git add -- '+path+'\ngit diff --cached -- '+path+'\ngit commit --only '+path+' -m "Publish reviewed game configuration"\ngit push origin main');message('Publish commands copied. Run them from the Composer repository.')}catch{message('Could not copy. Review, commit and push '+path+' from the Composer repository.')}});
 busyControls();
}
// Another scope's draft, versions and local file are nothing to do with this one's.
function setScope(next){scope=next;++refreshId;currentDraft=null;published=null;versions=[];basePayload={};localConfig=null}
function open(){render();if(!dialog.open)dialog.showModal();run(refresh)}
// Outside the dialog Changes is about the selected game; the shared brands show as a flag there.
dialog.addEventListener('close',()=>{if(scope!=='game'){setScope('game');renderProgress();schedule()}});
button.onclick=open;
function sendChanges(){
 run(async()=>{
  if(!canSubmit())throw Error('Save your changes first.');
  const id=game(),revision=currentDraft.revision;
  const sections=newChanges().filter(g=>g.rows.length).map(g=>sectionNames[g.section]).join(', ');
  await rpc('composer_submit',{p_game:id,p_revision:revision,p_summary:scopeTitle()+' · '+sections});
  await refresh();notify('Changes sent to Admin');
 });
};
let refreshTimer;
function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(busy){schedule();return}run(async()=>{try{await refresh()}catch(e){loadError=e.message;renderProgress();throw e}})},250)}
window.addEventListener('composer-target',()=>{setScope('game');renderProgress();schedule()});
window.addEventListener('composer-draft-saved',schedule);
window.addEventListener('focus',()=>{if(!dialog.open)schedule()});
let lastDirty=false;setInterval(()=>{const d=dirty();if(d!==lastDirty){lastDirty=d;renderProgress();busyControls()}},500);
setInterval(()=>{if((isReviewer()||ComposerAuth.has('drafts.submit',game()))&&!busy&&!dialog.contains(document.activeElement))schedule()},15000);
if(cloudMode)run(async()=>{try{await refresh();window.dispatchEvent(new Event('composer-storage'))}catch(e){loadError=e.message;renderProgress();throw e}});
if(ComposerAuth.local)window.dispatchEvent(new Event('composer-storage'));
