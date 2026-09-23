/* Shared EN/FR/HT localization. Source text remains the round-state contract. */
(function(){
'use strict';
const base=new URL('.',document.currentScript.src), originals=new WeakMap(), listeners=new Set();
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
// Limited Markdown: escape all HTML before adding supported formatting.
function markdown(value){
 const safe=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const inline=s=>safe(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
 const out=[];let paragraph=[],list='';
 const flush=()=>{if(paragraph.length){out.push('<p>'+inline(paragraph.join(' '))+'</p>');paragraph=[]}if(list){out.push('</'+list+'>');list=''}};
 for(const line of String(value).split(/\r?\n/)){
  const heading=line.match(/^(#{1,3})\s+(.+)$/),bullet=line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
  if(!line.trim()){flush();continue}
  if(heading){flush();const level=heading[1].length+1;out.push('<h'+level+' style="font-size:'+({2:'1.35em',3:'1.15em',4:'1em'}[level])+';font-weight:700;text-align:left;color:inherit;margin:1em 0 .5em;line-height:1.3">'+inline(heading[2])+'</h'+level+'>');continue}
  if(bullet){const type=/^\s*\d/.test(line)?'ol':'ul';if(list!==type){flush();list=type;out.push('<'+type+'>')}out.push('<li>'+inline(bullet[1])+'</li>');continue}
  if(list)flush();paragraph.push(line);
 }
 flush();return out.join('');
}
function translateDocuments(){
 if(window.CrashUI?.instance?.modal!=='rules')return;
 const pair=Object.entries(catalog.entries).find(([,e])=>e.format==='markdown'&&e.previewWindow==='rules'&&e.games?.includes(game));
 const body=document.querySelector('.modal-body');if(!pair||!body)return;
 const [key,entry]=pair;let block=body.querySelector('[data-i18n-document]');
 if(!block){const back=body.querySelector('.back-button');body.replaceChildren();if(back)body.append(back);block=document.createElement('div');block.dataset.i18nDocument=key;block.dataset.noTranslate='';block.className='translated-document';body.append(block)}
 const html=markdown(overrides[key]?.[locale]||entry[locale]||entry.en||entry.source);
 if(block.innerHTML!==html)block.innerHTML=html;
}

function locate(key){
 const block=document.querySelector('[data-i18n-document="'+key+'"]');if(block&&block.getClientRects().length)return [{kind:'text',rects:[block.getBoundingClientRect()]}];
 const source=catalog.entries[key]?.source;if(!source||!document.body)return [];
 const pattern=source.includes('{')?new RegExp('^'+source.split(/(\{\w+\})/).map(part=>/^\{/.test(part)?'.+?':escape(part)).join('')+'$'):null;
 const matches=value=>value!=null&&(value.trim()===source||pattern?.test(value.trim()));
 const found=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
 const visible=el=>{if(!el||el.closest('[data-no-translate]'))return false;for(let parent=el;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if(style.visibility==='hidden'||style.display==='none'||style.opacity==='0'||style.clipPath==='inset(50%)')return false}return true};
 const onScreen=rect=>rect.width&&rect.height&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth;
 while((node=walker.nextNode())){if(!matches(originals.get(node)?.text?.source)||!visible(node.parentElement))continue;const range=document.createRange();range.selectNodeContents(node);found.push({kind:'text',rects:[...range.getClientRects()].filter(onScreen)})}
 for(const el of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')){
  if(!visible(el))continue;for(const attr of ['aria-label','title','placeholder','alt'])if(matches(originals.get(el)?.[attr]?.source??el.getAttribute(attr)))found.push({kind:attr,rects:[...el.getClientRects()].filter(onScreen)});
 }
 for(const el of document.querySelectorAll('[aria-labelledby]')){
  if(!visible(el))continue;
  const ids=el.getAttribute('aria-labelledby').split(/\s+/);
  if(ids.some(id=>{const label=document.getElementById(id);if(!label)return false;return [...label.childNodes].some(node=>matches(originals.get(node)?.text?.source??node.nodeValue))}))found.push({kind:'aria-labelledby',rects:[...el.getClientRects()].filter(onScreen)});
 }
 return found;
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
 defs.append(mask);svg.append(defs,svgNode('rect',{width:'100%',height:'100%',fill:'rgba(0,0,0,.68)',mask:'url(#translation-spotlight-mask)'}));Object.assign(svg.style,{position:'absolute',inset:'0',pointerEvents:'none'});highlightLayer.prepend(svg);
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
const api={t,markdown,highlight,describe,setLanguage,setDraft,setGame,translate,get locale(){return locale},get revision(){return revision},get catalog(){return catalog},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},number(value,options={}){return new Intl.NumberFormat(locale==='fr'?'fr-FR':'en-US',options).format(value)}};
window.CrashI18n=api;
// Any embedding site can select a supported language, but only our immediate
// parent may do so. Editable dictionaries remain restricted to same-origin Composer.
window.addEventListener('message',e=>{
 if(e.source!==parent)return;
 if(e.data?.type==='crash-language'&&['en','fr','ht'].includes(e.data.locale)){setLanguage(e.data.locale);e.source.postMessage({type:'crash-language-changed',locale},e.origin==='null'?'*':e.origin)}
 if(e.origin===location.origin&&e.data?.type==='crash-translations')setDraft(e.data);
});
function start(){observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;translate()})}});translate();window.dispatchEvent(new Event('crash-i18n-ready'));if(window.parent!==window)window.parent.postMessage({type:'crash-language-ready',locale},'*')}
fetch(new URL('locales/catalog.json',base)).then(r=>{if(!r.ok)throw Error('Translation catalog unavailable');return r.json()}).then(data=>{if(!draftActive){catalog=data;rebuild();changed()}}).catch(error=>console.warn(error.message));
if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
