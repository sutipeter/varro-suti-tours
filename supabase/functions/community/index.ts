// All private responses require a verified user AND an active membership.
// SUPABASE_SERVICE_ROLE_KEY is available only in the Edge runtime, never in the site.
import { createClient } from 'npm:@supabase/supabase-js@2';
const url=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
class Problem extends Error { constructor(message:string,public status=400){super(message);} }
function text(v:unknown,max:number){if(typeof v!=='string'||!v.trim()||v.length>max)throw new Problem('Hiányzó vagy túl hosszú mező.');return v.trim();}
function password(v:unknown){if(typeof v!=='string'||v.length<12||v.length>256)throw new Problem('A jelszó 12–256 karakter hosszú legyen.');return v;}
function username(v:unknown){const s=text(v,40).toLowerCase();if(!/^[a-z0-9_.-]{3,40}$/.test(s))throw new Problem('Érvénytelen felhasználónév.');return s;}
function check(error:unknown){if(error){console.error('Database operation failed');throw new Problem('A művelet nem sikerült. Próbáld újra.',500);}}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean);
 const cors:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 if(allowed.includes(origin))cors['Access-Control-Allow-Origin']=origin;
 const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:cors});
 if(origin&&!allowed.includes(origin))return reply({error:'Ez a webcím nincs engedélyezve.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'Nem támogatott kérés.'},405);
 try{
  const raw=await req.text();if(raw.length>18000)throw new Problem('Túl hosszú kérés.',413);
  let input;try{input=JSON.parse(raw);}catch{throw new Problem('Hibás kérés.');}
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Problem('Hibás kérés.');
  const action=input.action;
  if(action==='login'){
   const login=username(input.username);const secret=typeof input.password==='string'?input.password:'';
   if(!secret||secret.length>256)throw new Problem('Hibás felhasználónév vagy jelszó.',401);
   const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serviceKey+':'+ip));
   const key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   const {data:permitted,error:rateError}=await db.rpc('consume_login_attempt',{p_key:key});check(rateError);
   if(!permitted)throw new Problem('Túl sok próbálkozás. Próbáld újra 15 perc múlva.',429);
   const {data:member,error}=await db.from('members').select('id').eq('username',login).eq('active',true).maybeSingle();check(error);
   // Use a synthetic private address: usernames are not exposed through a public lookup API.
   const auth=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error:authError}=await auth.auth.signInWithPassword({email:login+'@members.varrosuti.invalid',password:secret});
   if(authError||!data.session||!member||member.id!==data.user.id){if(data.session)await auth.auth.signOut();throw new Problem('Hibás felhasználónév vagy jelszó.',401);}
   return reply({session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token,expires_at:data.session.expires_at}});
  }
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!token)throw new Problem('Belépés szükséges.',401);
  const {data:auth,error:authError}=await db.auth.getUser(token);
  if(authError||!auth.user)throw new Problem('A belépés lejárt. Lépj be újra.',401);
  const {data:user,error:memberError}=await db.from('members').select('id,username,name,role,active').eq('id',auth.user.id).maybeSingle();check(memberError);
  if(!user?.active)throw new Problem('A hozzáférésed nincs engedélyezve.',403);
  const admin=()=>{if(user.role!=='admin')throw new Problem('Szervezői jogosultság szükséges.',403);};
  const positiveId=()=>{const n=Number(input.id);if(!Number.isSafeInteger(n)||n<1)throw new Problem('Érvénytelen azonosító.');return n;};
  if(action==='state'){
   const [{data:stops,error:se},{data:page,error:pe}]=await Promise.all([db.from('stops').select('*').order('id'),db.from('site_pages').select('html').eq('id','main').single()]);check(se);check(pe);
   return reply({user,stops,html:page!.html});
  }
  if(action==='password'){
   const {error}=await db.auth.admin.updateUserById(user.id,{password:password(input.password)});check(error);return reply({ok:true});
  }
  if(action==='posts'){
   const {data:posts,error}=await db.from('posts').select('*').order('pinned',{ascending:false}).order('id',{ascending:false}).limit(100);check(error);
   if(!posts?.length)return reply({posts:[]});
   const ids=posts.map(p=>p.id);
   const [{data:members,error:me},{data:comments,error:ce},{data:likes,error:le}]=await Promise.all([db.from('members').select('id,name'),db.from('comments').select('*').in('post_id',ids).order('id'),db.from('likes').select('*').in('post_id',ids)]);check(me);check(ce);check(le);
   const names=new Map(members!.map(m=>[m.id,m.name]));
   return reply({posts:posts.map(p=>({...p,pinned:p.pinned?1:0,name:names.get(p.user_id)||'Résztvevő',created:new Date(p.created).toLocaleString('hu-HU',{timeZone:'Europe/Budapest'}),likes:likes!.filter(l=>l.post_id===p.id).length,liked:likes!.some(l=>l.post_id===p.id&&l.user_id===user.id),comments:comments!.filter(c=>c.post_id===p.id).map(c=>({...c,name:names.get(c.user_id)||'Résztvevő'}))}))});
  }
  if(action==='post'){const {error}=await db.from('posts').insert({user_id:user.id,body:text(input.body,4000)});check(error);return reply({ok:true});}
  if(['comment','like','delete','pin'].includes(action)){
   const id=positiveId();const {data:p,error}=await db.from('posts').select('*').eq('id',id).maybeSingle();check(error);if(!p)throw new Problem('A bejegyzés már nem érhető el.',404);
   if(action==='comment'){const {error}=await db.from('comments').insert({user_id:user.id,post_id:id,body:text(input.body,2000)});check(error);}
   if(action==='like'){const {data:existing,error:ee}=await db.from('likes').select('post_id').eq('post_id',id).eq('user_id',user.id).maybeSingle();check(ee);const {error}=existing?await db.from('likes').delete().eq('post_id',id).eq('user_id',user.id):await db.from('likes').upsert({post_id:id,user_id:user.id});check(error);}
   if(action==='delete'){if(p.user_id!==user.id)admin();const {error}=await db.from('posts').delete().eq('id',id);check(error);}
   if(action==='pin'){admin();const {error}=await db.from('posts').update({pinned:!p.pinned}).eq('id',id);check(error);}
   return reply({ok:true});
  }
  admin();
  if(action==='admin'){const {data:members,error}=await db.from('members').select('id,name,username,active,role').order('created');check(error);return reply({members});}
  if(action==='createMember'){
   const login=username(input.username),name=text(input.name,80),secret=password(input.password);
   const {data,error}=await db.auth.admin.createUser({email:login+'@members.varrosuti.invalid',password:secret,email_confirm:true});
   if(error||!data.user)throw new Problem('A felhasználó nem hozható létre. Lehet, hogy a név már foglalt.');
   const {error:me}=await db.from('members').insert({id:data.user.id,username:login,name,role:'member'});
   if(me){await db.auth.admin.deleteUser(data.user.id);check(me);}return reply({ok:true});
  }
  if(action==='setMemberActive'){
   if(typeof input.memberId!=='string'||typeof input.active!=='boolean')throw new Problem('Érvénytelen kérés.');
   if(input.memberId===user.id)throw new Problem('A saját hozzáférésedet nem tilthatod le.');
   const {data:target,error:te}=await db.from('members').select('role').eq('id',input.memberId).single();check(te);
   if(target!.role==='admin')throw new Problem('Szervező hozzáférése itt nem módosítható.');
   const {error}=await db.from('members').update({active:input.active}).eq('id',input.memberId);check(error);return reply({ok:true});
  }
  if(action==='resetMemberPassword'){
   if(typeof input.memberId!=='string')throw new Problem('Érvénytelen kérés.');
   const {data:target,error:te}=await db.from('members').select('role').eq('id',input.memberId).single();check(te);
   if(target!.role==='admin'&&input.memberId!==user.id)throw new Problem('Másik szervező jelszava itt nem módosítható.');
   const {error}=await db.auth.admin.updateUserById(input.memberId,{password:password(input.password)});check(error);return reply({ok:true});
  }
  if(action==='edit'){
   const {error}=await db.from('stops').update({title:text(input.title,120),meta:text(input.meta,180),body:text(input.body,5000)}).eq('id',positiveId());check(error);return reply({ok:true});
  }
  throw new Problem('Ismeretlen kérés.',404);
 }catch(e){if(e instanceof Problem)return reply({error:e.message},e.status);console.error('Community request failed');return reply({error:'A szolgáltatás átmenetileg nem érhető el.'},500);}
});
