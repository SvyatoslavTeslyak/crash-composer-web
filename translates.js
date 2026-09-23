(function(){
'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const language=$('#language'),controls=$('#translates-controls'),report=$('#translates-report'),frame=$('#frame'),drafts=new Map();let target='kit',query='',missing=false,loadId=0,area='ui',category='all',textType='text';
const languages=['en','fr','ht'],labels={en:'English',fr:'Français',ht:'Kreyòl ayisyen'};
const texts=value=>Object.fromEntries(languages.map(lang=>[lang,value[lang]??'']));
try{const saved=localStorage.getItem('crash-language');language.value=languages.includes(saved)?saved:'en'}catch{}
const current=()=>drafts.get(target);
function notify(text){$('#translate-message').textContent=text}
let saving=false,activeKey='',previousDevice=null,previousZoom=null,importReview=null;
const live=()=>$('#translates-tab').getAttribute('aria-pressed')==='true';
function previewData(d){const result=structuredClone(d);for(const [key,edit] of Object.entries(d.edits||{})){if(edit.custom)result.overrides[key]=texts(edit);else{delete result.overrides[key];Object.assign(result.catalog.entries[key],texts(edit))}}return result}
function apply(){bindPreviewDismiss();if(live())ensureHistoryPreview();const d=current();try{const api=frame.contentWindow.CrashI18n;if(api){if(d)api.setDraft(previewData(d));api.setLanguage(language.value);if(live())highlightText()}}catch{}}
const windowNames={menu:'Settings',account:'Account',rules:'How to play',topbets:'Top bets',mybets:'My bets',betDetails:'My bet details',topBetDetails:'Top bet details',wins:'Live wins',win:'Win',difficulty:'Difficulty','limit:theme':'Atmosphere','limit:auto_steps':'Auto steps','limit:auto_cashout':'Auto cash out'};
function usageMarkup(entry){
 if(entry.usage?.includes('unused'))return '<div class="translation-usage"><span>Unused · Not rendered</span></div><p class="translation-usage-note">'+esc(entry.unusedReason)+'</p>';
 const usage=entry.usage||[],attribute=usage.filter(x=>!['text','scene'].includes(x)),onlyAttribute=attribute.length&&!usage.includes('text');
 const description=onlyAttribute?'Accessibility · '+attribute.join(', '):attribute.length?'Text + accessibility':entry.group==='Scene'?'Scene text':'UI text';
 return '<details class="translation-meta"><summary>Text details</summary><div class="translation-usage"><span>'+esc(description)+'</span>'+(entry.previewWindow?'<span>Window · '+esc(windowNames[entry.previewWindow]||entry.previewWindow)+'</span>':'')+(entry.presets?'<span>Preset · '+entry.presets.map(p=>p==='standard'?'Standard':p==='menu-drawer-v1'?'Menu tabs':'Bottom tabs').join(', ')+'</span>':'')+(entry.previewState?'<span>State · '+(entry.previewState==='API difficulty'?'API difficulty':entry.previewState==='ready'?'Ready':entry.previewState==='win-transfer'?'Win transfer':entry.previewState==='notification'?'Notification':'Round-dependent')+'</span>':'')+'</div>'+(onlyAttribute?'<p class="translation-usage-note">Not a visible caption. This label describes a control to screen readers; the control is outlined in the preview.</p>':'')+'</details>';
}
function highlightText(){
 const api=frame.contentWindow?.CrashI18n,entry=current()?.catalog.entries[activeKey];
 api?.highlight?.(activeKey);const info=api?.describe?.(activeKey);
 const ui=frame.contentWindow?.CrashUI?.instance,view=ui?.betDetail?(ui.modal==='topbets'?'topBetDetails':'betDetails'):ui?.modal||'';if([...$('#translation-preview-view').options].some(o=>o.value===view))$('#translation-preview-view').value=view;
 const onlyAttribute=entry?.usage?.length&&!entry.usage.includes('text')&&!entry.usage.includes('scene');
 $('#translation-preview-note').textContent=!entry?'Select a text to locate it in the preview.':entry.usage?.includes('unused')?entry.unusedReason:info?.visibleText?(stateInspection?'UI state preview · Betting actions are disabled.':'Highlighted text · Changes appear as you type.'):onlyAttribute||info?.visibleAttribute?'Label type: '+(info?.attributes?.join(', ')||entry.usage.join(', '))+'. No visible caption. '+(info?.visibleAttribute?'The associated control has a dashed outline.':'Its control is not present in this preview state.'):entry.group==='Scene'?'Scene text updates live when it appears in the game.':entry.previewWindow?'This text belongs to '+(windowNames[entry.previewWindow]||entry.previewWindow)+'. It may need round data or a different UI preset to appear.':'Text is not visible in this state. Choose a window or interact with the preview.';
}
function enforcePreviewWindow(){
 if(!live())return;const ui=frame.contentWindow?.CrashUI?.instance;
 if(ui?.modal==='dev'){ui.close();$('#translation-preview-view').value='';activeKey='';syncSelection();highlightText()}
}
function syncPreviewWindows(){
 enforcePreviewWindow();
 const select=$('#translation-preview-view'),selected=select.value;
 const allowed=new Set(available().map(([,entry])=>entry.previewWindow).filter(Boolean));
 if(allowed.has('betDetails'))allowed.add('topBetDetails');
 select.innerHTML='<option value="">Game</option>'+Object.entries(windowNames).filter(([kind])=>allowed.has(kind)).map(([kind,label])=>'<option value="'+esc(kind)+'">'+esc(label)+'</option>').join('');
 select.value=allowed.has(selected)?selected:'';
}
function previewWindow(kind){
 if(kind==='dev'||!TranslationTable.windowAllowed(target,kind))kind='';
 if(kind&&![...$('#translation-preview-view').options].some(option=>option.value===kind))kind='';
 try{const ui=frame.contentWindow.CrashUI?.instance;if(!ui)return;
 const focused=document.activeElement;
 if(kind==='betDetails'||kind==='topBetDetails'){const parent=kind==='topBetDetails'?'topbets':'mybets';if(ui.modal!==parent)ui.open(parent);if(ui.betRows?.length&&!ui.betDetail)ui.showBetDetails(0)}
 else if(kind.startsWith('limit:')&&!ui.limitOptions?.()[kind.slice(6)]){if(ui.modal!=='menu')ui.open('menu')}
 else if(kind){if(ui.betDetail)ui.backToBets();if(ui.modal!==kind){ui.rulesFrom='tab';ui.open(kind)}}else if(ui.modal)ui.close();
 $('#translation-preview-view').value=kind;apply();
 if(focused?.matches('textarea,.translation-row'))frame.contentWindow.requestAnimationFrame(()=>setTimeout(()=>focused.isConnected&&focused.focus({preventScroll:true}),0));
 }catch{highlightText()}
}
// Presentation-only states: never dispatch betting actions to the game.
let historyPreview=null;
function stopHistoryPreview(){
 const preview=historyPreview;if(!preview)return;historyPreview=null;
 preview.ui.update=preview.update;preview.update.call(preview.ui,preview.latest);
}
function ensureHistoryPreview(){
 const ui=frame.contentWindow?.CrashUI?.instance;if(!ui?.state||typeof ui.update!=='function'||ui.multiBet||historyPreview?.ui===ui)return;
 stopHistoryPreview();
 const preview={ui,update:ui.update,latest:ui.state};historyPreview=preview;
 const samples=[1.13,2.04,1.00,3.41,1.61,5.20,1.35,2.78].map((multiplier,index)=>({multiplier,cashed_out:index!==2}));
 ui.update=function(state){
  if(!stateInspection)preview.latest=state;
  const bets=[{name:'You',time:Date.now()-60000,wager:3,payout:4.83,multiplier:1.61,details:[{label:'RESULT',value:'Cashed out'},{label:'DIFFICULTY',value:'Medium'},{label:'LANES CROSSED',value:'3 / 20'}]},{name:'You',time:Date.now()-3600000,wager:2,payout:0,multiplier:0,details:[{label:'RESULT',value:'Crashed'},{label:'DIFFICULTY',value:'Hard'},{label:'LANES CROSSED',value:'0 / 20'}]}];
  const data={...state,history:state.history?.length?state.history:samples};
  if(state.game==='road')Object.assign(data,{bets:stateInspection?state.bets:state.bets?.length?state.bets:bets,rounds:state.rounds||2,roundWins:state.roundWins||1,bestMultiplier:state.bestMultiplier||1.61,personal:state.personal||4.83});
  return preview.update.call(this,data)
 };
 ui.update(preview.latest);
}
let stateInspection=null;
function currentPreset(){const ui=frame.contentWindow?.CrashUI?.instance;if(ui?.config?.presentationPreset==='menu-drawer-v1'||$('#presentation-preset').value==='menu-drawer-v1')return 'menu-drawer-v1';return ui?.state?.game===target?(ui.tabbed?'tabbed-shell-v1':'standard'):$('#presentation-preset').value==='tabbed-shell-v1'?'tabbed-shell-v1':'standard'}
function stopStateInspection(){
 const inspection=stateInspection;if(!inspection)return;stateInspection=null;
 const {ui,update,send,latest}=inspection;ui.update=update;
 try{ui.close();update.call(ui,latest)}finally{ui.send=send}
}
function inspectAction(source,entry){
 stopStateInspection();const ui=frame.contentWindow?.CrashUI?.instance;if(!ui||typeof ui.update!=='function'||ui.multiBet)return;
 const active=['GO','CASH OUT','SELL FUEL','NEXT LANE','NEXT FRUIT'].includes(source),idle=['PLAY','SLICE'].includes(source);
 const notification=entry?.previewState==='notification',winTransfer=entry?.previewState==='win-transfer';
 const betPreview=['betDetails','topBetDetails'].includes(entry?.previewWindow);
 const emptyBets=source==='No bets yet.',winPreview=entry?.previewWindow==='win';
 if(!active&&!idle&&!notification&&!winTransfer&&!betPreview&&!emptyBets&&!winPreview)return;
 const inspection={ui,update:ui.update,send:ui.send,latest:historyPreview?.ui===ui?historyPreview.latest:ui.state};stateInspection=inspection;
 ui.send=()=>{};
 ui.update=function(state){
  inspection.latest=state;if(historyPreview?.ui===ui)historyPreview.latest=state;const preview=structuredClone(state),stepped=['road','fruits','market_stack'].includes(state.game);
  Object.assign(preview,{win:false,auto:false,canBet:!active,canGo:true,canCash:active,showCash:active&&stepped,cash:Math.max(Number(state.cash)||0,Number(state.bet)||1),toast:''});
  if(emptyBets)preview.bets=[];
  if(winPreview){preview.winAmount=12.45;preview.win=true}
  if(notification)preview.toast=source;if(winTransfer){preview.win=true;preview.winAmount=preview.cash;preview.winSubtitle=source}
  if(betPreview){
   const lost=source==='Lost'||source==='Crashed',sample={name:'You',time:Date.now(),wager:3,payout:lost?0:4.5,multiplier:lost?0:1.5};
   if(state.game==='road')sample.details=[{label:'DIFFICULTY',value:'Medium'},{label:'LANES CROSSED',value:'3 / 20'},{label:'RESULT',value:lost?'Crashed':'Cashed out'}];
   preview.bets=[sample];preview.topBets=[{...sample,name:'Lucky Leo'}];
  }
  preview.settings={...preview.settings,sound:false,music:false,reduced_motion:true};
  preview.goTitle=active?(state.game==='road'?'GO':state.game==='fruits'?'SLICE':state.game==='market_stack'?'PLACE':state.game==='fuel'?'SELL FUEL':'CASH OUT'):(state.game==='fruits'?'SLICE':'PLAY');
  preview.goSubtitle=active&&stepped?(state.game==='road'?'NEXT LANE':'NEXT FRUIT'):'$'+Number(active?preview.cash:preview.bet).toFixed(2);
  return inspection.update.call(this,preview);
 };
 ui.close();ui.update(inspection.latest);
}
function syncSelection(){for(const row of report.querySelectorAll('[data-translation]')){const selected=row.dataset.translation===activeKey;row.classList.toggle('is-selected',selected);if(selected)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current')}}
function clearSelection(){
 if(!live()||!activeKey)return;
 activeKey='';syncSelection();highlightText();
}
// Iframe clicks do not bubble to Composer; listen in both documents.
const dismissDocuments=new WeakSet();
function bindPreviewDismiss(){
 const doc=frame.contentDocument;if(!doc||dismissDocuments.has(doc))return;
 dismissDocuments.add(doc);doc.addEventListener('pointerdown',clearSelection,true);
}
document.addEventListener('pointerdown',event=>{
 if(event.target.closest('.translation-row'))return;
 clearSelection();
},true);
function focusText(key,lang){
 const entry=available().find(([id])=>id===key)?.[1];if(!entry)return;
 activeKey=key;syncSelection();if(lang&&language.value!==lang){language.value=lang;try{localStorage.setItem('crash-language',lang)}catch{}}
 stopStateInspection();inspectAction(entry.source,entry);
 previewWindow(entry.previewWindow||'');apply();
}
$('#translation-preview-view').onchange=e=>{const kind=e.target.value;activeKey='';syncSelection();stopStateInspection();inspectAction('',{previewWindow:kind});previewWindow(kind)};
window.addEventListener('composer-workspace',e=>{
 $('#room').classList.toggle('translations-workspace',e.detail==='translates');
 if(e.detail==='translates'){if(!previousDevice){previousDevice={...theStage.device};previousZoom=devices.zoom||'fit'}theStage.set({device:'mobile',zoom:'fit'});apply()}
 else{stopStateInspection();stopHistoryPreview();try{frame.contentWindow.CrashI18n?.highlight?.('')}catch{}if(previousDevice){theStage.set({device:previousDevice.id==='custom'?previousDevice:previousDevice.id,zoom:previousZoom});previousDevice=null}}
});
function exportTable(){
 const blob=new Blob([TranslationTable.encode(current(),target,currentPreset())],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='translations-'+target+'-'+currentPreset()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('CSV downloaded · Saved texts for this game.');
}
function canEdit(){return !!window.ComposerAuth?.canEdit(target)}
async function importTable(file){
 if(!canEdit())return;
 if(!file)return;if(saving||Object.keys(current()?.edits||{}).length){notify('Save or cancel open edits before importing.');return}
 const id=target,d=current();try{if(file.size>2_000_000)throw Error('Maximum file size is 2 MB.');const changes=TranslationTable.review(await file.text(),d,id,currentPreset());if(id!==target)return;
 importReview={game:id,preset:currentPreset(),revision:d.revision,changes};rows();report.scrollTop=0;notify(changes.length+' changed texts found. Review before saving.');
 }catch(error){notify(error.message)}
}
async function saveImport(){
 if(saving||!importReview)return;const review=importReview,id=review.game,d=current();if(id!==target||currentPreset()!==review.preset||d.revision!==review.revision){notify('Translations changed. Import the file again.');return}
 const overrides=structuredClone(d.overrides),entries={};for(const change of review.changes){if(id==='kit')entries[change.key]=change.after;else overrides[change.key]=change.after}
 saving=true;rows();try{const data=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:d.revision,entries,overrides})},id);data.edits={};drafts.set(id,data);if(target===id){importReview=null;apply();notify('Imported '+review.changes.length+' texts into '+(id==='kit'?'the shared catalog.':'this game only.'))}}
 catch(error){if(target===id)notify(error.message)}finally{saving=false;if(target===id)rows()}
}
function importMarkup(){
 if(!importReview||importReview.game!==target)return '';const changes=importReview.changes;
 return '<section class="translation-import"><h3>Review CSV · '+changes.length+' changed texts</h3><p>'+(target==='kit'?'These changes update the shared catalog.':'These changes apply to this game only. Other games keep their translations.')+'</p><div class="translation-import-list">'+changes.map(change=>'<article><strong>'+esc(change.source)+'</strong>'+languages.filter(l=>change.before[l]!==change.after[l]).map(l=>'<p>'+labels[l]+'</p><del>'+esc(change.before[l]||'—')+'</del><ins>'+esc(change.after[l]||'— (English fallback)')+'</ins>').join('')+'</article>').join('')+'</div><div class="translation-row-actions"><button id="translate-import-cancel" '+(saving?'disabled':'')+'>Cancel</button><button id="translate-import-save" class="translation-save" '+(saving||!changes.length?'disabled':'')+'>Save '+changes.length+' changes</button></div></section>';
}
async function request(options,id=target){if(window.ComposerCloud?.enabled)return window.ComposerCloud.translations(id,options);const r=await fetch('translations?game='+encodeURIComponent(id),{cache:'no-store',...options});const data=await r.json();if(!r.ok)throw Error(data.message||'Could not load translations');return data}
async function saveRow(key){
 if(saving)return;const id=target,d=current(),edit=d.edits[key];saving=true;edit.error='';rows();
 const overrides=structuredClone(d.overrides),entries={};
 if(edit.custom)overrides[key]=texts(edit);else{delete overrides[key];entries[key]=texts(edit)}
 try{const data=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:d.revision,entries,overrides})},id);delete d.edits[key];data.edits=d.edits;drafts.set(id,data);if(target===id){apply();notify(window.ComposerCloud?.enabled?'Saved to cloud draft':'Translation saved')}}catch(e){edit.error=e.message}
 finally{saving=false;if(target===id)rows();mark()}
}
const available=()=>Object.entries(current()?.catalog.entries||{}).filter(([,e])=>TranslationTable.applicable(e,target,currentPreset())).map(([key,e])=>[key,TranslationTable.context(e,target)]);
const areaOf=e=>e.group==='Scene'?'scene':'ui';
function render(){const d=current();if(!d)return;
 controls.innerHTML='<div class="toolbar"><strong>Text location</strong><div id="translation-areas"></div></div><div class="toolbar"><strong>Text type</strong><nav id="translation-types" class="look-row" aria-label="Translation text types"></nav></div><div class="toolbar"><strong>Sections</strong><nav id="translation-sections" class="look-row" aria-label="Translation sections"></nav></div><div class="toolbar"><label>Search<input id="translate-search" type="search" placeholder="Text or key" value="'+esc(query)+'"></label><label><input type="checkbox" id="translate-missing" '+(missing?'checked':'')+'> Missing selected language</label></div><div class="toolbar"><button id="translate-export">Download CSV template</button><button id="translate-import">Import CSV</button><input id="translate-file" type="file" accept=".csv,text/csv" hidden><button id="translate-reload">Reload shared draft</button><small role="status" id="translate-message">'+(canEdit()?'Edit and save each text separately':'Read-only access · Preview and export translations')+'</small></div>';
 $('#translate-search').oninput=e=>{query=e.target.value;rows()};$('#translate-missing').onchange=e=>{missing=e.target.checked;rows()};
 $('#translate-reload').onclick=()=>{if(saving)return;if(Object.keys(current()?.edits||{}).length||importReview?.changes.length){notify('Save or cancel your open edits or CSV import before reloading.');return}drafts.delete(target);load()};
 $('#translate-import').disabled=!canEdit();$('#translate-export').onclick=exportTable;$('#translate-import').onclick=()=>$('#translate-file').click();$('#translate-file').onchange=e=>{importTable(e.target.files[0]);e.target.value=''};
 navigation();syncPreviewWindows();rows();mark();
}
function mark(){$('#translates-tab').classList.toggle('workspace-dirty',[...drafts.values()].some(d=>Object.keys(d.edits||{}).length))}
function navigation(){
 const entries=available();
 $('#translation-areas').innerHTML=[['ui','UI','Header, controls & windows'],['scene','Scene','Text inside the game world']].map(([id,title,description])=>'<button class="translation-area" data-area="'+id+'" aria-pressed="'+(area===id)+'"><span><strong>'+title+'</strong><small>'+description+'</small></span><b>'+entries.filter(([,e])=>areaOf(e)===id).length+'</b></button>').join('');
 const groups=[...new Set(entries.filter(([,e])=>areaOf(e)===area).map(([,e])=>e.group))];if(!groups.includes(category))category='all';
 const scoped=entries.filter(([,e])=>areaOf(e)===area);
 $('#translation-sections').innerHTML=[['all','All sections',scoped.length],...groups.map(g=>[g,g,scoped.filter(([,e])=>e.group===g).length])].map(([id,label,count])=>'<button type="button" class="translation-section-link" data-section="'+esc(id)+'" aria-pressed="'+(category===id)+'"><span>'+esc(label)+'</span><b>'+count+'</b></button>').join('');
 for(const button of controls.querySelectorAll('[data-section]'))button.onclick=()=>{category=button.dataset.section;for(const link of controls.querySelectorAll('[data-section]'))link.setAttribute('aria-pressed',String(link.dataset.section===category));rows();report.scrollTop=0};
 for(const b of controls.querySelectorAll('[data-area]'))b.onclick=()=>{area=b.dataset.area;category='all';textType=area==='scene'?'scene':'text';navigation();rows();report.scrollTop=0};
}
const typeNames={all:'All types',text:'UI texts',accessibility:'Accessibility',tooltip:'Tooltips',placeholder:'Placeholders',scene:'Scene texts'};
function matchesType(entry,type){const usage=entry.usage||(entry.group==='Scene'?['scene']:['text']);return type==='all'||(type==='accessibility'?usage.some(x=>['aria-label','aria-labelledby','alt'].includes(x)):type==='tooltip'?usage.includes('title'):usage.includes(type))}
function typeNavigation(){
 const scope=available().filter(([,e])=>areaOf(e)===area&&(category==='all'||e.group===category));
 const types=area==='scene'?['all','scene']:['all','text','accessibility','tooltip','placeholder'];
 $('#translation-types').innerHTML=types.map(type=>{const count=scope.filter(([,e])=>matchesType(e,type)).length;return '<button type="button" class="translation-section-link" data-text-type="'+type+'" aria-pressed="'+(textType===type)+'" '+(!count&&type!==textType?'disabled':'')+'><span>'+typeNames[type]+'</span><b>'+count+'</b></button>'}).join('');
 for(const button of controls.querySelectorAll('[data-text-type]'))button.onclick=()=>{textType=button.dataset.textType;rows();report.scrollTop=0;controls.querySelector('[data-text-type="'+textType+'"]')?.focus({preventScroll:true})};
}
function rows(){const d=current();if(!d)return;typeNavigation();
 const entries=available().filter(([key,e])=>areaOf(e)===area&&(category==='all'||e.group===category)&&matchesType(e,textType)&&(!missing||!(d.overrides[key]?.[language.value]??e[language.value]))&&[key,e.source,d.overrides[key]?.[language.value]??e[language.value]??''].some(v=>v.toLowerCase().includes(query.toLowerCase())));
 const groups=new Map();for(const row of entries){const group=row[1].group;if(!groups.has(group))groups.set(group,[]);groups.get(group).push(row)}
 const title=category!=='all'?category:area==='scene'?'Scene texts':'UI texts',description=area==='scene'?'Hints, pop-ups and messages drawn inside the game scene.':'Texts used by this game’s '+(currentPreset()==='menu-drawer-v1'?'Menu tabs':currentPreset()==='tabbed-shell-v1'?'Bottom tabs':'Standard')+' preset.';
 report.innerHTML=importMarkup()+'<div class="translations-heading"><div><span class="translation-eyebrow">TEXTS / '+(area==='scene'?'SCENE':'INTERFACE')+'</span><h2>'+title+'</h2><p>'+description+'</p></div><span class="translation-total">'+entries.length+' texts</span></div>'+
 (!entries.length?'<div class="translation-empty"><h3>'+(query||missing||textType!=='all'||category!=='all'?'No matching texts':'No scene texts for this game')+'</h3><p>'+(query||missing||textType!=='all'||category!=='all'?'Try another text type, section or search.':'This game uses the UI for its messages. Decorative text painted into artwork is not a text label.')+'</p></div>':'')+
 [...groups].map(([group,list])=>'<section class="translation-group"><header class="translation-group-heading"><h3>'+esc(group)+'</h3><span>'+list.length+'</span></header><div class="translation-group-rows">'+list.map(([key,e])=>{
 const edit=d.edits?.[key],v=edit||{...e,...d.overrides[key]},custom=edit?edit.custom:!!d.overrides[key];
 return '<article class="translation-row '+(edit?'is-editing':'')+'" data-translation="'+key+'" tabindex="0" role="group" aria-label="Preview: '+esc(e.source)+'"><header><strong title="English source">'+esc(e.label||e.source)+'</strong><div class="translation-row-actions"><span class="translation-scope '+(custom?'custom':'')+'">'+(custom?'This game':e.games.length?'Game text':'Shared UI')+'</span>'+(!edit?'<button '+(!canEdit()||importReview||saving||e.usage?.includes('unused')?'disabled':'')+' data-edit="'+key+'" aria-label="Edit '+esc(e.source)+'">Edit</button>':'')+'</div></header>'+usageMarkup(e)+'<div class="translation-fields '+(!edit?'translation-values':'')+'">'+[language.value].map(lang=>'<'+(edit?'label':'div')+'><span>'+labels[lang]+'</span>'+(edit?(e.format==='markdown'?'<div class=translation-format><button type=button data-format=heading>Heading</button><button type=button data-format=bullet>• List</button><button type=button data-format=number>1. List</button><button type=button data-format=bold>Bold</button></div><small>Markdown: # heading · - bullet · 1. numbered item · **bold**</small>':'')+'<textarea '+(saving?'disabled':'')+' rows="'+(e.format==='markdown'?16:e.source.length>90?3:1)+'" lang="'+lang+'" data-key="'+key+'" data-lang="'+lang+'" aria-label="'+esc(e.source)+' — '+lang.toUpperCase()+'">'+esc(v[lang])+'</textarea>':'<p lang="'+lang+'">'+esc(v[lang]||'—')+'</p>')+'</'+(edit?'label':'div')+'>').join('')+'</div>'+(edit?'<footer><div><details class="translation-details"><summary>Key & variables</summary><code>'+esc(key)+'</code><p>'+esc((e.source.match(/\{\w+\}/g)||[]).join(' · ')||'No variables')+'</p></details>'+(target!=='kit'?'<label class="translation-override"><input type="checkbox" data-override="'+key+'" '+(custom?'checked':'')+' '+(saving?'disabled':'')+'> This game only</label>':'')+'</div><div class="translation-row-actions"><button data-cancel="'+key+'" '+(saving?'disabled':'')+'>Cancel</button><button class="translation-save" data-save="'+key+'" '+(saving?'disabled':'')+'>'+ (saving?'Saving…':'Save')+'</button></div></footer>'+(edit.error?'<p class="translation-error" role="alert">'+esc(edit.error)+'</p>':''):'')+'</article>'
 }).join('')+'</div></section>').join('');
 syncSelection();
 for(const row of report.querySelectorAll('[data-translation]')){
  const select=()=>{row.focus({preventScroll:true});focusText(row.dataset.translation,language.value)};
  row.onclick=event=>{if(event.target.closest('button,input,textarea,select,label,summary,a,details'))return;const selection=window.getSelection();if(selection&&!selection.isCollapsed&&row.contains(selection.anchorNode))return;select()};
  row.onkeydown=event=>{if(event.target!==row||!['Enter',' '].includes(event.key))return;event.preventDefault();select()};
 }
 for(const button of report.querySelectorAll('[data-edit]'))button.onclick=()=>{const key=button.dataset.edit,e={...d.catalog.entries[key],...d.overrides[key]};d.edits??={};d.edits[key]={...texts(e),custom:!!d.overrides[key]};rows();focusText(key,language.value);const field=report.querySelector('[data-translation="'+key+'"] textarea[data-lang="'+language.value+'"]');field?.focus({preventScroll:true});frame.contentWindow.requestAnimationFrame(()=>setTimeout(()=>field?.isConnected&&field.focus({preventScroll:true}),0));mark()};
 for(const button of report.querySelectorAll('[data-cancel]'))button.onclick=()=>{delete d.edits[button.dataset.cancel];if(activeKey===button.dataset.cancel){activeKey='';stopStateInspection()}rows();apply();mark()};
 for(const button of report.querySelectorAll('[data-save]'))button.onclick=()=>saveRow(button.dataset.save);
 for(const button of report.querySelectorAll('[data-format]'))button.onclick=()=>{const field=button.closest('label').querySelector('textarea'),start=field.selectionStart,end=field.selectionEnd,selected=field.value.slice(start,end),kind=button.dataset.format;const value=kind==='bold'?'**'+(selected||'text')+'**':(start&&field.value[start-1]!=='\n'?'\n':'')+(kind==='heading'?'## ':kind==='number'?'1. ':'- ')+(selected||'text');field.setRangeText(value,start,end,'select');field.dispatchEvent(new Event('input'));field.focus()};
 for(const input of report.querySelectorAll('textarea'))input.oninput=()=>{const {key,lang}=input.dataset;d.edits[key][lang]=input.value;activeKey=key;apply();mark()};
 for(const input of report.querySelectorAll('textarea'))input.onfocus=()=>focusText(input.dataset.key,input.dataset.lang);
 if($('#translate-import-cancel'))$('#translate-import-cancel').onclick=()=>{importReview=null;rows()};if($('#translate-import-save'))$('#translate-import-save').onclick=saveImport;
 for(const input of report.querySelectorAll('[data-override]'))input.onchange=()=>{d.edits[input.dataset.override].custom=input.checked;apply()};

}

async function load(){stopStateInspection();stopHistoryPreview();activeKey='';importReview=null;$('#translation-preview-view').value='';const id=++loadId;target=window.ComposerTarget?.value||$('#target').value||'kit';try{if(!drafts.has(target)||!Object.keys(drafts.get(target).edits||{}).length){const data=await request();if(id!==loadId)return;data.edits={};drafts.set(target,data)}render();apply()}catch(e){controls.innerHTML='<p>'+esc(e.message)+'</p>'}}
language.onchange=()=>{rows();try{localStorage.setItem('crash-language',language.value)}catch{}apply();if(typeof showcaseLink==='function')showcaseLink()};
frame.addEventListener('load',()=>{stopStateInspection();stopHistoryPreview();apply();try{frame.contentWindow.addEventListener('crash-i18n-ready',apply,{once:true})}catch{}});
window.addEventListener('composer-storage',()=>{drafts.clear();load()});window.addEventListener('composer-target',load);$('#target').addEventListener('change',()=>setTimeout(load,0));
window.addEventListener('beforeunload',e=>{if(importReview?.changes.length||[...drafts.values()].some(d=>Object.keys(d.edits||{}).length)){e.preventDefault();e.returnValue=''}});
let lastScope='';setInterval(()=>{if(!live()||!current())return;enforcePreviewWindow();const scope=target+':'+currentPreset();if(scope!==lastScope){lastScope=scope;category='all';if(activeKey&&!available().some(([key])=>key===activeKey)){activeKey='';stopStateInspection();apply()}render()}},400);
load();
})();
