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
const sidebar=document.createElement('section');sidebar.id='draft-progress';sidebar.setAttribute('aria-label','Changes and review');$('#workspace-title').after(sidebar);
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
function state(){
 if(loadError)return {title:'Could not load changes',help:loadError};
 if(!currentDraft)return {title:game()==='kit'?'Choose a game':'Loading changes…',help:'Drafts belong to the selected game.'};
 if(dirty())return {title:'Unsaved changes',help:'Save or cancel your open edits before sending them for review.'};
 const version=versions.find(v=>Number(v.revision)===Number(currentDraft.revision));
 if(version){const messages={submitted:['Awaiting review','Sent to Admin. You can keep editing; new edits will form the next version.'],approved:['Approved · not published','A publisher must publish this version before players see it.'],rejected:['Changes requested','Update the draft and send a new version for review.'],published:['Published','This version has been published.']};const [title,help]=messages[version.status]||['Saved',''];return {title,help,version}}
 if(!draftChanges().some(s=>s.rows.length))return {title:'No changes to send',help:'Save edits in Brands or Translates. Sound edits save automatically. Then review and send them here.'};
 return {title:'Saved · not sent',help:'Review your saved changes and send them to Admin.'};
}
function renderProgress(){
 const s=state(),groups=draftChanges().filter(g=>g.rows.length);
 button.textContent='Changes & review'+(groups.length?' · '+groups.length:'');
 sidebar.innerHTML='<strong>'+esc(s.title)+'</strong><p>'+esc(s.help)+'</p>'+(groups.length?'<div class="draft-chips">'+groups.map(g=>'<span>'+sectionNames[g.section]+' · '+g.rows.length+'</span>').join('')+'</div>':'')+'<button type="button" class="wb-button" id="draft-open">'+(s.version?'View review status':groups.length&&ComposerAuth.has('drafts.submit',game())?'Review & send':'View changes')+'</button><small>Shared draft · '+esc(ComposerTarget.entry().title)+'</small>';
 sidebar.querySelector('button').onclick=open;
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
function busyControls(){for(const b of dialog.querySelectorAll('button:not([data-close]),textarea'))b.disabled=busy;const submit=dialog.querySelector('#cloud-submit button');if(submit)submit.disabled=busy||!canSubmit()}
async function run(fn){if(busy)return;busy=true;busyControls();try{await fn()}catch(e){message(e.message)}finally{busy=false;busyControls();renderProgress()}}
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
 const summary=dialog.dataset.game===game()?dialog.querySelector('#cloud-submit textarea')?.value||'':'';dialog.dataset.game=game();
 const reviewer=ComposerAuth.has('drafts.review',game()),s=state();renderProgress();
 dialog.innerHTML='<header><div><small>'+esc(ComposerTarget.entry().title)+'</small><h2 id="cloud-title">Changes & review</h2></div><button class="wb-button" data-close aria-label="Close">✕</button></header>'+
 '<ol class="review-steps"><li>1. Edit & save</li><li>2. Send for review</li><li>3. Approval</li><li>4. Publication</li></ol><div class="review-summary"><strong>'+esc(s.title)+'</strong><p>'+esc(s.help)+'</p></div><p class="share-note">This is a shared draft for the game. It can include changes saved by your teammates. Players see changes only after publication.</p>'+
 '<button class="wb-button" id="cloud-refresh">Refresh changes</button>'+
 (ComposerAuth.has('drafts.submit',game())?'<form id="cloud-submit"><label>What should Admin check?<textarea name="summary" rows="2" maxlength="2000" placeholder="For example: updated the button colors and lowered the cashout sound." required></textarea></label><button class="wb-button review-primary" type="submit">Send to Admin for review</button><small>Admin receives a notification. Sending does not publish the game.</small></form>':'')+
 '<div id="draft-changes">'+diffHTML(currentDraft?.payload,{...basePayload,...published?.payload})+'</div>'+
 '<h3>Review history</h3><div class="cloud-list">'+(versions.map(v=>'<article><strong>'+esc(v.summary)+'</strong><p>Version '+v.revision+' · '+esc(({submitted:'Awaiting review',approved:'Approved · not published',rejected:'Changes requested',published:'Published'})[v.status]||v.status)+'</p>'+(v.review_note?'<p>Reviewer note: '+esc(v.review_note)+'</p>':'')+'<button class="wb-button" data-view="'+esc(v.id)+'">View changes</button>'+(reviewer&&v.status==='submitted'?' <button class="wb-button" data-review="'+esc(v.id)+'" data-approve="true">Approve</button> <button class="wb-button" data-review="'+esc(v.id)+'" data-approve="false">Return</button>':'')+'</article>').join('')||'<p>No versions sent yet.</p>')+'</div><div id="cloud-diff"></div>'+
 '<details><summary>Notifications · '+notices.filter(n=>!n.read_at).length+' unread</summary>'+notices.slice(0,6).map(n=>'<p>'+esc(n.kind)+' · '+esc(new Date(n.created_at).toLocaleString())+(!n.read_at?' <button class="wb-button" data-read="'+esc(n.id)+'">Mark read</button>':'')+'</p>').join('')+'</details><p role="status" aria-live="polite"></p>';
 if(dialog.querySelector('#cloud-submit textarea'))dialog.querySelector('#cloud-submit textarea').value=summary;
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();$('#cloud-refresh').onclick=()=>run(refresh);
 $('#cloud-submit')?.addEventListener('submit',e=>{e.preventDefault();const summary=new FormData(e.target).get('summary');run(async()=>{if(!canSubmit())throw Error('Save your edits and refresh the changes before sending.');const id=game(),revision=currentDraft.revision;await rpc('composer_submit',{p_game:id,p_revision:revision,p_summary:summary});await refresh();message('Submitted. Administrators have been notified.')})});
 for(const b of dialog.querySelectorAll('[data-read]'))b.onclick=()=>run(async()=>{await rpc('composer_mark_read',{p_id:b.dataset.read});await refresh()});
 for(const b of dialog.querySelectorAll('[data-review]'))b.onclick=()=>run(async()=>{await rpc('composer_review',{p_version:b.dataset.review,p_approve:b.dataset.approve==='true',p_note:''});await refresh()});
 for(const b of dialog.querySelectorAll('[data-view]'))b.onclick=()=>run(async()=>{const v=versions.find(v=>v.id===b.dataset.view);const rows=check(await client.from('composer_versions').select('payload').eq('game_id',v.game_id).eq('status','published').lt('revision',v.revision).order('revision',{ascending:false}).limit(1));const base=await ComposerDraftEditors.baseline(v.payload,v.game_id);$('#cloud-diff').innerHTML='<h3>Version '+v.revision+' · changes from publication</h3>'+diffHTML(v.payload,{...base,...rows[0]?.payload});$('#cloud-diff').scrollIntoView({block:'start',behavior:'smooth'})});
 busyControls();
}
function open(){render();if(!dialog.open)dialog.showModal();run(refresh)}
button.onclick=open;
let refreshTimer;
function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(busy){schedule();return}run(async()=>{try{await refresh()}catch(e){loadError=e.message;renderProgress();throw e}})},250)}
window.addEventListener('composer-target',()=>{++refreshId;currentDraft=null;published=null;versions=[];basePayload={};renderProgress();schedule()});
window.addEventListener('composer-draft-saved',schedule);
window.addEventListener('focus',()=>{if(!dialog.open)schedule()});
let lastDirty=false;setInterval(()=>{const d=dirty();if(d!==lastDirty){lastDirty=d;renderProgress();busyControls()}},500);
setInterval(()=>{if(dialog.open&&!busy&&!dialog.contains(document.activeElement))schedule()},30000);
if(cloudMode)run(async()=>{try{await refresh();window.dispatchEvent(new Event('composer-storage'))}catch(e){loadError=e.message;renderProgress();throw e}});
if(ComposerAuth.local)window.dispatchEvent(new Event('composer-storage'));
