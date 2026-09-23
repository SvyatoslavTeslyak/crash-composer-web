// Pure analysis functions; preview application is a separate startup-only adapter.
export const cents = x => Math.round((x + Number.EPSILON) * 100) / 100;
const floor2 = x => Math.floor(x * 100 + 0.00001) / 100;
export function defaults(base) {
 if(base.model==='runner')return {level:base.defaultLevel,steps:1,bet:base.defaultWager,bankroll:100000,liabilities:0,concurrent:10};
 return {rtp:base.targetReturn, risk:base.risks?.[1]??0.1, steps:base.maxSteps??20,
  goldChance:base.goldChance??0.15,goldBoost:base.goldBoost??3.5,
  maxPayout:base.maxPayout,minBet:base.minBet,maxBet:base.maxBet,bet:8,
  target:2,kind:'normal',bankroll:100000,liabilities:0,concurrent:10};
}
export function validate(c,base) {
 const errors=[];
 if(base.model==='runner'){
  const option=base.payouts.find(p=>p.level===c.level);
  if(!option)errors.push('Choose an available difficulty level.');
  if(!Number.isInteger(c.steps)||c.steps<1||c.steps>(option?.multipliers.length??1)-1||!option?.multipliers.some(r=>r.step===c.steps))errors.push('Choose an available cashout step.');
  if(!base.wagersAllowed.includes(c.bet))errors.push('Choose an allowed server stake: '+base.wagersAllowed.join(', ')+'.');
  for(const key of ['bankroll','liabilities'])if(!Number.isFinite(c[key])||c[key]<0||c[key]>1e12)errors.push(key+': invalid amount.');
  if(!Number.isInteger(c.concurrent)||c.concurrent<1||c.concurrent>100000)errors.push('concurrent: 1–100000.');
  return errors;
 }
 const range=(key,min,max,integer=false)=>{if(typeof c[key]!=='number'||!Number.isFinite(c[key])||c[key]<min||c[key]>max||(integer&&!Number.isInteger(c[key])))errors.push(`${key}: ${min}–${max}${integer?' (integer)':''}`)};
 range('rtp',0.8,0.999);range('risk',0.01,0.6);range('steps',1,base.maxSteps??25,true);
 range('goldChance',0,1);range('goldBoost',1,10);
 range('minBet',0.01,1000);range('maxBet',0.01,100000);range('bet',0.01,100000);
 range('maxPayout',0.01,100000000);range('target',1,1000000);
 range('bankroll',0,1e12);range('liabilities',0,1e12);range('concurrent',1,100000,true);
 if(c.minBet>c.maxBet)errors.push('Minimum bet exceeds maximum bet.');
 if(c.bet<c.minBet||c.bet>c.maxBet)errors.push('Analysis stake must be within bet limits.');
 if(c.maxPayout<c.maxBet)errors.push('Payout cap must cover the maximum stake.');
 if(!['normal','hot'].includes(c.kind))errors.push('Unsupported fruit scenario.');
 if(base.model==='catch'){
  for(const [key,value] of Object.entries({rtp:base.targetReturn,minBet:base.minBet,maxBet:base.maxBet,maxPayout:base.maxPayout}))if(c[key]!==value)errors.push(`${key}: Catch Clash uses the source rule ${value}.`);
  if(c.target>base.maxMultiplier)errors.push(`Catch Clash target cannot exceed ${base.maxMultiplier}×.`);
 }
 for(const k of ['bet','minBet','maxBet','maxPayout','target'])if(Number.isFinite(c[k])&&Math.abs(c[k]*100-Math.round(c[k]*100))>1e-6)errors.push(`${k}: use at most two decimals.`);
 return errors;
}
function summary(outcomes,bet) {
 let mean=0,second=0,paid=0;
 for(const o of outcomes){mean+=o.probability*o.payout;second+=o.probability*o.payout**2;if(o.payout>0)paid+=o.probability;}
 return {rtp:mean/bet,mean,sd:Math.sqrt(Math.max(0,second-mean**2)),paid};
}
export function stepResult(c,n) {
 const probability=(1-c.risk)**n, multiplier=cents(c.rtp/probability);
 const payout=Math.min(c.maxPayout,cents(c.bet*multiplier));
 return {step:n,multiplier,payout, ...summary([{probability,payout}],c.bet)};
}
export function crashResult(c,target) {
 // Revised continuous crash threshold; display rounding never changes the sampled event.
 const effective=Math.min(target,c.maxPayout/c.bet);
 const paidProbability=Math.min(1,c.rtp/effective);
 const payout=target>=c.maxPayout/c.bet?c.maxPayout:Math.min(c.maxPayout,cents(c.bet*floor2(effective)));
 return {step:target,multiplier:floor2(effective),payout,...summary([{probability:paidProbability,payout}],c.bet)};
}
// Rotten core (source constants, not a draft input): a surviving slice that cuts the
// multiplier by a percentage. Golden and rotten share one draw, so rot is capped by 1 − gold.
export const STATE_LIMIT=2000;
export function fruitRot(c,base){return Math.max(0,Math.min(base.rottenChance??0,1-c.goldChance))}
// What a rotten core costs on average at this multiplier. Under the flat rule it cannot take
// more than is there, so near zero the answer is whatever is left; this mirrors the source.
export function rottenCost(base,multiplier){
 if(base.rottenRule!=='flat')return multiplier*(base.rottenPenalty??0);
 const lo=base.rottenDropMin??0,hi=base.rottenDropMax??0;
 if(multiplier<=lo)return Math.max(multiplier,0);
 if(multiplier>=hi)return (lo+hi)/2;
 return ((multiplier*multiplier-lo*lo)/2+multiplier*(hi-multiplier))/(hi-lo);
}
export function fruitGain(c,base,risk,multiplier=1){
 const rot=fruitRot(c,base);
 const lost=multiplier>0?rot*rottenCost(base,multiplier)/multiplier:0;
 return (1/(1-risk)-1+lost)/((1-c.goldChance-rot)+c.goldChance*c.goldBoost);
}
export function fruitResult(c,base,n) {
 // Fixed-kind scenario. Capped outcomes absorb immediately, matching forced cashout after
 // each slice.
 const risk=c.kind==='hot'?Math.min(base.maxRisk,c.risk*base.hotFactor):c.risk;
 const rot=fruitRot(c,base);
 // A flat bite is subtracted, so the order of the slices decides the result and paths can no
 // longer be merged by how many were golden or rotten. The state is the multiplier itself.
 // Equal values collapse; past STATE_LIMIT the lightest are folded into one state carrying
 // their combined probability and their probability-weighted mean, which leaves the expected
 // multiplier exact and costs only a little spread. Without the fold, 25 slices reach millions
 // of states; with it, the same run holds 2000 and agrees with exhaustive enumeration.
 const branches=[[0,1-c.goldChance-rot],[1,c.goldChance],[2,rot]];
 let states=[{m:c.rtp,p:1}],outcomes=[];
 for(let step=1;step<=n;step++){
  const next=new Map();
  for(const state of states){
   const gain=fruitGain(c,base,risk,state.m);
   for(const [kind,chance] of branches){
    const probability=state.p*(1-risk)*chance;
    if(!probability)continue;
    const multiplier=kind===2?Math.max(0,state.m-rottenCost(base,state.m))
     :state.m*(1+(kind===1?gain*c.goldBoost:gain));
    const payout=Math.min(c.maxPayout,cents(c.bet*floor2(multiplier)));
    if(payout>=c.maxPayout||step===n)outcomes.push({probability,payout});
    else{
     // Exact key: rounding it merged multipliers that round to different cents.
     const key=String(multiplier),seen=next.get(key);
     if(seen)seen.p+=probability;else next.set(key,{m:multiplier,p:probability});
    }
   }
  }
  states=[...next.values()];
  if(states.length>STATE_LIMIT){
   states.sort((a,b)=>b.p-a.p);
   const tail=states.slice(STATE_LIMIT-1);states=states.slice(0,STATE_LIMIT-1);
   const p=tail.reduce((sum,s)=>sum+s.p,0);
   if(p>0)states.push({m:tail.reduce((sum,s)=>sum+s.p*s.m,0)/p,p});
  }
 }
 return {step:n,multiplier:null,payout:null,...summary(outcomes,c.bet)};
}
export function exposure(c,base) {
 // Bound covers all allowed outcomes, not merely the selected cashout scenario.
 let possible;
 if(base.model==='steps')possible=cents(c.rtp/(1-c.risk)**base.maxSteps);
 else if(base.model==='fruits'){
  const risk=Math.min(base.maxRisk,c.risk*base.hotFactor);
  const gain=fruitGain(c,base,risk);
  possible=floor2(c.rtp*(1+gain*(c.goldChance>0?c.goldBoost:1))**base.maxSteps);
 }else possible=Infinity; // Conservative payout cap bound for continuous games.
 const single=Math.min(c.maxPayout,Number.isFinite(possible)?cents(c.maxBet*possible):c.maxPayout);
 const gross=single*c.concurrent,available=Math.max(0,c.bankroll-c.liabilities);
 return {single,gross,available,shortfall:Math.max(0,c.liabilities+gross-c.bankroll),covered:single?Math.floor(available/single):0};
}
export function analyze(c,base) {
 const errors=validate(c,base);if(errors.length)return {errors};
 if(base.model==='runner')return analyzeRunner(c,base);
 if(base.model==='catch')return analyzeCatch(c,base);
 const rows=base.model==='crash'?[...new Set([1,1.1,1.5,2,3,5,10,25,50,100,c.target])].sort((a,b)=>a-b).map(t=>crashResult(c,t)):
 Array.from({length:c.steps},(_,i)=>base.model==='steps'?stepResult(c,i+1):fruitResult(c,base,i+1));
 return {errors:[],rows,selected:base.model==='crash'?crashResult(c,c.target):rows.at(-1),exposure:exposure(c,base)};
}

export function analyzeCatch(c,base) {
 const at=t=>{
  const probability=base.targetReturn/t,payout=Math.min(base.maxPayout,cents(c.bet*floor2(t)));
  return {step:t,payout,time:Math.log(t)/base.growth,...summary([{probability,payout}],c.bet)};
 };
 const sides=base.probabilities.map(p=>{
  const leftOdds=floor2(base.targetReturn/p),rightOdds=floor2(base.targetReturn/(1-p));
  const leftPayout=Math.min(base.maxPayout,cents(c.bet*leftOdds)),rightPayout=Math.min(base.maxPayout,cents(c.bet*rightOdds));
  const combined=summary([{probability:p,payout:leftPayout},{probability:1-p,payout:rightPayout}],2*c.bet);
  return {p,leftOdds,rightOdds,leftPayout,rightPayout,leftRtp:p*leftPayout/c.bet,rightRtp:(1-p)*rightPayout/c.bet,combined};
 });
 const selected=at(c.target),rows=[...new Set([1,1.1,1.5,2,3,5,10,25,100,1000,c.target])].sort((a,b)=>a-b).map(at);
 const sideMean=sides.reduce((n,r)=>n+r.combined.mean,0)/sides.length;
 const maxSideOdds=Math.max(...sides.flatMap(r=>[r.leftOdds,r.rightOdds]));
 const single=Math.min(base.maxPayout,cents(base.maxBet*base.maxMultiplier))+Math.min(base.maxPayout,cents(base.maxBet*maxSideOdds));
 const gross=single*c.concurrent,available=Math.max(0,c.bankroll-c.liabilities);
 return {errors:[],rows,selected,sides,combined:{stake:3*c.bet,mean:selected.mean+sideMean,rtp:(selected.mean+sideMean)/(3*c.bet)},exposure:{single,gross,available,shortfall:Math.max(0,c.liabilities+gross-c.bankroll),covered:Math.floor(available/single)}};
}

// The API publishes payout tables, but not per-step probability tables or RTP.
// Do not infer probabilities from multipliers: admin generation parameters are absent.
export function analyzeRunner(c,base) {
 const option=base.payouts.find(p=>p.level===c.level);
 const rows=option.multipliers.filter(r=>r.step>0&&r.step<=c.steps).map(r=>({step:r.step,multiplier:r.multiplier,payout:cents(c.bet*r.multiplier),risk:null,nextRisk:null,paid:null,rtp:null}));
 const single=Math.max(0,...option.multipliers.filter(r=>r.step>0).map(r=>cents(base.maxBet*r.multiplier)));
 const gross=single*c.concurrent,available=Math.max(0,c.bankroll-c.liabilities);
 return {errors:[],rows,selected:rows.at(-1),exposure:{single,gross,available,shortfall:Math.max(0,gross-available)}};
}
export function runnerBase(config,mode='live'){
 const levels=['EASY','MEDIUM','HARD'];
 if(!Array.isArray(config?.payouts)||!config.payouts.length)throw Error('Invalid Runner configuration.');
 const payouts=config.payouts.map(p=>{
  if(!levels.includes(p?.level)||!Array.isArray(p.multipliers))throw Error('Invalid Runner level.');
  const multipliers=[...p.multipliers].sort((a,b)=>a?.step-b?.step);
  if(multipliers.length<2||multipliers[0]?.multiplier!==1||multipliers.some((r,i)=>r?.step!==i||!Number.isFinite(r.multiplier)||r.multiplier<=0))throw Error('Incomplete Runner payout table.');
  return {level:p.level,multipliers};
 }).sort((a,b)=>levels.indexOf(a.level)-levels.indexOf(b.level));
 if(new Set(payouts.map(p=>p.level)).size!==payouts.length)throw Error('Duplicate Runner level.');
 const wager=config.wagerConfigurations?.[0],allowed=wager?.wagersAllowed;
 if(!Array.isArray(allowed)||!allowed.length||allowed.some(n=>!Number.isFinite(n)||n<=0))throw Error('Invalid Runner wagers.');
 const defaultLevel=payouts.some(p=>p.level===config.defaultLevel)?config.defaultLevel:payouts[0].level;
 return {name:'Goat Road',model:'runner',maxSteps:Math.max(...payouts.map(p=>p.multipliers.length-1)),payouts,defaultLevel,wagersAllowed:allowed,defaultWager:allowed.includes(wager.defaultWager)?wager.defaultWager:allowed[0],currency:wager.currency,minBet:Math.min(...allowed),maxBet:Math.max(...allowed),configurationId:config.id,apiMode:mode};
}
