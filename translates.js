(function(){
'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const language=$('#language'),controls=$('#translates-controls'),report=$('#translates-report'),frame=$('#frame'),drafts=new Map();let target='kit',query='',missing=false,loadId=0,area='ui',category='all',textType='text';
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
let saving=false,activeKey='',previousDevice=null,previousZoom=null,importReview=null;
const live=()=>$('#translates-tab').getAttribute('aria-pressed')==='true';
function previewData(d){const result=structuredClone(d);for(const [key,edit] of Object.entries(d.edits||{})){if(edit.custom)result.overrides[key]=texts(edit);else{delete result.overrides[key];Object.assign(result.catalog.entries[key],texts(edit))}}return result}
function apply(){bindPreviewDismiss();if(live())ensureHistoryPreview();const d=current();try{const api=frame.contentWindow.CrashI18n;if(api){if(d)api.setDraft(previewData(d));api.setLanguage(language.value);if(live())highlightText()}}catch{}}
const windowNames={autoSpin:'Auto Spin',candyPays:'Candy payouts',linePays:'Line pays',award:'Free games award',summary:'Free games summary',plinkoRows:'Rows',stake:'Bet amount',menu:'Settings',account:'Account',rules:'How to play',topbets:'Top bets',mybets:'My bets',betDetails:'My bet details',topBetDetails:'Top bet details',wins:'Live wins',win:'Win',difficulty:'Difficulty','limit:theme':'Atmosphere','limit:auto_steps':'Auto steps','limit:auto_cashout':'Auto cash out','notice:funds':'Notice · not enough funds','notice:offline':'Notice · no connection','notice:error':'Notice · something went wrong','notice:wallet':'Notice · top up balance'};
function highlightText(){
 const api=frame.contentWindow?.CrashI18n,entry=current()?.catalog.entries[activeKey];
 api?.highlight?.(activeKey);const info=api?.describe?.(activeKey);
 const ui=frame.contentWindow?.CrashUI?.instance,view=ui?.betDetail?(ui.modal==='topbets'?'topBetDetails':'betDetails'):ui?.modal||'';if([...$('#translation-preview-view').options].some(o=>o.value===view))$('#translation-preview-view').value=view;
 const onlyAttribute=entry?.usage?.length&&!entry.usage.includes('text')&&!entry.usage.includes('scene');
 $('#translation-preview-note').textContent=!entry?'Select a text to locate it in the preview.':entry.usage?.includes('unused')?entry.unusedReason:info?.visibleText?(stateInspection||frame.contentWindow.document.documentElement.hasAttribute('data-translation-preview')?'UI state preview · Betting actions are disabled.':'Highlighted text · Changes appear as you type.'):onlyAttribute||info?.visibleAttribute?'Label type: '+(info?.attributes?.join(', ')||entry.usage.join(', '))+'. No visible caption. '+(info?.visibleAttribute?'The associated control has a dashed outline.':'Its control is not present in this preview state.'):entry.group==='Scene'?'Scene text updates live when it appears in the game.':entry.previewWindow?'This text belongs to '+(windowNames[entry.previewWindow]||entry.previewWindow)+'. It may need round data or a different UI preset to appear.':'Text is not visible in this state. Choose a window or interact with the preview.';
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
 try{ui.close();update.call(ui,latest)}finally{ui.send=send}
}
function inspectAction(source,entry){
 stopStateInspection();if(ownPanel())return;const ui=frame.contentWindow?.CrashUI?.instance;if(!ui||typeof ui.update!=='function'||ui.multiBet)return;
 const active=['GO','CASH OUT','SELL FUEL','NEXT LANE','NEXT FRUIT'].includes(source),idle=['PLAY','SLICE'].includes(source);
 const notification=entry?.previewState==='notification',winTransfer=entry?.previewState==='win-transfer';
 const betPreview=['betDetails','topBetDetails'].includes(entry?.previewWindow);
 const historyLabel=source==='Round history';
 const emptyBets=source==='No bets yet.',winPreview=entry?.previewWindow==='win';
 if(!active&&!idle&&!notification&&!winTransfer&&!betPreview&&!emptyBets&&!winPreview&&!historyLabel)return;
 const inspection={ui,update:ui.update,send:ui.send,latest:historyPreview?.ui===ui?historyPreview.latest:ui.state};stateInspection=inspection;
 ui.send=()=>{};
 ui.update=function(state){
  inspection.latest=state;if(historyPreview?.ui===ui)historyPreview.latest=state;const preview=structuredClone(state),stepped=['road','boom','market_stack'].includes(state.game);
  Object.assign(preview,{win:false,auto:false,canBet:!active,canGo:true,canCash:active,showCash:active&&stepped,cash:Math.max(Number(state.cash)||0,Number(state.bet)||1),toast:''});
  if(historyLabel){preview.flags={...preview.flags,history:true};preview.history=state.history?.length?state.history:[{multiplier:1.13,cashed_out:true},{multiplier:2.04,cashed_out:true}] }
  if(emptyBets)preview.bets=[];
  if(winPreview){preview.winAmount=12.45;preview.win=true}
  if(notification)preview.toast=source;if(winTransfer){preview.win=true;preview.winAmount=preview.cash;preview.winSubtitle=source}
  if(betPreview){
   const lost=source==='Lost'||source==='Crashed',sample={name:'You',time:Date.now(),wager:3,payout:lost?0:4.5,multiplier:lost?0:1.5};
   if(state.game==='road')sample.details=[{label:'DIFFICULTY',value:'Medium'},{label:'LANES CROSSED',value:'3 / 20'},{label:'RESULT',value:lost?'Crashed':'Cashed out'}];
   preview.bets=[sample];preview.topBets=[{...sample,name:'Lucky Leo'}];
  }
  preview.settings={...preview.settings,sound:false,music:false,reduced_motion:true};
  preview.goTitle=active?(state.game==='road'?'GO':state.game==='boom'?'SLICE':state.game==='market_stack'?'PLACE':state.game==='fuel'?'SELL FUEL':'CASH OUT'):(state.game==='boom'?'SLICE':'PLAY');
  preview.goSubtitle=active&&stepped?(state.game==='road'?'NEXT LANE':'NEXT FRUIT'):'$'+Number(active?preview.cash:preview.bet).toFixed(2);
  return inspection.update.call(this,preview);
 };
 ui.close();ui.update(inspection.latest);
}
function syncSelection(){for(const row of report.querySelectorAll('[data-translation]')){const selected=row.dataset.translation===activeKey;row.classList.toggle('is-selected',selected);if(selected)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current')}}
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
const available=()=>Object.entries(current()?.catalog.entries||{}).filter(([,e])=>TranslationTable.applicable(e,target,currentPreset())).map(([key,e])=>[key,TranslationTable.context(e,target)]);
const areaOf=e=>e.group==='Scene'?'scene':'ui';
const windowGroup=e=>e.group==='Scene'?'Game scene':windowNames[e.previewWindow]||'Main screen';
const windowOrder=['Main screen',...Object.values(windowNames),'Game scene'];
const compareWindows=(a,b)=>windowOrder.indexOf(a)-windowOrder.indexOf(b);
// The panel moves around the texts (windows, type, where); the table edits them, every language
// side by side; the bar at the bottom of the panel saves or cancels every open edit at once.
function render(){const d=current();if(!d)return;
 controls.innerHTML='<section class="panel-sec"><h3>Windows</h3><nav id="translation-sections" class="panel-nav" aria-label="Translation windows"></nav></section>'
  +'<section class="panel-sec"><h3>Text type</h3><div id="translation-types" class="panel-seg" role="group" aria-label="Translation text types"></div></section>'
  +'<section class="panel-sec"><h3>Where</h3><div id="translation-areas" class="panel-seg" role="group" aria-label="Where the text is"></div></section>'
  +'<div class="panel-bar" id="panel-bar"><button type="button" class="panel-bar-go" id="translate-save-all">Save</button><button type="button" id="translate-cancel-all">Cancel</button><small role="status" id="translate-message"></small></div>';
 report.innerHTML='<div id="tx-import"></div><div class="translations-heading" id="tx-heading"></div>'
  +'<div class="tx-toolbar"><input id="translate-search" type="search" placeholder="Find a text or key" value="'+esc(query)+'" aria-label="Find a text">'
  +'<button type="button" class="tx-toggle" id="translate-missing" aria-pressed="'+missing+'">Only missing</button><span class="tx-progress" id="tx-progress"></span><span class="tx-grow"></span>'
  +'<button type="button" id="translate-export" title="Download every text of this game as CSV">Download CSV</button><button type="button" id="translate-import">Import CSV</button><input id="translate-file" type="file" accept=".csv,text/csv" hidden>'
  +'<button type="button" id="translate-reload" title="Read the saved texts again">Reload</button></div><div id="tx-table"></div>';
 $('#translate-search').oninput=e=>{query=e.target.value;rows()};
 $('#translate-missing').onclick=e=>{missing=!missing;e.currentTarget.setAttribute('aria-pressed',String(missing));rows()};
 $('#translate-reload').onclick=()=>{if(saving)return;if(Object.keys(current()?.edits||{}).length||importReview?.changes.length){notify('Save or cancel your open edits or CSV import before reloading.');return}drafts.delete(target);load()};
 $('#translate-import').disabled=!canEdit();$('#translate-export').onclick=exportTable;$('#translate-import').onclick=()=>$('#translate-file').click();$('#translate-file').onchange=e=>{importTable(e.target.files[0]);e.target.value=''};
 $('#translate-save-all').onclick=saveAll;$('#translate-cancel-all').onclick=cancelAll;
 navigation();syncPreviewWindows();rows();mark();
}
function mark(){
 $('#translates-tab').classList.toggle('workspace-dirty',[...drafts.values()].some(d=>Object.keys(d.edits||{}).length));
 const bar=$('#panel-bar');if(!bar)return;const n=Object.keys(current()?.edits||{}).length;
 bar.classList.toggle('dirty',!!n);$('#translate-save-all').disabled=!n||saving;$('#translate-cancel-all').disabled=!n||saving;
 $('#translate-save-all').textContent=saving?'Saving…':n?'Save '+n+(n===1?' text':' texts'):'Save';
 if(!bar.dataset.note)$('#translate-message').textContent=!canEdit()?'Read-only access · preview and export only':n?'Not saved yet · '+(target==='kit'?'the shared catalog':'saved to '+gameName())
  :'No unsaved changes';
}
const gameName=()=>window.ComposerTarget?.entry()?.title||'this game';
function notify(text){const m=$('#translate-message'),bar=$('#panel-bar');if(!m)return;m.textContent=text;if(bar){bar.dataset.note='1';clearTimeout(notify.timer);notify.timer=setTimeout(()=>{delete bar.dataset.note;mark()},4000)}}
function navigation(){
 const entries=available();
 $('#translation-areas').innerHTML=[['ui','Interface'],['scene','Game scene']].map(([id,title])=>'<button type="button" data-area="'+id+'" aria-pressed="'+(area===id)+'">'+title+' · '+entries.filter(([,e])=>areaOf(e)===id).length+'</button>').join('');
 const groups=[...new Set(entries.filter(([,e])=>areaOf(e)===area).map(([,e])=>windowGroup(e)))].sort(compareWindows);if(!groups.includes(category))category='all';
 const scoped=entries.filter(([,e])=>areaOf(e)===area);
 $('#translation-sections').innerHTML=[['all','All windows',scoped.length],...groups.map(g=>[g,g,scoped.filter(([,e])=>windowGroup(e)===g).length])].map(([id,label,count])=>'<button type="button" data-section="'+esc(id)+'" aria-pressed="'+(category===id)+'"><span>'+esc(label)+'</span><small><i class="tx-miss" hidden></i><b>'+count+'</b></small></button>').join('');
 for(const button of controls.querySelectorAll('[data-section]'))button.onclick=()=>{category=button.dataset.section;for(const link of controls.querySelectorAll('[data-section]'))link.setAttribute('aria-pressed',String(link.dataset.section===category));rows();report.scrollTop=0;
  activeKey='';syncSelection();stopStateInspection();
  if(category==='all'){apply();return}
  const kind=Object.entries(windowNames).find(([,label])=>label===category)?.[0]||'';
  inspectAction('',{previewWindow:kind});previewWindow(kind);
 };
 for(const b of controls.querySelectorAll('[data-area]'))b.onclick=()=>{area=b.dataset.area;category='all';textType=area==='scene'?'scene':'text';navigation();rows();report.scrollTop=0};
}
const typeNames={all:'All',text:'UI texts',accessibility:'Accessibility',tooltip:'Tooltips',placeholder:'Placeholders',scene:'Scene texts'};
function matchesType(entry,type){const usage=entry.usage||(entry.group==='Scene'?['scene']:['text']);return type==='all'||(type==='accessibility'?usage.some(x=>['aria-label','aria-labelledby','alt','caption'].includes(x)):type==='tooltip'?usage.includes('title'):usage.includes(type))}
function typeNavigation(){
 const scope=available().filter(([,e])=>areaOf(e)===area&&(category==='all'||windowGroup(e)===category));
 const types=area==='scene'?['all','scene']:['all','text','accessibility','tooltip','placeholder'];
 // A type with nothing in it is not offered at all.
 $('#translation-types').innerHTML=types.map(type=>{const count=scope.filter(([,e])=>matchesType(e,type)).length;return count||type===textType?'<button type="button" data-text-type="'+type+'" aria-pressed="'+(textType===type)+'">'+typeNames[type]+' · '+count+'</button>':''}).join('');
 for(const button of controls.querySelectorAll('[data-text-type]'))button.onclick=()=>{textType=button.dataset.textType;rows();report.scrollTop=0;controls.querySelector('[data-text-type="'+textType+'"]')?.focus({preventScroll:true})};
}
// What a text is and where it shows, in one quiet line; plain UI text says nothing.
function metaLine(e){
 const usage=e.usage||[];if(usage.includes('unused'))return 'Unused · '+(e.unusedReason||'not rendered');
 const attribute=usage.filter(x=>!['text','scene'].includes(x)),parts=[];
 if(attribute.length)parts.push((usage.includes('text')?'Text + accessibility':'Accessibility')+' · '+attribute.join(', '));
 if(e.presets)parts.push(e.presets.map(p=>p==='standard'?'Standard':p==='menu-drawer-v1'?'Menu tabs':'Tabs').join(', ')+' only');
 if(e.previewState)parts.push(e.previewState==='API difficulty'?'From the API':e.previewState==='ready'?'Before a round':e.previewState==='win-transfer'?'On a win':e.previewState==='notification'?'Notification':'During a round');
 return parts.join(' · ');
}
const valueOf=(d,key,e,lang)=>d.edits?.[key]?.[lang]??d.overrides[key]?.[lang]??e[lang]??'';
function rows(){const d=current();if(!d)return;typeNavigation();
 const lang=language.value,others=languages.filter(l=>l!=='en');
 const isMissing=(key,e)=>(lang==='en'?others:[lang]).some(l=>!valueOf(d,key,e,l));
 const inArea=available().filter(([,e])=>areaOf(e)===area&&matchesType(e,textType));
 const scoped=inArea.filter(([key,e])=>(!missing||isMissing(key,e))&&[key,e.source,...languages.map(l=>valueOf(d,key,e,l))].some(v=>String(v).toLowerCase().includes(query.toLowerCase())));
 for(const button of controls.querySelectorAll('[data-section]')){
  const mine=([,entry])=>button.dataset.section==='all'||windowGroup(entry)===button.dataset.section;
  button.querySelector('b').textContent=scoped.filter(mine).length;
  const gaps=inArea.filter(mine).filter(([key,e])=>isMissing(key,e)).length;
  const miss=button.querySelector('.tx-miss');miss.hidden=!gaps;miss.textContent=gaps;miss.title=gaps+' missing '+(language.value==='en'?'in a translation':'in '+labels[language.value]);
 }
 $('#tx-progress').innerHTML=others.map(l=>{const done=inArea.filter(([key,e])=>valueOf(d,key,e,l)).length,total=inArea.length;return '<span title="'+labels[l]+': '+done+' of '+total+' texts translated"><em>'+l.replace('ht','cr').toUpperCase()+'</em><b>'+done+'/'+total+'</b><i style="--p:'+(total?Math.round(done/total*100):0)+'%"></i></span>'}).join('');
 const entries=scoped.filter(([,e])=>category==='all'||windowGroup(e)===category);
 const groups=new Map();for(const row of entries){const group=windowGroup(row[1]);if(!groups.has(group))groups.set(group,[]);groups.get(group).push(row)}
 const title=category!=='all'?category:area==='scene'?'Scene texts':'UI texts',description=area==='scene'?'Hints, pop-ups and messages drawn inside the game scene.':'Texts used by this game’s '+(currentPreset()==='menu-drawer-v1'?'Menu tabs':currentPreset()==='tabbed-shell-v1'?'Tabs':'Standard')+' preset. Click a cell to edit it.';
 $('#tx-import').innerHTML=importMarkup();
 $('#tx-heading').innerHTML='<div><span class="translation-eyebrow">TEXTS / '+(area==='scene'?'SCENE':'INTERFACE')+'</span><h2>'+esc(title)+'</h2><p>'+description+'</p></div><span class="translation-total">'+entries.length+' texts</span>';
 const editable=canEdit()&&!importReview&&!saving;
 const head='<thead><tr>'+languages.map(l=>'<th scope="col" lang="'+l+'" class="'+(l===lang?'is-lang':'')+'">'+labels[l]+'</th>').join('')+'</tr></thead>';
 const body=[...groups].sort(([a],[b])=>compareWindows(a,b)).map(([group,list])=>(category==='all'?'<tr class="tx-group"><th colspan="3" scope="rowgroup">'+esc(group)+' <span>'+list.length+'</span></th></tr>':'')+list.map(([key,e])=>{
  const edit=d.edits?.[key],unused=e.usage?.includes('unused'),meta=metaLine(e);
  const scope=edit&&target!=='kit'?'<button type="button" class="tx-scope" data-scope="'+key+'" title="Where this edit is saved">'+(edit.custom?esc(gameName())+' only':'Every game')+'</button>':'';
  const format=e.format==='markdown'&&editable?'<div class="translation-format" data-format-for="'+key+'"><button type="button" data-format="heading">Heading</button><button type="button" data-format="bullet">• List</button><button type="button" data-format="number">1. List</button><button type="button" data-format="bold">Bold</button></div>':'';
  const about=(e.label&&e.label!==e.source?'<small>'+esc(e.label)+'</small>':'')+(meta?'<small>'+esc(meta)+'</small>':'')+scope+format+(edit?.error?'<small class="translation-error" role="alert">'+esc(edit.error)+'</small>':'');
  return '<tr class="translation-row'+(edit?' is-editing':'')+'" data-translation="'+key+'" tabindex="-1">'
   +languages.map(l=>{const v=valueOf(d,key,e,l),changed=edit&&edit[l]!==(d.overrides[key]?.[l]??e[l]??'');return '<td class="tx-cell'+(v?'':' missing')+(changed?' changed':'')+(l===lang?' is-lang':'')+'"><textarea rows="1" lang="'+l+'" data-key="'+key+'" data-lang="'+l+'" aria-label="'+esc(e.source)+' — '+labels[l]+'" placeholder="'+(l==='en'?'':'Missing · English shows')+'"'+(editable&&!unused?'':' readonly')+(e.format==='markdown'?' class="tx-long"':'')+'>'+esc(v)+'</textarea>'+(l==='en'?'<div class="tx-text">'+about+'</div>':'')+'</td>'}).join('')+'</tr>';
 }).join('')).join('');
 $('#tx-table').innerHTML=entries.length?'<div class="tx-table-wrap"><table class="tx-table">'+head+'<tbody>'+body+'</tbody></table></div>'
  :'<div class="translation-empty"><h3>'+(query||missing||textType!=='all'||category!=='all'?'No matching texts':'No scene texts for this game')+'</h3><p>'+(query||missing||textType!=='all'||category!=='all'?'Try another text type, window or search.':'This game uses the UI for its messages. Decorative text painted into artwork is not a text label.')+'</p></div>';
 syncSelection();mark();
 for(const row of report.querySelectorAll('tr[data-translation]'))row.onclick=event=>{if(event.target.closest('button,textarea'))return;focusText(row.dataset.translation,language.value)};
 for(const input of report.querySelectorAll('textarea[data-key]')){
  input.onfocus=()=>{lastField=input;focusText(input.dataset.key,input.dataset.lang)};
  input.oninput=()=>{
   const {key,lang:l}=input.dataset,e={...d.catalog.entries[key],...d.overrides[key]};
   d.edits??={};d.edits[key]??={...texts(e),custom:target!=='kit'};d.edits[key][l]=input.value;
   const original=d.overrides[key]?.[l]??d.catalog.entries[key][l]??'';
   input.parentElement.classList.toggle('changed',input.value!==original);input.parentElement.classList.toggle('missing',!input.value);
   const row=input.closest('tr');if(!row.classList.contains('is-editing')){row.classList.add('is-editing');if(target!=='kit'){const s=document.createElement('button');s.type='button';s.className='tx-scope';s.dataset.scope=key;s.textContent=gameName()+' only';s.title='Where this edit is saved';s.onclick=scopeClick;row.querySelector('.tx-text').prepend(s)}}
   activeKey=key;apply();mark();
  };
  input.onkeydown=e=>{if(e.key==='Escape'){input.blur()}else if(e.key==='Enter'&&!e.shiftKey&&!input.classList.contains('tx-long')){e.preventDefault();const cells=[...report.querySelectorAll('textarea[data-lang="'+input.dataset.lang+'"]')];cells[cells.indexOf(input)+1]?.focus()}};
 }
 for(const button of report.querySelectorAll('[data-scope]'))button.onclick=scopeClick;
 for(const button of report.querySelectorAll('[data-format]'))button.onmousedown=e=>e.preventDefault();
 for(const button of report.querySelectorAll('[data-format]'))button.onclick=()=>{const key=button.closest('[data-format-for]').dataset.formatFor,field=lastField?.dataset.key===key?lastField:report.querySelector('textarea[data-key="'+key+'"][data-lang="'+language.value+'"]');if(!field||field.readOnly)return;const start=field.selectionStart,end=field.selectionEnd,selected=field.value.slice(start,end),kind=button.dataset.format;const value=kind==='bold'?'**'+(selected||'text')+'**':(start&&field.value[start-1]!=='\n'?'\n':'')+(kind==='heading'?'## ':kind==='number'?'1. ':'- ')+(selected||'text');field.setRangeText(value,start,end,'select');field.dispatchEvent(new Event('input'));field.focus()};
 if($('#translate-import-cancel'))$('#translate-import-cancel').onclick=()=>{importReview=null;rows()};if($('#translate-import-save'))$('#translate-import-save').onclick=saveImport;
}
let lastField=null;
function scopeClick(event){const d=current(),key=event.currentTarget.dataset.scope,edit=d.edits?.[key];if(!edit)return;edit.custom=!edit.custom;event.currentTarget.textContent=edit.custom?gameName()+' only':'Every game';apply()}
async function saveAll(){
 const id=target,d=current(),keys=Object.keys(d?.edits||{});if(saving||!keys.length)return;
 saving=true;mark();
 const overrides=structuredClone(d.overrides),entries={};
 for(const key of keys){const edit=d.edits[key];if(edit.custom)overrides[key]=texts(edit);else{delete overrides[key];entries[key]=texts(edit)}}
 try{const data=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:d.revision,entries,overrides})},id);data.edits={};drafts.set(id,data);if(target===id){apply();saving=false;rows();notify((window.ComposerCloud?.enabled?'Saved to the cloud draft · ':'Saved · ')+keys.length+(keys.length===1?' text':' texts'))}}
 catch(error){if(target===id)notify(error.message)}
 finally{saving=false;if(target===id)mark();$('#translates-tab').classList.toggle('workspace-dirty',[...drafts.values()].some(x=>Object.keys(x.edits||{}).length))}
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
