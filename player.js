(()=>{
'use strict';
const $=id=>document.getElementById(id),config=window.LotomobilPlayerConfig||{},params=new URLSearchParams(location.search);
let session=null,phone='',busy=false;
function fitGame(){
 const mobile=matchMedia('(max-width: 600px)').matches;
 const scale=mobile?1:Math.min(1,(innerWidth-32)/416,(innerHeight-32)/870);
 $('game-device').style.transform=mobile?'':'scale('+Math.max(.1,scale)+')';
}
window.addEventListener('resize',fitGame);fitGame();
function endpoint(base,path){const url=new URL(base);if(url.protocol!=='https:'||url.username||url.password)throw Error('Lotomobil login is not configured.');return new URL(path.replace(/^\//,''),url.href.replace(/\/?$/,'/')).href}
let ready=false;
try{endpoint(config.authBaseUrl,'login/me');endpoint(config.apiBaseUrl,'v1/betting/runner/checkouts');const game=new URL(config.gameUrl);if(game.origin!==location.origin)throw Error();ready=!params.has('game')||params.get('game')==='road'}catch{}
const sessionKey='lotomobil-player-session-v1:'+JSON.stringify([config.authBaseUrl,config.apiBaseUrl]);
function forgetSession(){try{sessionStorage.removeItem(sessionKey)}catch{}}
function restoreSession(){
 try{const saved=JSON.parse(sessionStorage.getItem(sessionKey));if(saved&&typeof saved.auth==='string'&&saved.auth.trim()&&typeof saved.phone==='string'&&saved.phone.trim()){session={auth:saved.auth};phone=saved.phone;return true}}catch{}
 forgetSession();return false;
}
function openGame(){
 const url=new URL(config.gameUrl);url.searchParams.set('api','1');
 for(const key of ['lang','brand','theme']){const value=params.get(key);if(value&&/^[a-zA-Z0-9_-]{1,80}$/.test(value))url.searchParams.set(key,value)}
 $('login').hidden=true;$('credentials').elements.pin.value='';$('game').src=url.href;$('game').hidden=false;$('game-stage').hidden=false;fitGame();
}
function controls(){document.querySelectorAll('button').forEach(b=>b.disabled=busy||!ready);document.querySelectorAll('input').forEach(i=>i.readOnly=busy)}
function login(message){session=null;phone='';forgetSession();$('game-stage').hidden=true;$('game').hidden=true;$('game').removeAttribute('src');$('login').hidden=false;$('credentials').hidden=false;$('credentials').reset();$('status').textContent=message;controls()}
async function request(base,path,options={}){
 let response;try{response=await fetch(endpoint(base,path),{...options,credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)})}catch{throw Error('Connection lost. Please try again.')}
 let data;try{data=await response.json()}catch{if(response.ok)throw Error('The service returned an invalid response.');data={}}
 if(!response.ok){const error=Error(response.status===429?'Too many attempts. Please wait and try again.':response.status===401||response.status===403?'Login was not accepted. Check your details and try again.':'The service is unavailable. Please try again.');error.status=response.status;throw error}return data;
}
async function run(action){if(busy||!ready)return;busy=true;controls();$('status').textContent='Connecting…';try{await action()}catch(error){$('status').textContent=error.message}finally{busy=false;controls()}}
$('credentials').onsubmit=event=>{event.preventDefault();run(async()=>{
 phone=$('credentials').elements.phone.value.trim();const pin=$('credentials').elements.pin.value;
 const data=await request(config.authBaseUrl,'login/player',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:phone,password:pin})});
 const token=data.tokens?.Authentication;if(typeof token!=='string'||!token.trim())throw Error('Login did not return a session.');
 session={auth:token};try{sessionStorage.setItem(sessionKey,JSON.stringify({auth:token,phone}))}catch{}
 openGame();
})};
window.Lotomobil={get player(){return phone},async request(path,options={}){
 if(!session)throw Error('Log in to Lotomobil first.');
 if(path!=='/payment/account'&&(!/^\/v[12]\/betting\/runner\/(game-configurations|checkouts)(?:[/?]|$)/.test(path)||path.includes('..')))throw Error('Unsupported game endpoint.');
 if(path==='/payment/account'&&options.method&&options.method!=='GET')throw Error('Unsupported account method.');
 const current=session;
 try{return await request(config.apiBaseUrl,path,{...options,headers:{...options.headers,Authentication:current.auth}})}catch(error){if((error.status===401||error.status===403)&&session===current)login('Your session expired. Log in again to resume your game.');throw error}
}};
if(config.environment==='QA')document.querySelector('.brand').textContent='LOTOMOBIL · QA';
if(ready&&restoreSession())openGame();else login(ready?'':'Lotomobil login is not configured yet.');
})();
