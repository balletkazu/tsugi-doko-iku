// Optional PostgreSQL/RLS integration. Set PGLITE_MODULE to the path of an existing installation.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const members=Array.from({length:34},(_,i)=>id(i+1));
const [host,guest,stranger,paid]=members;
const sqlIds=members.map(x=>"('"+x+"')").join(',');
const setUser=async user=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`);
const rows=async sql=>(await db.query(sql)).rows;
const asAdmin=sql=>db.exec('reset role;'+sql);
const join=async(item)=> (await rows(`select travel_join_companion('${item}') ok`))[0].ok;
const makeTrip=async(who,audience='public')=> (await rows(`insert into travel_companion_trips(host,trip_date,area_label,audience)
  values('${who}',(now() at time zone 'Asia/Tokyo')::date,'湖畔','${audience}') returning id`))[0].id;
try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    insert into auth.users values ${sqlIds};`);
  for(const file of ['001_community.sql','002_community_interaction.sql','003_companion_travel.sql'])
    await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'));
  for(const user of members){
    await setUser(user);await db.exec(`insert into travel_profiles(id,display_name) values('${user}','旅人')`);
  }
  await setUser(host);
  const friendTrip=await makeTrip(host,'friends');
  await assert.rejects(db.exec(`update travel_companion_trips set moderation='approved' where id='${friendTrip}'`));
  await assert.rejects(db.exec(`insert into travel_companion_accounts(actor,tier) values('${host}','paid')`));
  await asAdmin(`update travel_companion_trips set moderation='approved' where id='${friendTrip}'`);
  await setUser(guest);assert.equal(await join(friendTrip),false);
  await db.exec(`insert into travel_friendships values('${guest}','${host}')`);
  assert.equal(await join(friendTrip),false);
  await setUser(host);await db.exec(`insert into travel_friendships values('${host}','${guest}')`);
  await asAdmin(`insert into travel_companion_accounts(actor,automatic) values('${guest}',false)`);
  await db.exec('set role service_role');
  assert.equal((await rows(`select travel_private.reserve_companion_seat('${friendTrip}','${guest}','automatic') ok`))[0].ok,false);
  await setUser(guest);
  await db.exec(`update travel_companion_accounts set automatic=true where actor='${guest}'`);
  await db.exec(`insert into travel_companion_reports(trip_id,actor,reason) values('${friendTrip}','${guest}','内容を確認')`);
  await asAdmin('set role service_role;');
  assert.equal((await rows(`select travel_private.reserve_companion_seat('${friendTrip}','${guest}','automatic') ok`))[0].ok,true);
  await setUser(guest);assert.equal(await join(friendTrip),true);
  await assert.rejects(db.exec(`select travel_private.reserve_companion_seat('${friendTrip}','${stranger}','automatic')`));
  await setUser(stranger);assert.equal((await rows('select * from travel_companion_reports')).length,0);
  assert.equal((await rows(`select * from travel_companion_trips where id='${friendTrip}'`)).length,0);
  await setUser(host);
  const openTrips=[];
  for(let i=0;i<10;i++)openTrips.push(await makeTrip(host));
  await asAdmin(`update travel_companion_trips set moderation='approved';insert into travel_companion_accounts(actor,tier) values('${paid}','paid');`);
  await setUser(guest);
  for(const [i,item] of openTrips.entries())assert.equal(await join(item),i<4);
  await setUser(paid);
  for(const item of openTrips)assert.equal(await join(item),true);
  await setUser(host);const capacity=await makeTrip(host);
  await asAdmin(`update travel_companion_trips set moderation='approved' where id='${capacity}'`);
  let accepted=0;
  for(const user of members.slice(4)){await setUser(user);if(await join(capacity))accepted++;}
  assert.equal(accepted,20);
  await setUser(stranger);const paidCapacity=await makeTrip(stranger);
  await asAdmin(`update travel_companion_trips set moderation='approved' where id='${paidCapacity}';insert into travel_companion_accounts(actor,tier) values('${stranger}','paid') on conflict(actor) do update set tier='paid'`);
  accepted=0;
  for(const user of members.slice(4)){await setUser(user);if(await join(paidCapacity))accepted++;}
  assert.equal(accepted,30);
  await setUser(host);
  await db.exec(`insert into travel_blocks values('${host}','${stranger}')`);
  await setUser(stranger);assert.equal(await join(openTrips[0]),false);
  await setUser(guest);await db.exec(`insert into travel_mutes values('${guest}','${host}')`);
  assert.equal((await rows('select * from travel_companion_board')).length,1);
  await asAdmin(`update travel_companion_trips set status='completed' where id='${capacity}';set role service_role;`);
  for(const expected of [20,0])assert.equal((await rows(`select travel_private.finish_companion_trip('${capacity}') added`))[0].added,expected);
  await setUser(host);assert.equal((await rows('select * from travel_companion_receipts')).length,1);
  await setUser(members[4]);assert.equal((await rows('select * from travel_companion_receipts')).length,1);
  await setUser(stranger);assert.equal((await rows('select * from travel_companion_receipts')).length,0);
  await assert.rejects(db.exec('select * from travel_companion_images'));
  await setUser(guest);
  assert.equal((await rows(`select travel_cancel_companion_trip('${openTrips[9]}') ok`))[0].ok,false);
  await setUser(host);
  assert.equal((await rows(`select travel_cancel_companion_trip('${openTrips[9]}') ok`))[0].ok,true);
  await asAdmin(`set role service_role;update travel_companion_images set state='ready' where trip_id='${capacity}'`);
  const accessFor=async (person,group)=> (await rows(`select travel_private.can_read_companion_image('${capacity}',${group},'${person}') ok`))[0].ok;
  assert.equal(await accessFor(host,1),true);
  assert.equal(await accessFor(stranger,0),false);
  await setUser(members[4]);const group=(await rows('select group_no from travel_companion_receipts'))[0].group_no;
  await asAdmin('set role service_role;');
  assert.equal(await accessFor(members[4],group),true);
  assert.equal(await accessFor(members[4],(group+1)%7),false);
  await setUser(host);await db.exec(`insert into travel_blocks values('${host}','${members[4]}')`);
  await asAdmin('set role service_role;');
  assert.equal(await accessFor(members[4],group),false);
  console.log('PASS friends-only visibility, consent and roles, retry safety, 5/10 joins, 20/30 seats, mute/block/report, private receipts and image access.');
}finally{await db.close();}
