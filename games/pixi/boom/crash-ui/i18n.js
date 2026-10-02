/* Shared EN/FR/HT localization. Source text remains the round-state contract. */
(function(){
'use strict';
const base=new URL('.',document.currentScript.src), version=new URL(document.currentScript.src).search, originals=new WeakMap(), listeners=new Set();
let locale='en',catalog={entries:{}},overrides={},game='',revision=0,observer,scheduled=false,draftActive=false,index=new Map(),patterns=[];
try{locale=new URLSearchParams(location.search).get('lang')||localStorage.getItem('crash-language')||'en'}catch{}
if(!['en','fr','ht'].includes(locale))locale='en';
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function rebuild(){index=new Map();patterns=[];for(const [key,entry] of Object.entries(catalog.entries)){
 if(game&&entry.games?.length&&!entry.games.includes(game))continue;
 const item={...entry,...overrides[key]};index.set(entry.source,item);
 if(entry.source.includes('{')){const keys=[];const expression=entry.source.split(/(\{\w+\})/).map(part=>/^\{/.test(part)?(keys.push(part.slice(1,-1)),'(.+?)'):escape(part)).join('');patterns.push({item,keys,re:new RegExp('^'+expression+'$')})}
}}
function t(source,values={}){
 source=String(source??'');const trimmed=source.trim();let entry=catalog.entries[source]?{...catalog.entries[source],...overrides[source]}:index.get(trimmed),params=values;
 if(!entry)for(const pattern of patterns){const m=trimmed.match(pattern.re);if(m){entry=pattern.item;params={...values,...Object.fromEntries(pattern.keys.map((k,i)=>[k,m[i+1]]))};break}}
 if(!entry){if(locale==='fr'&&/^\$[\d,]+\.\d{2}$/.test(trimmed))return api.number(Number(trimmed.slice(1).replaceAll(',','')),{minimumFractionDigits:2,maximumFractionDigits:2})+' $';return source;}
 const value=entry[locale]||entry.en||entry.source;
 return source.slice(0,source.indexOf(trimmed))+value.replace(/\{(\w+)\}/g,(m,k)=>params[k]??m)+source.slice(source.indexOf(trimmed)+trimmed.length);
}
function updateValue(node,key,value,set){const record=originals.get(node)||{};const old=record[key];const source=old&&value===old.output?old.source:value;const output=t(source);record[key]={source,output};originals.set(node,record);if(output!==value)set(output)}
let highlightKey='',highlightLayer=null;
// Limited Markdown: escape all HTML before adding supported formatting. A rules document takes
// a little more, all of it plain text so a value never holds HTML:
//  inline   **bold**  *italic*  ++underline++  ~~strike~~  [text](https://…) a link,
//           [text](color:brand|green|red|blue|grey) a colour from the brand's own roles;
//  blocks   # title  ## heading  ### subheading  -# small print, - list, 1. list,
//           - [x] / - [ ] a ✓ / ✕ list, and a leading [center] or [right] to align a block;
//  lines    ![alt](url) a picture (only from Composer's media bucket), [[name]] a game block.
// In a document every element carries data-no-translate, so its words are not translated
// twice, while a block's content is the game's own text and is translated like any other.
const MEDIA=/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/composer-media\/[A-Za-z0-9._\/-]+$/;
const DOC_COLOURS={brand:'var(--action-go)',green:'var(--success)',red:'var(--danger)',blue:'var(--pill-cyan)',grey:'var(--text-muted)'};
function markdown(value,{document=false}={}){
 const safe=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const inline=s=>{let out=safe(s);
  if(document)out=out.replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+|color:[a-z]+)\)/g,(m,text,target)=>target.startsWith('color:')?(DOC_COLOURS[target.slice(6)]?'<span style="color:'+DOC_COLOURS[target.slice(6)]+'">'+text+'</span>':text):'<a href="'+target+'" target="_blank" rel="noopener noreferrer">'+text+'</a>')
   .replace(/\+\+([^+]+)\+\+/g,'<u>$1</u>').replace(/~~([^~]+)~~/g,'<s>$1</s>');
  return out.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>')};
 const own=document?' data-no-translate':'';
 const out=[];let paragraph=[],list='',listAlign='',paraAlign='';
 const style=align=>align?' style="text-align:'+align+'"':'';
 const flush=()=>{if(paragraph.length){out.push('<p'+own+style(paraAlign)+'>'+inline(paragraph.join(' '))+'</p>');paragraph=[]}if(list){out.push('</'+(list==='check'?'ul':list)+'>');list=''}};
 for(let line of String(value).split(/\r?\n/)){
  let align='';const aligned=document&&line.match(/^\s*\[(center|right)\]\s+(.*)$/);if(aligned){align=aligned[1];line=aligned[2]}
  const heading=line.match(/^(#{1,3})\s+(.+)$/),small=document&&line.match(/^-#\s+(.+)$/),check=document&&line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/),bullet=line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
  const image=document&&line.match(/^\s*!\[([^\]]*)\]\((\S+)\)\s*$/),block=document&&line.match(/^\s*\[\[([a-z][a-z0-9_-]*)\]\]\s*$/);
  if(!line.trim()){flush();continue}
  if(image){flush();if(MEDIA.test(image[2]))out.push('<figure class="rules-figure"'+own+'><img src="'+safe(image[2])+'" alt="'+safe(image[1])+'" loading="lazy" decoding="async"></figure>');continue}
  if(block){flush();out.push('<div class="rules-block" data-rules-block="'+block[1]+'"></div>');continue}
  if(heading){flush();const level=heading[1].length+1;out.push('<h'+level+own+' style="font-size:'+({2:'1.35em',3:'1.15em',4:'1em'}[level])+';font-weight:700;text-align:'+(align||'left')+';color:inherit;margin:1em 0 .5em;line-height:1.3">'+inline(heading[2])+'</h'+level+'>');continue}
  if(small){flush();out.push('<p class="rules-small"'+own+style(align)+'>'+inline(small[1])+'</p>');continue}
  if(check){if(list!=='check'){flush();list='check';out.push('<ul class="rules-check"'+own+style(align)+'>')}const yes=check[1]!==' ';out.push('<li class="'+(yes?'is-yes':'is-no')+'"><span class="rules-mark" aria-hidden="true">'+(yes?'✓':'✕')+'</span>'+inline(check[2])+'</li>');continue}
  if(bullet){const type=/^\s*\d/.test(line)?'ol':'ul';if(list!==type){flush();list=type;out.push('<'+type+own+style(align)+'>')}out.push('<li>'+inline(bullet[1])+'</li>');continue}
  if(list)flush();if(!paragraph.length)paraAlign=align;paragraph.push(line);
 }
 flush();return out.join('');
}
// The game's rules document, if it has one: the catalog entry Composer edits as How to play.
const rulesDocument=(id=game)=>Object.entries(catalog.entries).find(([,e])=>e.format==='markdown'&&e.previewWindow==='rules'&&e.games?.includes(id))?.[0]||'';
function translateDocuments(){
 if(window.CrashUI?.instance?.modal!=='rules')return;
 const key=rulesDocument(),entry=catalog.entries[key];
 const body=document.querySelector('.modal-body');if(!key||!body)return;
 let block=body.querySelector('[data-i18n-document]');
 if(!block){const back=body.querySelector('.back-button');body.replaceChildren();if(back)body.append(back);block=document.createElement('div');block.dataset.i18nDocument=key;block.className='translated-document';body.append(block)}
 // Compared with what was last drawn, not with the page: the blocks inside change as they are translated.
 const html=markdown(overrides[key]?.[locale]||entry[locale]||entry.en||entry.source,{document:true});
 // A redraw (another language, an edit) keeps the game's blocks as they are, so a pay table's
 // switch or amount survives it; only the document's own words are drawn again.
 if(block.rulesSource!==html){const kept=new Map([...block.querySelectorAll('[data-rules-block]')].map(slot=>[slot.dataset.rulesBlock,slot]));block.innerHTML=html;block.rulesSource=html;for(const slot of block.querySelectorAll('[data-rules-block]')){const old=kept.get(slot.dataset.rulesBlock);if(old){slot.replaceWith(old);kept.delete(slot.dataset.rulesBlock)}}}
 const blocks=window.CrashUI?.instance?.config?.rulesBlocks||{};
 for(const slot of block.querySelectorAll('[data-rules-block]')){const make=blocks[slot.dataset.rulesBlock];const content=typeof make==='function'?String(make()??''):String(make??'');if(slot.rulesSource!==content){slot.innerHTML=content;slot.rulesSource=content}}
}

function locate(key){
 const block=document.querySelector('[data-i18n-document="'+key+'"]');if(block&&block.getClientRects().length)return [{kind:'text',rects:[block.getBoundingClientRect()]}];
 const source=catalog.entries[key]?.source;if(!source||!document.body)return [];
 const pattern=source.includes('{')?new RegExp('^'+source.split(/(\{\w+\})/).map(part=>/^\{/.test(part)?'.+?':escape(part)).join('')+'$'):null;
 const matches=value=>value!=null&&(value.trim()===source||pattern?.test(value.trim()));
 const found=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
 const visible=el=>{if(!el||el.closest('[data-no-translate]'))return false;for(let parent=el;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if(style.visibility==='hidden'||style.display==='none'||style.opacity==='0'||style.clipPath==='inset(50%)'||(['hidden','clip'].includes(style.overflow)&&(parent.clientWidth===0||parent.clientHeight===0)))return false}return true};
 const onScreen=rect=>rect.width&&rect.height&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth;
 while((node=walker.nextNode())){if(!matches(originals.get(node)?.text?.source)||!visible(node.parentElement))continue;const range=document.createRange();range.selectNodeContents(node);found.push({kind:'text',rects:[...range.getClientRects()].filter(onScreen)})}
 for(const el of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')){
  if(!visible(el))continue;for(const attr of ['aria-label','title','placeholder','alt'])if(matches(originals.get(el)?.[attr]?.source??el.getAttribute(attr)))found.push({kind:attr,rects:[...el.getClientRects()].filter(onScreen)});
 }
 // A visually hidden caption names its table; outline that table, not clipped text.
 for(const caption of document.querySelectorAll('caption')){
  const table=caption.closest('table');if(!visible(table))continue;
  if([...caption.childNodes].some(node=>matches(originals.get(node)?.text?.source??node.nodeValue)))found.push({kind:'caption',rects:[...table.getClientRects()].filter(onScreen)});
 }
 for(const el of document.querySelectorAll('[aria-labelledby]')){
  if(!visible(el))continue;
  const ids=el.getAttribute('aria-labelledby').split(/\s+/);
  if(ids.some(id=>{const label=document.getElementById(id);if(!label)return false;return [...label.childNodes].some(node=>matches(originals.get(node)?.text?.source??node.nodeValue))}))found.push({kind:'aria-labelledby',rects:[...el.getClientRects()].filter(onScreen)});
 }
 return found;
}
function reveal(key){
 translate();const source=catalog.entries[key]?.source;if(!source)return false;
 const pattern=new RegExp('^'+source.split(/(\{\w+\})/).map(part=>/^\{/.test(part)?'.+?':escape(part)).join('')+'$');
 const matches=value=>value!=null&&pattern.test(value.trim());
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode()))if(matches(originals.get(node)?.text?.source)&&node.parentElement?.getClientRects().length){node.parentElement.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});return true}
 for(const el of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]'))if(el.getClientRects().length&&['aria-label','title','placeholder','alt'].some(attr=>matches(originals.get(el)?.[attr]?.source??el.getAttribute(attr)))){el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});return true}
 return false;
}
function describe(key){const found=locate(key);return {visibleText:found.some(x=>x.kind==='text'&&x.rects.length),attributes:[...new Set(found.filter(x=>x.kind!=='text').map(x=>x.kind))],visibleAttribute:found.some(x=>x.kind!=='text'&&x.rects.length)}}
function paintHighlight(){
 highlightLayer?.remove();highlightLayer=null;if(!highlightKey)return;
 const found=locate(highlightKey),text=found.filter(x=>x.kind==='text'&&x.rects.length),items=text.length?text:found.filter(x=>x.rects.length);
 if(!items.length)return;highlightLayer=document.createElement('div');highlightLayer.dataset.noTranslate='';highlightLayer.id='translation-highlight';
 Object.assign(highlightLayer.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'2147483647'});
 highlightLayer.setAttribute('aria-hidden','true');
 // A single mask keeps every matching label bright, including wrapped text.
 const svgNode=(tag,attrs)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el};
 const svg=svgNode('svg',{width:'100%',height:'100%'}),defs=svgNode('defs',{}),mask=svgNode('mask',{id:'translation-spotlight-mask',maskUnits:'userSpaceOnUse',x:0,y:0,width:innerWidth,height:innerHeight});
 mask.append(svgNode('rect',{width:innerWidth,height:innerHeight,fill:'white'}));
 for(const item of items)for(const rect of item.rects){
  const x=rect.left-6,y=rect.top-5,width=rect.width+12,height=rect.height+10;
  mask.append(svgNode('rect',{x,y,width,height,rx:6,fill:'black'}));
  const box=document.createElement('div');Object.assign(box.style,{position:'absolute',boxSizing:'border-box',left:x+'px',top:y+'px',width:width+'px',height:height+'px',border:'3px '+(item.kind==='text'?'solid':'dashed')+' #6cccff',borderRadius:'6px',boxShadow:'0 0 0 1px #07131d, 0 0 16px rgba(108,204,255,.75)',pointerEvents:'none'});highlightLayer.append(box);
 }
 defs.append(mask);svg.append(defs,svgNode('rect',{width:'100%',height:'100%',fill:'rgba(0,0,0,.40)',mask:'url(#translation-spotlight-mask)'}));Object.assign(svg.style,{position:'absolute',inset:'0',pointerEvents:'none'});highlightLayer.prepend(svg);
 document.body.append(highlightLayer);
}
function highlight(key){highlightKey=key||'';translate();return !!highlightLayer}
let highlightPending=false;function refreshHighlight(){if(!highlightKey||highlightPending)return;highlightPending=true;requestAnimationFrame(()=>{highlightPending=false;translate()})}
window.addEventListener('scroll',refreshHighlight,true);window.addEventListener('resize',refreshHighlight);
function translate(root=document.body){if(!root)return;observer?.disconnect();
 translateDocuments();
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){if(node.parentElement?.closest('script,style,textarea,[data-no-translate]'))continue;updateValue(node,'text',node.nodeValue,v=>node.nodeValue=v)}
 for(const el of root.querySelectorAll('time[datetime]')){const date=new Date(el.dateTime);if(!Number.isFinite(date.getTime()))continue;const options=el.hasAttribute('data-date-only')?{weekday:'short',day:'numeric',month:'short',year:'numeric'}:el.closest('.bet-detail-date')?{weekday:'long',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'}:{hour:'numeric',minute:'2-digit'};const value=new Intl.DateTimeFormat(locale==='fr'?'fr-FR':el.closest('.bet-detail-date')||el.hasAttribute('data-date-only')?'en-GB':'en-US',options).format(date);if(el.textContent!==value)el.textContent=value}
 for(const el of root.querySelectorAll('[aria-label],[title],[placeholder],[alt]'))for(const attr of ['aria-label','title','placeholder','alt'])if(el.hasAttribute(attr))updateValue(el,attr,el.getAttribute(attr),v=>el.setAttribute(attr,v));
 paintHighlight();
 observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder','alt']});
}
function changed(){revision++;document.documentElement.lang=locale;translate();for(const fn of listeners)fn();window.dispatchEvent(new CustomEvent('crash-language',{detail:{locale,revision}}))}
function setLanguage(value){locale=['en','fr','ht'].includes(value)?value:'en';try{localStorage.setItem('crash-language',locale)}catch{}changed()}
function setDraft(data){draftActive=true;catalog=data.catalog||catalog;overrides=data.overrides||{};rebuild();changed()}
async function setGame(id){if(!id||id===game)return;game=id;rebuild();changed();if(/(?:^|\/)(?:demo|game)\.html$/.test(location.pathname))return;const current=id;try{const r=await fetch(new URL('../locales/overrides.json',base));if(r.ok&&current===game&&!draftActive){overrides=(await r.json()).entries||{};rebuild();changed()}}catch{}}
const api={t,markdown,rulesDocument,highlight,describe,reveal,setLanguage,setDraft,setGame,translate,get locale(){return locale},get revision(){return revision},get catalog(){return catalog},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},number(value,options={}){return new Intl.NumberFormat(locale==='fr'?'fr-FR':'en-US',options).format(value)}};
window.CrashI18n=api;
// Any embedding site can select a supported language, but only our immediate
// parent may do so. Editable dictionaries remain restricted to same-origin Composer.
window.addEventListener('message',e=>{
 if(e.source!==parent)return;
 if(e.data?.type==='crash-language'&&['en','fr','ht'].includes(e.data.locale)){setLanguage(e.data.locale);e.source.postMessage({type:'crash-language-changed',locale},e.origin==='null'?'*':e.origin)}
 if(e.origin===location.origin&&e.data?.type==='crash-translations')setDraft(e.data);
});
function start(){observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;translate()})}});translate();window.dispatchEvent(new Event('crash-i18n-ready'));if(window.parent!==window)window.parent.postMessage({type:'crash-language-ready',locale},'*')}
fetch(new URL('locales/catalog.json'+version,base)).then(r=>{if(!r.ok)throw Error('Translation catalog unavailable');return r.json()}).then(data=>{if(!draftActive){catalog=data;rebuild();changed()}}).catch(error=>console.warn(error.message));
if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
