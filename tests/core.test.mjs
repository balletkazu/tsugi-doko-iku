import assert from 'node:assert/strict';
import { readFileSync, accessSync } from 'node:fs';
import test from 'node:test';
import { escapeHtml, mapsSearch, mapsTransit, nearbyPlaces, rankPlaces, stampKey } from '../public/core.js';
import { collections, places, travelerTypes } from '../public/data.js';

import { communityTabs, editorial, feedPosts, homeFeature, reactionTypes, samplePosts, searchPosts } from '../public/community-data.js';
import { photos } from '../public/photo-data.js';
import { canFeaturePhoto, photoFor } from '../public/photos.js';

import { travelerRanking } from '../public/traveler-quiz.js';
import { movePhoto } from '../public/gallery.js';
import { jpegTechnicalExif } from '../public/gallery-media.js';
import { loadToyamaPilot } from '../public/transit-pilot.js';
import { searchRegion } from '../public/transit-router.js';

test('search combines region, phrase and theme, retaining preferred themes first', () => {
  assert.deepEqual(rankPlaces(places,'自然',' 秋田 ').map(place=>place.id),['mototaki','hachibodai']);
  assert.deepEqual(rankPlaces(places,'温泉','温泉').map(place=>place.id),['nyuto']);
  assert.equal(rankPlaces(places,'自然','小値賀島').length,0);
  const artist = travelerTypes.find(traveler=>traveler.name === 'アーティスト');
  assert.deepEqual(rankPlaces(places,'','',artist.themes).slice(0,2).map(place=>place.id),['heisenji','inujima']);
});

test('Google Maps receives escaped origin and destination without unsupported route preferences', () => {
  assert.equal(mapsTransit('  ','東京'), '');
  const transit = new URL(mapsTransit(' 秋田駅 ', '元滝 & 伏流水 #入口'));
  assert.equal(transit.origin,'https://www.google.com');
  assert.equal(transit.searchParams.get('origin'),'秋田駅');
  assert.equal(transit.searchParams.get('destination'),'元滝 & 伏流水 #入口');
  assert.equal(transit.searchParams.get('travelmode'),'transit');
  assert.deepEqual([...transit.searchParams.keys()],['api','origin','destination','travelmode']);
  assert.equal(new URL(mapsSearch('赤西渓谷 & 入口')).searchParams.get('query'),'赤西渓谷 & 入口');
});

test('detours exclude the selected place and sort nearby results by straight-line distance', () => {
  const anchor = places.find(place=>place.id === 'mototaki');
  const results = nearbyPlaces(places,anchor,25);
  assert.equal(results[0].place.id,'chokai');
  assert.ok(results.every(result=>result.distance <= 25 && result.place.id !== anchor.id));
  assert.deepEqual(nearbyPlaces(places,{lat:0,lng:0}),[]);
});

test('collection identifiers are unique and include all 47 prefectures', () => {
  const prefectures = collections.find(collection=>collection.id === 'prefecture');
  assert.equal(prefectures.items.length,47);
  assert.equal(prefectures.items.at(-1).name,'沖縄県');
  const keys = collections.flatMap(collection=>collection.items.map(item=>stampKey(collection,item)));
  assert.equal(keys.length,new Set(keys).size);
  assert.match(keys[0],/^JP\/prefecture\/JP-01$/);
  const counts={'prefecture':47,'national-park':35,'quasi-park':58,'world-heritage':27,'mountain-100':100,'unesco-geopark':11,'biosphere':10};
  for(const [id,count] of Object.entries(counts)){
    const book=collections.find(c=>c.id===id);
    assert.equal(book.items.length,count);
    assert.ok(book.complete&&book.source);
    assert.ok(book.items.every(item=>item.motif&&(id==='prefecture'||item.area&&item.coords?.length)));
  }
  const all=collections.flatMap(x=>x.items.map(i=>i.name));
  for(const name of ['御嶽山国定公園','飛鳥・藤原の宮都','Mine秋吉台ユネスコ世界ジオパーク'])assert.ok(all.includes(name));
});

test('private record content is escaped before placement in HTML', () => {
  assert.equal(escapeHtml('<b title="a&b">\'旅\'</b>'),'&lt;b title=&quot;a&amp;b&quot;&gt;&#39;旅&#39;&lt;/b&gt;');
  assert.equal(escapeHtml(undefined),'');
});

test('production build creates a versioned, resolvable offline cache', () => {
  const root = new URL('../',import.meta.url);
  const dist = new URL('dist/',root);
  const worker = readFileSync(new URL('sw.js',dist),'utf8');
  const version = worker.match(/^const version = '([a-f0-9]{16})';$/m)?.[1];
  assert.ok(version);
  const [,entries] = worker.match(/^const assets = (.+);$/m);
  const precache = JSON.parse(entries);
  assert.ok(precache.includes('./index.html') && precache.includes('./app.js'));
  assert.ok(!precache.includes('./sw.js'));
  for (const entry of precache) {
    assert.match(entry,/^\.\/(?!\/)/);
    accessSync(new URL(entry,dist));
  }
  const html = readFileSync(new URL('index.html',dist),'utf8');
  assert.match(html,/<html lang="ja">/);
  assert.ok(html.includes(`<meta name="app-version" content="${version}">`));
  assert.match(html,/rel="manifest"/);
});


test('community feeds show finite public samples and honor locally followed editors', () => {
  const ids = items => items.map(item => item.id);
  assert.equal(feedPosts(samplePosts,'all').length, 6);
  for (const [tab] of communityTabs.slice(2)) {
    assert.equal(feedPosts(samplePosts,tab).length, 2);
    assert.ok(feedPosts(samplePosts,tab).every(post=>post.kind === tab));
  }
  assert.deepEqual(feedPosts(samplePosts,'following'), []);
  assert.deepEqual(ids(feedPosts(samplePosts,'following',{sampleFollows:[editorial.id]})),ids(samplePosts));
  assert.deepEqual(feedPosts([{...samplePosts[0],visibility:'private'}],'all'),[]);
  assert.equal(new Map(reactionTypes).get(0),'ありがとう');
  assert.equal(new Map(reactionTypes).get(1),'行ってみたい');
  assert.equal(new Map(reactionTypes).get(2),'参考になった');
  assert.equal(new Map(reactionTypes).size,7);
});

test('real photos have attributable local assets and user photos require public consent and review', () => {
  const base = new URL('../public/',import.meta.url);
  for (const record of [...places,...samplePosts]) {
    if (record.photoId) assert.ok(photoFor(record.photoId),`unknown photo in ${record.id}`);
  }
  for (const photo of Object.values(photos)) {
    assert.ok(canFeaturePhoto(photo) && photo.originalTitle && photo.edits);
    assert.equal(new URL(photo.originalUrl).hostname,'commons.wikimedia.org');
    assert.equal(new URL(photo.license.url).hostname,'creativecommons.org');
    assert.match(photo.src,/^\.\/assets\/photos\/[\w-]+\.webp$/);
    accessSync(new URL(photo.src,base));
    if (photo.smallSrc) accessSync(new URL(photo.smallSrc,base));
  }
  const example = {...photoFor(homeFeature),origin:'user',visibility:'public',homeConsent:{status:'granted',version:'v1'},moderation:'approved'};
  assert.ok(canFeaturePhoto(example));
  assert.equal(canFeaturePhoto({...example,visibility:'private'}),false);
  assert.equal(canFeaturePhoto({...example,moderation:'pending'}),false);
  assert.equal(canFeaturePhoto({...example,homeConsent:{status:'revoked',version:'v1'}}),false);
});

test('community text search and full-width hashtags apply exact tag matches', () => {
  assert.deepEqual(searchPosts(samplePosts,'＃秋田').map(post=>post.id),['mototaki-light','nyuto-note','oga-booklet']);
  assert.equal(searchPosts(samplePosts,'#秋').length,0);
  assert.deepEqual(searchPosts(samplePosts,'#秋田 木漏れ日').map(post=>post.id),['mototaki-light']);
});

test('traveler scores support multiple sides and do not use saved themes by default', () => {
  const answers = ['冒険家','ネイチャーラバー','アーティスト','登山家'];
  assert.deepEqual(travelerRanking(answers).map(type=>type.score),[4,4,4,4]);
  assert.equal(travelerRanking(answers,['文化・アート'])[0].name,'アーティスト');
  assert.equal(travelerRanking(answers,['文化・アート'])[0].score,5);
});

test('photo reordering preserves entries and does not move past the album edges', () => {
  const photos = [{id:'a',description:'山'},{id:'b',description:'海'},{id:'c'}];
  assert.deepEqual(movePhoto(photos,'a',1).map(photo=>photo.id),['b','a','c']);
  assert.equal(movePhoto(photos,'a',1)[1].description,'山');
  assert.equal(movePhoto(photos,'a',-1),photos);
  assert.equal(movePhoto(photos,'missing',1),photos);
});

test('JPEG EXIF reads allowed camera data and ignores a GPS directory tag', () => {
  const tiff = Buffer.alloc(80);
  tiff.write('II',0);tiff.writeUInt16LE(42,2);tiff.writeUInt32LE(8,4);tiff.writeUInt16LE(2,8);
  tiff.writeUInt16LE(0x0110,10);tiff.writeUInt16LE(2,12);tiff.writeUInt32LE(7,14);tiff.writeUInt32LE(45,18);
  tiff.writeUInt16LE(0x8825,22);tiff.writeUInt16LE(4,24);tiff.writeUInt32LE(1,26);tiff.writeUInt32LE(55,30);
  tiff.write('CAMERA\0',45);tiff.write('PRIVATE-GPS',55);
  const payload = Buffer.concat([Buffer.from('Exif\0\0'),tiff]);
  const prefix = Buffer.from([0xff,0xd8,0xff,0xe1,0,payload.length+2]);
  const image = Buffer.concat([prefix,payload,Buffer.from([0xff,0xd9])]);
  assert.deepEqual(jpegTechnicalExif(image),{model:'CAMERA'});
  assert.deepEqual(jpegTechnicalExif(image.subarray(0,50)),{});
});

test('Toyama combines published bus and tram departures through a pedestrian transfer', async () => {
  const data = await loadToyamaPilot();
  const trip = {from:'maidohaya/31_01',to:'chitetsu-tram/3003-C39_01',date:'2026-11-25',time:'10:00',limit:30,mixed:true};
  const routes = searchRegion(data,trip);
  assert.ok(routes.length && routes.every(route=>route.mask===3 && route.walk<=1800));
  const [bus,transfer,tram] = routes[0].legs;
  assert.equal(data.schedule.routes[bus.route][2],'bus');
  assert.equal(data.schedule.points[bus.to][1],'宝町');
  assert.equal(transfer.mode,'walk');
  assert.equal(data.schedule.points[transfer.to][1],'富山駅');
  assert.equal(tram.start,10*3600+30*60);
  assert.equal(data.schedule.routes[tram.route][2],'tram');
  assert.equal(data.schedule.points[tram.to][1],'岩瀬浜');
  assert.equal(tram.end,10*3600+54*60);
  assert.equal(routes[0].fare,null); // The tram feed does not publish a fare table.
});

test('real Toyama candidates respect all three caps and the common service dates', async () => {
  const data = await loadToyamaPilot();
  const trip = {from:'maidohaya/1_01',to:'maidohaya/28_01',date:'2026-11-25',time:'10:00'};
  const short = searchRegion(data,{...trip,limit:30});
  assert.ok(short.length && short.every(route=>route.mask!==0 && route.walk<=1800));
  const middle = searchRegion(data,{...trip,limit:60});
  assert.ok(middle.some(route=>route.mask===0 && route.walk>1800 && route.walk<=3600));
  const far = {...trip,to:'poi-zoo'};
  assert.deepEqual(searchRegion(data,{...far,limit:60}),[]);
  assert.ok(searchRegion(data,{...far,limit:120}).some(route=>route.walk>3600 && route.walk<=7200));
  assert.deepEqual(searchRegion(data,{...trip,date:'2027-03-14',limit:120}),[]);
  assert.deepEqual(searchRegion(data,{...trip,date:'2027-02-31',limit:120}),[]);
  assert.deepEqual(searchRegion(data,{...trip,from:'unknown',limit:60}),[]);
});

test('walking cap includes access, transfer and egress at the exact second', () => {
  const schedule = {
    start:'20260101',end:'20271231',
    points:[['a','Origin','place'],['b','Bus board','bus'],['c','Bus alight','bus'],['d','Tram board','tram'],['e','Tram alight','tram'],['f','Target','place']],
    services:[['20260101','20271231',[1,1,1,1,1,1,1],{}]],
    routes:[['bus','Bus','bus',200],['tram','Tram','tram',null]],
    patterns:[[0,1,0,0,1,2,600,600,2],[1,3,0,0,1,4,480,480,2]],
    journeys:[[0,0,36600],[1,0,37920]]
  };
  const walking = Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>i===j?0:null));
  walking[0][1]=600; walking[2][3]=600; walking[4][5]=600;
  const trip = {from:'a',to:'f',date:'2026-11-25',time:'10:00',limit:30,mixed:true};
  assert.equal(searchRegion({schedule,walking},trip)[0].walk,1800);
  walking[4][5]=601;
  assert.deepEqual(searchRegion({schedule,walking},trip),[]);
  assert.equal(searchRegion({schedule,walking},{...trip,limit:60})[0].walk,1801);
  schedule.journeys[1][2]--;
  assert.deepEqual(searchRegion({schedule,walking},{...trip,limit:60}),[]);
  schedule.journeys[1][2]++;
  schedule.services[0][3]['20261125']=2;
  assert.deepEqual(searchRegion({schedule,walking},{...trip,limit:60}),[]);
});

test('47 atlas destinations are stable, and virtual exploration cannot award real souvenirs',async()=>{
  const {prefectures,inventory,newEntry,avatarDefaults}=await import('../public/world-data.js');
  assert.deepEqual(prefectures.map(p=>p.id),collections[0].items.map(p=>p.id));
  assert.ok(prefectures.every(p=>p.lat>=24 && p.lat<=46 && p.lon>=122 && p.lon<=147));
  assert.deepEqual(inventory({explored:['JP-26']}),['plant','books']);
  const entry=newEntry({activity:'cafe',pref:'JP-16',place:'喫茶店',id:'test',date:0,avatar:avatarDefaults});
  assert.deepEqual(inventory({entries:[entry,entry]}),['plant','books','cup']);
  assert.equal(entry.source,'self-confirmed');assert.throws(()=>newEntry({activity:'invented'}));
  assert.throws(()=>newEntry({activity:'cafe',pref:'JP-48'}));
});

test('uncertain sensor readings preserve the choice and raw coordinates never enter records',async()=>{
  const {estimateActivity,newEntry}=await import('../public/world-data.js');
  const good={accuracy:6,speed:1.2,lat:36.7,lon:137.2,time:5000,alt:100,altError:3};
  assert.equal(estimateActivity(null,good).kind,'walk');
  for(const state of [{accuracy:91},{speed:60},{speed:null},{speed:0}])assert.equal(estimateActivity(null,{...good,...state}).kind,null);
  const next={...good,time:15000,alt:111};assert.equal(estimateActivity(good,next).kind,'hike');
  assert.equal(estimateActivity({...good,altError:80},next).kind,'walk');
  const record=newEntry({...good,activity:'train',date:0,id:'test'});
  for(const key of ['lat','lon','speed','time','alt','accuracy','altError'])assert.ok(!(key in record));
});

test('avatar options validate persisted values while preserving the chosen name',async()=>{
  const {avatarFrom,parts,poses}=await import('../public/world-data.js');
  const avatar=avatarFrom({name:' はる ',hat:2,eyes:88,hairColor:-2,bag:'wrong'});
  assert.equal(avatar.name,'はる');assert.equal(avatar.hat,2);assert.equal(avatar.eyes,0);
  for(const [key,options] of Object.entries(parts))assert.ok(avatar[key]>=0&&avatar[key]<options.length-1);
  assert.equal(Object.keys(poses).length,12);
});

test('mapped Toyama journeys use measured shapes and preserve walks without geometry as endpoints',async()=>{
  const {geometryForLeg}=await import('../public/transit-pilot.js');
  const data=await loadToyamaPilot();
  assert.equal(data.schedule.journeys.filter(j=>Number.isInteger(j[3])).length,765);
  const request={from:'maidohaya/31_01',to:'chitetsu-tram/3003-C39_01',date:'2026-11-25',time:'10:00',limit:17,mixed:true};
  const route=searchRegion(data,request)[0];assert.ok(route.walk<=17*60);
  const lines=route.legs.flatMap(leg=>geometryForLeg(data,leg));
  assert.deepEqual(lines.map(l=>l.mode),['bus','walk','tram']);assert.ok(lines.every(l=>l.coords.length>2));
  assert.deepEqual(geometryForLeg({...data,footpaths:{}},route.legs[1]).map(l=>l.mode),['point','point']);
  assert.deepEqual(searchRegion(data,{...request,limit:-1}),[]);assert.deepEqual(searchRegion(data,{...request,limit:181}),[]);
});

test('sample author controls affect the finite timeline without altering public posting permissions',()=>{
  assert.deepEqual(feedPosts(samplePosts,'all',{sampleMuted:true}),[]);
  assert.deepEqual(feedPosts(samplePosts,'all',{sampleBlocked:true}),[]);
  assert.equal(new Map(reactionTypes).get(6),'美味しそう');
});

test('daily step rewards and item purchases are stored once without deadlines',async()=>{
  const {economy,recordSteps,purchase,balance}=await import('../public/travel-life.js');
  const coins=economy({});
  const earned=recordSteps(coins,'2024-01-11',4000,'2026-11-25');
  assert.equal(balance(earned),32);
  assert.equal(balance(recordSteps(earned,'2024-01-11',5900,'2026-11-25')),32);
  assert.equal(balance(recordSteps(earned,'2024-01-11',500,'2026-11-25')),32);
  assert.throws(()=>recordSteps(coins,'2026-11-26',100,'2026-11-25'));
  const bought=purchase(earned,'fern');
  assert.deepEqual(bought.owned,['fern']);
  assert.equal(balance(bought),20);
  assert.throws(()=>purchase(bought,'fern'));assert.throws(()=>purchase(bought,'lantern'));
});

test('companion quotas count distinct joins and preserve records after the day ends',async()=>{
  const {addDemoJoin,lifeTrips,companionLimits}=await import('../public/travel-life.js');
  let trips=lifeTrips({});const day='2026-11-25';
  for(const id of ['violet','wind','clover','nagi','sio'])trips=addDemoJoin(trips,id,day);
  assert.equal(addDemoJoin(trips,'nagi',day),trips);
  assert.throws(()=>addDemoJoin(trips,'haku',day));
  assert.equal(addDemoJoin(trips,'haku','2026-11-26').joins.length,6);
  assert.deepEqual(companionLimits.paid,{daily:10,guests:30});
});

test('passport keeps verified, self-reported and game records separate',async()=>{
  const {recordVisit,gpsMatches,entryKinds}=await import('../public/stamp-book.js');
  const {default:boundaries}=await import('../public/data/prefecture-areas.js');
  const key='JP/prefecture/JP-16',date='2026-11-25';
  assert.equal(gpsMatches(boundaries['JP-16'],{latitude:36.62,longitude:137.19,accuracy:8}),true);
  assert.equal(gpsMatches(boundaries['JP-26'],{latitude:36.62,longitude:137.19,accuracy:8}),false);
  assert.equal(gpsMatches(boundaries['JP-16'],{latitude:36.62,longitude:137.19,accuracy:100}),false);
  let p=recordVisit({},key,date,'gps',date);p=recordVisit(p,key,'2023-02-19','self',date);
  assert.equal(recordVisit(p,key,date,'gps',date),p);
  assert.throws(()=>recordVisit(p,key,'2023-02-30','self',date));
  const all=entryKinds(p,key,{id:'JP-16'},{explored:['JP-16'],companions:{joins:[{pref:'JP-16',day:date}]}});
  assert.deepEqual(all.map(x=>x.kind),['self','gps','virtual','companion']);
});

test('avatar migration keeps the old coat color and the new clothing choice',async()=>{
  const {avatarFrom}=await import('../public/world-data.js');
  assert.equal(avatarFrom({outfit:2}).clothColor,2);
  assert.equal(avatarFrom({outfit:2}).outfit,0);
  assert.equal(avatarFrom({design:2,outfit:3,clothColor:4}).outfit,3);
});

test('nearby transit evidence rejects weak positions and reports overlapping bus and rail',async()=>{
  const {nearbyTransport,toyamaMobility}=await import('../public/mobility.js');
  const a=[36.7,137.21],b=[36.7,137.213];
  const samples=[[36.7,137.2101],[36.7,137.2113],[36.7,137.2127]].map(([lat,lon])=>({lat,lon,accuracy:9}));
  assert.deepEqual(nearbyTransport(samples,{train:[[a,b]],bus:[[a,b]]}),['train','bus']);
  assert.deepEqual(nearbyTransport(samples.map(x=>({...x,accuracy:85})),{train:[[a,b]],bus:[]}),[]);
  const network=await toyamaMobility();assert.ok(network.train.length&&network.bus.length);
});

test('room migration keeps old furnishings and photos; rotated footprints keep entrances open',async()=>{
  const {readHome,canPlace,homePath,validateHome,homeStock}=await import('../public/home-layout.js');
  const game={slots:['plant','cup','books'],wallPhoto:'ref-1',entries:[{id:'ref-1',activity:'cafe',photo:true}]};
  const layout=readHome(game);
  assert.equal(layout.wallPhoto,'ref-1');assert.ok(layout.items.room.some(item=>item.kind==='cup'));
  assert.equal(validateHome(game,layout),layout);
  const candidate={id:'test',kind:'shelf',x:8,y:2,r:0};
  assert.equal(canPlace('room',[],candidate),false);
  assert.equal(canPlace('room',[],{...candidate,r:1}),true);
  assert.equal(canPlace('room',[],{...candidate,x:3,y:6}),false);
  assert.equal(canPlace('room',[],{...candidate,kind:'pond',x:2}),false);
  assert.ok(homeStock(game).includes('pond'));
  const path=homePath('room',layout.items.room,[4,6],[[7,5]]);
  assert.ok(path.length>2);
  assert.deepEqual(path.at(-1),[7,5]);
});
test('avatar palettes and customization keep truthful stable counts',async()=>{
  const {avatarFrom,parts}=await import('../public/world-data.js');
  const {hairPalette,skinPalette}=await import('../public/avatar-palette.js');
  const {facings}=await import('../public/traveler-art.js');
  assert.equal(parts.hair.length-1,16);assert.equal(parts.outfit.length-1,8);
  assert.equal(new Set(hairPalette.map(([,color])=>color)).size,49);
  assert.equal(skinPalette.length,20);assert.equal(facings.length,8);
  const a=avatarFrom({design:2,hairTint:'#63848e',tune:{eyes:{size:99,gap:-77},mouth:{x:5}}});
  assert.deepEqual([a.hairTint,a.tune.eyes.size,a.tune.eyes.gap,a.tune.mouth.x],['#63848e',10,-10,5]);
  assert.equal(avatarFrom({hairTint:'javascript:alert(0)'}).hairTint,null);
});
test('regional keepsakes match precise user-entered activities rather than an adjacent prefecture',async()=>{
  const {activityEvents,regionalItems,keepsakesFor}=await import('../public/regional-data.js');
  assert.equal(Object.keys(regionalItems).length,8);
  assert.ok(Object.values(regionalItems).every(item=>item.source.startsWith('https://')));
  assert.equal(Object.keys(activityEvents).length,10);
  assert.deepEqual(keepsakesFor({pref:'JP-16',place:'氷見 市',activity:'meal'}),['himi-buri']);
  assert.deepEqual(keepsakesFor({pref:'JP-16',place:'立山・室堂',activity:'hike'}),['tateyama-bird']);
  assert.deepEqual(keepsakesFor({pref:'JP-18',place:'立山',activity:'hike'}),[]);
  assert.deepEqual(keepsakesFor({pref:'JP-16',place:'氷見',activity:'walk'}),[]);
});
test('legacy 32-question results rank the same four types with response consent applied separately',async()=>{
  const {allQuestions}=await import('../public/fortune.js');
  assert.equal(allQuestions.length,32);
  assert.equal(new Set(allQuestions.map(([question])=>question)).size,32);
  for(const [,choices] of allQuestions)assert.equal(new Set(choices.map(([type])=>type)).size,4);
  const answers=allQuestions.map(([,choices])=>choices.find(([type])=>type==='ネイチャーラバー')[0]);
  assert.equal(travelerRanking(answers,[],allQuestions)[0].score,128);
  assert.equal(travelerRanking(answers,['アート','自然'],allQuestions)[0].score,129);
});

test('room and garden project the same furniture anchors they hit, with room for wall items',async()=>{
  const {homeAreas,homeProjection,canPlace,homePath}=await import('../public/home-layout.js');
  for(const area of Object.values(homeAreas)){
    const {toPlane,fromPlane,visible}=homeProjection(area);
    const corners=[[0,0],[area.width,0],[0,area.height],[area.width,area.height],[3.5,2.5]];
    for(const point of corners)assert.ok(fromPlane(toPlane(point)).every((axis,i)=>Math.abs(axis-point[i])<1e-8));
    assert.ok(visible(0)<visible(1));
  }
  const chair={id:'seat',kind:'chair',x:4,y:3,r:0},frame={id:'painting',kind:'frame',x:4,y:3,r:0};
  assert.equal(canPlace('room',[chair],frame),true);
  assert.equal(canPlace('room',[frame],{...frame,id:'another'}),false);
  assert.deepEqual(homePath('room',[frame],[4,4],[[4,3]]),[[4,3]]);
});

test('the Toyama overview numbers real boarding and alighting points in itinerary order',async()=>{
  const {loadToyamaPilot,journeyMarkers}=await import('../public/transit-pilot.js');
  const data=await loadToyamaPilot();
  const {default:geometry}=await import('../public/data/toyama-geometry.js');
  const legs=[{mode:'walk',from:2,to:18},{mode:'ride',from:18,to:20},{mode:'walk',from:20,to:24},{mode:'ride',from:24,to:26},{mode:'walk',from:26,to:30}];
  const markers=journeyMarkers(data,legs);
  assert.deepEqual(markers.map(marker=>marker.kind),['start','ride','transfer','ride','transfer','end']);
  assert.deepEqual(markers.map(marker=>marker.number),[1,2,3,4,5,6]);
  assert.deepEqual(markers[3].coords,geometry.stops[24]);
  assert.ok(markers.every(marker=>Boolean(marker.label)));
});
