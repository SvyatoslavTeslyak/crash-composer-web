await window.ComposerAuth.ready;
const auth=window.ComposerAuth,root=document.querySelector('#access-root');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const check=result=>{if(result.error)throw Error(result.error.message);return result.data};
if(!root){
 for(const [id,tab] of [['workspace-roles','roles'],['workspace-people','people']]){
  const trigger=document.getElementById(id);if(trigger)trigger.onclick=()=>{
   if(!(tab==='roles'?auth.has('roles.manage'):auth.has('users.manage')||auth.has('users.invite')))return;
   sessionStorage.setItem('composer-access-return',location.pathname+location.search+location.hash);
   location.assign(tab+'.html');
  };
 }
}else{
 let roles=[],permissions=[],members=[],games=[],busy=false,editing=false,tab=root.dataset.page==='people'?'people':'roles';
 const canView=()=>tab==='roles'?auth.has('roles.manage'):auth.has('users.manage')||auth.has('users.invite');
 const canEdit=()=>auth.has(tab==='roles'?'roles.manage':'users.manage');
 const memberDialog=document.createElement('dialog');memberDialog.className='share-dialog member-dialog';memberDialog.setAttribute('aria-labelledby','member-title');document.body.append(memberDialog);
 const date=value=>value?new Date(value).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'—';
 const statusNames={pending:'Invite pending',accepted:'Accepted',blocked:'Blocked',removed:'Removed',active:'Active'};
 const status=member=>member.status||(member.active?'active':'blocked');
 let memberSnapshot='';
 const memberValues=()=>{const form=memberDialog.querySelector('form');return form?JSON.stringify([...new FormData(form)]):''};
 const memberDirty=()=>memberDialog.open&&memberValues()!==memberSnapshot;
 const roleDirty=()=>editing&&tab==='roles'&&roles.some(role=>{
  const name=[...root.querySelectorAll('[data-role-name]')].find(i=>i.dataset.roleName===role.id);if(!name||role.id==='admin')return false;
  const values=[...root.querySelectorAll('[data-role]')].filter(i=>i.dataset.role===role.id&&i.checked).map(i=>i.dataset.permission).sort();
  return name.value!==role.name||JSON.stringify(values)!==JSON.stringify([...role.permissions].sort());
 });
 const discard=()=>!roleDirty()||confirm('Discard unsaved role changes?');
 const message=text=>{const box=root.querySelector('#roles-status');if(box)box.textContent=text};
 async function run(fn){if(busy)return;busy=true;root.setAttribute('aria-busy','true');memberDialog.setAttribute('aria-busy','true');try{await fn()}catch(error){const box=memberDialog.open?memberDialog.querySelector('[role=status]'):null;if(box)box.textContent=error.message;else message(error.message)}finally{busy=false;root.removeAttribute('aria-busy');memberDialog.removeAttribute('aria-busy')}}
 async function load(){
  const results=await Promise.all([auth.client.from('composer_roles').select('*').order('created_at'),auth.client.from('composer_permissions').select('*').order('position'),auth.has('users.manage')?auth.client.rpc('composer_list_members'):Promise.resolve({data:[],error:null}),auth.client.from('composer_games').select('id,title').order('title')]);
  [roles,permissions,members,games]=results.map(check);render();
 }
 function save(id,name,values,revision){return auth.client.rpc('composer_save_role',{p_id:id,p_name:name,p_permissions:values,p_revision:revision}).then(check)}
 function matrix(){return `

  ${canEdit()?'<form id="role-create" class="role-create"><label>New role<input name="name" maxlength="60" placeholder="Role name" required></label><button type="submit" class="wb-button">Create role</button></form>':''}
  <div class="permission-table-wrap"><table class="permission-table"><caption class="visually-hidden">Permission matrix</caption><thead><tr><th scope="col">Permission</th>${roles.map(role=>`<th scope="col">${editing===role.id?`<input aria-label="Role name: ${esc(role.name)}" data-role-name="${esc(role.id)}" value="${esc(role.name)}" maxlength="60" ${role.id==='admin'?'disabled':''}>`:`<strong>${esc(role.name)}</strong>`}<small>${members.filter(m=>m.role===role.id).length} users${role.id==='admin'?' · Protected':''}</small></th>`).join('')}</tr></thead>
  <tbody>${permissions.map(permission=>`<tr><th scope="row">${esc(permission.id==='drafts.review'?'Review submitted changes':permission.label)}<small>${esc(permission.section)}${permission.admin_only?' · Admin only':''}</small></th>${roles.map(role=>`<td>${editing===role.id?`<input type="checkbox" aria-label="${esc(role.name)}: ${esc(permission.id==='drafts.review'?'Review submitted changes':permission.label)}" data-role="${esc(role.id)}" data-permission="${esc(permission.id)}" ${role.permissions.includes(permission.id)?'checked':''} ${role.id==='admin'||permission.admin_only?'disabled':''}>`:`<span class="permission-mark ${role.permissions.includes(permission.id)?'allowed':''}" aria-label="${role.permissions.includes(permission.id)?'Allowed':'Not allowed'}">${role.permissions.includes(permission.id)?'✓':'—'}</span>`}</td>`).join('')}</tr>`).join('')}</tbody>
  <tfoot><tr><th>Role actions</th>${roles.map(role=>`<td>${role.id==='admin'?'<span class="access-muted">Protected</span>':editing===role.id?`<button class="wb-button primary" data-save-role="${esc(role.id)}">Save changes</button><button class="wb-button" data-cancel-role>Cancel</button>`:`<button class="wb-button" data-edit-role="${esc(role.id)}">Edit role</button><button class="wb-button danger" data-delete-role="${esc(role.id)}" ${members.some(m=>m.role===role.id)?'disabled title="Assign another role to these users first"':''}>Delete</button>`}</td>`).join('')}</tr></tfoot></table></div>
  <p class="access-note">Admin has full access. Only Admin can manage roles and people. Design and sound changes are reviewed and published per game.</p>`}
 function people(){if(!auth.has('users.manage'))return `<p class="access-description">Invite people to the games you can access. Only Admin can view and manage the full member list.</p><button class="wb-button primary" type="button" data-new-invite>Invite person</button>`;return `
  <div class="people-toolbar"><div class="people-summary"><p class="access-description">${members.filter(m=>status(m)!=='removed').length} people · ${members.filter(m=>status(m)==='pending').length} pending invitations</p><button class="wb-button access-refresh" type="button" data-refresh aria-label="Refresh people" title="Refresh people"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2.3 5.7M20 7l-2.3-2.3"/></svg></button></div>${auth.has('users.invite')?'<button class="wb-button primary" type="button" data-new-invite>Invite person</button>':''}</div>
  <div class="permission-table-wrap"><table class="people-table"><caption class="visually-hidden">People and invitations</caption><thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Invited by</th><th scope="col">Invited on</th>${canEdit()?'<th scope="col">Actions</th>':''}</tr></thead>
  <tbody>${members.map(member=>`<tr data-person="${esc(member.user_id)}"><th scope="row">${esc(member.name||'—')}${member.user_id===auth.session?.user.id?'<small>You</small>':''}</th><td>${esc(member.email)}</td><td>${esc(roles.find(r=>r.id===member.role)?.name||'—')}</td><td><span class="member-status status-${esc(status(member))}">${esc(statusNames[status(member)]||'Active')}</span></td><td>${esc(member.invited_by_email||(member.invited_at?'Deleted account':'—'))}</td><td><time title="${esc(member.invited_at?new Date(member.invited_at).toLocaleString():'Existing account')}">${esc(date(member.invited_at))}</time></td>${canEdit()?`<td><button class="wb-button" data-edit-member="${esc(member.user_id)}">${status(member)==='removed'?'Restore':'Edit access'}</button>${status(member)==='pending'&&auth.has('users.invite')?` <button class="wb-button" data-invite-person="${esc(member.user_id)}">New invite link</button>`:''}${status(member)!=='removed'?` <button class="wb-button danger" data-remove-person="${esc(member.user_id)}" ${member.user_id===auth.session?.user.id?'disabled':''}>${status(member)==='pending'?'Revoke invite':'Remove access'}</button>`:''}</td>`:''}</tr>`).join('')||`<tr><td colspan="${canEdit()?7:6}">No people yet.</td></tr>`}</tbody></table></div>
  <p class="access-note">Removed invitations stay in this history. Removing access keeps the person's saved work.</p>`}
 function render(){
  root.innerHTML=`<a id="access-back" class="access-back" href="index.html">← Back to Composer</a>
   <header class="access-header"><div><small>WORKSPACE SETTINGS</small><h1>${tab==='roles'?'Roles &amp; permissions':'People &amp; invitations'}</h1></div>${tab==='roles'?`<div class="access-header-actions"><span class="access-mode">${editing?'Edit mode':'View mode'}</span><button class="wb-button access-refresh" type="button" data-refresh aria-label="Refresh roles" title="Refresh roles"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2.3 5.7M20 7l-2.3-2.3"/></svg></button></div>`:''}</header>
   <section aria-label="${tab==='roles'?'Roles and permissions':'People and invitations'}">${tab==='roles'?matrix():people()}</section><p id="roles-status" role="status" aria-live="polite"></p>`;
  const back=root.querySelector('#access-back');let returnPath=sessionStorage.getItem('composer-access-return');
  try{const url=new URL(returnPath||'index.html',location.href);if(url.origin===location.origin&&url.pathname.endsWith('/index.html'))back.href=url.href}catch{}
  back.onclick=event=>{if(busy||!discard())event.preventDefault()};
  for(const b of root.querySelectorAll('[data-edit-role]'))b.onclick=()=>{if(busy||!discard())return;editing=b.dataset.editRole;render();root.querySelector('[data-role-name]')?.focus()};
  root.querySelector('[data-cancel-role]')?.addEventListener('click',()=>{if(busy||!discard())return;editing=false;render()});
  root.querySelector('[data-refresh]')?.addEventListener('click',()=>{if(discard())run(load)});
  const create=root.querySelector('#role-create');if(create)create.onsubmit=event=>{event.preventDefault();if(roleDirty()){message('Save changed roles before creating another role.');return}const name=new FormData(create).get('name');run(async()=>{const created=await save(null,name,['workspace.view'],null);editing=created.id;await load();message('Role created. Choose its permissions and save.')})};
  for(const button of root.querySelectorAll('[data-save-role]'))button.onclick=()=>run(async()=>{
   const role=roles.find(r=>r.id===button.dataset.saveRole),name=[...root.querySelectorAll('[data-role-name]')].find(i=>i.dataset.roleName===role.id).value,selected=[...root.querySelectorAll('[data-role]')].filter(i=>i.dataset.role===role.id&&i.checked).map(i=>i.dataset.permission);
   const saved=await save(role.id,name,selected,role.revision);roles=roles.map(r=>r.id===saved.id?saved:r);editing=false;await auth.refreshPermissions();render();message(saved.name+' saved. Permissions are active.');
  });
  for(const button of root.querySelectorAll('[data-delete-role]'))button.onclick=()=>{
   if(roleDirty()){message('Save changed roles before deleting a role.');return}const role=roles.find(r=>r.id===button.dataset.deleteRole);if(!confirm('Delete role “'+role.name+'”?'))return;
   run(async()=>{check(await auth.client.rpc('composer_delete_role',{p_id:role.id,p_revision:role.revision}));await load();message('Role deleted.')});
  };
  root.querySelector('[data-new-invite]')?.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('composer-open-invite')));
  for(const b of root.querySelectorAll('[data-invite-person]'))b.onclick=()=>document.dispatchEvent(new CustomEvent('composer-open-invite',{detail:members.find(m=>m.user_id===b.dataset.invitePerson)}));
  for(const b of root.querySelectorAll('[data-remove-person]'))b.onclick=()=>{const m=members.find(m=>m.user_id===b.dataset.removePerson);if(busy||!confirm('Remove Composer access for '+m.email+'? Saved work will be kept.'))return;run(async()=>{check(await auth.client.rpc('composer_remove_member',{p_user:m.user_id}));await load();message('Access removed.')})};
  for(const button of root.querySelectorAll('[data-edit-member]'))button.onclick=()=>openMember(members.find(m=>m.user_id===button.dataset.editMember));
 }
 function openMember(member){
  if(busy||!auth.has('users.manage'))return;
  const removed=status(member)==='removed';
  memberDialog.innerHTML=`<header><div><small>PEOPLE &amp; INVITATIONS</small><h2 id="member-title">${removed?'Restore access':'Edit access'}</h2></div><button class="wb-button" type="button" data-close aria-label="Close">✕</button></header>
   <p class="member-email">${esc(member.email)}</p>
   ${member.invited_at?`<p class="share-note">Invited by ${esc(member.invited_by_email||'Deleted account')} · ${esc(date(member.invited_at))}<br>Last link: ${esc(date(member.last_invited_at))}${member.accepted_at?` · Accepted: ${esc(date(member.accepted_at))}`:''}</p>`:''}
   <form data-member="${esc(member.user_id)}"><label>Role<select name="role" required>${removed?'<option value="" selected disabled>Choose role</option>':''}${roles.map(role=>`<option value="${esc(role.id)}" ${member.role===role.id?'selected':''}>${esc(role.name)}</option>`).join('')}</select></label>
   ${removed?'':'<label class="role-check"><input name="active" type="checkbox" '+(member.active?'checked':'')+'>Active access</label><p class="share-note">Uncheck to block access temporarily.</p>'}
   <fieldset><legend>Assigned games</legend>${games.map(game=>`<label class="role-check"><input name="games" value="${esc(game.id)}" type="checkbox" ${member.games.includes(game.id)?'checked':''}>${esc(game.title)}</label>`).join('')}</fieldset><p class="share-note">Admin can access every game.</p>
   <div class="member-actions"><button class="wb-button primary" type="submit">${removed?'Restore access':'Save changes'}</button><button class="wb-button" type="button" data-cancel>Cancel</button></div></form>
   <p role="status" aria-live="polite"></p>
   <footer>${status(member)==='pending'?'<button class="wb-button" type="button" data-reinvite>New invite link</button>':''}${!removed?`<button class="wb-button danger" type="button" data-remove-member ${member.user_id===auth.session?.user.id?'disabled title="You cannot remove your own access"':''}>${status(member)==='pending'?'Revoke invite':'Remove access'}</button>`:''}</footer>`;
  const close=()=>{if(!busy&&(!memberDirty()||confirm('Discard unsaved access changes?')))memberDialog.close()};
  memberDialog.querySelector('[data-close]').onclick=close;memberDialog.querySelector('[data-cancel]').onclick=close;
  memberDialog.querySelector('form').onsubmit=event=>{event.preventDefault();const fields=new FormData(event.target);run(async()=>{
   check(await auth.client.rpc(removed?'composer_restore_member':'composer_set_member',{p_user:member.user_id,p_role:fields.get('role'),...(!removed?{p_active:fields.has('active')}:{}),p_games:fields.getAll('games')}));
   memberDialog.close();await auth.refreshPermissions();if(!auth.has('users.manage'))return;await load();message(removed?'Access restored.':'Access saved.');
  })};
  memberDialog.querySelector('[data-reinvite]')?.addEventListener('click',()=>{if(busy)return;if(memberDirty()&&!confirm('Discard unsaved access changes?'))return;memberDialog.close();document.dispatchEvent(new CustomEvent('composer-open-invite',{detail:member}))});
  memberDialog.querySelector('[data-remove-member]')?.addEventListener('click',()=>{if(busy||!confirm('Remove Composer access for '+member.email+'? Saved work will be kept.'))return;run(async()=>{check(await auth.client.rpc('composer_remove_member',{p_user:member.user_id}));memberDialog.close();await load();message('Composer access removed.')})});
  memberSnapshot=memberValues();memberDialog.showModal();
 }
 memberDialog.addEventListener('cancel',event=>{if(busy||(memberDirty()&&!confirm('Discard unsaved access changes?')))event.preventDefault()});
 window.addEventListener('beforeunload',event=>{if(roleDirty()||memberDirty()){event.preventDefault();event.returnValue=''}});
 document.addEventListener('composer-permissions',()=>{if(!canView()){memberDialog.close();denied()}});
 document.addEventListener('composer-invited',()=>{if(!busy&&tab==='people')run(load)});
 function denied(){root.innerHTML='<a class="access-back" href="index.html">← Back to Composer</a><h1>Admin access required</h1><p>Your role cannot view or manage workspace accounts.</p>'}
 if(!canView())denied();else{render();await run(load)}
}
