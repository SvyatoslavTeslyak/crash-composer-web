/* Shared browser UI. Games supply state and receive intent; no game economy lives here. */
(function(){
'use strict';
const base=new URL('.',document.currentScript.src).href;
// A page that loads the kit as ui.js?v=<build> passes that same stamp on to everything the
// kit fetches for itself, so a release is never half old: a cached catalog beside a fresh
// ui.js would show last week's wording.
const version=new URL(document.currentScript.src).search;
if(!window.CrashI18n){const script=document.createElement('script');script.src=base+'i18n.js'+version;document.head.append(script)}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let currency='';
// The go button doubles as cash out when the game says so; older games are recognised
// by the wording they use on it.
// How high a multiplier reads: the same four tiers colour the live badge and the history.
const tintFor=m=>Number(m)>=10?'gold':Number(m)>=5?'purple':Number(m)>=2?'success':'cyan';
// Road lane markers belong to the scene and keep this palette across brands.
const multiplierColour=(m,game)=>game==='road'?(Number(m)<=0?'#ff9999':{gold:'#ffd468',purple:'#d5a0ff',success:'#62e4ad',cyan:'#71d5ff'}[tintFor(m)]):'var(--'+tintFor(m)+')';
const goIsCash=s=>s.goCash!==undefined?!!s.goCash:s.goTitle==='CASH OUT';
const money=(v,digits=2)=>window.CrashI18n?.locale==='fr'?window.CrashI18n.number(Number(v||0),{minimumFractionDigits:digits,maximumFractionDigits:digits})+' '+(currency||'$'):currency?Number(v||0).toFixed(digits)+' '+currency:'$'+Number(v||0).toFixed(digits);
const wager=v=>money(v,Number.isInteger(Number(v||0))?0:2);
// On an action button the currency is a small unit after the figure, so a payout stays on one
// line: the figure at the button's size, the unit at the title's.
// The figure carries the currency as a smaller word after it, the way CASH OUT shows it.
const moneyHtml=v=>{const text=money(v);return currency&&text.endsWith(' '+currency)?esc(text.slice(0,-currency.length-1))+'<small class="money-unit">'+esc(currency)+'</small>':esc(text)};
const moneySlot=(node,v)=>{const html=moneyHtml(v);if(node.dataset.html!==html){node.dataset.html=html;node.innerHTML=html}};
// The stake is read beside the coin, the way the header balance is, so it carries the icon
// instead of a currency mark.
const coinAmount=v=>{const n=Number(v||0),digits=Number.isInteger(n)?0:2;return window.CrashI18n?.locale==='fr'?window.CrashI18n.number(n,{minimumFractionDigits:digits,maximumFractionDigits:digits}):n.toFixed(digits)};
// Every raster the kit draws ships twice, as WebP and as PNG, and the browser gets the one it
// decodes: the canvas encoder answers at once, the decode probe confirms and re-points any image
// already on the page. Vector files have no pair and are left alone.
const PAIRED=/\.(webp|png)$/;
let webp=(()=>{try{return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp')}catch{return false}})();
const pick=name=>PAIRED.test(name)?name.replace(PAIRED,webp?'.webp':'.png'):name;
const webpProbe=new Promise(resolve=>{const probe=new Image();probe.onload=probe.onerror=()=>resolve(probe.width===1);probe.src='data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='});
webpProbe.then(decodes=>{if(decodes===webp)return;webp=decodes;document.querySelectorAll('.crash-ui img[data-pair]').forEach(img=>{img.src=base+img.dataset.pair.replace(/^(.*)\.(webp|png)$/,'$1'+(webp?'.webp':'.png'))+version});document.querySelectorAll('.crash-ui').forEach(host=>host.classList.toggle('no-webp',!webp))});
const icon=(name)=>'<img class="icon" alt="" src="'+base+'assets/icons/'+pick(name)+(name==='play.svg'?'?v=ink-5':version)+'"'+(PAIRED.test(name)?' data-pair="assets/icons/'+name+'"':'')+'>';
// Discrete steps, never interpolation: the stake is the panel's largest figure while it is
// short, and gives that up one step at a time as the amount grows.
// The tabbed shell's top-right button opens the sound switches, so it is a speaker.
// The step the button takes: an arrow beside GO, in the label's own colour, pointing the
// way the goat moves. It belongs to the next-lane press only, not to PLAY or CHECK ROUND.
// The box is cropped to the artwork, with a pixel of air above and below it inside the 24.
const GO_ARROW_SVG='<svg class="go-arrow" viewBox="2.18 2.18 19.64 19.64" fill="none" aria-hidden="true" focusable="false">'
+'<path fill="currentColor" d="M11.9069 6.80501C11.9492 6.83656 12.0748 6.93015 12.155 6.99073C12.3155 7.11194 12.5456 7.2875 12.8222 7.50331C13.3763 7.93574 14.1118 8.52596 14.8443 9.16197C15.5818 9.80229 16.2935 10.4694 16.813 11.0574C17.0738 11.3525 17.265 11.6042 17.3857 11.8043C17.4432 11.8996 17.4725 11.9636 17.4872 11.9998C17.4725 12.036 17.4432 12.0999 17.3857 12.1953C17.265 12.3954 17.0738 12.6471 16.813 12.9422C16.2935 13.5301 15.5818 14.1973 14.8443 14.8376C14.1118 15.4737 13.3763 16.0639 12.8222 16.4963C12.5457 16.7121 12.0674 17.0734 11.9069 17.1946C11.4622 17.5222 11.3672 18.1482 11.6948 18.5929C12.0223 19.0375 12.6488 19.1321 13.0935 18.8046L13.0966 18.8023C13.2673 18.6733 13.7685 18.2948 14.0527 18.073C14.6235 17.6275 15.3881 17.0142 16.1555 16.3478C16.918 15.6858 17.7063 14.9518 18.3118 14.2665C18.6135 13.925 18.891 13.572 19.0985 13.2278C19.2894 12.9111 19.4999 12.4759 19.4999 11.9998C19.4999 11.5236 19.2894 11.0884 19.0985 10.7717C18.891 10.4275 18.6135 10.0746 18.3118 9.73309C17.7063 9.04781 16.918 8.31379 16.1555 7.65176C15.388 6.98542 14.6235 6.37211 14.0526 5.9266C13.7667 5.70344 13.5281 5.52142 13.3604 5.3948C13.2773 5.33202 13.1414 5.23074 13.0947 5.19591L13.0934 5.19501C12.6488 4.8675 12.0222 4.9621 11.6947 5.4068C11.3672 5.8515 11.4622 6.47749 11.9069 6.80501Z"/>'
+'<path fill="currentColor" d="M5.04889 5.10738C4.71225 5.27754 4.5 5.62265 4.5 5.99985L4.50005 17.9999C4.50005 18.3771 4.7123 18.7222 5.04895 18.8923C5.38559 19.0625 5.78934 19.0287 6.09307 18.805L6.09561 18.8031C6.14356 18.7674 6.27823 18.667 6.36057 18.6048C6.52821 18.4782 6.76681 18.2962 7.05277 18.073C7.62364 17.6275 8.38817 17.0142 9.15563 16.3478C9.91813 15.6858 10.7064 14.9518 11.3119 14.2665C11.6136 13.925 11.8911 13.572 12.0986 13.2279C12.2895 12.9111 12.5 12.4759 12.5 11.9998C12.5 11.5237 12.2895 11.0885 12.0986 10.7718C11.8911 10.4276 11.6136 10.0746 11.3119 9.73314C10.7064 9.04786 9.91811 8.31383 9.15561 7.65181C8.38814 6.98546 7.6236 6.37215 7.05273 5.92665C6.76676 5.70348 6.52816 5.52147 6.36051 5.39484C6.27739 5.33206 6.14149 5.23078 6.09476 5.19595L6.09355 5.19505C5.78983 4.97137 5.38553 4.93722 5.04889 5.10738Z"/>'
+'</svg>';
const SPEAKER_SVG='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.99 3.98c.69-.53 1.5-.96 2.38-.59.86.36 1.14 1.24 1.26 2.11.12.88.12 2.1.12 3.62v5.76c0 1.52 0 2.74-.12 3.62-.12.87-.4 1.75-1.26 2.11-.88.37-1.69-.06-2.38-.59-.7-.54-1.6-1.45-2.64-2.52-.54-.55-.9-.82-1.26-.97-.37-.15-.81-.21-1.58-.21-.67 0-1.27 0-1.72-.05-.47-.05-.92-.16-1.31-.43-.76-.51-1.05-1.27-1.16-1.96-.08-.52-.07-1.09-.06-1.55v-.68c-.01-.46-.02-1.03.06-1.54.11-.7.4-1.45 1.16-1.97.39-.27.84-.38 1.31-.43.45-.04 1.05-.04 1.72-.04.77 0 1.21-.07 1.58-.22.36-.15.72-.41 1.26-.97 1.05-1.07 1.94-1.98 2.64-2.52Z"/><path fill="currentColor" fill-rule="evenodd" d="M16.39 8.2a1 1 0 0 1 1.4.19A5.98 5.98 0 0 1 19 12a5.98 5.98 0 0 1-1.2 3.6 1 1 0 1 1-1.6-1.2A3.98 3.98 0 0 0 17 12c0-.91-.3-1.75-.8-2.39a1 1 0 0 1 .19-1.4Z"/><path fill="currentColor" fill-rule="evenodd" d="M19.32 6.26a1 1 0 0 1 1.41.06A8.25 8.25 0 0 1 23 12a8.25 8.25 0 0 1-2.26 5.68 1 1 0 1 1-1.48-1.36A6.25 6.25 0 0 0 21 12a6.25 6.25 0 0 0-1.74-4.32 1 1 0 0 1 .06-1.42Z"/></svg>';
// The cash-out toast's clock: the check pops for half a second, flips into the coin, the coins fly
// (WEB_WIN_COIN_DURATION_MS plus their stagger), and the toast leaves once they have landed.
const WIN_FLIP_AT=500,WIN_FLIP_MS=250,WIN_TOAST_MS=1800;
// Bet details icons, keyed by the label a game sends (matched loosely, case-free). The filled
// ones are Hugeicons; the result marks are the kit's own strokes.
const DETAIL_ICONS={
 wager:'<path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" d="M3.5767 1.71402C4.88361 1.26163 6.62427 1 8.5 1C10.3757 1 12.1164 1.26163 13.4233 1.71402C14.072 1.93857 14.6685 2.22871 15.1225 2.60032C15.5692 2.9659 16 3.51776 16 4.25V6.00576C16 6.18564 16 6.27558 15.9642 6.34214C15.9359 6.39468 15.8947 6.43592 15.8421 6.46419C15.7756 6.5 15.6837 6.5 15.5 6.5C13.5031 6.5 11.5889 6.77632 10.086 7.29654C9.34635 7.55259 8.56918 7.91433 7.92746 8.43951C7.53926 8.75721 7.07625 9.24386 6.78513 9.90045C6.72098 10.0451 6.68891 10.1175 6.63388 10.15C6.57884 10.1826 6.50741 10.1766 6.36456 10.1645C4.6083 10.0157 3.12662 9.673 2.01286 9.13675C1.79088 9.02987 1.58514 8.91641 1.39569 8.79618C1.21436 8.68112 1.1237 8.62359 1.06185 8.51109C1 8.39858 1 8.27636 1 8.03192V4.25004C1 3.51781 1.43077 2.9659 1.87746 2.60032C2.33153 2.22871 2.928 1.93857 3.5767 1.71402ZM3.14414 4.14807C3.34791 3.98131 3.70334 3.78662 4.23092 3.604C5.27654 3.24205 6.78588 3 8.5 3C10.2141 3 11.7235 3.24205 12.7691 3.604C13.2967 3.78662 13.6521 3.98131 13.8559 4.14807C13.9217 4.20195 13.9217 4.29805 13.8559 4.35193C13.6521 4.51869 13.2967 4.71338 12.7691 4.896C11.7235 5.25795 10.2141 5.5 8.5 5.5C6.78588 5.5 5.27654 5.25795 4.23092 4.896C3.70334 4.71338 3.34791 4.51869 3.14414 4.35193C3.07831 4.29805 3.07831 4.20195 3.14414 4.14807Z"/><path fill="currentColor" d="M6.5 12.0516C6.5 11.8759 6.5 11.7881 6.44759 11.7308C6.39518 11.6735 6.30663 11.6656 6.12952 11.6497C4.29374 11.4854 2.66 11.1131 1.36214 10.4883C1.29931 10.458 1.2679 10.4429 1.24756 10.4379C1.13472 10.4103 1.0284 10.4771 1.00434 10.5907C1 10.6112 1 10.644 1 10.7095V13.8304C1 14.0954 1 14.2278 1.07203 14.347C1.14405 14.4663 1.24658 14.5202 1.45164 14.628C1.61214 14.7123 1.78497 14.7924 1.97047 14.8679C3.0317 15.3003 4.42548 15.5546 6.07777 15.6717C6.27437 15.6856 6.37267 15.6925 6.43633 15.6332C6.5 15.5739 6.5 15.4744 6.5 15.2754V12.0516Z"/><path fill="currentColor" d="M6.5 17.5801C6.5 17.401 6.5 17.3114 6.44597 17.2537C6.39195 17.196 6.3017 17.1901 6.1212 17.1783C4.30971 17.0595 2.69148 16.7814 1.40453 16.2571C1.29425 16.2121 1.23911 16.1897 1.19986 16.1897C1.11611 16.1898 1.04649 16.2366 1.01483 16.3141C1 16.3505 1 16.4073 1 16.521V19C1 19.7494 1.49085 20.2732 1.92253 20.5872C2.3761 20.9172 2.96813 21.1726 3.60972 21.37C4.39924 21.613 5.34972 21.7938 6.39416 21.898C6.75899 21.9344 6.9414 21.9526 7.00865 21.8574C7.07589 21.7623 6.98834 21.5762 6.81325 21.204C6.62477 20.8034 6.5 20.3357 6.5 19.8002V17.5801Z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" d="M15.5 8C13.6243 8 11.8836 8.26163 10.5767 8.71402C9.928 8.93857 9.33153 9.22871 8.87746 9.60032C8.43077 9.9659 8 10.5178 8 11.25V13.8808C8 14.3335 8 14.5599 8.12455 14.7855C8.24911 15.0111 8.40346 15.1083 8.71216 15.3027C10.2251 16.2552 12.5583 16.7498 15.5001 16.7498C18.4419 16.7498 20.7751 16.2552 22.288 15.3027C22.5966 15.1084 22.7509 15.0112 22.8754 14.7856C23 14.56 23 14.3336 23 13.8808V11.2502C23 10.518 22.5692 9.9659 22.1225 9.60032C21.6685 9.22871 21.072 8.93857 20.4233 8.71402C19.1164 8.26163 17.3757 8 15.5 8ZM11.2309 10.604C10.7033 10.7866 10.3479 10.9813 10.1441 11.1481C10.0783 11.202 10.0783 11.298 10.1441 11.3519C10.3479 11.5187 10.7033 11.7134 11.2309 11.896C12.2765 12.258 13.7859 12.5 15.5 12.5C17.2141 12.5 18.7235 12.258 19.7691 11.896C20.2967 11.7134 20.6521 11.5187 20.8559 11.3519C20.9217 11.298 20.9217 11.202 20.8559 11.1481C20.6521 10.9813 20.2967 10.7866 19.7691 10.604C18.7235 10.242 17.2141 10 15.5 10C13.7859 10 12.2765 10.242 11.2309 10.604Z"/><path fill="currentColor" d="M15.5001 18.2499C18.348 18.2499 20.8565 17.8117 22.6917 16.8046C22.8318 16.7277 22.9019 16.6893 22.9509 16.7183C23 16.7474 23 16.8258 23 16.9826V19.8003C23 20.5352 22.5585 21.0817 22.114 21.4375C21.6598 21.8009 21.0641 22.0841 20.4168 22.3032C19.1121 22.7448 17.3738 23.0003 15.5 23.0003C13.6262 23.0003 11.8879 22.7448 10.5832 22.3032C9.93591 22.0841 9.34016 21.8009 8.88601 21.4375C8.44147 21.0817 8 20.5352 8 19.8003V16.9825C8 16.8257 8 16.7473 8.04906 16.7182C8.09813 16.6892 8.16817 16.7276 8.30826 16.8045C10.1436 17.8116 12.6521 18.2499 15.5001 18.2499Z"/>',
 multiplier:'<path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" d="M16.4983 1.75C15.946 1.75 15.4983 2.19772 15.4983 2.75C15.4983 3.30228 15.946 3.75 16.4983 3.75H17.1067C16.6145 4.19841 15.9502 4.75662 15.0963 5.37971C12.8642 7.00856 9.33094 9.08504 4.18209 10.8013C3.65815 10.976 3.37499 11.5423 3.54964 12.0662C3.72428 12.5902 4.2906 12.8733 4.81455 12.6987C10.1657 10.915 13.8824 8.74144 16.2753 6.99529C17.215 6.30955 17.9497 5.69037 18.4983 5.18757V5.75C18.4983 6.30228 18.946 6.75 19.4983 6.75C20.0506 6.75 20.4983 6.30228 20.4983 5.75V2.75C20.4983 2.19772 20.0506 1.75 19.4983 1.75H16.4983ZM19 8.75H18.9782C18.7639 8.74999 18.5671 8.74998 18.4018 8.76126C18.2242 8.77338 18.0288 8.80099 17.8303 8.88321C17.4015 9.06083 17.0608 9.40151 16.8832 9.83031C16.801 10.0288 16.7734 10.2241 16.7613 10.4018C16.75 10.5671 16.75 10.7639 16.75 10.9782V11V20.0218C16.75 20.2361 16.75 20.4329 16.7613 20.5982C16.7734 20.7759 16.801 20.9712 16.8832 21.1697C17.0608 21.5985 17.4015 21.9392 17.8303 22.1168C18.0288 22.199 18.2242 22.2266 18.4018 22.2387C18.5671 22.25 18.764 22.25 18.9782 22.25H19.0218C19.236 22.25 19.4329 22.25 19.5982 22.2387C19.7759 22.2266 19.9712 22.199 20.1697 22.1168C20.5985 21.9392 20.9392 21.5985 21.1168 21.1697C21.199 20.9712 21.2266 20.7759 21.2387 20.5982C21.25 20.4329 21.25 20.2361 21.25 20.0219V10.9782C21.25 10.764 21.25 10.5671 21.2387 10.4018C21.2266 10.2241 21.199 10.0288 21.1168 9.83031C20.9392 9.40151 20.5985 9.06083 20.1697 8.88321C19.9712 8.80099 19.7759 8.77338 19.5982 8.76126C19.4329 8.74998 19.2361 8.74999 19.0218 8.75H19ZM11.9782 12.25H12H12.0218C12.2361 12.25 12.4329 12.25 12.5982 12.2613C12.7759 12.2734 12.9712 12.301 13.1697 12.3832C13.5985 12.5608 13.9392 12.9015 14.1168 13.3303C14.199 13.5288 14.2266 13.7241 14.2387 13.9018C14.25 14.0671 14.25 14.2639 14.25 14.4782V20.0218C14.25 20.2361 14.25 20.4329 14.2387 20.5982C14.2266 20.7759 14.199 20.9712 14.1168 21.1697C13.9392 21.5985 13.5985 21.9392 13.1697 22.1168C12.9712 22.199 12.7759 22.2266 12.5982 22.2387C12.4329 22.25 12.236 22.25 12.0218 22.25H11.9782C11.764 22.25 11.5671 22.25 11.4018 22.2387C11.2242 22.2266 11.0288 22.199 10.8303 22.1168C10.4015 21.9392 10.0608 21.5985 9.88321 21.1697C9.80099 20.9712 9.77338 20.7759 9.76126 20.5982C9.74998 20.4329 9.74999 20.2361 9.75 20.0218V14.5V14.4782C9.74999 14.2639 9.74998 14.0671 9.76126 13.9018C9.77338 13.7241 9.80099 13.5288 9.88321 13.3303C10.0608 12.9015 10.4015 12.5608 10.8303 12.3832C11.0288 12.301 11.2242 12.2734 11.4018 12.2613C11.5671 12.25 11.7639 12.25 11.9782 12.25ZM5 14.75H4.97825C4.76399 14.75 4.56711 14.75 4.40179 14.7613C4.22415 14.7734 4.02881 14.801 3.83031 14.8832C3.40151 15.0608 3.06083 15.4015 2.88321 15.8303C2.80099 16.0288 2.77338 16.2241 2.76126 16.4018C2.74998 16.5671 2.74999 16.7639 2.75 16.9782V17V20.0218C2.74999 20.2361 2.74998 20.4329 2.76126 20.5982C2.77338 20.7759 2.80099 20.9712 2.88321 21.1697C3.06083 21.5985 3.40151 21.9392 3.83031 22.1168C4.02881 22.199 4.22415 22.2266 4.40179 22.2387C4.5671 22.25 4.76393 22.25 4.97819 22.25H5.02176C5.23601 22.25 5.4329 22.25 5.59821 22.2387C5.77585 22.2266 5.97119 22.199 6.1697 22.1168C6.5985 21.9392 6.93918 21.5985 7.11679 21.1697C7.19901 20.9712 7.22663 20.7759 7.23875 20.5982C7.25003 20.4329 7.25002 20.236 7.25 20.0218V16.9782C7.25002 16.764 7.25003 16.5671 7.23875 16.4018C7.22663 16.2241 7.19901 16.0288 7.11679 15.8303C6.93918 15.4015 6.5985 15.0608 6.1697 14.8832C5.97119 14.801 5.77585 14.7734 5.59821 14.7613C5.4329 14.75 5.23606 14.75 5.0218 14.75H5Z"/>',
 prize:'<path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" d="M12 1.24927C7.44365 1.24927 3.75 4.94292 3.75 9.49927C3.75 14.0556 7.44365 17.7493 12 17.7493C16.5563 17.7493 20.25 14.0556 20.25 9.49927C20.25 4.94292 16.5563 1.24927 12 1.24927ZM15.3003 8.45436C15.8271 8.28852 16.1197 7.72702 15.9538 7.20023C15.788 6.67343 15.2265 6.38082 14.6997 6.54666C13.3701 6.96524 12.0909 8.14537 11.2267 9.06618C10.9596 9.35079 10.7173 9.62709 10.5084 9.87523C10.3297 9.70787 10.1516 9.57612 9.97855 9.47355C9.95822 9.46151 9.93783 9.44914 9.91717 9.43662C9.70847 9.31009 9.47274 9.16718 9 9.16718C8.44772 9.16718 8 9.61489 8 10.1672C8 10.684 8.39207 11.1093 8.89501 11.1617C9.00137 11.2248 9.32472 11.4509 9.62842 11.9908C9.79609 12.2888 10.1045 12.4806 10.446 12.4991C10.7874 12.5175 11.1149 12.3598 11.3138 12.0817C11.5581 11.7741 12.2785 10.8681 12.6851 10.4348C13.5415 9.52232 14.5122 8.70246 15.3003 8.45436Z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" d="M17.8617 14.5459L18.5451 17.819C18.7492 18.7964 18.9204 19.6164 18.978 20.2511C19.0334 20.8602 19.025 21.6313 18.4981 22.2135C18.2223 22.5183 17.8638 22.6996 17.4587 22.7411C17.0955 22.7782 16.7527 22.697 16.4722 22.6018C15.9491 22.4242 15.3086 22.0735 14.608 21.6899C14.5821 21.6757 14.5561 21.6615 14.5301 21.6472L12.2566 20.4028C12.1635 20.3519 12.0926 20.3131 12.0311 20.2809C12.0201 20.2751 12.0099 20.2698 12.0003 20.2649C11.9907 20.2698 11.9805 20.2751 11.9694 20.2809C11.9079 20.3131 11.837 20.3519 11.744 20.4028L9.47052 21.6472C9.44444 21.6615 9.41845 21.6757 9.39254 21.6899C8.692 22.0735 8.05151 22.4242 7.52839 22.6018C7.24788 22.697 6.90507 22.7782 6.54193 22.7411C6.13674 22.6996 5.77824 22.5183 5.50248 22.2135C4.97562 21.6313 4.96723 20.8602 5.02254 20.2511C5.08018 19.6164 5.25142 18.7964 5.45551 17.819C5.4599 17.798 5.4643 17.777 5.46871 17.7558L6.13892 14.5459L8.0967 14.9547L7.42649 18.1646C7.20576 19.2218 7.06021 19.9269 7.01434 20.432C7.00587 20.5253 7.00193 20.6024 7.00081 20.6654C7.33078 20.535 7.79276 20.2856 8.51023 19.8929L10.7837 18.6484C10.7924 18.6437 10.8011 18.6389 10.8099 18.6341C10.9683 18.5473 11.1408 18.4529 11.299 18.3844C11.4832 18.3046 11.7177 18.2275 12.0003 18.2275C12.2829 18.2275 12.5173 18.3046 12.7016 18.3844C12.8598 18.4529 13.0323 18.5473 13.1907 18.6341C13.1994 18.6389 13.2082 18.6437 13.2169 18.6484L15.4903 19.8929C16.2078 20.2856 16.6698 20.535 16.9998 20.6654C16.9987 20.6024 16.9947 20.5253 16.9862 20.432C16.9404 19.9269 16.7948 19.2218 16.5741 18.1646L15.9039 14.9547L17.8617 14.5459Z"/>',
 difficulty:'<path fill="currentColor" d="M18.5448 2.75C18.9776 2.74995 19.3744 2.74991 19.6972 2.79331C20.0527 2.8411 20.4284 2.95355 20.7374 3.26257C21.0465 3.57159 21.1589 3.94732 21.2067 4.3028C21.2501 4.62561 21.2501 5.02244 21.25 5.45526V16.552C21.25 17.4505 21.2501 18.1997 21.1701 18.7945C21.0857 19.4223 20.9 19.9891 20.4445 20.4446C19.9891 20.9 19.4223 21.0857 18.7945 21.1701C18.1997 21.2501 17.4505 21.25 16.552 21.25H5.45526C5.02244 21.2501 4.62561 21.2501 4.3028 21.2067C3.94732 21.1589 3.57159 21.0465 3.26257 20.7374C2.95355 20.4284 2.8411 20.0527 2.79331 19.6972C2.74991 19.3744 2.74995 18.9776 2.75 18.5448V17.4553C2.74995 17.0224 2.74991 16.6256 2.79331 16.3028C2.8411 15.9473 2.95355 15.5716 3.26257 15.2626C3.57159 14.9535 3.94732 14.8411 4.3028 14.7933C4.62561 14.7499 5.02244 14.75 5.45525 14.75H6.75001L6.75 13.4553C6.74995 13.0224 6.74991 12.6256 6.79331 12.3028C6.8411 11.9473 6.95355 11.5716 7.26257 11.2626C7.57159 10.9535 7.94732 10.8411 8.3028 10.7933C8.62561 10.7499 9.02244 10.75 9.45525 10.75H10.75V9.50001V9.45526C10.75 9.02245 10.7499 8.62561 10.7933 8.3028C10.8411 7.94732 10.9535 7.57159 11.2626 7.26257C11.5716 6.95355 11.9473 6.8411 12.3028 6.79331C12.6256 6.74991 13.0224 6.74995 13.4553 6.75L14.75 6.75001V5.45526C14.75 5.02245 14.7499 4.62561 14.7933 4.3028C14.8411 3.94732 14.9535 3.57159 15.2626 3.26257C15.5716 2.95355 15.9473 2.8411 16.3028 2.79331C16.6256 2.74991 17.0224 2.74995 17.4553 2.75H18.5448Z"/>',
 lanes:'<path fill="currentColor" d="M16.3892 7.24988C17.1028 7.24885 17.7021 7.24799 18.2372 7.5205C18.533 7.67115 18.764 7.87727 18.9801 8.11548C19.1832 8.33928 19.4027 8.62576 19.6589 8.96004C19.8737 9.24025 20.329 9.83418 20.4696 10.0718C20.6261 10.3364 20.75 10.637 20.75 11C20.75 11.363 20.6261 11.6636 20.4696 11.9282C20.329 12.1658 19.8737 12.7598 19.6589 13.04C19.4027 13.3743 19.1832 13.6607 18.9801 13.8845C18.764 14.1227 18.533 14.3289 18.2372 14.4795C17.7021 14.752 17.1028 14.7512 16.3891 14.7501L15 14.75C14.5858 14.75 14.25 14.4142 14.25 14V8.00001C14.25 7.5858 14.5858 7.25001 15 7.25001L16.3892 7.24988Z"/><path fill="currentColor" d="M10.2067 2.00025L7.61085 2.00012C6.89723 1.99909 6.29793 1.99823 5.7628 2.27074C5.46698 2.4214 5.23601 2.62751 5.01987 2.86572C4.81681 3.08952 4.59726 3.376 4.34107 3.71028C4.12626 3.99048 3.67099 4.58442 3.53044 4.82204C3.37392 5.08663 3.25 5.38727 3.25 5.75025C3.25 6.11323 3.37392 6.41387 3.53044 6.67846C3.67099 6.91608 3.87074 7.17663 4.08555 7.45684C4.34174 7.79112 4.81681 8.41098 5.01987 8.63478C5.23601 8.87299 5.46698 9.0791 5.7628 9.22976C6.29793 9.50227 6.89723 9.50141 7.61085 9.50038L11 9.50029L11.0001 20.9737C11.0001 21.5405 11.4478 22 12.0001 22C12.5524 22 13.0001 21.5405 13.0001 20.9737L13 3.27656C13 2.70974 12.5894 2.04475 11.2783 2.04475C11.2783 2.04475 10.6003 2.00018 10.2067 2.00025Z"/><path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" d="M8 21C8 20.4477 8.44772 20 9 20H15C15.5523 20 16 20.4477 16 21C16 21.5523 15.5523 22 15 22H9C8.44772 22 8 21.5523 8 21Z"/>',
 result:'<path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
 crashed:'<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
 default:'<path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" fill="currentColor"/>'};
const detailIcon=(label,lost=false)=>{const key=String(label||'').toLowerCase();const name=key.includes('wager')||key.includes('stake')?'wager':key.includes('multipl')||key==='x'?'multiplier':key.includes('prize')||key.includes('payout')||key.includes('win')?'prize':key.includes('result')?(lost?'crashed':'result'):key.includes('difficult')||key.includes('risk')||key.includes('level')?'difficulty':key.includes('lane')||key.includes('step')||key.includes('cross')?'lanes':'default';
 return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+DETAIL_ICONS[name]+'</svg>'};
const fitStake=(node,text)=>{node.dataset.fit=text.length>4?'long':text.length>2?'mid':'short'};
// The player stakes coins and is paid in the currency: the bet, the presets and the amount on
// PLAY are coin amounts, CASH OUT and every payout stay money(). A PLAY subtitle is either an
// amount or a label (NEXT FRUIT, GO); a number is an amount, and so is the dollar string the
// ports still hand over, which the kit reads back into one.
const amountOf=v=>typeof v==='number'?v:(m=>m?Number(m[1]):NaN)(/^\$?(\d+(?:\.\d+)?)(?:\s+[A-Z]{2,4})?$/.exec(String(v??'').trim()));
const coinSlot=(node,v)=>{const n=amountOf(v);const amount=Number.isFinite(n);node.classList.toggle('coin-amount',amount);const text=amount?coinAmount(n):String(v??'');if(node.textContent!==text)node.textContent=text};
// Pixel crop origins of the six painted circles in the 1536 x 1024 atlas.
// The artwork is not an evenly spaced 3 x 2 grid; its second row sits higher.
const avatarCrops=[[25,11],[537,10],[1045,10],[26,489],[530,489],[1045,490]];
const avatar=(name,players=[])=>{const i=name==='You'?2:players.indexOf(name),[x,y]=avatarCrops[i]||avatarCrops[5];return '<span class="avatar" role="img" aria-label="'+esc(name)+'" style="--avatar-x:'+(x/(1536-464)*100)+'%;--avatar-y:'+(y/(1024-464)*100)+'%"></span>'};
// Three things can stop a round, and each is said plainly: the balance is short, the
// connection is gone, or something else went wrong. Anything the server says beyond that
// belongs in the console, not in front of a player.
const NOTICES={
 funds:{title:'Not enough funds',text:'Your balance is too low for this bet. Top up to keep playing.',cta:'Deposit',intent:'deposit'},
 offline:{title:'No connection',text:'You seem to be offline. Check your connection and try again.',cta:'Try again',intent:'retry'},
 error:{title:'Something went wrong',text:'We could not reach the game just now. Try again in a moment.',cta:'Try again',intent:'retry'},
 // Not a failure: the balance itself opens this one.
 wallet:{title:'Top up your balance',text:'Add funds in your wallet, then come back to the round.',cta:'Go to wallet',intent:'deposit',mark:'funds'}};
const button=(action,text,cls='')=>'<button type="button" class="button '+cls+'" data-action="'+action+'">'+text+'</button>';
// Betting feedback belongs to the UI; the cashout-ready tone plays once per round, not on every re-enable between steps.
class BettingSound {
 constructor(overrides={}){this.enabled=false;this.last=-Infinity;this.next=0;this.pools={};this.plan={...overrides};
  for(const [name,volume] of [['click.ogg',0.14],['confirm.ogg',0.12]])this.pool(name,volume);
  this.pressedGo=-1e9;soundLevels.then(plan=>{this.plan={...plan,...overrides}});}
 // One pool per file, so eleven events that share a take share three clips rather than forty.
 // A pool is built when its file is first played, inside that press, rather than for every
 // take in the plan at load: a phone pays for each media element it holds, played or not.
 pool(file,volume){
  const have=this.pools[file];
  if(have)return have
  return this.pools[file]=Array.from({length:3},()=>{const clip=new Audio(/^https?:/.test(file)?file:base+'assets/audio/'+file);clip.preload='auto';clip.preservesPitch=false;clip.volume=Number.isFinite(volume)?volume:0.14;return clip});
 }
 // Games differ in when cashing out becomes possible: after the first hop in Goat Road, at
 // once in Fish Master. When it arrives on the press itself the chime would only double the
 // play sound, and the button has already changed under the finger, so it is skipped.
 updateCashReady(state){
  const active=!!state.canCash&&(!!state.showCash||goIsCash(state))&&!state.win;
  const round=state.game+':'+state.rounds;
  const onThePress=performance.now()-this.pressedGo<BettingSound.PRESS_WINDOW_MS;
  if(this.game===state.game&&this.cashReady===false&&active&&this.chimedRound!==round){
   // Road readiness follows landing, even when a fast API and hop take under 400ms.
   if(state.game==='road'||!onThePress)this.play('cash-ready');
   this.chimedRound=round;
  }
  this.game=state.game;this.cashReady=active;
 }
 // Pausing a media element is not free on a phone - iOS goes through the audio session for
 // every call - so only a clip that is actually playing is ever paused, and only on the switch.
 setEnabled(value){if(this.enabled===value)return;this.enabled=value;if(!value)for(const pool of Object.values(this.pools))for(const clip of pool)if(!clip.paused)clip.pause()}
 // What the player pressed, named as the manifest names it.
 // How close to the PLAY press a cash-ready state still counts as part of that press.
 static PRESS_WINDOW_MS=400;
 static EVENTS={go:'play',cash:'cashout',min:'stake_min',max:'stake_max',minus:'stake_minus',plus:'stake_plus',preset:'stake_preset',auto:'auto',difficulty:'difficulty',chooseDifficulty:'difficulty',pickDifficulty:'difficulty_pick',leave:'header_click',account:'header_click',menu:'header_click',wallet:'header_click',notice:'confirm',noticeDismiss:'click','cash-ready':'cash_ready'};
 play(action){
  if(!this.enabled||document.hidden)return;
  const event=BettingSound.EVENTS[action];if(!event)return;
  const ready=event==='cash_ready';
  const now=performance.now();if(!ready&&now-this.last<55)return;if(!ready)this.last=now;
  if(action==='go')this.pressedGo=now;
  const spec=this.plan[event];
  const file=spec&&spec.file?spec.file:(ready?'confirm.ogg':'click.ogg');
  if(spec&&spec.volume===0)return;
  const pool=this.pool(file,spec&&Number.isFinite(spec.volume)?spec.volume:undefined);
  const clip=pool[this.next++%pool.length];clip.currentTime=0;if(spec&&Number.isFinite(spec.volume))clip.volume=spec.volume;
  // Without a take of their own the steps keep the pitch that told them apart.
  const own=spec&&spec.file&&spec.file!=='click.ogg';
  const spread=1+(Math.random()*2-1)*(spec&&spec.jitter||0);
  clip.playbackRate=(own?1:action==='minus'?0.92:action==='plus'?1.08:1)*spread;
  clip.play().catch(()=>{});
 }
 destroy(){this.setEnabled(false);for(const pool of Object.values(this.pools))for(const clip of pool){clip.removeAttribute('src');clip.load()}}
}
// Confetti announces the popup; coin clinks belong only to the wallet transfer.
class WinSound {
 constructor(){this.clip=new Audio(base+'assets/audio/win-paper-pop.ogg');this.clip.preload='auto';this.clip.volume=0.44;this.transferClip=new Audio(base+'assets/audio/win.ogg');this.transferClip.preload='auto';this.transferClip.volume=0.20;this.enabled=false;this.active=false;this.jitter={};this.clip.preservesPitch=false;soundLevels.then(plan=>{const pick=(id,clip,fallback)=>{const spec=plan[id];if(!spec)return;if(spec.file&&spec.file!==fallback)clip.src=base+'assets/audio/'+spec.file;if(Number.isFinite(spec.volume))clip.volume=spec.volume;this.jitter[id]=spec.jitter||0};pick('win',this.clip,'win-paper-pop.ogg');pick('win_transfer',this.transferClip,'win.ogg')})}
 // This runs on every published state, many times a second: it must not touch the clips
 // unless something has actually changed, or the phone spends the round in the audio session.
 update(state){this.enabled=state.settings?.sound===true;if(!this.enabled){if(!this.clip.paused)this.clip.pause();if(!this.transferClip.paused)this.transferClip.pause()}const active=!!state.win;if(state.game==='road'&&!this.clip.paused)this.clip.pause();if(state.game!=='road'&&this.game===state.game&&active&&(!this.active||(state.winId!==undefined&&state.winId!==this.winId)))this.play();this.game=state.game;this.active=active;this.winId=state.winId}
 spread(id){const j=this.jitter[id]||0;return 1+(Math.random()*2-1)*j}
 play(){if(!this.enabled||document.hidden)return;this.clip.currentTime=0;this.clip.playbackRate=this.spread('win');this.clip.play().catch(()=>{})}
 playTransfer(){if(!this.enabled||document.hidden)return;this.transferClip.currentTime=0;this.transferClip.playbackRate=1.12*this.spread('win_transfer');this.transferClip.preservesPitch=false;this.transferClip.play().catch(()=>{})}
 destroy(){this.transferClip.pause();this.transferClip.removeAttribute('src');this.transferClip.load();this.clip.pause();this.clip.removeAttribute('src');this.clip.load()}
}
// Levels tuned in Crash Composer → Sound Studio (assets/audio/sounds.json); built-in levels apply until it loads.
// Each panel event resolves to the take it owns, or to the take its fallback owns, so a
// brand-new event sounds like the base one until somebody records it. Levels come from the
// same manifest; the built-in ones apply until it loads.
function soundPlan(manifest){
 const events=Object.fromEntries((manifest.events||[]).map(e=>[e.id,e]));
 const take=e=>(e&&(e.takes||[]).find(t=>t.enabled!==false))||null;
 const level=e=>e&&e.volume_db!==null&&e.volume_db!==undefined&&Number.isFinite(Number(e.volume_db))?Math.min(1,Math.pow(10,Number(e.volume_db)/20)):null;
 // An event owns its level even with a borrowed take; only null inherits the fallback level.
 const inherited=e=>{let n=e,hops=0,v=level(e);while(v===null&&n&&n.fallback&&hops++<4){n=events[n.fallback];v=level(n)}return v};
 const plan={};
 for(const e of manifest.events||[]){
  let own=e,hops=0,found=take(e);
  while(!found&&own&&own.fallback&&hops++<4){own=events[own.fallback];found=take(own)}
  plan[e.id]={file:found?found.file.split('/').pop():null,volume:found?(inherited(e)??1):0,jitter:Math.min(0.3,Math.max(0,Number(e.pitch_jitter)||0))};
 }
 return plan;
}
const soundLevels=typeof fetch==='function'?fetch(base+'assets/audio/sounds.json'+version,{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(soundPlan).catch(()=>({})):Promise.resolve({});
/**
 * The tabbed controls: a second shape for the same panel, chosen per game with
 * config.controlsVariant='tabbed'. The standard controls are untouched — they stay in the
 * DOM, hidden — so every existing game keeps exactly what it has.
 *
 * Top to bottom: a risk meter and the difficulty row, the wager stepper beside one large
 * action button, and three tabs that open Top bets, My bets and the rules as modals.
 * There are no presets and no Auto switch in this shape; that is the design, not a gap.
 *
 * It reads the game's state; optional `risk` (0..1) fills the risk meter.
 */
class TabbedControls {
 constructor(){
  this.element=document.createElement('section');this.element.className='controls panel tabbed-controls';this.element.setAttribute('aria-label','Bet controls');
  // Supplied tab SVGs; currentColor follows the active brand and selected state.
  const icon=paths=>'<svg class="icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+[paths].flat().map((d,i)=>'<path d="'+d+'" fill="currentColor"'+(i===0?' fill-rule="evenodd" clip-rule="evenodd"':'')+'/>').join('')+'</svg>';
  const trophy="M12 1.99999C13.4661 1.99379 14.9301 2.11052 16.377 2.34765C17.5159 2.53964 18.0845 2.63567 18.5605 3.22167C19.0365 3.80663 19.0109 4.44019 18.9609 5.70604C18.7889 10.055 17.85 15.4858 12.75 15.9658V19.5H14.1797C14.4108 19.5001 14.6348 19.581 14.8135 19.7275C14.9921 19.8741 15.1149 20.0781 15.1602 20.3047L15.3496 21.25H18C18.1989 21.25 18.3896 21.3291 18.5303 21.4697C18.6709 21.6103 18.7499 21.8012 18.75 22C18.75 22.1988 18.6709 22.3896 18.5303 22.5303C18.3896 22.6709 18.1989 22.75 18 22.75H6C5.80109 22.75 5.61038 22.6709 5.46973 22.5303C5.32915 22.3896 5.25 22.1988 5.25 22C5.25006 21.8012 5.32913 21.6103 5.46973 21.4697C5.61037 21.3291 5.80114 21.25 6 21.25H8.65039L8.83984 20.3047C8.88513 20.0781 9.00791 19.8741 9.18652 19.7275C9.36518 19.581 9.58922 19.5001 9.82031 19.5H11.25V15.9658C6.15004 15.4858 5.21206 10.054 5.03906 5.70604C4.98907 4.4402 4.96452 3.80763 5.43945 3.22167C5.91545 2.63567 6.48407 2.53964 7.62305 2.34765C8.74705 2.15765 10.217 1.99999 12 1.99999ZM3.53027 5.54491L3.54004 5.76659C3.60704 7.46439 3.79005 9.45008 4.33691 11.2978L3.54297 10.8584C2.79097 10.4394 2.41403 10.2299 2.20703 9.87792C2.00018 9.52597 2 9.09509 2 8.23534V8.1621C2 7.12022 2.00022 6.59707 2.2832 6.20409C2.51121 5.88823 2.87745 5.7191 3.5293 5.49315L3.53027 5.54491ZM20.4717 5.49315C21.1225 5.7191 21.4888 5.88823 21.7168 6.20409C21.9998 6.59707 22 7.11922 22 8.1621V8.23534C22 9.09509 21.9998 9.52597 21.793 9.87792C21.586 10.2299 21.209 10.4394 20.457 10.8584L19.6641 11.2978C20.2099 9.45007 20.393 7.46439 20.46 5.76659L20.4697 5.54491L20.4717 5.49315Z";
  const receipt="M3 5C3 4.20435 3.31607 3.44129 3.87868 2.87868C4.44129 2.31607 5.20435 2 6 2H18C18.7956 2 19.5587 2.31607 20.1213 2.87868C20.6839 3.44129 21 4.20435 21 5V21C20.9999 21.1883 20.9466 21.3728 20.8462 21.5322C20.7459 21.6916 20.6025 21.8194 20.4327 21.9009C20.2629 21.9824 20.0736 22.0143 19.8864 21.9929C19.6993 21.9715 19.522 21.8977 19.375 21.78L17.446 20.238L15.055 21.832C14.8784 21.9499 14.6688 22.0085 14.4567 21.9993C14.2445 21.9902 14.0408 21.9137 13.875 21.781L12 20.28L10.125 21.78C9.95921 21.9127 9.75549 21.9892 9.54333 21.9983C9.33118 22.0075 9.12162 21.9489 8.945 21.831L6.554 20.237L4.624 21.78C4.47696 21.8974 4.29977 21.971 4.1128 21.9922C3.92584 22.0134 3.73667 21.9815 3.56705 21.9C3.39743 21.8185 3.25424 21.6909 3.15393 21.5317C3.05362 21.3724 3.00027 21.1882 3 21V5ZM8 6C7.73478 6 7.48043 6.10536 7.29289 6.29289C7.10536 6.48043 7 6.73478 7 7C7 7.26522 7.10536 7.51957 7.29289 7.70711C7.48043 7.89464 7.73478 8 8 8H16C16.2652 8 16.5196 7.89464 16.7071 7.70711C16.8946 7.51957 17 7.26522 17 7C17 6.73478 16.8946 6.48043 16.7071 6.29289C16.5196 6.10536 16.2652 6 16 6H8ZM8 10C7.73478 10 7.48043 10.1054 7.29289 10.2929C7.10536 10.4804 7 10.7348 7 11C7 11.2652 7.10536 11.5196 7.29289 11.7071C7.48043 11.8946 7.73478 12 8 12H16C16.2652 12 16.5196 11.8946 16.7071 11.7071C16.8946 11.5196 17 11.2652 17 11C17 10.7348 16.8946 10.4804 16.7071 10.2929C16.5196 10.1054 16.2652 10 16 10H8ZM8 14C7.73478 14 7.48043 14.1054 7.29289 14.2929C7.10536 14.4804 7 14.7348 7 15C7 15.2652 7.10536 15.5196 7.29289 15.7071C7.48043 15.8946 7.73478 16 8 16H12C12.2652 16 12.5196 15.8946 12.7071 15.7071C12.8946 15.5196 13 15.2652 13 15C13 14.7348 12.8946 14.4804 12.7071 14.2929C12.5196 14.1054 12.2652 14 12 14H8Z";
  const doc=["M3.75 3.375C3.75 2.34 4.589 1.5 5.625 1.5H9C9.99456 1.5 10.9484 1.89509 11.6517 2.59835C12.3549 3.30161 12.75 4.25544 12.75 5.25V7.125C12.75 7.62228 12.9475 8.09919 13.2992 8.45083C13.6508 8.80246 14.1277 9 14.625 9H16.5C17.4946 9 18.4484 9.39509 19.1517 10.0983C19.8549 10.8016 20.25 11.7554 20.25 12.75V20.625C20.25 21.66 19.41 22.5 18.375 22.5H5.625C4.59 22.5 3.75 21.66 3.75 20.625V3.375ZM7.71967 14.4697C7.57902 14.6103 7.5 14.8011 7.5 15C7.5 15.1989 7.57902 15.3897 7.71967 15.5303C7.86032 15.671 8.05109 15.75 8.25 15.75H15.75C15.9489 15.75 16.1397 15.671 16.2803 15.5303C16.421 15.3897 16.5 15.1989 16.5 15C16.5 14.8011 16.421 14.6103 16.2803 14.4697C16.1397 14.329 15.9489 14.25 15.75 14.25H8.25C8.05109 14.25 7.86032 14.329 7.71967 14.4697ZM7.71967 17.4697C7.86032 17.329 8.05109 17.25 8.25 17.25H12C12.1989 17.25 12.3897 17.329 12.5303 17.4697C12.671 17.6103 12.75 17.8011 12.75 18C12.75 18.1989 12.671 18.3897 12.5303 18.5303C12.3897 18.671 12.1989 18.75 12 18.75H8.25C8.05109 18.75 7.86032 18.671 7.71967 18.5303C7.57902 18.3897 7.5 18.1989 7.5 18C7.5 17.8011 7.57902 17.6103 7.71967 17.4697Z", "M14.2502 5.24992C14.2519 3.98846 13.7977 2.76888 12.9712 1.81592C14.6445 2.25588 16.1709 3.13239 17.3943 4.3558C18.6177 5.57922 19.4942 7.10563 19.9342 8.77892C18.9812 7.9524 17.7616 7.49817 16.5002 7.49992H14.6252C14.4182 7.49992 14.2502 7.33192 14.2502 7.12492V5.24992Z"];
  this.element.innerHTML=
   '<div class="tabbed-main"><div class="risk" hidden><div class="risk-label">RISK <span data-slot="riskPct"></span></div><div class="risk-meter" aria-hidden="true">'+'<i></i>'.repeat(10)+'</div></div>'+
   '<div class="difficulty-row" role="radiogroup" aria-label="Difficulty"></div>'+
   '<div class="bet-grid">'+
    '<div class="wager"><div class="stake" aria-label="Bet amount">'+button('min','MIN')+button('minus','−')+'<div class="wager-amount"><output class="money coin-amount" data-slot="tbBet"></output></div>'+button('plus','+')+button('max','MAX')+'</div></div>'+
    '<div class="actions">'+button('cash','<span class="action-title">CASH OUT</span><span class="money" data-slot="tbCash"></span>','action cash')+button('go','<span class="money" data-slot="tbGoAmount"></span><span class="action-title" data-slot="tbGoTitle"></span>'+GO_ARROW_SVG,'action go')+'</div>'+
   '</div></div>'+
   '<div class="tabs">'+button('topbets',icon(trophy),'tab')+button('mybets',icon(receipt),'tab')+button('rulesTab',icon(doc),'tab')+'</div>';
  for(const [a,label] of [['topbets','Top bets'],['mybets','My bets'],['rulesTab','Rules']])this.element.querySelector('[data-action='+a+']').setAttribute('aria-label',label);
  this.slots=Object.fromEntries([...this.element.querySelectorAll('[data-slot]')].map(n=>[n.dataset.slot,n]));
  this.tabs=this.q('.tabs');this.tabs.setAttribute('role','navigation');this.tabs.setAttribute('aria-label','Bet panels');
  this.lastDifficulties='';
 }
 q(sel){return this.element.querySelector(sel)}
 text(key,value){if(this.slots[key].textContent!==String(value))this.slots[key].textContent=value}
 /** One flat state object per frame, the same one the standard controls read. */
 sync(s,features){
  const risk=this.q('.risk');const hasRisk=typeof s.risk==='number'&&Number.isFinite(s.risk);risk.hidden=!hasRisk&&s.game!=='road';risk.style.visibility='';
  if(hasRisk){const pct=Math.round(Math.min(1,Math.max(0,s.risk))*100);this.text('riskPct',pct+' %');const lit=Math.round(pct/10);[...this.q('.risk-meter').children].forEach((seg,i)=>{seg.className=i<lit?'on tier-'+(i<3?'low':i<6?'mid':'high'):''})}else{this.text('riskPct','0 %');for(const seg of this.q('.risk-meter').children)seg.className=''}
  const names=s.difficulties||[];const key=JSON.stringify(names);
  if(key!==this.lastDifficulties){this.lastDifficulties=key;this.q('.difficulty-row').innerHTML=names.map((n,i)=>'<button type="button" class="button" role="radio" data-action="pickDifficulty" data-value="'+i+'">'+esc(n)+'</button>').join('')}
  this.q('.difficulty-row').hidden=!features.difficulty||names.length===0;
  for(const b of this.q('.difficulty-row').children){const on=Number(b.dataset.value)===s.difficulty;b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-checked',String(on));b.disabled=!s.canBet}
  this.text('tbBet',coinAmount(s.bet));fitStake(this.slots.tbBet,this.slots.tbBet.textContent);for(const a of ['min','minus','plus','max'])this.q('[data-action='+a+']').disabled=!s.canBet;
  const go=this.q('[data-action=go]');go.disabled=!s.canGo||!!s.win;const asCash=goIsCash(s);go.classList.toggle('cash',asCash);
  const nextLane=s.game==='road'&&s.showCash;coinSlot(this.slots.tbGoAmount,(s.game==='road'&&!s.showCash)?s.bet:(s.goSubtitle||s.bet));this.slots.tbGoAmount.hidden=nextLane;this.slots.tbGoAmount.classList.toggle('is-label',!!s.showCash);this.text('tbGoTitle',s.goTitle||(nextLane?'GO':'BET'));this.slots.tbGoTitle.classList.toggle('go-label',!!nextLane);
  const cash=this.q('[data-action=cash]');cash.hidden=!s.showCash;cash.disabled=!s.canCash||!!s.win;moneySlot(this.slots.tbCash,s.cash);// Only the figure decides whether an amount is long: a leading $ is not a digit, and a
  // plain $1056.82 was being shrunk as if it were a million.
  for(const key of ['tbCash','tbGoAmount'])this.slots[key].classList.toggle('long-amount',(this.slots[key].textContent.match(/\d/g)||[]).length>7);
  for(const t of this.tabs.children)t.disabled=!!s.win;
 }
}
class MultiBetControls {
 constructor(){
  this.element=document.createElement('section');this.element.className='controls panel multi-bet-controls';this.element.setAttribute('aria-label','Three position betting controls');this.cards={};
  for(const [key,name,amount] of [['left','LEFT WINS',5],['main','MAIN CATCH',8],['right','RIGHT WINS',5]]){
   const el=document.createElement('section');el.className='multi-bet';el.setAttribute('aria-label',name);
   el.innerHTML='<div class="bet-quote">'+name+'<strong>1.00×</strong></div><div class="bet-receipt">Choose your stake</div><div class="stake bet-wager"><button type="button" class="button bet-step" data-step="-1" aria-label="Decrease '+name+' stake">−</button><input class="bet-amount money" aria-label="'+name+' stake in dollars" type="number" inputmode="numeric" min="1" max="1000" step="1" value="'+amount+'"><button type="button" class="button bet-step" data-step="1" aria-label="Increase '+name+' stake">+</button></div><button type="button" class="button action bet-action"><span class="action-title">BET</span><span class="money">'+wager(amount)+'</span></button>';
   this.element.append(el);this.cards[key]={el,input:el.querySelector('input'),button:el.querySelector('.bet-action')};
  }
 }
}
class GameUI {
 /** The brands tokens.css carries, by id; the page-level data-brand attribute selects one. Panels and UI only: the game scene is the game's. */
 static get brands(){return CrashTokens.BRANDS}
 static setBrand(name){if(!(name in CrashTokens.BRANDS))name='default';if(name==='default')delete document.documentElement.dataset.brand;else document.documentElement.dataset.brand=name;return name}
 static get brand(){return document.documentElement.dataset.brand||'default'}
 /** Seasonal accent overlay over the brand; '' means none. */
 static get themes(){return CrashTokens.THEMES[GameUI.brand]||{}}
 static setTheme(name){if(!(name in GameUI.themes))name='';if(name)document.documentElement.dataset.theme=name;else delete document.documentElement.dataset.theme;return name}
 static get theme(){return document.documentElement.dataset.theme||''}
 constructor(host,send,config={}){
  this.host=host;this.send=send;this.config=config;GameUI.setBrand(config.brand||new URLSearchParams(location.search).get('brand')||document.documentElement.dataset.brand||'default');GameUI.setTheme(config.theme||new URLSearchParams(location.search).get('theme')||document.documentElement.dataset.theme||'');this.state={};this.modal='';this.lastFocus=null;this.lastWins='';this.lastHistory='';this.bettingSound=new BettingSound(config.soundOverrides);this.winSound=new WinSound();
  if(!instance&&!config.demo)instance=this;
  host.className='crash-ui'+(webp?'':' no-webp');host.innerHTML='<div class="top"><section class="account panel" aria-label="Player and records"><div class="profile"><button class="identity" data-action="account"><span data-slot="avatar"></span><span><strong>You</strong><span class="level" data-slot="level"></span></span></button><button type="button" class="balance" data-action="wallet" aria-label="Balance">'+icon('coin.png')+'<span class="money" data-slot="balance"></span></button><button class="icon-button" data-action="menu" aria-label="Menu">'+icon('menu.svg')+'</button></div><section class="records"><div class="records-heading">'+icon('trophy.svg')+'<span>Your best</span></div><div class="records-line"><span class="money record-value personal" data-slot="personal"></span><div class="record-top"><span class="record-summary-label">Top</span><span class="money record-value" data-slot="top"></span><span class="record-by">by</span><span class="owner-name" data-slot="owner"></span></div></div></section><div class="history" aria-label="Round history"></div></section><section class="winners panel"><div class="wins-head"><strong>Live Wins</strong><span class="online"><span class="dot"></span><span data-slot="online"></span></span><button class="text-button" data-action="wins">See all ›</button></div><div class="wins-list"></div></section></div><div class="bottom"><div class="multiplier"></div><section class="controls panel" aria-label="Bet controls"><div class="settings-row">'+button('auto','<span class="knob" aria-hidden="true"></span><span class="auto-label">Auto</span>','auto')+button('difficulty','<span data-slot="difficulty"></span><svg class="chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 10 8 6 12 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>')+'</div><div class="stake" aria-label="Bet amount">'+button('min','MIN')+button('minus','−')+'<output class="money coin-amount" data-slot="bet"></output>'+button('plus','+')+button('max','MAX')+'</div><div class="presets"></div><div class="actions">'+button('cash','<span class="action-title">CASH OUT</span><span class="money" data-slot="cash"></span>','action cash')+button('go','<span class="action-title"><span data-slot="playIcon"><svg class="icon" viewBox="0 0 44 44" aria-hidden="true"><path d="M14 7.5 C9.5 5 6 7 6 12 V32 C6 37 9.5 39 14 36.5 L34 25.5 C38.5 23 38.5 21 34 18.5 Z" fill="currentColor"/></svg></span><span data-slot="goTitle"></span></span><span class="money" data-slot="goSubtitle"></span>','action go')+'</div></section></div><button class="dev" data-action="dev" hidden>DEV · UI</button><div class="toast" role="status" hidden></div><div class="modal-layer" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="crash-modal-title"><header><h2 id="crash-modal-title"></h2><button class="icon-button" data-action="close" aria-label="Close">'+icon('close.svg')+'</button></header><div class="modal-body"></div></section></div>';
  // A game whose round climbs a fixed table of steps shows them beside the scene. It is the
  // kit's panel, not the game's canvas, so brands and themes reach it like everything else.
  const ladder=document.createElement('section');ladder.className='ladder';ladder.hidden=true;
  ladder.setAttribute('aria-label','Multiplier steps');ladder.innerHTML='<ol class="ladder-list"></ol>';
  host.querySelector('.modal-layer').before(ladder);
  const account=host.querySelector('.account'),history=host.querySelector('.history'),column=document.createElement('div');
  column.className='account-column';account.before(column);column.append(account,history);
  this.slots=Object.fromEntries([...host.querySelectorAll('[data-slot]')].map(n=>[n.dataset.slot,n]));
  host.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)this.action(b.dataset.action,b.dataset.value);else {const control=e.target.closest('.bet-step,.bet-action');if(control&&!control.disabled)this.bettingSound.play(control.dataset.step==='-1'?'minus':control.dataset.step?'plus':'go')}});
  host.addEventListener('change',e=>{if(e.target.dataset.setting==='sound')this.bettingSound.setEnabled(e.target.checked);if(e.target.dataset.setting)this.send('setting',{key:e.target.dataset.setting,value:e.target.type==='checkbox'?e.target.checked:Number(e.target.value)});if(e.target.dataset.flag)this.send('flag',{key:e.target.dataset.flag,value:e.target.checked})});
  this.dismissWinClick=e=>{if(this.modal!=='win')return;e.preventDefault();e.stopImmediatePropagation();this.dismissedWin=true;this.close(false);this.send('dismissWin',{})};document.addEventListener('click',this.dismissWinClick,true);
  host.querySelector('.modal-layer').addEventListener('click',e=>{if(e.target===e.currentTarget&&this.modal!=='win')this.close()});
  this.keyHandler=e=>{if(!this.modal)return;if(e.target.matches?.('[data-action=drawerTab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs=[...e.target.parentElement.children],index=tabs.indexOf(e.target),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;this.action('drawerTab',tabs[next].dataset.value);return;}if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key)&&e.target.matches('[role=radio]')){e.preventDefault();const items=[...e.target.parentElement.querySelectorAll('[role=radio]')];let index=items.indexOf(e.target);index=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'||e.key==='ArrowRight'?1:-1)+items.length)%items.length;items[index].focus();return;}if(e.key==='Escape'&&this.modal!=='win'){e.preventDefault();if(this.betDetail)this.backToBets();else if(this.modal.startsWith('limit:'))this.open('menu');else this.close()}if(e.key==='Tab'&&!this.contextPanel){const items=[...host.querySelectorAll('.modal-layer button,.modal-layer input,.modal-layer select')].filter(n=>!n.disabled&&!n.hidden&&n.getClientRects().length);if(!items.length){e.preventDefault();return}const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};
  document.addEventListener('keydown',this.keyHandler);
  this.outsideMenu=e=>{if(['menu','account'].includes(this.modal)&&this.tabbed&&!this.q('.modal').contains(e.target)&&!this.q('.profile [data-action='+this.modal+']').contains(e.target))this.close(false)};
  document.addEventListener('pointerdown',this.outsideMenu,true);
  const embed=new URLSearchParams(location.search);
  if(['standard','tabbed-shell-v1','menu-drawer-v1'].includes(embed.get('preset')))this.config.presentationPreset=embed.get('preset');
  this.embedFlags=Object.fromEntries(['leaderboard','history','personal_record','online_count','multiplier_ladder'].filter(key=>['0','1'].includes(embed.get(key))).map(key=>[key,embed.get(key)==='1']));
  this.embedFeatures=Object.fromEntries(['auto','difficulty','presets'].filter(key=>['0','1'].includes(embed.get(key))).map(key=>[key,embed.get(key)==='1']));
  this.standardControls=this.q('.controls');this.betSettings=this.q('.settings-row');this.setControlsVariant(config.controlsVariant);
  this.resize=new ResizeObserver(()=>this.layout());this.resize.observe(host);this.resize.observe(host.querySelector('.account'));this.resize.observe(column);this.resize.observe(host.querySelector('.controls'));if(this.multiBet)this.resize.observe(this.multiBet.element);
 }
 setPresentationPreset(name='standard'){
  if(!['standard','tabbed-shell-v1','menu-drawer-v1'].includes(name))throw new Error('Unknown presentation preset: '+name);
  if(this.modal)this.close(false);
  this.config.presentationPreset=name;this.setControlsVariant(this.controlsVariant);
  if(this.state.game)this.update(this.state);
 }
 setControlsVariant(variant='standard'){
  if(this.modal)this.close(false);
  this.controlsVariant=variant;
  const tabbed=variant==='tabbed'||['tabbed-shell-v1','menu-drawer-v1'].includes(this.config.presentationPreset);
  this.host.classList.toggle('has-tabbed-controls',tabbed);
  this.host.classList.toggle('has-menu-drawer',this.config.presentationPreset==='menu-drawer-v1');
  const settingsOnly=tabbed&&this.config.presentationPreset!=='menu-drawer-v1',menuButton=this.q('.profile [data-action=menu]');
  menuButton.setAttribute('aria-label',settingsOnly?'Sound':'Menu');
  menuButton.innerHTML=settingsOnly?SPEAKER_SVG:icon('menu.svg');
  this.q('.account').setAttribute('aria-label',tabbed?'Player account':'Player and records');
  let back=this.q('.game-back');
  if(tabbed&&!back){back=document.createElement('button');back.type='button';back.className='icon-button game-back';back.dataset.action='leave';back.setAttribute('aria-label','Back to previous page');back.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4m7-7-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';this.q('.profile').prepend(back)}
  if(back)back.hidden=!tabbed;

  if(tabbed&&!this.tabbed){this.tabbed=new TabbedControls();this.q('.bottom').append(this.tabbed.element);this.resize?.observe(this.tabbed.element)}
  if(!tabbed&&this.tabbed){this.resize?.unobserve(this.tabbed.element);this.tabbed.element.remove();this.tabbed=null}
  if(this.tabbed)this.tabbed.element.classList.toggle('navigation-only',variant!=='tabbed');
  const multi=variant==='three-position';
  if(multi&&!this.multiBet){this.multiBet=new MultiBetControls();this.q('.bottom').append(this.multiBet.element);this.resize?.observe(this.multiBet.element)}
  if(multi)this.multiBet.element.prepend(this.betSettings);
  else this.standardControls.prepend(this.betSettings);
  if(!multi&&this.multiBet){this.resize?.unobserve(this.multiBet.element);this.multiBet.element.remove();this.multiBet=null}
  this.standardControls.hidden=multi||variant==='tabbed';
 }
 q(s){return this.host.querySelector(s)}
 features(){return {auto:true,difficulty:true,presets:true,...(this.state?.features||{})}}
 text(key,value){if(this.slots[key].textContent!==String(value))this.slots[key].textContent=value}
 action(action,value){
  if(action==='go'&&this.winToast)this.finishWinToast();
  // Header back navigation is inactive until the host exit flow is defined.
  if(action==='leave')return;
  this.bettingSound.play(action);
  if(action==='drawerTab'){this.rulesFrom='tab';this.open(value);return}
  if(action==='menu'&&this.config.presentationPreset==='menu-drawer-v1'){if(this.q('.modal-layer').classList.contains('is-menu-drawer')&&this.modal)this.close();else this.open(this.drawerSelection||'topbets');return}
  if(action==='historyDetails'){const entry=this.state.bets?.[Number(value)];if(!entry||this.state.win)return;this.open('mybets');const index=this.betRows?.findIndex(v=>v.time===entry.time&&v.multiplier===entry.multiplier);if(index>=0)this.showBetDetails(index);return}
  if(action==='betDetails'){this.showBetDetails(Number(value));return}
  if(action==='wallet'){this.open('notice:wallet');return}
  if(action==='notice'||action==='noticeDismiss'){
   const intent=action==='noticeDismiss'?'dismiss':(NOTICES[this.noticeKind]||NOTICES.error).intent;
   this.shownNotice=null;this.close();this.send('notice',{kind:this.noticeKind,intent});return}
  if(action==='betsBack'){this.backToBets();return}
  if(['menu','account'].includes(action)&&this.tabbed&&this.modal===action){this.close();return}
  const tabKind=action==='rulesTab'?'rules':action;
  if(['topbets','mybets','rulesTab'].includes(action)&&this.modal===tabKind&&this.q('.modal-layer').classList.contains('is-tab-view')){this.close();return}
  if(['menu','account','wins','difficulty','dev','rules','topbets','mybets'].includes(action)){this.rulesFrom=action==='rules'?'menu':this.rulesFrom;this.open(action);return}
  // The rules tab opens the same modal as the menu's button, but there is no menu to go back to.
  if(action==='rulesTab'){this.rulesFrom='tab';this.open('rules');return}
  // The tabbed row picks a difficulty in place; nothing to close afterwards.
  if(action==='pickDifficulty'){if(this.state?.canBet)this.send('difficulty',{index:Number(value)});return}
  if(action==='close'){this.close();return}
  if(action==='back'){this.open('menu');return}
  if(action==='limit'){this.open('limit:'+value);return}
  if(action==='chooseLimit'){const [key,raw]=JSON.parse(value);const chosen=key==='theme'?raw:Number(raw);this.state.settings={...this.state.settings,[key]:chosen};this.send('setting',{key,value:chosen});this.open('menu');return}
  if(action==='chooseDifficulty'){this.send('difficulty',{index:Number(value)});this.close();return}
  if(action==='refill'){this.send('refill',{});this.close();return}
  if(action==='preset'){this.send('bet',{value:Number(value)});return}
  this.send(action,{});
 }
 update(s){
  s={...s,flags:{...s.flags,...this.embedFlags},features:{...s.features,...this.embedFeatures}};
  window.CrashI18n?.setGame(s.game);
  this.winSound.update(s);
  this.bettingSound.setEnabled(s.settings?.sound===true);
  this.bettingSound.updateCashReady(s);
  const toastWin=s.game==='road'&&s.win&&(!this.state.win||this.state.winId!==s.winId);
  if(toastWin)this.showWinToast(s);
  if(this.state.game&&this.state.game!==s.game)this.finishWinToast();
  this.state=s;currency=typeof s.currency==='string'?s.currency:'';this.host.hidden=false;this.host.classList.toggle('reduced',!!s.settings?.reduced_motion);
  this.text('level',this.tabbed?'#'+String(s.level||'LVL 1').replace(/^LVL\s*/i,''):s.level||'LVL 1');this.text('balance',this.heldWinBalance!==undefined?this.heldWinBalance:s.balanceKnown===false?'—':(window.CrashI18n?.number?window.CrashI18n.number(Number(s.balance||0),{useGrouping:true,minimumFractionDigits:0,maximumFractionDigits:0}):new Intl.NumberFormat('en-US',{useGrouping:true,maximumFractionDigits:0}).format(Number(s.balance||0))));this.text('bet',coinAmount(s.bet));fitStake(this.slots.bet,this.slots.bet.textContent);

  this.text('personal',money(s.personal));this.text('top',money(s.record?.payout));this.text('owner',s.record?.name||'');this.q('.record-top').title=[s.record?.name,s.record?.date].filter(Boolean).join(' · ');
  const signature=JSON.stringify([s.players,s.record?.name]);if(signature!==this.avatarSignature){this.avatarSignature=signature;this.slots.avatar.innerHTML=avatar('You',s.players)}
  this.text('difficulty',s.difficulties?.[s.difficulty]||'Normal');moneySlot(this.slots.cash,s.cash);this.text('goTitle',s.goTitle||'PLAY');coinSlot(this.slots.goSubtitle,(s.game==='road'&&!s.showCash)?s.bet:(s.goSubtitle||s.bet));this.text('online',(s.online||6)+' ONLINE');
  this.q('[data-action=auto]').setAttribute('aria-pressed',String(!!s.auto));
  for(const a of ['auto','difficulty','min','minus','plus','max'])this.q('[data-action='+a+']').disabled=!s.canBet;
  const go=this.q('[data-action=go]');go.disabled=!s.canGo||!!s.win;const asCash=goIsCash(s);go.classList.toggle('cash',asCash);this.slots.playIcon.hidden=asCash;
  const cash=this.q('[data-action=cash]');cash.hidden=!s.showCash;cash.disabled=!s.canCash||!!s.win; // Button visibility never changes the shared control layout.
  const presets=s.presets||[2,3,8,20];const presetKey=JSON.stringify(presets);if(presetKey!==this.lastPresets){this.lastPresets=presetKey;this.q('.presets').innerHTML=presets.map(v=>'<button class="button" data-action="preset" data-value="'+Number(v)+'"><span class="coin-amount">'+esc(coinAmount(v))+'</span></button>').join('')}
  for(const b of this.q('.presets').children){b.disabled=!s.canBet;b.setAttribute('aria-pressed',String(Number(b.dataset.value)===s.bet))}
  const flags=s.flags||{};this.q('.personal').hidden=false;this.q('.record-top').hidden=false;this.q('.records').hidden=!!this.tabbed||flags.personal_record===false;
  this.q('.winners').hidden=!!this.tabbed||flags.leaderboard===false;this.q('.history').hidden=flags.history===false;this.q('.online').hidden=flags.online_count===false;this.q('.dev').hidden=true;
  this.ladder(s.ladder,flags.multiplier_ladder!==false);
  if(this.tabbed)this.tabbed.sync(s,this.features());
  // Operator features remove whole groups; the grid releases their tracks.
  const features=this.features(),controls=this.multiBet?.element||this.standardControls,settingsVisible=features.auto||features.difficulty;
  // On a phone the preset row stays away unless the embed asks for it (?presets=1): the bet stepper is enough there.
  const presetsShown=features.presets&&(!matchMedia('(max-width:'+(CrashTokens.MODAL_PHONE_BREAKPOINT-1)+'px)').matches||new URLSearchParams(location.search).get('presets')==='1');
  this.q('[data-action=auto]').hidden=!features.auto;this.q('[data-action=difficulty]').hidden=!features.difficulty;this.q('.settings-row').hidden=!settingsVisible;this.q('.presets').hidden=!presetsShown;
  controls.classList.toggle('no-settings',!settingsVisible);controls.classList.toggle('auto-only',features.auto&&!features.difficulty);controls.classList.toggle('difficulty-only',features.difficulty&&!features.auto);controls.classList.toggle('no-presets',!presetsShown);
  const featureKey=JSON.stringify(features);if(featureKey!==this.lastFeatures){const changed=this.lastFeatures!==undefined;this.lastFeatures=featureKey;const modal=this.modal||'';if((modal==='difficulty'&&!features.difficulty)||(modal.startsWith('limit:auto')&&!features.auto))this.close();else if(changed&&modal==='menu')this.open('menu')}
  const winsKey=JSON.stringify(s.wins);if(winsKey!==this.lastWins){this.lastWins=winsKey;this.q('.wins-list').innerHTML=this.winRows((s.wins||[]).slice(0,5));if(this.modal==='wins')this.q('.modal-body').innerHTML=this.winRows(s.wins||[])||'<p class=muted>No wins yet.</p>'}
  const histKey=JSON.stringify([s.game,s.history,s.bets?.map(v=>v.time)]);if(histKey!==this.lastHistory){this.lastHistory=histKey;this.q('.history').innerHTML=(s.history||[]).slice(0,15).map((v,i)=>{const value=Number(v.multiplier).toFixed(2)+'×',colour=multiplierColour(v.multiplier,s.game);if(typeof v.cashed_out!=='boolean')return '<span style="color:'+colour+'" class="pill tier-'+tintFor(v.multiplier)+'">'+value+'</span>';const label=v.cashed_out?'Cashed out':'Lost',linked=!!s.bets?.[i],tag=linked?'button':'span';return '<'+tag+(linked?' type="button" data-action="historyDetails" data-value="'+i+'"':'')+' style="color:'+colour+'" class="pill history-result tier-'+tintFor(v.multiplier)+' '+(v.cashed_out?'is-cashout':'is-loss')+'" title="'+label+'" aria-label="'+label+', '+value+'"><span class="history-result-icon" aria-hidden="true">'+(v.cashed_out?'✓':'✕')+'</span><span>'+value+'</span></'+tag+'>'}).join('')}
  this.q('.multiplier').style.setProperty('--multiplier-color',multiplierColour(s.multiplier,s.game));
  this.q('.multiplier').hidden=s.game==='road';this.q('.multiplier').textContent=Number(s.multiplier||1).toFixed(2)+'×';
  this.q('.toast').hidden=!s.toast;this.q('.toast').textContent=s.toast||'';
  if(!s.win||this.dismissedWinId!==s.winId||this.dismissedWinGame!==s.game)this.dismissedWin=false;this.dismissedWinId=s.winId;this.dismissedWinGame=s.game;
  // The game raises a notice; the kit decides how it looks and what it says.
  const notice=typeof s.notice==='string'?s.notice:s.notice?.kind;
  if(notice&&notice!==this.shownNotice){this.shownNotice=notice;this.noticeKind=notice;this.open('notice')}
  else if(!notice){this.shownNotice=null;if(this.modal==='notice'&&this.noticeFromState)this.close()}
  if(s.game!=='road'&&s.win&&!this.dismissedWin&&this.modal!=='win')this.open('win');else if(!s.win&&this.modal==='win')this.close();
  if(this.modal==='win'){const total=this.q('.win-total');if(total)total.textContent=money(s.winAmount);const subtitle=this.q('.win-subtitle');if(subtitle)subtitle.textContent=s.winSubtitle||'Well played!'}
  if(this.modal==='difficulty'&&!s.canBet)this.close();
  const transfer=s.winTransferId||0;
  if(this.lastTransferId!==undefined&&transfer!==this.lastTransferId&&s.win&&s.game!=='road'){this.winSound.playTransfer();requestAnimationFrame(()=>this.flyWinCoins())}
  this.lastTransferId=transfer;
  if(s.settings?.reduced_motion){this.clearWinCoins();if(this.winToast)this.releaseWinBalance()}
  this.standardControls.hidden=!!this.multiBet||this.controlsVariant==='tabbed';
  this.layout();
 }
 showWinToast(s){
  this.finishWinToast();
  this.heldWinBalance=this.slots.balance.textContent;
  this.winBalanceFrom=this.state.balanceKnown===false?null:Number(this.state.balance);
  const toast=document.createElement('div');toast.className='win-toast';toast.setAttribute('role','status');
  const amount=s.winToastAmount??s.winAmount,multiplier=s.history?.[0]?.multiplier;
  // The card sits inside a transparent wrapper so the bloom behind it can show around it.
  // The check flips over into the coin, and only then do the coins set off for the balance.
  toast.style.setProperty('--win-flip-at',WIN_FLIP_AT+'ms');toast.style.setProperty('--win-flip-ms',WIN_FLIP_MS+'ms');
  // Splashes: a dozen drops thrown out from the centre as the card lands, each on its own bearing.
  const splash=Array.from({length:16},(_,i)=>{const a=(i/16)*Math.PI*2+(i%2?.2:0),d=(i%3?120:170);return '<i'+(i%4===3?' class="win-splash-star"':'')+' style="--dx:'+Math.round(Math.cos(a)*d)+'px;--dy:'+Math.round(Math.sin(a)*d*.7)+'px;--win-splash-delay:'+(i%4)*35+'ms">'+(i%4===3?'✦':'')+'</i>'}).join('');
  toast.innerHTML='<span class="win-splash" aria-hidden="true">'+splash+'</span><div class="win-toast-card"><span class="win-flip" aria-hidden="true"><img class="win-mark" src="'+base+'assets/icons/'+pick('cashed-out.webp')+version+'" alt=""><img class="win-coin" src="'+base+'assets/icons/'+pick('coin.png')+'" alt=""></span><div><strong>Cashed out'+(Number.isFinite(multiplier)?' · '+Number(multiplier).toFixed(2)+'×':'')+'</strong><span>+'+money(amount)+'</span></div></div>';
  this.host.append(toast);this.winToast=toast;
  const id=s.winId;
  queueMicrotask(()=>{if(this.state.win&&this.state.winId===id)this.send('dismissWin',{})});
  this.toastFlightTimer=setTimeout(()=>{if(this.winToast!==toast)return;this.winSound.playTransfer();this.flyWinCoins(true)},WIN_FLIP_AT+WIN_FLIP_MS);
  this.toastEndTimer=setTimeout(()=>{if(this.winToast===toast)this.hideWinToast()},WIN_TOAST_MS);
 }
 hideWinToast(){
  const toast=this.winToast;if(!toast)return;
  if(this.state.settings?.reduced_motion||matchMedia('(prefers-reduced-motion: reduce)').matches){this.finishWinToast();return}
  toast.classList.add('is-leaving');
  this.toastHideTimer=setTimeout(()=>{if(this.winToast===toast)this.finishWinToast()},300);
 }
 finishWinToast(){
  clearTimeout(this.toastFlightTimer);clearTimeout(this.toastEndTimer);clearTimeout(this.toastHideTimer);
  if(this.winToast){this.clearWinCoins();this.winToast.remove();this.winToast=null}
  this.heldWinBalance=undefined;
 }
 releaseWinBalance(){
  this.heldWinBalance=undefined;
  const s=this.state;
  this.text('balance',s.balanceKnown===false?'—':new Intl.NumberFormat(window.CrashI18n?.locale==='fr'?'fr-FR':'en-US',{maximumFractionDigits:0}).format(Number(s.balance||0)));
 }
 pulseBalance(){
  if(this.state.settings?.reduced_motion||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  this.balancePulse?.cancel();
  this.balancePulse=this.slots.balance.animate([{transform:'translateY(0) scale(1)'},{transform:'translateY(-2px) scale(1.055)',offset:.3},{transform:'translateY(0) scale(1)'}],{duration:180,easing:'ease-out'});
 }
 clearWinCoins(){
  if(this.coinFrame)cancelAnimationFrame(this.coinFrame);
  this.coinFrame=0;this.coinLayer?.remove();this.coinLayer=null;
 }
 flyWinCoins(toast=false){
  this.clearWinCoins();
  if((toast?!this.winToast:this.modal!=='win')||this.state.settings?.reduced_motion||matchMedia('(prefers-reduced-motion: reduce)').matches){if(toast)this.releaseWinBalance();return;}
  const source=toast?this.winToast?.querySelector('.win-coin'):this.q('.win-coin'),target=this.q('.balance .icon');
  if(!source||!target){if(toast)this.releaseWinBalance();return;}
  const layer=document.createElement('div');layer.className='win-coin-flight';layer.setAttribute('aria-hidden','true');this.host.append(layer);this.coinLayer=layer;
  const coins=Array.from({length:CrashTokens.WEB_WIN_COIN_COUNT},()=>{const coin=document.createElement('img');coin.src=base+'assets/icons/'+pick('coin.png')+version;coin.alt='';layer.append(coin);return coin});
  const speed=Math.max(0.5,Math.min(2,Number(this.config.winCoinSpeed)||1));
  const duration=CrashTokens.WEB_WIN_COIN_DURATION_MS/speed,stagger=CrashTokens.WEB_WIN_COIN_STAGGER_MS/speed;
  const arrived=new Set();
  const start=performance.now();
  const tick=now=>{
   if(!source.isConnected||(toast?!this.winToast:this.modal!=='win')||this.state.settings?.reduced_motion||matchMedia('(prefers-reduced-motion: reduce)').matches){this.clearWinCoins();if(toast)this.releaseWinBalance();return}
   // Count only during arrivals, keeping the server-confirmed balance as the target.
   if(toast&&now-start>=duration&&Number.isFinite(this.winBalanceFrom)&&this.state.balanceKnown!==false){
    const progress=Math.min(1,(now-start-duration)/Math.max(1,(coins.length-1)*stagger));
    const value=this.winBalanceFrom+(Number(this.state.balance)-this.winBalanceFrom)*progress;
    if(Number.isFinite(value)){
     this.heldWinBalance=new Intl.NumberFormat(window.CrashI18n?.locale==='fr'?'fr-FR':'en-US',{maximumFractionDigits:0}).format(value);
     this.text('balance',this.heldWinBalance);
    }
   }
   const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
   // The coins take a shallow arc into the balance: a little lift and sway, enough to read as a
   // throw, not so much that they leave the screen on a phone where both sit near the top.
   const lift=40,sway=30;
   coins.forEach((coin,i)=>{
    const p=Math.max(0,Math.min(1,(now-start-i*stagger)/duration));
    if(p===1&&!arrived.has(i)){arrived.add(i);this.pulseBalance()}
    const t=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    const arc=Math.sin(t*Math.PI),x=a.x+a.width/2+(b.x+b.width/2-a.x-a.width/2)*t+sway*Math.sin(i*1.8)*arc;
    const y=a.y+a.height/2+(b.y+b.height/2-a.y-a.height/2)*t-lift*arc;
    coin.style.opacity=String(Math.min(t*10,1)*Math.min((1-t)*10,1));
    coin.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) rotate(${arc*(i%2===0?.5:-.5)}rad) scale(${.8+.4*arc})`;
   });
   if(now-start<duration+(coins.length-1)*stagger)this.coinFrame=requestAnimationFrame(tick);else{this.clearWinCoins();if(toast)this.releaseWinBalance()}
  };
  this.coinFrame=requestAnimationFrame(tick);
 }
 radioOption(action,value,selected,title,description='',reward='',rewardLabel=''){
  return '<button type="button" class="radio-option" role="radio" data-action="'+action+'" data-value="'+esc(value)+'" aria-checked="'+selected+'" tabindex="'+(selected?0:-1)+'"><span class="radio-marker" aria-hidden="true"></span><span class="option-details"><span class="option-title">'+esc(title)+'</span>'+(description?'<span class="option-description">'+esc(description)+'</span>':'')+'</span>'+(reward?'<span class="option-reward"><span class="money">'+esc(reward)+'</span><span class="option-caption">'+esc(rewardLabel)+'</span></span>':'')+'</button>';
 }
 limitOptions(){
  const s=this.state,result={auto_steps:{title:'Cash out after',values:[0,3,5,10,15,20],suffix:s.game==='road'?' steps':s.game==='fruits'?' slices':' sec'},auto_cashout:{title:'Cash out at',values:[0,1.25,1.5,2,3,5,10,20],suffix:'×'}};
  // Only for games whose scene actually repaints: Fuel Run draws painted art layers that a
  // palette no longer touches, so the row offered a choice that changed nothing.
  if(!['road','fuel'].includes(s.game))result.theme={title:s.game==='fruits'?'Atmosphere':'Next session atmosphere',values:s.game==='fish'?['Caribbean','Sunset']:s.game==='fruits'?['Tropical','Sunset']:['Treasure','Market'],suffix:''};
  return result;
 }
 limitText(value,suffix){return value===0?'Off':String(value)+suffix}
 limitRow(key,option){const current=this.state.settings?.[key]??option.values[0];return '<div class="setting"><span>'+esc(option.title)+'</span><button class="button flat-button" data-action="limit" data-value="'+key+'">'+esc(this.limitText(current,option.suffix))+' <span aria-hidden="true">›</span></button></div>'}
 winRows(rows){return rows.map(v=>'<div class="winner">'+avatar(v.name,this.state.players)+'<span class="winner-name">'+esc(v.name)+'</span><span class="win-multiple">'+Number(v.multiplier||1).toFixed(2)+'×</span><span class="money">+'+money(v.payout)+'</span></div>').join('')}
 betTable(kind){
  const top=kind==='topbets',s=this.state;
  const rows=top?[...(s.topBets||s.wins||[])].sort((a,b)=>b.payout-a.payout).slice(0,25):[...(s.bets||[])].sort((a,b)=>b.time-a.time);
  this.betRows=rows.map(v=>({...v}));
  // A stake is counted in coins, a payout in the currency, in the table as on the panel.
  const amount=(v,stake=false)=>Number.isFinite(v)?(stake?'<span class="coin-amount">'+esc(coinAmount(v))+'</span>':esc(money(v))):'—';
  let day='';
  const body=rows.map((v,i)=>{
   const row='<tr class="bet-selectable" data-action="betDetails" data-value="'+i+'">';
   const trigger='<button type="button" class="bet-row-open" data-action="betDetails" data-value="'+i+'" aria-label="View bet details'+(top?' for '+esc(v.name):'')+'">';
   if(top)return row+'<td class="bet-rank">'+(i+1)+'</td><td>'+trigger+'<span class="bet-player">'+avatar(v.name,s.players)+'<span title="'+esc(v.name)+'">'+esc(v.name)+'</span></span></button></td><td>'+amount(v.wager,true)+'</td><td>'+esc(Number(v.multiplier).toFixed(2))+'×</td><td class="bet-prize">'+amount(v.payout)+'</td></tr>';
   const date=new Date(v.time),key=date.toDateString();let heading='';
   if(key!==day){day=key;heading='<tr class="bet-day"><th colspan="3" scope="rowgroup">'+'<time data-date-only datetime="'+date.toISOString()+'">'+esc(date.toLocaleDateString(window.CrashI18n?.locale==='fr'?'fr-FR':'en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'}))+'</time>'+'</th></tr>'}
   return heading+row+'<td>'+trigger+'<time datetime="'+date.toISOString()+'">'+esc(date.toLocaleTimeString(window.CrashI18n?.locale==='fr'?'fr-FR':'en-US',{hour:'numeric',minute:'2-digit'}))+'</time></button></td><td>'+amount(v.wager,true)+'</td><td class="bet-prize">'+(v.payout>0?amount(v.payout):'—')+'</td></tr>';
  }).join('');
  return '<table class="bets-table '+(top?'top-bets':'my-bets')+'"><caption class="bet-caption">'+(top?'Top bets':'My bets')+'</caption><thead><tr>'+(top?'<th scope="col" class="bet-rank">#</th>':'')+'<th scope="col">'+(top?'Players':'Time')+'</th><th scope="col">Wager</th>'+(top?'<th scope="col">X</th>':'')+'<th scope="col">Prize</th></tr></thead><tbody>'+body+'</tbody></table>'+(!rows.length?'<p class="bets-empty">No bets yet.</p>':'');
 }
 clearBetDetails(){this.betDetail=null;this.q('.modal').classList.remove('is-bet-detail');this.q('[data-action=betsBack]')?.remove()}
 showBetDetails(index){
  if(this.state.win||!['topbets','mybets'].includes(this.modal)||!this.betRows?.[index]||this.betDetail)return;
  const entry={...this.betRows[index]},body=this.q('.modal-body');
  this.betDetail={html:body.innerHTML,scroll:body.scrollTop,title:this.q('.modal h2').textContent,index};
  const name=entry.name||'You',value=(n,stake=false)=>Number.isFinite(n)?stake?esc(wager(n)):moneyHtml(n):'—';
  const multiplier=Number.isFinite(entry.multiplier)?entry.multiplier:entry.payout>0&&entry.wager>0?entry.payout/entry.wager:null;
  const date=new Date(entry.time),hasDate=Number.isFinite(entry.time)&&!Number.isNaN(date.getTime());
  // One row per figure: an icon tile, the label, the value. The icons are keyed by the label the
  // game sends, so a game's own labels still get a tile; a label the kit does not know gets a dot.
  const row=(label,text,cls='',coins=false)=>'<div class="bet-detail-row'+(cls?' '+cls:'')+'"><span class="bet-detail-icon">'+detailIcon(label)+'</span><span class="bet-detail-label">'+label+'</span><strong'+(coins?' class="coin-amount"':'')+'>'+text+'</strong></div>';
  const tile=(label,text,cls='',lost=false)=>'<div class="bet-detail-tile'+(cls?' '+cls:'')+'"><span class="bet-detail-icon">'+detailIcon(label,lost)+'</span><span><strong>'+text+'</strong><span class="bet-detail-label">'+label+'</span></span></div>';
  this.q('.modal').classList.add('is-bet-detail');this.q('.modal h2').textContent='Bet details';
  const back=document.createElement('button');back.type='button';back.className='icon-button bet-detail-back';back.dataset.action='betsBack';back.setAttribute('aria-label','Back to '+this.betDetail.title);
  back.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4m7-7-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  this.q('.modal header').prepend(back);
  // The cup marks a place on the leaderboard: another player's winning bet, not one of your own.
  const extras=entry.details?.length?entry.details:[{label:'RESULT',value:entry.payout>0?'Won':'Lost'}];
  const [result,...rest]=extras[0]&&/result/i.test(extras[0].label)?extras:[null,...extras];
  // One page for every bet: a hero, a title, the date, the figures. A leaderboard bet is somebody
  // (their face, a cup if it won, their name); your own bet is an outcome (the medal or the coins,
  // Prize or Wager), and then no result card below, since the hero has already said it.
  const mine=this.modal!=='topbets',won=entry.payout>0;
  // The same size of disc for every bet: a player's face, or the medal / the coins in a glow.
  const hero=mine?'<div class="bet-detail-outcome '+(won?'is-won':'is-lost')+'">'+icon(won?'outcome-won.webp':'outcome-lost.webp')+'</div>':'<div class="bet-detail-avatar">'+avatar(name,this.state.players)+'<span class="bet-detail-rank">'+(won?icon('trophy-badge.webp'):'')+'<b>#'+(index+1)+'</b></span></div>';
  body.innerHTML='<div class="bet-detail-hero">'+hero+'</div><h3 class="bet-detail-title">'+(mine?(won?'Prize':'Wager'):esc(name))+'</h3>'+(hasDate?'<p class="bet-detail-date"><time datetime="'+date.toISOString()+'">'+esc(date.toLocaleString(window.CrashI18n?.locale==='fr'?'fr-FR':'en-GB',{weekday:'long',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'}))+'</time></p>':'')
   +'<div class="bet-detail-list">'+row('WAGER',Number.isFinite(entry.wager)?esc(coinAmount(entry.wager)):'—','',Number.isFinite(entry.wager))+row('MULTIPLIER',multiplier!==null?esc(multiplier.toFixed(2))+'×':'—')+row('PRIZE',value(entry.payout),'is-prize')+'</div>'
   +(result&&!mine?tile(esc(result.label),esc(result.value),'bet-detail-result'+(won?' is-won':' is-lost'),!won):'')
   +(rest.length?'<div class="bet-detail-extras">'+rest.map(d=>tile(esc(d.label),esc(d.value))).join('')+'</div>':'');
  body.scrollTop=0;back.focus();
 }
 backToBets(){
  if(!this.betDetail)return;const previous=this.betDetail;this.clearBetDetails();
  this.q('.modal h2').textContent=previous.title;const body=this.q('.modal-body');body.innerHTML=previous.html;
  body.querySelector('button[data-value="'+previous.index+'"]')?.focus({preventScroll:true});body.scrollTop=previous.scroll;
 }
 open(kind){
  // Composer opens a notice to read it: `notice:funds` picks which of the three to show.
  if(kind.startsWith('notice')){this.noticeKind=kind.slice(7)||this.noticeKind||'error';this.noticeFromState=!kind.includes(':');kind='notice'}
  const s=this.state,f=this.features();if(kind==='difficulty'&&(!s.canBet||!f.difficulty))return;if(kind.startsWith('limit:auto')&&!f.auto)return;if(s.win&&kind!=='win')return;
  const drawer=this.config.presentationPreset==='menu-drawer-v1'&&['menu','topbets','mybets','rules'].includes(kind);if(drawer){this.drawerSelection=kind;this.rulesFrom='tab'}
  this.clearBetDetails();
  if(!this.modal)this.lastFocus=document.activeElement;this.modal=kind;this.send('modal',{open:true});
  const layer=this.q('.modal-layer');layer.hidden=false;layer.classList.toggle('is-win',kind==='win');layer.classList.toggle('is-menu-drawer',drawer);layer.classList.toggle('is-menu-popover',!drawer&&['menu','account'].includes(kind)&&!!this.tabbed);layer.classList.toggle('is-account-popover',kind==='account'&&!!this.tabbed);
  // From the tabbed variant's side buttons these open as a sheet from the right on a wide
  // screen (the CSS decides the breakpoint); the same modal from the menu stays a popup.
  layer.classList.toggle('is-sheet',!drawer&&!!this.tabbed&&(kind==='topbets'||kind==='mybets'||(kind==='rules'&&this.rulesFrom==='tab')));this.q('.modal').classList.toggle('win-modal',kind==='win');
  this.q('.modal h2').textContent={notice:NOTICES[this.noticeKind]?.title||NOTICES.error.title,menu:'Menu',account:'Your account',wins:'Live Wins',difficulty:'Choose difficulty',rules:'How to play',dev:'Visible panels',win:'NICE WIN!',topbets:'Top bets',mybets:'My bets'}[kind];
  this.q('[data-action=close]').hidden=kind==='win'&&!this.config.demo;
  const body=this.q('.modal-body');body.classList.toggle('rules-content',kind==='rules');
  if(kind==='difficulty'){
   const content=s.difficultyContent||{};
   body.innerHTML='<p class="modal-description">'+esc(content.description||'Higher risk. Bigger rewards.')+'</p><p class="modal-note">'+esc(content.limits||'')+'</p><div class="option-list" role="radiogroup" aria-label="Difficulty">'+(content.options||[]).map((v,i)=>this.radioOption('chooseDifficulty',i,i===s.difficulty,v.title,v.description,v.reward,v.rewardLabel)).join('')+'</div>';
  }
  if(kind==='menu'&&this.tabbed){body.innerHTML=(this.config.menuSettings||['sound','music','haptics']).map(k=>'<label class="setting">'+({sound:'Sound',music:'Music',haptics:'Vibration'}[k])+'<input class="switch" type="checkbox" role="switch" data-setting="'+k+'" '+(s.settings?.[k]?'checked':'')+'></label>').join('')+(this.config.refill!==false&&this.state?.refill!==false?button('refill','Refill to $1,000','flat-button'):'')}
  if(kind==='menu'&&!this.tabbed){
   body.innerHTML=(this.config.menuSettings||['sound','music','haptics']).map(k=>'<label class="setting">'+({sound:'Sound',music:'Music',haptics:'Vibration',reduced_motion:'Reduce motion'}[k])+'<input class="switch" type="checkbox" role="switch" data-setting="'+k+'" '+(s.settings?.[k]?'checked':'')+'></label>').join('');
   const limits=this.limitOptions();
   if(limits.theme)body.innerHTML+=this.limitRow('theme',limits.theme);
   if(f.auto){
    body.innerHTML+='<h3 class="modal-section-title">Auto limits</h3>';
    for(const key of ['auto_steps','auto_cashout'])body.innerHTML+=this.limitRow(key,limits[key]);
    body.innerHTML+='<p class="modal-note"><span>First limit reached cashes out.</span> <span>'+(s.game==='road'?'Auto stops after each round.':'Auto starts the next round until switched off or balance is too low.')+'</span></p>';
   }
   if(this.config.rulesHTML)body.innerHTML+=button('rules','How to play','flat-button');
   if(this.config.refill!==false&&this.state?.refill!==false)body.innerHTML+=button('refill','Refill to $1,000','flat-button');
   body.innerHTML+='<p class="modal-note centered">'+esc(this.config.menuNote||'Progress saved on this device')+'</p>';
  }
  if(kind==='rules')body.innerHTML=(this.rulesFrom==='tab'?'':'<button class="text-button back-button" data-action="back">← Back to menu</button>')+(this.config.rulesHTML||'<p class=muted>No rules provided.</p>');
  if(kind==='topbets'||kind==='mybets')body.innerHTML=this.betTable(kind);
  if(kind.startsWith('limit:')){
   const key=kind.slice(6),option=this.limitOptions()[key];
   this.q('.modal h2').textContent=option.title;
   body.innerHTML='<button class="text-button back-button" data-action="back">← Back to menu</button><div class="option-list" role="radiogroup" aria-label="'+esc(option.title)+'">'+option.values.map(v=>this.radioOption('chooseLimit',JSON.stringify([key,v]),String(s.settings?.[key]??option.values[0])===String(v),this.limitText(v,option.suffix))).join('')+'</div>';
  }
  if(kind==='account'){
   body.innerHTML='<div class="account-summary">'+avatar('You',s.players)+'<div><p>You · Level '+(1+Math.floor((s.xp||0)/10))+'</p><p class="modal-note">'+((s.xp||0)%10)+' / 10 XP</p></div></div>';
   if(this.tabbed)body.innerHTML='';
   // Winnings are paid in the currency, so a money() figure carries its unit and never the coin.
   const row=(k,v,tone='')=>'<div class="setting"><span>'+esc(k)+'</span><strong class="account-stat '+tone+'">'+esc(v)+'</strong></div>';
   body.innerHTML+=row('Balance',s.balanceKnown===false?'Not provided by API':money(s.balance,0))+row('Personal record',money(s.personal),'gold')+'<h3 class="modal-section-title">This session</h3>'+row('Completed rounds',s.rounds||0)+row('Successful cash outs',s.roundWins||0,'success')+row('Best cashed-out multiplier',s.roundWins?Number(s.bestMultiplier||0).toFixed(2)+'×':'—','gold');
   if(this.tabbed){
    const stat=(label,value,tone='',wide=false)=>'<div class="account-session-stat'+(wide?' account-session-wide':'')+'"><span>'+label+'</span><strong class="'+tone+'">'+esc(value)+'</strong></div>';
    body.innerHTML='<div class="account-record-card"><span class="account-record-label"><span>Personal record</span></span><strong>'+esc(money(s.personal))+'</strong></div><h3 class="modal-section-title">This session</h3><div class="account-session-grid">'+stat('Completed rounds',s.rounds||0)+stat('Successful cash outs',s.roundWins||0,'success')+stat('Best cashed-out multiplier',s.roundWins?Number(s.bestMultiplier||0).toFixed(2)+'×':'—','gold',true)+'</div>';
   }

  }
  if(kind==='notice'){
   const notice=NOTICES[this.noticeKind]||NOTICES.error,deposit=notice.intent==='deposit'&&s.canDeposit!==false;
   // The mark, the one line, the one button: read top to bottom without a heading bar.
   body.innerHTML='<div class="notice">'
    +'<span class="notice-mark" aria-hidden="true">'+icon('notice-'+(notice.mark||this.noticeKind||'error')+'.webp')+'</span>'
    +'<h3 class="notice-title">'+esc(notice.title)+'</h3>'
    +'<p class="notice-text">'+esc(notice.text)+'</p>'
    +'<div class="notice-actions">'+button('notice',esc(notice.intent!=='deposit'||deposit?notice.cta:'OK'),'primary-button')
    +(deposit?'<button type="button" class="text-button notice-secondary" data-action="noticeDismiss">Not now</button>':'')
    +'</div></div>';
  }
  if(kind==='wins')body.innerHTML=this.winRows(s.wins||[])||'<p class=muted>No wins yet.</p>';
  if(kind==='dev')body.innerHTML=Object.entries({leaderboard:'Leaderboard / live wins',history:'Round history',personal_record:'My record',online_count:'Online count',...(s.game==='market_stack'?{multiplier_ladder:'Multiplier ladder'}:{})}).map(([k,v])=>'<label class="setting">'+v+'<input class="switch" type="checkbox" role="switch" data-flag="'+k+'" '+(s.flags?.[k]!==false?'checked':'')+'></label>').join('');
  if(kind==='win'){
   body.innerHTML=(this.tabbed?'<div class="win-emblem" aria-hidden="true"><span class="win-spark win-spark-left">✦</span>':'')+'<img class="win-coin" src="'+base+'assets/icons/coin.png'+version+'" alt="">'+(this.tabbed?'<span class="win-spark win-spark-right">✦</span></div>':'')+'<div class="win-total">'+money(s.winAmount)+'</div>'+(this.tabbed?'':'<div class="win-subtitle">'+esc(s.winSubtitle||'Well played!')+'</div>');
   if(!s.settings?.reduced_motion){const fx=document.createElement('div');fx.className='confetti';fx.innerHTML=Array.from({length:32},(_,i)=>'<i style="--angle:'+i*13+'deg;--x:'+((Math.random()-.5)*600)+'px;--y:'+(Math.random()*400-240)+'px"></i>').join('');layer.append(fx);setTimeout(()=>fx.remove(),2000)}
  }
  this.q('.drawer-tabs')?.remove();
  this.q('[data-action=close]').innerHTML=icon('close.svg');
  if(this.tabbed){this.q('[data-action=close]').innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m4 4 16 16M20 4 4 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';}
  const drawerBody=this.q('.modal-body');drawerBody.removeAttribute('role');drawerBody.removeAttribute('aria-labelledby');drawerBody.removeAttribute('id');
  if(drawer){
   const nav=document.createElement('div');nav.className='drawer-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Menu sections');
   nav.innerHTML=[['topbets','Top bets'],['mybets','My bets'],['rules','Rules'],['menu','Settings']].map(([id,label])=>'<button type="button" class="drawer-tab" role="tab" id="drawer-tab-'+id+'" aria-controls="drawer-panel" aria-selected="'+(kind===id)+'" tabindex="'+(kind===id?'0':'-1')+'" data-action="drawerTab" data-value="'+id+'"><span class="drawer-tab-label">'+label+'</span></button>').join('');
   drawerBody.before(nav);drawerBody.id='drawer-panel';drawerBody.setAttribute('role','tabpanel');drawerBody.setAttribute('aria-labelledby','drawer-tab-'+kind);this.q('.modal h2').textContent=kind==='menu'?'Settings':kind==='rules'?'Rules':kind==='topbets'?'Top bets':'My bets';
  }
  const tabView=!drawer&&!!this.tabbed&&['topbets','mybets','rules'].includes(kind)&&(kind!=='rules'||this.rulesFrom==='tab');
  layer.classList.toggle('is-tab-view',tabView);
  layer.classList.toggle('is-rules-panel',tabView&&kind==='rules');
  layer.classList.toggle('is-bets-panel',!!this.tabbed&&['topbets','mybets'].includes(kind));
  const dialog=this.q('.modal');
  for(const node of [layer,dialog]){node.removeAttribute('role');node.removeAttribute('aria-modal');node.removeAttribute('aria-labelledby')}
  const owner=tabView?layer:dialog;owner.setAttribute('role','dialog');owner.setAttribute('aria-modal','true');owner.setAttribute('aria-labelledby','crash-modal-title');
  this.restoreTabs();
  if(tabView){
   const tabs=this.tabbed.tabs;
   const placeholder=document.createElement('div');placeholder.className='tabs-placeholder';placeholder.style.height=getComputedStyle(this.tabbed.element).getPropertyValue('--web-control-comfort-height');this.tabbed.element.append(placeholder);
   tabs.classList.add('modal-footer');
   for(const b of tabs.children){b.disabled=false;b.setAttribute('aria-pressed',String(b.dataset.action===(kind==='rules'?'rulesTab':kind)))}
   layer.append(tabs);
  }
  this.tabPresentation();
  const history=this.q('.history'),historyRect=history.getBoundingClientRect();
  this.host.style.setProperty('--win-toast-top',(historyRect.height>0?historyRect.top-this.host.getBoundingClientRect().top:72)+'px');
  requestAnimationFrame(()=>{const target=drawer?layer.querySelector('[role=tab][aria-selected=true]'):layer.querySelector('button:not([hidden]),input,select');if(target)target.focus({preventScroll:true});else{this.q('.modal').tabIndex=-1;this.q('.modal').focus()}});
 }
 tabPresentation(){
  const layer=this.q('.modal-layer');
  const contextual=!!this.modal&&layer.classList.contains('is-tab-view')&&innerWidth>=CrashTokens.CRASH_MEDIUM_BREAKPOINT;
  const menuPopover=!!this.modal&&layer.classList.contains('is-menu-popover');
  this.contextPanel=contextual||menuPopover;layer.classList.toggle('is-context-panel',contextual);
  const menu=this.q('.profile [data-action=menu]');
  menu.setAttribute('aria-expanded',String(this.modal==='menu'||!!this.modal&&layer.classList.contains('is-menu-drawer')));menu.setAttribute('aria-haspopup','dialog');
  if(layer.classList.contains('is-menu-drawer')){const rect=menu.getBoundingClientRect();layer.style.setProperty('--drawer-menu-top',rect.top+'px');layer.style.setProperty('--drawer-menu-right',(innerWidth-rect.right)+'px')}
  const account=this.q('.profile [data-action=account]');account.setAttribute('aria-expanded',String(this.modal==='account'));account.setAttribute('aria-haspopup','dialog');
  if(menuPopover){
   const rect=(this.modal==='account'?account:menu).getBoundingClientRect();
   const edge=parseFloat(getComputedStyle(this.host).getPropertyValue('--space-8'));
   const width=this.q('.modal').getBoundingClientRect().width;
   // The account card hangs from the row's left edge, as the sound card hangs from its right:
   // both line up with the outermost button, not with the control that opened them.
   const rowLeft=this.q('.profile').getBoundingClientRect().left;
   layer.style.setProperty('--account-anchor-left',Math.max(edge,Math.min(rowLeft,innerWidth-width-edge))+'px');
   layer.style.setProperty('--menu-anchor-bottom',rect.bottom+'px');layer.style.setProperty('--menu-anchor-right',(innerWidth-rect.right)+'px');
   const refill=this.q('.modal [data-action=refill]');if(refill)refill.disabled=this.config.refill===false||this.state.refill===false||this.state.canBet===false;
  }
  const placeholder=this.tabbed?.q('.tabs-placeholder');
  if(placeholder&&innerWidth<CrashTokens.CRASH_MEDIUM_BREAKPOINT){
   const rect=placeholder.getBoundingClientRect();
   for(const key of ['left','top','width','height'])layer.style.setProperty('--tabs-anchor-'+key,rect[key]+'px');
  }

  if(contextual&&innerWidth>=CrashTokens.CRASH_MEDIUM_BREAKPOINT){
   const rail=this.tabbed.tabs.getBoundingClientRect(),controls=(this.controlsVariant==='tabbed'?this.tabbed.element:this.multiBet?.element||this.standardControls).getBoundingClientRect();
   const css=getComputedStyle(this.host),token=name=>parseFloat(css.getPropertyValue(name));
   const gap=token('--space-8'),edge=token('--space-16'),preferred=token('--modal-max-width-px');
   const left=rail.right+gap,beside=controls.left-left-gap;
   // Prefer the free column beside the betting controls. On narrower screens
   // the window may extend above them, but never across their action buttons.
   const fitsBeside=beside>=6*token('--web-control-comfort-height');
   const width=Math.min(preferred,innerWidth-left-edge,fitsBeside?beside:preferred);
   const actions=(this.controlsVariant==='tabbed'?this.tabbed.q('.actions'):this.multiBet?.element||this.standardControls.querySelector('.actions')).getBoundingClientRect();
   const bottom=fitsBeside?innerHeight-edge:Math.min(innerHeight-edge,actions.top-gap);
   // One height cap across desktop and intermediate layouts; scroll the content.
   const height=Math.min(preferred+2*token('--space-48'),bottom-edge);
   // Clamp the window independently; the navigation stays at the viewport centre.
   const top=Math.max(edge,Math.min((innerHeight-height)/2,bottom-height));
   for(const [key,value] of Object.entries({left,top,width,height}))layer.style.setProperty('--tab-window-'+key,value+'px');
  }

  const owner=layer.hasAttribute('role')?layer:this.q('.modal');owner.setAttribute('aria-modal',String(!this.contextPanel));
  for(const n of [this.q('.top'),this.q('.bottom'),this.q('.dev')])n.inert=!!this.modal&&!this.contextPanel;
 }
 restoreTabs(){if(!this.tabbed)return;this.tabbed.q('.tabs-placeholder')?.remove();const tabs=this.tabbed.tabs;tabs.classList.remove('modal-footer');for(const b of tabs.children)b.removeAttribute('aria-pressed');this.tabbed.element.append(tabs)}
 close(restoreFocus=true){this.q('.profile [data-action=account]').setAttribute('aria-expanded','false');this.q('.profile [data-action=menu]').setAttribute('aria-expanded','false');this.clearBetDetails();this.contextPanel=false;this.restoreTabs();this.clearWinCoins();this.modal='';this.q('.modal-layer').hidden=true;for(const n of [this.q('.top'),this.q('.bottom'),this.q('.dev')])n.inert=false;this.send('modal',{open:false});if(restoreFocus&&this.lastFocus?.isConnected)this.lastFocus.focus()}
 /**
  * The steps of a climbing round, highest at the top. `data` is {steps,current}: the
  * multipliers to show and which of them the round stands on. Steps under the current one
  * are already won, so they carry the accent; the ones above are still to come.
  */
 ladder(data,visible){
  const box=this.q('.ladder');
  const on=visible&&!!data&&Array.isArray(data.steps)&&data.steps.length>0;
  box.hidden=!on;
  if(!on)return;
  const key=JSON.stringify(data);if(key===this.lastLadder)return;this.lastLadder=key;
  box.querySelector('.ladder-list').innerHTML=data.steps.map((value,i)=>
   '<li class="ladder-step'+(i===data.current?' is-current':i>data.current?' is-won':i===data.current-1?' is-before':'')+'">'
   +'<span class="ladder-dot"></span><span class="ladder-value">'+esc(Number(value).toFixed(2))+'\u00d7</span></li>').join('');
 }
 layout(){
  const wide=innerWidth>=CrashTokens.CRASH_LAPTOP_BREAKPOINT;
  const winners=this.q('.winners'),top=this.q('.top'),account=this.q('.account');
  const parent=wide?top:account;if(winners.parentElement!==parent){if(wide)top.append(winners);else account.insertBefore(winners,this.q('.records'))}
  const a=this.q('.account-column').getBoundingClientRect(),b=this.q('.bottom').getBoundingClientRect();
  this.host.style.setProperty('--bet-controls-top',b.top+'px');
  this.tabPresentation();
  const history=this.q('.history'),historyRect=history.getBoundingClientRect();
  this.host.style.setProperty('--win-toast-top',(historyRect.height>0?historyRect.top-this.host.getBoundingClientRect().top:72)+'px');
  this.host.style.setProperty('--dev-top',(Math.max(a.bottom,wide?winners.getBoundingClientRect().bottom:0)+8)+'px');
  // The fishing boat occupies the right side; reserve the taller Live Wins panel too.
  const sceneTop=this.state.game==='gold'?account.getBoundingClientRect().bottom:
   ['fish','catch'].includes(this.state.game)&&wide?Math.max(a.bottom,winners.getBoundingClientRect().bottom):a.bottom;
  const bounds={top:Math.round(sceneTop+12),bottom:Math.round(b.top),width:innerWidth,height:innerHeight};
  this.host.style.setProperty('--scene-top',bounds.top+'px');
  this.host.style.setProperty('--scene-bottom',bounds.bottom+'px');
  const key=JSON.stringify(bounds);if(key!==this.lastBounds){this.lastBounds=key;this.send('layout',bounds)}
 }
 destroy(){this.balancePulse?.cancel();this.finishWinToast();document.removeEventListener('click',this.dismissWinClick,true);this.winSound.destroy();this.bettingSound.destroy();this.clearWinCoins();this.resize.disconnect();document.removeEventListener('keydown',this.keyHandler);document.removeEventListener('pointerdown',this.outsideMenu,true);this.host.remove()}
}
let callback=null,instance=null;
window.CrashUI={presentationPresets:Object.freeze({'menu-drawer-v1':Object.freeze({id:'menu-drawer-v1',title:'Menu tabs',version:1,scope:'header-navigation-windows'}),'tabbed-shell-v1':Object.freeze({id:'tabbed-shell-v1',title:'Bottom tabs',version:1,scope:'header-navigation-windows'})}),GameUI,MultiBetControls,connect(fn){callback=fn;if(!instance){const host=document.createElement('div');host.hidden=true;document.body.append(host);instance=new GameUI(host,(action,data)=>callback?.(JSON.stringify({action,...data})));}return true},receive(state){instance?.update(typeof state==='string'?JSON.parse(state):state)},get instance(){return instance}};
})();
