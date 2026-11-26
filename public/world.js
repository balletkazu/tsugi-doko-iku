import {escapeHtml as e} from './core.js';
import {entryKinds} from './stamp-book.js';
import {icon} from './ui.js';
import {places} from './data.js';
import {update,importPhoto} from './storage.js';
import {avatarDefaults,avatarFrom,activities,prefectures,regions,inventory,items,estimateActivity,newEntry} from './world-data.js';
import {homesteadScreen,mountHomestead} from './homestead.js';
import {readHome,validateHome} from './home-layout.js';
import {cabinetScreen,proposal,exportProposal,relicArt} from './cabinet.js';
import {keepsakesFor,regionalItems,eventFor} from './regional-data.js';
import {travelerAssets} from './traveler-art.js';
import {dressingRoom,mountDressing} from './dressing-room.js';
import {gameStage,mountStage} from './game-stage.js';
import {animateWorld,character} from './world-art.js';
import {economy,reward,purchase,recordSteps,shopScreen,lifeTrips,companionScreen,parseInvitation,addDemoJoin,completeDemoHost,downloadCompanionPostcard,mountLife,dateInJapan} from './travel-life.js';
import {nearbyTransport,toyamaMobility} from './mobility.js';
import {playRoomSound} from './room.js';
import {atlas,practicalMap,practicalMarkup} from './world-map.js';

const guideText=['はじめまして！','この世界には、まだあなたの知らない場所がたくさんあります。','これから一緒に、いろんな場所へ旅に出て、いろんなものに出会いましょう。'];
const person=(pose='look',extra='')=>`<canvas data-person data-pose="${pose}" width="96" height="96" aria-hidden="true" ${extra}></canvas>`;
const btn=(op,label,cls='world-btn')=>`<button type="button" data-world="${op}" class="${cls}">${label}</button>`;
const a=(url,label,cls='world-btn alt')=>`<a href="${e(url)}" class="${cls}">${label}</a>`;
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

export function createWorld(root,{go,notify,profile,records,onRecords}){
  let game={},clean=()=>{},busy=false,detected=null,stopLocation=()=>{},stopMotion=()=>{},motionActive=false,motionHint='';
  const avatar=()=>({...avatarFrom(game.avatar??avatarDefaults),pin:inventory(game).includes(game.pin)?game.pin:null});
  const entries=()=>game.entries??[];
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
  function cottage(id,guided){
    const guide=guided?`<section class="stage-guide"><p>${guideText[2]}</p><div class="world-actions">${a('#atlas?guide=1','地図をひらく　→','world-btn')}${guideFooter()}</div></section>`:'';
    return homesteadScreen(game,avatar(),id,false,guide);
  }
  function episode(id){
    const record=entries().find(entry=>entry.id===id);
    const event=record?eventFor(record.activity,record.interest):null;
    if(!record)return '';
    const [title,description,,hint]=event??['旅の思い出が届きました','絵日記にこの日の思い出を残しました。'];
    const receipt=record.reward;
    const relief=(receipt?.finds??record.finds??[]).map(key=>regionalItems[key]).filter(Boolean);
    return `<section class="episode">${person(!receipt||receipt.item||receipt.coins||relief.length?'joy':'look')}<div><h2>${title}</h2><p>${description}</p>
      ${receipt?.item||receipt?.coins?`<p class="episode-reward">${receipt.item?e(items[receipt.item]):''}${receipt.item&&receipt.coins?' · ':''}${receipt.coins?receipt.coins+' 旅コイン':''}を受け取りました。</p>`:''}${hint?`<small>${hint}</small>`:''}${relief.map(item=>`<div class="episode-keepsake">${relicArt(item)}<span>${e(item.name)}が図鑑に届きました。</span></div>`).join('')}</div>${relief.length?a('#cabinet','図鑑をひらく','world-text'):''}</section>`;
  }
  const mapFilters={visited:'訪問済み',saved:'行きたい場所',journal:'旅の記録'};
  function journalsFor(pref){
    return (records().journals??[]).filter(journal=>{
      const place=journal.place?.trim()??'';
      const known=places.find(item=>item.name===place);
      return place.startsWith(pref.name)||known?.region.split('・').includes(pref.name);
    });
  }
  function pins(filter){
    if(filter==='saved')return places.filter(p=>(profile().saved??[]).includes(p.id)).map(p=>({lat:p.lat,lon:p.lng,label:p.name,pref:prefectures.find(x=>p.region.split('・').includes(x.name))?.id}));
    return prefectures.filter(p=>filter==='journal'?(entries().some(entry=>entry.pref===p.id)||journalsFor(p).length>0):entryKinds(profile(),'JP/prefecture/'+p.id,p,game).some(x=>x.kind==='self'||x.kind==='gps')).map(p=>({...p,label:p.name,pref:p.id}));
  }
  function mapPage(params){
    const pref=byId(params.get('pref'))??byId(game.lastPref)??prefectures[15],real=params.get('view')==='map',guided=params.get('guide')==='1';
    const filter=Object.hasOwn(mapFilters,params.get('show'))?params.get('show'):'visited';
    const url=(view,show=filter)=>'#atlas?'+new URLSearchParams({pref:pref.id,show,...(view?{view}:{}),...(guided?{guide:'1'}:{})});
    const markers=pins(filter), local=markers.filter(p=>p.pref===pref.id);
    const visited=local.length&&filter==='visited';
    const saved=places.filter(p=>(profile().saved??[]).includes(p.id)&&p.region.split('・').includes(pref.name));
    const recall=entries().filter(entry=>entry.pref===pref.id);
    const list=filter==='saved'?saved.map(p=>a('#place/'+p.id,e(p.name),'world-text')).join(''):
      filter==='journal'?[
        ...recall.map(entry=>a('#memories?pref='+pref.id,e(where(entry)),'world-text')),
        ...journalsFor(pref).map(entry=>a('#journal/'+e(entry.id),e(entry.title),'world-text'))
      ].join(''):'';
    return `<section class="page atlas-page"><header class="page-title"><h1>日本地図</h1></header>
      <nav class="travel-tabs" aria-label="地図に表示する記録">${Object.entries(mapFilters).map(([id,label])=>`<a href="${e(url(real?'map':'',id))}" ${id===filter?'aria-current="page"':''}>${label}</a>`).join('')}</nav>
      <div class="atlas-card"><div class="map-tabs">${a(url(''),'絵地図',real?'':'active')}${a(url('map'),'実用地図',real?'active':'')}</div>
      ${real?practicalMarkup(pref.name+'の実用地図'):`<canvas id="japan-map" width="600" height="490" role="img" aria-label="日本列島の絵地図。下の一覧から都道府県を選択できます"></canvas>`}
      <div class="atlas-foot"><label>都道府県<select id="pref-choice">${selectPref(pref.id)}</select></label><span>${mapFilters[filter]} ${markers.length}件</span></div></div>
      <section class="travel-collection"><h2>${e(pref.name)}</h2>${visited?'<p class="muted">訪問記録があります。</p>':''}
      ${list?`<div class="world-actions">${list}</div>`:filter!=='visited'?'<p class="muted">この都道府県の記録はまだありません。</p>':''}
      <div class="world-actions">${a('#stamps/prefecture?item='+pref.id,'スタンプを見る')}${a('#discover','旅先を探す','world-text')}${a('#nearby','寄り道','world-text')}</div>
      <details class="travel-secondary"><summary>この地域でできること</summary><div class="world-actions">${btn('explore','ここを散策する　→','world-btn alt')}${guided?guideFooter():a('#type','旅の好み診断','world-text')}</div></details></section>
      <small class="map-credit">絵地図の地形　<a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a> · 都道府県の印は県庁所在地付近</small></section>`;
  }
  function trail(id){
    const p=byId(id)??prefectures[15];
    return frame('仮想の旅',p.name+'を散策',art('trail',characterSpot('walk'),({'北海道':'north','東北':'north','関東':'spring','中部':'spring','近畿':'maple','中国':'maple','四国':'island','九州・沖縄':'island'})[p.region])+`<div class="world-actions">${[['walk','小道を歩く'],['photo','カメラを構える'],['sit','ひと休み']].map(([pose,label])=>`<button type="button" class="world-btn alt" data-world="field-action" data-pose="${pose}">${label}</button>`).join('')}</div><p id="field-voice" role="status"></p><section class="letter"><div class="stamp-row">${stamp(p.name)}<div><small>散策のしるし</small><h2>${p.name}の一頁</h2></div></div><p>地方と四季をもとに描いた創作の風景です。この印は仮想の旅の記録です。</p><div class="world-actions">${a('#atlas?pref='+p.id,'地図に戻る','world-btn')}${a('#cottage','自分の世界へ')}</div></section>`);
  }
  function activity(){
    const artId={walk:6,hike:4,tour:5,photo:7,cafe:7,meal:0,spa:6,beach:6};
    const primary=['walk','hike','meal','tour','photo','cafe'];
    const tile=id=>`<button type="button" data-world="pick-activity" data-kind="${id}" aria-pressed="false"><span aria-hidden="true" class="relic-tile relic-${artId[id]??(Object.keys(activities).indexOf(id)%8)}"></span><span>${activities[id][0]}</span></button>`;
    return `<section class="page page-narrow activity-page"><header class="page-title"><h1>旅を記録</h1><p>この端末だけの絵日記</p></header>
      <form id="activity-form" class="flow">
        <label class="activity-photo"><img id="activity-photo-preview" alt="選択した旅の写真" hidden><span id="activity-file-label">${icon('edit')} 写真を添える <small>任意</small></span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-labelledby="activity-file-label"></label>
        <fieldset class="activity-experiences"><legend>どんな体験でしたか？</legend><input type="hidden" name="activity" value="">
          <div class="experience-picks">${primary.map(tile).join('')}</div>
          <details class="travel-secondary"><summary>ほかの体験</summary><div class="experience-picks">${Object.keys(activities).filter(id=>!primary.includes(id)).map(tile).join('')}</div></details>
          <div class="activity-preview" hidden>${person('look')}<p id="activity-label"></p></div>
        </fieldset>
        <fieldset class="activity-location"><legend>訪ねた場所 <small>任意</small></legend>
          <label class="visually-hidden" for="activity-place">訪ねた場所</label><input id="activity-place" name="place" maxlength="80" placeholder="場所の名前">
          <label class="activity-pref">都道府県<select name="pref">${selectPref('',true)}</select></label>
        </fieldset>
        <div class="activity-suggestions">${btn('sense','現在地から候補を探す','world-text')} <span id="sense-status" role="status"></span>
          <details class="travel-secondary"><summary>位置情報とセンサーについて</summary><p>候補を出す間だけ測位します。座標は保存・送信せず、画面を離れると測位を止めます。</p>${btn('motion','動きセンサーを試す','world-text')} <small id="motion-status" role="status"></small></details></div>
        <button type="button" class="button" data-world="review-activity">記録を確認</button>
        <dialog class="activity-review"><h2>この体験を残しますか？</h2><p data-review-name></p><p data-review-place></p><p data-review-photo></p>
          <p class="muted">本人が確認した体験として、この端末に保存します。</p>
          <div class="actions"><button type="button" class="button button-outline" data-world="edit-activity">戻る</button><button class="button">自分の体験として記録</button></div>
        </dialog>
      </form></section>`;
  }
  function chooseActivity(id){
    if(!Object.hasOwn(activities,id))return;
    root.querySelector('#activity-form [name=activity]').value=id;
    for(const button of root.querySelectorAll('[data-kind]'))button.setAttribute('aria-pressed',String(button.dataset.kind===id));
    renderActivity(id);
  }
  function memories(params){
    const records=entries().filter(entry=>!byId(params.get('pref'))||entry.pref===params.get('pref'));
    return frame('自分だけの冒険記録','旅の絵日記',episode(params.get('event'))+`<div class="world-actions">${a('#activity','体験を記録　＋','world-btn')}${a('#journal/new','自由に日記を書く')}</div>
      <h2>現実の旅 <small>${records.length}件</small></h2>${records.length?records.map(entry=>`<article class="memory-card">${entry.photo?`<img data-memory-photo="${e(entry.id)}" alt="自分で選んだ旅の写真">`:''}<div class="memory-body">${person(activities[entry.activity][1],`data-entry="${e(entry.id)}" data-activity="${entry.activity}"`)}<div><small>${dateLabel(entry.date)} · 本人が記録</small><h3>${e(where(entry))}</h3><p>${e(entryText(entry))}</p></div></div><div class="world-actions">${btn('export','絵はがきを画像にする','world-text').replace('data-world','data-id="'+e(entry.id)+'" data-world')}${btn('booklet','絵入りの栞にする','world-text').replace('data-world','data-id="'+e(entry.id)+'" data-world')}${btn('remove','この記録を削除','world-text').replace('data-world','data-id="'+e(entry.id)+'" data-world')}</div></article>`).join(''):'<p class="letter">旅先で見たもの、食べたもの。最初の体験を記録すると、ここに絵日記が届きます。</p>'}
      <h2>仮想の旅 <small>${(game.explored??[]).length} / 47</small></h2><div class="world-actions">${(game.explored??[]).map(id=>a('#trail/'+id,stamp(byId(id)?.name??''),'stamp-link')).join('')||a('#atlas','絵地図をひらく')}</div>`);
  }
  function screen(name,id,params){
    if(name==='village'&&!game.started)return intro();
    switch(name){
      case 'village':return village();case 'welcome':return intro();case 'avatar':return editor(params.get('guide')==='1');case 'cottage':return cottage(id,params.get('guide')==='1');
      case 'decorate':return homesteadScreen(game,avatar(),id,true);case 'cabinet':return cabinetScreen(game,params);case 'atlas':return mapPage(params);case 'trail':return (game.explored??[]).includes(id)?trail(id):mapPage(params);
      case 'shop':return shopScreen(game);case 'companions':return companionScreen(game);
      case 'activity':return activity();case 'memories':return memories(params);
    }
  }
  function renderActivity(id,tentative=false){
    const c=root.querySelector('.activity-preview canvas');if(!c)return;
    c.parentElement.hidden=!id;
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
      status.replaceChildren(document.createTextNode(detected?`候補 · ${activities[detected][0]}${near?'（'+near.name+'の近く）':''}`:'候補を絞り込めません。体験を選べます。'));
      const more=document.createElement('details');more.className='travel-secondary';
      const summary=document.createElement('summary');summary.textContent='判定の内訳';
      const explanation=document.createElement('p');explanation.textContent=`確信度：${next.confidence}。 ${next.reason}${motionHint?' '+motionHint+'。':''}`;
      more.append(summary,explanation);
      if(detected){const use=document.createElement('button');use.type='button';use.className='world-text';use.dataset.world='use-detection';use.textContent=activities[detected][0]+'を選ぶ';status.append(use);}
      status.append(more);
    },()=>{if(active){stopLocation();status.textContent='位置情報を取得できません。手入力で記録できます。';}},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
    timeout=setTimeout(()=>{if(active)stopLocation();},60000);
  }
  function hydrate(name,params){
    const reduced=profile().effects?.motion===false || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revokes=[];let closeMap=()=>{};
    for(const c of root.querySelectorAll('[data-entry]'))c._avatar=entries().find(x=>x.id===c.dataset.entry)?.avatar;
    const actor=root.querySelector('.stage-player canvas');
    if(actor)actor._avatar=avatar();
    const closeDressing=mountDressing(root,avatar(),{reduced,looks:game.looks??[],saveLook:async draft=>{
      game=await update('world',(latest={})=>({...latest,looks:[{...avatarFrom(draft),pin:draft.pin},...(latest.looks??[])].slice(0,6)}));
      return game.looks;
    }});
    const hash=location.hash;
    const closeHome=mountHomestead(root,{game,avatar:avatar(),reduced,notify,commit:async(next,dest)=>{
      game=await update('world',(latest={})=>{
        if(readHome(latest).revision!==next.revision)throw new Error('別の画面で配置が変わりました。開き直してから編集してください。');
        return {...latest,homestead:{...validateHome(latest,next),revision:next.revision+1}};
      });
      if(location.hash===hash)go(dest);
    }});
    const closeStage=mountStage(root,go,reduced);
    const stopArt=animateWorld(root,avatar(),reduced);
    mountLife(root,avatar());
    for(const img of root.querySelectorAll('[data-memory-photo]')){const blob=entries().find(x=>x.id===img.dataset.memoryPhoto)?.photo;if(blob){img.src=URL.createObjectURL(blob);revokes.push(img.src);}}
    const selector=root.querySelector('#pref-choice');
    if(selector){
      const p=byId(selector.value),canvas=root.querySelector('#japan-map'),filter=Object.hasOwn(mapFilters,params.get('show'))?params.get('show'):'visited';
      const markers=pins(filter);
      if(canvas)atlas(canvas,p.id,id=>changePref(id,params),markers);
      else closeMap=practicalMap(root.querySelector('.tile-widget'),[p.lat,p.lon],{markers:markers.map(point=>({coords:[point.lat,point.lon],label:point.label,kind:'saved'}))});
    }
    clean=()=>{const photo=root.querySelector('#activity-photo-preview');if(photo?.src)URL.revokeObjectURL(photo.src);stopArt();closeDressing();closeHome();closeStage();stopLocation();stopMotion();closeMap();revokes.forEach(url=>URL.revokeObjectURL(url));};
  }
  function changePref(id,params=new URLSearchParams(location.hash.split('?')[1])){params.set('pref',id);go('#atlas?'+params);}
  root.addEventListener('change',event=>{
    const el=event.target;
    if(el.dataset.world==='companion-consent')save(g=>({...g,companions:{...lifeTrips(g),automatic:el.checked}}));
    if(el.id==='pref-choice')changePref(el.value);
    if(el.matches('#activity-form [name=photo]')){
      const preview=root.querySelector('#activity-photo-preview');
      if(preview.src)URL.revokeObjectURL(preview.src);
      const file=el.files?.[0];
      const oversize=(file?.size??0)>20*1024*1024;
      el.setCustomValidity(oversize?'20MB以内の写真を選んでください。':'');
      preview.hidden=!file||oversize;
      if(file&&!oversize)preview.src=URL.createObjectURL(file);else preview.removeAttribute('src');
    }
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
    if(form.id==='cabinet-search'){go('#cabinet?'+new URLSearchParams({q:fields.get('q')}));return;}
    if(form.id==='proposal-form'){
      try{
        const draft=proposal(fields);
        await save(g=>({...g,localProposals:[draft,...(g.localProposals??[])]}),()=>{afterSave('#cabinet?draft=1');notify('提案をこの端末に保存しました。');});
      }catch(error){notify(error.message);}
      return;
    }
    if(!['avatar-form','activity-form','step-goal','step-log','companion-draft'].includes(form.id))return;
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
    if(form.dataset.saving || !form.querySelector('dialog')?.open)return;
    const subject=fields.get('activity'),file=fields.get('photo'),button=event.submitter;form.dataset.saving='1';if(button)button.disabled=true;
    try{
      const photo=file?.size?await importPhoto(file):null;
      const entry=newEntry({activity:subject,place:fields.get('place'),pref:fields.get('pref'),photo,avatar:avatar(),date:Date.now(),id:crypto.randomUUID()});
      const finds=keepsakesFor(entry);entry.finds=finds;
      const preferences=profile(),answers=preferences.quiz??[];
      const votes=new Map();
      for(const type of answers)votes.set(type,(votes.get(type)??0)+1);
      entry.interest=preferences.traveler??[...votes].sort((a,b)=>b[1]-a[1])[0]?.[0];
      await save(g=>{
        const prior=g.entries??[];
        if(photo && prior.reduce((n,x)=>n+(x.photo?.size??0),photo.size)>24*1024*1024)throw new Error('絵日記の写真は合計24MBまでです。写真を外すか、不要な記録を整理してください。');
        const owned=g.localFinds??[],oldCoins=economy(g);
        const newCoins=reward(oldCoins,'trip:'+dateInJapan(new Date(entry.date))+':'+entry.activity,12,'現実の旅の記録');
        const item=activities[entry.activity][2];
        const receipt={item:inventory(g).includes(item)?null:item,coins:oldCoins===newCoins?0:12,finds:finds.filter(id=>!owned.includes(id))};
        return {...g,entries:[{...entry,reward:receipt},...prior],localFinds:[...new Set([...owned,...finds])],economy:newCoins};
      },()=>{if(form.isConnected)go('#memories?event='+entry.id);notify('絵日記に保存しました。');});
    }catch(err){notify(err.message);}finally{delete form.dataset.saving;if(button)button.disabled=false;}
  });
  root.addEventListener('click',async event=>{
    const b=event.target.closest('[data-world]');if(!b)return;
    switch(b.dataset.world){
      case 'export-proposal':{const draft=(game.localProposals??[]).find(x=>x.id===b.dataset.id);if(draft)exportProposal(draft);break;}
      case 'buy':await save(g=>({...g,economy:purchase(economy(g),b.dataset.id)}),()=>{go('#shop');notify(items[b.dataset.id]+'を購入しました。');});break;
      case 'close-draft':await save(g=>{const trips=lifeTrips(g);return {...g,companions:{...trips,drafts:trips.drafts.map(d=>d.id===b.dataset.id?{...d,closed:true}:d)}};},()=>go('#companions'));break;
      case 'demo-join':await save(g=>{
        const trips=addDemoJoin(lifeTrips(g),b.dataset.id);
        return {...g,companions:trips,economy:reward(economy(g),'practice:'+dateInJapan()+':'+b.dataset.id,5,'試遊のおとも旅')};
      },()=>go('#companions'));break;
      case 'thank-companions':await save(g=>{const trips=lifeTrips(g);return {...g,companions:{...trips,thanks:[...new Set([...trips.thanks,b.dataset.id])]}};},()=>go('#companions'));break;
      case 'demo-postcard':try{await downloadCompanionPostcard(b.closest('.companion-postcard'));}catch(error){notify(error.message);}break;
      case 'field-action':{const c=root.querySelector('.scene-person canvas');const pose=b.dataset.pose;c.dataset.pose=pose;character(c,avatar(),pose);root.querySelector('#field-voice').textContent={walk:'小道に足を進めました。',photo:'旅人は風景にカメラを向けました。',sit:'腰を下ろして、景色を眺めています。'}[pose];break;}
      case 'skip':await save(g=>({...g,started:true}),()=>go('#cottage'));break;
      case 'explore':{playRoomSound(profile(),'stamp');const id=root.querySelector('#pref-choice').value;await save(g=>({...g,started:true,lastPref:id,explored:[...new Set([...(g.explored??[]),id])]}),()=>go('#trail/'+id));break;}
      case 'motion':await motion(b);break;
      case 'sense':sense(b);break;
      case 'use-detection':chooseActivity(detected);break;
      case 'pick-activity':chooseActivity(b.dataset.kind);break;
      case 'review-activity':{
        const form=b.form, d=form.querySelector('dialog'), data=new FormData(form), kind=data.get('activity');
        if(!form.reportValidity())break;
        if(!Object.hasOwn(activities,kind)){notify('体験をひとつ選んでください。');form.querySelector('[data-kind]').focus();break;}
        d.querySelector('[data-review-name]').textContent=activities[kind][0];
        d.querySelector('[data-review-place]').textContent=[byId(data.get('pref'))?.name,data.get('place')?.trim()].filter(Boolean).join(' · ')||'場所の記録なし';
        d.querySelector('[data-review-photo]').textContent=data.get('photo')?.size?'写真あり':'写真なし';
        d.showModal();break;
      }
      case 'edit-activity':b.closest('dialog').close();break;
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
  await travelerAssets();
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
