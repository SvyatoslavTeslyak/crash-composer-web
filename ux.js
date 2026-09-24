/* Shared workspace feedback. Status never substitutes for server permissions. */
(()=>{
 const $=s=>document.querySelector(s),set=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
 const state={phase:'',error:'',lastSaved:null},names={layout:'Game',look:'Design',library:'Assets',sound:'Sounds',translates:'Texts',math:'Math Lab'};
 const dirty=()=>!!window.ComposerLook?.dirty||!!$('.workspace-dirty');
 window.ComposerUX={dirty,refresh:update,status(phase,error=''){state.phase=phase;state.error=error;update()},published:null};
 $('#kit-updated').hidden=true;
 let runningVersion=$('meta[name=composer-version]')?.content||null;
 async function checkUpdate(){try{const r=await fetch('composer-version.json',{cache:'no-store'});if(!r.ok)return;const v=await r.json();if(!runningVersion){runningVersion=v.version;return}if(v.version!==runningVersion)$('#composer-update').hidden=false}catch{}}
 const updateBar=document.createElement('div');updateBar.id='composer-update';updateBar.hidden=true;updateBar.innerHTML='<span>Composer update available</span><button class="wb-button">Reload</button>';$('.appbar').after(updateBar);
 updateBar.querySelector('button').onclick=()=>{if(state.phase==='saving'){updateBar.querySelector('span').textContent='Wait for saving to finish before reloading.';return}if(dirty()&&!confirm('Reload Composer and discard unsaved edits? Saved drafts will remain.'))return;location.reload()};
 function update(){
  const mode=Object.keys(names).find(k=>$('#'+k+'-tab').getAttribute('aria-pressed')==='true')||'layout';set($('#workspace-title'),names[mode]);
  const button=$('#cloud-configurations');if(!$('#save-context')){const status=document.createElement('span');status.id='save-context';status.setAttribute('role','status');status.setAttribute('aria-live','polite');button.append(status)}
  const saving=state.phase==='saving',unsaved=dirty();
  const text=state.error?'Save failed':saving?'Saving…':unsaved?'Unsaved':state.lastSaved?'Saved':'';
  set($('#save-context'),text);$('#save-context').hidden=!text;$('#save-context').title=state.error||'';
  $('#save-context').dataset.state=state.error?'error':saving?'saving':unsaved?'unsaved':'saved';

 }
 window.addEventListener('composer-draft-saved',()=>{state.phase='saved';state.error='';state.lastSaved=new Date();update()});
 document.addEventListener('input',()=>{if(state.error){state.error='';state.phase=''}setTimeout(update,0)});
 window.addEventListener('composer-workspace',()=>setTimeout(update,0));window.addEventListener('composer-target',()=>{state.phase='';state.error='';state.lastSaved=null;update()});
 window.addEventListener('beforeunload',e=>{if(dirty()||state.phase==='saving'){e.preventDefault();e.returnValue=''}});
 setInterval(update,1000);update();checkUpdate();setInterval(checkUpdate,60000);window.addEventListener('focus',checkUpdate);
})();
