import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const owner='11111111-1111-4111-8111-111111111111';
const reader='22222222-2222-4222-8222-222222222222';
const list=async sql=>(await db.query(sql)).rows;
const use=uid=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${uid}',false);set role authenticated;`);
try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
  create schema auth;create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated,anon;
  insert into auth.users values('${owner}'),('${reader}');`);
  for(const name of ['001_community.sql','004_regional_proposals.sql'])await db.exec(await readFile(new URL('../database/'+name,import.meta.url),'utf8'));
  await db.exec('grant usage on schema travel_private to service_role');
  for(const uid of [owner,reader]){
    await use(uid);
    await db.exec(`insert into travel_profiles(id,display_name) values('${uid}','旅人')`);
  }
  await use(owner);
  const [{id}]=await list(`insert into travel_regional_proposals(author,place,title,story) values('${owner}','氷見','木彫り','冬の海の話') returning id`);
  await assert.rejects(db.exec(`update travel_regional_proposals set state='adopted' where id='${id}'`));
  await use(reader);
  assert.equal((await list('select * from travel_regional_proposals')).length,0);
  assert.equal((await list(`select travel_send_regional_proposal('${id}') sent`))[0].sent,false);
  await use(owner);
  assert.equal((await list(`select travel_send_regional_proposal('${id}') sent`))[0].sent,true);
  await db.exec('reset role; set role service_role');
  for(const expected of [true,false]){
    assert.equal((await list(`select travel_private.adopt_regional_proposal('${id}','himi-wood') adopted`))[0].adopted,expected);
  }
  await use(reader);assert.equal((await list('select * from travel_regional_medals')).length,0);
  await use(owner);assert.equal((await list('select medal from travel_regional_medals'))[0].medal,'local-storyteller');
  console.log('PASS private proposals, explicit submission, editor-only adoption, idempotent author medal.');
}finally{await db.close();}
