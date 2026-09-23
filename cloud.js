const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await window.ComposerAuth.ready;
const client=window.ComposerAuth.client;
const button=$('#cloud-configurations'),dialog=document.createElement('dialog');dialog.className='share-dialog cloud-dialog';dialog.setAttribute('aria-labelledby','cloud-title');document.body.append(dialog);
let cloudMode=!window.ComposerAuth.local,member=null,session=null,versions=[],notices=[],busy=false,refreshId=0;
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
   saved=await rpc('composer_save_draft',{p_game:id,p_revision:saved.revision,p_payload:{translations}});
  }
  return {catalog:base.catalog,overrides:saved.payload.translations||{},revision:'cloud:'+saved.revision};
 }
};
function canSwitch(){return !document.querySelector('#translates-tab.workspace-dirty')}

function message(text){const status=dialog.querySelector('[role=status]');if(status)status.textContent=text}
async function run(fn){if(busy)return;busy=true;try{await fn()}catch(e){message(e.message)}finally{busy=false}}
async function refresh(){
 const request=++refreshId;if(!client||window.ComposerAuth.local)return;
 const auth=check(await client.auth.getSession());session=auth.session;
 member=session?check(await client.from('composer_members').select('role,active').eq('user_id',session.user.id).maybeSingle()):null;
 if(session&&member?.active){
  const [v,n]=await Promise.all([client.from('composer_versions').select('*').eq('game_id',game()).order('submitted_at',{ascending:false}).limit(20),client.from('composer_notifications').select('id,kind,version_id,read_at,created_at').order('created_at',{ascending:false}).limit(30)]);
  if(request!==refreshId)return;versions=check(v);notices=check(n);
 }else{versions=[];notices=[]}
 render();
}
function render(){
 const admin=window.ComposerAuth.has('drafts.review',game());
 dialog.innerHTML='<header><div><small>CONFIGURATIONS</small><h2 id="cloud-title">Cloud drafts</h2></div><button class="wb-button" data-close aria-label="Close">✕</button></header><p>Translations · '+esc(window.ComposerTarget.entry().title)+'</p><p class="share-note">Drafts stay private. Submitting for review does not publish the iframe.</p>'+
 (window.ComposerAuth.local?'<p>You are in the local development workspace. Cloud drafts are available when you sign in on the entry screen.</p>':!session||!member?.active?'<p>Workspace access is unavailable. Sign out using the account menu and sign in again.</p>':
 '<p>'+esc(session.user.email)+' · '+esc(window.ComposerAuth.member?.role_name||member.role)+'</p><div class="share-actions"><button class="wb-button" id="cloud-refresh">Refresh</button></div><form id="cloud-submit"><label>Review summary<textarea name="summary" rows="2" maxlength="2000" required></textarea></label><button class="wb-button">Submit saved draft for review</button></form>'+
 '<h3>Notifications · '+notices.filter(n=>!n.read_at).length+' unread</h3><div class="cloud-list">'+notices.slice(0,6).map(n=>'<p>'+esc(n.kind)+' · '+esc(new Date(n.created_at).toLocaleString())+(!n.read_at?' <button class="wb-button" data-read="'+n.id+'">Mark read</button>':'')+'</p>').join('')+'</div>'+
 '<h3>Versions</h3><div class="cloud-list">'+versions.map(v=>'<article><strong>'+esc(v.summary)+'</strong><p>Revision '+v.revision+' · '+esc(v.status)+'</p><button class="wb-button" data-view="'+v.id+'">Review changes</button>'+(admin&&v.status==='submitted'?' <button class="wb-button" data-review="'+v.id+'" data-approve="true">Approve</button> <button class="wb-button" data-review="'+v.id+'" data-approve="false">Return</button>':'')+'</article>').join('')+'</div><div id="cloud-diff"></div>'+
 '' )+'<p role="status" aria-live="polite"></p>';
 if(!window.ComposerAuth.has('drafts.submit',game()))dialog.querySelector('#cloud-submit')?.remove();
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 if($('#cloud-refresh'))$('#cloud-refresh').onclick=()=>run(refresh);
 $('#cloud-submit')?.addEventListener('submit',e=>{e.preventDefault();const summary=new FormData(e.target).get('summary');run(async()=>{if(!window.ComposerAuth.has('drafts.submit',game()))throw Error('Submit access denied');if(!canSwitch())throw Error('Save or cancel open edits before submitting');const d=await draft(game());await rpc('composer_submit',{p_game:game(),p_revision:d.revision,p_summary:summary});await refresh();message('Submitted. Administrators have been notified.')})});
 for(const b of dialog.querySelectorAll('[data-read]'))b.onclick=()=>run(async()=>{await rpc('composer_mark_read',{p_id:b.dataset.read});await refresh()});
 for(const b of dialog.querySelectorAll('[data-review]'))b.onclick=()=>run(async()=>{await rpc('composer_review',{p_version:b.dataset.review,p_approve:b.dataset.approve==='true',p_note:''});await refresh()});
 for(const b of dialog.querySelectorAll('[data-view]'))b.onclick=()=>run(async()=>{const v=versions.find(v=>v.id===b.dataset.view);const baseline=check(await client.from('composer_versions').select('payload').eq('game_id',v.game_id).eq('status','published').lt('revision',v.revision).order('revision',{ascending:false}).limit(1));const previous=baseline[0]?.payload.translations||{},next=v.payload.translations||{};const keys=[...new Set([...Object.keys(previous),...Object.keys(next)])].filter(k=>JSON.stringify(previous[k])!==JSON.stringify(next[k]));$('#cloud-diff').innerHTML='<h3>Changes from last published version</h3>'+keys.map(k=>'<article><strong>'+esc(k)+'</strong><pre>'+esc(JSON.stringify(previous[k]||{},null,2))+'</pre><pre>'+esc(JSON.stringify(next[k]||{},null,2))+'</pre></article>').join('')});
}
button.onclick=()=>{render();dialog.showModal();run(refresh)};
window.addEventListener('composer-target',()=>{if(dialog.open)run(refresh)});
setInterval(()=>{if(dialog.open&&!busy&&session&&!dialog.contains(document.activeElement))run(refresh)},30000);

if(cloudMode){button.textContent='Cloud drafts';run(async()=>{await refresh();window.dispatchEvent(new Event('composer-storage'))})}

if(window.ComposerAuth.local)window.dispatchEvent(new Event("composer-storage"));
