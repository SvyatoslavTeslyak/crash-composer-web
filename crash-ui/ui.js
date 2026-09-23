/* Shared browser UI. Games supply state and receive intent; no game economy lives here. */
(function(){
'use strict';
const base=new URL('.',document.currentScript.src).href;
if(!window.CrashI18n){const script=document.createElement('script');script.src=base+'i18n.js';document.head.append(script)}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let currency='';
// The go button doubles as cash out when the game says so; older games are recognised
// by the wording they use on it.
// How high a multiplier reads: the same four tiers colour the live badge and the history.
const tintFor=m=>Number(m)>=10?'gold':Number(m)>=5?'purple':Number(m)>=2?'success':'cyan';
const goIsCash=s=>s.goCash!==undefined?!!s.goCash:s.goTitle==='CASH OUT';
const money=(v,digits=2)=>window.CrashI18n?.locale==='fr'?window.CrashI18n.number(Number(v||0),{minimumFractionDigits:digits,maximumFractionDigits:digits})+' '+(currency||'$'):currency?Number(v||0).toFixed(digits)+' '+currency:'$'+Number(v||0).toFixed(digits);
const wager=v=>money(v,Number.isInteger(Number(v||0))?0:2);
const icon=(name)=>'<img class="icon" alt="" src="'+base+'assets/icons/'+name+(name==='play.svg'?'?v=ink-5':'')+'">';
// Pixel crop origins of the six painted circles in the 1536 x 1024 atlas.
// The artwork is not an evenly spaced 3 x 2 grid; its second row sits higher.
const avatarCrops=[[25,11],[537,10],[1045,10],[26,489],[530,489],[1045,490]];
const avatar=(name,players=[])=>{const i=name==='You'?2:players.indexOf(name),[x,y]=avatarCrops[i]||avatarCrops[5];return '<span class="avatar" role="img" aria-label="'+esc(name)+'" style="--avatar-x:'+(x/(1536-464)*100)+'%;--avatar-y:'+(y/(1024-464)*100)+'%"></span>'};
const button=(action,text,cls='')=>'<button type="button" class="button '+cls+'" data-action="'+action+'">'+text+'</button>';
// Betting feedback belongs to the UI; the cashout-ready tone plays once per round, not on every re-enable between steps.
class BettingSound {
 constructor(){this.enabled=false;this.last=-Infinity;this.next=0;this.pools={};this.plan={};
  for(const [name,volume] of [['click.ogg',0.14],['confirm.ogg',0.12]])this.pool(name,volume);
  this.pressedGo=-1e9;soundLevels.then(plan=>{this.plan=plan;for(const spec of Object.values(plan))if(spec.file)this.pool(spec.file,spec.volume)});}
 // One pool per file, so eleven events that share a take share four clips rather than forty.
 pool(file,volume){
  const have=this.pools[file];
  if(have){if(Number.isFinite(volume))for(const clip of have)clip.volume=volume;return have}
  return this.pools[file]=Array.from({length:4},()=>{const clip=new Audio(base+'assets/audio/'+file);clip.preload='auto';clip.preservesPitch=false;clip.volume=Number.isFinite(volume)?volume:0.14;return clip});
 }
 // Games differ in when cashing out becomes possible: after the first hop in Goat Road, at
 // once in Fish Master. When it arrives on the press itself the chime would only double the
 // play sound, and the button has already changed under the finger, so it is skipped.
 updateCashReady(state){
  const active=!!state.canCash&&(!!state.showCash||goIsCash(state))&&!state.win;
  const round=state.game+':'+state.rounds;
  const onThePress=performance.now()-this.pressedGo<BettingSound.PRESS_WINDOW_MS;
  if(this.game===state.game&&this.cashReady===false&&active&&this.chimedRound!==round){
   // Road readiness follows landing, even when a fast API and hop take under 400ms.
   if(state.game==='road'||!onThePress)this.play('cash-ready');
   this.chimedRound=round;
  }
  this.game=state.game;this.cashReady=active;
 }
 setEnabled(value){this.enabled=value;if(!value)for(const pool of Object.values(this.pools))for(const clip of pool)clip.pause()}
 // What the player pressed, named as the manifest names it.
 // How close to the PLAY press a cash-ready state still counts as part of that press.
 static PRESS_WINDOW_MS=400;
 static EVENTS={go:'play',cash:'cashout',min:'stake_min',max:'stake_max',minus:'stake_minus',plus:'stake_plus',preset:'stake_preset',auto:'auto',difficulty:'difficulty',chooseDifficulty:'difficulty',pickDifficulty:'difficulty_pick',leave:'header_click',account:'header_click',menu:'header_click','cash-ready':'cash_ready'};
 play(action){
  if(!this.enabled||document.hidden)return;
  const event=BettingSound.EVENTS[action];if(!event)return;
  const ready=event==='cash_ready';
  const now=performance.now();if(!ready&&now-this.last<55)return;if(!ready)this.last=now;
  if(action==='go')this.pressedGo=now;
  const spec=this.plan[event];
  const file=spec&&spec.file?spec.file:(ready?'confirm.ogg':'click.ogg');
  if(spec&&spec.volume===0)return;
  const pool=this.pool(file,spec&&Number.isFinite(spec.volume)?spec.volume:undefined);
  const clip=pool[this.next++%4];clip.currentTime=0;
  // Without a take of their own the steps keep the pitch that told them apart.
  const own=spec&&spec.file&&spec.file!=='click.ogg';
  const spread=1+(Math.random()*2-1)*(spec&&spec.jitter||0);
  clip.playbackRate=(own?1:action==='minus'?0.92:action==='plus'?1.08:1)*spread;
  clip.play().catch(()=>{});
 }
 destroy(){this.setEnabled(false);for(const pool of Object.values(this.pools))for(const clip of pool){clip.removeAttribute('src');clip.load()}}
}
// Popup and wallet transfer have separate voices using one shared coin asset.
class WinSound {
 constructor(){this.clip=new Audio(base+'assets/audio/win.ogg');this.clip.preload='auto';this.clip.volume=0.44;this.transferClip=new Audio(base+'assets/audio/win.ogg');this.transferClip.preload='auto';this.transferClip.volume=0.20;this.enabled=false;this.active=false;this.jitter={};this.clip.preservesPitch=false;soundLevels.then(plan=>{const pick=(id,clip,fallback)=>{const spec=plan[id];if(!spec)return;if(spec.file&&spec.file!==fallback)clip.src=base+'assets/audio/'+spec.file;if(Number.isFinite(spec.volume))clip.volume=spec.volume;this.jitter[id]=spec.jitter||0};pick('win',this.clip,'win.ogg');pick('win_transfer',this.transferClip,'win.ogg')})}
 update(state){this.enabled=state.settings?.sound===true;if(!this.enabled){this.clip.pause();this.transferClip.pause()}const active=!!state.win;if(this.game===state.game&&active&&(!this.active||(state.winId!==undefined&&state.winId!==this.winId)))this.play();this.game=state.game;this.active=active;this.winId=state.winId}
 spread(id){const j=this.jitter[id]||0;return 1+(Math.random()*2-1)*j}
 play(){if(!this.enabled||document.hidden)return;this.clip.currentTime=0;this.clip.playbackRate=this.spread('win');this.clip.play().catch(()=>{})}
 playTransfer(){if(!this.enabled||document.hidden)return;this.transferClip.currentTime=0;this.transferClip.playbackRate=1.12*this.spread('win_transfer');this.transferClip.preservesPitch=false;this.transferClip.play().catch(()=>{})}
 destroy(){this.transferClip.pause();this.transferClip.removeAttribute('src');this.transferClip.load();this.clip.pause();this.clip.removeAttribute('src');this.clip.load()}
}
// Levels tuned in Crash Composer → Sound Studio (assets/audio/sounds.json); built-in levels apply until it loads.
// Each panel event resolves to the take it owns, or to the take its fallback owns, so a
// brand-new event sounds like the base one until somebody records it. Levels come from the
// same manifest; the built-in ones apply until it loads.
function soundPlan(manifest){
 const events=Object.fromEntries((manifest.events||[]).map(e=>[e.id,e]));
 const take=e=>(e&&(e.takes||[]).find(t=>t.enabled!==false))||null;
 const level=e=>e&&e.volume_db!==null&&e.volume_db!==undefined&&Number.isFinite(Number(e.volume_db))?Math.min(1,Math.pow(10,Number(e.volume_db)/20)):null;
 // The level follows the take: a borrowed base sound plays at the base sound's level,
 // and an own file with no level of its own still plays at the level it falls back to.
 const inherited=e=>{let n=e,hops=0,v=level(e);while(v===null&&n&&n.fallback&&hops++<4){n=events[n.fallback];v=level(n)}return v};
 const plan={};
 for(const e of manifest.events||[]){
  let own=e,hops=0,found=take(e);
  while(!found&&own&&own.fallback&&hops++<4){own=events[own.fallback];found=take(own)}
  plan[e.id]={file:found?found.file.split('/').pop():null,volume:found?(inherited(own)??1):0,jitter:Math.min(0.3,Math.max(0,Number(e.pitch_jitter)||0))};
 }
 return plan;
}
const soundLevels=typeof fetch==='function'?fetch(base+'assets/audio/sounds.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(soundPlan).catch(()=>({})):Promise.resolve({});
/**
 * The tabbed controls: a second shape for the same panel, chosen per game with
 * config.controlsVariant='tabbed'. The standard controls are untouched — they stay in the
 * DOM, hidden — so every existing game keeps exactly what it has.
 *
 * Top to bottom: a risk meter and the difficulty row, the wager stepper beside one large
 * action button, and three tabs that open Top bets, My bets and the rules as modals.
 * There are no presets and no Auto switch in this shape; that is the design, not a gap.
 *
 * It reads the game's state; optional `risk` (0..1) fills the risk meter.
 */
class TabbedControls {
 constructor(){
  this.element=document.createElement('section');this.element.className='controls panel tabbed-controls';this.element.setAttribute('aria-label','Bet controls');
  // Supplied tab SVGs; currentColor follows the active brand and selected state.
  const icon=paths=>'<svg class="icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+[paths].flat().map((d,i)=>'<path d="'+d+'" fill="currentColor"'+(i===0?' fill-rule="evenodd" clip-rule="evenodd"':'')+'/>').join('')+'</svg>';
  const trophy="M12 1.99999C13.4661 1.99379 14.9301 2.11052 16.377 2.34765C17.5159 2.53964 18.0845 2.63567 18.5605 3.22167C19.0365 3.80663 19.0109 4.44019 18.9609 5.70604C18.7889 10.055 17.85 15.4858 12.75 15.9658V19.5H14.1797C14.4108 19.5001 14.6348 19.581 14.8135 19.7275C14.9921 19.8741 15.1149 20.0781 15.1602 20.3047L15.3496 21.25H18C18.1989 21.25 18.3896 21.3291 18.5303 21.4697C18.6709 21.6103 18.7499 21.8012 18.75 22C18.75 22.1988 18.6709 22.3896 18.5303 22.5303C18.3896 22.6709 18.1989 22.75 18 22.75H6C5.80109 22.75 5.61038 22.6709 5.46973 22.5303C5.32915 22.3896 5.25 22.1988 5.25 22C5.25006 21.8012 5.32913 21.6103 5.46973 21.4697C5.61037 21.3291 5.80114 21.25 6 21.25H8.65039L8.83984 20.3047C8.88513 20.0781 9.00791 19.8741 9.18652 19.7275C9.36518 19.581 9.58922 19.5001 9.82031 19.5H11.25V15.9658C6.15004 15.4858 5.21206 10.054 5.03906 5.70604C4.98907 4.4402 4.96452 3.80763 5.43945 3.22167C5.91545 2.63567 6.48407 2.53964 7.62305 2.34765C8.74705 2.15765 10.217 1.99999 12 1.99999ZM3.53027 5.54491L3.54004 5.76659C3.60704 7.46439 3.79005 9.45008 4.33691 11.2978L3.54297 10.8584C2.79097 10.4394 2.41403 10.2299 2.20703 9.87792C2.00018 9.52597 2 9.09509 2 8.23534V8.1621C2 7.12022 2.00022 6.59707 2.2832 6.20409C2.51121 5.88823 2.87745 5.7191 3.5293 5.49315L3.53027 5.54491ZM20.4717 5.49315C21.1225 5.7191 21.4888 5.88823 21.7168 6.20409C21.9998 6.59707 22 7.11922 22 8.1621V8.23534C22 9.09509 21.9998 9.52597 21.793 9.87792C21.586 10.2299 21.209 10.4394 20.457 10.8584L19.6641 11.2978C20.2099 9.45007 20.393 7.46439 20.46 5.76659L20.4697 5.54491L20.4717 5.49315Z";
  const receipt="M3 5C3 4.20435 3.31607 3.44129 3.87868 2.87868C4.44129 2.31607 5.20435 2 6 2H18C18.7956 2 19.5587 2.31607 20.1213 2.87868C20.6839 3.44129 21 4.20435 21 5V21C20.9999 21.1883 20.9466 21.3728 20.8462 21.5322C20.7459 21.6916 20.6025 21.8194 20.4327 21.9009C20.2629 21.9824 20.0736 22.0143 19.8864 21.9929C19.6993 21.9715 19.522 21.8977 19.375 21.78L17.446 20.238L15.055 21.832C14.8784 21.9499 14.6688 22.0085 14.4567 21.9993C14.2445 21.9902 14.0408 21.9137 13.875 21.781L12 20.28L10.125 21.78C9.95921 21.9127 9.75549 21.9892 9.54333 21.9983C9.33118 22.0075 9.12162 21.9489 8.945 21.831L6.554 20.237L4.624 21.78C4.47696 21.8974 4.29977 21.971 4.1128 21.9922C3.92584 22.0134 3.73667 21.9815 3.56705 21.9C3.39743 21.8185 3.25424 21.6909 3.15393 21.5317C3.05362 21.3724 3.00027 21.1882 3 21V5ZM8 6C7.73478 6 7.48043 6.10536 7.29289 6.29289C7.10536 6.48043 7 6.73478 7 7C7 7.26522 7.10536 7.51957 7.29289 7.70711C7.48043 7.89464 7.73478 8 8 8H16C16.2652 8 16.5196 7.89464 16.7071 7.70711C16.8946 7.51957 17 7.26522 17 7C17 6.73478 16.8946 6.48043 16.7071 6.29289C16.5196 6.10536 16.2652 6 16 6H8ZM8 10C7.73478 10 7.48043 10.1054 7.29289 10.2929C7.10536 10.4804 7 10.7348 7 11C7 11.2652 7.10536 11.5196 7.29289 11.7071C7.48043 11.8946 7.73478 12 8 12H16C16.2652 12 16.5196 11.8946 16.7071 11.7071C16.8946 11.5196 17 11.2652 17 11C17 10.7348 16.8946 10.4804 16.7071 10.2929C16.5196 10.1054 16.2652 10 16 10H8ZM8 14C7.73478 14 7.48043 14.1054 7.29289 14.2929C7.10536 14.4804 7 14.7348 7 15C7 15.2652 7.10536 15.5196 7.29289 15.7071C7.48043 15.8946 7.73478 16 8 16H12C12.2652 16 12.5196 15.8946 12.7071 15.7071C12.8946 15.5196 13 15.2652 13 15C13 14.7348 12.8946 14.4804 12.7071 14.2929C12.5196 14.1054 12.2652 14 12 14H8Z";
  const doc=["M3.75 3.375C3.75 2.34 4.589 1.5 5.625 1.5H9C9.99456 1.5 10.9484 1.89509 11.6517 2.59835C12.3549 3.30161 12.75 4.25544 12.75 5.25V7.125C12.75 7.62228 12.9475 8.09919 13.2992 8.45083C13.6508 8.80246 14.1277 9 14.625 9H16.5C17.4946 9 18.4484 9.39509 19.1517 10.0983C19.8549 10.8016 20.25 11.7554 20.25 12.75V20.625C20.25 21.66 19.41 22.5 18.375 22.5H5.625C4.59 22.5 3.75 21.66 3.75 20.625V3.375ZM7.71967 14.4697C7.57902 14.6103 7.5 14.8011 7.5 15C7.5 15.1989 7.57902 15.3897 7.71967 15.5303C7.86032 15.671 8.05109 15.75 8.25 15.75H15.75C15.9489 15.75 16.1397 15.671 16.2803 15.5303C16.421 15.3897 16.5 15.1989 16.5 15C16.5 14.8011 16.421 14.6103 16.2803 14.4697C16.1397 14.329 15.9489 14.25 15.75 14.25H8.25C8.05109 14.25 7.86032 14.329 7.71967 14.4697ZM7.71967 17.4697C7.86032 17.329 8.05109 17.25 8.25 17.25H12C12.1989 17.25 12.3897 17.329 12.5303 17.4697C12.671 17.6103 12.75 17.8011 12.75 18C12.75 18.1989 12.671 18.3897 12.5303 18.5303C12.3897 18.671 12.1989 18.75 12 18.75H8.25C8.05109 18.75 7.86032 18.671 7.71967 18.5303C7.57902 18.3897 7.5 18.1989 7.5 18C7.5 17.8011 7.57902 17.6103 7.71967 17.4697Z", "M14.2502 5.24992C14.2519 3.98846 13.7977 2.76888 12.9712 1.81592C14.6445 2.25588 16.1709 3.13239 17.3943 4.3558C18.6177 5.57922 19.4942 7.10563 19.9342 8.77892C18.9812 7.9524 17.7616 7.49817 16.5002 7.49992H14.6252C14.4182 7.49992 14.2502 7.33192 14.2502 7.12492V5.24992Z"];
  this.element.innerHTML=
   '<div class="tabbed-main"><div class="risk" hidden><div class="risk-label">RISK <span data-slot="riskPct"></span></div><div class="risk-meter" aria-hidden="true">'+'<i></i>'.repeat(10)+'</div></div>'+
   '<div class="difficulty-row" role="radiogroup" aria-label="Difficulty"></div>'+
   '<div class="bet-grid">'+
    '<div class="wager"><div class="stake" aria-label="Bet amount">'+button('min','MIN')+button('minus','−')+'<div class="wager-amount"><output class="money" data-slot="tbBet"></output></div>'+button('plus','+')+button('max','MAX')+'</div></div>'+
    '<div class="actions">'+button('cash','<span class="action-title">CASH OUT</span><span class="money" data-slot="tbCash"></span>','action cash')+button('go','<span class="money" data-slot="tbGoAmount"></span><span class="action-title" data-slot="tbGoTitle"></span>','action go')+'</div>'+
   '</div></div>'+
   '<div class="tabs">'+button('topbets',icon(trophy),'tab')+button('mybets',icon(receipt),'tab')+button('rulesTab',icon(doc),'tab')+'</div>';
  for(const [a,label] of [['topbets','Top bets'],['mybets','My bets'],['rulesTab','Rules']])this.element.querySelector('[data-action='+a+']').setAttribute('aria-label',label);
  this.slots=Object.fromEntries([...this.element.querySelectorAll('[data-slot]')].map(n=>[n.dataset.slot,n]));
  this.tabs=this.q('.tabs');this.tabs.setAttribute('role','navigation');this.tabs.setAttribute('aria-label','Bet panels');
  this.lastDifficulties='';
 }
 q(sel){return this.element.querySelector(sel)}
 text(key,value){if(this.slots[key].textContent!==String(value))this.slots[key].textContent=value}
 /** One flat state object per frame, the same one the standard controls read. */
 sync(s,features){
  const risk=this.q('.risk');const hasRisk=typeof s.risk==='number';risk.hidden=!hasRisk&&s.game!=='road';risk.style.visibility=hasRisk?'':'hidden';
  if(hasRisk){const pct=Math.round(Math.min(1,Math.max(0,s.risk))*100);this.text('riskPct',pct+' %');const lit=Math.round(pct/10);[...this.q('.risk-meter').children].forEach((seg,i)=>{seg.className=i<lit?'on tier-'+(i<3?'low':i<6?'mid':'high'):''})}
  const names=s.difficulties||[];const key=JSON.stringify(names);
  if(key!==this.lastDifficulties){this.lastDifficulties=key;this.q('.difficulty-row').innerHTML=names.map((n,i)=>'<button type="button" class="button" role="radio" data-action="pickDifficulty" data-value="'+i+'">'+esc(n)+'</button>').join('')}
  this.q('.difficulty-row').hidden=!features.difficulty||names.length===0;
  for(const b of this.q('.difficulty-row').children){const on=Number(b.dataset.value)===s.difficulty;b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-checked',String(on));b.disabled=!s.canBet}
  this.text('tbBet',wager(s.bet));for(const a of ['min','minus','plus','max'])this.q('[data-action='+a+']').disabled=!s.canBet;
  const go=this.q('[data-action=go]');go.disabled=!s.canGo||!!s.win;const asCash=goIsCash(s);go.classList.toggle('cash',asCash);
  const nextLane=s.game==='road'&&s.showCash;this.text('tbGoAmount',(s.game==='road'&&!s.showCash?wager(s.bet):s.goSubtitle)||wager(s.bet));this.slots.tbGoAmount.hidden=nextLane;this.slots.tbGoAmount.classList.toggle('is-label',!!s.showCash);this.text('tbGoTitle',s.goTitle||(nextLane?'GO':'BET'));this.slots.tbGoTitle.classList.toggle('go-label',!!nextLane);
  const cash=this.q('[data-action=cash]');if(s.game==='road'&&cash.nextElementSibling===go)cash.parentElement.append(cash);cash.hidden=!s.showCash;cash.disabled=!s.canCash||!!s.win;this.text('tbCash',money(s.cash));for(const key of ['tbCash','tbGoAmount'])this.slots[key].classList.toggle('long-amount',this.slots[key].textContent.length>8);
  for(const t of this.tabs.children)t.disabled=!!s.win;
 }
}
class MultiBetControls {
 constructor(){
  this.element=document.createElement('section');this.element.className='controls panel multi-bet-controls';this.element.setAttribute('aria-label','Three position betting controls');this.cards={};
  for(const [key,name,amount] of [['left','LEFT WINS',5],['main','MAIN CATCH',8],['right','RIGHT WINS',5]]){
   const el=document.createElement('section');el.className='multi-bet';el.setAttribute('aria-label',name);
   el.innerHTML='<div class="bet-quote">'+name+'<strong>1.00×</strong></div><div class="bet-receipt">Choose your stake</div><div class="stake bet-wager"><button type="button" class="button bet-step" data-step="-1" aria-label="Decrease '+name+' stake">−</button><input class="bet-amount money" aria-label="'+name+' stake in dollars" type="number" inputmode="numeric" min="1" max="1000" step="1" value="'+amount+'"><button type="button" class="button bet-step" data-step="1" aria-label="Increase '+name+' stake">+</button></div><button type="button" class="button action bet-action"><span class="action-title">BET</span><span class="money">'+wager(amount)+'</span></button>';
   this.element.append(el);this.cards[key]={el,input:el.querySelector('input'),button:el.querySelector('.bet-action')};
  }
 }
}
class GameUI {
 /** The brands tokens.css carries, by id; the page-level data-brand attribute selects one. Panels and UI only: the game scene is the game's. */
 static get brands(){return CrashTokens.BRANDS}
 static setBrand(name){if(!(name in CrashTokens.BRANDS))name='default';if(name==='default')delete document.documentElement.dataset.brand;else document.documentElement.dataset.brand=name;return name}
 static get brand(){return document.documentElement.dataset.brand||'default'}
 /** Seasonal accent overlay over the brand; '' means none. */
 static get themes(){return CrashTokens.THEMES[GameUI.brand]||{}}
 static setTheme(name){if(!(name in GameUI.themes))name='';if(name)document.documentElement.dataset.theme=name;else delete document.documentElement.dataset.theme;return name}
 static get theme(){return document.documentElement.dataset.theme||''}
 constructor(host,send,config={}){
  this.host=host;this.send=send;this.config=config;GameUI.setBrand(config.brand||new URLSearchParams(location.search).get('brand')||document.documentElement.dataset.brand||'default');GameUI.setTheme(config.theme||new URLSearchParams(location.search).get('theme')||document.documentElement.dataset.theme||'');this.state={};this.modal='';this.lastFocus=null;this.lastWins='';this.lastHistory='';this.bettingSound=new BettingSound();this.winSound=new WinSound();
  if(!instance&&!config.demo)instance=this;
  host.className='crash-ui';host.innerHTML='<div class="top"><section class="account panel" aria-label="Player and records"><div class="profile"><button class="identity" data-action="account"><span data-slot="avatar"></span><span><strong>You</strong><span class="level" data-slot="level"></span></span></button><div class="balance">'+icon('coin.png')+'<span class="money" data-slot="balance"></span></div><button class="icon-button" data-action="menu" aria-label="Menu">'+icon('menu.svg')+'</button></div><section class="records"><div class="records-heading">'+icon('trophy.svg')+'<span>Your best</span></div><div class="records-line"><span class="money record-value personal" data-slot="personal"></span><div class="record-top"><span class="record-summary-label">Top</span><span class="money record-value" data-slot="top"></span><span class="record-by">by</span><span class="owner-name" data-slot="owner"></span></div></div></section><div class="history" aria-label="Round history"></div></section><section class="winners panel"><div class="wins-head"><strong>Live Wins</strong><span class="online"><span class="dot"></span><span data-slot="online"></span></span><button class="text-button" data-action="wins">See all ›</button></div><div class="wins-list"></div></section></div><div class="bottom"><div class="multiplier"></div><section class="controls panel" aria-label="Bet controls"><div class="settings-row">'+button('auto','<span class="knob" aria-hidden="true"></span><span class="auto-label">Auto</span>','auto')+button('difficulty','<span data-slot="difficulty"></span><svg class="chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 10 8 6 12 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>')+'</div><div class="stake" aria-label="Bet amount">'+button('min','MIN')+button('minus','−')+'<output class="money" data-slot="bet"></output>'+button('plus','+')+button('max','MAX')+'</div><div class="presets"></div><div class="actions">'+button('cash','<span class="action-title">CASH OUT</span><span class="money" data-slot="cash"></span>','action cash')+button('go','<span class="action-title"><span data-slot="playIcon"><svg class="icon" viewBox="0 0 44 44" aria-hidden="true"><path d="M14 7.5 C9.5 5 6 7 6 12 V32 C6 37 9.5 39 14 36.5 L34 25.5 C38.5 23 38.5 21 34 18.5 Z" fill="currentColor"/></svg></span><span data-slot="goTitle"></span></span><span class="money" data-slot="goSubtitle"></span>','action go')+'</div></section></div><button class="dev" data-action="dev" hidden>DEV · UI</button><div class="toast" role="status" hidden></div><div class="modal-layer" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="crash-modal-title"><header><h2 id="crash-modal-title"></h2><button class="icon-button" data-action="close" aria-label="Close">'+icon('close.svg')+'</button></header><div class="modal-body"></div></section></div>';
  // A game whose round climbs a fixed table of steps shows them beside the scene. It is the
  // kit's panel, not the game's canvas, so brands and themes reach it like everything else.
  const ladder=document.createElement('section');ladder.className='ladder';ladder.hidden=true;
  ladder.setAttribute('aria-label','Multiplier steps');ladder.innerHTML='<ol class="ladder-list"></ol>';
  host.querySelector('.modal-layer').before(ladder);
  const account=host.querySelector('.account'),history=host.querySelector('.history'),column=document.createElement('div');
  column.className='account-column';account.before(column);column.append(account,history);
  this.slots=Object.fromEntries([...host.querySelectorAll('[data-slot]')].map(n=>[n.dataset.slot,n]));
  host.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)this.action(b.dataset.action,b.dataset.value);else {const control=e.target.closest('.bet-step,.bet-action');if(control&&!control.disabled)this.bettingSound.play(control.dataset.step==='-1'?'minus':control.dataset.step?'plus':'go')}});
  host.addEventListener('change',e=>{if(e.target.dataset.setting==='sound')this.bettingSound.setEnabled(e.target.checked);if(e.target.dataset.setting)this.send('setting',{key:e.target.dataset.setting,value:e.target.type==='checkbox'?e.target.checked:Number(e.target.value)});if(e.target.dataset.flag)this.send('flag',{key:e.target.dataset.flag,value:e.target.checked})});
  host.querySelector('.modal-layer').addEventListener('click',e=>{if(e.target===e.currentTarget&&this.modal!=='win')this.close()});
  this.keyHandler=e=>{if(!this.modal)return;if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key)&&e.target.matches('[role=radio]')){e.preventDefault();const items=[...e.target.parentElement.querySelectorAll('[role=radio]')];let index=items.indexOf(e.target);index=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'||e.key==='ArrowRight'?1:-1)+items.length)%items.length;items[index].focus();return;}if(e.key==='Escape'&&this.modal!=='win'){e.preventDefault();if(this.betDetail)this.backToBets();else if(this.modal.startsWith('limit:'))this.open('menu');else this.close()}if(e.key==='Tab'&&!this.contextPanel){const items=[...host.querySelectorAll('.modal-layer button,.modal-layer input,.modal-layer select')].filter(n=>!n.disabled&&!n.hidden&&n.getClientRects().length);if(!items.length){e.preventDefault();return}const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};
  document.addEventListener('keydown',this.keyHandler);
  this.outsideMenu=e=>{if(['menu','account'].includes(this.modal)&&this.tabbed&&!this.q('.modal').contains(e.target)&&!this.q('.profile [data-action='+this.modal+']').contains(e.target))this.close(false)};
  document.addEventListener('pointerdown',this.outsideMenu,true);
  this.standardControls=this.q('.controls');this.betSettings=this.q('.settings-row');this.setControlsVariant(config.controlsVariant);
  this.resize=new ResizeObserver(()=>this.layout());this.resize.observe(host);this.resize.observe(host.querySelector('.account'));this.resize.observe(column);this.resize.observe(host.querySelector('.controls'));if(this.multiBet)this.resize.observe(this.multiBet.element);
 }
 setPresentationPreset(name='standard'){
  if(!['standard','tabbed-shell-v1'].includes(name))throw new Error('Unknown presentation preset: '+name);
  if(this.modal)this.close(false);
  this.config.presentationPreset=name;this.setControlsVariant(this.controlsVariant);
  if(this.state.game)this.update(this.state);
 }
 setControlsVariant(variant='standard'){
  if(this.modal)this.close(false);
  this.controlsVariant=variant;
  const tabbed=variant==='tabbed'||this.config.presentationPreset==='tabbed-shell-v1';
  this.host.classList.toggle('has-tabbed-controls',tabbed);
  this.q('.account').setAttribute('aria-label',tabbed?'Player account':'Player and records');
  let back=this.q('.game-back');
  if(tabbed&&!back){back=document.createElement('button');back.type='button';back.className='icon-button game-back';back.dataset.action='leave';back.setAttribute('aria-label','Back to previous page');back.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4m7-7-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';this.q('.profile').prepend(back)}
  if(back)back.hidden=!tabbed;

  if(tabbed&&!this.tabbed){this.tabbed=new TabbedControls();this.q('.bottom').append(this.tabbed.element);this.resize?.observe(this.tabbed.element)}
  if(!tabbed&&this.tabbed){this.resize?.unobserve(this.tabbed.element);this.tabbed.element.remove();this.tabbed=null}
  if(this.tabbed)this.tabbed.element.classList.toggle('navigation-only',variant!=='tabbed');
  const multi=variant==='three-position';
  if(multi&&!this.multiBet){this.multiBet=new MultiBetControls();this.q('.bottom').append(this.multiBet.element);this.resize?.observe(this.multiBet.element)}
  if(multi)this.multiBet.element.prepend(this.betSettings);
  else this.standardControls.prepend(this.betSettings);
  if(!multi&&this.multiBet){this.resize?.unobserve(this.multiBet.element);this.multiBet.element.remove();this.multiBet=null}
  this.standardControls.hidden=multi||variant==='tabbed';
 }
 q(s){return this.host.querySelector(s)}
 features(){return {auto:true,difficulty:true,presets:true,...(this.state?.features||{})}}
 text(key,value){if(this.slots[key].textContent!==String(value))this.slots[key].textContent=value}
 action(action,value){
  this.bettingSound.play(action);
  if(action==='betDetails'){this.showBetDetails(Number(value));return}
  if(action==='betsBack'){this.backToBets();return}
  if(['menu','account'].includes(action)&&this.tabbed&&this.modal===action){this.close();return}
  const tabKind=action==='rulesTab'?'rules':action;
  if(['topbets','mybets','rulesTab'].includes(action)&&this.modal===tabKind&&this.q('.modal-layer').classList.contains('is-tab-view')){this.close();return}
  if(['menu','account','wins','difficulty','dev','rules','topbets','mybets'].includes(action)){this.rulesFrom=action==='rules'?'menu':this.rulesFrom;this.open(action);return}
  // The rules tab opens the same modal as the menu's button, but there is no menu to go back to.
  if(action==='rulesTab'){this.rulesFrom='tab';this.open('rules');return}
  // The tabbed row picks a difficulty in place; nothing to close afterwards.
  if(action==='pickDifficulty'){if(this.state?.canBet)this.send('difficulty',{index:Number(value)});return}
  if(action==='close'){this.close();return}
  if(action==='back'){this.open('menu');return}
  if(action==='limit'){this.open('limit:'+value);return}
  if(action==='chooseLimit'){const [key,raw]=JSON.parse(value);const chosen=key==='theme'?raw:Number(raw);this.state.settings={...this.state.settings,[key]:chosen};this.send('setting',{key,value:chosen});this.open('menu');return}
  if(action==='chooseDifficulty'){this.send('difficulty',{index:Number(value)});this.close();return}
  if(action==='refill'){this.send('refill',{});this.close();return}
  if(action==='preset'){this.send('bet',{value:Number(value)});return}
  this.send(action,{});
 }
 update(s){
  window.CrashI18n?.setGame(s.game);
  this.winSound.update(s);
  this.bettingSound.setEnabled(s.settings?.sound===true);
  this.bettingSound.updateCashReady(s);
  this.state=s;currency=typeof s.currency==='string'?s.currency:'';this.host.hidden=false;this.host.classList.toggle('reduced',!!s.settings?.reduced_motion);
  this.text('level',this.tabbed?'#'+String(s.level||'LVL 1').replace(/^LVL\s*/i,''):s.level||'LVL 1');this.text('balance',s.balanceKnown===false?'—':money(s.balance));this.text('bet',wager(s.bet));

  this.text('personal',money(s.personal));this.text('top',money(s.record?.payout));this.text('owner',s.record?.name||'');this.q('.record-top').title=[s.record?.name,s.record?.date].filter(Boolean).join(' · ');
  const signature=JSON.stringify([s.players,s.record?.name]);if(signature!==this.avatarSignature){this.avatarSignature=signature;this.slots.avatar.innerHTML=avatar('You',s.players)}
  this.text('difficulty',s.difficulties?.[s.difficulty]||'Normal');this.text('cash',money(s.cash));this.text('goTitle',s.goTitle||'PLAY');this.text('goSubtitle',(s.game==='road'&&!s.showCash?wager(s.bet):s.goSubtitle)||wager(s.bet));this.text('online',(s.online||6)+' ONLINE');
  this.q('[data-action=auto]').setAttribute('aria-pressed',String(!!s.auto));
  for(const a of ['auto','difficulty','min','minus','plus','max'])this.q('[data-action='+a+']').disabled=!s.canBet;
  const go=this.q('[data-action=go]');go.disabled=!s.canGo||!!s.win;const asCash=goIsCash(s);go.classList.toggle('cash',asCash);this.slots.playIcon.hidden=asCash;
  const cash=this.q('[data-action=cash]');if(s.game==='road'&&cash.nextElementSibling===go)cash.parentElement.append(cash);cash.hidden=!s.showCash;cash.disabled=!s.canCash||!!s.win; // Button visibility never changes the shared control layout.
  const presets=s.presets||[2,3,8,20];const presetKey=JSON.stringify(presets);if(presetKey!==this.lastPresets){this.lastPresets=presetKey;this.q('.presets').innerHTML=presets.map(v=>'<button class="button" data-action="preset" data-value="'+Number(v)+'">'+esc(wager(v))+'</button>').join('')}
  for(const b of this.q('.presets').children){b.disabled=!s.canBet;b.setAttribute('aria-pressed',String(Number(b.dataset.value)===s.bet))}
  const flags=s.flags||{};this.q('.personal').hidden=false;this.q('.record-top').hidden=false;this.q('.records').hidden=!!this.tabbed||flags.personal_record===false;
  this.q('.winners').hidden=!!this.tabbed||flags.leaderboard===false;this.q('.history').hidden=flags.history===false;this.q('.online').hidden=flags.online_count===false;this.q('.dev').hidden=true;
  this.ladder(s.ladder,flags.multiplier_ladder!==false);
  if(this.tabbed)this.tabbed.sync(s,this.features());
  // Operator features remove whole groups; the grid releases their tracks.
  const features=this.features(),controls=this.multiBet?.element||this.standardControls,settingsVisible=features.auto||features.difficulty;
  // On a phone the preset row stays away unless the embed asks for it (?presets=1): the bet stepper is enough there.
  const presetsShown=features.presets&&(!matchMedia('(max-width:'+(CrashTokens.MODAL_PHONE_BREAKPOINT-1)+'px)').matches||new URLSearchParams(location.search).get('presets')==='1');
  this.q('[data-action=auto]').hidden=!features.auto;this.q('[data-action=difficulty]').hidden=!features.difficulty;this.q('.settings-row').hidden=!settingsVisible;this.q('.presets').hidden=!presetsShown;
  controls.classList.toggle('no-settings',!settingsVisible);controls.classList.toggle('auto-only',features.auto&&!features.difficulty);controls.classList.toggle('difficulty-only',features.difficulty&&!features.auto);controls.classList.toggle('no-presets',!presetsShown);
  const featureKey=JSON.stringify(features);if(featureKey!==this.lastFeatures){const changed=this.lastFeatures!==undefined;this.lastFeatures=featureKey;const modal=this.modal||'';if((modal==='difficulty'&&!features.difficulty)||(modal.startsWith('limit:auto')&&!features.auto))this.close();else if(changed&&modal==='menu')this.open('menu')}
  const winsKey=JSON.stringify(s.wins);if(winsKey!==this.lastWins){this.lastWins=winsKey;this.q('.wins-list').innerHTML=this.winRows((s.wins||[]).slice(0,5));if(this.modal==='wins')this.q('.modal-body').innerHTML=this.winRows(s.wins||[])||'<p class=muted>No wins yet.</p>'}
  const histKey=JSON.stringify(s.history);if(histKey!==this.lastHistory){this.lastHistory=histKey;this.q('.history').innerHTML=(s.history||[]).slice(0,15).map(v=>'<span class="pill tier-'+tintFor(v.multiplier)+'">'+Number(v.multiplier).toFixed(2)+'×</span>').join('')}
  this.q('.multiplier').style.setProperty('--multiplier-color',`var(--${tintFor(s.multiplier)})`);
  this.q('.multiplier').hidden=s.game==='road';this.q('.multiplier').textContent=Number(s.multiplier||1).toFixed(2)+'×';
  this.q('.toast').hidden=!s.toast;this.q('.toast').textContent=s.toast||'';
  if(s.win&&this.modal!=='win')this.open('win');else if(!s.win&&this.modal==='win')this.close();
  if(this.modal==='win'){const total=this.q('.win-total');if(total)total.textContent=money(s.winAmount);const subtitle=this.q('.win-subtitle');if(subtitle)subtitle.textContent=s.winSubtitle||'Well played!'}
  if(this.modal==='difficulty'&&!s.canBet)this.close();
  const transfer=s.winTransferId||0;
  if(this.lastTransferId!==undefined&&transfer!==this.lastTransferId&&s.win){this.winSound.playTransfer();requestAnimationFrame(()=>this.flyWinCoins())}
  this.lastTransferId=transfer;
  if(s.settings?.reduced_motion)this.clearWinCoins();
  this.standardControls.hidden=!!this.multiBet||this.controlsVariant==='tabbed';
  this.layout();
 }
 clearWinCoins(){
  if(this.coinFrame)cancelAnimationFrame(this.coinFrame);
  this.coinFrame=0;this.coinLayer?.remove();this.coinLayer=null;
 }
 flyWinCoins(){
  this.clearWinCoins();
  if(this.modal!=='win'||this.state.settings?.reduced_motion||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const source=this.q('.win-coin'),target=this.q('.balance .icon');
  if(!source||!target)return;
  const layer=document.createElement('div');layer.className='win-coin-flight';layer.setAttribute('aria-hidden','true');this.host.append(layer);this.coinLayer=layer;
  const coins=Array.from({length:CrashTokens.WEB_WIN_COIN_COUNT},()=>{const coin=document.createElement('img');coin.src=base+'assets/icons/coin.png';coin.alt='';layer.append(coin);return coin});
  const start=performance.now();
  const tick=now=>{
   if(!source.isConnected||this.modal!=='win'||this.state.settings?.reduced_motion||matchMedia('(prefers-reduced-motion: reduce)').matches){this.clearWinCoins();return}
   const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
   coins.forEach((coin,i)=>{
    const p=Math.max(0,Math.min(1,(now-start-i*CrashTokens.WEB_WIN_COIN_STAGGER_MS)/CrashTokens.WEB_WIN_COIN_DURATION_MS));
    const t=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    const arc=Math.sin(t*Math.PI),x=a.x+a.width/2+(b.x+b.width/2-a.x-a.width/2)*t+85*Math.sin(i*1.8)*arc;
    const y=a.y+a.height/2+(b.y+b.height/2-a.y-a.height/2)*t-100*arc;
    coin.style.opacity=String(Math.min(t*10,1)*Math.min((1-t)*10,1));
    coin.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) rotate(${arc*(i%2===0?.5:-.5)}rad) scale(${.8+.4*arc})`;
   });
   if(now-start<CrashTokens.WEB_WIN_COIN_DURATION_MS+(coins.length-1)*CrashTokens.WEB_WIN_COIN_STAGGER_MS)this.coinFrame=requestAnimationFrame(tick);else this.clearWinCoins();
  };
  this.coinFrame=requestAnimationFrame(tick);
 }
 radioOption(action,value,selected,title,description='',reward='',rewardLabel=''){
  return '<button type="button" class="radio-option" role="radio" data-action="'+action+'" data-value="'+esc(value)+'" aria-checked="'+selected+'" tabindex="'+(selected?0:-1)+'"><span class="radio-marker" aria-hidden="true"></span><span class="option-details"><span class="option-title">'+esc(title)+'</span>'+(description?'<span class="option-description">'+esc(description)+'</span>':'')+'</span>'+(reward?'<span class="option-reward"><span class="money">'+esc(reward)+'</span><span class="option-caption">'+esc(rewardLabel)+'</span></span>':'')+'</button>';
 }
 limitOptions(){
  const s=this.state,result={auto_steps:{title:'Cash out after',values:[0,3,5,10,15,20],suffix:s.game==='road'?' steps':s.game==='fruits'?' slices':' sec'},auto_cashout:{title:'Cash out at',values:[0,1.25,1.5,2,3,5,10,20],suffix:'×'}};
  // Only for games whose scene actually repaints: Fuel Run draws painted art layers that a
  // palette no longer touches, so the row offered a choice that changed nothing.
  if(!['road','fuel'].includes(s.game))result.theme={title:s.game==='fruits'?'Atmosphere':'Next session atmosphere',values:s.game==='fish'?['Caribbean','Sunset']:s.game==='fruits'?['Tropical','Sunset']:['Treasure','Market'],suffix:''};
  return result;
 }
 limitText(value,suffix){return value===0?'Off':String(value)+suffix}
 limitRow(key,option){const current=this.state.settings?.[key]??option.values[0];return '<div class="setting"><span>'+esc(option.title)+'</span><button class="button flat-button" data-action="limit" data-value="'+key+'">'+esc(this.limitText(current,option.suffix))+' <span aria-hidden="true">›</span></button></div>'}
 winRows(rows){return rows.map(v=>'<div class="winner">'+avatar(v.name,this.state.players)+'<span class="winner-name">'+esc(v.name)+'</span><span class="win-multiple">'+Number(v.multiplier||1).toFixed(2)+'×</span><span class="money">+'+money(v.payout)+'</span></div>').join('')}
 betTable(kind){
  const top=kind==='topbets',s=this.state;
  const rows=top?[...(s.topBets||s.wins||[])].sort((a,b)=>b.payout-a.payout).slice(0,25):[...(s.bets||[])].sort((a,b)=>b.time-a.time);
  this.betRows=rows.map(v=>({...v}));
  const amount=(v,stake=false)=>Number.isFinite(v)?esc(stake?wager(v):money(v)):'—';
  let day='';
  const body=rows.map((v,i)=>{
   const row='<tr class="bet-selectable" data-action="betDetails" data-value="'+i+'">';
   const trigger='<button type="button" class="bet-row-open" data-action="betDetails" data-value="'+i+'" aria-label="View bet details'+(top?' for '+esc(v.name):'')+'">';
   if(top)return row+'<td>'+trigger+'<span class="bet-player">'+avatar(v.name,s.players)+'<span title="'+esc(v.name)+'">'+esc(v.name)+'</span></span></button></td><td>'+amount(v.wager,true)+'</td><td>'+esc(Number(v.multiplier).toFixed(2))+'×</td><td class="bet-prize">'+amount(v.payout)+'</td></tr>';
   const date=new Date(v.time),key=date.toDateString();let heading='';
   if(key!==day){day=key;heading='<tr class="bet-day"><th colspan="3" scope="rowgroup">'+'<time data-date-only datetime="'+date.toISOString()+'">'+esc(date.toLocaleDateString(window.CrashI18n?.locale==='fr'?'fr-FR':'en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'}))+'</time>'+'</th></tr>'}
   return heading+row+'<td>'+trigger+'<time datetime="'+date.toISOString()+'">'+esc(date.toLocaleTimeString(window.CrashI18n?.locale==='fr'?'fr-FR':'en-US',{hour:'numeric',minute:'2-digit'}))+'</time></button></td><td>'+amount(v.wager,true)+'</td><td class="bet-prize">'+(v.payout>0?amount(v.payout):'—')+'</td></tr>';
  }).join('');
  return '<table class="bets-table '+(top?'top-bets':'my-bets')+'"><caption class="bet-caption">'+(top?'Top 25':'My bets')+'</caption><thead><tr><th scope="col">'+(top?'Players':'Time')+'</th><th scope="col">Wager</th>'+(top?'<th scope="col">X</th>':'')+'<th scope="col">Prize</th></tr></thead><tbody>'+body+'</tbody></table>'+(!rows.length?'<p class="bets-empty">No bets yet.</p>':'');
 }
 clearBetDetails(){this.betDetail=null;this.q('.modal').classList.remove('is-bet-detail');this.q('[data-action=betsBack]')?.remove()}
 showBetDetails(index){
  if(this.state.win||!['topbets','mybets'].includes(this.modal)||!this.betRows?.[index]||this.betDetail)return;
  const entry={...this.betRows[index]},body=this.q('.modal-body');
  this.betDetail={html:body.innerHTML,scroll:body.scrollTop,title:this.q('.modal h2').textContent,index};
  const name=entry.name||'You',value=(n,stake=false)=>Number.isFinite(n)?esc(stake?wager(n):money(n)):'—';
  const multiplier=Number.isFinite(entry.multiplier)?entry.multiplier:entry.payout>0&&entry.wager>0?entry.payout/entry.wager:null;
  const date=new Date(entry.time),hasDate=Number.isFinite(entry.time)&&!Number.isNaN(date.getTime());
  const card=(label,text)=>'<div class="bet-detail-card"><strong>'+text+'</strong><span>'+label+'</span></div>';
  this.q('.modal').classList.add('is-bet-detail');this.q('.modal h2').textContent='Bet details';
  const back=document.createElement('button');back.type='button';back.className='icon-button bet-detail-back';back.dataset.action='betsBack';back.setAttribute('aria-label','Back to '+this.betDetail.title);
  back.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4m7-7-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  this.q('.modal header').prepend(back);
  body.innerHTML='<div class="bet-detail-hero"><div class="bet-detail-avatar">'+avatar(name,this.state.players)+(entry.payout>0?'<span class="bet-detail-trophy">'+icon('trophy.svg')+'</span>':'')+'</div></div><div class="bet-detail-divider"><span>'+esc(name)+'</span></div>'+(hasDate?'<p class="bet-detail-date"><time datetime="'+date.toISOString()+'">'+esc(date.toLocaleString(window.CrashI18n?.locale==='fr'?'fr-FR':'en-GB',{weekday:'long',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'}))+'</time></p>':'')+'<div class="bet-detail-grid">'+card('WAGER',value(entry.wager,true))+card('X',multiplier!==null?esc(multiplier.toFixed(2)):'—')+card('PRIZE',value(entry.payout))+'</div><div class="bet-detail-extras">'+(entry.details?.length?entry.details:[{label:'RESULT',value:entry.payout>0?'Won':'Lost'}]).map(detail=>card(esc(detail.label),esc(detail.value))).join('')+'</div>';
  body.scrollTop=0;back.focus();
 }
 backToBets(){
  if(!this.betDetail)return;const previous=this.betDetail;this.clearBetDetails();
  this.q('.modal h2').textContent=previous.title;const body=this.q('.modal-body');body.innerHTML=previous.html;
  body.querySelector('button[data-value="'+previous.index+'"]')?.focus({preventScroll:true});body.scrollTop=previous.scroll;
 }
 open(kind){
  const s=this.state,f=this.features();if(kind==='difficulty'&&(!s.canBet||!f.difficulty))return;if(kind.startsWith('limit:auto')&&!f.auto)return;if(s.win&&kind!=='win')return;
  this.clearBetDetails();
  if(!this.modal)this.lastFocus=document.activeElement;this.modal=kind;this.send('modal',{open:true});
  const layer=this.q('.modal-layer');layer.hidden=false;layer.classList.toggle('is-win',kind==='win');layer.classList.toggle('is-menu-popover',['menu','account'].includes(kind)&&!!this.tabbed);layer.classList.toggle('is-account-popover',kind==='account'&&!!this.tabbed);
  // From the tabbed variant's side buttons these open as a sheet from the right on a wide
  // screen (the CSS decides the breakpoint); the same modal from the menu stays a popup.
  layer.classList.toggle('is-sheet',!!this.tabbed&&(kind==='topbets'||kind==='mybets'||(kind==='rules'&&this.rulesFrom==='tab')));this.q('.modal').classList.toggle('win-modal',kind==='win');
  this.q('.modal h2').textContent={menu:'Menu',account:'Your account',wins:'Live Wins',difficulty:'Choose difficulty',rules:'How to play',dev:'Visible panels',win:'NICE WIN!',topbets:'Top 25',mybets:'My bets'}[kind];
  this.q('[data-action=close]').hidden=kind==='win'&&!this.config.demo;
  const body=this.q('.modal-body');body.classList.toggle('rules-content',kind==='rules');
  if(kind==='difficulty'){
   const content=s.difficultyContent||{};
   body.innerHTML='<p class="modal-description">'+esc(content.description||'Higher risk. Bigger rewards.')+'</p><p class="modal-note">'+esc(content.limits||'')+'</p><div class="option-list" role="radiogroup" aria-label="Difficulty">'+(content.options||[]).map((v,i)=>this.radioOption('chooseDifficulty',i,i===s.difficulty,v.title,v.description,v.reward,v.rewardLabel)).join('')+'</div>';
  }
  if(kind==='menu'&&this.tabbed){body.innerHTML=['sound','music','haptics'].map(k=>'<label class="setting">'+({sound:'Sound',music:'Music',haptics:'Vibration'}[k])+'<input class="switch" type="checkbox" role="switch" data-setting="'+k+'" '+(s.settings?.[k]?'checked':'')+'></label>').join('')+button('refill','Refill to $1,000','flat-button')}
  if(kind==='menu'&&!this.tabbed){
   body.innerHTML=(this.config.menuSettings||['sound','music','haptics']).map(k=>'<label class="setting">'+({sound:'Sound',music:'Music',haptics:'Vibration',reduced_motion:'Reduce motion'}[k])+'<input class="switch" type="checkbox" role="switch" data-setting="'+k+'" '+(s.settings?.[k]?'checked':'')+'></label>').join('');
   const limits=this.limitOptions();
   if(limits.theme)body.innerHTML+=this.limitRow('theme',limits.theme);
   if(f.auto){
    body.innerHTML+='<h3 class="modal-section-title">Auto limits</h3>';
    for(const key of ['auto_steps','auto_cashout'])body.innerHTML+=this.limitRow(key,limits[key]);
    body.innerHTML+='<p class="modal-note"><span>First limit reached cashes out.</span> <span>'+(s.game==='road'?'Auto stops after each round.':'Auto starts the next round until switched off or balance is too low.')+'</span></p>';
   }
   if(this.config.rulesHTML)body.innerHTML+=button('rules','How to play','flat-button');
   if(this.config.refill!==false&&this.state?.refill!==false)body.innerHTML+=button('refill','Refill to $1,000','flat-button');
   body.innerHTML+='<p class="modal-note centered">'+esc(this.config.menuNote||'Progress saved on this device')+'</p>';
  }
  if(kind==='rules')body.innerHTML=(this.rulesFrom==='tab'?'':'<button class="text-button back-button" data-action="back">← Back to menu</button>')+(this.config.rulesHTML||'<p class=muted>No rules provided.</p>');
  if(kind==='topbets'||kind==='mybets')body.innerHTML=this.betTable(kind);
  if(kind.startsWith('limit:')){
   const key=kind.slice(6),option=this.limitOptions()[key];
   this.q('.modal h2').textContent=option.title;
   body.innerHTML='<button class="text-button back-button" data-action="back">← Back to menu</button><div class="option-list" role="radiogroup" aria-label="'+esc(option.title)+'">'+option.values.map(v=>this.radioOption('chooseLimit',JSON.stringify([key,v]),String(s.settings?.[key]??option.values[0])===String(v),this.limitText(v,option.suffix))).join('')+'</div>';
  }
  if(kind==='account'){
   body.innerHTML='<div class="account-summary">'+avatar('You',s.players)+'<div><p>You · Level '+(1+Math.floor((s.xp||0)/10))+'</p><p class="modal-note">'+((s.xp||0)%10)+' / 10 XP</p></div></div>';
   if(this.tabbed)body.innerHTML='';
   const row=(k,v,tone='',monetary=false)=>'<div class="setting"><span>'+esc(k)+'</span><strong class="account-stat '+tone+'">'+esc(v)+(this.tabbed&&monetary?icon('coin.png'):'')+'</strong></div>';
   body.innerHTML+=row('Balance',s.balanceKnown===false?'Not provided by API':money(s.balance),'',true)+row('Personal record',money(s.personal),'gold',true)+'<h3 class="modal-section-title">This session</h3>'+row('Completed rounds',s.rounds||0)+row('Successful cash outs',s.roundWins||0,'success')+row('Best cashed-out multiplier',s.roundWins?Number(s.bestMultiplier||0).toFixed(2)+'×':'—','gold');
  }
  if(kind==='wins')body.innerHTML=this.winRows(s.wins||[])||'<p class=muted>No wins yet.</p>';
  if(kind==='dev')body.innerHTML=Object.entries({leaderboard:'Leaderboard / live wins',history:'Round history',personal_record:'My record',online_count:'Online count',...(s.game==='market_stack'?{multiplier_ladder:'Multiplier ladder'}:{})}).map(([k,v])=>'<label class="setting">'+v+'<input class="switch" type="checkbox" role="switch" data-flag="'+k+'" '+(s.flags?.[k]!==false?'checked':'')+'></label>').join('');
  if(kind==='win'){
   body.innerHTML=(this.tabbed?'<div class="win-emblem" aria-hidden="true"><span class="win-spark win-spark-left">✦</span>':'')+'<img class="win-coin" src="'+base+'assets/icons/coin.png" alt="">'+(this.tabbed?'<span class="win-spark win-spark-right">✦</span></div>':'')+'<div class="win-total">'+money(s.winAmount)+'</div>'+(this.tabbed?'':'<div class="win-subtitle">'+esc(s.winSubtitle||'Well played!')+'</div>');
   if(!s.settings?.reduced_motion){const fx=document.createElement('div');fx.className='confetti';fx.innerHTML=Array.from({length:32},(_,i)=>'<i style="--angle:'+i*13+'deg;--x:'+((Math.random()-.5)*600)+'px;--y:'+(Math.random()*400-240)+'px"></i>').join('');layer.append(fx);setTimeout(()=>fx.remove(),2000)}
  }
  const tabView=!!this.tabbed&&['topbets','mybets','rules'].includes(kind)&&(kind!=='rules'||this.rulesFrom==='tab');
  layer.classList.toggle('is-tab-view',tabView);
  const dialog=this.q('.modal');
  for(const node of [layer,dialog]){node.removeAttribute('role');node.removeAttribute('aria-modal');node.removeAttribute('aria-labelledby')}
  const owner=tabView?layer:dialog;owner.setAttribute('role','dialog');owner.setAttribute('aria-modal','true');owner.setAttribute('aria-labelledby','crash-modal-title');
  this.restoreTabs();
  if(tabView){
   const tabs=this.tabbed.tabs;
   const placeholder=document.createElement('div');placeholder.className='tabs-placeholder';placeholder.style.height=getComputedStyle(this.tabbed.element).getPropertyValue('--web-control-comfort-height');this.tabbed.element.append(placeholder);
   tabs.classList.add('modal-footer');
   for(const b of tabs.children){b.disabled=false;b.setAttribute('aria-pressed',String(b.dataset.action===(kind==='rules'?'rulesTab':kind)))}
   layer.append(tabs);
  }
  this.tabPresentation();
  requestAnimationFrame(()=>{const target=layer.querySelector('button:not([hidden]),input,select');if(target)target.focus();else{this.q('.modal').tabIndex=-1;this.q('.modal').focus()}});
 }
 tabPresentation(){
  const layer=this.q('.modal-layer');
  const contextual=!!this.modal&&layer.classList.contains('is-tab-view')&&innerWidth>=CrashTokens.CRASH_MEDIUM_BREAKPOINT;
  const menuPopover=!!this.modal&&layer.classList.contains('is-menu-popover');
  this.contextPanel=contextual||menuPopover;layer.classList.toggle('is-context-panel',contextual);
  const menu=this.q('.profile [data-action=menu]');
  menu.setAttribute('aria-expanded',String(this.modal==='menu'));menu.setAttribute('aria-haspopup','dialog');
  const account=this.q('.profile [data-action=account]');account.setAttribute('aria-expanded',String(this.modal==='account'));account.setAttribute('aria-haspopup','dialog');
  if(menuPopover){
   const rect=(this.modal==='account'?account:menu).getBoundingClientRect();
   const edge=parseFloat(getComputedStyle(this.host).getPropertyValue('--space-8'));
   const width=this.q('.modal').getBoundingClientRect().width;
   layer.style.setProperty('--account-anchor-left',Math.max(edge,Math.min(rect.left,innerWidth-width-edge))+'px');
   layer.style.setProperty('--menu-anchor-bottom',rect.bottom+'px');layer.style.setProperty('--menu-anchor-right',(innerWidth-rect.right)+'px');
   const refill=this.q('.modal [data-action=refill]');if(refill)refill.disabled=this.config.refill===false||this.state.refill===false||this.state.canBet===false;
  }
  const placeholder=this.tabbed?.q('.tabs-placeholder');
  if(placeholder&&innerWidth<CrashTokens.CRASH_MEDIUM_BREAKPOINT){
   const rect=placeholder.getBoundingClientRect();
   for(const key of ['left','top','width','height'])layer.style.setProperty('--tabs-anchor-'+key,rect[key]+'px');
  }

  if(contextual&&innerWidth>=CrashTokens.CRASH_MEDIUM_BREAKPOINT){
   const rail=this.tabbed.tabs.getBoundingClientRect(),controls=(this.controlsVariant==='tabbed'?this.tabbed.element:this.multiBet?.element||this.standardControls).getBoundingClientRect();
   const css=getComputedStyle(this.host),token=name=>parseFloat(css.getPropertyValue(name));
   const gap=token('--space-8'),edge=token('--space-16'),preferred=token('--modal-max-width-px');
   const left=rail.right+gap,beside=controls.left-left-gap;
   // Prefer the free column beside the betting controls. On narrower screens
   // the window may extend above them, but never across their action buttons.
   const fitsBeside=beside>=6*token('--web-control-comfort-height');
   const width=Math.min(preferred,innerWidth-left-edge,fitsBeside?beside:preferred);
   const actions=(this.controlsVariant==='tabbed'?this.tabbed.q('.actions'):this.multiBet?.element||this.standardControls.querySelector('.actions')).getBoundingClientRect();
   const bottom=fitsBeside?innerHeight-edge:Math.min(innerHeight-edge,actions.top-gap);
   // One height cap across desktop and intermediate layouts; scroll the content.
   const height=Math.min(preferred+2*token('--space-48'),bottom-edge);
   // Keep the panel and navigation on one center, even when space clamps the panel.
   const top=Math.max(edge,Math.min((innerHeight-height)/2,bottom-height));
   layer.style.setProperty('--tab-window-center',(top+height/2)+'px');
   for(const [key,value] of Object.entries({left,top,width,height}))layer.style.setProperty('--tab-window-'+key,value+'px');
  }

  const owner=layer.hasAttribute('role')?layer:this.q('.modal');owner.setAttribute('aria-modal',String(!this.contextPanel));
  for(const n of [this.q('.top'),this.q('.bottom'),this.q('.dev')])n.inert=!!this.modal&&!this.contextPanel;
 }
 restoreTabs(){if(!this.tabbed)return;this.tabbed.q('.tabs-placeholder')?.remove();const tabs=this.tabbed.tabs;tabs.classList.remove('modal-footer');for(const b of tabs.children)b.removeAttribute('aria-pressed');this.tabbed.element.append(tabs)}
 close(restoreFocus=true){this.q('.profile [data-action=account]').setAttribute('aria-expanded','false');this.q('.profile [data-action=menu]').setAttribute('aria-expanded','false');this.clearBetDetails();this.contextPanel=false;this.restoreTabs();this.clearWinCoins();this.modal='';this.q('.modal-layer').hidden=true;for(const n of [this.q('.top'),this.q('.bottom'),this.q('.dev')])n.inert=false;this.send('modal',{open:false});if(restoreFocus&&this.lastFocus?.isConnected)this.lastFocus.focus()}
 /**
  * The steps of a climbing round, highest at the top. `data` is {steps,current}: the
  * multipliers to show and which of them the round stands on. Steps under the current one
  * are already won, so they carry the accent; the ones above are still to come.
  */
 ladder(data,visible){
  const box=this.q('.ladder');
  const on=visible&&!!data&&Array.isArray(data.steps)&&data.steps.length>0;
  box.hidden=!on;
  if(!on)return;
  const key=JSON.stringify(data);if(key===this.lastLadder)return;this.lastLadder=key;
  box.querySelector('.ladder-list').innerHTML=data.steps.map((value,i)=>
   '<li class="ladder-step'+(i===data.current?' is-current':i>data.current?' is-won':i===data.current-1?' is-before':'')+'">'
   +'<span class="ladder-dot"></span><span class="ladder-value">'+esc(Number(value).toFixed(2))+'\u00d7</span></li>').join('');
 }
 layout(){
  const wide=innerWidth>=CrashTokens.CRASH_LAPTOP_BREAKPOINT;
  const winners=this.q('.winners'),top=this.q('.top'),account=this.q('.account');
  const parent=wide?top:account;if(winners.parentElement!==parent){if(wide)top.append(winners);else account.insertBefore(winners,this.q('.records'))}
  const a=this.q('.account-column').getBoundingClientRect(),b=this.q('.bottom').getBoundingClientRect();
  this.host.style.setProperty('--bet-controls-top',b.top+'px');
  this.tabPresentation();
  this.host.style.setProperty('--dev-top',(Math.max(a.bottom,wide?winners.getBoundingClientRect().bottom:0)+8)+'px');
  // The fishing boat occupies the right side; reserve the taller Live Wins panel too.
  const sceneTop=this.state.game==='gold'?account.getBoundingClientRect().bottom:
   ['fish','catch'].includes(this.state.game)&&wide?Math.max(a.bottom,winners.getBoundingClientRect().bottom):a.bottom;
  const bounds={top:Math.round(sceneTop+12),bottom:Math.round(b.top),width:innerWidth,height:innerHeight};
  this.host.style.setProperty('--scene-top',bounds.top+'px');
  this.host.style.setProperty('--scene-bottom',bounds.bottom+'px');
  const key=JSON.stringify(bounds);if(key!==this.lastBounds){this.lastBounds=key;this.send('layout',bounds)}
 }
 destroy(){this.winSound.destroy();this.bettingSound.destroy();this.clearWinCoins();this.resize.disconnect();document.removeEventListener('keydown',this.keyHandler);document.removeEventListener('pointerdown',this.outsideMenu,true);this.host.remove()}
}
let callback=null,instance=null;
window.CrashUI={presentationPresets:Object.freeze({'tabbed-shell-v1':Object.freeze({id:'tabbed-shell-v1',title:'Tabbed shell',version:1,scope:'header-navigation-windows'})}),GameUI,MultiBetControls,connect(fn){callback=fn;if(!instance){const host=document.createElement('div');host.hidden=true;document.body.append(host);instance=new GameUI(host,(action,data)=>callback?.(JSON.stringify({action,...data})));}return true},receive(state){instance?.update(typeof state==='string'?JSON.parse(state):state)},get instance(){return instance}};
})();
