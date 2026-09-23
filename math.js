import {defaults,analyze,validate,runnerBase} from './math-model.mjs';
const $=s=>document.querySelector(s);
const snapshot=await fetch(new URL('math-baseline.json',import.meta.url),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Math snapshot unavailable');return r.json()});

let runnerError='';
const offlineRoad=structuredClone(snapshot.games.road);
async function refreshRunner(){
 snapshot.games.road=structuredClone(offlineRoad);
 try{
  if(!window.Lotomobil?.connected)throw Error('Demo mode · log in to Lotomobil to load the current server configuration.');
  const configs=await window.Lotomobil.request('/v1/betting/runner/game-configurations?type=RUNNER');
  snapshot.games.road=runnerBase(configs[0],window.Lotomobil.mode);runnerError='';
 }catch(error){runnerError=error.message}
}
await refreshRunner();
const storeKey='crash-composer-math-v1',pinKey='crash-composer-math-pin-v1';
let saved={};try{const value=JSON.parse(localStorage.getItem(storeKey)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))saved=value}catch{}
let pinned={};try{const value=JSON.parse(localStorage.getItem(pinKey)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))pinned=value}catch{}
// A pinned baseline belongs to one engine: the whole point of pinning during the port is
// to record what Godot produced and see whether the PixiJS build still matches it.
const pinId=()=>game.value+'@'+(window.ComposerTarget?.engine||'pixi');
const pin=()=>{const kept=pinned[pinId()];return kept&&validate(kept,base()).length===0?kept:null};
const storePins=()=>{try{localStorage.setItem(pinKey,JSON.stringify(pinned))}catch{}};
// The analysed game is the global Composer target; Math has no picker of its own.
const game={get value(){return window.ComposerTarget.value},set value(id){window.ComposerTarget.set(id)}};
const controls=$('#math-controls'),report=$('#math-report');
let draft;
const fields=[
 ['rtp','Target RTP %',80,99.9,0.1],['minBet','Min stake',0.01,1000,0.01],['maxBet','Max stake',0.01,100000,0.01],['maxPayout','Payout cap',0.01,100000000,0.01],
 ['bet','Test stake',0.01,100000,0.01],['target','Exit at ×',1,1000000,0.01],['steps','Exit at step',1,25,1],['risk','Crash / step %',1,60,0.1],
 ['goldChance','Gold chance %',0,100,0.1],['goldBoost','Gold gain ×',1,10,0.1],
 ['bankroll','Liquid funds',0,1e12,1],['liabilities','Other liabilities',0,1e12,1],['concurrent','Open rounds',1,100000,1]
];
const percentFields=['rtp','risk','goldChance'];
const base=()=>snapshot.games[game.value];
const modelled=()=>Object.hasOwn(snapshot.games,game.value);
const pct=n=>(100*n).toFixed(3)+'%';
const money=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
for(const [key,label,min,max,step] of fields){
 const row=document.createElement('label');row.className='property';row.dataset.mathField=key;
 row.append(document.createTextNode(label));const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=step;input.dataset.math=key;row.append(input);
 $('#math-'+(['bankroll','liabilities','concurrent'].includes(key)?'liquidity':['risk','goldChance','goldBoost'].includes(key)?'mechanics':'inputs')).append(row);
 input.addEventListener('input',()=>{draft[key]=input.value===''?NaN:Number(input.value)/(percentFields.includes(key)?100:1);render()});
}
function fill(){
 const runner=base().model==='runner';
 $('#math-risk-preset').innerHTML=runner?base().payouts.map(p=>`<option value="${p.hazardCount}">${p.hazardCount} hazards</option>`).join(''):'<option value="0">Easy</option><option value="1">Normal</option><option value="2">Hard</option><option value="3">Expert</option><option value="custom">Custom</option>';
 if(runner){
  $('#math-mode-note').textContent=(base().apiMode==='mock'?'Local Runner mock':'Runner API')+' configuration · analysis uses published multipliers. Inputs do not change server rules.';
  for(const row of controls.querySelectorAll('[data-math-field]')){const key=row.dataset.mathField;row.hidden=!['bet','steps','bankroll','liabilities','concurrent'].includes(key);row.querySelector('input').disabled=false;}
  for(const input of controls.querySelectorAll('[data-math]'))if(Number.isFinite(draft[input.dataset.math]))input.value=draft[input.dataset.math];
  controls.querySelector('[data-math=steps]').max=base().laneCount;
  controls.querySelector('[data-math=bet]').min=base().minBet;controls.querySelector('[data-math=bet]').max=base().maxBet;
  $('#math-risk-preset').value=String(draft.hazards);
  $('#math-kind-row').hidden=true;$('#math-mechanics').hidden=false;$('#math-apply').hidden=true;$('#math-source').hidden=true;
  return;
 }

 controls.querySelector('[data-math=bet]').min=0.01;controls.querySelector('[data-math=bet]').max=100000;
 $('#math-mode-note').textContent=base().model==='catch'?'Source rules with local stake and cashout analysis. Changes do not affect the game.':'Draft analysis. Changes are saved locally. Apply explicitly to an isolated game preview.';
 for(const input of controls.querySelectorAll('[data-math]')){const key=input.dataset.math;input.value=Number((draft[key]*(percentFields.includes(key)?100:1)).toFixed(8));}
 $('#math-kind').value=draft.kind;
 for(const row of controls.querySelectorAll('[data-math-field]')){
  const key=row.dataset.mathField;
  if(base().model==='catch'){row.hidden=!['rtp','minBet','maxBet','maxPayout','bet','target','bankroll','liabilities','concurrent'].includes(key);row.querySelector('input').disabled=['rtp','minBet','maxBet','maxPayout'].includes(key);continue;}
  row.querySelector('input').disabled=false;
  row.hidden=(key==='target'&&base().model!=='crash')||(['risk','steps'].includes(key)&&base().model==='crash')||(['goldChance','goldBoost'].includes(key)&&base().model!=='fruits');
 }
 $('#math-kind-row').hidden=base().model!=='fruits';
 $('#math-mechanics').hidden=['crash','catch'].includes(base().model);
 $('#math-apply').hidden=base().model==='catch';
 $('#math-source').hidden=base().model==='catch';
 controls.querySelector('[data-math=target]').max=base().maxMultiplier??1000000;
 controls.querySelector('[data-math=steps]').max=base().maxSteps??25;
}
function unsupported(){
 const title=window.ComposerTarget.entry().title;
 controls.querySelectorAll('.toolbar,details').forEach(node=>node.hidden=true);
 report.innerHTML='<div class="math-card"><h2>No model for '+title+'</h2><p>Math covers Goat Road, Fish Master, Goat Gold, Explosive Fruits and Catch Clash. Choose one of those above, or use Layout and Sound effects for '+title+'.</p></div>';
}
function load(){if(!modelled()){unsupported();return}
 controls.querySelectorAll('.toolbar,details').forEach(node=>node.hidden=false);
 const current=saved?.[game.value];draft=current&&validate(current,base()).length===0?{...current}:defaults(base());fill();render();}
function metric(label,value){return `<div class="math-metric"><span>${label}</span><b>${value}</b></div>`}
function renderRunner(){
 const result=analyze(draft,base());$('#math-error').textContent=result.errors.join('\n');$('#math-export').disabled=!!result.errors.length;
 if(result.errors.length){report.innerHTML='<div class="math-card"><h2>Invalid configuration</h2><p>'+result.errors.join(' ')+'</p></div>';return;}
 saved[game.value]={...draft};try{localStorage.setItem(storeKey,JSON.stringify(saved))}catch{}
 const {selected:r,rows,exposure:e}=result;
 report.innerHTML=`<div class="math-card"><span class="math-tag">${base().apiMode==='mock'?'LOCAL MOCK':'RUNNER API'} · CONFIG ${base().configurationId}</span><h2>Goat Road — Runner mathematics</h2><p>${base().laneCount} lanes, ${draft.hazards} hazards. Hazards are drawn without replacement. Published multipliers are used exactly. Allowed stakes: ${base().wagersAllowed.join(', ')} ${base().currency||''}.</p><div class="math-grid">${metric('RTP at selected step',pct(r.rtp))}${metric('Payout chance',pct(r.paid))}${metric('Gross payout on success',money(r.payout))}${metric('Next step risk after survival',pct(r.nextRisk))}</div></div>
 <div class="math-card"><h3>Cashout by step</h3><div class="math-scroll"><table class="math-table"><thead><tr><th>Step</th><th>Step risk</th><th>Survival</th><th>Multiplier</th><th>Payout</th><th>RTP</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.step}</td><td>${pct(r.risk)}</td><td>${pct(r.paid)}</td><td>${r.multiplier.toFixed(2)}×</td><td>${money(r.payout)}</td><td>${pct(r.rtp)}</td></tr>`).join('')}</tbody></table></div><p>Fixed cashout step, conditional risks ${draft.hazards} / remaining lanes. A step beyond the safe-lane count has zero survival probability. Gross payouts round to cents. The API configuration does not publish a payout cap; none is assumed here.</p></div>
 <div class="math-card"><h3>Payout exposure</h3><div class="math-grid">${metric('Maximum reachable payout · selected hazards',money(e.single))}${metric('Concurrent gross payouts',money(e.gross))}${metric('Available funds',money(e.available))}${metric('Shortfall',money(e.shortfall))}</div><p>Uses maximum allowed stake and reachable table rows for this hazard count.</p></div>`;
}
function renderCatch(result){
 const {selected,sides,rows,combined,exposure:e}=result;
 report.innerHTML=`<div class="math-card"><span class="math-tag">SOURCE RULES · ANALYSIS</span><h2>Catch Clash — mathematics</h2><p>Main Catch is a cashout bet. Left and Right predict one shared winner. The winner and crash threshold use separate random draws. Boat motion and demo players do not affect either outcome.</p><p>Change the test stake or cashout target to explore the model. These analysis inputs do not change the running game.</p><div class="math-grid">${metric('Main RTP · selected target',pct(selected.rtp))}${metric('Main payout chance',pct(selected.paid))}${metric('Main payout on success',money(selected.payout))}${metric('Time to target',selected.time.toFixed(2)+' s')}</div></div>
 <div class="math-card"><h3>Left / Right odds</h3><p>Each of these five probability pairs is selected equally often. Displayed odds are rounded down: floor(0.95 / probability × 100) / 100. Gross payout includes the stake and rounds to cents.</p><div class="math-scroll"><table class="math-table"><thead><tr><th>Left chance</th><th>Right chance</th><th>Left odds</th><th>Right odds</th><th>Left RTP</th><th>Right RTP</th></tr></thead><tbody>${sides.map(r=>`<tr><td>${pct(r.p)}</td><td>${pct(1-r.p)}</td><td>${r.leftOdds.toFixed(2)}×</td><td>${r.rightOdds.toFixed(2)}×</td><td>${pct(r.leftRtp)}</td><td>${pct(r.rightRtp)}</td></tr>`).join('')}</tbody></table></div><p>Betting on both sides pays only the winner. It does not eliminate the loss from the house edge.</p></div>
 <div class="math-card"><h3>Main Catch distribution</h3><p>Crash = max(1, 0.95 / U). With a continuous uniform U, 5% of rounds end immediately at 1×. For target x from 1× to 1,000×, P(payout) = 0.95 / x. A crash at the exact target wins the tie. At the 1,000× ceiling the surviving Main bet cashes out automatically.</p><div class="math-scroll"><table class="math-table"><thead><tr><th>Target</th><th>Time</th><th>Payout chance</th><th>Mean payout</th><th>RTP</th><th>Std. deviation</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.step}×</td><td>${r.time.toFixed(2)} s</td><td>${pct(r.paid)}</td><td>${money(r.mean)}</td><td>${pct(r.rtp)}</td><td>${money(r.sd)}</td></tr>`).join('')}</tbody></table></div><p>Multiplier = exp(0.18 × time). Calculations assume a fixed target and continuous RNG approximation. Manual cashout latency can change the achieved target; the HUD rounds down to two decimals.</p></div>
 <div class="math-card"><h3>Three equal stakes</h3><p>One stake of ${money(draft.bet)} on each position, with Main exiting at ${draft.target}×. Averaged across the five probability pairs.</p><div class="math-grid">${metric('Total stake',money(combined.stake))}${metric('Expected gross payout',money(combined.mean))}${metric('Combined RTP',pct(combined.rtp))}${metric('Expected net result',money(combined.mean-combined.stake))}</div></div>
 <div class="math-card"><h3>Maximum payout exposure</h3><p>One player with maximum stakes on all three positions can receive Main plus one winning side. Left and Right cannot both win. Open rounds below means concurrent player bet bundles.</p><div class="math-grid">${metric('Maximum per player bundle',money(e.single))}${metric('Concurrent gross bound',money(e.gross))}${metric('Available funds',money(e.available))}${metric('Shortfall at this bound',money(e.shortfall))}</div><p>Each position has a ${money(base().maxPayout)} payout cap. This is a maximum-outcome bound, not a prediction.</p></div>
 <div class="math-card"><h3>Source model</h3><p>Local demo settlement uses Godot RNG. These are analytical calculations from the source, not measured session returns.</p><details><summary>Source fingerprints</summary>${base().sources.map(s=>`<p><code>${s.path}</code><br><small>${s.sha256}</small></p>`).join('')}</details></div>`;
}
function render(){
 const pinButton=$('#math-pin');
 if(pinButton){const same=pin()&&JSON.stringify(pinned[pinId()])===JSON.stringify(draft);pinButton.textContent=same?'Clear pinned baseline':'Pin as baseline';pinButton.hidden=['runner','catch'].includes(base().model)}
 if(base().model==='runner'){renderRunner();return;}

 if(game.value==='road'&&runnerError)$('#math-mode-note').textContent='Offline source model · '+runnerError;
 const riskIndex=base().risks?.findIndex(n=>Math.abs(n-draft.risk)<1e-9)??-1;
 $('#math-risk-preset').value=riskIndex<0?'custom':String(riskIndex);
 const result=analyze(draft,base()),error=$('#math-error');error.textContent=result.errors.join('\n');$('#math-export').disabled=result.errors.length>0;$('#math-apply').disabled=result.errors.length>0;
 if(result.errors.length){report.innerHTML='<div class="math-card"><h2>Invalid configuration</h2><p>Correct the highlighted input constraints. Previous results are not displayed for an invalid draft.</p></div>';return;}
 saved[game.value]={...draft};try{localStorage.setItem(storeKey,JSON.stringify(saved))}catch{}
 if(base().model==='catch'){renderCatch(result);return;}
 const baseline=analyze({...defaults(base()),bet:Math.min(base().maxBet,Math.max(base().minBet,draft.bet)),steps:Math.min(draft.steps,base().maxSteps??25),target:draft.target,kind:draft.kind},base());
 const {rows,selected,exposure:e}=result;
 const changed=Object.keys(defaults(base())).some(k=>draft[k]!==defaults(base())[k]);
 const fruit=base().model==='fruits',crash=base().model==='crash';
 const note=fruit?'Fixed '+draft.kind+' fruit on every slice. Exact branch probabilities for this scenario, including golden outcomes and early cap cashouts. Live waves mix hidden types; this is not the full live-game RTP or an optimal-strategy proof.':crash?'Uses the revised continuous crash threshold with crash-wins-ties and a continuous-uniform RNG approximation. Difficulty changes speed, not the crash distribution. A payout cap can force an earlier exit.':'Fixed cashout step, independent identical step risks. Multiplier rounds to nearest 0.01; payout rounds to cents. The cap is included.';
 const kept=pin(),keptResult=kept?analyze(kept,base()):null;
 const keptRows=keptResult&&!keptResult.errors.length?keptResult.rows:[];
 const all=[draft.rtp,...rows.map(r=>r.rtp),...keptRows.map(r=>r.rtp)];
 const lo=Math.max(0,Math.min(...all)-.002),hi=Math.max(...all)+.002;
 const chartY=y=>112-(y-lo)/(hi-lo)*90;
 const line=source=>source.map((r,i)=>`${55+i*590/Math.max(1,source.length-1)},${chartY(r.rtp)}`).join(' ');
 const chartPoints=line(rows),keptPoints=keptRows.length?line(keptRows):'';
 report.innerHTML=`<div class="math-card"><span class="math-tag">${changed?'DRAFT SCENARIO':'SOURCE DEFAULTS'} · ANALYSIS ONLY · NOT CERTIFIED</span><h2>${base().name} — mathematics</h2><p>${note}</p><p class="math-note">Edits remain drafts until Apply to game preview. Application starts an isolated test wallet and locks the selected risk. Fruit previews use the chosen fixed fruit scenario. Exit settings prefill Auto; enable Auto to follow them. Bankroll and liabilities are analysis-only.</p>
 <div class="math-grid">${metric('Target return before rounding / caps',pct(draft.rtp))}${metric('Calculated return · selected exit',pct(selected.rtp))}${metric('House edge · selected exit',pct(1-selected.rtp))}${keptResult&&!keptResult.errors.length?metric('Pinned baseline · selected exit',pct(keptResult.selected.rtp)+' <i>'+(selected.rtp>=keptResult.selected.rtp?'+':'−')+pct(Math.abs(selected.rtp-keptResult.selected.rtp)).replace('%','')+' pp</i>'):metric('Source Normal · same exit / stake',pct(baseline.selected.rtp))}</div>${rows.some(r=>r.rtp>1)?'<p class="math-note">Some listed strategies exceed 100% RTP after rounding. Review this draft before deployment.</p>':''}</div>
 <div class="math-card"><h3>Cashout strategy comparison</h3><small>Zoomed RTP axis · dashed line = configured target${keptPoints?' · amber = pinned baseline':''}</small><svg class="math-chart" viewBox="0 0 680 130" role="img" aria-label="Calculated RTP by cashout exit. Dashed line is target RTP."><line x1="55" x2="645" y1="${chartY(draft.rtp)}" y2="${chartY(draft.rtp)}"/>${keptPoints?`<polyline class="math-pinned" points="${keptPoints}"/>`:''}<polyline points="${chartPoints}"/><text x="0" y="22">${pct(hi)}</text><text x="0" y="112">${pct(lo)}</text><text x="55" y="128">Earlier exit</text><text x="570" y="128">Later exit</text></svg><div class="math-scroll"><table class="math-table"><thead><tr><th>${crash?'Exit ×':'Exit step'}</th><th>Any payout chance</th><th>Mean payout</th><th>RTP</th><th>Payout std. dev.</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.step}</td><td>${pct(r.paid)}</td><td>${money(r.mean)}</td><td>${pct(r.rtp)}</td><td>${money(r.sd)}</td></tr>`).join('')}</tbody></table></div><p>Mean and standard deviation are per accepted stake, including zero payouts. Values use currency units, not a configured real-money wallet. These are expectations, not guaranteed session results.</p></div>
 <div class="math-card"><h3>Liquidity stress bound</h3><div class="math-grid">${metric('Maximum single gross payout bound',money(e.single))}${metric('Concurrent gross payout bound',money(e.gross))}${metric('Available after other liabilities',money(e.available))}${metric('Additional funds to cover this bound',money(e.shortfall))}</div><p>${e.covered} maximum-payout rounds covered by the available funds. Assumes every open round pays its maximum, so this bound also covers correlated outcomes. Other liabilities exclude the open-round payouts counted here. No future deposits or unreceived stakes are counted.</p><p class="math-note">For step games this bound uses all ${base().maxSteps??"available"} allowed steps, not the selected exit. It covers the selected risk configuration; a different difficulty or rule set requires its own assessment. This is not VaR, a ruin probability, a solvency assessment or a recommended reserve.</p></div>
 <div class="math-card"><h3>Source audit & production gaps</h3><ul><li>Current models execute and settle in the client using Godot RNG and local profiles.</li><li>All four source targets are 95%; actual return depends on rounding, caps and strategy.</li><li>Fish Master / Goat Gold: continuous crash thresholds remove the former extra edge from the 0.01 crash grid.</li><li>Explosive Fruits: hidden types depend on wave progression. Mixed-wave and adaptive-strategy analysis remains outstanding.</li><li>Real-money readiness requires server settlement, a durable wallet ledger, recoverable rounds, controlled versioned releases, RNG review and independent jurisdiction-specific testing.</li></ul><p>Audit scope: round formulas, start/cashout paths, local persistence and fruit type selection. No claim of complete security or certification audit.</p><details><summary>Source fingerprints</summary><p>Snapshot check: ${snapshot.sourceVerification??"source-files"}.</p><p>Fingerprints describe source files at the last composer build; they do not verify that a live web export was rebuilt from those files.</p>${base().sources.map(s=>`<p><code>${s.path}</code><br><small>${s.sha256}</small></p>`).join('')}</details><p>Reference: <a href="https://www.gamblingcommission.gov.uk/manual/guidance-to-licensing-authorities/rts-7-generation-of-random-outcomes" target="_blank" rel="noopener">UKGC random outcomes</a> · <a href="https://www.gamblingcommission.gov.uk/strategy/testing-strategy-for-compliance-with-remote-gambling-and-software-technical/5-live-rtp-monitoring" target="_blank" rel="noopener">RTP monitoring</a>. Requirements depend on the target jurisdiction.</p></div>`;
}
$('#math-risk-preset').onchange=e=>{if(base().model==='runner'){draft.hazards=Number(e.target.value);render();return;}if(e.target.value==='custom')return;draft.risk=base().risks[Number(e.target.value)];fill();render()};
$('#math-apply').onclick=()=>{
 try{
  if(['catch','runner'].includes(base().model)||validate(draft,base()).length)return;
  const config={version:2,game:game.value};
  for(const k of ['rtp','risk','goldChance','goldBoost','minBet','maxBet','maxPayout','bet','target','steps','kind'])config[k]=draft[k];
  window.ComposerMath.apply(game.value,config);$('#math-message').textContent='Loading preview. Check application status in Layout.';
 }catch(e){$('#math-message').textContent=e.message}
};
$('#math-source').onclick=()=>{try{window.ComposerMath.apply(game.value,null)}catch(e){$('#math-message').textContent=e.message}};
$('#math-kind').onchange=e=>{draft.kind=e.target.value;render()};
window.addEventListener('composer-target',load);
$('#math-reset').onclick=()=>{draft=defaults(base());fill();render();$('#math-message').textContent='Restored source defaults.'};
// Pinning keeps the current draft on the chart, so the next edit is judged against it.
$('#math-pin').onclick=()=>{
 if(pin()&&JSON.stringify(pinned[pinId()])===JSON.stringify(draft)){delete pinned[pinId()];storePins();render();$('#math-message').textContent='Baseline cleared.';return}
 if(validate(draft,base()).length)return;
 pinned[pinId()]={...draft};storePins();render();$('#math-message').textContent='Pinned for '+(window.ComposerTarget?.engineTitle()||'this engine')+'. Edit freely — the chart keeps this line.';
};
$('#math-export').onclick=()=>{
 const result=analyze(draft,base());if(result.errors.length)return;
 const data={schemaVersion:1,modelVersion:'composer-lab-2',status:'draft-analysis-only',game:game.value,config:draft,source:base(),analysis:result,limitations:['Local debug preview only; not a production deployment','Fixed strategy/scenario only','Not certified; no server wallet or RNG assurance','Liquidity bound is not a risk capital recommendation']};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${game.value}-math-draft.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('#math-import').onchange=async e=>{
 try{const file=e.target.files[0];if(!file)return;if(file.size>200000)throw Error('File too large.');const data=JSON.parse(await file.text());
  if(data.schemaVersion!==1||data.modelVersion!=='composer-lab-2'||!Object.hasOwn(snapshot.games,data.game))throw Error('Unsupported math configuration.');
  const errors=validate(data.config??{},snapshot.games[data.game]);if(errors.length)throw Error(errors.join(' '));
  const clean=Object.fromEntries(Object.keys(defaults(snapshot.games[data.game])).map(k=>[k,data.config[k]]));
  game.value=data.game;draft=clean;fill();render();$('#math-message').textContent='Imported draft; recalculated using current source baseline.';
 }catch(err){$('#math-message').textContent='Import rejected: '+err.message}finally{e.target.value=''}
};
window.addEventListener('lotomobil-session',async()=>{await refreshRunner();load()});
load();
