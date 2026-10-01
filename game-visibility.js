// Settings → Games in Composer: each person picks which games their own lists show. Hiding is a
// view choice, not access: roles still decide what someone may open, and Showcase is separate.
// The list is kept in the account's metadata, so it follows the person between the local and the
// hosted Composer without a table of its own.
(()=>{
const $=s=>document.querySelector(s),button=document.createElement('button');
button.id='workspace-games';button.type='button';button.textContent='Games in Composer';button.hidden=true;
$('#workspace-settings-menu').prepend(button);
const dialog=document.createElement('dialog');dialog.className='share-dialog';dialog.setAttribute('aria-labelledby','game-visibility-title');
dialog.innerHTML='<header><h2 id="game-visibility-title">Settings · Games in Composer</h2><button type="button" class="wb-button" data-close aria-label="Close settings">✕</button></header><p>Choose which games your game list shows. Only your own list changes; colleagues and the Showcase are not affected.</p><form><fieldset style="border:0;padding:0;margin:0"><legend id="game-visibility-count"></legend><div id="game-visibility-games"></div></fieldset><p class="share-note">A hidden game you have open stays until you switch to another one.</p><footer><button type="submit" class="wb-button" id="game-visibility-save">Save settings</button></footer></form><p role="status" aria-live="polite"></p>';
document.body.append(dialog);
let busy=false;
const inputs=()=>[...dialog.querySelectorAll('input[type=checkbox]')];
const status=text=>dialog.querySelector('[role=status]').textContent=text;
const count=()=>$('#game-visibility-count').textContent=inputs().filter(n=>n.checked).length+' of '+inputs().length+' games shown';
const sync=()=>{button.hidden=!window.ComposerAuth?.member};
button.onclick=()=>{
 $('#workspace-settings-menu').hidden=true;$('#workspace-settings-toggle').setAttribute('aria-expanded','false');
 const T=window.ComposerTarget,hidden=T.hidden;
 $('#game-visibility-games').replaceChildren(...T.targets.filter(g=>g.live&&window.ComposerAuth.canRead(g.id)).map(game=>{
  const label=document.createElement('label');label.className='switch';label.style.cssText='display:flex;align-items:center;gap:12px;min-height:44px;margin:8px 0';
  const input=document.createElement('input');input.type='checkbox';input.value=game.id;input.checked=!hidden.includes(game.id);input.onchange=count;
  const icon=document.createElement('img');icon.src='icons/'+game.id+'.png';icon.alt='';icon.width=28;icon.height=28;icon.style.borderRadius='7px';
  label.append(input,icon,document.createTextNode(game.title));return label;
 }));
 count();status('');dialog.showModal();
};
dialog.querySelector('[data-close]').onclick=()=>{if(!busy)dialog.close()};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
dialog.querySelector('form').onsubmit=async e=>{
 e.preventDefault();if(busy)return;busy=true;$('#game-visibility-save').disabled=true;
 // Games this person cannot read are not in the form; a choice saved for them earlier is kept.
 const offered=inputs().map(n=>n.value),hidden=[...window.ComposerTarget.hidden.filter(id=>!offered.includes(id)),...inputs().filter(n=>!n.checked).map(n=>n.value)];
 inputs().forEach(n=>n.disabled=true);
 try{
  const client=window.ComposerAuth.client;if(!client)throw Error('Sign in to Composer to change your game list.');
  const {error}=await client.auth.updateUser({data:{composer_hidden_games:hidden}});if(error)throw Error(error.message||'Could not save settings.');
  window.ComposerTarget.setHidden(hidden);
  const shown=offered.length-inputs().filter(n=>!n.checked).length;status('Saved. Your list now shows '+shown+' '+(shown===1?'game':'games')+'.');
 }catch(error){status(error.message)}finally{busy=false;$('#game-visibility-save').disabled=false;inputs().forEach(n=>n.disabled=false)}
};
window.ComposerAuth.ready.then(sync);document.addEventListener('composer-permissions',sync);
})();
