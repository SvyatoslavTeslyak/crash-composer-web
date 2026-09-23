await window.ComposerAuth.ready;
const auth=window.ComposerAuth;
if(document.querySelector('#access-root[data-page=people]')){
 const dialog=document.createElement('dialog');dialog.className='share-dialog';dialog.setAttribute('aria-labelledby','invite-title');
 dialog.innerHTML=`<header><div><small>TEAM</small><h2 id="invite-title">Invite people</h2></div><button type="button" class="wb-button" data-close aria-label="Close">✕</button></header>
 <p>Create a one-time invitation. The person chooses their own password, then signs in with email and password.</p>
 <form id="invite-form">
 <label>Email<input name="email" type="email" autocomplete="off" required></label>
 <label>Access<select name="role"></select></label>
 <fieldset><legend>Games</legend><div id="invite-games"></div></fieldset>
 <label>Composer address<input name="workspace" type="url" required aria-describedby="invite-address-note"></label>
 <p id="invite-address-note" class="share-note"></p>
 <button class="wb-button" type="submit">Create invite link</button>
 </form>
 <p id="invite-status" role="status" aria-live="polite"></p>
 <div id="invite-result" hidden><label>Invitation link<input id="invite-link" readonly></label><button type="button" id="invite-copy" class="wb-button">Copy link</button><p class="share-note">Send this private link to the invited person. It works once and expires according to your Supabase invitation settings. To replace an expired, unaccepted invite, create another for the same email. No email is sent automatically.</p></div>`;
 document.body.append(dialog);
 const form=dialog.querySelector('form'),status=dialog.querySelector('#invite-status'),result=dialog.querySelector('#invite-result'),link=dialog.querySelector('#invite-link'),submit=form.querySelector('[type=submit]');
 let busy=false;
 const reset=()=>{result.hidden=true;link.value='';status.textContent=''};
 form.elements.workspace.value=new URL('login.html',window.ComposerCloudConfig?.workspaceUrl||location.href).href;
 const addressNote=()=>{let host='';try{host=new URL(form.elements.workspace.value).hostname}catch{}
 dialog.querySelector('#invite-address-note').textContent=['localhost','127.0.0.1','[::1]'].includes(host)?'This address only works on this computer. For someone elsewhere, use a hosted Composer address they can open.':'Use the Composer address the invited person can open.'};
 addressNote();form.elements.workspace.addEventListener('input',addressNote);
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',reset);
 async function openInvite(prefill=null){
  if(!auth.has('users.invite'))return;reset();form.elements.email.value=prefill?.email||'';const menu=document.querySelector('#workspace-account-menu');if(menu)menu.hidden=true;document.querySelector('#workspace-avatar')?.setAttribute('aria-expanded','false');dialog.showModal();
  const container=dialog.querySelector('#invite-games');container.replaceChildren();submit.disabled=true;
  const {data:roles,error:roleError}=await auth.client.from('composer_roles').select('id,name,permissions').order('name');if(roleError){status.textContent=roleError.message;return}
  form.elements.role.replaceChildren(...roles.filter(role=>role.id!=='admin'&&(auth.member.role==='admin'||role.permissions.every(p=>auth.has(p)))).map(role=>new Option(role.name,role.id)));
  if(roles.some(role=>role.id===(prefill?.role||'art_director')))form.elements.role.value=prefill?.role||'art_director';
  const {data,error}=await auth.client.from('composer_games').select('id,title').order('title');
  if(error){status.textContent=error.message;return}
  for(const game of data){const label=document.createElement('label'),checkbox=document.createElement('input');label.className='visibility-option';checkbox.type='checkbox';checkbox.name='games';checkbox.value=game.id;checkbox.checked=prefill?prefill.games.includes(game.id):game.id===window.ComposerTarget?.value;label.append(checkbox,document.createTextNode(game.title));container.append(label)}
  submit.disabled=busy;
 }
 document.addEventListener('composer-open-invite',event=>openInvite(event.detail));
 form.addEventListener('input',()=>{if(!busy)reset()});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;reset();
  const fields=new FormData(form),games=fields.getAll('games');if(!games.length){status.textContent='Select at least one game.';return}
  let destination;try{destination=new URL(fields.get('workspace'));if(destination.username||destination.password||!['https:','http:'].includes(destination.protocol)||(destination.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(destination.hostname)))throw Error();destination=new URL('login.html',destination.href.endsWith('/')||destination.pathname.endsWith('.html')?destination.href:destination.href+'/');destination.search='';destination.hash=''}catch{status.textContent='Use an HTTPS Composer address, or localhost for testing.';return}
  busy=true;submit.disabled=true;submit.textContent='Creating invitation…';
  try{
   const {data,error}=await auth.client.functions.invoke('composer-invite',{body:{email:fields.get('email'),role:fields.get('role'),games}});
   if(error){let detail;try{detail=await error.context?.json()}catch{}throw Error(detail?.error||error.message||'Invitation service is unavailable.')}
   if(!data?.token_hash)throw Error(data?.error||'Invitation service did not return a link.');
   destination.hash=new URLSearchParams({invite_token:data.token_hash}).toString();link.value=destination.href;result.hidden=false;status.textContent='Invitation created for '+data.email+'. Copy the link and share it privately.';document.dispatchEvent(new Event('composer-invited'));
  }catch(error){status.textContent=error.message}
  finally{busy=false;submit.disabled=false;submit.textContent='Create invite link'}
 });
 dialog.querySelector('#invite-copy').onclick=async()=>{try{await navigator.clipboard.writeText(link.value);status.textContent='Invitation link copied.'}catch{link.focus();link.select();status.textContent='Select and copy the invitation link.'}};
}
