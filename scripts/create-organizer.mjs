// Run only on a trusted machine. Secrets are taken from the environment and never printed.
const {SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key,ORGANIZER_USERNAME:raw,ORGANIZER_PASSWORD:password,ORGANIZER_NAME:name}=process.env;
const username=(raw||'').toLowerCase();
if(!url||!key||!name||!password||password.length<12||!/^([a-z0-9_.-]){3,40}$/.test(username))throw Error('Set the five required environment variables; password needs at least 12 characters.');
async function call(path,method,body){const r=await fetch(url+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Organizer provisioning failed (HTTP '+r.status+').');return r.status===204?null:r.json();}
const u=await call('/auth/v1/admin/users','POST',{email:username+'@members.varrosuti.invalid',password,email_confirm:true});
try{await call('/rest/v1/members','POST',{id:u.id,username,name,role:'admin',active:true});}catch(e){await call('/auth/v1/admin/users/'+u.id,'DELETE');throw e;}
console.log('Organizer account created.');
