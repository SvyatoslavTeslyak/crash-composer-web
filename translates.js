(function(){
'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// The note about the picked text sits right under the device, not over it.
$('#fit').append($('#translation-preview-note'));
const language=$('#language'),controls=$('#translates-controls'),report=$('#translates-report'),frame=$('#frame'),drafts=new Map();let target='kit',query='',missing=false,loadId=0,area='ui',category='all',textType='all';
const languages=['en','fr','ht'],labels={en:'English',fr:'Français',ht:'Kreyòl ayisyen'};
const texts=value=>Object.fromEntries(languages.map(lang=>[lang,value[lang]??'']));
try{const saved=localStorage.getItem('crash-language');language.value=languages.includes(saved)?saved:'en'}catch{}
const current=()=>drafts.get(target);
// The slots and Plinko build their own bet panel. Each exposes a handle on window with its own
// preview hooks (previewWindow, previewTranslation, clearTranslationPreview), and the crash games'
// sample history and PLAY / CASH OUT buttons mean nothing to them.
const OWN_PANEL={candy_cascade:'candyCascade',plinko:'plinko',mopyon_cascades:'mopyonCascades'};
const ownPanel=()=>Object.hasOwn(OWN_PANEL,target);
const gameHandle=()=>{try{return ownPanel()?frame.contentWindow?.[OWN_PANEL[target]]:null}catch{return null}};
let saving=false,activeKey='',cellLang='en',previousDevice=null,previousZoom=null,importReview=null;
const live=()=>$('#translates-tab').getAttribute('aria-pressed')==='true';
function previewData(d){const result=structuredClone(d);for(const [key,edit] of Object.entries(d.edits||{})){if(edit.custom)result.overrides[key]=texts(edit);else{delete result.overrides[key];Object.assign(result.catalog.entries[key],texts(edit))}}return result}
function apply(){bindPreviewDismiss();if(live())ensureHistoryPreview();const d=current();try{const api=frame.contentWindow.CrashI18n;if(api){if(d)api.setDraft(previewData(d));api.setLanguage(language.value);if(live())highlightText()}}catch{}}
const windowNames={autoSpin:'Auto Spin',candyPays:'Candy payouts',linePays:'Line pays',award:'Free games award',summary:'Free games summary',plinkoRows:'Rows',stake:'Bet amount',menu:'Settings',account:'Account',rules:'How to play',topbets:'Top bets',mybets:'My bets',betDetails:'My bet details',topBetDetails:'Top bet details',wins:'Live wins',win:'Win',difficulty:'Difficulty','limit:theme':'Atmosphere','limit:auto_steps':'Auto steps','limit:auto_cashout':'Auto cash out','notice:funds':'Notice · not enough funds','notice:offline':'Notice · no connection','notice:error':'Notice · something went wrong','notice:wallet':'Notice · top up balance'};
function highlightText(){
 const api=frame.contentWindow?.CrashI18n,entry=current()?.catalog.entries[activeKey];
 api?.highlight?.(activeKey);const info=api?.describe?.(activeKey);
 const ui=frame.contentWindow?.CrashUI?.instance,view=ui?.betDetail?(ui.modal==='topbets'?'topBetDetails':'betDetails'):ui?.modal||'';if([...$('#translation-preview-view').options].some(o=>o.value===view))$('#translation-preview-view').value=view;
 const onlyAttribute=entry?.usage?.length&&!entry.usage.includes('text')&&!entry.usage.includes('scene');
 // The note speaks about the picked text; how to pick one is said above the table, where it is done.
 // Said only when the preview cannot simply show the text highlighted; the row's icons already
 // say whether it is seen or read by screen readers.
 $('#translation-preview-note').textContent=!entry?'':entry.usage?.includes('unused')?entry.unusedReason:info?.visibleText?'':onlyAttribute||info?.visibleAttribute?'Screen readers only':entry.group==='Scene'?'Shows in the game scene when it happens.':entry.previewWindow?'Shows in '+(windowNames[entry.previewWindow]||entry.previewWindow)+' once there is data for it.':'Not on screen now: pick a window above.';
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
 const custom=gameHandle()?.previewWindow?.(kind);
 if(custom){if(ui.modal)ui.close();$('#translation-preview-view').value=kind;apply();if(focused?.matches('textarea,.translation-row'))frame.contentWindow.requestAnimationFrame(()=>setTimeout(()=>focused.isConnected&&focused.focus({preventScroll:true}),0));return}
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
 if(ownPanel())return;
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
 try{ui.finishWinToast?.();ui.close();update.call(ui,latest)}finally{ui.send=send}
}
function inspectAction(source,entry){
 stopStateInspection();if(ownPanel())return;const ui=frame.contentWindow?.CrashUI?.instance;if(!ui||typeof ui.update!=='function'||ui.multiBet)return;
 const active=['GO','CASH OUT','SELL FUEL','NEXT LANE','NEXT FRUIT'].includes(source),idle=['PLAY','SLICE'].includes(source);
 const notification=entry?.previewState==='notification',winTransfer=entry?.previewState==='win-transfer';
 const betPreview=['betDetails','topBetDetails'].includes(entry?.previewWindow);
 const historyLabel=source==='Round history';
 const emptyBets=source==='No bets yet.',winPreview=entry?.previewWindow==='win';
 // The player's own row in Top bets, which a game adds after their win.
 const ownTopRow=entry?.previewWindow==='topbets'&&source==='You';
 if(!active&&!idle&&!notification&&!winTransfer&&!betPreview&&!emptyBets&&!winPreview&&!historyLabel&&!ownTopRow)return;
 const inspection={ui,update:ui.update,send:ui.send,latest:historyPreview?.ui===ui?historyPreview.latest:ui.state};stateInspection=inspection;
 ui.send=()=>{};
 ui.update=function(state){
  inspection.latest=state;if(historyPreview?.ui===ui)historyPreview.latest=state;const preview=structuredClone(state),stepped=['road','boom','market_stack'].includes(state.game);
  Object.assign(preview,{win:false,auto:false,canBet:!active,canGo:true,canCash:active,showCash:active&&stepped,cash:Math.max(Number(state.cash)||0,Number(state.bet)||1),toast:''});
  if(historyLabel){preview.flags={...preview.flags,history:true};preview.history=state.history?.length?state.history:[{multiplier:1.13,cashed_out:true},{multiplier:2.04,cashed_out:true}] }
  if(emptyBets)preview.bets=[];
  if(ownTopRow)preview.topBets=[{name:'You',payout:6.12,multiplier:2.04,wager:3,time:Date.now()},...(state.topBets||[]).filter(t=>t.name!=='You')].sort((a,b)=>b.payout-a.payout);
  if(winPreview){preview.winAmount=12.45;preview.win=true}
  if(notification)preview.toast=source;if(winTransfer){preview.win=true;preview.winAmount=preview.cash;preview.winSubtitle=source}
  // A game that lands a win as the toast over the scene (Goat Road) shows that toast, held still.
  if(winTransfer&&this.config?.winPresentation!=='window'&&(state.game==='road'||this.config?.winPresentation==='toast')){preview.winId='composer-preview';preview.winToastAmount=preview.winAmount;preview.history=[{multiplier:2.04,cashed_out:true},...(state.history||[])]}
  if(betPreview){
   const lost=source==='Lost'||source==='Crashed',sample={name:'You',time:Date.now(),wager:3,payout:lost?0:4.5,multiplier:lost?0:1.5};
   // As Goat Road sends them: your bet leads with its result (which the window shows as the
   // picture, not a row), then difficulty and lanes; a leaderboard bet has difficulty and lanes crossed.
   if(state.game==='road')sample.details=[{label:'RESULT',value:lost?'Crashed':'Cashed out'},{label:'DIFFICULTY',value:'Medium'},{label:'LANES',value:'3 / 20'}];
   preview.bets=[sample];preview.topBets=[{...sample,name:'Lucky Leo',...(state.game==='road'?{details:[{label:'DIFFICULTY',value:'Medium'},{label:'LANES CROSSED',value:'3'}]}:{})}];
  }
  preview.settings={...preview.settings,sound:false,music:false,reduced_motion:true};
  preview.goTitle=active?(state.game==='road'?'GO':state.game==='boom'?'SLICE':state.game==='market_stack'?'PLACE':state.game==='fuel'?'SELL FUEL':'CASH OUT'):(state.game==='boom'?'SLICE':'PLAY');
  preview.goSubtitle=active&&stepped?(state.game==='road'?'NEXT LANE':'NEXT FRUIT'):'$'+Number(active?preview.cash:preview.bet).toFixed(2);
  const out=inspection.update.call(this,preview);
  // The kit lets its win toast leave after a few seconds; while a text on it is open, it stays.
  // Its timers belong to the game's window, so they are cleared there.
  if(winTransfer&&this.winToast){const w=frame.contentWindow;w.clearTimeout(this.toastEndTimer);w.clearTimeout(this.toastFlightTimer)}
  return out;
 };
 ui.close();ui.update(inspection.latest);
}
function syncSelection(){for(const row of report.querySelectorAll('[data-translation]')){const selected=row.dataset.translation===activeKey;row.classList.toggle('is-selected',selected);if(selected)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');for(const cell of row.querySelectorAll('[data-cell]'))cell.classList.toggle('is-cell',selected&&cell.dataset.cell===cellLang)}}
function clearSelection(){
 if(!live()||!activeKey)return;
 clearTimeout(revealTimer);activeKey='';syncSelection();highlightText();
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
let revealTimer;
function focusText(key,lang){
 const entry=available().find(([id])=>id===key)?.[1];if(!entry)return;
 clearTimeout(revealTimer);
 gameHandle()?.clearTranslationPreview?.();
 activeKey=key;syncSelection();if(lang&&language.value!==lang){language.value=lang;try{localStorage.setItem('crash-language',lang)}catch{}
  // The preview speaks the language of the cell being edited; the table stays as it is.
  window.ComposerLanguagePaint?.();for(const n of report.querySelectorAll('.tx-table [lang]'))n.closest('th,td')?.classList.toggle('is-lang',n.getAttribute('lang')===lang)}
 stopStateInspection();inspectAction(entry.source,entry);
 previewWindow(entry.previewWindow||'');
 gameHandle()?.previewTranslation?.(entry.source,entry);
 apply();
 revealTimer=setTimeout(()=>{frame.contentWindow.CrashI18n?.reveal?.(key);highlightText()},350);
}
$('#translation-preview-view').onchange=e=>{clearTimeout(revealTimer);gameHandle()?.clearTranslationPreview?.();const kind=e.target.value;activeKey='';syncSelection();stopStateInspection();inspectAction('',{previewWindow:kind});previewWindow(kind)};
window.addEventListener('composer-workspace',e=>{
 $('#room').classList.toggle('translations-workspace',e.detail==='translates');
 if(e.detail==='translates'){if(!previousDevice){previousDevice={...theStage.device};previousZoom=devices.zoom||'fit'}theStage.set({device:'mobile',zoom:'fit'});apply()}
 else{clearTimeout(revealTimer);gameHandle()?.clearTranslationPreview?.();stopStateInspection();stopHistoryPreview();try{frame.contentWindow.CrashI18n?.highlight?.('')}catch{}if(previousDevice){theStage.set({device:previousDevice.id==='custom'?previousDevice:previousDevice.id,zoom:previousZoom});previousDevice=null}}
});
// The Excel file holds every text of the game in the table's order, as saved (open edits are not
// in it). Where and Kind say what the panel and the icons say; Note carries the text's label and
// the variables to keep. Key, Game and Preset bring each row back to its text: Game and Preset
// are hidden, and only the language columns are read back.
function exportTable(){
 const d=current(),rows=[...available()].sort(([,a],[,b])=>compareWindows(windowGroup(a),windowGroup(b))).map(([key,e])=>{
  const v=TranslationTable.effective(d,key),kinds=areaOf(e)==='scene'?['Game scene']:Object.keys(KINDS).filter(k=>matchesType(e,k)).map(k=>KINDS[k][0]);
  const vars=[...new Set(e.source.match(/\{\w+\}/g)||[])],note=[e.label&&e.label!==e.source?e.label:'',e.usage?.includes('unused')?'Unused':'',vars.length?'Keep '+vars.join(' '):''].filter(Boolean).join(' · ');
  return [windowGroup(e),kinds.join(' + '),v.en??'',v.fr??'',v.ht??'',note,key,target,currentPreset()]});
 const S=TranslationTable.SHEET,bytes=ComposerXlsx.write({sheet:'Texts',columns:[{title:'Where',width:22},{title:'Kind',width:24},{title:S.en,width:42},{title:S.fr,width:42},{title:S.ht,width:42},{title:'Note',width:26,muted:true},{title:S.key,width:28,muted:true},{title:S.game,hidden:true},{title:S.preset,hidden:true}],rows});
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');
 a.href=url;a.download=gameName().replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-').toLowerCase()+'-texts-'+currentPreset()+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 notify('Excel file downloaded · '+rows.length+' saved texts of this game.');
}
function canEdit(){return !!window.ComposerAuth?.canEdit(target)}
async function importTable(file){
 if(!canEdit())return;
 if(!file)return;if(saving||Object.keys(current()?.edits||{}).length){notify('Save or cancel open edits before importing.');return}
 const id=target,d=current();try{if(file.size>2_000_000)throw Error('Maximum file size is 2 MB.');// The Excel file Composer hands out; a CSV from before still comes back the old way.
 const changes=/\.csv$/i.test(file.name)||file.type==='text/csv'?TranslationTable.review(await file.text(),d,id,currentPreset()):TranslationTable.reviewSheet(await ComposerXlsx.read(await file.arrayBuffer()),d,id,currentPreset());if(id!==target)return;
 if(!changes.length){notify('Nothing to import: the file matches the saved texts.');return}
 importReview={game:id,preset:currentPreset(),revision:d.revision,changes};rows();report.scrollTop=0;notify(changes.length+(changes.length===1?' text changes':' texts change')+' · review before saving.');
 }catch(error){notify(error.message)}
}
async function saveImport(){
 if(saving||!importReview)return;const review=importReview,id=review.game,d=current();if(id!==target||currentPreset()!==review.preset||d.revision!==review.revision){notify('Translations changed. Import the file again.');return}
 const overrides=structuredClone(d.overrides),entries={};for(const change of review.changes){if(id==='kit')entries[change.key]=change.after;else overrides[change.key]=change.after}
 saving=true;rows();try{const data=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:d.revision,entries,overrides})},id);data.edits={};drafts.set(id,data);if(target===id){importReview=null;apply();notify('Imported '+review.changes.length+(review.changes.length===1?' text':' texts')+' into '+(id==='kit'?'the shared catalog.':'this game only.'))}}
 catch(error){if(target===id)notify(error.message)}finally{saving=false;if(target===id)rows()}
}
function importMarkup(){
 if(!importReview||importReview.game!==target)return '';const changes=importReview.changes;
 return '<section class="translation-import"><h3>Review import · '+changes.length+(changes.length===1?' changed text':' changed texts')+'</h3><p>'+(target==='kit'?'These changes update the shared catalog.':'These changes apply to this game only. Other games keep their translations.')+'</p><div class="translation-import-list">'+changes.map(change=>'<article><strong>'+esc(change.source)+'</strong>'+languages.filter(l=>change.before[l]!==change.after[l]).map(l=>'<p>'+labels[l]+'</p><del>'+esc(change.before[l]||'—')+'</del><ins>'+esc(change.after[l]||'— (English fallback)')+'</ins>').join('')+'</article>').join('')+'</div><div class="translation-row-actions"><button id="translate-import-cancel" '+(saving?'disabled':'')+'>Cancel</button><button id="translate-import-save" class="translation-save" '+(saving||!changes.length?'disabled':'')+'>'+(changes.length===1?'Save it':'Save all '+changes.length)+'</button></div></section>';
}
async function request(options,id=target){if(window.ComposerCloud?.enabled)return window.ComposerCloud.translations(id,options);const r=await fetch('translations?game='+encodeURIComponent(id),{cache:'no-store',...options});const data=await r.json();if(!r.ok)throw Error(data.message||'Could not load translations');return data}
const available=()=>Object.entries(current()?.catalog.entries||{}).filter(([,e])=>TranslationTable.applicable(e,target,currentPreset())).map(([key,e])=>[key,TranslationTable.context(e,target)]);
const areaOf=e=>e.group==='Scene'?'scene':'ui';
const windowGroup=e=>e.group==='Scene'?'Game scene':windowNames[e.previewWindow]||'Main screen';
// The order a player meets them: the screen and the sheets its panel opens, then the windows as
// the tab bar and the header open them (each list followed by its details), then the rest.
const SHEETS=['Bet amount','Difficulty','Rows','Auto Spin'],DETAILS={'Top bet details':'Top bets','My bet details':'My bets'};
const windowOrder=[...new Set(['Main screen',...SHEETS,'Game scene','Top bets','Top bet details','My bets','My bet details','How to play','Account','Settings',...Object.values(windowNames)])];
const compareWindows=(a,b)=>windowOrder.indexOf(a)-windowOrder.indexOf(b);
// The panel moves around the texts: interface or game scene (only when a game has both), then the
// main screen, its windows and its notices. The panel reads top down: the text type is picked first
// and everything under it counts only that type. The table edits them, every language
// side by side, and saves them where they are edited: each changed row has its own Save and Cancel
// (⌘/Ctrl+Enter saves it), and the bar above the table says what is open and saves it all at once.
function render(){const d=current();if(!d)return;
 controls.innerHTML='<div id="translation-areas" class="panel-seg tx-areas" role="group" aria-label="Where the text is"></div><section class="panel-sec tx-type-sec" id="translation-type-sec"><h3>Text type</h3><div id="translation-types" class="panel-seg" role="group" aria-label="Text type"></div><button type="button" class="tx-toggle" id="translate-missing" aria-pressed="'+missing+'">Only missing</button></section><nav id="translation-sections" aria-label="Translation windows"></nav>';
 report.innerHTML='<div id="tx-import"></div><div class="translations-heading" id="tx-heading"></div>'
  +'<div class="tx-toolbar"><div><input id="translate-search" type="search" placeholder="Find a text or key" value="'+esc(query)+'" aria-label="Find a text">'
  +'<button type="button" id="translate-export" title="Download every text of this game as an Excel file to translate">Export Excel</button><button type="button" id="translate-import" title="Bring the translated Excel file back (an older CSV works too)">Import</button><input id="translate-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv" hidden>'
  +'<button type="button" id="translate-reload" class="tx-icon" title="Read the saved texts again" aria-label="Reload">'+icon('reload')+'</button></div>'
  +'</div>'
  +'<div class="tx-savebar" id="tx-savebar"><small role="status" id="translate-message"></small><span class="translation-row-actions"><button type="button" id="translate-cancel-all">Discard all</button><button type="button" class="translation-save" id="translate-save-all">Save all</button></span></div><div id="tx-table"></div>';
 $('#translate-search').oninput=e=>{query=e.target.value;rows()};
 $('#translate-missing').onclick=e=>{missing=!missing;e.currentTarget.setAttribute('aria-pressed',String(missing));rows()};
 $('#translate-reload').onclick=()=>{if(saving)return;if(Object.keys(current()?.edits||{}).length||importReview?.changes.length){notify('Save or cancel your open edits or the import before reloading.');return}drafts.delete(target);load()};
 $('#translate-import').disabled=!canEdit();$('#translate-export').onclick=exportTable;$('#translate-import').onclick=()=>$('#translate-file').click();$('#translate-file').onchange=e=>{importTable(e.target.files[0]);e.target.value=''};
 $('#translate-save-all').onclick=saveAll;$('#translate-cancel-all').onclick=cancelAll;
 navigation();syncPreviewWindows();rows();mark();
}
function mark(){
 $('#translates-tab').classList.toggle('workspace-dirty',[...drafts.values()].some(d=>Object.keys(d.edits||{}).length));
 const bar=$('#tx-savebar');if(!bar)return;const n=Object.keys(current()?.edits||{}).length;
 bar.classList.toggle('dirty',!!n);
 // One open row saves from its own buttons; the bar offers everything at once only when there is more than one.
 for(const id of ['translate-save-all','translate-cancel-all']){const b=$('#'+id);b.hidden=n<2;b.disabled=saving}
 $('#translate-save-all').textContent=saving?'Saving…':'Save all '+n;
 if(!bar.dataset.note)$('#translate-message').textContent=!canEdit()?'Read-only access · preview and export only':saving?'Saving…':n?n+(n===1?' text has':' texts have')+' unsaved changes':'';
 bar.hidden=!$('#translate-message').textContent&&n<2;
}
const gameName=()=>window.ComposerTarget?.entry()?.title||'this game';
function notify(text){const m=$('#translate-message'),bar=$('#tx-savebar');if(!m)return;m.textContent=text;if(bar){bar.hidden=false;bar.dataset.note='1';clearTimeout(notify.timer);notify.timer=setTimeout(()=>{delete bar.dataset.note;mark()},4000)}}
function navigation(){
 const entries=available(),count=id=>entries.filter(([,e])=>areaOf(e)===id).length;
 // Interface or game scene is the widest choice, so it comes first, and only when the game has both.
 if(!count('scene')&&area==='ui')$('#translation-areas').hidden=true;
 else{$('#translation-areas').hidden=false;$('#translation-areas').innerHTML=[['ui','Interface'],['scene','Game scene']].map(([id,title])=>'<button type="button" data-area="'+id+'" aria-pressed="'+(area===id)+'">'+title+' · '+count(id)+'</button>').join('')}
 const groups=[...new Set(entries.filter(([,e])=>areaOf(e)===area).map(([,e])=>windowGroup(e)))].sort(compareWindows);if(!groups.includes(category))category='all';
 const notice=g=>g.startsWith('Notice · '),screen=g=>g==='Main screen'||g==='Game scene'||SHEETS.includes(g);
 // A sheet the panel opens sits under the screen, a list's details under the list.
 const child=g=>SHEETS.includes(g)||g in DETAILS;
 const item=(id,label)=>'<button type="button" class="'+(child(id)?'is-child':'')+'" data-section="'+esc(id)+'" aria-pressed="'+(category===id)+'"><span>'+esc(label)+'</span><small><i class="tx-miss" hidden></i><b></b></small></button>';
 const section=(title,list)=>list.length?'<section class="panel-sec">'+(title?'<h3>'+title+'</h3>':'')+'<div class="panel-nav">'+list.join('')+'</div></section>':'';
 $('#translation-sections').innerHTML=section('',[item('all','Whole game')])
  +section('Screen',groups.filter(screen).map(g=>item(g,g)))
  +section('Windows',groups.filter(g=>!screen(g)&&!notice(g)).map(g=>item(g,g)))
  +section('Notices',groups.filter(notice).map(g=>{const name=g.slice(9);return item(g,name[0].toUpperCase()+name.slice(1))}));
 for(const button of controls.querySelectorAll('[data-section]'))button.onclick=()=>{category=button.dataset.section;for(const link of controls.querySelectorAll('[data-section]'))link.setAttribute('aria-pressed',String(link.dataset.section===category));rows();report.scrollTop=0;
  activeKey='';syncSelection();stopStateInspection();
  if(category==='all'){apply();return}
  const kind=Object.entries(windowNames).find(([,label])=>label===category)?.[0]||'';
  inspectAction('',{previewWindow:kind});previewWindow(kind);
 };
 for(const b of controls.querySelectorAll('[data-area]'))b.onclick=()=>{area=b.dataset.area;category='all';textType='all';navigation();rows();report.scrollTop=0};
}
// Each kind of text has an icon, on its pill and on every row of that kind, so with All picked the
// table still shows at a glance what is on screen and what only a screen reader hears.
const KINDS={text:['Shown on screen',icon('shown',{class:'tx-kind-icon'})],
 accessibility:['Read by screen readers',icon('accessibility',{class:'tx-kind-icon'})],
 tooltip:['Tooltip on hover',icon('tooltip',{class:'tx-kind-icon'})],
 placeholder:['Placeholder in a field',icon('field',{class:'tx-kind-icon'})]};
function kindsMarkup(e){if(areaOf(e)==='scene')return '';const kinds=Object.keys(KINDS).filter(k=>matchesType(e,k));// Two icons on a row are one text used twice, so the tooltip says an edit changes both.
 const title=kinds.length>1?kinds.map(k=>KINDS[k][0]).join(' and ')+' — one text, so editing it changes both':KINDS[kinds[0]]?.[0]||'';
 return kinds.length?'<span class="tx-kinds" title="'+esc(title)+'">'+kinds.map(k=>KINDS[k][1]).join('')+'</span>':''}
const typeNames={all:'All',text:'UI texts',accessibility:'Accessibility',tooltip:'Tooltips',placeholder:'Placeholders',scene:'Scene texts'};
function matchesType(entry,type){const usage=entry.usage||(entry.group==='Scene'?['scene']:['text']);return type==='all'||(type==='accessibility'?usage.some(x=>['aria-label','aria-labelledby','alt','caption'].includes(x)):type==='tooltip'?usage.includes('title'):usage.includes(type))}
function typeNavigation(keep){
 // Counted over every window, like the windows below it, so neither changes when the other is picked.
 // Which types are offered is the game's; Only missing changes their counts, never the row.
 const all=available().filter(([,e])=>areaOf(e)===area),scope=all.filter(([key,e])=>keep(key,e));
 // One row of pills, one of them always pressed, All first. They sit above the windows and count the
 // whole game, so picking a window never changes them; the windows below count the picked type.
 // Only missing, under the pills, narrows every count in the panel, the pills' too.
 const types=area==='scene'?['all','scene']:['all','text','accessibility','tooltip','placeholder'];
 // A type with nothing in it is not offered at all.
 // The types overlap: a text can be a visible caption and an accessibility label at once, so the
 // types' counts can add up to more than All. All counts each text once; a type whose texts are
 // also of another kind says so in its tooltip.
 const about={text:'visible captions',accessibility:'accessibility labels',tooltip:'tooltips',placeholder:'placeholders',scene:'scene texts'};
 $('#translation-types').innerHTML=types.map(type=>{const mine=scope.filter(([,e])=>matchesType(e,type)),count=mine.length;if(!all.some(([,e])=>matchesType(e,type))&&type!==textType)return '';const shared=type==='all'?0:mine.filter(([,e])=>types.some(t=>t!=='all'&&t!==type&&matchesType(e,t))).length;const title=type==='all'?'Every type, each text counted once':count+' '+about[type]+(shared?' · '+shared+' of them '+(shared===1?'is':'are')+' also of another kind, so the counts overlap':'');return '<button type="button" data-text-type="'+type+'" aria-pressed="'+(textType===type)+'" title="'+esc(title)+'">'+(KINDS[type]?.[1]||'')+typeNames[type]+' · '+count+'</button>'}).join('');
 // A game with one kind of text has nothing to pick.
 $('#translation-types').hidden=$('#translation-types').children.length<3;
 for(const button of controls.querySelectorAll('[data-text-type]'))button.onclick=()=>{textType=button.dataset.textType;rows();report.scrollTop=0;controls.querySelector('[data-text-type="'+textType+'"]')?.focus({preventScroll:true})};
}
// One quiet line, only for a text that is not shown.
function metaLine(e){
 // Only what an editor must know: that a text is not shown. Whether it is seen or heard is the
 // row's icons, and when in a round it shows is the preview's business.
 const usage=e.usage||[];return usage.includes('unused')?'Unused · '+(e.unusedReason||'not rendered'):'';
}
// A game's own text, else the text every game shares, else the catalog's.
const valueOf=(d,key,e,lang)=>d.edits?.[key]?.[lang]??d.overrides[key]?.[lang]??d.shared?.[key]?.[lang]??e[lang]??'';
const tableRows=()=>[...report.querySelectorAll('tr[data-translation]')];
function pickCell(row,lang){
 // The row takes focus first: the preview gives focus back to whatever held it when it changed.
 const key=row.dataset.translation;cellLang=lang||cellLang;row.focus({preventScroll:true});if(activeKey!==key||language.value!==cellLang)focusText(key,cellLang);
 // Picking may redraw the table; the row to keep the keys on is the one there now.
 syncSelection();const now=report.querySelector('tr[data-translation="'+CSS.escape(key)+'"]')||row;now.focus({preventScroll:true});now.scrollIntoView({block:'nearest'});
}
function enterCell(cell){
 const row=cell.closest('tr'),input=cell.querySelector('textarea'),doc=cell.querySelector('[data-doc]');
 cellLang=cell.dataset.cell;
 if(doc){openDocument(doc.dataset.doc,doc.dataset.lang);return}
 if(!input)return;input.focus();const end=input.value.length;input.setSelectionRange(end,end);
}
// Out of a cell, back to picking: Escape stays on the row, Enter goes to the one below.
function leaveCell(input,step){
 const row=input.closest('tr'),list=tableRows(),next=list[list.indexOf(row)+step]||row;
 input.blur();pickCell(next,input.dataset.lang);
}
function cellKeys(event,row){
 const list=tableRows(),i=list.indexOf(row),order=languages,j=order.indexOf(cellLang);
 const cell=row.querySelector('[data-cell="'+cellLang+'"]');
 if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const next=list[i+(event.key==='ArrowDown'?1:-1)];if(next)pickCell(next,cellLang)}
 else if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const lang=order[j+(event.key==='ArrowRight'?1:-1)];if(lang)pickCell(row,lang)}
 else if(event.key==='Enter'||event.key==='F2'){event.preventDefault();if(cell)enterCell(cell)}
 // A letter typed on a picked cell goes into it, at the end of what is there.
 else if(event.key.length===1&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&cell?.querySelector('textarea'))enterCell(cell);
}
function rows(){const d=current();if(!d)return;
 const lang=language.value,others=languages.filter(l=>l!=='en');
 const isMissing=(key,e)=>(lang==='en'?others:[lang]).some(l=>!valueOf(d,key,e,l));
 typeNavigation((key,e)=>!missing||isMissing(key,e));
 // Top down, one sum: the type and Only missing at the top of the panel narrow the windows' counts
 // under them, and the table holds exactly what the picked window counts. Only search, above the
 // table, narrows the table further, and then it says "6 of 9".
 const found=([key,e])=>[key,e.source,...languages.map(l=>valueOf(d,key,e,l))].some(v=>String(v).toLowerCase().includes(query.toLowerCase()));
 const whole=available().filter(([,e])=>areaOf(e)===area),typed=whole.filter(([,e])=>matchesType(e,textType)),inArea=missing?typed.filter(([key,e])=>isMissing(key,e)):typed;
 const scoped=inArea.filter(found);
 const toggle=$('#translate-missing'),gapsAll=typed.filter(([key,e])=>isMissing(key,e)).length;toggle.textContent='Only missing · '+gapsAll;toggle.title=gapsAll+' of these texts '+(gapsAll===1?'lacks':'lack')+' '+(lang==='en'?'a translation':labels[lang]);
 for(const button of controls.querySelectorAll('[data-section]')){
  const mine=([,entry])=>button.dataset.section==='all'||windowGroup(entry)===button.dataset.section;
  const total=inArea.filter(mine).length;button.querySelector('b').textContent=total;button.classList.toggle('is-empty',!total);
  const gaps=typed.filter(mine).filter(([key,e])=>isMissing(key,e)).length;
  // With Only missing on, the count is the gaps already.
  const miss=button.querySelector('.tx-miss');miss.hidden=!gaps||missing;miss.textContent=gaps;miss.title=gaps+' missing '+(language.value==='en'?'in a translation':'in '+labels[language.value]);
 }
 const entries=scoped.filter(([,e])=>category==='all'||windowGroup(e)===category),inWindow=inArea.filter(([,e])=>category==='all'||windowGroup(e)===category).length;
 const groups=new Map();for(const row of entries){const group=windowGroup(row[1]);if(!groups.has(group))groups.set(group,[]);groups.get(group).push(row)}
 const title=category!=='all'?category:area==='scene'?'Scene texts':'Whole game',description=area==='scene'?'Hints, pop-ups and messages drawn inside the game scene.':'Texts used by this game’s '+(currentPreset()==='menu-drawer-v1'?'Menu tabs':currentPreset()==='tabbed-shell-v1'?'Tabs':'Standard')+' preset. Click a cell to edit it.';
 $('#tx-import').innerHTML=importMarkup();
 const narrowed=entries.length!==inWindow,count=(narrowed?entries.length+' of '+inWindow:String(inWindow))+(missing?' missing':'');
 $('#tx-heading').innerHTML='<div class="tx-title"><h2 title="'+esc(description)+'">'+esc(title)+'</h2><span class="translation-total">'+count+(inWindow===1&&!narrowed?' text':' texts')+'</span></div><span class="tx-progress" id="tx-progress"></span>'+(area==='scene'||!entries.length?'':'<p class="tx-hint">Click a text to see it in the preview · double-click or press Enter to edit it.</p>');
 // "Only missing" narrows the table, not the progress: FR and CR still count the whole window.
 const counted=typed.filter(row=>(category==='all'||windowGroup(row[1])===category)&&found(row));
 $('#tx-progress').innerHTML=others.map(l=>{const done=counted.filter(([key,e])=>valueOf(d,key,e,l)).length,total=counted.length;return '<span title="'+labels[l]+': '+done+' of '+total+' texts translated"><em>'+l.replace('ht','cr').toUpperCase()+'</em><b>'+done+'/'+total+'</b><i style="--p:'+(total?Math.round(done/total*100):0)+'%"></i></span>'}).join('');
 const editable=canEdit()&&!importReview&&!saving;
 const head='<thead><tr>'+languages.map(l=>'<th scope="col" lang="'+l+'" class="'+(l===lang?'is-lang':'')+'">'+labels[l]+'</th>').join('')+'</tr></thead>';
 const body=[...groups].sort(([a],[b])=>compareWindows(a,b)).map(([group,list])=>(category==='all'?'<tr class="tx-group"><th colspan="3" scope="rowgroup">'+esc(group)+' <span>'+(()=>{const all=inArea.filter(([,e])=>windowGroup(e)===group).length;return list.length===all?all:list.length+' of '+all})()+'</span></th></tr>':'')+list.map(([key,e])=>{
  const edit=d.edits?.[key],unused=e.usage?.includes('unused'),meta=metaLine(e);
  const scope=edit?scopeMarkup(key,edit.custom):'';
  const about=(e.label&&e.label!==e.source?'<small>'+esc(e.label)+'</small>':'')+(meta?'<small title="'+esc((e.usage||[]).join(', '))+'">'+esc(meta)+'</small>':'')+(edit?.error?'<small class="translation-error" role="alert">'+esc(edit.error)+'</small>':'');
  return '<tr class="translation-row'+(edit?' is-editing':'')+'" data-translation="'+key+'" tabindex="-1">'
   +languages.map(l=>{const v=valueOf(d,key,e,l),changed=edit&&edit[l]!==(d.overrides[key]?.[l]??e[l]??'');return '<td data-cell="'+l+'" class="tx-cell'+(v?'':' missing')+(changed?' changed':'')+(l===lang?' is-lang':'')+(l==='en'?' has-kinds':'')+'">'+(l==='en'?kindsMarkup(e):'')+(e.format==='markdown'?'<button type="button" class="tx-doc" tabindex="-1" lang="'+l+'" data-doc="'+key+'" data-lang="'+l+'" aria-label="'+esc((e.label||'Document')+' — '+labels[l])+'"><span>'+(esc(docPreview(v))||'<em>Missing · English shows</em>')+'</span><small>'+(editable&&!unused?'Open editor':'Open')+'</small></button>':'<textarea rows="1" tabindex="-1" lang="'+l+'" data-key="'+key+'" data-lang="'+l+'" aria-label="'+esc(e.source)+' — '+labels[l]+'" placeholder="'+(l==='en'?'':'Missing · English shows')+'"'+(editable&&!unused?'':' readonly')+'>'+esc(v)+'</textarea>')+(l==='en'?'<div class="tx-text">'+about+'</div>':'')+'</td>'}).join('')+'</tr>'+(edit?rowActions(key,scope):'');
 }).join('')).join('');
 $('#tx-table').innerHTML=entries.length?'<div class="tx-table-wrap"><table class="tx-table">'+head+'<tbody>'+body+'</tbody></table></div>'
  :'<div class="translation-empty"><h3>'+(query||missing||textType!=='all'||category!=='all'?'No matching texts':'No scene texts for this game')+'</h3><p>'+(query||missing||textType!=='all'||category!=='all'?'Try another text type, window or search.':'This game uses the UI for its messages. Decorative text painted into artwork is not a text label.')+'</p></div>';
 syncSelection();mark();
 // As in a spreadsheet: a click picks a cell (and its row, shown in the preview); a double click,
 // Enter, F2 or typing goes into it with the caret at the end; Escape comes back out, and Enter
 // inside moves to the row below. Arrows move between rows and languages.
 for(const row of report.querySelectorAll('tr[data-translation]')){
  row.onclick=event=>{if(event.target.closest('textarea.is-typing'))return;pickCell(row,event.target.closest('[data-cell]')?.dataset.cell||cellLang)};
  row.ondblclick=event=>{const cell=event.target.closest('[data-cell]');if(cell&&!event.target.closest('textarea.is-typing'))enterCell(cell)};
  row.onkeydown=event=>{if(event.target!==row)return;cellKeys(event,row)};
 }
 for(const input of report.querySelectorAll('textarea[data-key]')){
  input.onfocus=()=>{input.classList.add('is-typing');cellLang=input.dataset.lang;focusText(input.dataset.key,input.dataset.lang)};
  input.onblur=()=>input.classList.remove('is-typing');
  input.oninput=()=>{
   const {key,lang:l}=input.dataset,e={...d.catalog.entries[key],...d.overrides[key]};
   d.edits??={};d.edits[key]??={...texts(e),custom:target!=='kit'};d.edits[key][l]=input.value;
   const original=d.overrides[key]?.[l]??d.catalog.entries[key][l]??'';
   input.parentElement.classList.toggle('changed',input.value!==original);input.parentElement.classList.toggle('missing',!input.value);
   const row=input.closest('tr');if(!row.classList.contains('is-editing')){row.classList.add('is-editing');row.insertAdjacentHTML('afterend',rowActions(key,scopeMarkup(key,true)));wireRow(row.nextElementSibling)}
   activeKey=key;apply();mark();
  };
  input.onkeydown=e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();if(d.edits?.[input.dataset.key])saveKeys([input.dataset.key])}else if(e.key==='Escape'){e.preventDefault();leaveCell(input,0)}else if(e.key==='Enter'&&!e.shiftKey&&!input.classList.contains('tx-long')){e.preventDefault();leaveCell(input,1)}};
 }
 for(const row of report.querySelectorAll('tr.tx-actions'))wireRow(row);

 if($('#translate-import-cancel'))$('#translate-import-cancel').onclick=()=>{importReview=null;rows()};if($('#translate-import-save'))$('#translate-import-save').onclick=saveImport;
}
// A rules document (How to play) is edited in a window of its own, visually: every language side
// by side, a toolbar for headings, emphasis and lists, pictures uploaded to Composer's media
// bucket, and the game's own blocks (a pay table) placed where they belong. It is stored as the
// same small Markdown the kit renders (## heading, **bold**, *italic*, - list, 1. list,
// ![alt](url) on its own line, [[block]] on its own line), so nothing else in the pipeline changes.
let docDialog=null;
// The table shows a document as readable text: no Markdown marks, a picture or block named.
const docPreview=v=>String(v||'').split(/\r?\n/).map(line=>{const img=line.match(/^\s*!\[([^\]]*)\]/),block=line.match(/^\s*\[\[([a-z][a-z0-9_-]*)\]\]\s*$/);return img?'[Picture'+(img[1]?': '+img[1]:'')+']':block?'['+blockLabel(block[1])+']':line.replace(/^\s*\[(center|right)\]\s+/,'').replace(/^(#{1,3}|-#)\s+/,'').replace(/^\s*[-*]\s+\[x\]\s+/i,'✓ ').replace(/^\s*[-*]\s+\[ \]\s+/,'✕ ').replace(/\[([^\]]+)\]\((?:https:\/\/[^)\s]+|color:[a-z]+)\)/g,'$1').replace(/\*\*?([^*]+)\*\*?|\+\+([^+]+)\+\+|~~([^~]+)~~/g,(m,a,b,c)=>a||b||c)}).join('\n');
const MEDIA_BUCKET='composer-media';
const blockLabel=name=>({paytable:'Pay table',paylines:'Pay lines',linepays:'Line pays',symbols:'Symbols',multipliers:'Multipliers',rtp:'Return to player',ladder:'Cascade ladder',cluster_examples:'Cluster examples'})[name]||name.replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());
// The blocks this game can fill, as the running game declares them.
function gameBlocks(){try{return Object.keys(frame.contentWindow?.CrashUI?.instance?.config?.rulesBlocks||{})}catch{return []}}
// The colours a document may use: the brand's own roles, so they follow every brand and theme.
// The hex values only paint them in the editor; the game draws them from its tokens.
const DOC_COLOURS={brand:['Brand','#ffba2c'],green:['Green','#4ace68'],red:['Red','#ff9a9a'],blue:['Blue','#00d7ff'],grey:['Grey','#a4a4a4']};
const colourName=value=>{const hex=String(value||'').trim().toLowerCase();const rgb=hex.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);const norm=rgb?'#'+rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):hex;return Object.entries(DOC_COLOURS).find(([,[,h]])=>h===norm)?.[0]||''};
// The document's text → the editor's HTML (every piece the editor knows, nothing else).
function docToHtml(value){
 const safe=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const inline=v=>safe(v).replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+|color:[a-z]+)\)/g,(m,text,target)=>target.startsWith('color:')?(DOC_COLOURS[target.slice(6)]?'<font color="'+DOC_COLOURS[target.slice(6)][1]+'">'+text+'</font>':text):'<a href="'+target+'">'+text+'</a>')
  .replace(/\+\+([^+]+)\+\+/g,'<u>$1</u>').replace(/~~([^~]+)~~/g,'<strike>$1</strike>').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/\*([^*]+)\*/g,'<i>$1</i>');
 const out=[];let para=[],list='',paraAlign='';
 const style=align=>align?' style="text-align:'+align+'"':'';
 const flush=()=>{if(para.length){out.push('<p'+style(paraAlign)+'>'+inline(para.join(' '))+'</p>');para=[]}if(list){out.push(list==='check'?'</ul>':'</'+list+'>');list=''}};
 for(let line of String(value||'').split(/\r?\n/)){
  let align='';const aligned=line.match(/^\s*\[(center|right)\]\s+(.*)$/);if(aligned){align=aligned[1];line=aligned[2]}
  const h=line.match(/^(#{1,3})\s+(.+)$/),small=line.match(/^-#\s+(.+)$/),check=line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/),li=line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/),img=line.match(/^\s*!\[([^\]]*)\]\((\S+)\)\s*$/),block=line.match(/^\s*\[\[([a-z][a-z0-9_-]*)\]\]\s*$/);
  if(!line.trim()){flush();continue}
  if(img){flush();out.push('<figure contenteditable="false"><img src="'+safe(img[2])+'" alt="'+safe(img[1])+'"></figure>');continue}
  if(block){flush();out.push('<div class="rte-block" contenteditable="false" data-block="'+block[1]+'">'+safe(blockLabel(block[1]))+' · filled in by the game</div>');continue}
  if(h){flush();out.push('<h'+h[1].length+style(align)+'>'+inline(h[2])+'</h'+h[1].length+'>');continue}
  if(small){flush();out.push('<p class="rte-small"'+style(align)+'>'+inline(small[1])+'</p>');continue}
  if(check){if(list!=='check'){flush();list='check';out.push('<ul class="rte-check"'+style(align)+'>')}out.push('<li data-check="'+(check[1]===' '?'no':'yes')+'">'+inline(check[2])+'</li>');continue}
  if(li){const type=/^\s*\d/.test(line)?'ol':'ul';if(list!==type){flush();list=type;out.push('<'+type+style(align)+'>')}out.push('<li>'+inline(li[1])+'</li>');continue}
  if(list)flush();if(!para.length)paraAlign=align;para.push(line);
 }
 flush();return out.join('')||'<p><br></p>';
}
// The editor's HTML → the document's text. Anything a paste or the browser brings in that is
// not one of the editor's pieces is read as plain text, so the stored document never holds HTML.
function htmlToDoc(root){
 const wrap=(mark,text)=>{const t=text.trim();if(!t)return text;const lead=text.match(/^\s*/)[0],tail=text.match(/\s*$/)[0];return lead+mark+t+mark+tail};
 const inline=node=>[...node.childNodes].map(n=>{
  if(n.nodeType===3)return n.nodeValue.replace(/\s+/g,' ');
  if(n.nodeType!==1)return '';
  const tag=n.tagName;let text=inline(n);
  if(tag==='BR')return ' ';
  const css=n.style||{},colour=colourName(n.getAttribute('color')||css.color);
  if(tag==='B'||tag==='STRONG'||css.fontWeight==='bold'||Number(css.fontWeight)>=600)text=wrap('**',text);
  if(tag==='I'||tag==='EM'||css.fontStyle==='italic')text=wrap('*',text);
  if(tag==='U'||/underline/.test(css.textDecoration||css.textDecorationLine||''))text=wrap('++',text);
  if(tag==='S'||tag==='STRIKE'||tag==='DEL'||/line-through/.test(css.textDecoration||css.textDecorationLine||''))text=wrap('~~',text);
  if(colour&&text.trim())text=text.replace(/^(\s*)(.*?)(\s*)$/,(m,a,t,b)=>a+'['+t+'](color:'+colour+')'+b);
  if(tag==='A'&&/^https:\/\//.test(n.getAttribute('href')||'')&&text.trim())text=text.replace(/^(\s*)(.*?)(\s*)$/,(m,a,t,b)=>a+'['+t+']('+n.getAttribute('href')+')'+b);
  return text;
 }).join('');
 const aligned=n=>{const a=(n.style?.textAlign||n.getAttribute?.('align')||'').toLowerCase();return a==='center'||a==='right'?'['+a+'] ':''};
 const blocks=[];
 const walk=parent=>{for(const n of parent.childNodes){
  if(n.nodeType===3){const t=n.nodeValue.trim();if(t)blocks.push(t);continue}
  if(n.nodeType!==1)continue;const tag=n.tagName;
  if(n.matches('.rte-block'))blocks.push('[['+n.dataset.block+']]');
  else if(tag==='FIGURE'||tag==='IMG'){const img=tag==='IMG'?n:n.querySelector('img');if(img)blocks.push('!['+(img.alt||'').replace(/[\[\]]/g,'')+']('+img.getAttribute('src')+')')}
  else if(/^H[1-6]$/.test(tag)){const t=inline(n).trim();if(t)blocks.push(aligned(n)+'#'.repeat(Math.min(3,Number(tag[1])))+' '+t)}
  else if(tag==='UL'||tag==='OL'){const check=n.classList.contains('rte-check');const items=[...n.children].filter(c=>c.tagName==='LI').map((li,i)=>{const t=inline(li).trim();if(!t)return '';return aligned(li)||aligned(n)?(aligned(li)||aligned(n))+(check?'- ['+(li.dataset.check==='no'?' ':'x')+'] ':tag==='OL'?(i+1)+'. ':'- ')+t:(check?'- ['+(li.dataset.check==='no'?' ':'x')+'] ':tag==='OL'?(i+1)+'. ':'- ')+t}).filter(Boolean);if(items.length)blocks.push(items.join('\n'))}
  // A browser can leave a list or heading inside a paragraph or a plain div: read what is inside.
  else if((tag==='DIV'||tag==='P')&&[...n.children].some(c=>/^(P|H\d|UL|OL|FIGURE|DIV)$/.test(c.tagName)))walk(n);
  else{const t=inline(n).trim();if(t)blocks.push(aligned(n)+(n.classList?.contains('rte-small')?'-# ':'')+t)}
 }};
 walk(root);return blocks.join('\n\n');
}
// A picture becomes a WebP at most 1600 px wide before it is uploaded, so a phone loads it fast.
async function shrink(file){
 const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/bitmap.width),canvas=document.createElement('canvas');
 canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
 return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not read this picture.')),'image/webp',0.86));
}
async function uploadPicture(file){
 const client=window.ComposerAuth?.client;if(!client)throw Error('Sign in to Composer to add pictures.');
 if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw Error('Use a PNG, JPEG, WebP or GIF picture.');
 const blob=file.type==='image/gif'?file:await shrink(file);if(blob.size>5*1024*1024)throw Error('The picture is larger than 5 MB even after shrinking.');
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
 const path=target+'/rules-'+digest+(blob.type==='image/gif'?'.gif':'.webp');
 const {error}=await client.storage.from(MEDIA_BUCKET).upload(path,blob,{contentType:blob.type,upsert:false,cacheControl:'31536000'});
 // The same picture uploaded before is already there under its own name; that is not an error.
 if(error&&!/exists|duplicate/i.test(error.message))throw Error(error.message||'Upload failed.');
 return client.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}
function openDocument(key,lang){
 const d=current(),raw=d?.catalog.entries[key];if(!raw)return;const e=TranslationTable.context(raw,target),editable=canEdit()&&!importReview&&!saving&&!e.usage?.includes('unused');
 focusText(key,lang);
 if(!docDialog){docDialog=document.createElement('dialog');docDialog.className='share-dialog tx-doc-dialog';document.body.append(docDialog)}
 const before=d.edits?.[key]?structuredClone(d.edits[key]):null,blocks=gameBlocks();
 // The toolbar reads like a document editor's: undo, the paragraph style, emphasis, colour, link and
 // picture, then lists, alignment and clearing. Fonts and sizes are the brand's, so they are not offered.
 const ICON={undo:icon('undo'),redo:icon('redo'),link:icon('link'),image:icon('image'),ul:icon('list-bullet'),ol:icon('list-number'),check:icon('list-check'),left:icon('align-left'),center:icon('align-center'),right:icon('align-right'),clear:icon('clear-format')};
 const tool=(cmd,label,title)=>'<button type="button" data-cmd="'+cmd+'" title="'+title+'" aria-label="'+title.replace(/ \(.*\)$/,'')+'">'+label+'</button>';
 const sep='<span class="rte-sep"></span>';
 docDialog.innerHTML='<header><div><h2>'+esc(e.label||'How to play')+'</h2><small>'+esc(target==='kit'?'Shared catalog':gameName()+' only')+' · each language is its own page; a picture or block goes into every language at the same place</small></div><button type="button" class="wb-button" data-close aria-label="Close">'+icon('close')+'</button></header>'
  +(editable?'<div class="rte-toolbar" role="toolbar" aria-label="Formatting">'+tool('undo',ICON.undo,'Undo (⌘Z)')+tool('redo',ICON.redo,'Redo (⇧⌘Z)')+sep
   +'<select data-style aria-label="Paragraph style"><option value="h1">Title</option><option value="h2">Heading</option><option value="h3">Subheading</option><option value="p">Normal text</option><option value="small">Small print</option></select>'+sep
   +tool('bold','<b>B</b>','Bold (⌘B)')+tool('italic','<i>I</i>','Italic (⌘I)')+tool('underline','<u>U</u>','Underline (⌘U)')+tool('strikeThrough','<s>S</s>','Strikethrough')
   +'<span class="rte-colour"><button type="button" data-colour-open title="Text colour" aria-label="Text colour" aria-haspopup="true"><span class="rte-a">A</span><i></i></button><span class="rte-swatches" hidden><button type="button" data-colour="" title="Default">Default</button>'+Object.entries(DOC_COLOURS).map(([name,[title,hex]])=>'<button type="button" data-colour="'+name+'" title="'+title+'" style="--swatch:'+hex+'"><i></i>'+title+'</button>').join('')+'</span></span>'+sep
   +tool('link',ICON.link,'Link (⌘K)')+tool('image',ICON.image,'Picture')
   +(blocks.length?'<select data-cmd="block" aria-label="Insert a game block"><option value="">Game block…</option>'+blocks.map(b=>'<option value="'+esc(b)+'">'+esc(blockLabel(b))+'</option>').join('')+'</select>':'')+sep
   +tool('ul',ICON.ul,'Bulleted list')+tool('ol',ICON.ol,'Numbered list')+tool('check',ICON.check,'✓ / ✕ list (click a mark to flip it)')+sep
   +tool('justifyLeft',ICON.left,'Align left')+tool('justifyCenter',ICON.center,'Align centre')+tool('justifyRight',ICON.right,'Align right')+sep
   +tool('clear',ICON.clear,'Clear formatting')
   +'<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden data-picture></div>':'')
  +'<div class="tx-doc-columns">'+languages.map(l=>'<section><span>'+labels[l]+'</span><div class="rte" lang="'+l+'" data-doc-lang="'+l+'" role="textbox" aria-multiline="true" aria-label="'+esc((e.label||'How to play')+' — '+labels[l])+'" contenteditable="'+(editable?'true':'false')+'">'+docToHtml(valueOf(d,key,e,l))+'</div></section>').join('')+'</div>'
  +'<footer><small role="status"></small><span class="translation-row-actions"><button type="button" data-doc-cancel>'+(editable?'Cancel':'Close')+'</button>'+(editable?'<button type="button" class="translation-save" data-doc-save>Save</button>':'')+'</span></footer>';
 const editors=[...docDialog.querySelectorAll('.rte')],status=docDialog.querySelector('footer small');let last=editors.find(x=>x.dataset.docLang===lang)||editors[0];
 // What the editors hold goes into the same open edit as the table, so the game preview follows it.
 const sync=editor=>{d.edits??={};d.edits[key]??={...texts({...raw,...d.overrides[key]}),custom:target!=='kit'};d.edits[key][editor.dataset.docLang]=htmlToDoc(editor);activeKey=key;apply();mark()};
 const topIndex=editor=>{const sel=getSelection();let n=sel.rangeCount?sel.getRangeAt(0).startContainer:null;while(n&&n.parentNode!==editor)n=n.parentNode;return n?[...editor.childNodes].indexOf(n):editor.childNodes.length-1};
 // A picture or a block lands in every language, after the same paragraph as in the one being edited.
 const everywhere=html=>{const at=topIndex(last);for(const editor of editors){const ref=editor.childNodes[Math.min(at,editor.childNodes.length-1)];const holder=document.createElement('div');holder.innerHTML=html;const node=holder.firstChild;if(ref)ref.after(node);else editor.append(node);if(!node.nextSibling)node.after(Object.assign(document.createElement('p'),{innerHTML:'<br>'}));sync(editor)}};
 for(const editor of editors){
  editor.onfocus=()=>{last=editor};editor.oninput=()=>sync(editor);
  // Pasted text arrives as text: no foreign styles, fonts or markup.
  editor.onpaste=ev=>{ev.preventDefault();const text=ev.clipboardData.getData('text/plain');document.execCommand('insertText',false,text)};
  editor.ondrop=ev=>{const file=[...ev.dataTransfer?.files||[]].find(f=>f.type.startsWith('image/'));if(!file)return;ev.preventDefault();last=editor;addPicture(file)};
  editor.onkeydown=ev=>{if((ev.metaKey||ev.ctrlKey)&&ev.key==='Enter'){ev.preventDefault();docDialog.querySelector('[data-doc-save]')?.click()}};
  // A picture's description (read aloud by screen readers) is edited by double-clicking it.
  editor.ondblclick=ev=>{const img=ev.target.closest('img');if(!img||!editable)return;const alt=prompt('Describe the picture (read aloud to players who cannot see it):',img.alt||'');if(alt!==null){img.alt=alt.replace(/[\[\]<>]/g,'');sync(editor)}};
 }
 const addPicture=async file=>{status.textContent='Uploading the picture…';try{const url=await uploadPicture(file);const alt=file.name.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').replace(/[\[\]<>]/g,'');everywhere('<figure contenteditable="false"><img src="'+esc(url)+'" alt="'+esc(alt)+'"></figure>');status.textContent='Picture added to every language · double-click it to describe it'}catch(error){status.textContent=error.message}};
 // Commands on the editor being typed in. Each ends by reading the editor back into the document.
 const block=()=>{const sel=getSelection();let n=sel.rangeCount?sel.getRangeAt(0).startContainer:null;while(n&&n.parentNode!==last)n=n.parentNode;return n?.nodeType===1?n:null};
 const run=(cmd,value)=>{last.focus();document.execCommand('styleWithCSS',false,false);document.execCommand(cmd,false,value);sync(last);refresh()};
 const listAt=()=>{const n=getSelection().anchorNode;return n?.nodeType===1?n.closest('ul,ol'):n?.parentElement?.closest('ul,ol')};
 const command=cmd=>{
  if(cmd==='image'){docDialog.querySelector('[data-picture]').click();return}
  if(cmd==='ul'||cmd==='ol'){run(cmd==='ul'?'insertUnorderedList':'insertOrderedList');return}
  if(cmd==='check'){last.focus();let list=listAt();
   if(list?.classList.contains('rte-check')){list.classList.remove('rte-check');sync(last);refresh();return}
   if(!list||list.tagName!=='UL'){document.execCommand('insertUnorderedList');list=listAt()}
   if(list){list.classList.add('rte-check');for(const li of list.children)li.dataset.check??='yes'}sync(last);refresh();return}
  if(cmd==='link'){last.focus();const sel=getSelection();const current=sel.anchorNode?.parentElement?.closest('a')?.getAttribute('href')||'';const url=prompt('Link address (https://…). Leave empty to remove the link.',current||'https://');if(url===null)return;
   if(!url.trim()||url.trim()==='https://'){run('unlink');return}if(!/^https:\/\/[^\s<>"]+$/.test(url.trim())){status.textContent='A link must start with https://';return}
   if(sel.isCollapsed&&!current){status.textContent='Select the words to link first.';return}run('createLink',url.trim());return}
  if(cmd==='clear'){run('removeFormat');const b=block();if(b){b.style.textAlign='';b.classList.remove('rte-small');sync(last)}return}
  run(cmd);
 };
 for(const button of docDialog.querySelectorAll('button[data-cmd]')){button.onmousedown=ev=>ev.preventDefault();button.onclick=()=>command(button.dataset.cmd)}
 // The paragraph style: a heading level, normal text or the small print.
 const styleSelect=docDialog.querySelector('[data-style]');
 if(styleSelect)styleSelect.onchange=()=>{const value=styleSelect.value;last.focus();document.execCommand('formatBlock',false,value==='small'?'p':value);const b=block();if(b)b.classList.toggle('rte-small',value==='small');sync(last);refresh()};
 // Colour: the brand's roles only, from a small palette under the button.
 const swatches=docDialog.querySelector('.rte-swatches'),colourOpen=docDialog.querySelector('[data-colour-open]');
 if(colourOpen){colourOpen.onmousedown=ev=>ev.preventDefault();colourOpen.onclick=()=>{swatches.hidden=!swatches.hidden};
  for(const b of swatches.querySelectorAll('[data-colour]')){b.onmousedown=ev=>ev.preventDefault();b.onclick=()=>{swatches.hidden=true;const name=b.dataset.colour;if(getSelection().isCollapsed){status.textContent='Select the words to colour first.';return}run('foreColor',name?DOC_COLOURS[name][1]:getComputedStyle(last).color)}}}
 // The toolbar shows what the caret is in: the style, emphasis, lists and alignment.
 const refresh=()=>{if(!docDialog.open||!editable)return;const b=block();
  if(styleSelect)styleSelect.value=!b?'p':b.classList.contains('rte-small')?'small':/^H[123]$/.test(b.tagName)?b.tagName.toLowerCase():'p';
  for(const cmd of ['bold','italic','underline','strikeThrough']){const button=docDialog.querySelector('[data-cmd='+cmd+']');try{button.setAttribute('aria-pressed',String(document.queryCommandState(cmd)))}catch{}}
  const align=b?getComputedStyle(b).textAlign:'left';for(const [cmd,a] of [['justifyLeft','left'],['justifyCenter','center'],['justifyRight','right']])docDialog.querySelector('[data-cmd='+cmd+']')?.setAttribute('aria-pressed',String(align===a||(a==='left'&&align==='start')));
  const list=listAt();
  for(const [cmd,on] of [['ul',list?.tagName==='UL'&&!list.classList.contains('rte-check')],['ol',list?.tagName==='OL'],['check',!!list?.classList.contains('rte-check')]])docDialog.querySelector('[data-cmd='+cmd+']')?.setAttribute('aria-pressed',String(!!on));
 };
 document.onselectionchange=()=>{if(docDialog.open&&last.contains(getSelection().anchorNode))refresh()};
 for(const editor of editors){
  // A ✓ / ✕ mark flips when it is clicked.
  editor.addEventListener('click',ev=>{const li=ev.target.closest('.rte-check>li');if(!li||!editable)return;if(ev.clientX-li.getBoundingClientRect().left<22){li.dataset.check=li.dataset.check==='no'?'yes':'no';sync(editor)}});
  editor.addEventListener('keydown',ev=>{if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();ev.stopPropagation();last=editor;command('link')}},true);
 }
 const picker=docDialog.querySelector('[data-picture]');if(picker)picker.onchange=()=>{const file=picker.files[0];picker.value='';if(file)addPicture(file)};
 const blockSelect=docDialog.querySelector('select[data-cmd=block]');if(blockSelect)blockSelect.onchange=()=>{const name=blockSelect.value;blockSelect.value='';if(name)everywhere('<div class="rte-block" contenteditable="false" data-block="'+esc(name)+'">'+esc(blockLabel(name))+' · filled in by the game</div>')};
 const discard=()=>{if(before)d.edits[key]=before;else if(d.edits)delete d.edits[key];docDialog.close();rows();apply()};
 docDialog.querySelector('[data-close]').onclick=discard;docDialog.querySelector('[data-doc-cancel]').onclick=discard;docDialog.oncancel=ev=>{ev.preventDefault();discard()};
 const save=docDialog.querySelector('[data-doc-save]');
 if(save)save.onclick=async()=>{if(!d.edits?.[key]){docDialog.close();return}save.disabled=true;status.textContent='Saving…';await saveKeys([key]);if(!current()?.edits?.[key])docDialog.close();else{save.disabled=false;status.textContent=$('#translate-message')?.textContent||'Could not save.'}};
 docDialog.showModal();last.focus();
}
// Save and Cancel for one changed text, on a strip right under its row across the whole table;
// the scope says which games the edit reaches.
const saveKey=/Mac|iPhone|iPad/.test(navigator.platform)?'⌘↵':'Ctrl+Enter';
// Where an open edit is saved. Cloud drafts are per game, so the choice between this game and
// every game exists only for local files; in the cloud the strip says what will happen instead.
function scopeMarkup(key,custom){
 if(target==='kit')return '';
 if(window.ComposerCloud?.enabled&&!window.ComposerCloud.sharedTexts?.())return '<small class="tx-scope-note" title="Every game keeps its own texts in the cloud; change the other games one by one.">Saved for '+esc(gameName())+' only</small>';
 return '<button type="button" class="tx-scope" data-scope="'+key+'" title="'+(window.ComposerCloud?.enabled?'Saved for this game, or in the shared texts every game reads':'Where this edit is saved')+'">'+(custom?esc(gameName())+' only':'Every game')+'</button>';
}
function rowActions(key,scope){return '<tr class="tx-actions" data-actions-for="'+key+'"><td colspan="3"><div class="tx-row-save">'+scope+'<small>'+saveKey+' saves this text</small><span class="translation-row-actions"><button type="button" data-row-cancel="'+key+'">Cancel</button><button type="button" class="translation-save" data-row-save="'+key+'">Save</button></span></div></td></tr>'}
function wireRow(row){
 row.querySelector('[data-scope]')?.addEventListener('click',scopeClick);
 const save=row.querySelector('[data-row-save]'),cancel=row.querySelector('[data-row-cancel]');
 if(save){save.disabled=saving;save.onclick=()=>saveKeys([save.dataset.rowSave])}
 if(cancel){cancel.disabled=saving;cancel.onclick=()=>{const d=current();if(saving||!d?.edits)return;delete d.edits[cancel.dataset.rowCancel];activeKey='';stopStateInspection();rows();apply()}}
}
function scopeClick(event){const d=current(),key=event.currentTarget.dataset.scope,edit=d.edits?.[key];if(!edit)return;edit.custom=!edit.custom;event.currentTarget.textContent=edit.custom?gameName()+' only':'Every game';apply()}
const saveAll=()=>saveKeys(Object.keys(current()?.edits||{}));
// Saves the given open texts; any other open edits stay open, still unsaved.
async function saveKeys(keys){
 const id=target,d=current();keys=keys.filter(key=>d?.edits?.[key]);if(saving||!keys.length)return;
 saving=true;mark();for(const b of report.querySelectorAll('[data-row-save],[data-row-cancel]'))b.disabled=true;
 const overrides=structuredClone(d.overrides),entries={},rest=Object.fromEntries(Object.entries(d.edits).filter(([key])=>!keys.includes(key)));
 // In the cloud a text for every game goes to the shared scope's draft, not into the catalog.
 const cloud=!!window.ComposerCloud?.enabled,sharedKeys=cloud?keys.filter(key=>!d.edits[key].custom):[];
 for(const key of keys){const edit=d.edits[key];if(edit.custom)overrides[key]=texts(edit);else{delete overrides[key];if(!cloud)entries[key]=texts(edit)}}
 try{
  if(sharedKeys.length){const shared={...(d.shared||{})};for(const key of sharedKeys)shared[key]=texts(d.edits[key]);await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:d.sharedRevision,entries:{},overrides:shared})},'shared')}
  const data=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:d.revision,entries,overrides})},id);data.edits=rest;drafts.set(id,data);if(target===id){apply();saving=false;rows();notify('Saved '+(keys.length===1?'1 text':keys.length+' texts')+' · '+(cloud?(sharedKeys.length===keys.length?'for every game':sharedKeys.length?'in '+gameName()+'’s draft and the shared texts':'in '+gameName()+'’s cloud draft'):id==='kit'?'in the shared catalog':'for '+gameName()))}}
 catch(error){if(target===id)notify(error.message)}
 finally{saving=false;if(target===id){mark();for(const b of report.querySelectorAll('[data-row-save],[data-row-cancel]'))b.disabled=false}$('#translates-tab').classList.toggle('workspace-dirty',[...drafts.values()].some(x=>Object.keys(x.edits||{}).length))}
}
function cancelAll(){const d=current();if(!d||saving)return;d.edits={};activeKey='';stopStateInspection();rows();apply();mark()}

async function load(){stopStateInspection();stopHistoryPreview();activeKey='';importReview=null;$('#translation-preview-view').value='';const id=++loadId;target=window.ComposerTarget?.value||$('#target').value||'kit';try{if(!drafts.has(target)||!Object.keys(drafts.get(target).edits||{}).length){const data=await request();if(id!==loadId)return;data.edits={};drafts.set(target,data)}render();apply()}catch(e){controls.innerHTML='<p>'+esc(e.message)+'</p>'}}
language.onchange=()=>{rows();try{localStorage.setItem('crash-language',language.value)}catch{}apply();if(typeof showcaseLink==='function')showcaseLink()};
frame.addEventListener('load',()=>{stopStateInspection();stopHistoryPreview();apply();try{frame.contentWindow.addEventListener('crash-i18n-ready',apply,{once:true})}catch{}});
window.addEventListener('composer-storage',()=>{drafts.clear();load()});window.addEventListener('composer-target',load);$('#target').addEventListener('change',()=>setTimeout(load,0));
window.addEventListener('beforeunload',e=>{if(importReview?.changes.length||[...drafts.values()].some(d=>Object.keys(d.edits||{}).length)){e.preventDefault();e.returnValue=''}});
let lastScope='';setInterval(()=>{if(!live()||!current())return;enforcePreviewWindow();const scope=target+':'+currentPreset();if(scope!==lastScope){lastScope=scope;category='all';if(activeKey&&!available().some(([key])=>key===activeKey)){activeKey='';stopStateInspection();apply()}render()}},400);
load();
})();
