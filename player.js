(()=>{
'use strict';
const $=id=>document.getElementById(id),config=window.LotomobilPlayerConfig||{},params=new URLSearchParams(location.search);
let auth='',session=null,phone='',busy=false;
function endpoint(base,path){const url=new URL(base);if(url.protocol!=='https:'||url.username||url.password)throw Error('Lotomobil login is not configured.');return new URL(path.replace(/^\//,''),url.href.replace(/\/?$/,'/')).href}
let ready=false;
try{endpoint(config.authBaseUrl,'login/me');endpoint(config.apiBaseUrl,'v1/betting/runner/checkouts');const game=new URL(config.gameUrl);if(game.origin!==location.origin)throw Error();ready=!params.has('game')||params.get('game')==='road'}catch{}
function controls(){document.querySelectorAll('button').forEach(b=>b.disabled=busy||!ready);document.querySelectorAll('input').forEach(i=>i.readOnly=busy)}
function login(message){session=null;auth='';$('game').hidden=true;$('game').removeAttribute('src');$('login').hidden=false;$('credentials').hidden=false;$('verification').hidden=true;$('credentials').reset();$('verification').reset();$('status').textContent=message;controls()}
async function request(base,path,options={}){
 let response;try{response=await fetch(endpoint(base,path),{...options,credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)})}catch{throw Error('Connection lost. Please try again.')}
 let data;try{data=await response.json()}catch{if(response.ok)throw Error('The service returned an invalid response.');data={}}
 if(!response.ok){const error=Error(response.status===429?'Too many attempts. Please wait and try again.':response.status===401||response.status===403?'Login was not accepted. Check your details and try again.':'The service is unavailable. Please try again.');error.status=response.status;throw error}return data;
}
async function run(action){if(busy||!ready)return;busy=true;controls();$('status').textContent='Connecting…';try{await action()}catch(error){$('status').textContent=error.message}finally{busy=false;controls()}}
$('credentials').onsubmit=event=>{event.preventDefault();run(async()=>{
 phone=$('credentials').elements.phone.value.trim();const pin=$('credentials').elements.pin.value;$('credentials').elements.pin.value='';
 const data=await request(config.authBaseUrl,'login/player',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:phone,password:pin})});
 auth=typeof data.tokens?.Authentication==='string'?data.tokens.Authentication:'';if(!auth)throw Error('Login did not return a session.');
 await request(config.authBaseUrl,'login/otp',{headers:{Authentication:auth}});
 $('credentials').hidden=true;$('verification').hidden=false;$('status').textContent='Enter the code sent to your phone.';$('verification').elements.otp.focus();
})};
$('verification').onsubmit=event=>{event.preventDefault();run(async()=>{
 const code=$('verification').elements.otp.value;$('verification').elements.otp.value='';
 const data=await request(config.authBaseUrl,'login/otp',{method:'POST',headers:{Authentication:auth,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:phone,password:code,otpType:'GENERATED_CODE'})});
 const candidate={auth:data.tokens?.Authentication||auth,otp:data.tokens?.['OTP-Authentication']};
 if(typeof candidate.auth!=='string'||typeof candidate.otp!=='string'||!candidate.otp.trim())throw Error('Login did not return a verified session.');
 await request(config.authBaseUrl,'login/me',{headers:{Authentication:candidate.auth,'OTP-Authentication':candidate.otp}});
 session=candidate;auth='';const url=new URL(config.gameUrl);url.searchParams.set('api','1');
 for(const key of ['lang','brand','theme']){const value=params.get(key);if(value&&/^[a-zA-Z0-9_-]{1,80}$/.test(value))url.searchParams.set(key,value)}
 $('login').hidden=true;$('game').src=url.href;$('game').hidden=false;
})};
$('back').onclick=()=>login('');
window.Lotomobil={get player(){return phone},async request(path,options={}){
 if(!session)throw Error('Log in to Lotomobil first.');
 if(!/^\/v[12]\/betting\/runner\/(game-configurations|checkouts)(?:[/?]|$)/.test(path)||path.includes('..'))throw Error('Unsupported game endpoint.');
 const current=session;
 try{return await request(config.apiBaseUrl,path,{...options,headers:{...options.headers,Authentication:current.auth,'OTP-Authentication':current.otp}})}catch(error){if((error.status===401||error.status===403)&&session===current)login('Your session expired. Log in again to resume your game.');throw error}
}};
if(config.environment==='QA')document.querySelector('.brand').textContent='LOTOMOBIL · QA';
login(ready?'':'Lotomobil login is not configured yet.');
})();
