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
const nextVersion='fedcba9876543210';
let secondRelease=false;
const server=createServer(async (req,res)=>{
  const path=new URL(req.url,'http://127.0.0.2').pathname;
  const name=path==='/'?'index.html':path.slice(1);
  try {
    let bytes=await readFile(new URL(`dist/${name}`,project));
    if(secondRelease&&name==='sw.js')bytes=bytes.toString().replace(/const version = '[a-f0-9]{16}';/,`const version = '${nextVersion}';`);
    if(secondRelease&&name==='index.html')bytes=bytes.toString().replace(/name="app-version" content="[a-f0-9]{16}"/,`name="app-version" content="${nextVersion}"`);
    res.writeHead(200,{...headers,'Content-Type':types[extname(name)] ?? 'application/octet-stream'});res.end(bytes);
  }
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
  assert.equal(await page.getByRole('button',{name:'しぐさ',exact:true}).count(),0);
  await page.getByRole('button',{name:'服',exact:true}).tap();
  await page.getByLabel('衣装の分類').selectOption('home');
  await page.getByLabel('洋服を探す').fill('木綿');
  await page.getByLabel('洋服を探す').press('Enter');
  assert.equal(await page.locator('[data-fitting-value]').count(),1);
  await page.getByRole('button',{name:'木綿の部屋着',exact:true}).tap();
  await page.getByRole('button',{name:'小物',exact:true}).tap();
  await page.getByRole('button',{name:'キャップ',exact:true}).tap();
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
  await page.getByText('この地域でできること').tap();await page.getByText('ここを散策する').tap();await page.getByText('京都府を散策').waitFor();await page.getByRole('button',{name:'景色を眺める'}).tap();await page.getByText('旅人は立ち止まって、風景を眺めました。').waitFor();
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
    const {releasedMotions}=await import('/avatar-rig.js');
    await travelerAssets();
    const table=document.createElement('section');
    table.id='sprite-review';table.style.display='grid';table.style.gridTemplateColumns='repeat(4, 1fr)';table.style.background='#f4e8ce';
    document.querySelector('.atelier-view').after(table);
    for(const [index,skin] of [0,1,3,6,10,16,18,19].entries())for(const hat of [0,1,2,3,4]){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;canvas.style.width='100%';
      const look={design:2,skin,hat,hair:index*2,outfit:index<4?index:index+4,shoes:index%4,glasses:index%2?2:0,eyes:index%5,mouth:index%4,accessory:index%5};
      character(canvas,look,'look',0);
      const cx=canvas.getContext('2d');
      const visible=Array.from(cx.getImageData(28,26,72,90).data).filter((v,i)=>i%4===3&&v>200).length;
      if(visible<1800)throw new Error('Sprite has incomplete face or body for '+JSON.stringify(look));
      table.append(canvas);
    }
    for(const direction of facings)for(const pose of releasedMotions){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;canvas.style.width='100%';canvas.dataset.direction=direction;
      character(canvas,{design:2,hair:9,outfit:8,skin:17,hat:3,shoes:1,glasses:1,accessory:1},pose,8);
      if(!canvas.getContext('2d').getImageData(0,0,128,128).data.some((v,i)=>i%4===3&&v===255))throw new Error('Empty sprite '+direction+' '+pose);
      table.append(canvas);
    }
    for(const direction of facings)for(let hat=1;hat<=4;hat++){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;canvas.style.width='100%';canvas.dataset.direction=direction;
      const look={design:2,hat,hair:14,outfit:10,shoes:3,glasses:2,bag:2};
      character(canvas,look,'look',0);
      const pixels=canvas.getContext('2d').getImageData(0,0,128,128).data;
      if(!pixels.subarray(128*4*80).some((v,i)=>i%4===3&&v>240))throw new Error('Missing feet '+direction+' '+hat);
      if(!pixels.subarray(128*4*5,128*4*33).some((v,i)=>i%4===3&&v>240))throw new Error('Missing headwear '+direction+' '+hat);
      table.append(canvas);
    }
    const avatar={design:2,outfit:11,hair:14,hat:1};
    const paused=document.createElement('canvas');paused.width=paused.height=128;
    character(paused,avatar,'look',12);
    const reference=paused.toDataURL();
    character(paused,avatar,'sleep',12);
    if(paused.toDataURL()!==reference)throw new Error('Unreleased animation was drawn');
  });
  if(process.env.ARTIFACT_DIR)await page.locator('#sprite-review').screenshot({path:process.env.ARTIFACT_DIR+'/sprite-combinations.png'});
  await page.locator('#sprite-review').evaluate(e=>e.remove());
  // Reproduce the teal-fringe and dark-skin reports, then review the
  // newer short styles and every side of their sourced cutouts.
  await page.evaluate(async()=>{
    const {character,travelerAssets}=await import('/traveler-art.js');
    const table=document.createElement('section');table.id='pigment-review';
    table.style.display='grid';table.style.gridTemplateColumns='repeat(4,1fr)';table.style.background='#f4e8ce';
    document.querySelector('.atelier-view').after(table);
    const android={design:2,hair:0,hairTint:'#547f85',skin:14,outfit:11,clothColor:5,hat:4,accessory:4};
    const looks=[
      {...android,hat:0,accessory:0},{...android,skin:19},{...android,skin:6,accessory:2},
      {...android,hair:16,outfit:12,hat:0,accessory:5},
      {...android,hair:17,outfit:13,hairTint:'#373733',skin:1,hat:0,beard:5},
      {...android,hair:18,outfit:14,accessory:1,hat:3}, 
      {...android,hair:19,outfit:15,skin:3,hairTint:'#514940',hat:0,accessory:4},
      {...android,hair:21,outfit:13,skin:19,hairTint:'#d6d3ca',hat:0,beard:4},
      {...android,hair:20,outfit:12,skin:9,hairTint:'#764338',hat:0,accessory:5},
      {...android,hair:22,outfit:15,skin:16,hairTint:'#39433e',hat:0,accessory:2},
      {...android,hair:23,outfit:14,skin:4,hairTint:'#735d8d',hat:0,accessory:4}
    ];
    await Promise.all(looks.map(look=>travelerAssets(look)));
    const mask=async name=>{
      const image=new Image();image.src='/assets/catalog/'+name+'-map.webp';await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
      return (x,y,channel)=>ctx.getImageData(x,y,1,1).data[channel];
    };
    const buzz=await mask('head-cuts-a-v1');
    if(buzz(65,25,0)<248||buzz(65,46,1)<248||buzz(24,88,1)<248||buzz(2*128+21,85,1)<248)
      throw new Error('Buzz cut must keep the scalp, forehead, and visible front/back ears in their authored materials');
    const cloth=await mask('atelier-towns');
    if(cloth(64,32,2)>5||cloth(43,30,2)<248)
      throw new Error('In the overshirt, the chest lining and outer layer must dye independently');
    for(const look of looks)for(const direction of ['south','southeast','east','north']){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;canvas.style.width='100%';canvas.dataset.direction=direction;
      character(canvas,look,'look',0);
      const alpha=canvas.getContext('2d').getImageData(0,0,128,128).data;
      if(!alpha.some((v,i)=>i%4===3&&v===255))throw new Error('Missing color composite '+look.hair+' '+direction);
      table.append(canvas);
    }
  });
  if(process.env.ARTIFACT_DIR){
    const skip=page.getByRole('link',{name:'本文へ移動',includeHidden:true});
    await skip.evaluate(link=>{link.hidden=true;});
    await page.locator('#pigment-review').screenshot({path:process.env.ARTIFACT_DIR+'/pigment-review.png'});
    await skip.evaluate(link=>{link.hidden=false;});
  }
  await page.locator('#pigment-review').evaluate(e=>e.remove());
  await page.getByRole('navigation',{name:'選択肢のページ'}).getByRole('button',{name:'次へ'}).tap();
  await page.getByRole('button',{name:'丸い短いカール',exact:true}).waitFor();
  assert.ok(await page.locator('[data-fitting-value]').count()<=12);
  await page.getByRole('navigation',{name:'選択肢のページ'}).getByRole('button',{name:'前へ'}).tap();
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
  await page.getByText('ベッドのそばで、ひと休み。').waitFor();
  await page.getByRole('button',{name:'家具を使う'}).tap();await page.getByRole('button',{name:'木の本棚'}).tap();
  await page.getByText('旅の本をめくりました。').waitFor();if(process.env.ARTIFACT_DIR)await page.waitForTimeout(2000);await shot('house-play');
  await visit('#avatar');await page.getByRole('button',{name:'服',exact:true}).tap();
  assert.equal(await page.getByRole('button',{name:'木綿の部屋着'}).getAttribute('aria-pressed'),'true');

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
  await page.getByRole('button',{name:'あじさいの鉢',exact:true}).tap();
  await stage.focus();await stage.press('ArrowDown');await stage.press('ArrowLeft');await stage.press('Enter');
  await page.getByText('あじさいの鉢を置きました。').waitFor();
  await page.getByRole('button',{name:'＋ 広げる'}).tap();
  await page.waitForURL('**/#decorate/studio');
  await page.getByRole('link',{name:'小さな離れ',exact:true}).waitFor();
  await page.getByRole('button',{name:'オークの旅机',exact:true}).tap();
  await stage.focus();await stage.press('ArrowUp');await stage.press('ArrowUp');await stage.press('Enter');
  await page.getByText('オークの旅机を置きました。').waitFor();
  await page.getByRole('button',{name:'配置を保存'}).tap();await page.waitForURL('**/#cottage/studio');
  await page.getByRole('button',{name:'家具を使う'}).tap();
  await page.getByRole('button',{name:'オークの旅机',exact:true}).tap();
  await page.getByText('旅先のことを手帖で振り返りました。').waitFor();await shot('materials-house');
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
  await page.getByRole('link',{name:'届いた勲章を見る'}).tap();
  assert.equal(await page.getByText('島風の旅人',{exact:true}).count(),0);
  const mountain=page.locator('[data-medal="mountain-path"]');
  await mountain.getByRole('button',{name:'勲章を受け取る'}).tap();
  await mountain.getByRole('button',{name:'称号にする'}).tap();
  await visit('#cottage');await page.locator('.house-title').getByText('風を聴く登山者').waitFor();
  await visit('#activity');await page.getByText('ほかの体験').tap();await page.locator('[data-kind=nature]').tap();
  await page.locator('[name=pref]').selectOption('JP-13');await page.getByLabel('訪ねた場所').fill('伊豆大島');
  await page.getByRole('button',{name:'記録を確認',exact:true}).tap();
  await page.getByRole('button',{name:'自分の体験として記録'}).tap();
  await page.getByText('大島椿のピンが図鑑に届きました。').waitFor();
  await page.getByRole('link',{name:'図鑑をひらく'}).tap();
  await page.getByText('2 / 21 種').waitFor();await shot('cabinet');
  await page.getByLabel('図鑑で探す').fill('大島');
  await page.getByRole('button',{name:'探す',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelectorAll('.cabinet-shelves article').length===1);
  await page.getByRole('heading',{name:'大島椿のピン'}).waitFor();
  await shot('cabinet-filtered');
  await visit('#decorate/garden');
  const pin=page.locator('[data-furnish="oshima-camellia"]');
  await pin.tap();
  const garden=page.locator('[data-home-view]');
  await garden.focus();
  await garden.press('ArrowDown');await garden.press('ArrowLeft');await garden.press('ArrowLeft');await garden.press('ArrowLeft');await garden.press('Enter');
  await page.getByText('大島椿のピンを置きました。').waitFor();
  await page.getByRole('button',{name:'配置を保存'}).tap();await page.waitForURL('**/#cottage/garden');
  await visit('#avatar');await page.getByRole('button',{name:'小物',exact:true}).tap();
  await page.getByRole('button',{name:'記念品',exact:true}).tap();await page.getByRole('button',{name:'大島椿のピン',exact:true}).tap();
  await page.getByRole('button',{name:'できあがり'}).tap();await page.getByRole('heading',{name:'はるの家'}).waitFor();
  await visit('#medals');await page.getByRole('heading',{name:'島風の旅人'}).waitFor();
  await visit('#activity');await page.getByText('ほかの体験').tap();await page.locator('[data-kind=art]').tap();
  await page.locator('[name=pref]').selectOption('JP-16');await page.getByLabel('訪ねた場所').fill('富山ガラス工房');
  await page.getByRole('button',{name:'記録を確認',exact:true}).tap();
  await page.getByRole('button',{name:'自分の体験として記録'}).tap();
  await page.getByText('水紋ガラスの飾りが図鑑に届きました。').waitFor();
  await page.locator('.memory-card').first().getByRole('button',{name:'絵入りの栞にする'}).tap();
  await page.getByText('添えた記念品　水紋ガラスの飾り').waitFor();
  await page.getByRole('link',{name:'編集する'}).tap();
  await page.getByRole('button',{name:'変更を保存する'}).tap();
  await page.getByText('添えた記念品　水紋ガラスの飾り').waitFor();
  await visit('#medals');await page.getByRole('heading',{name:'手仕事に出会う旅'}).waitFor();
  await visit('#cabinet?kind=regional&topic=craft');
  await page.getByRole('heading',{name:'水紋ガラスの飾り'}).waitFor();
  assert.equal(await page.locator('.cabinet-shelves article').count(),7);
  await shot('crafts');
  await visit('#avatar');await page.getByLabel('髪型を探す').fill('坊主');
  await page.getByRole('button',{name:'坊主',exact:true}).tap();
  await page.getByRole('button',{name:'服',exact:true}).tap();await page.getByLabel('衣装の分類').selectOption('formal');
  await page.getByRole('button',{name:'チャコールのジャケットスーツ'}).tap();await shot('formal');
  await page.getByRole('button',{name:'できあがり'}).tap();await page.getByRole('heading',{name:'はるの家'}).waitFor();
  const cached=await page.evaluate(async()=>{const cache=await caches.open('tsugi-materials-v1');return (await cache.keys()).map(r=>r.url);});
  assert.ok(cached.some(url=>url.includes('head-cuts-a-v1.webp?sha=')));
  assert.ok(cached.some(url=>url.includes('atelier-towns.webp?sha=')));
  await ctx.setOffline(true);await page.reload();
  await page.waitForFunction(()=>Array.from(document.querySelector('[data-home-view]').getContext('2d').getImageData(0,0,4,4).data).some(Boolean));
  await ctx.setOffline(false);

  await visit('#cabinet');
  await page.getByText('地元の話を書き添える').tap();
  await page.locator('#proposal-form [name=place]').fill('海辺の町');await page.getByLabel('品物や伝承の題名').fill('春の木舟');
  await page.getByLabel('伝えたいこと').fill('海辺の春の舟を描きたいです。');
  await page.getByRole('button',{name:'提案の下書きを保存'}).tap();await page.getByText('海辺の町 · 春の木舟').waitFor();
  const proposalDownload=page.waitForEvent('download');await page.getByRole('button',{name:'書き出す'}).tap();
  assert.match((await proposalDownload).suggestedFilename(),/txt$/);
  const ctx2=await browser.newContext({viewport:{width:320,height:680},reducedMotion:'reduce'});const denied=await ctx2.newPage();await denied.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{watchPosition(_ok,fail){setTimeout(fail,10);return 3;},clearWatch(){}}});});await denied.goto(origin+'#activity');await denied.getByText('現在地から候補を探す').click();await denied.getByText('位置情報を取得できません。手入力で記録できます。').waitFor();await ctx2.close();
  await visit('#avatar');
  const version=page.locator('meta[name="app-version"]'), name=page.getByLabel('旅人の名前');
  const oldVersion=await version.getAttribute('content');
  const notice=page.getByRole('complementary',{name:'アプリの更新'});
  assert.equal(await notice.isVisible(),false);
  const otherTab=await ctx.newPage();
  await otherTab.goto(origin+'#cottage');
  await otherTab.getByRole('heading',{name:'はるの家'}).waitFor();
  await name.fill('編集中の名前');
  secondRelease=true;
  await page.evaluate(async()=>{const registration=await navigator.serviceWorker.ready;await registration.update();});
  await notice.waitFor();
  assert.equal(await version.getAttribute('content'),oldVersion);
  assert.equal(await name.inputValue(),'編集中の名前');
  await notice.getByRole('button',{name:'あとで'}).tap();
  await notice.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'できあがり'}).tap();
  await page.getByRole('heading',{name:'編集中の名前の家'}).waitFor();
  await otherTab.getByRole('button',{name:'最新版を表示'}).tap();
  await otherTab.getByRole('heading',{name:'編集中の名前の家'}).waitFor();
  assert.equal(await otherTab.locator('meta[name="app-version"]').getAttribute('content'),nextVersion);
  await otherTab.close();
  await page.reload();
  assert.equal(await version.getAttribute('content'),nextVersion);
  await page.getByRole('heading',{name:'編集中の名前の家'}).waitFor();
  await ctx.setOffline(true);await page.reload();
  await page.getByRole('heading',{name:'編集中の名前の家'}).waitFor();
  await ctx.setOffline(false);
  console.log('PASS a deployed update offers reload, preserves edits until the user saves, and keeps records on the new offline shell.');
  assert.deepEqual(errors,[]);console.log('PASS four tabs and direct travel tools, 148 sprite combinations, touch placement and pinch, stamp books, real Toyama schedules and a shared map, private experience confirmation and rewards, companion practice and offline PWA.');
} finally {await browser.close();server.close();}
