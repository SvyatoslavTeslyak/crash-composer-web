const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await window.ComposerAuth.ready;
const client=window.ComposerAuth.client;
const button=$('#cloud-configurations'),dialog=document.createElement('dialog');dialog.className='share-dialog cloud-dialog';dialog.setAttribute('aria-labelledby','cloud-title');document.body.append(dialog);
let cloudMode=!window.ComposerAuth.local,member=null,session=null,versions=[],notices=[],busy=false,refreshId=0,currentDraft=null,published=null,basePayload={},loadError='';
const game=()=>window.ComposerTarget.value;
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
   saved=await rpc('composer_save_draft',{p_game:id,p_revision:saved.revision,p_payload:{...saved.payload,translations}});
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
  return {section,rows:[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>before[k]!==after[k]).map(path=>({path,before:before[path],after:after[path]}))};
 });
}
function draftChanges(){return changes(currentDraft?.payload,{...basePayload,...published?.payload})}
function renderProgress(){
 const review=isReviewer(),pending=versions.filter(v=>v.status==='submitted').length;
 const unsent=canSubmit()?1:0;
 const count=pending+unsent;
 button.innerHTML='<span>'+(review?'Changes':'Send changes')+'</span>'+(review&&count?'<span class="changes-badge" aria-hidden="true">'+(count>99?'99+':count)+'</span>':'');
 button.setAttribute('aria-label',review?'Changes'+(count?', '+count+' to review':''):'Send changes');
 button.disabled=busy||(!review&&!canSubmit());
 button.title=review?'View saved changes':dirty()?'Save your open edits first':canSubmit()?'Send saved changes to Admin':'No new saved changes to send';
 button.hidden=!review&&!ComposerAuth.has('drafts.submit',game());
}
const showValue=v=>v===undefined?'Not set':v===null?'Default':v===true?'On':v===false?'Off':String(v);
function settingLabel(section,path,labels){
 const parts=path.split('/').filter(Boolean),pretty=v=>String(v).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
 if(section==='translations')return (labels?.translations?.[parts[0]]||parts[0])+' · '+({en:'English',fr:'French',ht:'Creole'}[parts[1]]||parts[1]);
 if(section==='design'){if(parts[0]==='selection')return 'Selected '+pretty(parts[1]);return [labels?.brands?.[parts[1]]||pretty(parts[1]),...parts.slice(2).filter(v=>!['roles','overrides'].includes(v)).map(pretty)].join(' · ')}
 if(section==='audio')return [parts[0]==='kit'?'Interface sounds':'Scene sounds',labels?.events?.[parts[0]]?.[parts[2]]||pretty(parts[2]),...parts.slice(3).map(v=>({volume_db:'Volume (dB)',pitch_jitter:'Pitch variation',takes:'Take',enabled:'Enabled'})[v]||pretty(v))].join(' · ');
 return path;
}
function diffHTML(payload,baseline){
 const groups=changes(payload,baseline).filter(g=>g.rows.length);
 return groups.map(g=>'<section class="review-section"><h3>'+sectionNames[g.section]+' <small>'+g.rows.length+' changes</small></h3><table class="review-changes"><thead><tr><th>Changed setting</th><th>Before</th><th>After</th></tr></thead><tbody>'+g.rows.map(r=>'<tr><th>'+esc(settingLabel(g.section,r.path,baseline?._labels))+'</th><td>'+esc(showValue(r.before))+'</td><td>'+esc(showValue(r.after))+'</td></tr>').join('')+'</tbody></table></section>').join('')||'<p>No saved changes compared with the published version.</p>';
}
function message(text){const status=dialog.querySelector('[role=status]');if(status)status.textContent=text}
function canSubmit(){return !loadError&&!!currentDraft&&!dirty()&&draftChanges().some(g=>g.rows.length)&&!versions.some(v=>Number(v.revision)===Number(currentDraft.revision))&&ComposerAuth.has('drafts.submit',game())}
function canDiscard(){return ComposerAuth.member?.role==='admin'&&!!currentDraft&&(dirty()||draftChanges().some(g=>g.rows.length)||versions.some(v=>['submitted','approved'].includes(v.status)))}
function busyControls(){for(const b of dialog.querySelectorAll('button:not([data-close])'))b.disabled=busy;const discard=$('#cloud-discard');if(discard)discard.disabled=busy||!canDiscard();renderProgress()}
async function run(fn){if(busy)return;busy=true;busyControls();try{await fn()}catch(e){message(e.message);notify(e.message)}finally{busy=false;busyControls();renderProgress()}}
async function refresh(){
 const request=++refreshId,id=game();if(!client||ComposerAuth.local)return;
 if(id==='kit'){currentDraft=null;versions=[];published=null;basePayload={};loadError='';render();return}
 const auth=check(await client.auth.getSession());session=auth.session;
 member=session?check(await client.from('composer_members').select('role,active').eq('user_id',session.user.id).maybeSingle()):null;
 if(session&&member?.active){
  const [v,n,d,p]=await Promise.all([client.from('composer_versions').select('*').eq('game_id',id).order('submitted_at',{ascending:false}).limit(20),client.from('composer_notifications').select('id,kind,version_id,read_at,created_at').order('created_at',{ascending:false}).limit(30),draft(id),client.from('composer_versions').select('*').eq('game_id',id).eq('status','published').order('revision',{ascending:false}).limit(1)]);
  const baseline=await window.ComposerDraftEditors.baseline(d.payload,id);
  if(request!==refreshId||id!==game())return;
  versions=check(v);notices=check(n);currentDraft=d;published=check(p)[0]||null;basePayload=baseline;loadError='';
 }else{versions=[];notices=[];currentDraft=null}
 render();
}
function render(){
 renderProgress();if(!isReviewer()){if(dialog.open)dialog.close();return}
 const pending=versions.filter(v=>v.status==='submitted');
 dialog.innerHTML='<header><div><small>'+esc(ComposerTarget.entry().title)+'</small><h2 id="cloud-title">Changes</h2></div><button class="wb-button" data-close aria-label="Close">✕</button></header><button class="wb-button" id="cloud-refresh">Refresh</button>'+
 (ComposerAuth.member?.role==='admin'?' <button class="wb-button discard-changes" id="cloud-discard">Discard all changes</button>':'')+
 '<div id="draft-changes">'+diffHTML(currentDraft?.payload,{...basePayload,...published?.payload})+'</div>'+
 (pending.length?'<h3>Sent for approval</h3><div class="cloud-list">'+pending.map(v=>'<article><strong>'+esc(v.summary)+'</strong><p>'+esc(new Date(v.submitted_at).toLocaleString())+'</p><button class="wb-button" data-view="'+esc(v.id)+'">View sent changes</button> <button class="wb-button" data-review="'+esc(v.id)+'" data-approve="true">Approve</button> <button class="wb-button" data-review="'+esc(v.id)+'" data-approve="false">Return</button></article>').join('')+'</div>':'')+
 '<div id="cloud-diff"></div><p role="status" aria-live="polite"></p>';
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();$('#cloud-refresh').onclick=()=>run(refresh);
 $('#cloud-discard')?.addEventListener('click',()=>{if(!canDiscard()||busy)return;const id=game(),revision=currentDraft.revision;if(!confirm('Discard all unpublished changes for '+ComposerTarget.entry().title+'? This includes shared draft edits, open edits in this window, and sent or approved versions. The published game stays unchanged.'))return;run(async()=>{await rpc('composer_discard_changes',{p_game:id,p_revision:revision});location.reload()})});
 for(const b of dialog.querySelectorAll('[data-review]'))b.onclick=()=>run(async()=>{const approve=b.dataset.approve==='true';await rpc('composer_review',{p_version:b.dataset.review,p_approve:approve,p_note:''});await refresh();message(approve?'Approved.':'Returned.');notify(approve?'Changes approved':'Changes returned')});
 for(const b of dialog.querySelectorAll('[data-view]'))b.onclick=()=>run(async()=>{const v=versions.find(v=>v.id===b.dataset.view);const rows=check(await client.from('composer_versions').select('payload').eq('game_id',v.game_id).eq('status','published').lt('revision',v.revision).order('revision',{ascending:false}).limit(1));const base=await ComposerDraftEditors.baseline(v.payload,v.game_id);$('#cloud-diff').innerHTML='<h3>Sent changes</h3>'+diffHTML(v.payload,{...base,...rows[0]?.payload});$('#cloud-diff').scrollIntoView({block:'start',behavior:'smooth'})});
 busyControls();
}
function open(){render();if(!dialog.open)dialog.showModal();run(refresh)}
button.onclick=()=>{
 if(isReviewer()){open();return}
 run(async()=>{
  if(!canSubmit())throw Error('Save your changes first.');
  const id=game(),revision=currentDraft.revision;
  const sections=draftChanges().filter(g=>g.rows.length).map(g=>sectionNames[g.section]).join(', ');
  await rpc('composer_submit',{p_game:id,p_revision:revision,p_summary:ComposerTarget.entry().title+' · '+sections});
  await refresh();notify('Changes sent to Admin');
 });
};
let refreshTimer;
function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(busy){schedule();return}run(async()=>{try{await refresh()}catch(e){loadError=e.message;renderProgress();throw e}})},250)}
window.addEventListener('composer-target',()=>{++refreshId;currentDraft=null;published=null;versions=[];basePayload={};renderProgress();schedule()});
window.addEventListener('composer-draft-saved',schedule);
window.addEventListener('focus',()=>{if(!dialog.open)schedule()});
let lastDirty=false;setInterval(()=>{const d=dirty();if(d!==lastDirty){lastDirty=d;renderProgress();busyControls()}},500);
setInterval(()=>{if(isReviewer()&&!busy&&!dialog.contains(document.activeElement))schedule()},15000);
if(cloudMode)run(async()=>{try{await refresh();window.dispatchEvent(new Event('composer-storage'))}catch(e){loadError=e.message;renderProgress();throw e}});
if(ComposerAuth.local)window.dispatchEvent(new Event('composer-storage'));
