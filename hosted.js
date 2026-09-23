/* Installed only by tools/pages.py. Keep local Python endpoints local in dev. */
(()=>{
 const nativeFetch=window.fetch.bind(window),base=new URL('./',location.href);
 const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 window.ComposerHosting={mode:'pages',base:base.href,audioUrl:(source,file)=>new URL('data/audio/'+encodeURIComponent(source)+'/'+file.split('/').map(encodeURIComponent).join('/'),base).href};
 const explain=()=>{
  for(const id of ['look-controls','sound-controls','library-controls']){
   const panel=document.getElementById(id);if(!panel)continue;
   if(!panel.querySelector('[data-hosting-note]')){const note=document.createElement('p');note.dataset.hostingNote='';note.textContent='Online preview · file editing is currently available in the local Composer.';note.style.cssText='font-size:12px;color:var(--text-muted);line-height:1.5';panel.prepend(note)}
  }
  for(const element of document.querySelectorAll('#look-edit-main,#look-edit-other,#look-controls .add,#library-report .use-select,#library-report [data-remove],#library-google,#library-google-add,#library-upload,#library-file,#icon-add,#icon-file,#library-report [data-replace],#library-report [data-drop],#sound-report input,#sound-report textarea,#sound-reset')){element.disabled=true;element.title='File editing is available in the local Composer.'}
 };
 if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{explain();new MutationObserver(explain).observe(document.body,{childList:true,subtree:true})},{once:true});
 window.fetch=async(input,options={})=>{
  const url=new URL(input instanceof Request?input.url:input,location.href);
  if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return nativeFetch(input,options);
  const path=url.pathname.slice(base.pathname.length),method=(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  if(/^(auth|api)\//.test(path)){
   await window.ComposerAuth.ready;
   const {data,error}=await window.ComposerAuth.client.auth.getSession();
   if(error||!data.session)return json(401,{message:'Sign in to Composer first.'});
   const target=new URL(window.ComposerCloudConfig.url+'/functions/v1/composer-player');
   target.search=url.search;target.searchParams.set('path',path);
   const headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined));
   headers.set('Authorization','Bearer '+data.session.access_token);
   headers.set('apikey',window.ComposerCloudConfig.publishableKey);
   const body=options.body??(input instanceof Request&&!['GET','HEAD'].includes(method)?await input.clone().text():undefined);
   return nativeFetch(target,{...options,method,headers,body,credentials:'omit',redirect:'error'});
  }
  if(path==='translations'&&method==='GET')return nativeFetch(new URL('data/translations.json',base),options);
  if(path==='brands/'&&method==='GET')return nativeFetch(new URL('data/brands.json',base),options);
  if(path==='studio/catalog'&&method==='GET')return nativeFetch(new URL('data/studio.json',base),options);
  if(path.startsWith('brands/')||path.startsWith('studio/'))return json(501,{message:'This file operation needs the hosted editor backend. Use the local Composer until it is connected.'});
  return nativeFetch(input,options);
 };
})();
