import { config } from './config.js';
const KEY='vst-session';
let session=null,refreshing=null;
try{session=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{}
export function configured(){return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl)&&!!config.publishableKey;}
export function clearSession(){session=null;try{sessionStorage.removeItem(KEY);}catch{}}
function save(s){session=s;try{sessionStorage.setItem(KEY,JSON.stringify(s));}catch{}}
async function refresh(){if(!session?.refresh_token)return clearSession();if(refreshing)return refreshing;refreshing=(async()=>{const r=await fetch(config.supabaseUrl+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey},body:JSON.stringify({refresh_token:session.refresh_token})});if(!r.ok){clearSession();return;}const j=await r.json();save({access_token:j.access_token,refresh_token:j.refresh_token,expires_at:j.expires_at||Math.floor(Date.now()/1000)+j.expires_in});})();try{await refreshing;}finally{refreshing=null;}}
export async function api(action,data={}){
 if(!configured())throw Error('Az oldal összekapcsolása még folyamatban van.');
 if(action!=='login'&&session&&session.expires_at*1000<Date.now()+60000)await refresh();
 const r=await fetch(config.supabaseUrl+'/functions/v1/community',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey,...(action!=='login'&&session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify({...data,action})});
 let j;try{j=await r.json();}catch{throw Error('A kiszolgáló válasza nem olvasható.');}
 if(!r.ok||j.error){const e=Error(j.error||'A művelet nem sikerült.');e.status=r.status;if(r.status===401&&action!=='login'){clearSession();window.dispatchEvent(new Event('session-ended'));}throw e;}
 if(action==='login')save(j.session);return j;
}
export function hasSession(){return !!session?.access_token;}
export async function logout(){const old=session;clearSession();if(old&&configured())try{await fetch(config.supabaseUrl+'/auth/v1/logout',{method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+old.access_token}});}catch{}}
