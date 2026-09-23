// Inspector integration stays outside the shipped game UI.
(()=>{
 const status=document.querySelector('#live-status');
 // The game is global (target.js); the stage runs its web build. The shared kit has no build
 // of its own, so that one target — and only that one — falls back to the demo data.
 const game=()=>window.ComposerTarget.value,playable=()=>window.ComposerTarget.entry().live;
 // Each engine has its own build of the same game, mounted side by side by preview.py.
 const engine=()=>window.ComposerTarget.engine;
 let timer,generation=0;
 const applied={};
 const presetSelect=document.querySelector('#presentation-preset');
 const presetTags=document.querySelector('#navigation-presets');
 function syncPresetTags(){
  const options=Array.from(presetSelect.options);
  for(const button of presetTags.children)if(!options.some(o=>o.value===button.dataset.preset))button.remove();
  for(const option of options){
   let button=Array.from(presetTags.children).find(b=>b.dataset.preset===option.value);
   if(!button){button=document.createElement('button');button.type='button';button.className='wb-button';button.dataset.preset=option.value;button.onclick=()=>{presetSelect.value=button.dataset.preset;presetSelect.dispatchEvent(new Event('change'));syncPresetTags()};presetTags.append(button)}
   button.textContent=option.textContent;button.disabled=presetSelect.disabled||option.disabled;button.setAttribute('aria-pressed',String(option.value===presetSelect.value));
  }
 }
 new MutationObserver(syncPresetTags).observe(presetSelect,{childList:true,attributes:true,subtree:true});
 const nativePresets=new WeakMap();
 const amountPresets=document.querySelector('[data-feature=presets]');
 let amountOverride=null;
 function syncInspector(){
  const road=game()==='road';
  const modalSelect=document.querySelector('#modal'),selected=modalSelect.value;
  const modalOptions=road?[['','No modal'],['menu','Settings'],['account','Account'],['rules','How to play'],['topbets','Top bets'],['mybets','My bets']]:[['','No modal'],['difficulty','Difficulty'],['menu','Settings / Auto'],['account','Account'],['wins','All wins'],['win','Win']];
  if(modalSelect.dataset.game!==game()){
   modalSelect.replaceChildren(...modalOptions.map(([value,label])=>new Option(label,value)));modalSelect.dataset.game=game();modalSelect.value=modalOptions.some(([value])=>value===selected)?selected:'';
  }
  const winOption=modalSelect.querySelector('[value=win]');if(winOption)winOption.disabled=live();
  const standard=presetSelect.querySelector('[value=standard]');
  if(road){standard?.remove();if(presetSelect.value!=='menu-drawer-v1')presetSelect.value='tabbed-shell-v1'}
  else if(!standard){const option=document.createElement('option');option.value='standard';option.textContent='Game default';presetSelect.prepend(option);presetSelect.value=savedPreset()}
  const shell=['tabbed-shell-v1','menu-drawer-v1'].includes(presetSelect.value);
  const noAmountPresets=(road&&engine()==='pixi')||document.querySelector('#control-variant').value==='tabbed';
  document.querySelectorAll('[data-visibility-heading]').forEach(n=>n.hidden=shell&&(n.dataset.visibilityHeading!=='features'||noAmountPresets));
  document.querySelectorAll('.visibility-option').forEach(label=>{
   const input=label.querySelector('input');
   label.hidden=(input===amountPresets&&noAmountPresets)||(shell&&input!==amountPresets)||(input.dataset.flag==='multiplier_ladder'&&game()!=='market_stack')||(live()&&game()==='catch'&&!!input.dataset.feature)||(live()&&game()==='market_stack'&&['auto','difficulty'].includes(input.dataset.feature));
  });
  if(amountOverride===null)amountPresets.checked=frame.clientWidth>=600;
  syncPresetTags();
 }
 new ResizeObserver(()=>{syncInspector();if(!live())sendFeatures()}).observe(frame);

 const presetKey=()=> 'crash-composer-presentation:'+engine()+':'+game();
 const savedPreset=()=>{try{const saved=localStorage.getItem(presetKey());if(['tabbed-shell-v1','menu-drawer-v1'].includes(saved))return saved}catch{}return game()==='road'?'tabbed-shell-v1':'standard'};
 function applyPresentation(){
  syncInspector();
  if(!live()){demo({presentationPreset:presetSelect.value});return true}
  const ui=instance();if(!ui?.setPresentationPreset)return false;
  if(!nativePresets.has(ui))nativePresets.set(ui,ui.config.presentationPreset||'standard');
  ui.setPresentationPreset(presetSelect.value==='standard'?nativePresets.get(ui):presetSelect.value);
  return true;
 }

 // A real round in progress, as opposed to a game that is unloaded or still booting.
 const inRound=()=>{const s=instance()?.state;if(s?.game==='catch')return s.phase!=='betting'||Object.values(s.bets||{}).some(v=>v>0);return !!s?.game&&(!s.canBet||!s.canGo||!!s.auto||!!s.win)};
 const live=()=>playable();
 const instance=()=>frame.contentWindow.CrashUI?.instance;
 const demo=data=>frame.contentWindow.postMessage({type:'crash-preview',...data},location.origin);
 // Live games read features at startup, exactly like an operator iframe URL.
 // Leave preset amounts to the shared responsive default until explicitly toggled:
 // hidden on phones, visible on larger screens. Only an override adds presets=0/1.
 const featureQuery=()=>[...document.querySelectorAll('[data-feature]')].filter(n=>n!==amountPresets||amountOverride!==null).map(n=>'&'+n.dataset.feature+'='+(n.checked?'1':'0')).join('');
 function flags(){if(!live()){sendFlags();return}const ui=instance();if(ui)document.querySelectorAll('[data-flag]').forEach(n=>ui.send('flag',{key:n.dataset.flag,value:n.checked}))}
 function modal(){const kind=document.querySelector('#modal').value;if(!TranslationTable.windowAllowed(game(),kind))return;if(!live()){demo({modal:kind});return}const ui=instance();if(!ui)return;if(kind){if(game()==='road'&&kind==='rules')ui.rulesFrom='tab';ui.open(kind)}else ui.close()}
 async function load(){
  clearInterval(timer);const request=++generation;
  presetSelect.value=savedPreset();presetSelect.disabled=live();syncInspector();
  document.querySelectorAll('[data-placeholder-only]').forEach(row=>row.hidden=live());

  document.querySelector('#modal').value='';
  if(!live()){
   syncInspector();
   document.querySelector('#modal').closest('label').hidden=false;
   document.querySelector('#control-variant').disabled=false;status.textContent=playable()?'Simulated data · '+window.ComposerTarget.entry().title:'Simulated data · shared UI kit';frame.src='game.html';return
  }
  // Blank the frame first: a Godot export left running would keep its audio going under the next game.
  if(frame.src&&!frame.src.endsWith('about:blank')){frame.src='about:blank';await new Promise(r=>setTimeout(r,60));if(request!==generation)return}
  const off=[...document.querySelectorAll('[data-feature]')].filter(n=>!n.checked).map(n=>n.dataset.feature);status.textContent='Loading local web export'+(off.length?' without '+off.join(', ')+'…':'…');
  const custom=game()==='catch';
  document.querySelector('#control-variant').value=custom?'three-position':game()==='road'&&engine()==='pixi'?'tabbed':'standard';document.querySelector('#control-variant').disabled=true;
  syncInspector();
  document.querySelector('#modal').closest('label').hidden=false;
  const url='games/'+engine()+'/'+game()+'/index.html';
  try{const response=await fetch(url,{method:'HEAD'});if(request!==generation)return;if(!response.ok)throw Error('missing');frame.src=url+'?ui-kit=1&api='+((game()==='road'&&engine()==='pixi'&&window.Lotomobil?.connected&&!applied[game()])?'1':'0')+'&revision='+request+'&build='+encodeURIComponent(window.ComposerHosting?.revision||'local')+featureQuery()+(applied[game()]?'&difficulty=0#math='+encodeURIComponent(JSON.stringify(applied[game()])):'')}
  catch{if(request!==generation)return;frame.src='about:blank';status.textContent='No '+window.ComposerTarget.engineTitle()+' build for this game yet. Build it, then rebuild the preview.'}
 }
 window.ComposerMath={
  apply(key,config){
   if(inRound())throw Error('Finish the current round and turn Auto off before changing mathematics.');
   if(live()&&instance()?.state.game){
    instance().send('preview_lock',{});
    if(!instance().state.previewLocked)throw Error('Game did not confirm an idle round. Finish the round or rebuild its export.');
    frame.inert=true;
   }
   if(config)applied[key]=structuredClone(config);else delete applied[key];
   // Selecting the game reloads through the target listener; reload here when it is already selected.
   if(!window.ComposerTarget.set(key))load();
   document.querySelector('#layout-tab').click();
  }
 };
 // Choosing a game means seeing that game, so Layout follows it to its web build.
 let deferred=false;
 function follow(){
  // A game loading behind a hidden frame costs a Godot boot nobody asked for: wait for Layout.
  if(frame.hidden){deferred=true;return}
  deferred=false;load();
 }
 window.addEventListener('composer-engine',()=>load());
 window.addEventListener('lotomobil-session',()=>{if(game()==='road')load()});
window.addEventListener('composer-target',()=>{amountOverride=null;follow()});
 window.addEventListener('composer-workspace',event=>{
  if(event.detail==='layout'||event.detail==='look'||event.detail==='translates'){if(deferred){deferred=false;load()}return}
  // A Godot export behind a hidden frame keeps running, and keeps playing its audio.
  if(!live()||frame.src.endsWith('about:blank'))return;
  if(inRound()){status.textContent='Round in progress · '+window.ComposerTarget.entry().title+' keeps running in the background.';return}
  clearInterval(timer);frame.src='about:blank';deferred=true;
  status.textContent='Unloaded while you work elsewhere · reloads when you return to Layout.';
 });
 presetSelect.onchange=()=>{
  const note=document.querySelector('#presentation-note');note.hidden=true;note.textContent='';
  if(live()&&instance()?.state.win){presetSelect.value=instance().config.presentationPreset||savedPreset();note.textContent='Wait for the win animation to finish.';note.hidden=false;syncPresetTags();return}
  if(!applyPresentation()){note.textContent='Preview is not ready. Reload the game.';note.hidden=false;return}
  try{localStorage.setItem(presetKey(),presetSelect.value)}catch{}
 };
 document.querySelector('#control-variant').onchange=()=>{syncInspector();demo({controlsVariant:document.querySelector('#control-variant').value})};
 document.querySelector('#modal').onchange=modal;
 document.querySelectorAll('[data-flag]').forEach(n=>n.onchange=flags);
 document.querySelectorAll('[data-feature]').forEach(n=>n.onchange=()=>{if(n===amountPresets)amountOverride=n.checked;return live()?load():sendFeatures()});
 frame.addEventListener('load',()=>{
  frame.inert=false;
  if(!live()){demo({presentationPreset:document.querySelector('#presentation-preset').value,controlsVariant:document.querySelector('#control-variant').value});return;}
  // A PixiJS build makes its canvas from script, so the document has none at load time:
  // what tells us the game is really up is its instance, which the poll below waits for.
  const doc=frame.contentDocument;
  const style=doc.createElement('link');style.rel='stylesheet';style.href=new URL('inspection.css',location.href).href;doc.head.append(style);
  clearInterval(timer);let attempts=0;
  timer=setInterval(()=>{if(instance()?.state.game){clearInterval(timer);flags();presetSelect.disabled=!instance().setPresentationPreset;if(!presetSelect.disabled)applyPresentation();const m=instance().state.mathPreview;status.textContent=instance().state.api?'Live · Runner API'+(instance().state.currency?' · '+instance().state.currency:''):game()==='market_stack'?'Market Stack · skill prototype · demo credits':game()==='catch'?'Catch Clash · separate duel / crash model · test credits':m?.error||(applied[game()]?(m?.version===2&&Object.keys(applied[game()]).every(k=>m.rules?.[k]===applied[game()][k])?'Math preview · applied · test wallet · '+(applied[game()].rtp*100).toFixed(1)+'% target':'Math not acknowledged — rebuild the game export'):'Live preview · '+(m?.sandbox?'isolated test wallet':'source rules'))}else if(++attempts>=600){clearInterval(timer);status.textContent='Game is taking longer to load. Check the web export.'}},100);
 });
 window.addEventListener('DOMContentLoaded',follow);
})();
