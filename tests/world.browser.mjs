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
  page.on('pageerror',error=>{if(!errors.includes(error.message)){errors.push(error.message);console.error(error.stack);}});
  let starts=0,stops=0;
  await page.exposeFunction('testStart',()=>starts++);await page.exposeFunction('testStop',()=>stops++);
  await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{
    getCurrentPosition(ok){setTimeout(()=>ok({coords:{latitude:36.62,longitude:137.19,accuracy:8}}),25);},
    watchPosition(ok){window.testStart();setTimeout(()=>ok({coords:{latitude:36.7,longitude:137.2,accuracy:8,speed:1.2,altitude:null,altitudeAccuracy:null},timestamp:Date.now()}),25);return 99;},clearWatch(){window.testStop();}
  }});});
  const visit=async h=>{await page.evaluate(hash=>location.hash=hash,h);await page.waitForFunction(hash=>location.hash===hash,h);await page.waitForTimeout(120);};
  const shot=async n=>{if(process.env.ARTIFACT_DIR)await page.screenshot({path:process.env.ARTIFACT_DIR+'/rpg-'+n+'.png',animations:'disabled'});};
  const tile=await readFile(new URL('public/assets/icon-192.png',project));let tileRequests=0;
  await page.route('https://cyberjapandata.gsi.go.jp/**',r=>{
    tileRequests++;
    return process.env.TEST_LIVE_GEODATA==='1'?r.continue():r.fulfill({body:tile,contentType:'image/png'});
  });
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
  await page.locator('[data-home-view]').tap({position:{x:190,y:370}});await shot('house');
  await page.getByRole('navigation',{name:'メインナビゲーション'}).getByRole('link',{name:'日本地図'}).tap();await page.locator('#pref-choice').selectOption('JP-26');await page.getByRole('heading',{name:'京都府'}).waitFor();
  await page.getByRole('link',{name:'行きたい場所',exact:true}).tap();
  await page.getByText('行きたい場所 0件').waitFor();
  await page.getByRole('link',{name:'旅の記録',exact:true}).tap();
  await page.getByText('旅の記録 0件').waitFor();
  await page.getByRole('link',{name:'訪問済み',exact:true}).tap();
  assert.equal(await page.locator('#pref-choice option').count(),47);await shot('atlas');
  await page.getByText('この地域でできること').tap();await page.getByText('ここを散策する').tap();await page.getByText('京都府を散策').waitFor();await page.getByRole('button',{name:'カメラを構える'}).tap();await page.getByText('旅人は風景にカメラを向けました。').waitFor();
  await page.getByRole('link',{name:'自分の世界へ'}).tap();
  const tabs=page.getByRole('navigation',{name:'メインナビゲーション'});
  assert.deepEqual(await tabs.getByRole('link').allTextContents(),['自分の世界','みんなの旅','日本地図','旅の計画']);
  await tabs.getByRole('link',{name:'みんなの旅'}).tap();await page.waitForURL('**/#home');
  await page.getByRole('heading',{name:'みんなの旅'}).waitFor();await shot('community');
  await tabs.getByRole('link',{name:'旅の計画'}).tap();await page.getByRole('heading',{name:'旅の計画'}).waitFor();
  assert.equal(starts,0);assert.equal(tileRequests,0);
  await page.getByRole('link',{name:'旅を記録'}).tap();await page.getByRole('button',{name:'現在地から候補を探す'}).tap();
  await page.getByRole('button',{name:'徒歩を選ぶ'}).tap();assert.equal(await page.locator('[name=activity]').inputValue(),'walk');
  await page.locator('[data-kind=cafe]').tap();await page.locator('[name=pref]').selectOption('JP-16');
  await page.getByLabel('訪ねた場所').fill('駅前の喫茶店');await page.locator('[name=photo]').setInputFiles({name:'camera.png',mimeType:'image/png',buffer:tile});
  await page.getByRole('button',{name:'記録を確認',exact:true}).tap();await shot('activity-review');await page.getByText('自分の体験として記録').tap();await page.getByRole('heading',{name:'駅前の喫茶店',exact:false}).waitFor();assert.equal(stops,1);
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
  await visit('#decorate');
  const roomCanvas=page.locator('[data-home-view]');
  await roomCanvas.waitFor();
  assert.equal(await page.locator('#decor-form').count(),0);
  await page.getByRole('button',{name:'陶器のカップ'}).tap();
  const rect=await roomCanvas.boundingBox();
  await roomCanvas.tap({position:{x:rect.width*.34,y:rect.height*.78}});
  await page.getByText('陶器のカップを置きました。',{exact:true}).waitFor();
  await page.getByRole('button',{name:'↻ 回す'}).tap();
  await page.getByRole('button',{name:'写真',exact:true}).tap();
  await page.getByRole('button',{name:'駅前の喫茶店',exact:true}).tap();
  await page.getByRole('button',{name:'配置を保存',exact:true}).tap();
  await page.getByRole('heading',{name:'はるの家'}).waitFor();
  await page.getByRole('button',{name:'家具を使う'}).tap();await page.getByRole('button',{name:'陶器のカップ',exact:true}).waitFor();
  await visit('#avatar');await page.getByRole('button',{name:'小物',exact:true}).tap();await page.getByRole('button',{name:'記念品',exact:true}).tap();await page.getByRole('button',{name:'陶器のカップ',exact:true}).tap();await page.getByText('できあがり').tap();await page.getByRole('heading',{name:'はるの家'}).waitFor();
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
  await visit('#pilot');await page.getByLabel('日付',{exact:true}).fill('2026-11-25');await page.getByText('経路の表示条件').tap();await page.getByLabel('路面電車とバスの両方を使う').check();await page.locator('[name=order]').selectOption('fare');
  await page.getByText('経路を検索',{exact:true}).tap();await page.locator('.pilot-result').first().waitFor();await page.locator('.route-map canvas').waitFor();
  assert.ok(await page.locator('.pilot-result:visible .stop-number').count()>2);
  assert.equal(await page.locator('[data-route-index][aria-pressed=true]').count(),1);if(process.env.ARTIFACT_DIR){
    await page.waitForLoadState('networkidle');await page.locator('#notice').waitFor({state:'hidden'});
    await page.locator('#pilot-results').screenshot({path:process.env.ARTIFACT_DIR+'/route-panel.png',animations:'disabled'});
  }
  await page.getByText('経路の表示条件').tap();await page.getByLabel('路面電車とバスの両方を使う').uncheck();
  await page.locator('[data-walk-minutes="120"]').tap();await page.getByText('経路を検索',{exact:true}).tap();
  const options=page.locator('[data-route-index]');
  assert.ok(await options.count()>1);
  await options.nth(1).tap();
  assert.equal(await options.nth(1).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.route-map canvas').count(),1);
  assert.equal(await page.locator('.pilot-result:visible').count(),1);
  for (const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});for(const hash of ['#village','#atlas','#avatar','#activity','#memories','#plan','#pilot','#home','#shop','#companions','#stamps','#decorate','#type','#cabinet','#cottage/garden']){await visit(hash);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width+hash);}}
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);await ctx.setOffline(true);
  await visit('#companions');await page.getByText('街の住人を連れていく練習').tap();await page.locator('[name=guest][value=clover]').check();await page.getByText('試遊の旅を終えて絵はがきを受け取る').tap();await page.getByText('よつばとの思い出').waitFor();
  await visit('#cottage');await page.reload();await page.getByRole('heading',{name:'はるの家'}).waitFor();await page.getByRole('button',{name:'家具を使う'}).tap();await page.getByRole('button',{name:'陶器のカップ',exact:true}).waitFor();
  await visit('#memories');await page.locator('[data-memory-photo]').waitFor();await page.reload();await page.getByRole('heading',{name:/駅前の喫茶店/}).waitFor();
  await visit('#pilot');await page.getByText('経路を検索',{exact:true}).tap();await page.locator('#pilot-results').waitFor();await ctx.setOffline(false);
  await visit('#welcome');await page.getByText('案内をスキップ').tap();await page.getByRole('heading',{name:'はるの家'}).waitFor();await page.reload();await page.getByRole('heading',{name:'はるの家'}).waitFor();
  await visit('#avatar');
  // Render the reported cap + mouth + skin combinations through the real
  // renderer, and save a contact sheet for manual visual review.
  await page.evaluate(async()=>{
    const {character,travelerAssets,facings}=await import('/traveler-art.js');
    await travelerAssets();
    const table=document.createElement('section');
    table.id='sprite-review';table.style.display='grid';table.style.gridTemplateColumns='repeat(4, 1fr)';table.style.background='#f4e8ce';
    document.querySelector('.atelier-view').after(table);
    for(const [index,skin] of [0,1,3,6,10,16,18,19].entries())for(const hat of [0,1,2,3,4]){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;canvas.style.width='100%';
      const look={design:2,skin,hat,hair:index*2,outfit:index,glasses:index%2?2:0,eyes:index%5,mouth:index%4,accessory:index%5};
      character(canvas,look,'look',0);
      const cx=canvas.getContext('2d');
      const visible=Array.from(cx.getImageData(28,26,72,90).data).filter((v,i)=>i%4===3&&v>200).length;
      if(visible<1800)throw new Error('Sprite has incomplete face or body for '+JSON.stringify(look));
      table.append(canvas);
    }
    for(const direction of facings)for(const pose of ['look','walk','sleep','joy']){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;canvas.style.width='100%';canvas.dataset.direction=direction;
      character(canvas,{design:2,hair:9,outfit:7,skin:17,hat:3,glasses:1,accessory:1},pose,8);
      if(!canvas.getContext('2d').getImageData(0,0,128,128).data.some((v,i)=>i%4===3&&v===255))throw new Error('Empty sprite '+direction+' '+pose);
      table.append(canvas);
    }
  });
  if(process.env.ARTIFACT_DIR)await page.locator('#sprite-review').screenshot({path:process.env.ARTIFACT_DIR+'/sprite-combinations.png'});
  await page.locator('#sprite-review').evaluate(e=>e.remove());
  await page.getByRole('button',{name:'肩までのボブ',exact:true}).tap();await shot('atelier');
  await page.getByRole('button',{name:'右へ回す'}).tap();await page.getByText('右斜め',{exact:true}).waitFor();
  await page.getByRole('button',{name:'右へ回す'}).tap();await page.getByText('右向き',{exact:true}).waitFor();
  await page.getByRole('button',{name:'右へ回す'}).tap();await page.getByText('右斜め後ろ',{exact:true}).waitFor();
  await page.getByRole('button',{name:'右へ回す'}).tap();await page.getByText('背面',{exact:true}).waitFor();await shot('avatar-turn');
  await page.getByRole('button',{name:'顔',exact:true}).tap();await page.getByRole('button',{name:'目',exact:true}).tap();
  await page.getByText('位置・形を微調整').tap();await page.locator('input[data-tuning=gap]').fill('5');await shot('avatar-tune');
  await page.getByRole('button',{name:/コーデを保存/}).tap();await page.getByText('コーデを保存しました。').waitFor();
  await page.getByRole('button',{name:'できあがり'}).tap();await page.getByRole('heading',{name:'はるの家'}).waitFor();
  await page.getByRole('button',{name:'家具を使う'}).tap();await page.getByRole('button',{name:'窓辺のベッド'}).tap();
  await page.getByText('毛布にくるまって、ひと休み。').waitFor();await shot('house-play');

  await visit('#decorate/garden');
  const stage=page.locator('[data-home-view]');
  await stage.waitFor();
  await page.getByRole('button',{name:'睡蓮の小池'}).tap();
  await stage.focus();await stage.press('ArrowDown');await stage.press('ArrowRight');await stage.press('Enter');
  await page.getByText('睡蓮の小池を置きました。').waitFor();await shot('garden-edit');
  await page.getByRole('button',{name:'↻ 回す'}).tap();
  await page.getByRole('button',{name:'片づける'}).tap();
  await page.getByRole('button',{name:'睡蓮の小池'}).waitFor();
  const queue=page.locator('[data-furnish=pond]');
  await queue.scrollIntoViewIfNeeded();
  const a=await queue.boundingBox(), g=await stage.boundingBox();
  const cdp=await ctx.newCDPSession(page);
  const x0=a.x+a.width/2,y0=a.y+a.height/2,x1=g.x+g.width*.53,y1=g.y+g.height*.55;
  const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id}))});
  await touch('touchStart',[[x0,y0]]);
  for(let i=1;i<=14;i++)await touch('touchMove',[[x0+(x1-x0)*i/14,y0+(y1-y0)*i/14]]);
  await touch('touchEnd',[]);
  await page.getByText('睡蓮の小池を置きました。').waitFor();
  const p0=[g.x+g.width*.36,g.y+g.height*.32],p1=[g.x+g.width*.64,g.y+g.height*.32];
  await touch('touchStart',[p0,p1]);await touch('touchMove',[[p0[0]-28,p0[1]],[p1[0]+28,p1[1]]]);await touch('touchEnd',[]);
  await cdp.detach();
  await page.getByText('睡蓮の小池を置きました。').waitFor();
  await tabs.getByRole('link',{name:'旅の計画'}).tap();
  await page.getByRole('heading',{name:'旅の計画'}).waitFor();
  await visit('#decorate/garden');
  assert.equal(await page.locator('[data-furnish=pond]').count(),0);
  await page.getByRole('button',{name:'＋ 広げる'}).tap();
  await page.waitForURL('**/#decorate/studio');
  await page.getByRole('link',{name:'小さな離れ',exact:true}).waitFor();
  await page.getByRole('button',{name:'配置を保存'}).tap();await page.waitForURL('**/#cottage/studio');
  await page.getByRole('link',{name:'庭',exact:true}).tap();await page.getByRole('button',{name:'家具を使う'}).tap();
  await page.getByRole('button',{name:'睡蓮の小池',exact:true}).waitFor();await shot('garden-play');

  await visit('#type');await page.getByRole('button',{name:/絵を選ぶ/}).tap();
  if(process.env.ARTIFACT_DIR)await page.evaluate(async()=>{
    await Promise.all([1,2].map(n=>{const image=new Image();image.src='/assets/atelier/quiz-scenes-'+n+'.webp';return image.decode();}));
  });
  await shot('fortune-question');
  const illustrations=new Set();
  for(let n=0;n<10;n++){
    for(const art of await page.locator('.quiz-art').evaluateAll(nodes=>nodes.map(node=>node.className)))illustrations.add(art);
    await page.locator('[data-omen]').first().tap();
  }
  assert.equal(illustrations.size,40);
  await page.getByRole('heading',{name:'ふたつの旅のかたち'}).waitFor();await shot('fortune-result');
  await page.getByRole('button',{name:'この結果を旅の手帖に残す'}).tap();await page.getByText('結果を旅の手帖に残しました。').waitFor();
  await page.getByRole('button',{name:'もう一度はじめる'}).tap();await page.getByRole('button',{name:'前の結果を見る'}).tap();
  await page.getByRole('heading',{name:'ふたつの旅のかたち'}).waitFor();
  await visit('#activity');await page.locator('[data-kind=hike]').tap();
  await page.locator('[name=pref]').selectOption('JP-16');await page.getByLabel('訪ねた場所').fill('立山 室堂');
  await page.getByRole('button',{name:'記録を確認',exact:true}).tap();await page.getByRole('button',{name:'自分の体験として記録'}).tap();
  await page.getByText('雷鳥の小さな彫刻が図鑑に届きました。').waitFor();
  await page.getByRole('link',{name:'図鑑をひらく'}).tap();
  await page.getByText('1 / 8 種').waitFor();await shot('cabinet');
  await page.getByText('地元の話を書き添える').tap();
  await page.locator('#proposal-form [name=place]').fill('海辺の町');await page.getByLabel('品物や伝承の題名').fill('春の木舟');
  await page.getByLabel('伝えたいこと').fill('海辺の春の舟を描きたいです。');
  await page.getByRole('button',{name:'提案の下書きを保存'}).tap();await page.getByText('海辺の町 · 春の木舟').waitFor();
  const proposalDownload=page.waitForEvent('download');await page.getByRole('button',{name:'書き出す'}).tap();
  assert.match((await proposalDownload).suggestedFilename(),/txt$/);
  const ctx2=await browser.newContext({viewport:{width:320,height:680},reducedMotion:'reduce'});const denied=await ctx2.newPage();await denied.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{watchPosition(_ok,fail){setTimeout(fail,10);return 3;},clearWatch(){}}});});await denied.goto(origin+'#activity');await denied.getByText('現在地から候補を探す').click();await denied.getByText('位置情報を取得できません。手入力で記録できます。').waitFor();await ctx2.close();
  assert.deepEqual(errors,[]);console.log('PASS four tabs and direct travel tools, 72 sprite combinations, touch placement and pinch, stamp books, real Toyama schedules and a shared map, private experience confirmation and rewards, companion practice and offline PWA.');
} finally {await browser.close();server.close();}
