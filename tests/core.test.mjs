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
import { loadToyamaPilot, searchToyama } from '../public/transit-pilot.js';

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
  assert.equal(collections.filter(collection=>collection.complete).length,1);
});

test('private record content is escaped before placement in HTML', () => {
  assert.equal(escapeHtml('<b title="a&b">\'旅\'</b>'),'&lt;b title=&quot;a&amp;b&quot;&gt;&#39;旅&#39;&lt;/b&gt;');
  assert.equal(escapeHtml(undefined),'');
});

test('production build creates a versioned, resolvable offline cache', () => {
  const root = new URL('../',import.meta.url);
  const dist = new URL('dist/',root);
  const worker = readFileSync(new URL('sw.js',dist),'utf8');
  assert.match(worker,/tsugi-preview-[a-f0-9]{16}/);
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
  assert.equal(new Map(reactionTypes).size,5);
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

test('real Toyama bus and walking candidates respect all three caps and the published service dates', async () => {
  const data = await loadToyamaPilot();
  const trip = {from:'1_01',to:'28_01',date:'2026-11-25',time:'10:00'};
  const short = searchToyama(data,{...trip,limit:30});
  assert.equal(short.length,2);
  assert.ok(short.every(route=>route.type==='bus' && route.fare===200 && route.walk<=1800));
  const middle = searchToyama(data,{...trip,limit:60});
  assert.ok(middle.some(route=>route.type==='walk' && route.walk>1800 && route.walk<=3600));
  const far = {...trip,to:'poi-zoo'};
  assert.deepEqual(searchToyama(data,{...far,limit:60}),[]);
  assert.ok(searchToyama(data,{...far,limit:120}).some(route=>route.walk>3600 && route.walk<=7200));
  assert.deepEqual(searchToyama(data,{...trip,date:'2027-04-01',limit:120}),[]);
  assert.deepEqual(searchToyama(data,{...trip,date:'2027-02-31',limit:120}),[]);
  assert.deepEqual(searchToyama(data,{...trip,from:'unknown',limit:60}),[]);
});
