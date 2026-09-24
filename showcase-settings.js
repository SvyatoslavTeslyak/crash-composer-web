// Catalog visibility is separate from Composer permissions and direct game URLs.
(()=>{
const $=s=>document.querySelector(s),button=document.createElement('button');
button.id='workspace-settings';button.type='button';button.textContent='Showcase';button.hidden=true;
$('#workspace-settings-menu').append(button);
const dialog=document.createElement('dialog');dialog.className='share-dialog';dialog.setAttribute('aria-labelledby','showcase-settings-title');
dialog.innerHTML='<header><h2 id="showcase-settings-title">Settings · Showcase</h2><button type="button" class="wb-button" data-close aria-label="Close settings">✕</button></header><p>Choose which games appear in the public Showcase. Composer access stays unchanged.</p><form><fieldset style="border:0;padding:0;margin:0"><legend id="showcase-visible-count"></legend><div id="showcase-games"></div></fieldset><p class="share-note">Hidden games remain available through direct links and embeds.</p><p id="showcase-settings-help" class="share-note"></p><footer><button type="submit" class="wb-button" id="showcase-settings-save">Save settings</button></footer></form><p role="status" aria-live="polite"></p>';
document.body.append(dialog);
let revision=0,busy=false;
const local=()=>!window.ComposerHosting&&['127.0.0.1','localhost'].includes(location.hostname);
const inputs=()=>[...dialog.querySelectorAll('input[type=checkbox]')];
const status=text=>dialog.querySelector('[role=status]').textContent=text;
const count=()=>$('#showcase-visible-count').textContent=inputs().filter(n=>n.checked).length+' of '+inputs().length+' games visible';
const wrap=$('#workspace-settings-wrap'),toggle=$('#workspace-settings-toggle'),menu=$('#workspace-settings-menu');
const close=(focus=false)=>{menu.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus()};
const sync=()=>{const auth=window.ComposerAuth;button.hidden=auth?.member?.role!=='admin';wrap.hidden=button.hidden&&!auth.has('roles.manage')&&!auth.has('users.manage')&&!auth.has('users.invite');if(wrap.hidden)close()};
toggle.onclick=()=>{const opening=menu.hidden;$('#workspace-account-menu').hidden=true;$('#workspace-avatar').setAttribute('aria-expanded','false');menu.hidden=!opening;toggle.setAttribute('aria-expanded',String(opening));if(opening)menu.querySelector('button:not([hidden])')?.focus()};
document.addEventListener('click',e=>{if(!wrap.contains(e.target))close()});
wrap.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget))close()});
wrap.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true)}});
button.onclick=async()=>{
 close();dialog.showModal();status('Loading…');$('#showcase-settings-save').disabled=true;
 $('#showcase-games').replaceChildren();
 try{
  const response=await fetch('showcase-settings.json',{cache:'no-store'});if(!response.ok)throw Error('Could not load Showcase settings.');const data=await response.json();revision=data.revision;
  for(const game of window.ComposerTarget.targets.filter(g=>g.live)){
   const label=document.createElement('label');label.className='switch';label.style.cssText='display:flex;align-items:center;gap:12px;min-height:44px;margin:8px 0';
   const input=document.createElement('input');input.type='checkbox';input.value=game.id;input.checked=data.visible_games.includes(game.id);input.disabled=!local();input.onchange=count;label.append(input,document.createTextNode(game.title));$('#showcase-games').append(label);
  }
  count();$('#showcase-settings-save').hidden=!local();$('#showcase-settings-save').disabled=!local();
  $('#showcase-settings-help').textContent=local()?'Save locally, then commit and push showcase-settings.json to publish.':'To change this list, open local Composer and sign in as Admin. Changes appear here after publication.';status('');
 }catch(error){status(error.message)}
};
dialog.querySelector('[data-close]').onclick=()=>{if(!busy)dialog.close()};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
dialog.querySelector('form').onsubmit=async e=>{
 e.preventDefault();if(busy||!local())return;busy=true;$('#showcase-settings-save').disabled=true;
 const visible_games=inputs().filter(n=>n.checked).map(n=>n.value);inputs().forEach(n=>n.disabled=true);
 try{const response=await fetch('settings/showcase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,visible_games})});const data=await response.json();if(!response.ok)throw Error(data.message||'Could not save settings.');revision=data.revision;status('Saved locally. Commit and push showcase-settings.json to update Showcase.');}
 catch(error){status(error.message)}finally{busy=false;$('#showcase-settings-save').disabled=false;inputs().forEach(n=>n.disabled=false)}
};
window.ComposerAuth.ready.then(sync);document.addEventListener('composer-permissions',sync);
})();
