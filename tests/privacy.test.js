import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
test('Pages contains no private itinerary, demo fallback, PHP, or secret',()=>{
 const names=readdirSync(new URL('docs',root));
 assert(!names.some(n=>/php$|itinerary|private|sqlite|\.sql$/.test(n)));
 const source=names.map(n=>read('docs/'+n)).join('\n');
 for(const word of ['demo-itinerary','service_role','sb_secret_'])assert(!source.includes(word),'Private/secret data in Pages: '+word);
 assert(!/demo\s*=\s*true/.test(source));
 assert(!/\b20\d{2}-\d{2}-\d{2}T/.test(source),'Private departure date bundled');
});
test('closed signup and mutations remain server-side',()=>{
 const edge=read('supabase/functions/community/index.ts');
 assert(edge.includes('db.auth.getUser(token)'));
 assert(edge.includes("if(!user?.active)"));
 assert(edge.indexOf('admin();\n  if(action===\'admin\')')<edge.indexOf("if(action==='createMember')"));
 assert(edge.includes("if(p.user_id!==user.id)admin()"));
 assert(!read('docs/app.js').includes('signUp('));
});
test('Supabase Edge Function parses as TypeScript',async()=>{
 const ts=(await import('typescript')).default;
 const result=ts.transpileModule(read('supabase/functions/community/index.ts'),{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 assert.equal(result.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
});
