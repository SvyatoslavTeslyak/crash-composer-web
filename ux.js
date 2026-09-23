/* Shared workspace feedback. Status never substitutes for server permissions. */
(()=>{
 const $=s=>document.querySelector(s),set=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
 const state={phase:'',error:'',lastSaved:null},names={layout:'Game',look:'Design',library:'Assets',sound:'Sounds',translates:'Texts',math:'Math Lab'};
 const dirty=()=>!!window.ComposerLook?.dirty||!!$('.workspace-dirty');
 window.ComposerUX={dirty,status(phase,error=''){state.phase=phase;state.error=error;update()},published:null};
 const nav=$('.workspace-rail'),toggle=document.createElement('button');toggle.className='wb-button';toggle.id='navigation-toggle';toggle.type='button';toggle.textContent='☰';toggle.setAttribute('aria-label','Show navigation labels');nav.prepend(toggle);
 const navOpen=value=>{document.body.classList.toggle('navigation-expanded',value);toggle.setAttribute('aria-expanded',String(value));toggle.setAttribute('aria-label',value?'Hide navigation labels':'Show navigation labels');try{localStorage.setItem('composer-navigation-expanded',String(value))}catch{}};
 toggle.onclick=()=>navOpen(!document.body.classList.contains('navigation-expanded'));
 try{navOpen(localStorage.getItem('composer-navigation-expanded')==='true')}catch{}
 for(const [id,title] of Object.entries(names)){const b=$('#'+id+'-tab');b.setAttribute('aria-label',title);set(b.querySelector('.rail-tooltip'),title);const label=document.createElement('span');label.className='navigation-label';label.textContent=title;b.append(label)}
 const bar=document.createElement('div');bar.className='workspace-context';bar.innerHTML='<span id="preview-context"></span><span id="save-context" role="status" aria-live="polite"></span><a id="published-preview" target="_blank" rel="noopener">Open published version ↗</a>';
 $('#room').prepend(bar);
 const about=document.createElement('button');about.type='button';about.textContent='About Composer';$('#workspace-account-menu').append(about);
 const aboutDialog=document.createElement('dialog');aboutDialog.className='share-dialog';aboutDialog.innerHTML='<header><h2>About Composer</h2><button class="wb-button" data-close aria-label="Close">✕</button></header><p id="composer-version"></p><p>UI kit: '+($('#kit-updated')?.textContent||'')+'</p>';document.body.append(aboutDialog);aboutDialog.querySelector('[data-close]').onclick=()=>aboutDialog.close();about.onclick=()=>aboutDialog.showModal();$('#kit-updated').hidden=true;
 let runningVersion=$('meta[name=composer-version]')?.content||null;
 async function checkUpdate(){try{const r=await fetch('composer-version.json',{cache:'no-store'});if(!r.ok)return;const v=await r.json();set($('#composer-version'),'Version '+(runningVersion||v.version));if(!runningVersion){runningVersion=v.version;return}if(v.version!==runningVersion)$('#composer-update').hidden=false}catch{}}
 const updateBar=document.createElement('div');updateBar.id='composer-update';updateBar.hidden=true;updateBar.innerHTML='<span>Composer update available</span><button class="wb-button">Reload</button>';$('.appbar').after(updateBar);
 updateBar.querySelector('button').onclick=()=>{if(state.phase==='saving'){updateBar.querySelector('span').textContent='Wait for saving to finish before reloading.';return}if(dirty()&&!confirm('Reload Composer and discard unsaved edits? Saved drafts will remain.'))return;location.reload()};
 function update(){
  const mode=Object.keys(names).find(k=>$('#'+k+'-tab').getAttribute('aria-pressed')==='true')||'layout';set($('#workspace-title'),names[mode]);
  const title=window.ComposerTarget?.entry()?.title||'Select game';
  const contexts={layout:'Game preview · current build + temporary controls',look:'Draft preview · design edits shown before publication',translates:'Draft preview · text edits shown before publication',sound:'Sound audition · saved draft; game audio updates after publication',math:'Simulation only · local experiment; not part of publication',library:'Asset library · choose resources for the selected game'};
  set($('#preview-context'),title+' · '+contexts[mode]);
  const notes={look:'Design: use Save',translates:'Texts: save each edited text',sound:'Sounds: autosave'};
  const saving=state.phase==='saving',unsaved=dirty();
  set($('#save-context'),state.error?'Could not save · '+state.error:saving?'Saving…':unsaved?'Unsaved changes'+(notes[mode]?' · '+notes[mode]:''):state.lastSaved?'Saved · '+state.lastSaved.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):notes[mode]||'');
  $('#save-context').dataset.state=state.error?'error':saving?'saving':unsaved?'unsaved':'saved';
  const id=window.ComposerTarget?.value;$('#published-preview').hidden=!id||id==='kit';if(id&&id!=='kit')$('#published-preview').href='https://svyatoslavteslyak.github.io/crash-showcase/games/'+encodeURIComponent(id)+'/index.html?lang='+$('#language').value;
 }
 window.addEventListener('composer-draft-saved',()=>{state.phase='saved';state.error='';state.lastSaved=new Date();update()});
 document.addEventListener('input',()=>{if(state.error){state.error='';state.phase=''}setTimeout(update,0)});
 window.addEventListener('composer-workspace',()=>setTimeout(update,0));window.addEventListener('composer-target',()=>{state.phase='';state.error='';state.lastSaved=null;update()});
 window.addEventListener('beforeunload',e=>{if(dirty()||state.phase==='saving'){e.preventDefault();e.returnValue=''}});
 setInterval(update,1000);update();checkUpdate();setInterval(checkUpdate,60000);window.addEventListener('focus',checkUpdate);
})();
