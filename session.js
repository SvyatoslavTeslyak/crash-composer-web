/* One workspace identity. Access requires an existing Supabase account and Composer membership. */
(()=>{
const login=location.pathname.endsWith('/login.html');
const localKey='composer-local-workspace';
sessionStorage.removeItem(localKey); // Retire the old development bypass.
const nativeFetch=window.fetch.bind(window);
let state={local:false,session:null,member:null,games:[],permissions:[]},client=null;
const auth=window.ComposerAuth={
 get client(){return client},get local(){return state.local},get session(){return state.session},get member(){return state.member},
 has(permission,game=null){return !!state.member?.active&&state.permissions.includes(permission)&&(game===null||state.games.includes(game))},
 canWorkspace(mode){return !!state.member&& (state.member.role!=='copywriter'||['layout','translates'].includes(mode))},
 canRead(game){return auth.has('workspace.view',game==='kit'?null:game)},
 canEdit(game){return auth.has('translations.edit',game)},
 async refreshPermissions(){if(!await account())throw Error('Sign in again.');document.dispatchEvent(new Event('composer-permissions'));},
 async signOut(){sessionStorage.removeItem(localKey);if(client){const {error}=await client.auth.signOut();if(error)throw error;}location.replace('login.html')}
};
// Local asset edits attach the user JWT; the server checks current permissions before writing.
window.fetch=async(input,options={})=>{
 const method=(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 const url=new URL(input instanceof Request?input.url:input,location.href);
 const basePath=new URL('./',location.href).pathname;
 const route=url.pathname.startsWith(basePath)?'/'+url.pathname.slice(basePath.length):url.pathname;
 if(url.origin===location.origin&&!['GET','HEAD','OPTIONS'].includes(method)&&!/^\/(auth\/login\/(player|otp)|api\/v[12]\/betting\/runner\/)/.test(route)){
  let permission=null,game=null;
  if(route==='/settings/showcase'){permission='releases.publish';if(state.member?.role!=='admin')throw Error('Admin access required');}
  else if(route==='/release/apply'){permission='releases.publish';game=window.ComposerTarget?.value;if(state.member?.role!=='admin')throw Error('Admin access required');}
  else if(route.startsWith('/brands/'))permission='design.edit';
  else if(route.startsWith('/studio/')){
   permission=route==='/studio/rebuild'?'build.preview':'audio.edit';
   if(['/studio/save','/studio/rebuild'].includes(route)){let body;try{body=JSON.parse(input instanceof Request?await input.clone().text():options.body)}catch{throw Error('Invalid editor request')};game=body.source}else game=url.searchParams.get('source');
   if(!game)throw Error('Select a game first');if(game==='kit')game=null;
  }
  if(!permission||!auth.has(permission,game))throw Error('Your role does not allow this action.');
  const {data,error}=await client.auth.getSession();if(error||!data.session)throw Error('Sign in again.');
  const headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined));headers.set('Authorization','Bearer '+data.session.access_token);options={...options,headers};
 }

 return nativeFetch(input,options);
};
if(!login)document.documentElement.style.visibility='hidden';
const dom=()=>document.readyState==='loading'?new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true})):Promise.resolve();
async function account(){
 state.member=null;state.permissions=[];state.games=[];
 const {data,error}=await client.auth.getSession();if(error)throw error;state.session=data.session;
 if(!state.session)return false;
 const member=await client.from('composer_members').select('role,active').eq('user_id',state.session.user.id).maybeSingle();
 if(member.error)throw Error('Composer access is not configured yet. Ask the administrator to finish database setup.');
 if(!member.data?.active)throw Error('This account has no active Composer access.');
 state.member=member.data;
 const access=await client.rpc('composer_my_access');if(access.error)throw access.error;if(!access.data)throw Error('This account has no active Composer access.');
 state.permissions=access.data.permissions;state.games=access.data.games;state.member.role_name=access.data.role_name;if(!state.permissions.includes('workspace.view'))throw Error('Your role does not have workspace access.');return true;
}
auth.ready=(async()=>{
 await dom();
 const errorBox=document.querySelector('#entry-error');
 const fragment=new URLSearchParams(location.hash.slice(1)),invitation=login?fragment.get('invite_token'):null;
 const changingPassword=login&&new URLSearchParams(location.search).get('mode')==='password';
 const recovery=login&&(fragment.get('type')==='recovery'||new URLSearchParams(location.search).get('mode')==='recovery');
 if(invitation){sessionStorage.setItem('composer-pending-invite',invitation);sessionStorage.removeItem('composer-password-setup');history.replaceState(null,'',location.pathname+location.search)}
 let setup=login&&(recovery||!!sessionStorage.getItem('composer-pending-invite')||!!sessionStorage.getItem('composer-password-setup')||new URLSearchParams(location.search).get('mode')==='password');
 const open=()=>{setupAccountMenu();document.documentElement.style.visibility='';document.dispatchEvent(new Event('composer-auth-ready'))};
 try{
  const {createClient}=await import('./vendor/supabase.js');
  client=createClient(window.ComposerCloudConfig.url,window.ComposerCloudConfig.publishableKey,{auth:{storage:sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  if(!login&&(sessionStorage.getItem('composer-pending-invite')||sessionStorage.getItem('composer-password-setup'))){location.replace('login.html');return}
  const signed=await account();
  if(!login){if(!signed){location.replace('login.html');return}open();return}
  if(login&&fragment.get('error_description'))errorBox.textContent='This recovery link is invalid or expired. Request a new link.';
  if(signed&&!setup){location.replace('index.html');return}
 }catch(error){if(!login){sessionStorage.setItem('composer-login-error',error.message);location.replace('login.html');return}errorBox.textContent=error.message}
 if(recovery&&!state.session){setup=false;errorBox.textContent='This recovery link is invalid or expired. Enter your email and request a new link.'}
 const form=document.querySelector('#login-form'),email=form.elements.email,password=form.elements.password,confirm=form.elements.confirm;
 const submit=form.querySelector('button[type=submit]'),cancel=document.querySelector('#cancel-setup');
 errorBox.textContent=errorBox.textContent||sessionStorage.getItem('composer-login-error')||'';sessionStorage.removeItem('composer-login-error');
 const visibility=document.querySelector('#password-visibility'),forgot=document.querySelector('#forgot-password');
 visibility.onclick=()=>{const shown=password.type==='password';password.type=shown?'text':'password';confirm.type=shown?'text':'password';visibility.textContent=shown?'Hide password':'Show password';visibility.setAttribute('aria-pressed',String(shown))};
 forgot.hidden=setup;
 if(setup){
  document.querySelector('#entry-title').textContent=recovery?'Reset your password':changingPassword?'Change password':'Create your password';
  document.querySelector('#entry-hint').textContent='Choose a password to access Crash Composer. Next time, sign in with your email and password.';
  document.querySelector('#email-field').hidden=true;email.required=false;
  document.querySelector('#confirm-field').hidden=false;confirm.required=true;
  password.autocomplete='new-password';password.minLength=10;
  document.querySelector('#password-hint').hidden=false;submit.textContent='Save password & continue';cancel.hidden=false;
  cancel.textContent=changingPassword?'Back to Composer':'Back to sign in';
  cancel.onclick=async()=>{if(changingPassword){location.assign('index.html');return}try{if(state.session||sessionStorage.getItem('composer-password-setup')){const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;}sessionStorage.removeItem('composer-pending-invite');sessionStorage.removeItem('composer-password-setup');location.replace('login.html')}catch(error){errorBox.textContent=error.message}};
 }
 let busy=false;
 forgot.onclick=async()=>{if(busy)return;if(!email.value.trim()||!email.checkValidity()){email.reportValidity();email.focus();return}busy=true;forgot.disabled=true;submit.disabled=true;errorBox.textContent='';try{if(!client)throw Error('Sign-in service unavailable. Try again.');const redirect=new URL('login.html',window.ComposerCloudConfig.workspaceUrl||location.href);redirect.searchParams.set('mode','recovery');const {error}=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:redirect.href});if(error)throw error;document.querySelector('#entry-status').textContent='If this email has an account, a reset link will arrive shortly. Check your inbox and spam folder.'}catch(error){errorBox.textContent=error.status===429?'Too many requests. Wait a few minutes before trying again.':error.message}finally{busy=false;forgot.disabled=false;submit.disabled=false}};
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;busy=true;submit.disabled=true;errorBox.textContent='';
  try{
   if(!client)throw Error('Sign-in service is unavailable. Reload and try again.');
   if(setup){
    if(password.value.length<10)throw Error('Use at least 10 characters for your password.');
    if(password.value!==confirm.value)throw Error('Passwords do not match.');
    const token=sessionStorage.getItem('composer-pending-invite');
    if(token){
     const {data,error}=await client.auth.verifyOtp({token_hash:token,type:'invite'});
     if(error)throw Error('This invitation is invalid or expired. Ask the administrator for a new link.');
     sessionStorage.removeItem('composer-pending-invite');sessionStorage.setItem('composer-password-setup',data.user.id);
    }
    const {data,error}=await client.auth.getSession();if(error)throw error;
    const expected=sessionStorage.getItem('composer-password-setup');
    if(!data.session||(expected&&expected!==data.session.user.id))throw Error('Open your invitation again, or sign in before changing your password.');
    const result=await client.auth.updateUser({password:password.value});if(result.error)throw result.error;
    sessionStorage.removeItem('composer-password-setup');
   }else{
    const {error}=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});
    if(error)throw Error(error.status===429?'Too many sign-in attempts. Wait a few minutes and try again.':error.message);
   }
   if(!await account())throw Error('Could not start your session. Please sign in again.');
   password.value='';confirm.value='';location.replace('index.html');
  }catch(error){errorBox.textContent=error.message}
  finally{busy=false;submit.disabled=false}
 });
})();
window.addEventListener('focus',()=>{if(!login&&client)auth.refreshPermissions().catch(()=>location.replace('login.html'))});
document.addEventListener('composer-permissions',()=>{const roles=document.querySelector('#workspace-roles');if(roles)roles.hidden=!auth.has('roles.manage');const people=document.querySelector('#workspace-people');if(people)people.hidden=!(auth.has('users.manage')||auth.has('users.invite'));});
function setupAccountMenu(){
 const account=document.querySelector('#workspace-account');if(!account)return;
 const avatar=document.querySelector('#workspace-avatar'),menu=document.querySelector('#workspace-account-menu'),logout=document.querySelector('#workspace-logout'),errorBox=document.querySelector('#workspace-account-error');
 const user=state.session?.user,metadata=user?.user_metadata||{};
 const name=[metadata.full_name,metadata.name,user?.email].find(value=>typeof value==='string'&&value.trim())?.trim()||'User';
 // Stable per account, including after a display-name change or on another device.
 const identity=String(user?.id||user?.email?.trim().toLowerCase()||name);
 let colourHash=2166136261;for(const char of identity)colourHash=Math.imul(colourHash^char.codePointAt(0),16777619);
 avatar.style.setProperty('--avatar-hue',String((colourHash>>>0)%360));
 avatar.textContent=Array.from(name)[0].toLocaleUpperCase();avatar.setAttribute('aria-label','Account menu: '+name);avatar.title=name;
 document.querySelector('#workspace-account-name').textContent=user?.email||name;
 document.querySelector('#workspace-password')?.addEventListener('click',()=>location.assign('login.html?mode=password'));
 const rolesButton=document.querySelector('#workspace-roles');if(rolesButton)rolesButton.hidden=!auth.has('roles.manage');const peopleButton=document.querySelector('#workspace-people');if(peopleButton)peopleButton.hidden=!(auth.has('users.manage')||auth.has('users.invite'));
 const close=(focus=false)=>{menu.hidden=true;avatar.setAttribute('aria-expanded','false');if(focus)avatar.focus()};
 avatar.addEventListener('click',()=>{const expanded=menu.hidden;menu.hidden=!expanded;avatar.setAttribute('aria-expanded',String(expanded));if(expanded)menu.querySelector('button:not([hidden])').focus()});
 document.addEventListener('click',event=>{if(!account.contains(event.target))close()});
 account.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close(true)}});
 account.addEventListener('focusout',event=>{if(!account.contains(event.relatedTarget))close()});
 logout.addEventListener('click',async()=>{logout.disabled=true;errorBox.hidden=true;try{await auth.signOut()}catch(error){errorBox.textContent=error.message||'Unable to sign out. Try again.';errorBox.hidden=false;logout.disabled=false}});
}
})();
