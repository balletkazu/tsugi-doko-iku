import {escapeHtml as e} from './core.js';
import {icon} from './ui.js';
import {places} from './data.js';
import {update,importPhoto} from './storage.js';
import {parts,avatarDefaults,avatarFrom,activities,prefectures,regions,inventory,items,starterSlots,estimateActivity,newEntry} from './world-data.js';
import {dressingRoom,mountDressing} from './dressing-room.js';
import {gameStage,mountStage} from './game-stage.js';
import {animateWorld,character} from './world-art.js';
import {economy,reward,purchase,recordSteps,shopScreen,lifeTrips,companionScreen,parseInvitation,addDemoJoin,completeDemoHost,downloadCompanionPostcard,mountLife,dateInJapan} from './travel-life.js';
import {nearbyTransport,toyamaMobility} from './mobility.js';
import {playRoomSound} from './room.js';
import {atlas,practicalMap,practicalMarkup} from './world-map.js';

const destinations=[
  ['#home','広場','旅人の写真と投稿','heart'],['#pilot','駅','富山市の乗換案内','route'],['#discover','旅行案内所','旅先と寄り道','compass'],
  ['#my?view=list','図書館','日記と旅の栞','book'],['#photos','アトリエ','写真の取り込み・投稿下書き','edit'],
  ['#stamps','博物館','訪問スタンプ帳','stamp'],['#companions','おとも旅','旅の募集とおみやげ','send'],['#mail','郵便局','旅のお知らせ','send'],['#shop','旅の店','コイン・歩数・道具','stamp'],['#memories','美術館','自分の旅の絵日記','pin']
];
const guideText=['はじめまして！','この世界には、まだあなたの知らない場所がたくさんあります。','これから一緒に、いろんな場所へ旅に出て、いろんなものに出会いましょう。'];
const person=(pose='look',extra='')=>`<canvas data-person data-pose="${pose}" width="96" height="96" aria-hidden="true" ${extra}></canvas>`;
const btn=(op,label,cls='world-btn')=>`<button type="button" data-world="${op}" class="${cls}">${label}</button>`;
const a=(url,label,cls='world-btn alt')=>`<a href="${e(url)}" class="${cls}">${label}</a>`;
const stepLink=(url,name,sub,glyph)=>`<a href="${e(url)}" class="world-door"><i>${icon(glyph)}</i><span><strong>${name}</strong><small>${sub}</small></span><b aria-hidden="true">›</b></a>`;
const itemCanvas=id=>`<canvas width="32" height="32" data-item="${id}" aria-hidden="true"></canvas>`;
const frame=(label,title,body)=>`<section class="world"><header class="world-heading"><div><p>${label}</p><h1>${title}</h1></div><span class="compass-seal" aria-hidden="true">✧</span></header>${body}</section>`;
const art=(kind,inside='',variant=kind)=>`<div class="world-scene ${kind}"><img src="./assets/world/${variant}.webp" width="900" height="450" alt="${{north:'雪山と冬の白樺林',spring:'桜並木と列車の走る橋',maple:'紅葉の谷にある鳥居',island:'夏の島の砂浜と小さな船',village:'海を望む街。線路の橋を小さな列車が渡る',cottage:'木の床と、草花を飾った丸窓のある家',trail:'野花の咲く道から島々と山並みを望む'}[variant]}">${inside}</div>`;
const characterSpot=(pose,extra='')=>`<div class="scene-person">${person(pose,extra)}</div>`;
const choice=(v,label,selected)=>`<option value="${e(v)}" ${selected?'selected':''}>${e(label)}</option>`;
const selectPref=(value,optional=false)=>(optional?choice('','記録しない',!value):'')+regions.map(region=>`<optgroup label="${region}">${prefectures.filter(p=>p.region===region).map(p=>choice(p.id,p.name,p.id===value)).join('')}</optgroup>`).join('');
const stamp=(text)=>`<span class="field-stamp"><span>✧</span>${e(text)}</span>`;
const dateLabel=date=>new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'short',day:'numeric'}).format(date);
const byId=id=>prefectures.find(p=>p.id===id);
const guideFooter=()=>btn('skip','案内をスキップ','world-text');
const where=(entry)=>[byId(entry.pref)?.name,entry.place].filter(Boolean).join('・')||'旅先';
const entryText=(entry)=>`${where(entry)}で${activities[entry.activity][0]}を体験した。${items[activities[entry.activity][2]]}を旅の記念に持ち帰った。`;

export function createWorld(root,{go,notify,profile,onRecords}){
  let game={},clean=()=>{},busy=false,detected=null,stopLocation=()=>{},stopMotion=()=>{},motionActive=false,motionHint='';
  const avatar=()=>({...avatarFrom(game.avatar??avatarDefaults),pin:inventory(game).includes(game.pin)?game.pin:null});
  const entries=()=>game.entries??[];
  const slots=()=> (game.slots??starterSlots).map(id=>inventory(game).includes(id)?id:null);
  const save=async(change,done)=>{
    if(busy)return;
    busy=true;
    try{game=await update('world',(latest={})=>change(latest));done?.();}
    catch(error){notify(error instanceof DOMException?'保存できませんでした。ブラウザーの空き容量と保存設定をご確認ください。':error.message);}
    finally{busy=false;}
  };
  function intro(){
    return frame('旅の手帖をひらく','旅のはじまり',art('trail',characterSpot('walk'))+
      `<div class="letter"><span class="folio">はじめの一歩　1 / 3</span><h2>${guideText[0]}</h2><p>${guideText[1]}</p><div class="world-actions">${a('#avatar?guide=1','旅人をつくる　→','world-btn')}${guideFooter()}</div></div>`);
  }
  function village(){
    return gameStage('street','風待ちの街',avatar());
  }
  function editor(guided){
    return dressingRoom(avatar(),inventory(game).filter(id=>!['books','plant'].includes(id)),guided);
  }
  function wallPhoto(){
    return entries().some(x=>x.id===game.wallPhoto && x.photo)?`<img class="wall-photo" data-memory-photo="${e(game.wallPhoto)}" alt="家に飾った旅の写真">`:'';
  }
  function cottage(guided){
    const guide=guided?`<section class="stage-guide"><p>${guideText[2]}</p><div class="world-actions">${a('#atlas?guide=1','地図をひらく　→','world-btn')}${guideFooter()}</div></section>`:'';
    const objects=wallPhoto()+slots().map((id,i)=>id?`<a href="#decorate" aria-label="${items[id]}の配置を変える" class="floor-item pos-${i}">${itemCanvas(id)}</a>`:'').join('');
    return gameStage('inside',avatar().name+'の家',avatar(),objects,guide);
  }
  function decorate(){
    const contents=slots(), owned=inventory(game);
    return frame('自分の家','部屋の模様替え',art('cottage',wallPhoto()+contents.map((id,i)=>`<div class="floor-item pos-${i}">${id?itemCanvas(id):''}</div>`).join(''))+`<form id="decor-form" class="world-form"><p>飾りたいものを場所ごとに選んでください。体験を記録すると、新しい記念品が届きます。</p><label>壁に飾る旅の写真<select name="wallPhoto">${choice('','飾らない',!game.wallPhoto)}${entries().filter(x=>x.photo).map(x=>choice(x.id,dateLabel(x.date)+'　'+where(x),x.id===game.wallPhoto)).join('')}</select></label><div class="wardrobe">${['本棚の前','窓の下','ベッドのそば'].map((label,i)=>`<label>${label}<select name="slot${i}" aria-label="${label}">${choice('','空けておく',!contents[i])}${owned.map(id=>choice(id,items[id],id===contents[i])).join('')}</select></label>`).join('')}</div><div class="world-actions"><button class="world-btn">配置を保存</button>${a('#cottage','家へ戻る','world-text')}</div></form>`);
  }
  function mapPage(params){
    const pref=byId(params.get('pref'))??byId(game.lastPref)??prefectures[15], real=params.get('view')==='map',guided=params.get('guide')==='1';
    const url=(view,p=pref.id)=>'#atlas?'+new URLSearchParams({pref:p,...(view?{view}:{}),...(guided?{guide:'1'}:{})});
    const explored=(game.explored??[]).includes(pref.id);
    return frame('旅の手帖','日本の旅地図',`<div class="atlas-card"><div class="map-tabs">${a(url(''),'絵地図',real?'':'active')}${a(url('map'),'実用地図',real?'active':'')}</div>
      ${real?practicalMarkup(pref.name+'の実用地図'):`<canvas id="japan-map" width="600" height="490" role="img" aria-label="日本列島の絵地図。下の一覧から都道府県を選択できます"></canvas>`}
      <div class="atlas-foot"><label>行き先<select id="pref-choice">${selectPref(pref.id)}</select></label><span>${explored?'散策済み':'未散策'}</span></div></div>
      <div class="letter"><h2>${e(pref.name)}</h2><p>絵地図での散策は「仮想の旅」に残ります。</p><div class="world-actions">${btn('explore','ここを散策する　→')}${guided?guideFooter():a('#memories','旅の足あと','world-text')}</div></div>
      <small class="map-credit">絵地図の地形　<a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a> · 目印は県庁所在地付近</small>`);
  }
  function trail(id){
    const p=byId(id)??prefectures[15];
    return frame('仮想の旅',p.name+'を散策',art('trail',characterSpot('walk'),({'北海道':'north','東北':'north','関東':'spring','中部':'spring','近畿':'maple','中国':'maple','四国':'island','九州・沖縄':'island'})[p.region])+`<div class="world-actions">${[['walk','小道を歩く'],['photo','カメラを構える'],['sit','ひと休み']].map(([pose,label])=>`<button type="button" class="world-btn alt" data-world="field-action" data-pose="${pose}">${label}</button>`).join('')}</div><p id="field-voice" role="status"></p><section class="letter"><div class="stamp-row">${stamp(p.name)}<div><small>散策のしるし</small><h2>${p.name}の一頁</h2></div></div><p>地方と四季をもとに描いた創作の風景です。この印は仮想の旅の記録です。</p><div class="world-actions">${a('#atlas?pref='+p.id,'地図に戻る','world-btn')}${a('#village','街へ帰る')}</div></section>`);
  }
  function activity(){
    return frame('現実の旅・自分だけ','体験を持ち帰る',`<div class="sensor-card"><h2>いま、何をしている？</h2><p>測位中だけ速度と標高から候補を出します。座標は保存・送信せず、画面を閉じると測位を止めます。</p>${btn('sense','現在地から候補を探す','world-btn alt')} <span id="sense-status" role="status"></span><div>${btn('motion','動きセンサーを試す','world-text')} <small id="motion-status" role="status"></small></div></div>
      <form id="activity-form" class="world-form"><label>体験<select name="activity" required>${choice('','体験を選ぶ',true)}${Object.entries(activities).map(([id,[label]])=>choice(id,label,false)).join('')}</select></label>
      <div class="activity-preview">${person('look')}<p id="activity-label">体験を選ぶと、旅人も動きます。</p></div>
      <div class="wardrobe"><label>都道府県（任意）<select name="pref">${selectPref('',true)}</select></label><label>訪ねた場所（任意）<input name="place" maxlength="80" placeholder="例：海辺のカフェ"></label></div>
      <label>絵日記に載せる写真（任意）<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif"><small>1枚・20MBまで。絵日記全体の写真は圧縮後24MBまで。位置情報は除去します。</small></label>
      <p class="muted">自分で体験した内容を確認して保存してください。</p><button class="world-btn">自分の体験として記録</button></form>`);
  }
  function memories(){
    return frame('自分だけの冒険記録','旅の絵日記',`<div class="world-actions">${a('#activity','体験を記録　＋','world-btn')}${a('#journal/new','自由に日記を書く')}</div>
      <h2>現実の旅 <small>${entries().length}件</small></h2>${entries().length?entries().map(entry=>`<article class="memory-card">${entry.photo?`<img data-memory-photo="${e(entry.id)}" alt="自分で選んだ旅の写真">`:''}<div class="memory-body">${person(activities[entry.activity][1],`data-entry="${e(entry.id)}" data-activity="${entry.activity}"`)}<div><small>${dateLabel(entry.date)} · 本人が記録</small><h3>${e(where(entry))}</h3><p>${e(entryText(entry))}</p></div></div><div class="world-actions">${btn('export','絵はがきを画像にする','world-text').replace('data-world','data-id="'+e(entry.id)+'" data-world')}${btn('booklet','絵入りの栞にする','world-text').replace('data-world','data-id="'+e(entry.id)+'" data-world')}${btn('remove','この記録を削除','world-text').replace('data-world','data-id="'+e(entry.id)+'" data-world')}</div></article>`).join(''):'<p class="letter">旅先で見たもの、食べたもの。最初の体験を記録すると、ここに絵日記が届きます。</p>'}
      <h2>仮想の旅 <small>${(game.explored??[]).length} / 47</small></h2><div class="world-actions">${(game.explored??[]).map(id=>a('#trail/'+id,stamp(byId(id)?.name??''),'stamp-link')).join('')||a('#atlas','絵地図をひらく')}</div>`);
  }
  function menu(){
    return frame('風待ちの街','旅のメニュー',`<div class="door-grid">${[['#village','街へ','広場と駅','home'],['#cottage','自分の家','着替え・模様替え','home'],['#atlas','日本の旅地図','47都道府県を散策','compass'],['#activity','体験を記録','現実の旅を持ち帰る','pin'],...destinations,['#route','行き方','富山とその他の地域','route'],['#nearby','寄り道','掲載スポットを探す','pin'],['#medals','メダル','旅の記念','stamp'],['#type','旅人タイプ','鏡の問いかけ','compass'],['#room-settings','音と動き','演出の設定','edit'],['#welcome','チュートリアル','最初の案内を再確認','book']].map(d=>stepLink(...d)).join('')}</div>`);
  }
  function screen(name,id,params){
    if(name==='village'&&!game.started)return intro();
    switch(name){
      case 'village':return village();case 'welcome':return intro();case 'avatar':return editor(params.get('guide')==='1');case 'cottage':return cottage(params.get('guide')==='1');
      case 'decorate':return decorate();case 'atlas':return mapPage(params);case 'trail':return (game.explored??[]).includes(id)?trail(id):mapPage(params);
      case 'shop':return shopScreen(game);case 'companions':return companionScreen(game);
      case 'activity':return activity();case 'memories':return memories();case 'menu':return menu();
    }
  }
  function renderActivity(id,tentative=false){
    const c=root.querySelector('.activity-preview canvas');if(!c)return;
    c.dataset.pose=activities[id]?.[1]??'look';c.dataset.activity=id;
    character(c,avatar(),c.dataset.pose,0,id);
    root.querySelector('#activity-label').textContent=activities[id]?(tentative?`旅人の動きの候補「${activities[id][0]}」。`:`旅人も「${activities[id][0]}」を体験します。`):'体験を選ぶと、旅人も動きます。';
  }
  async function motion(button){
    if(motionActive){stopMotion();return;}
    const status=root.querySelector('#motion-status'),sensor=window.DeviceMotionEvent;
    if(!sensor){status.textContent='この端末では利用できません。';return;}
    try{
      if(typeof sensor.requestPermission==='function' && await sensor.requestPermission()!=='granted'){status.textContent='許可がないため使用しません。';return;}
      if(!button.isConnected||document.hidden)return;
      let samples=0,total=0;
      const receive=event=>{
        const v=event.acceleration;
        if(!v||![v.x,v.y,v.z].every(Number.isFinite))return;
        total+=Math.hypot(v.x,v.y,v.z);
        if(++samples>=10){motionHint=total/samples>1.2?'端末の揺れを検出':'端末の揺れは小さめ';status.textContent=motionHint+'（参考）';samples=0;total=0;}
      };
      motionActive=true;status.textContent='動きセンサーの計測値を待っています。';button.textContent='動きセンサーを止める';
      window.addEventListener('devicemotion',receive);const timer=setTimeout(()=>stopMotion(),60000);
      stopMotion=()=>{window.removeEventListener('devicemotion',receive);clearTimeout(timer);motionActive=false;motionHint='';button.textContent='動きセンサーを試す';status.textContent='計測を終了しました。';stopMotion=()=>{};};
    }catch{status.textContent='この端末では計測できません。';}
  }
  function sense(button){
    if(button.dataset.active){stopLocation();return;}
    const status=root.querySelector('#sense-status');
    if(!navigator.geolocation){status.textContent='この端末では測位できません。体験を手入力できます。';return;}
    let previous=null,watch,timeout,active=true,network=null;
    const observations=[];
    toyamaMobility().then(result=>{if(active)network=result;}).catch(()=>{});
    button.dataset.active='1';button.textContent='測位を止める';status.textContent='測位しています…';
    stopLocation=()=>{active=false;if(watch!==undefined)navigator.geolocation.clearWatch(watch);clearTimeout(timeout);previous=null;observations.length=0;detected=null;delete button.dataset.active;button.textContent='現在地から候補を探す';status.textContent='測位を終了しました。';stopLocation=()=>{};};
    watch=navigator.geolocation.watchPosition(position=>{
      if(!active)return;
      const {latitude:lat,longitude:lon,accuracy,speed,altitude:alt,altitudeAccuracy:altError}=position.coords;
      const current={lat,lon,accuracy,speed,alt,altError,time:position.timestamp};
      const next=estimateActivity(previous,current);previous=current;
      observations.push(current);
      if(observations.length>3)observations.shift();
      const candidates=nearbyTransport(observations,network);
      if(!next.kind&&candidates.length===1){
        next.kind=candidates[0];next.confidence='低';next.reason='富山の公開経路に沿っています。同行している交通手段をご確認ください。';
      }else if(!next.kind&&candidates.length>1){
        next.reason='富山のバスと路面電車の経路が近いため、実際に乗った交通手段を選んでください。';
      }
      const near=accuracy<=80?places.find(p=>Math.hypot((p.lat-lat)*111200,(p.lng-lon)*111200*Math.cos(lat*Math.PI/180))+accuracy<250):null;
      if(!next.kind&&near&&observations.length>=2&&Number.isFinite(speed)&&speed<2){
        next.kind='tour';next.confidence='低';next.reason='掲載地点の近くです。観光中かどうかはご自身で選べます。';
      }
      detected=next.kind;
      if(!root.querySelector('#activity-form [name=activity]').value&&detected)renderActivity(detected,true);
      status.replaceChildren(document.createTextNode(`確信度：${next.confidence}。 ${next.reason}${motionHint?' '+motionHint+'。':''}${near?' 掲載地点「'+near.name+'」の近辺です。':''}`));
      if(detected){const use=document.createElement('button');use.type='button';use.className='world-text';use.dataset.world='use-detection';use.textContent=activities[detected][0]+'を選ぶ';status.append(use);}
    },()=>{if(active){stopLocation();status.textContent='位置情報を取得できません。手入力で記録できます。';}},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
    timeout=setTimeout(()=>{if(active)stopLocation();},60000);
  }
  function hydrate(name,params){
    const reduced=profile().effects?.motion===false || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revokes=[];let closeMap=()=>{};
    for(const c of root.querySelectorAll('[data-entry]'))c._avatar=entries().find(x=>x.id===c.dataset.entry)?.avatar;
    const actor=root.querySelector('.stage-player canvas');
    if(actor)actor._avatar=avatar();
    mountDressing(root,avatar());
    const closeStage=mountStage(root,go,reduced);
    const stopArt=animateWorld(root,avatar(),reduced);
    mountLife(root,avatar());
    for(const img of root.querySelectorAll('[data-memory-photo]')){const blob=entries().find(x=>x.id===img.dataset.memoryPhoto)?.photo;if(blob){img.src=URL.createObjectURL(blob);revokes.push(img.src);}}
    const selector=root.querySelector('#pref-choice');
    if(selector){const p=byId(selector.value),canvas=root.querySelector('#japan-map');if(canvas)atlas(canvas,p.id,id=>changePref(id,params));else closeMap=practicalMap(root.querySelector('.tile-widget'),[p.lat,p.lon]);}
    clean=()=>{stopArt();closeStage();stopLocation();stopMotion();closeMap();revokes.forEach(url=>URL.revokeObjectURL(url));};
  }
  function changePref(id,params=new URLSearchParams(location.hash.split('?')[1])){params.set('pref',id);go('#atlas?'+params);}
  root.addEventListener('change',event=>{
    const el=event.target;
    if(el.dataset.world==='companion-consent')save(g=>({...g,companions:{...lifeTrips(g),automatic:el.checked}}));
    if(el.id==='pref-choice')changePref(el.value);
    if(el.matches('#activity-form [name=activity]'))renderActivity(el.value);
    if(el.matches('#decor-form select[name^=slot]')){const pos=Number(el.name.slice(-1));const dest=root.querySelector('.floor-item.pos-'+pos);dest.innerHTML=el.value?itemCanvas(el.value):'';animateWorld(dest,avatar(),true);}
  });
  root.addEventListener('submit',async event=>{
    const form=event.target, fields=new FormData(form),sourceHash=location.hash;
    const afterSave=hash=>{if(form.isConnected&&location.hash===sourceHash)go(hash);};
    if(form.dataset.hostDraft){
      const id=form.dataset.hostDraft;
      await save(g=>{
        const trips=completeDemoHost(lifeTrips(g),id,fields.getAll('guest'));
        return {...g,companions:trips,economy:reward(economy(g),'practice-host:'+id,8,'試遊のおともを連れた旅')};
      },()=>afterSave('#companions'));
      return;
    }
    if(!['avatar-form','activity-form','decor-form','step-goal','step-log','companion-draft'].includes(form.id))return;
    event.preventDefault();
    if(form.id==='step-goal'){
      const goal=Number(fields.get('goal'));
      if(Number.isInteger(goal)&&goal>=100&&goal<=100000)await save(g=>({...g,economy:{...economy(g),goal}}),()=>notify('歩数目標を保存しました。'));
      return;
    }
    if(form.id==='step-log'){
      const date=fields.get('date'),value=Number(fields.get('steps'));
      await save(g=>({...g,economy:recordSteps(economy(g),date,value)}),()=>{afterSave('#shop');notify('歩数を記録しました。');});
      return;
    }
    if(form.id==='companion-draft'){
      try{
        const invitation={...parseInvitation(fields),id:crypto.randomUUID()};
        await save(g=>{const trips=lifeTrips(g);return {...g,companions:{...trips,drafts:[invitation,...trips.drafts]}};},()=>afterSave('#companions'));
      }catch(error){notify(error.message);}
      return;
    }
    if(form.id==='avatar-form'){const draft=form.readAppearance();const who=avatarFrom(draft);const pin=draft.pin;await save(g=>({...g,avatar:who,pin:inventory(g).includes(pin)?pin:null}),()=>afterSave(form.dataset.guide==='true'?'#cottage?guide=1':'#cottage'));return;}
    if(form.id==='decor-form'){
      const values=[0,1,2].map(i=>fields.get('slot'+i)||null);
      if(new Set(values.filter(Boolean)).size!==values.filter(Boolean).length){notify('同じ記念品は一か所に飾れます。');return;}
      await save(g=>({...g,wallPhoto:(g.entries??[]).some(x=>x.id===fields.get('wallPhoto')&&x.photo)?fields.get('wallPhoto'):null,slots:values.map(v=>inventory(g).includes(v)?v:null)}),()=>afterSave('#cottage'));return;
    }
    if(form.dataset.saving)return;
    const subject=fields.get('activity'),file=fields.get('photo'),button=event.submitter;form.dataset.saving='1';if(button)button.disabled=true;
    try{
      const photo=file?.size?await importPhoto(file):null;
      const entry=newEntry({activity:subject,place:fields.get('place'),pref:fields.get('pref'),photo,avatar:avatar(),date:Date.now(),id:crypto.randomUUID()});
      await save(g=>{
        const prior=g.entries??[];
        if(photo && prior.reduce((n,x)=>n+(x.photo?.size??0),photo.size)>24*1024*1024)throw new Error('絵日記の写真は合計24MBまでです。写真を外すか、不要な記録を整理してください。');
        return {...g,entries:[entry,...prior],economy:reward(economy(g),'trip:'+dateInJapan(new Date(entry.date))+':'+entry.activity,12,'現実の旅の記録')};
      },()=>{if(form.isConnected)go('#memories');notify(items[activities[subject][2]]+'を持ち帰りました。');});
    }catch(err){notify(err.message);}finally{delete form.dataset.saving;if(button)button.disabled=false;}
  });
  root.addEventListener('click',async event=>{
    const b=event.target.closest('[data-world]');if(!b)return;
    switch(b.dataset.world){
      case 'buy':await save(g=>({...g,economy:purchase(economy(g),b.dataset.id)}),()=>{go('#shop');notify(items[b.dataset.id]+'を購入しました。');});break;
      case 'close-draft':await save(g=>{const trips=lifeTrips(g);return {...g,companions:{...trips,drafts:trips.drafts.map(d=>d.id===b.dataset.id?{...d,closed:true}:d)}};},()=>go('#companions'));break;
      case 'demo-join':await save(g=>{
        const trips=addDemoJoin(lifeTrips(g),b.dataset.id);
        return {...g,companions:trips,economy:reward(economy(g),'practice:'+dateInJapan()+':'+b.dataset.id,5,'試遊のおとも旅')};
      },()=>go('#companions'));break;
      case 'thank-companions':await save(g=>{const trips=lifeTrips(g);return {...g,companions:{...trips,thanks:[...new Set([...trips.thanks,b.dataset.id])]}};},()=>go('#companions'));break;
      case 'demo-postcard':try{await downloadCompanionPostcard(b.closest('.companion-postcard'));}catch(error){notify(error.message);}break;
      case 'field-action':{const c=root.querySelector('.scene-person canvas');const pose=b.dataset.pose;c.dataset.pose=pose;character(c,avatar(),pose);root.querySelector('#field-voice').textContent={walk:'小道に足を進めました。',photo:'旅人は風景にカメラを向けました。',sit:'腰を下ろして、景色を眺めています。'}[pose];break;}
      case 'skip':await save(g=>({...g,started:true}),()=>go('#village'));break;
      case 'explore':{playRoomSound(profile(),'stamp');const id=root.querySelector('#pref-choice').value;await save(g=>({...g,started:true,lastPref:id,explored:[...new Set([...(g.explored??[]),id])]}),()=>go('#trail/'+id));break;}
      case 'motion':await motion(b);break;
      case 'sense':sense(b);break;
      case 'use-detection':if(detected){root.querySelector('#activity-form [name=activity]').value=detected;renderActivity(detected);}break;
      case 'export':{const entry=entries().find(x=>x.id===b.dataset.id);if(entry)try{await exportCard(entry);}catch{notify('画像を書き出せませんでした。');}break;}
      case 'booklet':{
        if(b.disabled)return;
        const entry=entries().find(x=>x.id===b.dataset.id);if(!entry)return;
        b.disabled=true;
        try{
          const id='world-'+entry.id,photo=await postcard(entry,'image/jpeg');
          const date=new Date(entry.date);
          const formatted=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
          const records=await update('records',(current={trips:[],journals:[]})=>current.trips.some(x=>x.id===id)?current:
            {...current,trips:[{id,title:where(entry)+'の旅の栞',date:formatted,place:where(entry),body:entryText(entry),photos:[photo],updatedAt:Date.now()},...current.trips]});
          onRecords(records);if(b.isConnected)go('#trip/'+id);
        }catch{notify('栞を保存できませんでした。端末の空き容量をご確認ください。');}finally{b.disabled=false;}
        break;}
      case 'remove':if(confirm('この体験と絵日記をこの端末から削除しますか？'))await save(g=>({...g,entries:(g.entries??[]).filter(x=>x.id!==b.dataset.id)}),()=>go('#memories'));break;
    }
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopLocation();stopMotion();}});
  window.addEventListener('pagehide',()=>{stopLocation();stopMotion();});
  return {snapshot:()=>game,visited:()=>new Set(entries().map(x=>x.pref).filter(Boolean)),themes:()=>entries().map(x=>({hike:'山',peak:'山',beach:'海・島',boat:'海・島',spa:'温泉',walk:'自然',photo:'文化・アート'})[x.activity]).filter(Boolean),load:data=>{game=data??{};},screen,hydrate,release:()=>{clean();clean=()=>{};}};
}
async function postcard(entry,mime='image/png'){
  const canvas=document.createElement('canvas');canvas.width=840;canvas.height=780;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#f5ecd6';ctx.fillRect(0,0,840,780);
  const img=new Image();const url=entry.photo?URL.createObjectURL(entry.photo):'./assets/world/trail.webp';
  try{img.src=url;await img.decode();const scale=Math.min(792/img.width,470/img.height);ctx.drawImage(img,(840-img.width*scale)/2,26+(470-img.height*scale)/2,img.width*scale,img.height*scale);}finally{if(entry.photo)URL.revokeObjectURL(url);}
  const sprite=document.createElement('canvas');sprite.width=sprite.height=128;character(sprite,entry.avatar,activities[entry.activity][1],0,entry.activity);ctx.imageSmoothingEnabled=false;ctx.drawImage(sprite,39,511,130,130);
  ctx.fillStyle='#344b43';ctx.font='24px sans-serif';ctx.fillText(dateLabel(entry.date),185,556);ctx.font='bold 38px serif';ctx.fillText(where(entry),185,618,604);
  ctx.font='25px serif';ctx.fillText(activities[entry.activity][0]+'を体験した。',54,688,732);ctx.font='21px sans-serif';ctx.fillText('旅の絵日記　・　'+entry.avatar.name,54,743,732);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,.85));if(!blob)throw new Error('画像を作成できませんでした。');
  return blob;
}
async function exportCard(entry){
  const blob=await postcard(entry);
  const out=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=out;anchor.download='旅の絵はがき.png';anchor.click();setTimeout(()=>URL.revokeObjectURL(out),30000);
}
