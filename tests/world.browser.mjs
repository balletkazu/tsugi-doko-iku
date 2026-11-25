import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
// Optional mobile browser regression. Build dist/ before running this file.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const project = new URL('../',import.meta.url);
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json'};
// Fixture tiles keep this interaction test reproducible offline.
const {headers:rules}=JSON.parse(await readFile(new URL('vercel.json',project),'utf8'));
const headers=Object.fromEntries(rules[0].headers.map(({key,value})=>[key,value]));
const server=createServer(async (req,res)=>{
  const path=new URL(req.url,'http://127.0.0.2').pathname;
  const name=path==='/'?'index.html':path.slice(1);
  try {const bytes=await readFile(new URL(`dist/${name}`,project));res.writeHead(200,{...headers,'Content-Type':types[extname(name)] ?? 'application/octet-stream'});res.end(bytes);}
  catch {if (!res.headersSent) res.writeHead(404); res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.2',resolve));
const origin=`http://127.0.0.2:${server.address().port}/`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
try {
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  page.setDefaultTimeout(12000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let starts=0,stops=0;
  await page.exposeFunction('testStart',()=>starts++);await page.exposeFunction('testStop',()=>stops++);
  await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{
    watchPosition(ok){window.testStart();setTimeout(()=>ok({coords:{latitude:36.7,longitude:137.2,accuracy:8,speed:1.2,altitude:null,altitudeAccuracy:null},timestamp:Date.now()}),25);return 99;},clearWatch(){window.testStop();}
  }});});
  const visit=async h=>{await page.evaluate(hash=>location.hash=hash,h);await page.waitForFunction(hash=>location.hash===hash,h);await page.waitForTimeout(120);};
  const shot=async n=>{if(process.env.ARTIFACT_DIR)await page.screenshot({path:process.env.ARTIFACT_DIR+'/rpg-'+n+'.png'});};
  const tile=await readFile(new URL('public/assets/icon-192.png',project));let tileRequests=0;
  await page.route('https://cyberjapandata.gsi.go.jp/**',r=>{tileRequests++;return r.fulfill({body:tile,contentType:'image/png'});});
  await page.goto(origin);
  await page.getByRole('dialog').getByRole('button',{name:'タップでスキップ'}).tap();
  await page.getByText('はじめまして！').waitFor();await shot('opening');
  await page.getByText('旅人をつくる').tap();
  await page.getByLabel('旅人の名前').fill('はる');await page.getByLabel('髪色',{exact:true}).selectOption('2');
  const pose=page.locator('#pose-choice');let poses=await pose.locator('option').evaluateAll(items=>items.map(x=>x.value));for(const v of poses)await pose.selectOption(v);
  await shot('avatar');await page.getByText('この姿で家へ').tap();await page.getByRole('heading',{name:'はるの家'}).waitFor();
  await page.getByRole('button',{name:'床をタップして旅人を移動'}).tap();await shot('house');
  await page.getByText('地図をひらく').tap();await page.locator('#pref-choice').selectOption('JP-26');await page.getByRole('heading',{name:'京都府'}).waitFor();
  assert.equal(await page.locator('#pref-choice option').count(),47);await shot('atlas');
  await page.getByText('ここを散策する').tap();await page.getByText('京都府を散策').waitFor();await page.getByRole('button',{name:'カメラを構える'}).tap();await page.getByText('旅人は風景にカメラを向けました。').waitFor();
  await page.getByRole('link',{name:'街へ帰る'}).tap();await page.getByRole('heading',{name:'風待ちの街'}).waitFor();await page.getByRole('button',{name:'絵はがき屋のシオに話しかける'}).tap();await page.getByText('街の案内役').waitFor();await shot('village');
  assert.equal(starts,0);assert.equal(tileRequests,0);
  await page.getByText('体験を記録　＋').tap();await page.getByRole('button',{name:'現在地から候補を探す'}).tap();
  await page.getByRole('button',{name:'徒歩を選ぶ'}).tap();assert.equal(await page.locator('[name=activity]').inputValue(),'walk');
  await page.locator('[name=activity]').selectOption('cafe');await page.locator('[name=pref]').selectOption('JP-16');
  await page.getByLabel('訪ねた場所').fill('駅前の喫茶店');await page.locator('[name=photo]').setInputFiles({name:'camera.png',mimeType:'image/png',buffer:tile});
  await page.getByText('自分の体験として記録').tap();await page.getByRole('heading',{name:'駅前の喫茶店',exact:false}).waitFor();assert.equal(stops,1);
  const saveFile=page.waitForEvent('download');await page.getByText('絵はがきを画像にする').tap();const download=await saveFile;assert.match(download.suggestedFilename(),/png$/);
  await page.getByText('絵入りの栞にする').tap();await page.getByRole('heading',{name:/駅前の喫茶店の旅の栞/}).waitFor();await page.locator('.photo-list img').waitFor();
  await visit('#stamps');await page.getByRole('link',{name:'富山県・体験から記録済み'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'京都府',exact:true}).getAttribute('aria-pressed'),'false');
  await visit('#decorate');await page.getByLabel('窓の下').selectOption('cup');await page.locator('[name=wallPhoto]').selectOption({index:1});await page.getByText('配置を保存').tap();await page.getByRole('heading',{name:'はるの家'}).waitFor();await page.locator('.floor-item [data-item=cup]').waitFor();
  await page.locator('.wall-photo').waitFor();await visit('#avatar');await page.getByLabel('身につける記念品').selectOption('cup');await page.getByText('着替えを保存').tap();await page.getByRole('heading',{name:'はるの家'}).waitFor();
  await visit('#atlas?pref=JP-26&view=map');await page.waitForFunction(()=>document.querySelector('.tile-widget canvas'));await page.getByLabel('地図を拡大').tap();assert.ok(tileRequests>0);
  await visit('#pilot');await page.getByLabel('日付',{exact:true}).fill('2026-11-25');await page.getByLabel('路面電車とバスの両方を使う').check();await page.locator('[name=order]').selectOption('fare');
  await page.getByText('経路を検索',{exact:true}).tap();await page.locator('.pilot-result').first().waitFor();await page.getByText('実際の地図で見る').first().tap();await page.locator('details[data-route-legs][open] canvas').first().waitFor();
  for (const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});for(const hash of ['#village','#atlas','#avatar','#activity','#memories','#menu','#pilot','#home']){await visit(hash);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width+hash);}}
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);await ctx.setOffline(true);
  await visit('#cottage');await page.reload();await page.getByRole('heading',{name:'はるの家'}).waitFor();await page.locator('[data-item=cup]').waitFor();
  await visit('#memories');await page.locator('[data-memory-photo]').waitFor();await page.reload();await page.getByRole('heading',{name:/駅前の喫茶店/}).waitFor();
  await visit('#pilot');await page.getByText('経路を検索',{exact:true}).tap();await page.locator('#pilot-results').waitFor();await ctx.setOffline(false);
  await visit('#welcome');await page.getByText('案内をスキップ').tap();await page.getByRole('heading',{name:'風待ちの街'}).waitFor();await page.reload();await page.getByRole('heading',{name:'風待ちの街'}).waitFor();
  const ctx2=await browser.newContext({viewport:{width:320,height:680},reducedMotion:'reduce'});const denied=await ctx2.newPage();await denied.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{watchPosition(_ok,fail){setTimeout(fail,10);return 3;},clearWatch(){}}});});await denied.goto(origin+'#activity');await denied.getByText('現在地から候補を探す').click();await denied.getByText('位置情報を取得できません。手入力で記録できます。').waitFor();await ctx2.close();
  assert.deepEqual(errors,[]);console.log('PASS mobile touch tutorial, all poses, persisted identity, furniture, wearable, virtual/real stamps, GPS consent / override / cleanup / denial, selected photo and PNG export, transit map and hosted tile integration with fixture, 4 widths, offline PWA, skip/replay.');
} finally {await browser.close();server.close();}
