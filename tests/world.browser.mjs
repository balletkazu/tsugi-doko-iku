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
  page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack);});
  let starts=0,stops=0;
  await page.exposeFunction('testStart',()=>starts++);await page.exposeFunction('testStop',()=>stops++);
  await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{
    getCurrentPosition(ok){setTimeout(()=>ok({coords:{latitude:36.62,longitude:137.19,accuracy:8}}),25);},
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
  await page.getByLabel('旅人の名前').fill('はる');
  await page.getByRole('button',{name:'髪・肌',exact:true}).tap();
  await page.getByRole('button',{name:'髪色',exact:true}).tap();
  await page.getByRole('button',{name:'亜麻',exact:true}).tap();
  await page.getByRole('button',{name:'しぐさ',exact:true}).tap();
  const poses=await page.locator('[data-fitting-value]').evaluateAll(nodes=>nodes.map(node=>node.dataset.fittingValue));
  assert.equal(poses.length,12);
  for(const value of poses)await page.locator('[data-fitting-value="'+value+'"]').tap();
  await page.getByRole('button',{name:'髪・肌',exact:true}).tap();
  await page.getByRole('button',{name:'髪色',exact:true}).tap();
  await shot('avatar');await page.getByText('この姿で家へ').tap();await page.getByRole('heading',{name:'はるの家'}).waitFor();
  await page.getByRole('button',{name:'床をタップして旅人を移動'}).tap();await shot('house');
  await page.locator('.stage-guide').getByText('地図をひらく').tap();await page.locator('#pref-choice').selectOption('JP-26');await page.getByRole('heading',{name:'京都府'}).waitFor();
  assert.equal(await page.locator('#pref-choice option').count(),47);await shot('atlas');
  await page.getByText('ここを散策する').tap();await page.getByText('京都府を散策').waitFor();await page.getByRole('button',{name:'カメラを構える'}).tap();await page.getByText('旅人は風景にカメラを向けました。').waitFor();
  await page.getByRole('link',{name:'街へ帰る'}).tap();await page.getByRole('heading',{name:'風待ちの街'}).waitFor();await shot('village');await page.getByRole('button',{name:'広場',exact:true}).tap();
  await page.waitForURL('**/#home');
  await page.getByRole('heading',{name:'旅人のひとこま'}).waitFor();await visit('#village');
  assert.equal(starts,0);assert.equal(tileRequests,0);
  await page.getByText('体験を記録',{exact:false}).tap();await page.getByRole('button',{name:'現在地から候補を探す'}).tap();
  await page.getByRole('button',{name:'徒歩を選ぶ'}).tap();assert.equal(await page.locator('[name=activity]').inputValue(),'walk');
  await page.locator('[name=activity]').selectOption('cafe');await page.locator('[name=pref]').selectOption('JP-16');
  await page.getByLabel('訪ねた場所').fill('駅前の喫茶店');await page.locator('[name=photo]').setInputFiles({name:'camera.png',mimeType:'image/png',buffer:tile});
  await page.getByText('自分の体験として記録').tap();await page.getByRole('heading',{name:'駅前の喫茶店',exact:false}).waitFor();assert.equal(stops,1);
  const saveFile=page.waitForEvent('download');await page.getByText('絵はがきを画像にする').tap();const download=await saveFile;assert.match(download.suggestedFilename(),/png$/);
  await page.getByText('絵入りの栞にする').tap();await page.getByRole('heading',{name:/駅前の喫茶店の旅の栞/}).waitFor();await page.locator('.photo-list img').waitFor();
  await visit('#stamps');
  await page.getByRole('link',{name:'富山県・訪問記録あり'}).waitFor();
  await page.getByRole('link',{name:'京都府',exact:true}).getByText('仮想旅行').waitFor();
  await page.getByRole('link',{name:'富山県・訪問記録あり'}).tap();
  await page.getByRole('button',{name:'現在地をGPSで確認'}).tap();
  await page.getByRole('button',{name:'今日のGPS確認印を押す'}).tap();
  await page.getByText('GPSで範囲を確認', {exact:false}).waitFor();
  await page.locator('[name=date]').fill('2024-03-06');
  await page.getByRole('button',{name:'自己申告でスタンプを押す'}).tap();
  await page.getByText('2024-03-06',{exact:false}).waitFor();
  await visit('#stamps/quasi-park');
  await page.getByRole('link',{name:'御嶽山国定公園',exact:true}).waitFor();
  await page.getByText('自分だけのスタンプ帳を作る').tap();
  await page.getByLabel('スタンプ帳の名前').fill('灯台めぐり');await page.getByLabel('場所を1行に1か所ずつ').fill('海辺の灯台');
  await page.getByRole('button',{name:'スタンプ帳を作る'}).tap();
  await page.getByRole('link',{name:'海辺の灯台'}).waitFor();
  await visit('#decorate');await page.getByLabel('窓の下').selectOption('cup');await page.locator('[name=wallPhoto]').selectOption({index:1});await page.getByText('配置を保存').tap();await page.getByRole('heading',{name:'はるの家'}).waitFor();await page.locator('.floor-item [data-item=cup]').waitFor();
  await page.locator('.wall-photo').waitFor();await visit('#avatar');await page.getByRole('button',{name:'小物',exact:true}).tap();await page.getByRole('button',{name:'記念品',exact:true}).tap();await page.getByRole('button',{name:'陶器のカップ',exact:true}).tap();await page.getByText('できあがり').tap();await page.getByRole('heading',{name:'はるの家'}).waitFor();
  await visit('#shop');
  await page.getByLabel('自分の歩数目標').fill('1000');await page.getByText('目標を保存').tap();
  await page.getByLabel('その日の歩数').fill('1001');await page.getByText('歩数を記録').tap();
  await page.getByText('歩数目標を達成', {exact:false}).waitFor();
  await page.getByRole('button',{name:'12 コインで購入'}).tap();await page.getByRole('button',{name:'所持済み',exact:true}).waitFor();
  await visit('#companions');
  await page.getByLabel('おおまかな行き先').fill('伏見の水辺');await page.getByRole('button',{name:'この端末に募集を保存'}).tap();
  await page.getByRole('heading',{name:/伏見の水辺/}).waitFor();
  await page.getByRole('button',{name:'すみれのおともに'}).tap();await page.getByRole('heading',{name:'おともから届いた絵はがき'}).waitFor();
  const card=page.waitForEvent('download');await page.getByRole('button',{name:'絵はがきを保存する'}).tap();assert.match((await card).suggestedFilename(),/png$/);
  await page.getByRole('button',{name:'ありがとうを残す'}).tap();await page.getByText('ありがとうを記録済み').waitFor();
  await visit('#home?feed=companions');await page.getByRole('heading',{name:/伏見の水辺/}).waitFor();
  await visit('#atlas?pref=JP-26&view=map');await page.waitForFunction(()=>document.querySelector('.tile-widget canvas'));await page.getByLabel('地図を拡大').tap();assert.ok(tileRequests>0);
  await visit('#pilot');await page.getByLabel('日付',{exact:true}).fill('2026-11-25');await page.getByLabel('路面電車とバスの両方を使う').check();await page.locator('[name=order]').selectOption('fare');
  await page.getByText('経路を検索',{exact:true}).tap();await page.locator('.pilot-result').first().waitFor();await page.getByText('実際の地図で見る').first().tap();await page.locator('details[data-route-legs][open] canvas').first().waitFor();
  for (const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});for(const hash of ['#village','#atlas','#avatar','#activity','#memories','#menu','#pilot','#home','#shop','#companions','#stamps']){await visit(hash);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width+hash);}}
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);await ctx.setOffline(true);
  await visit('#companions');await page.getByText('街の住人を連れていく練習').tap();await page.locator('[name=guest][value=clover]').check();await page.getByText('試遊の旅を終えて絵はがきを受け取る').tap();await page.getByText('よつばとの思い出').waitFor();
  await visit('#cottage');await page.reload();await page.getByRole('heading',{name:'はるの家'}).waitFor();await page.locator('[data-item=cup]').waitFor();
  await visit('#memories');await page.locator('[data-memory-photo]').waitFor();await page.reload();await page.getByRole('heading',{name:/駅前の喫茶店/}).waitFor();
  await visit('#pilot');await page.getByText('経路を検索',{exact:true}).tap();await page.locator('#pilot-results').waitFor();await ctx.setOffline(false);
  await visit('#welcome');await page.getByText('案内をスキップ').tap();await page.getByRole('heading',{name:'風待ちの街'}).waitFor();await page.reload();await page.getByRole('heading',{name:'風待ちの街'}).waitFor();
  const ctx2=await browser.newContext({viewport:{width:320,height:680},reducedMotion:'reduce'});const denied=await ctx2.newPage();await denied.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{watchPosition(_ok,fail){setTimeout(fail,10);return 3;},clearWatch(){}}});});await denied.goto(origin+'#activity');await denied.getByText('現在地から候補を探す').click();await denied.getByText('位置情報を取得できません。手入力で記録できます。').waitFor();await ctx2.close();
  assert.deepEqual(errors,[]);console.log('PASS touch stage and dressing, personal stamp book, hand-entered and GPS visits, coin purchase and reward, companion invitation and gratitude, photo and travel booklet, four viewport widths, Toyama maps and offline PWA.');
} finally {await browser.close();server.close();}
