// Usage: node scripts/configure.mjs https://PROJECT.supabase.co PUBLIC_PUBLISHABLE_KEY
// Only public keys may be supplied. A service-role key must never appear in the browser.
import {writeFileSync} from 'node:fs';
const [url,key]=process.argv.slice(2);
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url||''))throw Error('Invalid Supabase URL');
if(!key||key.startsWith('sb_secret_'))throw Error('A public publishable/anon key is required');
if(key.startsWith('eyJ')){let payload;try{payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());}catch{throw Error('Invalid key');}if(payload.role!=='anon')throw Error('Only anon keys may be embedded');}
else if(!key.startsWith('sb_publishable_'))throw Error('Unknown public key format');
writeFileSync(new URL('../docs/config.js',import.meta.url),'// Public project configuration. This is not a secret.\nexport const config = Object.freeze('+JSON.stringify({supabaseUrl:url.replace(/\/$/,''),publishableKey:key})+');\n');
console.log('Public project configuration saved.');
