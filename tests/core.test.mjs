import assert from 'node:assert/strict';
import { readFileSync, accessSync } from 'node:fs';
import test from 'node:test';
import { escapeHtml, mapsSearch, mapsTransit, nearbyPlaces, rankPlaces, stampKey } from '../public/core.js';
import { collections, places, travelerTypes } from '../public/data.js';

import { communityTabs, editorial, feedPosts, homeFeature, reactionTypes, samplePosts } from '../public/community-data.js';
import { photos } from '../public/photo-data.js';
import { canFeaturePhoto, photoFor } from '../public/photos.js';

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
