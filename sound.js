/* Sound effects: browse, audition and tune the sounds.json manifests of the UI kit and games.
   A game shows two manifests at once — the shared interface events from the kit and its own
   scene events. The Composer server (tools/sound_studio.py) owns files; this page only edits
   allowed fields. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const controls=$('#sound-controls'),report=$('#sound-report');
const KIT='kit',AUDIO_ACCEPT='.wav,.ogg,.mp3,audio/*';
let drafts={},dirty=new Set(),player=null,stamp=Date.now(),loaded=false,group='interface';

// The target is the global Composer game; target.js owns the catalog and the web-dev rebuild.
const targetId=()=>window.ComposerTarget.value;
const catalog=()=>window.ComposerTarget.catalog;
const current=()=>window.ComposerTarget.source();
const sourceOf=id=>catalog()?.sources.find(s=>s.id===id)||null;
const isGame=()=>current()?.build?.kind==='game';
const gain=db=>Math.min(1,Math.pow(10,db/20));
const baseName=file=>file.split('/').pop();
function message(text,error=false){if(error)window.ComposerUX?.status('error',text);const node=$('#sound-message');if(node){node.textContent=text;node.classList.toggle('sound-error',error)}}

async function request(path,options={}){
 const response=await fetch(path,{cache:'no-store',...options});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.message||('Request failed ('+response.status+')'));
 return data;
}

// The tab label carries the unsaved-work dot, so leaving Sound effects never hides it.
function flagDirty(){$('#sound-tab').classList.toggle('workspace-dirty',dirty.size>0)}
function adopt(){
 stamp=Date.now();probes=[];drafts={};dirty.clear();flagDirty();
 for(const id of [KIT,targetId()]){
  const found=sourceOf(id);
  if(found?.manifest&&!drafts[id])drafts[id]=structuredClone(found.manifest);
 }
}
const events=sid=>drafts[sid]?.events||[];
const eventAt=(sid,index)=>events(sid)[index];

async function load(keepMessage=false){
 if(dirty.size&&!confirm('Discard unsaved sound edits and reload the shared draft?'))return;
 dirty.clear();flagDirty();
 try{
  await window.ComposerTarget.refresh();
  adopt();render();if(!keepMessage)message('');
 }catch(error){
  controls.innerHTML='<div class="toolbar"><strong>Sound effects</strong><small class="sound-error">'+esc(error.message)+'</small><small>Start Composer with tools/preview.py so studio/ routes are available.</small></div>';
  report.innerHTML='';
 }
}

function render(){
 const game=isGame(),own=drafts[targetId()],kit=drafts[KIT];
 if(!game||!own)group='interface';
 const chip=(id,label,count,disabled)=>'<button class="wb-button" type="button" data-group="'+id+'" aria-pressed="'+(group===id)+'"'+(disabled?' disabled title="Pick a game to see its scene sounds"':'')+'>'+label+(count===null?'':'<em class="sound-count">'+count+'</em>')+'</button>';
 controls.innerHTML='<div class="toolbar"><strong>Sounds</strong><div class="look-row" id="sound-groups" role="group" aria-label="Sound group">'
   +chip('interface','Interface events',kit?kit.events.length:0,!kit)
   // The shared kit has no scene of its own, so the chip is left out rather than greyed.
   +(game?chip('scene','Scene sounds',own?own.events.length:null,!own):'')
  +'</div></div>'
  +'<div class="toolbar"><strong>Saved sounds</strong><button id="sound-refresh" title="Reload the shared sound draft">Refresh</button>'
   +'<button id="sound-reset" title="Put every event of this manifest back to the sounds it shipped with">Reset to default</button></div>'
  +'<div class="toolbar"><label>Find a sound<input id="sound-search" type="search" placeholder="Event name or description"></label><small>You are hearing draft sounds here. The game beside this editor uses its built / published sounds. Changes autosave; Send changes → Apply locally → publish updates the game.</small>'+(window.ComposerDraftEditors?.enabled?'<small>Choose existing sounds. New asset uploads are not available for shared drafts.</small>':catalog().generation.available?'<small>Sound generation available.</small>':'')+'</div>'
  +'<div class="toolbar"><small id="sound-message" role="status"></small></div>';
 if(!kit&&!own){report.innerHTML='<div class="sound-empty"><h2>'+esc(window.ComposerTarget.entry().title)+'</h2><p>No manifest to show yet. Start Composer with tools/preview.py so the shared kit is copied in.</p></div>';return}
 const title=game?window.ComposerTarget.entry().title:(kit?.title||'Shared UI sounds');
 report.innerHTML='<header class="sound-head"><div><h2>'+esc(title)+'</h2></div>'
  +'</header><p id="sound-no-results" class="sound-empty" role="status" hidden>No matching sounds. Try another name or description.</p>'
  +sections(game,own);
 $('#sound-search').oninput=e=>{const q=e.target.value.toLowerCase();let visible=0;for(const card of report.querySelectorAll('.sound-grid>*')){card.hidden=!card.textContent.toLowerCase().includes(q);if(!card.hidden)visible++}$('#sound-no-results').hidden=visible>0};
 for(const audio of report.querySelectorAll('[data-duration]'))measure(audio);
 const canEdit=window.ComposerAuth?.has('audio.edit',targetId()==='kit'?null:targetId());
 for(const field of report.querySelectorAll('input,textarea'))field.disabled=!canEdit;
 $('#sound-reset').disabled=!canEdit;
}

// One group at a time: the chips in the sidebar choose which half is on screen.
function sections(game,own){
 const grid=(sid,list)=>'<div class="sound-grid">'+list.map(([event,index])=>card(event,index,sid)).join('')+'</div>';
 const indexed=sid=>events(sid).map((event,index)=>[event,index]);
 if(group==='scene'){
  if(!own)return '<p class="sound-note">This game has no assets/audio/sounds.json yet. Add one in the Explosive Fruits format, point LocalFeedback.play_event at SOUNDS.EVENTS, then reload.</p>';
  return grid(targetId(),indexed(targetId()).filter(([e])=>e.group!=='interface'&&!e.runtime_unused));
 }
 const overrides=indexed(targetId()).filter(([e])=>e.group==='interface'),ids=new Set(overrides.map(([e])=>e.id));
 const kit=indexed(KIT).filter(([e])=>!ids.has(e.id)),named=kit.filter(([e])=>e.fallback),base=kit.filter(([e])=>!e.fallback);
 return '<div class="sound-grid">'+overrides.map(([event,index])=>card(event,index,targetId())).join('')+named.concat(base).map(([event,index])=>card(event,index,KIT)).join('')+'</div>';
}

// The take list an event actually sounds like: its own, or its base sound's.
const voice=(event,sid)=>event.takes.length?event:(events(sid).find(e=>e.id===event.fallback)||event);
// An event with no level of its own is played at the level of the sound it falls back to.
function level(event,sid){
 let node=event,hops=0;
 while(node&&(node.volume_db===null||node.volume_db===undefined)&&node.fallback&&hops++<4)node=events(sid).find(e=>e.id===node.fallback);
 return Number(node?.volume_db??0);
}

function card(event,index,sid){
 // One card is a title, a level and a list of sounds to choose from. Everything a
 // developer needs and nobody else does sits under Details.
 const base=event.fallback?events(sid).find(e=>e.id===event.fallback):null;
 const own=event.takes,chosen=own.findIndex(t=>t.enabled!==false&&t.exists!==false);
 const baseTake=base?(base.takes.find(t=>t.enabled!==false)||base.takes[0]):null;
 const rows=(baseTake?[{take:baseTake,pick:-1,from:base}]:[]).concat(own.map((take,t)=>({take,pick:t})));
 const silent=!rows.some(r=>r.take&&r.take.exists!==false&&(r.pick<0||r.take.enabled!==false));
 const volume=level(event,sid);
 return '<article class="sound-card" data-event="'+index+'" data-source="'+esc(sid)+'">'
  +'<h3>'+esc(event.label||event.id)+'</h3>'
  +'<p class="sound-trigger">'+esc(event.trigger||'')+'</p>'
  +(silent?'<p class="sound-warn">No sound chosen: this event is silent.</p>':'')
  +'<label class="sound-slider"><span>Volume</span><input type="range" data-volume min="-40" max="6" step="0.5" value="'+volume+'"><output>'+volume.toFixed(1)+' dB</output></label>'
  +'<ol class="sound-takes">'+rows.map(row=>takeRow(event,row,sid,chosen)).join('')+'</ol>'
  +(window.ComposerDraftEditors?.enabled?'':'<div class="sound-card-actions"><label class="sound-replace">Add a sound<input type="file" data-take-add accept="'+AUDIO_ACCEPT+'"></label></div>')
  +'<details class="sound-prompt"><summary>Details</summary>'
   +'<p class="sound-meta">Event <code>'+esc(event.id)+'</code>'+(base?' · falls back to '+esc(base.label||base.id):'')+'</p>'
   +'<label class="sound-slider"><span>Pitch spread</span><input type="range" data-jitter min="0" max="0.2" step="0.01" value="'+(event.pitch_jitter||0)+'"><output>±'+Math.round((event.pitch_jitter||0)*100)+'%</output></label>'
   +('prompt' in event?'<textarea data-prompt rows="4" maxlength="1000">'+esc(event.prompt)+'</textarea><div class="sound-prompt-actions"><button data-copy>Copy prompt</button>'+(event.flow_url?'<a href="'+esc(event.flow_url)+'" target="_blank" rel="noopener">Open flow ↗</a>':'')+'</div>':'')
  +'</details>'
  +'</article>';
}

// One row of the take list. `pick` -1 is the borrowed base sound, which no game owns.
function takeRow(event,{take,pick,from},sid,chosen){
 const borrowed=pick<0,missing=take.exists===false;
 const uploaded=(take.source||'').startsWith('upload:')?take.source.slice(7):'';
 const name=borrowed?esc(from.label||from.id)+' <em>shared</em>':esc(uploaded||'Sound '+(pick+1));
 return '<li class="'+(missing?'sound-missing':'')+(borrowed?' sound-borrowed':'')+'">'
  +'<label class="sound-toggle"><input type="radio" name="take-'+esc(event.id)+'" data-take-choice="'+pick+'"'+((borrowed?chosen<0:chosen===pick)?' checked':'')+(missing?' disabled':'')+'><span class="sound-file">'+name+'</span></label>'
  +'<span class="sound-meta"'+(missing?'':' data-duration="'+esc(take.file)+'"')+'>'+(missing?'missing file':'…')+'</span>'
  +'<button data-take-play="'+pick+'" data-play-label="Play '+(borrowed?'the shared sound':'sound '+(pick+1))+'" aria-label="Play '+(borrowed?'the shared sound':'sound '+(pick+1))+'"'+(missing?' disabled':'')+'>▶</button>'
  +'</li>';
}

const engineId=()=>window.ComposerTarget.engine;
const audioUrl=(file,sid)=>window.ComposerHosting?.audioUrl(sid,file)||'studio/audio?source='+encodeURIComponent(sid)+'&engine='+encodeURIComponent(engineId())+'&file='+encodeURIComponent(file)+'&v='+stamp;
// Durations load a few at a time with one retry; bursts of metadata requests fail intermittently.
let probes=[],probing=0;
function measure(node){probes.push({node,retry:1,sid:node.closest('[data-source]').dataset.source});pump()}
function pump(){
 while(probing<4&&probes.length){
  const job=probes.shift(),probe=new Audio();probing++;
  const done=()=>{probing--;probe.onloadedmetadata=probe.onerror=null;pump()};
  probe.preload='metadata';
  probe.onloadedmetadata=()=>{job.node.textContent=probe.duration.toFixed(2)+' s';done()};
  probe.onerror=()=>{if(job.retry-->0)probes.push(job);else job.node.textContent='unreadable';done()};
  probe.src=audioUrl(job.node.dataset.duration,job.sid)+'&probe='+job.retry;
 }
}

let playingButton=null,auditionContext=null;
function stop(){
 if(auditionContext){void auditionContext.close();auditionContext=null}
 if(playingButton){playingButton.textContent='▶';playingButton.setAttribute('aria-pressed','false');playingButton.setAttribute('aria-label',playingButton.dataset.playLabel||'Play');playingButton.setAttribute('aria-pressed','false');playingButton=null}
 if(player){player.onended=null;player.pause();player=null}
}
function play(event,take,sid,button,trigger=event){
 stop();
 if(button){playingButton=button;button.textContent='■';button.setAttribute('aria-label','Stop');button.setAttribute('aria-pressed','true')}
 player=new Audio(audioUrl(event.takes[take].file,sid));
 const db=level(trigger,sid);player.volume=gain(db);
 if(sid!==KIT&&event.group!=='interface'&&db>0){auditionContext=new AudioContext();const source=auditionContext.createMediaElementSource(player),boost=auditionContext.createGain();boost.gain.value=Math.pow(10,db/20);source.connect(boost).connect(auditionContext.destination);void auditionContext.resume()}
 const jitter=Number(trigger.pitch_jitter??(sid===KIT?0:0.02));
 const baseRate=trigger.id==='win_transfer'?1.12:event.takes[take].file.endsWith('/click.ogg')&&trigger.id==='stake_minus'?0.92:event.takes[take].file.endsWith('/click.ogg')&&trigger.id==='stake_plus'?1.08:1;
 player.preservesPitch=false;player.playbackRate=baseRate*(1+(Math.random()*2-1)*jitter);
 player.onended=()=>stop();
 player.play().catch(error=>{stop();message('Playback failed: '+error.message,true)});
}

let saveTimer=null;
function markDirty(sid){
 dirty.add(sid);flagDirty();window.ComposerUX?.status('saving');message('Saving…');
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveTimer=null;save().catch(error=>message(error.message,true))},500);
}

let saving=null;
async function save(){if(saving)return saving;saving=savePending();try{return await saving}finally{saving=null}}
async function savePending(){
 const pending=[...dirty];if(!pending.length)return;
 for(const sid of pending){
  const payload={source:sid,engine:engineId(),events:events(sid).map(e=>({id:e.id,volume_db:e.volume_db===null||e.volume_db===undefined?null:Number(e.volume_db),pitch_jitter:Number(e.pitch_jitter||0),...('prompt' in e?{prompt:e.prompt}:{}),takes:e.takes.map(t=>({enabled:t.enabled!==false}))}))};
  const submitted=JSON.stringify(events(sid));
  await request('studio/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(JSON.stringify(events(sid))===submitted)dirty.delete(sid);
 }
 flagDirty();
 if(dirty.size){await savePending();return}
 if(window.ComposerDraftEditors?.enabled){message('Saved to private draft. Use Send changes to send it to Admin.');return}
 message('Saved'+(isGame()&&pending.includes(targetId())?'. Rebuild web-dev to hear it in the game.':'.'));
}



// Everything in the shown manifest goes back to the sounds it shipped with.
async function restore(){
 clearTimeout(saveTimer);saveTimer=null;dirty.clear();flagDirty();
 const sid=group==='scene'?targetId():KIT,what=sid===KIT?'the interface events':'the scene sounds of '+window.ComposerTarget.entry().title;
 if(!confirm('Reset '+what+' to default? Every choice, level and pitch in this manifest goes back to what it shipped with.'))return;
 await request('studio/restore?source='+encodeURIComponent(sid)+'&engine='+encodeURIComponent(engineId()),{method:'POST'});
 await load(true);
 message('Reset to default'+(sid===KIT?'.':'. Rebuild web-dev to hear it in the game.'));
}

async function addTake(sid,eventIndex,file){
 clearTimeout(saveTimer);saveTimer=null;await save();
 const event=eventAt(sid,eventIndex);
 message('Uploading '+file.name+'…');
 await request('studio/upload?source='+encodeURIComponent(sid)+'&engine='+encodeURIComponent(engineId())+'&event='+encodeURIComponent(event.id)+'&take='+event.takes.length,{method:'POST',headers:{'X-File-Name':encodeURIComponent(file.name),'Content-Type':'application/octet-stream'},body:file});
 await load(true);
 message('Added a sound for '+event.id+(sid!==KIT?'. Rebuild web-dev so Godot imports it.':'.'));
}

controls.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.group){group=button.dataset.group;stop();render();return}
 if(button.id==='sound-refresh')load().then(()=>message('Manifests reloaded.'));
 if(button.id==='sound-reset')restore().catch(error=>message(error.message,true));
});

report.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 const card=button.closest('[data-event]');
 const sid=card?card.dataset.source:null,index=card?Number(card.dataset.event):-1;
 const sound=card?eventAt(sid,index):null;
 if(!sound)return;
 if(button.dataset.takePlay!==undefined){
  if(button===playingButton)return stop();
  const t=Number(button.dataset.takePlay);
  if(t<0){const base=events(sid).find(e=>e.id===sound.fallback);const at=base?base.takes.findIndex(x=>x.enabled!==false):-1;if(base)play(base,at<0?0:at,sid,button,sound)}
  else play(sound,t,sid,button)}
 if('copy' in button.dataset)navigator.clipboard?.writeText(sound.prompt||'').then(()=>message('Prompt copied.'),()=>message('Copy failed.',true));
});

report.addEventListener('input',event=>{
 const input=event.target;const card=input.closest('[data-event]');if(!card)return;
 const sid=card.dataset.source,sound=eventAt(sid,Number(card.dataset.event));
 if('volume' in input.dataset){sound.volume_db=Number(input.value);input.nextElementSibling.textContent=sound.volume_db.toFixed(1)+' dB';markDirty(sid)}
 if('jitter' in input.dataset){sound.pitch_jitter=Number(input.value);input.nextElementSibling.textContent='±'+Math.round(sound.pitch_jitter*100)+'%';markDirty(sid)}
 if('prompt' in input.dataset){sound.prompt=input.value;markDirty(sid)}
});

report.addEventListener('change',event=>{
 const input=event.target;const card=input.closest('[data-event]');if(!card)return;
 const sid=card.dataset.source,index=Number(card.dataset.event),sound=eventAt(sid,index);
 if(input.dataset.takeChoice!==undefined&&input.checked){const pick=Number(input.dataset.takeChoice);sound.takes.forEach((take,i)=>{take.enabled=i===pick});render();markDirty(sid)}
 if('takeAdd' in input.dataset&&input.files[0])addTake(sid,index,input.files[0]).catch(error=>message(error.message,true));
});

window.addEventListener('composer-workspace',event=>{
 if(event.detail!=='sound'){stop();return}
 if(!loaded||!dirty.size){loaded=true;load()}
});
// Switching the game switches the scene half; the dirty guard below already asked about unsaved work.
window.addEventListener('composer-target',()=>{if(!loaded)return;stop();adopt();render();message('')});
// target.js refreshes the catalog on focus and after a rebuild; a clean draft follows it.
window.addEventListener('composer-catalog',()=>{if(loaded&&!dirty.size){adopt();render()}});
// Edits save themselves, so leaving only has to flush what is still waiting.
window.ComposerTarget.guard(()=>{
 if(dirty.size){clearTimeout(saveTimer);saveTimer=null;save().catch(error=>message(error.message,true));message('Wait for saving to finish before switching games.');return false}
 return true;
});
window.addEventListener('beforeunload',event=>{if(dirty.size){event.preventDefault();event.returnValue=''}});
})();
