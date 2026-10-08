import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('database rejects anonymous, nonmember, disabled users and member mutations',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;
 grant execute on function auth.uid() to authenticated;`);
 await db.exec(readFileSync(new URL('../supabase/migrations/202610080001_community.sql',import.meta.url),'utf8'));
 const a='11111111-1111-1111-1111-111111111111',m='22222222-2222-2222-2222-222222222222',n='33333333-3333-3333-3333-333333333333';
 await db.query('insert into auth.users values ($1),($2),($3)',[a,m,n]);
 await db.query("insert into public.members(id,username,name,role) values($1,'organizer','Organizer','admin'),($2,'member','Member','member')",[a,m]);
 await db.exec("insert into site_pages values('main','PRIVATE APP'); insert into stops values(1,'14','PRIVATE STOP','','','','');");
 await db.exec('set role anon');
 for(const table of ['members','site_pages','stops','posts','comments','likes'])await assert.rejects(db.query('select * from public.'+table),/permission denied/);
 await db.exec('reset role; set role authenticated');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n]);
 assert.equal((await db.query('select * from site_pages')).rows.length,0);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[m]);
 assert.equal((await db.query('select * from stops')).rows.length,1);
 await assert.rejects(db.query("update members set role='admin' where id=$1",[m]),/permission denied/);
 await assert.rejects(db.query("insert into posts(user_id,body,pinned) values($1,'fake',true)",[m]),/permission denied/);
 await db.exec('reset role');await db.query('update members set active=false where id=$1',[m]);
 await db.exec('set role authenticated');
 assert.equal((await db.query('select * from site_pages')).rows.length,0);
 assert.equal((await db.query('select * from stops')).rows.length,0);
 await db.exec('reset role');
 for(let i=0;i<15;i++)assert.equal((await db.query("select consume_login_attempt('ip') allowed")).rows[0].allowed,true);
 assert.equal((await db.query("select consume_login_attempt('ip') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
