// Public embeds use stable game URLs; each deployment redirects to versioned assets.
(()=>{
'use strict';
const $=s=>document.querySelector(s),button=$('#share-game'),root='https://svyatoslavteslyak.github.io/crash-showcase/';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dialog=document.createElement('dialog');dialog.className='share-dialog';dialog.setAttribute('aria-labelledby','share-title');
dialog.innerHTML=`<header><div><small>PUBLISHED GAME</small><h2 id="share-title">Embed game</h2></div><button class="wb-button" type="button" data-close aria-label="Close share window">✕</button></header>
<p>Embed the game on your website, without Composer controls.</p><p class="share-note">Shares the published game, not your current draft. Changes appear here only after publication.</p>
<p id="share-release" class="share-note"></p><label>Language<select id="share-language"><option value="en">EN · English</option><option value="fr">FR · Français</option><option value="ht">CR · Kreyòl</option></select></label>
<label>Game link<input id="share-url" readonly></label><div class="share-actions"><button type="button" class="wb-button" data-copy="url">Copy link</button><a class="wb-button" id="share-open" target="_blank" rel="noopener">Open game ↗</a></div>
<label>Iframe code<textarea id="share-code" rows="7" readonly spellcheck="false"></textarea></label><small>Fills its container. The example uses 85% of the viewport height; adjust the container height in your site’s CSS.</small>
<details><summary>Switch language from your website</summary><p>Send a message without reloading the game. The downloaded example includes an EN / FR / CR switch.</p><textarea id="share-language-code" rows="6" readonly spellcheck="false"></textarea></details>
<footer><button class="wb-button" type="button" data-copy="code">Copy iframe</button><button class="wb-button" type="button" id="share-download">Download HTML example</button></footer><p id="share-status" role="status" aria-live="polite"></p>`;
document.body.append(dialog);let game,title;
const sync=()=>{const playable=!!window.ComposerTarget?.entry()?.live;button.disabled=!playable;button.title=playable?'Share a public game link or iframe':'Select a game to share'};
function render(){
 const url=new URL('games/'+encodeURIComponent(game)+'/index.html',root);url.searchParams.set('lang',$('#share-language').value);
 $('#share-url').value=url.href;$('#share-open').href=url.href;
 $('#share-code').value='<div style="width:100%;height:85vh;height:85dvh">\n  <iframe\n    id="crash-game"\n    src="'+escape(url.href)+'"\n    title="'+escape(title)+'"\n    style="display:block;width:100%;height:100%;border:0"\n    allow="autoplay; fullscreen" allowfullscreen\n    loading="lazy"\n  ></iframe>\n</div>';
 $('#share-language-code').value="document.querySelector('#crash-game').contentWindow.postMessage(\n  { type: 'crash-language', locale: 'fr' },\n  'https://svyatoslavteslyak.github.io'\n);";
 $('#share-status').textContent='';
}
button.onclick=async()=>{if(!window.ComposerTarget?.entry()?.live)return;game=window.ComposerTarget.value;const requestedGame=game;title=window.ComposerTarget.entry().title;$('#share-title').textContent='Share published '+title;$('#share-language').value=$('#language').value;$('#share-release').textContent='';render();dialog.showModal();try{const response=await fetch(root+'releases.json',{cache:'no-store'});if(!response.ok)return;const manifest=await response.json(),entry=manifest[requestedGame];if(!entry||game!==requestedGame)return;let text='Published configuration · revision '+entry.revision;const receipt=await window.ComposerAuth.client.from('composer_releases').select('published_at').eq('version_id',entry.version_id).maybeSingle();if(receipt.data?.published_at)text+=' · '+new Date(receipt.data.published_at).toLocaleString();if(game===requestedGame)$('#share-release').textContent=text}catch{}};

dialog.querySelector('[data-close]').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()});
for(const input of dialog.querySelectorAll('select,input[type=number]'))input.addEventListener('input',render);
for(const b of dialog.querySelectorAll('[data-copy]'))b.onclick=async()=>{const field=$('#share-'+b.dataset.copy);try{await navigator.clipboard.writeText(field.value);$('#share-status').textContent=b.dataset.copy==='url'?'Link copied.':'Iframe code copied.'}catch{field.focus();field.select();$('#share-status').textContent='Selected for copying. Press Ctrl+C or ⌘C.'}};
$('#share-download').onclick=()=>{
 const language=$('#share-language').value;
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
