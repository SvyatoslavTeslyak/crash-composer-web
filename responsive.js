/* Narrow workspaces use a single content view and an on-demand controls sheet. */
(()=>{
 const $=s=>document.querySelector(s),media=matchMedia('(max-width: 1000px)'),side=$('#side'),room=$('#room');
 const bar=document.createElement('div');bar.id='mobile-workspace';bar.innerHTML='<button type="button" class="wb-button" id="mobile-controls" aria-controls="side" aria-expanded="false">Controls</button><div role="group" aria-label="Workspace view"><button type="button" class="wb-button" data-mobile-view="editor" aria-pressed="true">Editor</button><button type="button" class="wb-button" data-mobile-view="preview" aria-pressed="false">Preview</button></div>';
 room.before(bar);
 const backdrop=document.createElement('button');backdrop.id='mobile-backdrop';backdrop.type='button';backdrop.setAttribute('aria-label','Close controls');backdrop.hidden=true;document.body.append(backdrop);
 const close=document.createElement('button');close.id='mobile-controls-close';close.type='button';close.className='wb-button';close.textContent='Done';side.prepend(close);
 let mode='layout',view='editor',returnFocus=null,editorScroll=0;
 const currentMode=()=>['layout','look','library','sound','translates','math'].find(id=>$('#'+id+'-tab')?.getAttribute('aria-pressed')==='true')||'layout';
 function sheet(open){
  open=open&&media.matches;document.body.classList.toggle('mobile-controls-open',open);backdrop.hidden=!open;$('#mobile-controls').setAttribute('aria-expanded',String(open));side.inert=media.matches&&!open;
  for(const node of [room,bar,$('.appbar'),$('.workspace-rail')])node.inert=open;
  if(open){returnFocus=document.activeElement;side.setAttribute('role','dialog');side.setAttribute('aria-modal','true');close.focus()}
  else{side.removeAttribute('role');side.removeAttribute('aria-modal');if(returnFocus?.isConnected){returnFocus.focus({preventScroll:true});returnFocus=null}}
 }
 function paint(){
  mode=currentMode();document.body.dataset.mobileMode=mode;document.body.dataset.mobileView=view;
  bar.querySelector('[role=group]').hidden=mode!=='translates';
  $('#mobile-controls').textContent=mode==='translates'?'Filters':mode==='look'?'Edit brand':mode==='library'?'Library sections':mode==='sound'?'Sound filters':'Game controls';
  for(const b of bar.querySelectorAll('[data-mobile-view]'))b.setAttribute('aria-pressed',String(b.dataset.mobileView===view));
  side.inert=media.matches&&!document.body.classList.contains('mobile-controls-open');
 }
 $('#mobile-controls').onclick=()=>sheet(true);close.onclick=()=>sheet(false);backdrop.onclick=()=>sheet(false);
 function setView(next){if(view==='editor')editorScroll=room.scrollTop;view=next;paint();if(next==='editor')requestAnimationFrame(()=>{room.scrollTop=editorScroll})}
 for(const b of bar.querySelectorAll('[data-mobile-view]'))b.onclick=()=>setView(b.dataset.mobileView);
 document.addEventListener('click',e=>{if(e.target.closest('[data-mobile-show-game]')){const row=e.target.closest('.translation-row');row?.click();setView('preview');$('#mobile-workspace [data-mobile-view=editor]').focus({preventScroll:true})}});
 side.addEventListener('click',e=>{if(media.matches&&mode==='translates'&&e.target.closest('[data-section]:not([data-section=all])')){sheet(false);setView('preview')}});
 document.addEventListener('keydown',e=>{
  if(!document.body.classList.contains('mobile-controls-open')||document.querySelector('dialog[open]'))return;
  if(e.key==='Escape'){e.preventDefault();sheet(false)}
  if(e.key==='Tab'){const nodes=[...side.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
 });
 window.addEventListener('composer-workspace',()=>{sheet(false);view='editor';editorScroll=0;paint()});
 media.addEventListener('change',()=>{sheet(false);paint()});
 const viewport=()=>document.documentElement.style.setProperty('--composer-viewport-height',(window.visualViewport?.height||innerHeight)+'px');
 window.visualViewport?.addEventListener('resize',viewport);viewport();paint();
})();
