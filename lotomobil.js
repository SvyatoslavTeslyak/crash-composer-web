await window.ComposerAuth.ready;
const section=document.querySelector('#lotomobil-section');
const key='composer-lotomobil-session-v1';
const playerBase=window.ComposerCloudConfig?.lotomobilBaseUrl;
const playerUrl=path=>playerBase?new URL(path.replace(/^(auth|api)\//,''),playerBase).href:path;
let session=null,mode=null,busy=false,phase='',authToken='',phone='',verificationStatus=null;
try{session=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
if(!session?.auth||!session?.otp||session.owner!==window.ComposerAuth.session?.user.id){session=null;sessionStorage.removeItem(key)}
const dialog=document.createElement('dialog');dialog.className='share-dialog lotomobil-dialog';dialog.setAttribute('aria-labelledby','lotomobil-title');
dialog.innerHTML=`<header><h2 id="lotomobil-title">Log in to Lotomobil</h2><button class="wb-button" type="button" data-close aria-label="Close">✕</button></header><p>Your Lotomobil player account is separate from your Composer account.</p><form id="lotomobil-credentials"><label>Phone number<input name="phone" type="tel" autocomplete="tel" required></label><label>PIN<input name="pin" type="password" inputmode="numeric" autocomplete="current-password" required></label><button class="wb-button" type="submit">Continue</button></form><form id="lotomobil-otp" hidden><p>Enter the code sent to your phone.</p><label>OTP code<input name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]+" required></label><button class="wb-button" type="submit">Verify & connect</button></form><p id="lotomobil-error" role="status" aria-live="polite"></p>`;
document.body.append(dialog);
const credentials=dialog.querySelector('#lotomobil-credentials'),otp=dialog.querySelector('#lotomobil-otp'),errorBox=dialog.querySelector('#lotomobil-error');
function syncButtons(){
 const ready=!!mode&&mode.auth!=='unconfigured';
 credentials.querySelector('[type=submit]').disabled=busy||!ready||!credentials.elements.phone.value.trim()||!credentials.elements.pin.value.trim()||!credentials.checkValidity();
 otp.querySelector('[type=submit]').disabled=busy||!authToken||!otp.elements.otp.value.trim()||!otp.checkValidity();
 for(const form of [credentials,otp]){
  const button=form.querySelector('[type=submit]'),loading=busy&&!form.hidden;
  button.textContent=loading?phase:form===credentials?'Continue':'Verify & connect';
  button.classList.toggle('is-loading',loading);
  button.setAttribute('aria-busy',String(loading));
  for(const input of form.querySelectorAll('input'))input.readOnly=busy;
 }
 dialog.querySelector('[data-close]').disabled=busy;
}
function progress(text){phase=text;errorBox.textContent=text;syncButtons()}
for(const form of [credentials,otp])for(const name of ['input','change','focusin'])form.addEventListener(name,syncButtons);
const supported=()=>window.ComposerTarget?.value==='road'&&window.ComposerTarget?.engine==='pixi';
const activeRound=()=>{try{return !!document.querySelector('#frame').contentWindow.goatRoad?.state().apiActive}catch{return false}};
function notify(){render();window.dispatchEvent(new Event('lotomobil-session'))}
function clear(){session=null;sessionStorage.removeItem(key);notify()}
async function json(path,options={}){
 let response;try{response=await fetch(playerUrl(path),{...options,credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)})}catch{throw Error('Connection lost. Please try again.')}
 let data;try{data=await response.json()}catch{if(response.ok)throw Error('The service returned an invalid response.');data={}}
 if(!response.ok){const error=Error(response.status===401||response.status===403?(path==='auth/login/otp'&&options.method==='POST'?'The code was not accepted. Check it and try again.':path==='auth/login/player'?'Phone number or PIN was not accepted. Please try again.':'Your Lotomobil session expired. Please log in again.'):response.status===429?'Too many attempts. Wait before trying again.':data.message||data.code||'The service is unavailable.');error.status=response.status;throw error}return data;
}
async function discover(){if(playerBase){mode={auth:'live',api:'live',target:new URL(playerBase).host};render();return}const [a,b]=await Promise.all([json('auth/_mode'),json('api/_mode')]);mode={auth:a.mode,api:b.mode,target:b.target};render()}
function render(){if(!section)return;section.hidden=!supported()||window.ComposerAuth.member?.role==='copywriter';if(section.hidden)return;const connected=!!session,unavailable=mode?.auth==='unconfigured';section.innerHTML=`<strong>Game connection</strong><span class="lotomobil-mode">${supported()&&connected?'Lotomobil · '+(mode?.api==='mock'?'test server':'QA API'):'Demo · no API'}</span><p>${supported()?(connected?'Goat Road uses your Lotomobil account and server results.':(unavailable?'Lotomobil login has not been connected yet. You can keep playing in demo.':'You are playing with simulated data. Log in to your Lotomobil account to use server data.')):'This game runs with simulated data. Lotomobil gameplay is currently available for Goat Road (Pixi).'}</p><button class="wb-button" type="button" id="lotomobil-connect" ${unavailable&&!connected?'disabled':''}>${unavailable&&!connected?'Lotomobil login unavailable':connected?'Disconnect · use demo':'Log in to Lotomobil'}</button><small>${mode?.api==='live'?'QA environment':mode?.api==='mock'?'Local test server · simulated data':''}</small>`;
 section.querySelector('button').onclick=()=>{if(connected){if(activeRound()){section.querySelector('p').textContent='Finish or recover the Lotomobil round before disconnecting.';return}clear()}else open()};
}
async function open(){
 errorBox.textContent='';credentials.hidden=true;otp.hidden=true;credentials.reset();otp.reset();authToken='';phone='';dialog.showModal();
 try{if(!mode){errorBox.textContent='Connecting…';syncButtons();await discover();errorBox.textContent=''}credentials.hidden=mode.auth==='unconfigured';syncButtons();if(!credentials.hidden)credentials.elements.phone.focus();if(mode.auth==='unconfigured')errorBox.textContent='Lotomobil login is not configured yet. You can continue playing in demo.';else if(mode.auth==='mock')errorBox.textContent='Local login test: any number, PIN other than 0000, code 1234. This does not connect a real account.'}catch{errorBox.textContent='Login service is unavailable. Demo remains playable.'}
}
async function run(fn,label){if(busy)return;busy=true;progress(label);try{await fn();errorBox.textContent=''}catch(error){errorBox.textContent=error.message}finally{busy=false;phase='';syncButtons()}}
async function requestOtp(){progress('Sending code…');await json('auth/login/otp',{headers:{Authentication:authToken}});credentials.hidden=true;otp.hidden=false;syncButtons();otp.elements.otp.focus()}
credentials.onsubmit=event=>{event.preventDefault();run(async()=>{
 if(!mode)await discover();if(mode.auth==='unconfigured')throw Error('Lotomobil login is not configured. Continue in demo.');if(mode.auth==='mock'&&mode.api!=='mock')throw Error('Local login testing requires the local test game server. Continue in demo.');
 phone=credentials.elements.phone.value.trim();const pin=credentials.elements.pin.value;credentials.elements.pin.value='';
 const data=await json('auth/login/player',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:phone,password:pin})});
 if(typeof data.tokens?.Authentication!=='string')throw Error('Login did not return an authentication token.');authToken=data.tokens.Authentication;
 await requestOtp();
},'Checking credentials…')};
otp.onsubmit=event=>{event.preventDefault();run(async()=>{
 const code=otp.elements.otp.value;otp.elements.otp.value='';
 const data=await json('auth/login/otp',{method:'POST',headers:{Authentication:authToken,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:phone,password:code,otpType:'GENERATED_CODE'})});
 const token=value=>typeof value==='string'&&value.trim()?value.trim():null;
 const nextAuth=token(data.tokens?.Authentication)||token(authToken),nextOtp=token(data.tokens?.['OTP-Authentication']);
 // Diagnostics contain presence flags only, never token values, phone or OTP.
 verificationStatus={authenticationReturned:!!token(data.tokens?.Authentication),previousAuthenticationAvailable:!!token(authToken),otpReturned:!!nextOtp,verified:false};
 if(!nextAuth||!nextOtp)throw Error('Lotomobil did not return an OTP session. Close this window and sign in again.');
 const candidate={owner:window.ComposerAuth.session.user.id,auth:nextAuth,otp:nextOtp,phone};
 progress('Connecting account…');
 await json('auth/login/me',{headers:{Authentication:candidate.auth,'OTP-Authentication':candidate.otp}});
 verificationStatus.verified=true;session=candidate;sessionStorage.setItem(key,JSON.stringify(session));authToken='';dialog.close();notify();
},'Verifying code…')};
const close=()=>{if(busy)return;dialog.close();authToken='';credentials.reset();otp.reset()};dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else close()});
window.Lotomobil={
 get verificationStatus(){return verificationStatus?{...verificationStatus}:null},
 get connected(){return !!session},get player(){return session?.phone||''},get mode(){return mode?.api||'live'},
 headers(){return session?{Authentication:session.auth,'OTP-Authentication':session.otp}:{}},
 async request(path,options={}){
  if(!session)throw Error('Log in to Lotomobil first.');
  if(!/^\/v[12]\/betting\/runner\//.test(path))throw Error('Unsupported game endpoint.');
  const requestSession=session;
  try{return await json('api'+path,{...options,headers:{...options.headers,...this.headers()}})}
  catch(error){
   // Expiry switches the iframe to demo through the existing session event.
   // An old in-flight request must not disconnect a newly authenticated player.
   if((error.status===401||error.status===403)&&session===requestSession){clear();error.message='Lotomobil session ended. Switched to demo.'}
   throw error;
  }
 }
};
window.crashAuth={headers:()=>window.Lotomobil.headers()};
document.addEventListener('composer-permissions',()=>{render();if(window.ComposerAuth.member?.role==='copywriter'&&dialog.open)dialog.close()});
window.addEventListener('composer-target',render);window.addEventListener('composer-engine',render);
const originalSignOut=window.ComposerAuth.signOut.bind(window.ComposerAuth);window.ComposerAuth.signOut=async()=>{sessionStorage.removeItem(key);session=null;await originalSignOut()};
render();discover().then(()=>{if(session)notify()}).catch(()=>{});
