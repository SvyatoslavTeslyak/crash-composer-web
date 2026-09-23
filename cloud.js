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
let authors=new Map();
function authorName(id){return authors.get(id)||(id===session?.user?.id?session.user.email:null)||'Unknown author'}
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
  return {section,rows:[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>before[k]!==after[k]).map(path=>({path,before:before[path],after:after[path]}))};
 });
}
function draftChanges(){return changes(currentDraft?.payload,{...basePayload,...published?.payload})}
function sentVersions(){return versions.filter(v=>['submitted','approved'].includes(v.status)&&Number(v.revision)>Number(published?.revision||0)).sort((a,b)=>Number(b.revision)-Number(a.revision))}
function editingBaseline(){return {...basePayload,...published?.payload,...sentVersions()[0]?.payload}}
function newChanges(){return changes({...basePayload,...currentDraft?.payload},editingBaseline())}
function returnedVersion(){return versions.find(v=>v.status==='rejected'&&Number(v.revision)===Number(currentDraft?.revision))}
function renderProgress(){
 const review=isReviewer(),pending=versions.filter(v=>v.status==='submitted').length;
 const unsent=canSubmit()?1:0;
 const count=review?pending+unsent:newChanges().reduce((sum,g)=>sum+g.rows.length,0);
 button.innerHTML='<span>Changes</span>'+(count?'<span class="changes-badge" aria-hidden="true">'+(count>99?'99+':count)+'</span>':'');
 button.setAttribute('aria-label','Changes'+(count?', '+count+(review?' to review':' saved changes'):''));
 button.disabled=busy;
 button.title='View saved changes';
 button.hidden=!review&&!ComposerAuth.has('drafts.submit',game());
}
const showValue=v=>v===undefined?'Not set':v===null?'Default':v===true?'On':v===false?'Off':String(v);
function reviewGroup(section,row,payload,baseline){
 const p=row.path.split('/').filter(Boolean),labels=baseline?._labels;
 const pretty=v=>String(v||'Setting').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
 if(section==='translations')return {key:p[0],title:labels?.translations?.[p[0]]||p[0],category:'Languages',label:({en:'English',fr:'French',ht:'Creole'}[p[1]]||p[1])};
 if(section==='audio')return {key:p.slice(0,3).join('/'),title:(p[0]==='kit'?'Interface sounds':'Scene sounds')+' · '+(labels?.events?.[p[0]]?.[p[2]]||pretty(p[2])),category:'Sound settings',label:p.slice(3).map(v=>({volume_db:'Volume (dB)',pitch_jitter:'Pitch variation',takes:'Take',enabled:'Enabled'})[v]||pretty(v)).join(' · ')};
 if(p[0]==='selection')return {key:'selection',title:'Active appearance',category:'Selection',label:pretty(p[1])};
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
function busyControls(){const hint=$('#cloud-save-hint');if(hint)hint.textContent=dirty()?'Save your open edits to include them in this list.':!canSubmit()&&versions.some(v=>Number(v.revision)===Number(currentDraft?.revision))?returnedVersion()?'Returned by Admin. Make your corrections and save before sending again.':'':'';const submit=$('#cloud-submit');if(submit){submit.disabled=busy||!canSubmit();submit.title=dirty()?'Save your open edits first':canSubmit()?'Send saved changes to Admin':'No new saved changes to send'}for(const b of dialog.querySelectorAll('button:not([data-close]):not(#cloud-submit)'))b.disabled=busy;const ownDiscard=$('#cloud-discard-unsent');if(ownDiscard)ownDiscard.disabled=busy||(!dirty()&&!newChanges().some(g=>g.rows.length));const discard=$('#cloud-discard');if(discard)discard.disabled=busy||!canDiscard();renderProgress()}
async function run(fn){if(busy)return;busy=true;busyControls();try{await fn()}catch(e){message(e.message);notify(e.message)}finally{busy=false;busyControls();renderProgress()}}
async function refresh(){
 const request=++refreshId,id=game();if(!client||ComposerAuth.local)return;
 if(id==='kit'){currentDraft=null;versions=[];published=null;basePayload={};loadError='';render();return}
 const auth=check(await client.auth.getSession());session=auth.session;
 member=session?check(await client.from('composer_members').select('role,active').eq('user_id',session.user.id).maybeSingle()):null;
 if(session&&member?.active){
  const [v,n,d,p,a]=await Promise.all([client.from('composer_versions').select('*').eq('game_id',id).order('submitted_at',{ascending:false}).limit(20),client.from('composer_notifications').select('id,kind,version_id,read_at,created_at').order('created_at',{ascending:false}).limit(30),draft(id),client.from('composer_versions').select('*').eq('game_id',id).eq('status','published').order('revision',{ascending:false}).limit(1),ComposerAuth.member?.role==='admin'?Promise.resolve(client.rpc('composer_list_members')).catch(()=>({data:[]})):Promise.resolve({data:[]})]);
  const baseline=await window.ComposerDraftEditors.baseline(d.payload,id);
  if(request!==refreshId||id!==game())return;
  authors=new Map((a.error?[]:a.data||[]).map(person=>[person.user_id,person.email]));versions=check(v);notices=check(n);currentDraft=d;published=check(p)[0]||null;basePayload=baseline;loadError='';
 }else{versions=[];notices=[];currentDraft=null}
 render();
}
function jsonView(payload,title='JSON of this version'){return '<details class="review-json"><summary>'+esc(title)+'</summary><pre tabindex="0">'+esc(JSON.stringify(payload,null,2))+'</pre></details>'}
const localRelease=()=>!window.ComposerHosting&&['127.0.0.1','localhost'].includes(location.hostname);
function releaseActions(v){
 const can=ComposerAuth.member?.role==='admin'&&ComposerAuth.has('releases.publish',game());
 return (can&&localRelease()?'<button class="wb-button primary" data-apply="'+esc(v.id)+'">Apply locally</button>':'')+(v.status==='submitted'?' <button class="wb-button" data-review="'+esc(v.id)+'" data-approve="false">Return for changes</button>':'');
}
function reviewStatus(status,count){const accepted=status==='approved';return '<span class="review-status '+(accepted?'accepted':'awaiting')+'"'+(accepted?' title="Accepted by Admin; not published yet"':'')+'>'+(accepted?'Accepted':'Awaiting review')+(count?' · '+count:'')+'</span>'}
function reviewVersions(){
 const groups=[['submitted','Needs review','Apply locally accepts this version. Return for changes sends it back to the editor.'],['approved','Accepted · not published','Already accepted. Apply locally if needed, then commit and push to publish.']];
 return groups.map(([status,title,hint])=>{const items=sentVersions().filter(v=>v.status===status);return items.length?'<section class="review-queue" data-review-status="'+status+'"><h3>'+title+' <span class="review-count">'+items.length+'</span></h3><p class="review-intro">'+hint+'</p><div class="cloud-list">'+items.map(v=>'<article><strong>'+esc(v.summary)+'</strong>'+authorLine('Sent by',v.submitted_by,v.submitted_at)+diffHTML(v.payload,{...basePayload,...published?.payload})+jsonView({schema_version:1,game_id:v.game_id,version_id:v.id,revision:v.revision,payload:v.payload})+'<div class="share-actions">'+releaseActions(v)+'</div>'+'</article>').join('')+'</div></section>':''}).join('')+(published?'<p class="review-published">Published: revision '+esc(published.revision)+' — already live.</p>':'');
}

function render(){
 renderProgress();if(!isReviewer()&&!ComposerAuth.has('drafts.submit',game())){if(dialog.open)dialog.close();return}
 const collapsed=new Set([...dialog.querySelectorAll('[data-review-group]:not([open])')].map(el=>el.dataset.reviewGroup));
 const sentExpanded=dialog.querySelector('.review-sent')?.open;
 const sent=sentVersions(),newCount=newChanges().reduce((sum,g)=>sum+g.rows.length,0);
 const pending=versions.filter(v=>['submitted','approved'].includes(v.status));
 dialog.innerHTML='<header><div><small>'+esc(ComposerTarget.entry().title)+'</small><h2 id="cloud-title">Changes</h2></div><button class="wb-button" data-close aria-label="Close">✕</button></header><button class="wb-button" id="cloud-refresh">Refresh</button>'+
 (ComposerAuth.member?.role==='admin'?' <button class="wb-button discard-changes" id="cloud-discard">Discard all changes</button>':'')+
 (ComposerAuth.member?.role==='admin'&&ComposerAuth.has('releases.publish',game())&&!localRelease()?'<aside class="review-local-note" aria-label="Publishing changes"><strong>Publish from local Composer</strong><p>You can review changes here. To publish them, open local Composer and sign in with the same Admin account. In Changes, find the sent version and click <b>Apply locally</b>, then commit and push the configuration file. GitHub will update Composer web and Showcase automatically.</p></aside>':'')+
 (isReviewer()&&draftChanges().some(g=>g.rows.length)?authorLine('Last saved by',currentDraft?.updated_by,currentDraft?.updated_at)+(!pending.length?'<p class="review-intro">These are draft changes, not a sent version. The editor needs to click <b>Send changes</b> before you can apply them locally.</p>':''):'')+
 (isReviewer()?reviewVersions():'')+
 (!isReviewer()?'<p class="review-intro">Review your saved changes, then send them to Admin. This game draft is shared with your team.</p>':'')+
 '<div id="draft-changes">'+(isReviewer()?'<h3>Current draft</h3><p class="review-intro">Saved working changes compared with the published game. Review sent versions above to accept them.</p>'+diffHTML(currentDraft?.payload,{...basePayload,...published?.payload}):
 (newCount?'<h3 class="review-new-title">'+(returnedVersion()?'Returned for changes':'New changes')+' <span class="review-count">'+newCount+'</span></h3>'+diffHTML({...basePayload,...currentDraft?.payload},editingBaseline()):'<div class="review-empty"><strong>'+(sent.length?'All changes sent':'No new changes')+'</strong><p>'+(sent.length?'Your changes are with Admin. You can keep editing; only new edits will appear here.':'Saved edits will appear here when you change texts, design or sounds.')+'</p></div>'))+'</div>'+

 (!isReviewer()?'<div class="review-send"><p id="cloud-save-hint"></p><button class="wb-button discard-changes" id="cloud-discard-unsent">Discard unsent changes</button><button class="wb-button primary" id="cloud-submit"'+(!newCount?' hidden':'')+'>Send changes</button></div>'+ (sent.length?'<details class="review-sent"><summary><span>Sent to Admin</span><span class="review-count">'+sent.length+'</span>'+['submitted','approved'].map(status=>{const count=sent.filter(v=>v.status===status).length;return count?reviewStatus(status,count):''}).join('')+'</summary><p>Already sent. These changes are not included in your red counter.</p>'+sent.map(v=>'<details class="review-sent-version"><summary>'+esc(new Date(v.submitted_at).toLocaleString())+' '+reviewStatus(v.status)+'</summary>'+diffHTML(v.payload,{...basePayload,...published?.payload})+jsonView(v.payload)+'</details>').join('')+'</details>':''):'')+
 '<p role="status" aria-live="polite"></p>';
 if(sentExpanded&&dialog.querySelector('.review-sent'))dialog.querySelector('.review-sent').open=true;
 for(const group of dialog.querySelectorAll('[data-review-group]'))if(collapsed.has(group.dataset.reviewGroup))group.open=false;
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();$('#cloud-refresh').onclick=()=>run(refresh);
 $('#cloud-discard')?.addEventListener('click',()=>{if(!canDiscard()||busy)return;const id=game(),revision=currentDraft.revision;if(!confirm('Discard all unpublished changes for '+ComposerTarget.entry().title+'? This includes shared draft edits, open edits in this window, and sent or approved versions. The published game stays unchanged.'))return;run(async()=>{await rpc('composer_discard_changes',{p_game:id,p_revision:revision});location.reload()})});
 for(const b of dialog.querySelectorAll('[data-review]'))b.onclick=()=>run(async()=>{const approve=b.dataset.approve==='true';await rpc('composer_review',{p_version:b.dataset.review,p_approve:approve,p_note:''});await refresh();message(approve?'Approved.':'Returned.');notify(approve?'Changes approved':'Changes returned')});
 $('#cloud-discard-unsent')?.addEventListener('click',()=>{
  if(busy)return;
  if(!confirm('Discard your unsent edits for '+ComposerTarget.entry().title+'? Your tracked edits and unsaved edits in this window will be reset. Sent versions and other people’s changes will stay. Older edits without authorship history will be preserved.'))return;
  run(async()=>{if(!newChanges().some(g=>g.rows.length)&&dirty()){location.reload();return}await rpc('composer_discard_unsent',{p_game:game(),p_revision:currentDraft.revision});location.reload()});
 });
 for(const b of dialog.querySelectorAll('[data-apply]'))b.onclick=()=>{
  if(!confirm('Apply this sent version to the local game configuration? Review the file, then commit and push to publish.'))return;
  run(async()=>{const auth=check(await client.auth.getSession());const response=await fetch('release/apply',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.session.access_token},body:JSON.stringify({version_id:b.dataset.apply})});const data=await response.json();if(!response.ok)throw Error(data.message||'Could not apply configuration');await refresh();message('Applied locally: '+data.path+'. Review, commit and push to publish.');notify('Configuration ready to commit')});
 };
 $('#cloud-submit')?.addEventListener('click',sendChanges);
 busyControls();
}
function open(){render();if(!dialog.open)dialog.showModal();run(refresh)}
button.onclick=open;
function sendChanges(){
 run(async()=>{
  if(!canSubmit())throw Error('Save your changes first.');
  const id=game(),revision=currentDraft.revision;
  const sections=newChanges().filter(g=>g.rows.length).map(g=>sectionNames[g.section]).join(', ');
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
setInterval(()=>{if((isReviewer()||ComposerAuth.has('drafts.submit',game()))&&!busy&&!dialog.contains(document.activeElement))schedule()},15000);
if(cloudMode)run(async()=>{try{await refresh();window.dispatchEvent(new Event('composer-storage'))}catch(e){loadError=e.message;renderProgress();throw e}});
if(ComposerAuth.local)window.dispatchEvent(new Event('composer-storage'));
