// Public embeds use stable game URLs; each deployment redirects to versioned assets.
(()=>{
'use strict';
const $=s=>document.querySelector(s),button=$('#share-game'),root='https://svyatoslavteslyak.github.io/crash-showcase/';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dialog=document.createElement('dialog');dialog.className='share-dialog';dialog.setAttribute('aria-labelledby','share-title');
dialog.innerHTML=`<header><div><small>PUBLISHED GAME</small><h2 id="share-title">Embed game</h2></div><button class="wb-button" type="button" data-close aria-label="Close share window">✕</button></header>
<p id="share-description">Embed the game on your website, without Composer controls.</p><p class="share-note">Shares the published game, not your current draft. Changes appear here only after publication.</p>
<p id="share-release" class="share-note"></p><div class="share-choice"><span id="share-language-label">Language</span><div id="share-language" class="look-row" role="group" aria-labelledby="share-language-label"></div></div>
<div class="share-choice"><span id="share-brand-label">Brand</span><div id="share-brand" class="look-row" role="group" aria-labelledby="share-brand-label"></div></div><div class="share-choice"><span id="share-theme-label">Theme</span><div id="share-theme" class="look-row" role="group" aria-labelledby="share-theme-label"></div></div>
<div data-share-iframe><label>Game link<input id="share-url" readonly></label><div class="share-actions"><button type="button" class="wb-button" data-copy="url">Copy link</button><a class="wb-button" id="share-open" target="_blank" rel="noopener">Open game ↗</a></div></div>
<div id="share-player"><label>Lotomobil account link<input id="share-player-url" readonly></label><button type="button" class="wb-button" data-copy="player-url">Copy login link</button><small id="share-player-note"></small></div>
<div data-share-iframe><label>Iframe code<textarea id="share-code" rows="7" readonly spellcheck="false"></textarea></label><small>Fills its container. The example uses 85% of the viewport height; adjust the container height in your site’s CSS.</small>
<details><summary>Switch language from your website</summary><p>Send a message without reloading the game. The downloaded example includes an EN / FR / CR switch.</p><textarea id="share-language-code" rows="6" readonly spellcheck="false"></textarea></details>
<footer><button class="wb-button" type="button" data-copy="code">Copy iframe</button><button class="wb-button" type="button" id="share-download">Download HTML example</button></footer></div><p id="share-status" role="status" aria-live="polite"></p>`;
document.body.append(dialog);let game,title,shareMode='iframe';
const menu=document.createElement('div');menu.id='share-menu';menu.className='share-menu';menu.hidden=true;
menu.innerHTML='<button type="button" class="wb-button" data-share-mode="iframe">Share iframe</button><button type="button" class="wb-button" data-share-mode="api">Share game with API</button>';
document.body.append(menu);button.setAttribute('aria-controls',menu.id);button.setAttribute('aria-expanded','false');
button.insertAdjacentHTML('beforeend',' <span aria-hidden="true">▾</span>');
function closeMenu(focus=false){menu.hidden=true;button.setAttribute('aria-expanded','false');if(focus)button.focus()}
function positionMenu(){const r=button.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.left,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(r.bottom+6,innerHeight-menu.offsetHeight-8))+'px'}
button.onclick=()=>{if(!menu.hidden){closeMenu();return}menu.hidden=false;button.setAttribute('aria-expanded','true');positionMenu()};
menu.onclick=event=>{const item=event.target.closest('[data-share-mode]');if(!item)return;closeMenu();openShare(item.dataset.shareMode)};
document.addEventListener('click',event=>{if(!menu.contains(event.target)&&!button.contains(event.target))closeMenu()});
document.addEventListener('keydown',event=>{if(menu.hidden)return;const items=[...menu.querySelectorAll('button')].filter(b=>!b.hidden);if(event.key==='Escape'){event.preventDefault();closeMenu(true)}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();let i=items.indexOf(document.activeElement);i=event.key==='Home'?0:event.key==='End'?items.length-1:(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[i].focus()}});
document.addEventListener('focusin',event=>{if(!menu.hidden&&!menu.contains(event.target)&&event.target!==button)closeMenu()});
button.addEventListener('keydown',event=>{if(menu.hidden&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();button.click();const items=[...menu.querySelectorAll('button')].filter(b=>!b.hidden);items[event.key==='ArrowUp'?items.length-1:0].focus()}});
window.addEventListener('resize',()=>closeMenu());window.addEventListener('scroll',()=>closeMenu(),true);
dialog.addEventListener('close',()=>button.focus());
const sync=()=>{closeMenu();menu.querySelector('[data-share-mode=api]').hidden=window.ComposerTarget?.value!=='road';const playable=!!window.ComposerTarget?.entry()?.live;button.disabled=!playable;button.title=playable?'Share a public game link or iframe':'Select a game to share'};
let brands=window.CrashTokens?.BRANDS||{default:'Lotomobil'},themes=window.CrashTokens?.THEMES||{};
let brandSwatches={},themeSwatches={};
const selection={language:'en',brand:'default',theme:''};
const languages={en:'EN · English',fr:'FR · Français',ht:'CR · Kreyòl'};
function swatch(key,value){
 const color=key==='brand'?brandSwatches[value]:key==='theme'&&value?(themeSwatches[selection.brand]?.[value]||brandSwatches[selection.brand]):null;
 return typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color)?'<i class="swatch" aria-hidden="true" style="background:'+color+'"></i>':'';
}
function chips(key,items){
 $('#share-'+key).innerHTML=Object.entries(items).map(([value,label])=>'<button type="button" class="wb-button" data-choice="'+key+'" data-value="'+escape(value)+'" aria-pressed="'+(selection[key]===value)+'">'+swatch(key,value)+escape(label)+'</button>').join('');
}
function fillThemes(selected=''){
 const available=themes[selection.brand]||{};
 selection.theme=Object.hasOwn(available,selected)?selected:'';
 chips('theme',{'':'No season',...available});
}
function render(){
 const url=new URL('games/'+encodeURIComponent(game)+'/index.html',root);url.searchParams.set('lang',selection.language);url.searchParams.set('brand',selection.brand);url.searchParams.set('theme',selection.theme);
 const playerConfig=window.LotomobilPlayerConfig,playerReady=!!(playerConfig?.authBaseUrl&&playerConfig?.apiBaseUrl);
 $('#share-player').hidden=shareMode!=='api';dialog.querySelectorAll('[data-share-iframe]').forEach(n=>n.hidden=shareMode==='api');const playerUrl=new URL('player.html',window.ComposerCloudConfig.workspaceUrl);playerUrl.search=url.search;playerUrl.searchParams.set('game',game);
 $('#share-player-url').value=playerReady?playerUrl.href:'';dialog.querySelector('[data-copy=player-url]').disabled=!playerReady;$('#share-player-note').textContent=playerReady?'Login with a Lotomobil account to play through the API (QA).':'Lotomobil login is not configured yet.';
 $('#share-url').value=url.href;$('#share-open').href=url.href;
 $('#share-code').value='<div style="width:100%;height:85vh;height:85dvh">\n  <iframe\n    id="crash-game"\n    src="'+escape(url.href)+'"\n    title="'+escape(title)+'"\n    style="display:block;width:100%;height:100%;border:0"\n    allow="autoplay; fullscreen" allowfullscreen\n    loading="lazy"\n  ></iframe>\n</div>';
 $('#share-language-code').value="document.querySelector('#crash-game').contentWindow.postMessage(\n  { type: 'crash-language', locale: 'fr' },\n  'https://svyatoslavteslyak.github.io'\n);";
 $('#share-status').textContent='';
}
async function openShare(mode){if(!window.ComposerTarget?.entry()?.live||mode==='api'&&window.ComposerTarget.value!=='road')return;shareMode=mode;game=window.ComposerTarget.value;const requestedGame=game;title=window.ComposerTarget.entry().title;brands=window.CrashTokens.BRANDS;themes=window.CrashTokens.THEMES;brandSwatches=window.CrashTokens.BRAND_SWATCHES||{};themeSwatches=window.CrashTokens.THEME_SWATCHES||{};try{const response=await fetch('games/pixi/'+encodeURIComponent(game)+'/embed-look.json',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(response.ok){const catalog=await response.json();brands=catalog.brands;themes=catalog.themes;brandSwatches=catalog.brand_swatches||brandSwatches;themeSwatches=catalog.theme_swatches||themeSwatches}}catch{}$('#share-title').textContent=shareMode==='api'?'Share '+title+' with API':'Share '+title+' iframe';$('#share-description').textContent=shareMode==='api'?'Players log in with their Lotomobil account, then open the game.':'Embed the game on your website, without Composer controls.';selection.language=Object.hasOwn(languages,$('#language').value)?$('#language').value:'en';chips('language',languages);const look=window.ComposerLookPicker;selection.brand=Object.hasOwn(brands,look?.brand)?look.brand:(Object.hasOwn(brands,'default')?'default':Object.keys(brands)[0]);chips('brand',brands);fillThemes(look?.theme);$('#share-release').textContent='';render();dialog.showModal();try{const response=await fetch(root+'releases.json',{cache:'no-store'});if(!response.ok)return;const manifest=await response.json(),entry=manifest[requestedGame];if(!entry||game!==requestedGame)return;let text='Published configuration · revision '+entry.revision;const receipt=await window.ComposerAuth.client.from('composer_releases').select('published_at').eq('version_id',entry.version_id).maybeSingle();if(receipt.data?.published_at)text+=' · '+new Date(receipt.data.published_at).toLocaleString();if(game===requestedGame)$('#share-release').textContent=text}catch{}};

dialog.querySelector('[data-close]').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()});
dialog.addEventListener('click',event=>{
 const chip=event.target.closest('[data-choice]');if(!chip||!dialog.contains(chip))return;
 const key=chip.dataset.choice;selection[key]=chip.dataset.value;
 for(const sibling of chip.parentElement.querySelectorAll('[data-choice]'))sibling.setAttribute('aria-pressed',String(sibling===chip));
 if(key==='brand')fillThemes();render();
});
for(const b of dialog.querySelectorAll('[data-copy]'))b.onclick=async()=>{const field=$('#share-'+b.dataset.copy);try{await navigator.clipboard.writeText(field.value);$('#share-status').textContent=b.dataset.copy.endsWith('url')?'Link copied.':'Iframe code copied.'}catch{field.focus();field.select();$('#share-status').textContent='Selected for copying. Press Ctrl+C or ⌘C.'}};
$('#share-download').onclick=()=>{
 const language=selection.language;
 const switcher='<label>Language <select id="game-language">'+[['en','EN'],['fr','FR'],['ht','CR']].map(([value,label])=>'<option value="'+value+'"'+(value===language?' selected':'')+'>'+label+'</option>').join('')+'</select></label>';
 const script=`const frame=document.querySelector('#crash-game'),language=document.querySelector('#game-language');
const origin=new URL(frame.src).origin;
function setLanguage(){frame.contentWindow.postMessage({type:'crash-language',locale:language.value},origin)}
language.addEventListener('change',setLanguage);
frame.addEventListener('load',setLanguage);
window.addEventListener('message',event=>{if(event.source===frame.contentWindow&&event.origin===origin&&event.data?.type==='crash-language-ready')setLanguage()});`;
 const html='<!doctype html>\n<html lang="'+language+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(title)+'</title><style>body{margin:0;padding:16px;background:#0b1016;color:#e2e7ee;font:16px system-ui}label{display:block;margin-bottom:12px}select{font:inherit}</style></head><body>\n'+switcher+'\n'+$('#share-code').value+'\n<script>'+script+'</script>\n</body></html>';
 const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=game+'-embed.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
};
window.addEventListener('composer-target',sync);$('#target').addEventListener('change',sync);sync();
})();
