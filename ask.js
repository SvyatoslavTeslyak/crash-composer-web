/* Composer's own confirmation and question windows, in place of the browser's confirm() and
   prompt(): the same dialog as the rest of Composer, in its theme, on top of whatever is open.

     if(!await ask('Remove Oxanium from the kit? Every weight and format of it goes.'))return;
     const url=await ask('Link address (https://…)',{input:current});   // the text, or null

   The question (up to its first "?") is the title and the rest the explanation. The confirming
   button is named by the question's first word ("Remove", "Discard", "Apply"…), and a question
   that takes something away gets a red one. */
(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const DANGER=/^(remove|discard|delete|put|sign)/i;
 let dialog=null;
 function ask(message,options={}){
  const text=String(message||''),cut=text.indexOf('?'),title=options.title||(cut>0?text.slice(0,cut+1):text),body=options.title?text:(cut>0?text.slice(cut+1).trim():'');
  const verb=options.ok||(options.input!==undefined?'Save':(title.match(/^([A-Z][a-z]+)/)?.[1]||'OK'));
  const danger=options.danger??(options.input===undefined&&DANGER.test(title));
  if(!dialog){dialog=document.createElement('dialog');dialog.className='share-dialog ask-dialog';document.body.append(dialog)}
  dialog.innerHTML='<form method="dialog"><h2>'+esc(title)+'</h2>'+(body?'<p>'+esc(body).replace(/\n+/g,'</p><p>')+'</p>':'')
   +(options.input!==undefined?'<input type="text" class="ask-input" value="'+esc(options.input)+'"'+(options.placeholder?' placeholder="'+esc(options.placeholder)+'"':'')+'>':'')
   +'<div class="ask-actions"><button type="button" class="wb-button" value="cancel">'+esc(options.cancel||'Cancel')+'</button><button type="submit" class="wb-button '+(danger?'ask-danger':'primary')+'" value="ok">'+esc(verb)+'</button></div></form>';
  return new Promise(resolve=>{
   const input=dialog.querySelector('.ask-input');
   const done=ok=>{dialog.onclose=null;if(dialog.open)dialog.close();resolve(input?(ok?input.value:null):ok)};
   dialog.querySelector('[value=cancel]').onclick=()=>done(false);
   dialog.querySelector('form').onsubmit=e=>{e.preventDefault();done(true)};
   dialog.oncancel=e=>{e.preventDefault();done(false)};
   dialog.showModal();
   (input||dialog.querySelector(danger?'[value=cancel]':'[value=ok]')).focus();
   // A bare "https://" is a start to type after; anything else is picked to type over.
   if(input){if(/^https?:\/\/$/.test(input.value))input.setSelectionRange(input.value.length,input.value.length);else input.select()}
  });
 }
 window.ask=ask;
})();
