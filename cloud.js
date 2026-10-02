const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await window.ComposerAuth.ready;
const client=window.ComposerAuth.client;
const button=$('#cloud-configurations'),dialog=document.createElement('dialog');dialog.className='share-dialog cloud-dialog';dialog.setAttribute('aria-labelledby','cloud-title');document.body.append(dialog);
// The published history drops down; a click anywhere else in Changes folds it back.
dialog.addEventListener('click',e=>{const h=dialog.querySelector('.changes-history[open]');if(h&&!h.contains(e.target))h.open=false});
dialog.addEventListener('click',e=>{const t=e.target.closest('.review-json-toggle');if(!t)return;const pre=t.closest('.review-version')?.querySelector('.review-json-pre');if(!pre)return;pre.hidden=!pre.hidden;t.setAttribute('aria-expanded',String(!pre.hidden))});
// An added sound plays from its small button; a second press stops it.
let reviewSound=null;
dialog.addEventListener('click',e=>{const b=e.target.closest('.review-play');if(!b)return;const same=reviewSound?.src===b.dataset.play&&!reviewSound.paused;reviewSound?.pause();dialog.querySelectorAll('.review-play').forEach(x=>x.innerHTML=icon('play'));if(same)return;reviewSound=new Audio(b.dataset.play);b.innerHTML=icon('stop');reviewSound.onended=()=>{b.innerHTML=icon('play')};reviewSound.play().catch(()=>{b.innerHTML=icon('play')})});
dialog.addEventListener('close',()=>{reviewSound?.pause()});
let cloudMode=!window.ComposerAuth.local,member=null,session=null,versions=[],notices=[],busy=false,refreshId=0,currentDraft=null,published=null,basePayload={},loadError='';
// Changes has two scopes, each with its own draft, sent versions and release: the selected
// game's own changes, and the brands every game shares ("shared", once the cloud has it).
const SHARED='shared';let scope='game',sharedThere=false,sharedExists=false,sharedState=null;
// An Admin opens Changes on every game with something waiting (view 'all') and steps into one
// without switching the stage: that game is "inspected" while the dialog shows it.
let view='game',inspected='';
const game=()=>scope===SHARED?SHARED:(inspected||window.ComposerTarget.value);
const titleOf=id=>id===SHARED?'Brands · all games':(window.ComposerTarget.targets||[]).find(t=>t.id===id)?.title||ComposerTarget.entry().title;
const scopeTitle=()=>titleOf(game());
const check=result=>{if(result.error)throw Error(result.error.message);return result.data};
async function rpc(name,args){return check(await client.rpc(name,args))}
async function draft(id){const value=check(await client.from('composer_drafts').select('*').eq('game_id',id).single());return value}
function clean(values,source){
 if(!values||typeof values!=='object'||Object.keys(values).some(k=>!['en','fr','ht'].includes(k)))throw Error('Invalid languages');
 for(const value of Object.values(values)){if(typeof value!=='string'||value.length>8000||/[<>]/.test(value))throw Error('Use plain text or Markdown, without HTML');if(value&&(value.match(/\{\w+\}/g)||[]).sort().join()!==(source.match(/\{\w+\}/g)||[]).sort().join())throw Error('Keep source variables unchanged')}
}
window.ComposerCloud={
 get enabled(){return cloudMode},
 // How far the picked game's draft is from the sites: saved changes not published, and versions sent.
 draftStanding(){return {changes:draftChanges().reduce((sum,g)=>sum+g.rows.length,0),sent:sentVersions().length,published:published?{revision:published.revision}:null}},
 async translations(id,options){
  await window.ComposerAuth.ready;
  if(!client||!window.ComposerAuth.session)throw Error('Sign in to Cloud to access the draft.');
  if(id==='kit')throw Error('Cloud drafts are per game. Select a game.');
  // The shared scope's texts are every game's: read with the kit's catalog, laid under a game's own.
  const response=await fetch('translations?game='+encodeURIComponent(id===SHARED?'kit':id),{cache:'no-store'});if(!response.ok)throw Error('Local translation schema is unavailable');const base=await response.json();
  let saved=await draft(id);
  const sharedDraft=id!==SHARED&&await sharedTextsOffered()?await draft(SHARED).catch(()=>null):null;
  if(options?.method==='POST'){
   if(!window.ComposerAuth.canEdit(id))throw Error('You have read-only access to this game.');
   const body=JSON.parse(options.body);if(body.revision!=='cloud:'+saved.revision)throw Error('Cloud draft changed. Reload before saving.');
   const translations={...body.overrides};for(const [key,values] of Object.entries(body.entries||{}))translations[key]={...translations[key],...values};
   for(const [key,values] of Object.entries(translations)){if(!base.catalog.entries[key])throw Error('Unknown translation key: '+key);clean(values,base.catalog.entries[key].source)}
   window.ComposerUX?.status('saving');
   try{saved=await rpc('composer_save_draft',{p_game:id,p_revision:saved.revision,p_payload:{...saved.payload,translations}});}catch(error){window.ComposerUX?.status('error',error.message);throw error}
   window.dispatchEvent(new CustomEvent('composer-draft-saved',{detail:{game:id,section:'translations',revision:saved.revision}}));
  }
  return {catalog:base.catalog,overrides:saved.payload.translations||{},revision:'cloud:'+saved.revision,shared:sharedDraft?.payload.translations||{},sharedRevision:sharedDraft?'cloud:'+sharedDraft.revision:null};
 },
 // Whether a text can be saved for every game: the shared scope exists and this person may edit its texts.
 sharedTexts(){return sharedThere&&ComposerAuth.has('translations.edit',SHARED)}
};
async function sharedTextsOffered(){return !!(await window.ComposerDraftEditors?.shared?.().catch(()=>false))&&ComposerAuth.has('workspace.view',SHARED)}
function canSwitch(){return !document.querySelector('.workspace-dirty')&&!window.ComposerLook?.dirty}

const sectionNames={translations:'Translations',design:'Design',audio:'Sounds'};
const feedback=document.createElement('span');feedback.id='changes-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');button.after(feedback);
const isReviewer=()=>ComposerAuth.member?.role!=='art_director'&&ComposerAuth.has('drafts.review',game());
let feedbackTimer;
let localConfig=null,releases=[],gameTabFlag='',sharedBrands=null,owners=null;
let authors=new Map(),contributors=[],contributorsError=false;
// Only an Admin may list people; to anyone else a teammate is "a teammate", and you are you.
// The face a person wears in Composer's header (session.js): one of the games' player faces,
// picked by a hash of their account id, so each card shows the same face as their own header.
function avatarHTML(id,name){
 const letter=esc(String(name||'?').trim().charAt(0).toUpperCase());
 if(!id||id==='team'||id==='untracked')return '<span class="review-avatar" aria-hidden="true">'+letter+'</span>';
 let h=2166136261;for(const c of String(id))h=Math.imul(h^c.codePointAt(0),16777619);
 return '<span class="review-avatar has-face" aria-hidden="true" style="background-image:url(avatar-'+String(1+(h>>>0)%11).padStart(2,'0')+'.png)"></span>';
}
function authorName(id,fallback='a teammate'){return authors.get(id)||(id===session?.user?.id?(session.user.user_metadata?.full_name||session.user.email):null)||fallback}
function authorLine(label,id,time){return '<p class="review-author">'+esc(label)+' <strong>'+esc(authorName(id))+'</strong>'+(time?' <span>· '+esc(new Date(time).toLocaleString())+'</span>':'')+'</p>'}
function notify(text){feedback.textContent=text;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>feedback.textContent='',7000)}
try{const carried=sessionStorage.getItem('composer-toast');if(carried){sessionStorage.removeItem('composer-toast');notify(carried)}}catch{}
const dirty=()=>!canSwitch();
function flat(value,path='',out={}){
 if(value&&typeof value==='object'){
  if(Array.isArray(value)){value.forEach((v,i)=>flat(v,path+'/'+(v?.id||String(i+1)),out))}
  else for(const [k,v] of Object.entries(value))flat(v,path+'/'+k,out);
 }else out[path]=value;
 return out;
}
// What a release takes from a game's design once brands are shared: only the seasons and faces
// that differ from the shared ones (review_assets.design_catalog). Older configurations carry
// whole copies of every brand; compared as they are, they listed a hundred changes nobody made.
const ownPart=design=>sharedBrands&&window.ComposerDraftEditors?.ownDesign?window.ComposerDraftEditors.ownDesign(design,{brands:sharedBrands}):design;
function changes(payload,baseline,own=scope==='game'){
 return Object.keys(sectionNames).map(section=>{
  // Missing sections mean no overrides, not deletion of the shipped library.
  if(!payload?.[section])return {section,rows:[]};
  const game=own&&section==='design';
  const before=flat((game?ownPart(baseline?.[section]):baseline?.[section])||{}),after=flat((game?ownPart(payload[section]):payload[section])||{});
  return {section,rows:[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>!(section==='design'&&(k==='/selection'||k.startsWith('/selection/')))&&before[k]!==after[k]).map(path=>({path,before:before[path],after:after[path]}))};
 });
}
// Payloads laid one over another. Texts merge text by text and language by language: a version
// lists only the texts it changed, so laid whole it hid the catalog's words for every other
// text, and a French edit read as English and Creole going from "Not set" too.
function layer(...payloads){
 const out={};
 for(const p of payloads)for(const [section,value] of Object.entries(p||{})){
  if(section==='translations'&&out.translations&&value&&typeof value==='object'){const t={...out.translations};for(const [key,langs] of Object.entries(value))t[key]={...t[key],...langs};out.translations=t}
  else out[section]=value;
 }
 return out;
}
function draftChanges(){return changes(currentDraft?.payload,layer(basePayload,published?.payload))}
function sentVersions(){return versions.filter(v=>['submitted','approved'].includes(v.status)&&Number(v.revision)>Number(published?.revision||0)).sort((a,b)=>Number(b.revision)-Number(a.revision))}
// What this person sent: someone who only sends hears about their own versions, not a teammate's.
function mySent(){return isReviewer()?sentVersions():sentVersions().filter(v=>v.submitted_by===session?.user?.id)}
function editingBaseline(){return layer(basePayload,published?.payload,sentVersions()[0]?.payload)}
function newChanges(){return changes(layer(basePayload,currentDraft?.payload),editingBaseline())}
// Whose each unsent change is, from the draft's edit journal (composer_draft_edits): the last
// edit to touch a setting owns it. Without the journal (an older database) everything counts as
// the caller's, as before.
function attribute(edits,own=scope==='game'){
 const map=new Map();
 for(const e of edits||[])for(const section of Object.keys(sectionNames)){
  const design=section==='design'&&own,before=flat((design?ownPart(e.before?.[section]):e.before?.[section])||{}),after=flat((design?ownPart(e.after?.[section]):e.after?.[section])||{});
  for(const path of new Set([...Object.keys(before),...Object.keys(after)]))if(before[path]!==after[path])map.set(section+':'+path,{mine:!!e.mine,admin:!!e.by_admin,tracked:!!e.tracked,actor:e.actor||null});
 }
 return map;
}
const ownerOf=(section,path)=>owners?owners.get(section+':'+path)||{mine:false,admin:false,tracked:false}:{mine:true};
const splitChanges=mine=>newChanges().map(g=>({...g,rows:g.rows.filter(r=>!!ownerOf(g.section,r.path).mine===mine)}));
function myChanges(){return splitChanges(true)}
function othersWho(groups){const kinds=new Set(groups.flatMap(g=>g.rows.map(r=>{const o=ownerOf(g.section,r.path);return o.admin?'an Admin':o.tracked?'a teammate':'someone before edits were tracked'})));return 'Saved by '+[...kinds].join(', ')+'.'}
function othersChanges(){return splitChanges(false)}
function returnedVersion(){return versions.find(v=>v.status==='rejected'&&Number(v.revision)===Number(currentDraft?.revision))}
// Where the picked game's draft stands: how far it is from the sites, and the one thing to do
// next. The Changes button says it in its tooltip; the dialog opens on it.
function publishedLine(){
 if(!published)return 'not published yet';
 const at=releases.find(r=>r.version_id===published.id)?.published_at;
 return 'published rev '+published.revision+(at?' · '+new Date(at).toLocaleDateString(undefined,{day:'numeric',month:'short'}):'');
}
function standing(){
 const id=game(),review=isReviewer();
 if(id==='kit'||(!review&&!ComposerAuth.has('drafts.submit',id))||!currentDraft&&!loadError)return null;
 const sent=mySent(),awaiting=sent.filter(v=>v.status==='submitted').length,accepted=sent.filter(v=>v.status==='approved').length;
 const newCount=myChanges().reduce((sum,g)=>sum+g.rows.length,0),savedCount=draftChanges().reduce((sum,g)=>sum+g.rows.length,0);
 const flag=releaseFlag();
 let tone='idle',text='',action=null;
 if(loadError){tone='saved';text='Cloud draft unavailable · '+loadError}
 else if(review){
  if(flag?.label==='Not applied'){tone='release';text='An accepted version is not applied on this computer';action={label:'Apply locally',run:async()=>{const one=versions.filter(v=>v.status==='approved'&&v.id!==localConfig?.version_id);if(one.length===1){if(await ask('Apply accepted revision '+one[0].revision+' to the local game configuration? Review the file, then commit and push to publish.'))run(()=>applyVersion(one[0].id,id))}else open()}}}
  else if(flag?.label==='Not committed'){tone='release';text=localConfig.path+' applied, not committed';action={label:'Copy publish commands',run:copyPublish}}
  else if(flag?.label==='Not pushed'){tone='release';text=localConfig.path+' committed, not pushed · push from the repository to publish'}
  else if(awaiting){tone='awaiting';text=awaiting+' sent '+(awaiting===1?'version':'versions')+' to review'}
  else if(accepted&&!localRelease()){tone='release';text=accepted+' accepted · publish from local Composer'}
  else if(savedCount){tone='saved';text=savedCount+' saved '+(savedCount===1?'change':'changes')+' not published'}
  else text='Nothing waiting';
 }else{
  const returned=returnedVersion();
  if(dirty()){tone='saved';text='Unsaved edits · save them to send'}
  else if(newCount){tone='saved';text=newCount+' saved '+(newCount===1?'change':'changes')+' not sent'+(returned?' · returned by Admin, corrected':'');action={label:'Send changes',run:async()=>{if(!canSubmit())return;if(await ask('Send '+newCount+' saved '+(newCount===1?'change':'changes')+' of '+scopeTitle()+' to Admin?'))sendChanges()}}}
  else if(awaiting){tone='awaiting';text=awaiting+' sent · awaiting Admin'}
  else if(accepted){tone='awaiting';text=accepted+' accepted · being published'}
  else text='Nothing unsent';
 }
 return {tone,text,action};
}
// Each scope tab says where its own changes stand, the game's as the shared one's: the
// standing's first words ("131 saved changes not published", "Not committed").
function gameFlag(){
 if(scope===SHARED)return gameTabFlag;
 const s=standing();gameTabFlag=!s||s.tone==='idle'?'':s.text.split(' · ')[0];return gameTabFlag;
}
// A tab's badge: the number when the state is a count, the words otherwise; all of it on hover.
// One colour per state wherever it shows (button dot, hover card, tabs, version pills):
// grey saved, blue with Admin, green accepted, amber something to do on this computer.
const toneOf=label=>/^Not (applied|committed|pushed)|publish/i.test(label||'')?'release':/review|awaiting|sent ·/i.test(label||'')?'awaiting':/accepted/i.test(label||'')?'accepted':'saved';
const tabFlag=(label,tone=toneOf(label))=>label?' <span class="changes-flag tone-'+tone+'" title="'+esc(label)+'">'+esc(/^\d+ /.test(label)?label.split(' ')[0]:label)+'</span>':'';
// The first line of the dialog: the standing, when it was last published, and the next step.
// One quiet line under the tabs: what is live, and who saved last. The tab already says how many
// changes wait, so the standing is not repeated here.
function standingHTML(){
 if(!standing()&&!currentDraft)return '';
 const savedBy=currentDraft?.updated_by&&currentDraft.updated_by===session?.user?.id?'you':authorName(currentDraft?.updated_by,''),saved=currentDraft?.updated_at&&draftChanges().some(g=>g.rows.length)?'last saved'+(savedBy?' by '+esc(savedBy):'')+', '+esc(new Date(currentDraft.updated_at).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})):'';
 const p=publishedLine(),label=esc(p.charAt(0).toUpperCase()+p.slice(1));
 // What was published before opens from the line that says what is published now.
 return '<div class="changes-meta">'+(publishedItems().length?'<details class="changes-history"><summary>'+label+'</summary>'+publicationHistory()+'</details>':'<span>'+label+'</span>')+(saved?'<span>'+saved+'</span>':'')+'</div>';
}
const card=document.createElement('div');card.id='changes-card';card.setAttribute('role','tooltip');card.hidden=true;document.body.append(card);
let cardTimer=0;
// The hover card lists every game with something waiting, as the tabs in Changes do: its icon,
// its name, what waits there. A row opens Changes on that game.
function paintCard(){
 const unread=unreadNotices().length,icon=id=>id===SHARED?'<span class="changes-tab-icon" aria-hidden="true">'+(typeof window.icon==='function'?window.icon('brands'):'')+'</span>':'<img class="changes-tab-icon" src="icons/'+esc(id)+'.png" alt="" width="20" height="20">';
 const rows=inbox?inbox.slice().sort((a,b)=>(b.id===ComposerTarget.value)-(a.id===ComposerTarget.value)):(()=>{const st=standing();return st&&st.tone!=='idle'?[{id:ComposerTarget.value,title:ComposerTarget.entry().title,flags:[[st.tone,st.text]]}]:[]})();
 card.innerHTML=(rows.length?'<ul class="changes-card-games">'+rows.map(r=>'<li><button type="button" data-card-game="'+esc(r.id)+'">'+icon(r.id)+'<span><strong>'+esc(r.title)+'</strong><small>'+r.flags.map(([tone,label])=>'<span class="changes-card-flag"><i class="changes-dot '+tone+'" aria-hidden="true"></i>'+esc(label)+'</span>').join('')+'</small></span></button></li>').join('')+'</ul>':'<p class="changes-card-note">Nothing waiting in any game.</p>')
  +(unread?'<p class="changes-card-note">'+unread+(unread===1?' update':' updates')+' since you last opened Changes</p>':'')
  +'<div class="changes-card-actions"><button type="button" class="wb-button" data-card-open>Open Changes</button></div>';
 card.querySelectorAll('[data-card-game]').forEach(b=>b.onclick=()=>{const id=b.dataset.cardGame;hideCard(0);open();if(id===SHARED){inspected='';setScope(SHARED)}else{setScope('game');inspected=id===ComposerTarget.value?'':id}render();run(refresh)});
 card.querySelector('[data-card-open]').onclick=()=>{hideCard(0);open()};
}
function showCard(){clearTimeout(cardTimer);cardTimer=setTimeout(()=>{if(button.hidden||dialog.open)return;paintCard();card.hidden=false;const r=button.getBoundingClientRect();card.style.top=(r.bottom+6)+'px';card.style.left=Math.max(8,Math.min(r.right-card.offsetWidth,innerWidth-card.offsetWidth-8))+'px'},250)}
function hideCard(delay=150){clearTimeout(cardTimer);cardTimer=setTimeout(()=>{card.hidden=true},delay)}
for(const el of [button,card]){el.addEventListener('mouseenter',showCard);el.addEventListener('mouseleave',()=>hideCard())}
button.addEventListener('focus',showCard);button.addEventListener('blur',()=>{if(!card.contains(document.activeElement))hideCard()});
card.addEventListener('focusout',e=>{if(!card.contains(e.relatedTarget)&&e.relatedTarget!==button)hideCard()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!card.hidden)hideCard(0)});
async function copyPublish(){const path=localConfig?.path;if(!/^configurations\/[a-z][a-z0-9_]*\.json$/.test(path))return;
 // Sounds a version added sit in configurations/media/<game> and are committed with it.
 const media=/^configurations\/media\/[a-z][a-z0-9_]*$/.test(localConfig?.media||'')?' '+localConfig.media:'',paths=path+media;
 try{await navigator.clipboard.writeText('git add -- '+paths+'\ngit diff --cached -- '+paths+'\ngit commit --only '+paths+' -m "Publish reviewed game configuration"\ngit push origin main');notify('Publish commands copied. Run them from the Composer repository.')}catch{notify('Could not copy. Commit and push '+path+' from the Composer repository.')}}
function stateList(){
 const review=isReviewer(),awaiting=review?0:mySent().filter(v=>v.status==='submitted').length;
 const count=review?versions.filter(v=>v.status==='submitted').length+(canSubmit()?1:0):myChanges().reduce((sum,g)=>sum+g.rows.length,0);
 const flag=releaseFlag(),list=[];
 if(flag)list.push(['release',flag.label+': '+flag.title]);
 if(scope==='game'&&sharedState)list.push(['shared','Brands · all games: '+sharedState.label]);
 if(awaiting)list.push(['awaiting',awaiting+' awaiting review']);
 if(count)list.push(['saved',count+(review?' to review':' saved '+(count===1?'change':'changes')+', not sent')]);
 const unread=unreadNotices().length;if(unread)list.push(['notice',unread+(unread===1?' update':' updates')]);
 return list;
}
const states=()=>stateList();
function renderProgress(){
 const review=isReviewer(),pending=versions.filter(v=>v.status==='submitted').length;
 const awaiting=review?0:mySent().filter(v=>v.status==='submitted').length;
 const unsent=canSubmit()?1:0;
 const own=review?pending+unsent:myChanges().reduce((sum,g)=>sum+g.rows.length,0),shared=scope==='game'?sharedState?.count||0:0,count=own+shared;
 const states=stateList();
 // The dot is the first thing waiting, and its number is how many of that: saved changes, versions
 // with Admin, updates. A step to take on this computer has no number.
 let lead=states[0],n=lead?(lead[0]==='release'?0:+(lead[1].match(/\d+/)?.[0]||0)):count;
 // Once every game's state is known, the dot counts all of them, as the tabs in Changes do.
 if(inbox){// The same order as each tab's flags: an Admin's next steps first; for someone who sends,
  // their unsent changes, then what they sent.
  const order=isAdmin()?['release','accepted','awaiting','saved']:['saved','awaiting'],all=inbox.flatMap(r=>r.flags),tone=order.find(t=>all.some(f=>f[0]===t));
  // Its colour is the first kind of thing waiting; its number adds up every count the hover card
  // shows ("1 of your changes not sent" and "1 sent, with Admin" make 2).
  if(tone){lead=[tone,'',''];n=all.filter(f=>order.includes(f[0])).reduce((sum,f)=>sum+(+(f[1].match(/^\d+/)?.[0]||0)),0)}else{lead=states.find(x=>x[0]==='notice')||null;n=lead?+(lead[1].match(/\d+/)?.[0]||0):0}}
 button.innerHTML=(lead||(!inbox&&count)?'<span class="changes-dot '+(lead?.[0]||'saved')+(n?' has-count':'')+'" aria-hidden="true">'+(n?(n>99?'99+':n):'')+'</span>':'')+'<span>Changes</span>';
 window.ComposerUX?.refresh();
 button.setAttribute('aria-label','Changes'+(own?', '+own+(review?' to review':own===1?' saved change':' saved changes')+' in '+ComposerTarget.entry().title:'')+(shared?', '+shared+' in Brands · all games':'')+(awaiting?', '+awaiting+' awaiting review':''));
 // Read aloud as the hover card shows it: each game and what waits there.
 if(inbox)button.setAttribute('aria-label','Changes'+(inbox.length?', '+inbox.map(r=>r.title+': '+r.flags.map(f=>f[1]).join(', ')).join('; '):', nothing waiting'));
 button.disabled=busy;
 // The hover card says it all; a title would only draw a second, slower tooltip over it.
 button.removeAttribute('title');if(!card.hidden)paintCard();
 button.hidden=!review&&!ComposerAuth.has('drafts.submit',game());
}
// The road from a saved edit to the sites, for whoever opens Changes and finds nothing waiting.
function howItWorks(){
 const where=scope===SHARED?'the shared draft of the brands':'the cloud draft of '+esc(scopeTitle());
 return '<ol class="review-help"><li>Save an edit in Brands, Texts or Sounds. It lands in '+where+', shared with your team.</li><li>Send changes to Admin. An Admin reviews saved changes here, before or after they are sent.</li><li>Apply locally, on the Admin’s computer, writes the accepted state to <code>configurations/'+esc(scope===SHARED?SHARED:game())+'.json</code>.</li><li>Commit and push that file. GitHub rebuilds the game and publishes Composer web and Showcase.</li></ol>';
}
// Something happened to a version since Changes was last opened: the button says so until it is.
function unreadNotices(){return notices.filter(n=>!n.read_at)}
// Opening Changes is reading it: the state is all on show there, so nothing is left to mark by hand.
async function markNoticesRead(){const items=unreadNotices();if(!items.length)return;notices=notices.map(n=>({...n,read_at:n.read_at||new Date().toISOString()}));renderProgress();for(const n of items)try{await rpc('composer_mark_read',{p_id:n.id})}catch{}}
const showValue=v=>v===undefined?'Not set':v===null?'Default':v===true?'On':v===false?'Off':String(v);
function reviewGroup(section,row,payload,baseline){
 const p=row.path.split('/').filter(Boolean),labels=baseline?._labels;
 const pretty=v=>String(v||'Setting').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
 if(section==='translations')return {key:p[0],title:labels?.translations?.[p[0]]||p[0],category:'Languages',label:({en:'English',fr:'French',ht:'Creole'}[p[1]]||p[1])};
 if(section==='audio')return {key:p.slice(0,3).join('/'),title:(p[0]==='kit'?'Interface sounds':'Scene sounds')+' · '+(labels?.events?.[p[0]]?.[p[2]]||pretty(p[2])),category:'Sound settings',label:p.slice(3).map(v=>({volume_db:'Volume (dB)',pitch_jitter:'Pitch variation',takes:'Take',enabled:'Enabled',media:'Added sound',name:'File name'})[v]||pretty(v)).join(' · ')};
 const brand=payload?.design?.brands?.[p[1]]||baseline?.design?.brands?.[p[1]],title=brand?.title||labels?.brands?.[p[1]]||pretty(p[1]);
 const theme=p[2]==='themes',tail=p.slice(theme?4:2),themeId=p[3];
 const category=({roles:'Colors',overrides:'Component styles',fonts:'Fonts'})[tail[0]]||'General';
 return {key:p.slice(0,theme?4:2).join('/'),title:title+(theme?' · '+(brand?.themes?.[themeId]?.title||baseline?.design?.brands?.[p[1]]?.themes?.[themeId]?.title||pretty(themeId)):' · Brand'),category,label:tail.slice(['roles','overrides','fonts'].includes(tail[0])?1:0).map(pretty).join(' · ')||'Brand'};
}
// A sound the team added shows as a player, so a reviewer hears it before accepting it.
const ADDED_SOUND=/^[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*\/[a-z0-9_-]+-[0-9a-f]{16}\.(wav|ogg|mp3)$/;
function reviewValue(value){
 if(typeof value==='string'&&ADDED_SOUND.test(value)&&window.ComposerDraftEditors?.mediaUrl)return '<audio class="review-audio" controls preload="none" src="'+esc(window.ComposerDraftEditors.mediaUrl(value))+'"></audio>';
 const swatch=typeof value==='string'&&/^#[0-9a-f]{3,8}$/i.test(value)?'<span class="review-swatch" style="background:'+value+'" aria-hidden="true"></span>':'';
 return swatch+esc(showValue(value));
}
// A sound moment said as a person hears it: which sound plays, then its level, instead of one row
// per take switched on or off.
function audioRows(payload,baseline,key){
 const [source,,id]=key.split('/'),find=p=>p?.audio?.[source]?.events?.find(e=>e.id===id),after=find(payload),before=find(baseline);
 const name=(t,i)=>t.media?t.name||'Added sound':'Sound '+(i+1);
 const chosen=e=>{const on=(e?.takes||[]).map((t,i)=>t.enabled!==false?{t,i}:null).filter(Boolean);return on.length?on:null};
 const show=list=>list?list.map(({t,i})=>(t.media&&window.ComposerDraftEditors?.mediaUrl?'<span class="review-sound"><button type="button" class="review-play" data-play="'+esc(window.ComposerDraftEditors.mediaUrl(t.media))+'" aria-label="Play '+esc(name(t,i))+'">'+icon('play')+'</button>'+esc(name(t,i))+'</span>':esc(name(t,i)))).join(', '):'The shared sound';
 const rows=[],a=chosen(after),b=chosen(before);
 if(JSON.stringify(a?.map(x=>[x.i,x.t.media]))!==JSON.stringify(b?.map(x=>[x.i,x.t.media])))rows.push(['Sound',show(b),show(a)]);
 if((after?.volume_db??null)!==(before?.volume_db??null))rows.push(['Volume',before?.volume_db==null?'Default':esc(before.volume_db)+' dB',after?.volume_db==null?'Default':esc(after.volume_db)+' dB']);
 if(Number(after?.pitch_jitter||0)!==Number(before?.pitch_jitter||0))rows.push(['Pitch variation',esc(before?.pitch_jitter||0),esc(after?.pitch_jitter||0)]);
 return rows;
}
// Every change as one line in one flat list: what it is about (a text, a season, a sound), then
// the setting, before → after. No sections, cards or sub-headings inside one another.
function diffHTML(payload,baseline,keep=null){
 const sections=changes(payload,baseline).map(g=>keep?{...g,rows:g.rows.filter(r=>keep(g.section,r.path))}:g).filter(g=>g.rows.length);
 const lines=[];
 for(const section of sections){
  const groups=new Map();
  for(const row of section.rows){const info=reviewGroup(section.section,row,payload,baseline);if(!groups.has(info.key))groups.set(info.key,{title:info.title,rows:[]});groups.get(info.key).rows.push({...row,label:info.label})}
  for(const [key,g] of groups){
   const rows=section.section==='audio'?audioRows(payload,baseline,key):g.rows.map(r=>[esc(r.label),reviewValue(r.before),reviewValue(r.after)]);
   if(!rows.length)continue;
   lines.push('<tr class="review-flat-group"><th colspan="4" scope="rowgroup">'+esc(section.section==='audio'?g.title.replace(/^(Interface|Scene) sounds · /,'')+' · sound':g.title)+'</th></tr>'+rows.map(([l,x,y])=>'<tr><th scope="row">'+l+'</th><td class="review-before">'+x+'</td><td class="review-arrow" aria-label="becomes">→</td><td>'+y+'</td></tr>').join(''));
  }
 }
 return lines.length?'<table class="review-flat"><tbody>'+lines.join('')+'</tbody></table>':'<p class="changes-meta">No changes.</p>';
}

// Said beside the buttons that caused it: a toast would sit under the open dialog, unseen.
function message(text,error=false){const near=dialog.querySelector('.review-message')||dialog.querySelector('[role=status]');if(near){near.textContent=text;near.classList.toggle('is-error',error)}}
function canSubmit(){return !loadError&&!!currentDraft&&!dirty()&&(isReviewer()?newChanges():myChanges()).some(g=>g.rows.length)&&!versions.some(v=>Number(v.revision)===Number(currentDraft.revision))&&ComposerAuth.has('drafts.submit',game())}
function canDiscard(){return ComposerAuth.member?.role==='admin'&&!!currentDraft&&(dirty()||draftChanges().some(g=>g.rows.length)||versions.some(v=>['submitted','approved'].includes(v.status)))}
function busyControls(){const hint=$('#cloud-save-hint');if(hint)hint.textContent=dirty()?'Save your open edits to include them in this list.':!canSubmit()&&versions.some(v=>Number(v.revision)===Number(currentDraft?.revision))?returnedVersion()?'Returned by Admin. Make your corrections and save before sending again.':'':'';const submit=$('#cloud-submit');if(submit){submit.disabled=busy||!canSubmit();submit.title=dirty()?'Save your open edits first':canSubmit()?'Send saved changes to Admin':'No new saved changes to send'}for(const b of dialog.querySelectorAll('button:not([data-close]):not(#cloud-submit)'))b.disabled=busy;const ownDiscard=$('#cloud-discard-unsent');if(ownDiscard)ownDiscard.disabled=busy||(!dirty()&&!newChanges().some(g=>g.rows.length));const discard=$('#cloud-discard');if(discard)discard.disabled=busy||!canDiscard();const apply=$('#cloud-apply-draft');if(apply)apply.disabled=busy||!canApplyDraft();renderProgress()}
// One thing at a time. An action asked for while a refresh is still loading waits for it rather
// than being dropped: the confirmation window leaves the background refresh free to start.
let running=Promise.resolve();
async function run(fn){while(busy)await running;busy=true;busyControls();running=(async()=>{try{await fn()}catch(e){message(e.message,true);notify(e.message)}finally{busy=false;busyControls();renderProgress()}})();return running}
async function refresh(){
 const request=++refreshId,id=game();if(!client||ComposerAuth.local)return;
 sharedExists=!!(await window.ComposerDraftEditors?.shared?.().catch(()=>false));sharedThere=sharedExists&&ComposerAuth.has('workspace.view',SHARED);
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
  await loadInbox().catch(()=>{});if(request!==refreshId)return;
  // Read now, applied with the rest below, so nothing is drawn with half of it.
  let edits=null;{let r;try{r=await client.rpc('composer_draft_edits',{p_game:id})}catch{r={error:true}}if(request!==refreshId||id!==game())return;if(!r.error)edits=r.data||[]}
  if(scope==='game'){const [summary,catalog]=await Promise.all([sharedThere?sharedSummary().catch(()=>null):null,window.ComposerDraftEditors.comparisonCatalog?.().catch(()=>null)]);if(request!==refreshId||id!==game())return;sharedState=summary;sharedBrands=catalog?.brands||null}
  contributors=attribution.data||[];contributorsError=!!attribution.error;owners=edits?attribute(edits):null;
  authors=new Map((a.error?[]:a.data||[]).map(person=>[person.user_id,person.name?person.name+' ('+person.email+')':person.email]));versions=check(v);notices=check(n);currentDraft=d;published=check(p)[0]||null;basePayload=baseline;loadError='';
 }else{versions=[];notices=[];currentDraft=null;localConfig=null}
 render();
}
// In a version's footer: a JSON button that stays where it is, and the JSON opening below the footer.
function jsonToggle(payload){return '<button type="button" class="review-json-toggle" aria-expanded="false">JSON</button></div><pre class="review-json-pre" tabindex="0" hidden>'+esc(JSON.stringify(payload,null,2))+'</pre><div hidden>'}
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
  // Before applying, only the button: what applying does to the local file is said in its
  // confirmation, and the steps appear once there is progress to show.
  const plain=note.replace(/<[^>]+>/g,'');
  return '<div class="release-action"><button class="wb-button primary" data-apply="'+esc(v.id)+'" data-note="'+esc(plain)+'" title="Writes this version to '+esc(localConfig?.path||'the game’s configuration file')+' on this computer">Apply locally</button></div>';
 }
 const next=done===2?'This version is written to '+localFile()+'. Next: commit and push that file. Pushing publishes it to Composer web and Showcase.'
  :done===3?localFile()+' is committed. Next: push to GitHub. Pushing publishes it to Composer web and Showcase.'
  :localFile()+' is pushed. GitHub is publishing it; this version moves to Published history when that is done.';
 return releaseSteps(done)+'<p class="review-applied" role="status">'+next+'</p>';
}
// The shared brands in two words, shown while a game's changes are open: what is waiting there.
async function sharedSummary(){
 const [d,v]=await Promise.all([draft(SHARED),client.from('composer_versions').select('*').eq('game_id',SHARED).order('revision',{ascending:false}).limit(20)]);
 const list=check(v),latest=list.find(x=>x.status==='published'),newer=x=>Number(x.revision)>Number(latest?.revision||0);
 // Saved changes since what was last sent (or, with nothing sent, last published), counted as Changes lists them.
 const sentLast=list.find(x=>['submitted','approved'].includes(x.status)&&newer(x));
 const base=await window.ComposerDraftEditors.baseline(d.payload,SHARED).catch(()=>({}));
 const unsent=changes(layer(base,d.payload),layer(base,latest?.payload,sentLast?.payload),false).reduce((sum,g)=>sum+g.rows.length,0);
 const admin=ComposerAuth.member?.role==='admin'&&ComposerAuth.has('releases.publish',SHARED)&&localRelease();
 const local=admin?await fetch('release/status?game='+SHARED).then(r=>r.ok?r.json():null).catch(()=>null):null;
 const accepted=list.filter(x=>x.status==='approved'&&newer(x)),waiting=list.filter(x=>x.status==='submitted'&&newer(x)).length;
 if(admin&&accepted.some(x=>x.id!==local?.version_id))return {label:'Not applied'};
 if(admin&&local?.state==='uncommitted')return {label:'Not committed'};
 if(admin&&local?.state==='committed')return {label:'Not pushed'};
 if(waiting&&ComposerAuth.has('drafts.review',SHARED))return {label:waiting+' to review',count:waiting};
 // Saved but not sent: the draft has moved on from every version of it.
 if(Number(d.revision)>0&&!list.some(x=>Number(x.revision)===Number(d.revision)))return unsent?{label:unsent+' saved '+(unsent===1?'change':'changes')+' not sent',count:unsent}:null;
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
// What is saved but not sent, one card per person who saved it (the draft's edit journal names
// them to an Admin); what a sent version already carries is in its card above, not here.
// A person's id, as opposed to the "teammate" and "untracked" groups nobody can be asked about.
const PERSON=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function draftReview(){
 const sentHere=sentVersions().length,rows=changes(layer(basePayload,currentDraft?.payload),editingBaseline());
 // No Discard all: each sent version has its own Discard.
 const discard='';
 if(!rows.some(g=>g.rows.length))return sentHere?'':'<div class="review-empty"><strong>Nothing saved since the last publication</strong><details><summary>How a change reaches the sites</summary>'+howItWorks()+'</details></div>';
 const me=session?.user?.id,keyOf=(section,path)=>{const o=owners?.get(section+':'+path);return o?.actor||(o?.mine?me:o?.tracked?'team':'untracked')};
 const people=new Map();for(const g of rows)for(const r of g.rows){const k=keyOf(g.section,r.path);people.set(k,(people.get(k)||0)+1)}
 const nameOf=k=>k===me?'You':k==='team'?'A teammate':k==='untracked'?'Saved before edits were tracked':authorName(k,'A teammate');
 const order=[...people.keys()].sort((a,b)=>(b===me)-(a===me));
 return '<section class="review-queue"><h3>Not sent yet <span class="review-count">'+rows.reduce((n,g)=>n+g.rows.length,0)+'</span></h3><div class="cloud-list">'
  +order.map(k=>'<article class="review-version"><div class="review-version-head">'+avatarHTML(k,nameOf(k))+'<span><strong>'+esc(nameOf(k))+'</strong><small>saved, not sent · '+people.get(k)+(people.get(k)===1?' change':' changes')+'</small></span></div>'+diffHTML(layer(basePayload,currentDraft.payload),editingBaseline(),(section,path)=>keyOf(section,path)===k)+(ComposerAuth.member?.role==='admin'&&PERSON.test(k)?'<div class="share-actions"><button class="wb-button discard-changes" data-discard-person="'+esc(k)+'" data-who="'+esc(k===me?'you':authorName(k,'this teammate'))+'">Discard these changes</button></div>':'')+'</article>').join('')
  +'</div><p id="cloud-save-hint"></p><p class="review-message" role="alert"></p><div class="review-actions">'+(localRelease()?'<button class="wb-button primary" id="cloud-apply-draft" title="Writes everything saved for this game, sent or not, to its configuration file on this computer">'+(sentHere?'Apply everything locally':'Apply locally')+'</button>':'')+discard+'</div></section>';
}
async function applyVersion(versionId,id){
 const auth=check(await client.auth.getSession());const response=await fetch('release/apply',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.session.access_token},body:JSON.stringify({version_id:versionId})});const data=await response.json();if(!response.ok)throw Error(data.message||'Could not apply configuration');await refresh();message('Applied locally: '+data.path+'. Review, commit and push to publish.');notify('Configuration ready to commit');
}
function reviewStatus(status,count){const accepted=status==='approved';return '<span class="review-status '+(accepted?'accepted':'awaiting')+'"'+(accepted?' title="Accepted by Admin; not published yet"':'')+'>'+(accepted?'Accepted':'Awaiting review')+(count?' · '+count:'')+'</span>'}
function publishedItems(){const items=versions.filter(v=>v.status==='published');if(published&&!items.some(v=>v.id===published.id))items.unshift(published);return items}
function publicationHistory(){
 const items=publishedItems();
 return '<div class="changes-history-list">'+items.map(v=>{const r=releases.find(r=>r.version_id===v.id);return '<p>Revision '+esc(v.revision)+(r?.published_at?' · '+esc(new Date(r.published_at).toLocaleString(undefined,{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})):'')+'</p>'}).join('')+(scope===SHARED?'':'<a target="_blank" rel="noopener" href="https://svyatoslavteslyak.github.io/game-showcase/games/'+encodeURIComponent(game())+'/index.html">Open published game '+icon('external')+'</a>')+'</div>';
}
// Each sent version under its sender's name, showing only what it adds to the one sent before it
// (or to what is published). A version is a snapshot of the whole draft, so the newest one also
// carries what earlier ones sent; applying it applies them all, and the card says so.
function reviewVersions(){
 const all=sentVersions().slice().sort((a,b)=>Number(a.revision)-Number(b.revision));
 const before=v=>{const prev=all.filter(x=>Number(x.revision)<Number(v.revision)).pop();return prev?layer(basePayload,published?.payload,prev.payload):layer(basePayload,published?.payload)};
 const card=v=>{
  const earlier=all.filter(x=>Number(x.revision)<Number(v.revision)).length,when=new Date(v.submitted_at).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  return '<article class="review-version"><div class="review-version-head">'+avatarHTML(v.submitted_by,authorName(v.submitted_by,'?'))+'<span><strong>'+esc(v.submitted_by===session?.user?.id?'You':authorName(v.submitted_by,'A teammate'))+'</strong><small>sent '+esc(when)+' · revision '+esc(v.revision)+'</small></span></div>'
   +diffHTML(layer(basePayload,published?.payload,v.payload),before(v))
   +(earlier?'<p class="changes-meta">Also carries '+earlier+' earlier '+(earlier===1?'version':'versions')+' above: applying this one applies '+(earlier===1?'it':'them')+' too.</p>':'')
   +'<div class="share-actions">'+releaseActions(v)+(ComposerAuth.member?.role==='admin'?'<button class="wb-button discard-changes" data-discard-version="'+esc(v.id)+'" data-who="'+esc(authorName(v.submitted_by,'this teammate'))+'">Discard these changes</button>':'')+jsonToggle({schema_version:1,game_id:v.game_id,version_id:v.id,revision:v.revision,payload:v.payload})+'</div></article>';
 };
 const groups=[['submitted','Needs review'],['approved','Accepted · not published']];
 return groups.map(([status,title])=>{const items=all.filter(v=>v.status===status);return items.length?'<section class="review-queue" data-review-status="'+status+'"><h3>'+title+' <span class="review-count">'+items.length+'</span></h3><div class="cloud-list">'+items.map(card).join('')+'</div></section>':''}).join('');
}

const isAdmin=()=>ComposerAuth.member?.role==='admin';
let inbox=null;
// Every game with something waiting, for an Admin: versions to review or accepted, saved changes
// not yet sent or published, and this computer's release steps. One row each; a click opens it.
async function loadInbox(){
 if(!session)session=check(await client.auth.getSession()).session;
 const [v,d,a]=await Promise.all([client.from('composer_versions').select('game_id,revision,status,submitted_by,payload'),client.from('composer_drafts').select('game_id,revision,updated_at,payload'),Promise.resolve(client.rpc('composer_list_members')).catch(()=>({data:[]}))]);
 // Seasons and faces are told apart from the shared brands, as in each game's own Changes.
 if(!sharedBrands)sharedBrands=(await window.ComposerDraftEditors.comparisonCatalog?.().catch(()=>null))?.brands||null;
 if(!a.error&&a.data)authors=new Map(a.data.map(person=>[person.user_id,person.name?person.name+' ('+person.email+')':person.email]));
 const versionsAll=check(v)||[],draftsAll=Array.isArray(check(d))?check(d):[];
 const ids=[...new Set([...draftsAll.map(x=>x.game_id),...versionsAll.map(x=>x.game_id)])].filter(id=>id&&id!=='kit');
 const rows=[];
 for(const id of ids){
  const mine=versionsAll.filter(x=>x.game_id===id),last=Math.max(0,...mine.map(x=>Number(x.revision))),published=Math.max(0,...mine.filter(x=>x.status==='published').map(x=>Number(x.revision)));
  const waiting=mine.filter(x=>x.status==='submitted'&&Number(x.revision)>published),accepted=mine.filter(x=>x.status==='approved'&&Number(x.revision)>published);
  const draft=draftsAll.find(x=>x.game_id===id),draftRev=Number(draft?.revision||0);
  // Saved changes counted as the game's own Changes counts them: the draft against what was last
  // sent or published.
  let saved=0;
  if(draftRev>last&&draft?.payload){const since=mine.filter(x=>x.status!=='rejected').sort((x,y)=>Number(y.revision)-Number(x.revision))[0];const base=await window.ComposerDraftEditors.baseline(draft.payload,id).catch(()=>({}));saved=changes(layer(base,draft.payload),layer(base,since?.payload),id!==SHARED).reduce((n,g)=>n+g.rows.length,0)}
  if(!isAdmin()){
   const sentMine=[...waiting,...accepted].filter(x=>x.submitted_by===session?.user?.id),flags=[];
   let own=0;
   if(saved&&draft?.payload){let r;try{r=await client.rpc('composer_draft_edits',{p_game:id})}catch{r={error:true}}
    if(!r.error){const map=attribute(r.data||[],id!==SHARED),since=mine.filter(x=>x.status!=='rejected').sort((x,y)=>Number(y.revision)-Number(x.revision))[0],base=await window.ComposerDraftEditors.baseline(draft.payload,id).catch(()=>({}));
     own=changes(layer(base,draft.payload),layer(base,since?.payload),id!==SHARED).reduce((n,g)=>n+g.rows.filter(row=>map.get(g.section+':'+row.path)?.mine).length,0)}}
   if(own)flags.push(['saved',own+' of your changes not sent']);
   if(sentMine.length)flags.push(['awaiting',sentMine.length+' sent, with Admin']);
   if(flags.length)rows.push({id,title:titleOf(id),flags});
   continue;
  }
  const local=localRelease()?await fetch('release/status?game='+encodeURIComponent(id)).then(r=>r.ok?r.json():null).catch(()=>null):null;
  const flags=[];
  if(local?.state==='uncommitted')flags.push(['release','Not committed']);else if(local?.state==='committed')flags.push(['release','Not pushed']);
  if(accepted.length)flags.push(['accepted',accepted.length+' accepted']);
  if(waiting.length)flags.push(['awaiting',waiting.length+' to review · '+[...new Set(waiting.map(x=>authorName(x.submitted_by,'a teammate').replace(/\s*\([^)]*@[^)]*\)$/,'')))].join(', ')]);
  if(saved)flags.push(['saved',saved+' saved '+(saved===1?'change':'changes')+' not '+(waiting.length||accepted.length?'sent':'published')]);
  if(flags.length)rows.push({id,title:titleOf(id),flags});
 }
 rows.sort((a,b)=>(a.id===SHARED)-(b.id===SHARED)||a.title.localeCompare(b.title));
 inbox=rows;
}
function inboxHTML(){
 if(!inbox)return '<p class="changes-meta">Loading…</p>';
 if(!inbox.length)return '<div class="review-empty"><strong>Nothing waiting in any game</strong></div>';
 return '<ul class="changes-inbox">'+inbox.map(r=>'<li><button type="button" data-inbox="'+esc(r.id)+'"><span class="changes-inbox-title">'+esc(r.title)+'</span><span class="changes-inbox-flags">'+r.flags.map(([tone,label])=>'<span class="changes-flag tone-'+tone+'">'+esc(label)+'</span>').join('')+'</span><span aria-hidden="true">›</span></button></li>').join('')+'</ul>';
}
function adminTabs(){
 const here=ComposerTarget.value,current=scope===SHARED?SHARED:(inspected||here);
 // Only games with something in them get a tab, the stage's game first; the one open keeps its tab.
 const rows=(inbox||[]).filter(r=>r.id!==SHARED&&r.flags?.length).sort((a,b)=>(b.id===here)-(a.id===here));
 if(current!==SHARED&&!rows.some(r=>r.id===current))rows.unshift({id:current,title:titleOf(current),flags:[]});
 // The shared brands get a tab only with something in it (or while it is the one open).
 const shared=inbox?.find(r=>r.id===SHARED);if(sharedThere&&(shared||current===SHARED))rows.push(shared||{id:SHARED,title:titleOf(SHARED),flags:[]});
 // A lone tab still names the game, unless it is the stage's own game with nothing in it.
 if(!rows.length||rows.length===1&&rows[0].id===here&&!rows[0].flags?.length)return '';
 // A tab's number adds up its counts, as the Changes button does; a step without one shows its words.
 const lead=f=>{if(!f[0])return '';const total=f.reduce((sum,x)=>sum+(+(x[1].match(/^\d+/)?.[0]||0)),0);return ' <span class="changes-flag tone-'+f[0][0]+'">'+esc(total?String(total):f[0][1].replace(/ ·.*$/,''))+'</span>'};
 return '<div class="scope-tabs admin-tabs" role="group" aria-label="Games with changes">'+rows.map(r=>'<button type="button" class="wb-button" data-inbox="'+esc(r.id)+'" aria-pressed="'+(r.id===current)+'"'+(r.flags.length?' title="'+esc(r.flags.map(x=>x[1]).join(' · '))+'"':'')+'>'+(r.id===SHARED?'<span class="changes-tab-icon" aria-hidden="true">'+(typeof icon==='function'?icon('brands'):'')+'</span>':'<img class="changes-tab-icon" src="icons/'+esc(r.id)+'.png" alt="" width="20" height="20">')+esc(r.title)+lead(r.flags)+'</button>').join('')+'</div>';
}
function renderInbox(){
 dialog.innerHTML='<header><div><div class="review-heading"><h2 id="cloud-title">Changes</h2></div></div><div class="review-header-actions"><button class="wb-button" id="cloud-refresh" aria-label="Refresh" title="Refresh">'+icon('reload')+'</button><button class="wb-button" data-close aria-label="Close">'+icon('close')+'</button></div></header><p class="changes-meta">Every game with something waiting. Open one to review it; the stage stays on '+esc(ComposerTarget.entry().title)+'.</p>'+inboxHTML()+'<p role="status" aria-live="polite"></p>';
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();$('#cloud-refresh').onclick=()=>run(async()=>{await loadInbox();renderInbox()});
 for(const b of dialog.querySelectorAll('[data-inbox]'))b.onclick=()=>{const id=b.dataset.inbox;view='game';if(id===SHARED){inspected='';setScope(SHARED)}else{setScope('game');inspected=id===ComposerTarget.value?'':id}render();run(refresh)};
}
function render(){
 renderProgress();if(!isReviewer()&&!ComposerAuth.has('drafts.submit',game())){if(dialog.open)dialog.close();return}
 const collapsed=new Set([...dialog.querySelectorAll('[data-review-group]:not([open])')].map(el=>el.dataset.reviewGroup));
 const sentExpanded=dialog.querySelector('.review-sent')?.open;
 const sent=mySent(),teamSent=sentVersions().length-sent.length,newCount=myChanges().reduce((sum,g)=>sum+g.rows.length,0),others=othersChanges(),otherCount=others.reduce((sum,g)=>sum+g.rows.length,0);
 dialog.innerHTML='<header><div><div class="review-heading"><h2 id="cloud-title">Changes</h2>'+(!isReviewer()?['submitted','approved'].map(status=>{const count=sent.filter(v=>v.status===status).length;return count?reviewStatus(status,count):''}).join(''):'')+'</div></div><div class="review-header-actions"><button class="wb-button" id="cloud-refresh" aria-label="Refresh" title="Refresh">'+icon('reload')+'</button><button class="wb-button" data-close aria-label="Close">'+icon('close')+'</button></div></header>'+
 adminTabs()+
 (false?'<div class="scope-tabs" role="group" aria-label="Whose changes"><button type="button" class="wb-button" data-scope="game" aria-pressed="'+(scope==='game')+'" title="This game’s own texts, sounds, and the seasons or faces only it has">'+esc(titleOf(inspected||ComposerTarget.value))+tabFlag(gameFlag(),scope==='game'?standing()?.tone:undefined)+'</button><button type="button" class="wb-button" data-scope="'+SHARED+'" aria-pressed="'+(scope===SHARED)+'" title="Brands and the texts every game shares, reviewed and published once for all">Brands · all games'+tabFlag(sharedState?.label)+'</button></div>':'')+
 standingHTML()+localBanner()+
 
 (ComposerAuth.member?.role==='admin'&&ComposerAuth.has('releases.publish',game())&&!localRelease()?'<p class="changes-meta">Publishing is done in local Composer: Apply locally there, then commit and push.</p>':'')+
 (isReviewer()?reviewVersions():'')+
 
 '<div id="draft-changes">'+(isReviewer()?draftReview():
 (newCount?(returnedVersion()?'<h3 class="review-new-title">Returned for changes</h3>':'')+(otherCount?'<h3 class="review-new-title">Your changes <span class="review-count">'+newCount+'</span></h3>':'')+diffHTML(layer(basePayload,currentDraft?.payload),editingBaseline(),(section,path)=>!!ownerOf(section,path).mine):'<div class="review-empty"><strong>'+(sent.length?'All your changes are sent · you can keep editing':'Nothing of yours to send')+'</strong>'+(sent.length||otherCount?'':'<details><summary>How a change reaches the sites</summary>'+howItWorks()+'</details>')+'</div>')
 // What others saved in the same draft: shown, folded, never counted or sent as yours.
 +(otherCount?'<details class="review-others"><summary>Saved by others in this draft <span class="review-count">'+otherCount+'</span></summary><p class="changes-meta">'+othersWho(others)+' Not counted as yours; a version you send carries the whole draft, so Admin reviews them with it.</p>'+diffHTML(layer(basePayload,currentDraft?.payload),editingBaseline(),(section,path)=>!ownerOf(section,path).mine)+'</details>':''))+'</div>'+

 (!isReviewer()?'<div class="review-send"><p id="cloud-save-hint"></p><p class="review-message" role="alert"></p><button class="wb-button discard-changes" id="cloud-discard-unsent"'+(newCount||dirty()?'':' hidden')+'>Discard my unsent changes</button><button class="wb-button primary" id="cloud-submit"'+(!newCount?' hidden':'')+'>Send changes</button></div>'+ (sent.length?'<section class="review-sent-list"><h3 class="review-new-title">Sent to Admin <span class="review-count">'+sent.length+'</span></h3>'+sent.slice().sort((a,b)=>Number(a.revision)-Number(b.revision)).map((v,k,all)=>'<article class="review-version"><div class="review-version-head">'+avatarHTML(session?.user?.id,'You')+'<span><strong>Sent '+esc(new Date(v.submitted_at).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+'</strong><small>revision '+esc(v.revision)+'</small></span>'+reviewStatus(v.status)+'</div>'+diffHTML(layer(basePayload,published?.payload,v.payload),k?layer(basePayload,published?.payload,all[k-1].payload):layer(basePayload,published?.payload))+'<div class="share-actions">'+jsonToggle(v.payload)+'</div></article>').join('')+'</section>':''):'')+
 '<p role="status" aria-live="polite"></p>';
 if(sentExpanded&&dialog.querySelector('.review-sent'))dialog.querySelector('.review-sent').open=true;
 for(const group of dialog.querySelectorAll('[data-review-group]'))if(collapsed.has(group.dataset.reviewGroup))group.open=false;
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();$('#cloud-refresh').onclick=()=>run(refresh);

 // An Admin's tabs: the game on the stage, every other game with something waiting, and the shared brands.
 for(const b of dialog.querySelectorAll('[data-inbox]'))b.onclick=()=>{if(busy)return;const id=b.dataset.inbox;if(id===SHARED){inspected='';setScope(SHARED)}else{setScope('game');inspected=id===ComposerTarget.value?'':id}render();run(refresh)};
 $('#cloud-discard')?.addEventListener('click',async()=>{if(!canDiscard()||busy)return;const id=game(),revision=currentDraft.revision;if(!await ask('Discard all unpublished changes for '+scopeTitle()+'? This includes shared draft edits, open edits in this window, and sent or approved versions. The published game stays unchanged.'))return;run(async()=>{await rpc('composer_discard_changes',{p_game:id,p_revision:revision});location.reload()})});
 $('#cloud-discard-unsent')?.addEventListener('click',async()=>{
  if(busy)return;
  if(!await ask('Discard your unsent edits for '+scopeTitle()+'? Your tracked edits and unsaved edits in this window will be reset. Sent versions and other people’s changes will stay. Older edits without authorship history will be preserved.'))return;
  run(async()=>{if(!newChanges().some(g=>g.rows.length)&&dirty()){location.reload();return}try{await rpc('composer_discard_unsent',{p_game:game(),p_revision:currentDraft.revision})}catch(error){throw /No tracked unsent edits/.test(error.message)?Error(currentDraft?.updated_by===session?.user?.id?'These changes were saved before Composer tracked who made each edit, so only an Admin can discard them.':'None of these changes are yours, so there is nothing of yours to discard. They were saved by '+authorName(currentDraft?.updated_by)+'; an Admin can discard them.'):error}location.reload()});
 });
 for(const b of dialog.querySelectorAll('[data-apply]'))b.onclick=async()=>{
  if(!await ask('Apply this sent version to the local game configuration?'+(b.dataset.note?'\n\n'+b.dataset.note:'')+'\n\nReview the file, then commit and push to publish.'))return;
  const id=game();run(()=>applyVersion(b.dataset.apply,id));
 };
 // One person's sent changes, undone in the draft; anyone else's stay (composer_discard_version).
 for(const b of dialog.querySelectorAll('[data-discard-version]'))b.onclick=async()=>{
  if(busy)return;const later=sentVersions().filter(v=>Number(v.revision)>Number(versions.find(x=>x.id===b.dataset.discardVersion)?.revision||0)).length;
  if(!await ask('Discard the changes '+b.dataset.who+' sent? They are removed from the draft; everyone else\'s stay.'+(later?' '+later+(later===1?' later version carries':' later versions carry')+' them too and will go back to '+(later===1?'its sender':'their senders')+' to send again.':'')))return;
  run(async()=>{await rpc('composer_discard_version',{p_version:b.dataset.discardVersion});await refresh();message('Discarded the changes '+b.dataset.who+' sent.')});
 };
 // One person's saved, unsent changes, undone in the draft (composer_discard_person).
 for(const b of dialog.querySelectorAll('[data-discard-person]'))b.onclick=async()=>{
  if(busy)return;
  if(!await ask('Discard the changes '+b.dataset.who+' saved? They are removed from the draft; everyone else\'s stay.'))return;
  run(async()=>{await rpc('composer_discard_person',{p_game:game(),p_revision:currentDraft.revision,p_actor:b.dataset.discardPerson});await refresh();message('Discarded the changes '+b.dataset.who+' saved.')});
 };
 $('#cloud-apply-draft')?.addEventListener('click',async()=>{
  if(busy||!canApplyDraft())return;
  const id=game(),revision=currentDraft.revision;
  if(!await ask('Apply all reviewed saved changes, including teammates’ edits, to the local configuration? This does not publish.'))return;
  run(async()=>{const version=await rpc('composer_accept_draft',{p_game:id,p_revision:revision});try{await applyVersion(version.id,id)}catch(error){await refresh();throw error}});
 });
 $('#cloud-submit')?.addEventListener('click',sendChanges);

 dialog.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{
  if(busy||b.dataset.scope===scope)return;
  if(dirty()){message('Save or cancel your open edits before switching.');return}
  setScope(b.dataset.scope);render();run(refresh);
 });
 $('#copy-publish')?.addEventListener('click',()=>copyPublish().then(()=>message(feedback.textContent)));
 busyControls();
}
// Another scope's draft, versions and local file are nothing to do with this one's.
function setScope(next){scope=next;++refreshId;currentDraft=null;published=null;versions=[];basePayload={};owners=null;localConfig=null}
// Changes opens on the stage's game, or on the first game with something in it when that one has
// nothing (unless a game was picked meanwhile, from the hover card).
function landing(){
 const here=ComposerTarget.value;if(scope!=='game'||inspected||inbox?.find(r=>r.id===here)?.flags?.length)return '';
 return inbox?.find(r=>r.id!==SHARED&&r.id!==here&&r.flags?.length)?.id||'';
}
function open(){hideCard(0);inspected='';render();if(!dialog.open)dialog.showModal();run(async()=>{await loadInbox().catch(()=>{});const first=landing();if(first){inspected=first;render()}await refresh();await markNoticesRead()})}
// Outside the dialog Changes is about the selected game; the shared brands show as a flag there.
dialog.addEventListener('close',()=>{const away=scope!=='game'||inspected;view='game';inspected='';if(away){setScope('game');renderProgress();schedule()}});
button.onclick=open;
function sendChanges(){
 run(async()=>{
  if(!canSubmit())throw Error(loadError?'The cloud draft could not be read: '+loadError:dirty()?'Save or cancel your open edits first.':!myChanges().some(g=>g.rows.length)?'None of the saved changes are yours, so there is nothing of yours to send.':versions.some(v=>Number(v.revision)===Number(currentDraft?.revision))?'This saved state is already sent.':'Your role cannot send changes for '+scopeTitle()+'.');
  const id=game(),revision=currentDraft.revision;
  const sections=myChanges().filter(g=>g.rows.length).map(g=>sectionNames[g.section]).join(', ');
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
setInterval(()=>{if((isReviewer()||ComposerAuth.has('drafts.submit',game()))&&!busy&&!dialog.contains(document.activeElement)&&!document.querySelector('.ask-dialog[open]'))schedule()},15000);
if(cloudMode)run(async()=>{try{await refresh();window.dispatchEvent(new Event('composer-storage'))}catch(e){loadError=e.message;renderProgress();throw e}});
if(ComposerAuth.local)window.dispatchEvent(new Event('composer-storage'));
