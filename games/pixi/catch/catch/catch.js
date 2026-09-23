(()=>{
'use strict';
const SharedUI=window.CrashUI.GameUI;
let reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const payouts=new CatchPayouts();
const uiFlags={};const sandboxProfile=new URLSearchParams(location.search).get('ui-kit')==='1';
let profile={personal:0,wins:[]};if(!sandboxProfile)try{const saved=JSON.parse(localStorage.getItem('catch-ui-profile'));if(saved&&Number.isFinite(saved.personal)&&Array.isArray(saved.wins))profile=saved;}catch{}
let winEvent=null,winUntil=0,transferId=0;
let callback, state={}, locked=false, feedback="", feedbackUntil=0;
const explain=text=>{feedback=text;feedbackUntil=Date.now()+4500;render();};
const host=document.createElement('div');host.className='crash-ui catch-ui';host.hidden=true;
host.innerHTML=`<div class="catch-shared-mount"></div><dialog class="catch-dialog"><h2>Catch Clash</h2><p><strong>1. Wait for PLACE YOUR BET.</strong> Choose an amount, then press BET on any position. You can choose one, two or all three.</p><p><strong>2. Left / Right:</strong> predict the winning fisherman. These bets settle automatically when the round ends.</p><p><strong>3. Main Catch:</strong> press CASHOUT while the catch grows, before the round ends. If the round ends before you cash out, Main loses.</p><p>CANCEL returns your entire stake before the countdown finishes. Once the round starts, betting is closed until the next round.</p><p>Left and Right settle when the round ends; only one side wins. Main must be cashed out before the round ends. Cashing out Main does not end the duel.</p><p><strong>Main is not a third winner.</strong> Left or Right always wins the duel. Main is an independent cash-out bet.</p><p><strong>Payout includes your stake.</strong> For example, $5 on Left at 2.37× returns $11.85 ($6.85 profit) if Left wins. $8 on Main cashed out at 1.50× returns $12 ($4 profit). Main without a cashout loses even if your chosen side wins.</p><p>Stake: $1–$1,000 per position. Main is automatically cashed out at the 1,000× ceiling. Local demo credits.</p><button class="button" id="catch-close">Close</button></dialog>`;
document.body.append(host);
const $=s=>host.querySelector(s), cards={};
const send=(action,data={})=>{
 if(action==='setting'&&data.key==='reduced_motion'){reduceMotion=!!data.value;if(reduceMotion)clearBetPulses();}
 return callback?.(JSON.stringify({action,...data}));
};
class CatchAccountUI extends SharedUI {
 close(){if(this.modal==='win')winUntil=0;super.close();}
 limitOptions(){return {}; }
 open(kind){
  super.open(kind);
  if(kind==='account'){
   this.q('.modal-body').replaceChildren();
   const balance=document.createElement('p');balance.textContent='Balance: $'+state.balance.toFixed(2);
   const note=document.createElement('p');note.className='modal-note';note.textContent='Catch Clash · demo player';
   this.q('.modal-body').append(balance,note);
  }
 }
}
const accountHost=document.createElement('div');$('.catch-shared-mount').append(accountHost);
const accountUI=new CatchAccountUI(accountHost,(action,data)=>{
 if(action==='layout'){send(action,data);return;}
 if(action==='modal'){accountUI.multiBet.element.inert=!!data.open;return;}
 if(action==='flag'){uiFlags[data.key]=!!data.value;render();return;}
 if(action==='setting'){
  if(data.key==='reduced_motion')reduceMotion=!!data.value;
  send('setting',data);
 }
},{controlsVariant:'three-position',menuSettings:['sound','music'],refill:false,menuNote:'Catch Clash · demo credits',rulesHTML:Array.from($('.catch-dialog').querySelectorAll('p')).map(p=>p.outerHTML).join('')});accountHost.classList.add('catch-shared');
// Reserve the same scene boundary for the large countdown and the smaller multiplier badge.
const multiplierSlot=document.createElement('div');multiplierSlot.className='catch-multiplier-slot';
const multiplierDisplay=accountUI.q('.multiplier');multiplierDisplay.before(multiplierSlot);multiplierSlot.append(multiplierDisplay);
accountUI.q('.top').classList.add('catch-top');accountUI.q('.bottom').classList.add('catch-bottom');

for(const [key,name] of [['left','LEFT WINS'],['main','MAIN CATCH'],['right','RIGHT WINS']]){
 const {el,input,button}=accountUI.multiBet.cards[key];
 el.querySelector('.bet-receipt').remove();
 const value=()=>{let n=Number(input.value);n=Number.isFinite(n)?Math.max(1,Math.min(1000,Math.round(n))):1;input.value=n;return n;};
 input.addEventListener('input',()=>render());
 input.addEventListener('change',()=>{value();render();});
 el.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{input.value=value()+Number(b.dataset.step);value();render();});
 button.onclick=()=>{if(button.disabled)return;
 if(state.phase!=='betting'&&!(key==='main'&&state.phase==='active'&&state.bets.main>0&&!state.collected)){
 explain(state.bets[key]>0?(key==='main'&&state.collected?'Main already cashed out. Left and Right settle when the round ends.':'Your side bet is accepted. It settles automatically when the round ends.'):'Betting is closed for this round. Wait for PLACE YOUR BET, then press BET.');return;
 }
 if(state.phase==='betting'){
 if(state.bets[key]>0)send('cancel',{position:key});else send('bet',{position:key,amount:value(),target:0});
 }else if(key==='main')send('collect');};cards[key]={el,input,button,value};
}
$('#catch-close').onclick=()=>$('.catch-dialog').close();
// Local spectator simulation: presentation only, never sent to the round model.
const demoPlayers=['Maya','Leo','Nina','Alex','Sam','Jo'];
const crowd={round:null,seen:0,totals:{left:0,right:0},people:{left:[],right:[]},flights:new Set(),impacts:new Set()};
const demoWins=demoPlayers.map((name,i)=>({name:name+' · demo',payout:[24,15,32,18,10,45][i],multiplier:[2.4,1.5,4,1.8,2,3][i]}));
function clearBetPulses(){for(const flight of crowd.flights){flight.animation.cancel();flight.node.remove();}crowd.flights.clear();for(const impact of crowd.impacts)impact.cancel();crowd.impacts.clear();}
function showDemoBet(index,side,amount){
 if(reduceMotion||document.hidden||accountUI.modal||locked)return;
 const quote=cards[side].el.querySelector('.bet-quote'),target=quote.getBoundingClientRect();
 const node=document.createElement('div');node.className='catch-bet-pulse';node.dataset.side=side;
 const avatar=document.createElement('span');avatar.className='avatar';avatar.setAttribute('aria-hidden','true');
 avatar.style.setProperty('--avatar-x',((index%3)*50)+'%');avatar.style.setProperty('--avatar-y',index<3?'0%':'100%');
 const value=document.createElement('span');value.textContent='+'+amount;node.append(avatar,value);host.append(node);
 node.style.left=Math.max(8,Math.min(innerWidth-node.offsetWidth-8,target.left+target.width/2-node.offsetWidth/2))+'px';
 node.style.top=(target.top-node.offsetHeight-14)+'px';
 const descent=node.offsetHeight+20;
 const animation=node.animate([{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)',offset:.18},{opacity:1,transform:'translateY(0)',offset:.48},{opacity:0,transform:`translateY(${descent}px)`,offset:1}],{duration:950,easing:'ease-in-out'});
 const flight={node,animation};crowd.flights.add(flight);
 animation.finished.then(()=>{
  if(reduceMotion||document.hidden||accountUI.modal||locked||state.phase!=='betting')return;
  const impact=quote.animate([{backgroundColor:'rgba(255,218,129,.28)',boxShadow:'0 0 18px rgba(255,218,129,.35)'},{backgroundColor:'transparent',boxShadow:'0 0 0 transparent'}],{duration:400,easing:'ease-out'});
  crowd.impacts.add(impact);impact.finished.catch(()=>{}).finally(()=>crowd.impacts.delete(impact));
 }).catch(()=>{}).finally(()=>{node.remove();crowd.flights.delete(flight);});
}
function updateCrowd(){
 if(crowd.round!==state.round){clearBetPulses();crowd.round=state.round;crowd.seen=0;crowd.totals={left:0,right:0};crowd.people={left:[],right:[]};}
 if(locked)return;
 const elapsed=state.phase==='betting'?6-state.remaining:6;
 while(crowd.seen<demoPlayers.length&&elapsed>=.45+crowd.seen*.85){
  const index=crowd.seen++,side=((Number(state.round)+index*3)%4<2)?'left':'right',amount=[5,10,8,20,5,15][index];
  crowd.totals[side]+=amount;crowd.people[side].push(index);
  if(state.phase==='betting'&&elapsed-(.45+index*.85)<.3)showDemoBet(index,side,amount);
 }
 if(state.phase!=='betting'||reduceMotion||accountUI.modal)clearBetPulses();
}
addEventListener('resize',clearBetPulses);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearBetPulses();});
// State arrives every 100 ms. Replacing a button's children between press and release cancels the click,
// so labels update their text nodes in place and only when the text actually changes.
function setAction(button,title,money){
 if(money===null){if(button.children.length||button.textContent!==title)button.textContent=title;return;}
 let t=button.querySelector(':scope>.action-title'),m=button.querySelector(':scope>.money');
 if(!t||!m){button.replaceChildren();t=document.createElement('span');t.className='action-title';m=document.createElement('span');m.className='money';button.append(t,m);}
 if(t.textContent!==title)t.textContent=title;
 if(m.textContent!==money)m.textContent=money;
}
function render(){
 if(!state.game)return;host.hidden=false;locked=!!state.previewLocked;
 accountUI.update({...state,canCash:state.phase==='active'&&state.bets.main>0&&!state.collected,showCash:state.phase==='active'&&state.bets.main>0&&!state.collected,toast:(Date.now()<feedbackUntil?feedback:'')||state.notice||'',win:!!winEvent&&Date.now()<winUntil,winAmount:winEvent?.amount||0,winSubtitle:winEvent?.subtitle||"",winTransferId:transferId,winId:winEvent?.id||0,settings:{sound:!!state.soundOn,music:state.musicOn!==false,reduced_motion:reduceMotion},features:{auto:false,difficulty:false,presets:false},flags:uiFlags,personal:profile.personal,record:{name:'You',payout:profile.personal},wins:[...profile.wins,...demoWins],online:7,players:demoPlayers.map(name=>name+' · demo')});
 const countdown=state.phase==='betting',display=accountUI.q('.multiplier');
 display.classList.toggle('catch-countdown',countdown);
 if(countdown)display.textContent=String(Math.max(0,Math.ceil(state.remaining)));
 display.setAttribute('aria-label',countdown?'Round starts in '+display.textContent+' seconds':'Multiplier '+display.textContent);

 for(const [key,c] of Object.entries(cards)){
 const placed=state.bets[key]>0,editable=state.phase==='betting'&&!placed&&!locked;
 c.el.querySelector('strong').textContent=(key==='main'?state.multiplier:state.odds[key]).toFixed(2)+'×';
 c.input.disabled=!editable;c.el.querySelectorAll('[data-step]').forEach(b=>b.disabled=!editable);
 if(placed)c.input.value=state.bets[key]/100;
 const collect=key==='main'&&state.phase==='active'&&placed&&!state.collected;
 c.button.classList.toggle('action',(state.phase==='betting'&&!placed)||collect);
 c.button.classList.toggle('cash',collect);
 c.button.classList.toggle('bet-cancel',state.phase==='betting'&&placed);c.button.disabled=locked;
 c.button.classList.toggle('bet-info',state.phase!=='betting'&&!collect);
 const paid=state.paid[key]/100;
 c.el.classList.toggle('bet-won',state.phase==='result'&&paid>0);

 if(state.phase==='betting'){
 const amount=placed?state.bets[key]/100:Math.max(1,Math.min(1000,Math.round(Number(c.input.value)||1)));
 setAction(c.button,placed?'CANCEL':'BET','$'+amount.toFixed(2));
 c.button.disabled=locked||(!placed&&Number(c.input.value)>state.balance);
 }
 else if(collect){setAction(c.button,'CASHOUT','$'+(Math.round(state.bets.main*state.multiplier)/100).toFixed(2));}
 else if(key==='main'&&state.collected){setAction(c.button,'CASHED OUT','$'+paid.toFixed(2));}
 else {c.button.disabled=locked;setAction(c.button,key==='main'&&state.collected?'CASHED OUT':state.phase==='result'?(state.paid[key]>0?'+$'+(state.paid[key]/100).toFixed(2):placed?'LOST':'NO BET'):placed?'BET ACCEPTED':'BETTING CLOSED',null);}
 }

 updateCrowd();
 accountUI.layout();
}
window.CrashUI={instance:{state,get config(){return accountUI.config},get controlsVariant(){return accountUI.controlsVariant},get tabbed(){return accountUI.tabbed},setPresentationPreset(name){accountUI.setPresentationPreset(name);render()},send(action,data={}){if(action==='flag'){uiFlags[data.key]=!!data.value;render();}else if(action==='rules'){ accountUI.open('rules');}else if(action==='close'){$('.catch-dialog').close();}else send(action,data);},open(kind){accountUI.open(kind||'menu');},close(){accountUI.close();$('.catch-dialog').close();}},connect(fn){callback=fn;accountUI.layout();},receive(json){state=JSON.parse(json);this.instance.state=state;
 const event=payouts.observe(state);if(event){profile.personal=Math.max(profile.personal,event.amount);profile.wins.unshift({name:'You',payout:event.amount,multiplier:state.multiplier});profile.wins=profile.wins.slice(0,30);if(!sandboxProfile)try{localStorage.setItem('catch-ui-profile',JSON.stringify(profile));}catch{}winEvent=event;winUntil=Date.now()+2400;setTimeout(()=>{if(winEvent?.id===event.id&&Date.now()<winUntil){transferId=event.id;render()}},1580);setTimeout(render,2450);}
 render();}};
})();
