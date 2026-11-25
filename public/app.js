import { places, themes, travelerTypes } from './data.js';
import { escapeHtml as e, mapsSearch, mapsTransit, nearbyPlaces, rankPlaces, routePriorities, walkingLimits } from './core.js';
import { read, update, clear } from './storage.js';
import { icon, link, external, page, empty, placeCard, chips, options, saveButton } from './ui.js';
import { recordScreen, recordGroup, renderPhotos, submitRecord, shareTrip, revokePhotos } from './records.js';
import { communityDetail, communityHome, communitySaved, findSamplePost, homeUrl } from './community.js';
import { editorial, reactionTypes } from './community-data.js';
import { photoFigure, photoFor } from './photos.js';
import { createGallery } from './gallery.js';
import { openingPhotoPage, showFirstOpening, showOpening } from './opening.js';
import { mailbox, medalPage, milestones, playRoomSound, roomMotion, roomScreen, roomSettings } from './room.js';
import { questions, quizPage, travelerRanking } from './traveler-quiz.js';
import { loadToyamaPilot, pilotPage } from './transit-pilot.js';

import {stampScreen,mountStampArt,findStamp,personalBook,recordVisit,gpsMatches} from './stamp-book.js';
import {dateInJapan} from './travel-life.js';
import { createWorld } from './world.js';
import { mountRouteMaps } from './transit-pilot.js';

const view = document.querySelector('#view');
const nav = document.querySelector('#nav');
const notice = document.querySelector('#notice');
let lastScreen;
let pilot, pilotLoading, pilotRequest;
const gallery = createGallery(view,{go,notify:toast});
const world = createWorld(view,{go,notify:toast,profile:()=>state.profile,onRecords:records=>{state.data=records;}});
let closeRouteMaps=()=>{};
const worldPages = new Set(['village','welcome','avatar','cottage','decorate','atlas','trail','activity','memories','menu','shop','companions']);
const tabs = [['village','街','home'],['atlas','地図','compass'],['cottage','自分の家','book'],['menu','メニュー','route']];
const state = { profile:{}, data:{trips:[], journals:[]}, nearby:null, route:null };
let toastTimer;
let pending = false;
let storageAvailable = true;

function toast(message) {
  clearTimeout(toastTimer);
  notice.textContent = message;
  notice.hidden = false;
  toastTimer = setTimeout(() => { notice.hidden = true; }, 3200);
}

function currentLocation() {
  const [path, search] = (location.hash.slice(1) || 'village').split(/\?(.*)/s, 2);
  const [screen, id, edit] = path.split('/');
  return { screen, id, edit, params:new URLSearchParams(search) };
}
const findPlace = id => places.find(place => place.id === id);
const isSaved = id => (state.profile.saved ?? []).includes(id);
const placeCards = list => `<div class="cards">${list.map(place=>placeCard(place,isSaved(place.id))).join('')}</div>`;
const discoverUrl = (theme = '', query = '') => `#discover?${new URLSearchParams({ theme, q:query })}`;
const back = (url, label) => `<p class="no-print">${link(url,label,'back','text-link')}</p>`;
const placeLabel = place => `${place.name} ${place.region}`;

function setNav(screen) {
  const groups={welcome:'village',avatar:'cottage',decorate:'cottage',trail:'atlas',activity:'village',memories:'cottage',home:'village',story:'village'};
  const parent=groups[screen]??(tabs.some(([id])=>id===screen)?screen:'menu');
  nav.innerHTML = tabs.map(([id,label,glyph])=>`<a href="#${id}" class="nav-link" ${parent === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span></a>`).join('');
}

function discover(params) {
  const theme = themes.includes(params.get('theme')) ? params.get('theme') : '';
  const query = (params.get('q') ?? '').slice(0,70);
  const manual = travelerTypes.find(item=>item.name === state.profile.traveler);
  const savedThemes = state.profile.quizSaved ? places.filter(place=>isSaved(place.id)).map(place=>place.theme) : [];
  const ranking = state.profile.quiz ? travelerRanking(state.profile.quiz,[...savedThemes,...(state.profile.quizActivity?world.themes():[])]).slice(0,2) : [];
  const preferred = manual?.themes ?? ranking.flatMap(type=>type.themes);
  const list = rankPlaces(places,theme,query,preferred);
  return page('旅を発見','水辺、島、山。気になる風景から次の旅を探す。',`<form id="discover-search" class="search" data-theme="${e(theme)}"><label>地名やキーワード<input name="q" type="search" maxlength="70" value="${e(query)}" placeholder="例：秋田、渓谷"></label><button class="button">検索する</button></form>${chips(['すべて',...themes],theme || 'すべて',label=>discoverUrl(label === 'すべて' ? '' : label,query))}<p class="muted">${list.length}件の旅先</p><div class="results">${list.length ? placeCards(list) : empty('該当する旅先がありません','別のキーワードやテーマをお試しください。')}</div>`,{eyebrow:'Discover'});
}

function placeDetail(id) {
  const place = findPlace(id);
  if (!place) return missing();
  const photo = photoFor(place.photoId);
  return `<div class="page page-narrow">${back('#discover','旅の発見へ')}${photo ? photoFigure(photo) : ''}<div class="detail-body flow"><p class="eyebrow">${place.region} · ${place.theme}</p><h1>${place.name}</h1><p>${place.intro}</p><div class="actions">${saveButton(id,isSaved(id))}${link(`#route?${new URLSearchParams({to:place.name})}`,'行き方を調べる','route')}${link(`#nearby?anchor=${id}`,'この周辺で寄り道','pin','button button-outline')}</div><div class="actions">${external(mapsSearch(placeLabel(place)),'Google マップ')}${external(place.source,'地域・施設の案内')}</div><p class="muted">営業状況、通行規制、運航情報は出発前に公式案内を確認してください。</p></div></div>`;
}

function storyDetail(id, params) {
  const post = findSamplePost(id);
  return post ? communityDetail(post, params.get('from'), state.profile) : missing();
}

function savedPage(params) {
  const section = params.get('view') === 'posts' ? '投稿' : '旅先';
  const list = places.filter(place=>isSaved(place.id));
  const filter = chips(['旅先','投稿'],section,label=>label === '投稿' ? '#saved?view=posts' : '#saved');
  const savedPlaces = list.length ? placeCards(list) : `${empty('まだ保存した旅先がありません','旅先カードのハートから保存できます。')}<p>${link('#discover','旅先を見つける','arrow')}</p>`;
  return page('保存した旅先と投稿','',filter + (section === '投稿' ? communitySaved(state.profile) : savedPlaces));
}

function route(params) {
  const values = state.route ?? {};
  const to = params.has('to') ? params.get('to').slice(0,100) : values.to ?? '';
  const result = values.url && to === values.to ? `<section class="surface flow"><h2>入力した条件</h2><p><strong>${e(values.from)} → ${e(values.to)}</strong></p><p class="muted">希望：徒歩${values.walk}分まで・${e(values.priority)}を優先</p><div class="actions">${external(values.url,'Google マップで公共交通を調べる')}${link(findPlace(values.placeId) ? `#nearby?anchor=${values.placeId}` : '#nearby','寄り道候補を見る','pin','button button-outline')}</div><p class="muted">外部地図に渡すのは出発地と目的地です。選んだ徒歩上限と優先条件は、この画面で確認できます。</p></section>` : '';
  return page('行き方','',`<div class="flow"><section class="surface flow"><h2>富山市の乗換案内</h2><p>路面電車とバスの時刻表、徒歩データで行き方を探せます。</p>${link('#pilot','富山市で検索する','route')}</section><p class="notice">その他の地域では入力した条件の確認と外部地図への案内を利用できます。</p><form id="route-form" class="surface flow"><div class="field-grid"><label>出発地<input required name="from" maxlength="100" value="${e(values.from)}" placeholder="例：秋田駅"></label><label>目的地<input required name="to" maxlength="100" value="${e(to)}" placeholder="例：元滝伏流水"></label></div><button class="button button-outline" type="button" data-action="swap">出発地と目的地を入れ替える</button><fieldset><legend>合計の徒歩上限（希望）</legend>${options('walk',walkingLimits,values.walk ?? 60,value=>value===30?'30分':`${value/60}時間`)}</fieldset><fieldset><legend>優先したいこと</legend>${options('priority',routePriorities,values.priority ?? routePriorities[0])}</fieldset><div class="actions"><button class="button">入力した条件を確認${icon('arrow')}</button>${link('#nearby','寄り道を探す','pin','button button-outline')}</div><p id="route-error" class="error" role="status" hidden></p></form>${result}</div>`,{narrow:true,eyebrow:'Plan your way'});
}

function nearby(params) {
  const anchorId = params.get('anchor') ?? '';
  const anchor = findPlace(anchorId) ?? (anchorId === 'current' ? state.nearby : null);
  const label = anchorId === 'current' ? '現在地' : anchor?.name;
  const list = anchor ? nearbyPlaces(places,anchor) : [];
  const output = anchor ? `<section class="results flow"><h2>${label}の周辺</h2><p class="muted">直線距離80km以内の掲載スポットです。経路上かどうかや実際の移動時間は地図で確認してください。</p>${list.length ? `<ul class="item-list nearby-list">${list.map(({place,distance})=>`<li class="list-item"><a href="#place/${place.id}"><h3>${place.name}</h3><span class="muted">${place.region} · ${place.theme}</span></a><span class="muted">約${distance < 1 ? '1km未満' : `${Math.round(distance)}km`}</span></li>`).join('')}</ul>` : empty('この周辺の候補はありません','基準地点を変えるか、旅の発見から探せます。')}</section>` : '';
  return page('寄り道を探す','現在地か気になる旅先を基準に、立ち寄れそうな場所を探す。',`<form id="nearby-form" class="surface flow"><label>基準にする旅先<select name="anchor"><option value="">旅先を選ぶ</option>${places.map(place=>`<option value="${place.id}" ${anchorId===place.id?'selected':''}>${place.name}（${place.region}）</option>`).join('')}</select></label><div class="actions"><button class="button">周辺を探す</button><button class="button button-outline" type="button" data-action="location">${icon('pin')}現在地から探す</button></div><p class="muted">現在地は候補の計算にだけ使い、保存・送信しません。</p><p id="nearby-message" class="muted" role="status" hidden></p></form>${output}`,{narrow:true,eyebrow:'Take a detour'});
}

function myTravel(params) {
  const { trips, journals } = state.data;
  const list = `<div class="flow"><section class="surface flow"><div class="section-title"><div><h2>旅の栞</h2><p class="section-intro">旅程や地図を一つにまとめる。</p></div>${link('#trip/new','栞を作る','arrow')}</div>${recordList(trips,'trip','まだ栞がありません。')}</section><section class="surface flow"><div class="section-title"><div><h2>旅の日記</h2><p class="section-intro">その日の写真と気持ちを、自分だけの記録に。</p></div>${link('#journal/new','日記を書く','edit')}</div>${recordList(journals,'journal','まだ日記がありません。')}</section><section class="surface flow"><h2>旅のスタンプ帳</h2><p class="muted">訪ねた都道府県や名所のスタンプを集める。</p>${link('#stamps','スタンプ帳を開く','stamp','button button-outline')}</section><section class="surface flow"><h2>旅人タイプ</h2><p class="muted">好きな旅を選ぶと、発見で近いテーマを先に表示します。</p><form id="traveler-form" class="flow"><label>好みのタイプ<select name="type"><option value="">おまかせ</option>${travelerTypes.map(item=>`<option value="${item.name}" ${state.profile.traveler===item.name?'selected':''}>${item.name} — ${item.description}</option>`).join('')}</select></label><button class="button button-outline">好みを保存する</button></form></section><div class="actions">${link('#saved','保存した旅先と投稿','heart','button button-outline')}${link('#type','旅人タイプの診断を開く','arrow','text-link')}${link('#about','データと公開範囲について','arrow','text-link')}</div></div>`;
  return roomScreen(state.profile,params.get('view'),list);
}

function recordList(items,type,placeholder) {
  if (!items.length) return `<p class="muted">${placeholder}</p>`;
  return `<ul class="item-list nearby-list">${items.map(item=>`<li class="list-item"><a href="#${type}/${item.id}"><h3>${e(item.title)}</h3><span class="muted">${e(item.date || item.place || '日付未設定')}</span></a>${link(`#${type}/${item.id}`,'開く','arrow','text-link')}</li>`).join('')}</ul>`;
}

function about() {
  return page('このプレビューについて','旅を通して、世界や人とつながるアプリを育てています。',`<div class="surface flow"><h2>記録とプライバシー</h2><p>行きたい場所、栞、日記、スタンプ、サンプル投稿への反応・フォロー・保存は、このブラウザーに保存されます。試遊版の日記は自分だけの記録です。端末間の同期、一般・限定公開、利用者どうしの投稿機能は今後の開発範囲です。</p><p>写真は取り込み時に縮小・再生成し、位置情報などの元のメタデータを保存しません。地図リンクを開くと、入力した地名は Google マップに渡ります。</p><h2>風景と読みもの</h2><p>掲載写真は実在する場所で撮影されたものです。各写真に撮影者・撮影場所・出典・利用条件を表示します。ホームの投稿は編集部作成のサンプルです。</p><h2>この端末のデータ</h2><p>ブラウザーのデータ削除で記録が失われることがあります。残したい栞は印刷・PDFやテキストで保存できます。</p><button type="button" class="button button-danger" data-action="clear">この端末のアプリ記録をすべて消去</button></div>`,{narrow:true});
}

function missing() {
  return page('場所が見つかりません','リンク先をご確認ください。',link('#home','ホームへ戻る','arrow'),{narrow:true});
}

function render({ navigate = false } = {}) {
  const {screen,id,edit,params} = currentLocation();
  world.release();
  closeRouteMaps();
  revokePhotos();
  gallery.release();
  document.documentElement.classList.toggle('motion-off',state.profile.effects?.motion === false);
  const turningStamps = screen === 'stamps' && lastScreen === 'stamps';
  const screens = {
    home:()=>communityHome(params,state.profile,world.snapshot()), discover:()=>discover(params), place:()=>placeDetail(id), story:()=>storyDetail(id,params), route:()=>route(params), nearby:()=>nearby(params),
    my:()=>myTravel(params), trip:()=>recordScreen('trip',id,edit,state.data), journal:()=>recordScreen('journal',id,edit,state.data), stamps:()=>stampScreen(id,params,state.profile,world.snapshot()), about,
    saved:()=>savedPage(params), 'opening-photo':openingPhotoPage,
    photos:()=>gallery.screen(id,edit), type:()=>quizPage(state.profile,places,state.profile.quizActivity?world.themes():[]),
    medals:()=>medalPage(state.profile,state.data), mail:()=>mailbox(state.profile,state.data),
    'room-settings':()=>roomSettings(state.profile), pilot:()=>pilotPage(pilot,pilotRequest)
  };
  if (screen === 'pilot' && !pilotLoading) {
    pilotLoading = loadToyamaPilot().then(data=>{pilot=data;}).catch(()=>{pilot=false;}).then(()=>{
      if (currentLocation().screen === 'pilot') render();
    });
  }
  document.body.classList.toggle('game-view',['village','cottage','avatar'].includes(screen));
  setNav(screen);
  view.innerHTML = worldPages.has(screen) ? world.screen(screen,id,params) : (Object.hasOwn(screens,screen) ? screens[screen] : missing)();
  if(worldPages.has(screen)) world.hydrate(screen,params);
  if(screen==='stamps')mountStampArt(view,state.profile);
  if(screen==='pilot') closeRouteMaps=mountRouteMaps(view,pilot);
  renderPhotos(view,state.data);
  if (navigate && turningStamps) roomMotion(state.profile,view.querySelector('.stamp-grid'),'page');
  const title = view.querySelector('h1');
  const switchingFeed = screen === 'home' && lastScreen === 'home';
  lastScreen = screen;
  document.title = screen === 'home' ? 'つぎ どこ行く？' : `${title?.textContent ?? '旅'} | つぎ どこ行く？`;
  if (navigate && switchingFeed) {
    const selectedTab = view.querySelector('.feed-tab[aria-current=page]');
    selectedTab?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    selectedTab?.focus({preventScroll:true});
  } else if (navigate) {
    window.scrollTo({top:0,behavior:'instant'});
    title?.setAttribute('tabindex','-1');
    title?.focus({preventScroll:true});
  }
}

function go(hash) {
  if (location.hash === hash) render({navigate:true});
  else location.hash = hash;
}

function showMessage(id,message) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
}

async function write(task, control, onError = () => toast('保存できませんでした。ブラウザーの保存設定をご確認ください。')) {
  if (pending) return;
  if (!storageAvailable) {
    toast('このブラウザーでは記録を保存できません。');
    return;
  }
  pending = true;
  if (control) {
    control.dataset.hadFocus = String(document.activeElement === control);
    control.disabled = true;
  }
  try {
    await task();
  } catch (error) {
    onError(error);
  } finally {
    pending = false;
    if (control) {
      control.disabled = false;
      delete control.dataset.hadFocus;
    }
  }
}

function refreshControl(control) {
  const focused = control.isConnected && control.dataset.hadFocus === 'true';
  const {action,id,value} = control.dataset;
  render();
  if (!focused) return;
  const matching = [...view.querySelectorAll('[data-action]')].find(button=>button.dataset.action === action && button.dataset.id === id && button.dataset.value === value);
  const fallback = view.querySelector('.feed-tab[aria-current=page]') ?? view.querySelector('h1');
  if (fallback?.tagName === 'H1') fallback.tabIndex = -1;
  (matching ?? fallback)?.focus({preventScroll:true});
}

function requestLocation(control) {
  if (!navigator.geolocation) {
    showMessage('nearby-message','このブラウザーで現在地を取得できません。旅先を選んでお試しください。');
    return;
  }
  const startHash = location.hash;
  control.disabled = true;
  showMessage('nearby-message','現在地を取得しています。');
  navigator.geolocation.getCurrentPosition(({coords})=>{
    if (location.hash !== startHash) return;
    state.nearby = {lat:coords.latitude, lng:coords.longitude};
    control.disabled = false;
    go('#nearby?anchor=current');
  },()=>{
    if (location.hash !== startHash) return;
    control.disabled = false;
    showMessage('nearby-message','現在地を取得できませんでした。位置情報の許可を確認するか、旅先を選んでお試しください。');
  },{timeout:12000,maximumAge:60000});
}

function saveStamp(key,date,kind,control){
  write(async()=>{
    state.profile=await update('profile',(p={})=>recordVisit(p,key,date,kind));
    playRoomSound(state.profile,'stamp');render();
    roomMotion(state.profile,view.querySelector('.passport-detail canvas'),'stamp');
    toast('スタンプを押しました。');
  },control,error=>toast(error.message));
}
async function verifyStamp(button){
  const message=view.querySelector('[data-gps-message]');
  if(!navigator.geolocation){message.textContent='この端末では測位を利用できません。';return;}
  button.disabled=true;message.textContent='位置を確認しています…';
  const failure=()=>{if(button.isConnected){button.disabled=false;message.textContent='現在地を確認できませんでした。自己申告でも記録できます。';}};
  try{
    const {default:boundaries}=await import('./data/prefecture-areas.js');
    if(!button.isConnected)return;
    const id=button.dataset.stampGps;
    navigator.geolocation.getCurrentPosition(({coords})=>{
      if(!button.isConnected)return;
      button.disabled=false;
      const key=findStamp(state.profile,'prefecture',id);
      if(key&&gpsMatches(boundaries[id]??[],coords)){
        message.textContent='都道府県の範囲内です。';
        const date=dateInJapan();
        const accept=document.createElement('button');
        accept.type='button';accept.className='button button-outline';accept.textContent='今日のGPS確認印を押す';
        accept.addEventListener('click',()=>saveStamp(key,date,'gps',accept));message.append(' ',accept);
      }else message.textContent='この都道府県の範囲内と確認できませんでした。';
    },failure,{enableHighAccuracy:true,maximumAge:0,timeout:14000});
  }catch{failure();}
}

view.addEventListener('change',event=>{
  if(event.target.id==='stamp-category')go('#stamps/'+event.target.value);
});
view.addEventListener('click', event => {
  const gps=event.target.closest('[data-stamp-gps]');
  if(gps){verifyStamp(gps);return;}
  const remove=event.target.closest('[data-stamp-remove]');
  if(remove){
    const {dataset}=remove;
    const key=findStamp(state.profile,currentLocation().id,dataset.item);
    if(key)write(async()=>{
      state.profile=await update('profile',(p={})=>{
        const stamps={...p.stamps};
        if(dataset.stampRemove==='self'&&stamps[key]?.slice(0,10)===dataset.date)delete stamps[key];
        const list=(p.visits?.[key]??[]).filter(x=>x.kind!==dataset.stampRemove||x.date!==dataset.date);
        return {...p,stamps,visits:{...p.visits,[key]:list}};
      });
      render();
    },remove);
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const {action,id,value,type} = button.dataset;
  if (action === 'replay-opening') {
    showOpening(()=>go('#opening-photo'));
  } else if (action === 'room-layout' && ['room','list'].includes(value)) {
    write(async()=>{
      state.profile = await update('profile',(profile = {})=>({...profile,roomLayout:value}));
      if (currentLocation().screen !== 'my') return;
      if (currentLocation().params.has('view')) history.replaceState(null,'','#my');
      refreshControl(button);
    },button);
  } else if (action === 'reset-quiz') {
    write(async()=>{
      state.profile = await update('profile',(profile = {})=>{
        const {quiz,quizSaved,quizActivity,...next} = profile;
        return next;
      });
      refreshControl(button);
      toast('診断の回答と許可を消去しました。');
    },button);
  } else if (action === 'claim-medal') {
    const medal = milestones.find(item=>item.id===id);
    if (!medal?.isEarned(state.profile,state.data) || (state.profile.medals ?? []).includes(id)) return;
    playRoomSound(state.profile,'medal');
    write(async()=>{
      state.profile = await update('profile',(profile = {})=>medal.isEarned(profile,state.data) ? {...profile,medals:[...new Set([...(profile.medals ?? []),id])]} : profile);
      refreshControl(button);
      roomMotion(state.profile,view.querySelector('[data-medal="'+id+'"] .medal-icon'),'medal');
      toast('メダルを受け取りました。');
    },button);
  } else if (action === 'swap') {
    const {from,to} = button.form.elements;
    [from.value,to.value] = [to.value,from.value];
  } else if (action === 'location') {
    requestLocation(button);
  } else if (action === 'print') {
    window.print();
  } else if (action === 'share') {
    const entry = state.data.trips.find(item=>item.id === currentLocation().id);
    if (entry) shareTrip(entry).then(message=>{if(message) toast(message);}).catch(()=>toast('栞を共有できませんでした。'));
  } else if (action === 'save-place' && findPlace(id)) {
    write(async()=>{
      state.profile = await update('profile', (profile = {})=>{
        const items = new Set(profile.saved ?? []);
        if (items.has(id)) items.delete(id); else items.add(id);
        return {...profile,saved:[...items]};
      });
      refreshControl(button);
      toast(isSaved(id) ? '行きたい場所に保存しました。' : '保存を取り消しました。');
    },button);
  } else if (action === 'save-post' && findSamplePost(id)) {
    write(async()=>{
      state.profile = await update('profile',(profile = {})=>{
        const saved = new Set(profile.savedPosts ?? []);
        if (saved.has(id)) saved.delete(id); else saved.add(id);
        return {...profile,savedPosts:[...saved]};
      });
      refreshControl(button);
      toast(state.profile.savedPosts.includes(id) ? '投稿を保存しました。' : '投稿の保存を取り消しました。');
    },button);
  } else if (action==='sample-safety' && ['mute','block'].includes(value)) {
    const key=value==='mute'?'sampleMuted':'sampleBlocked';
    write(async()=>{state.profile=await update('profile',(profile={})=>({...profile,[key]:!profile[key]}));refreshControl(button);toast('サンプル投稿の表示設定を保存しました。');},button);
  } else if (action === 'follow-sample' && id === editorial.id) {
    write(async()=>{
      state.profile = await update('profile',(profile = {})=>{
        const follows = new Set(profile.sampleFollows ?? []);
        if (follows.has(id)) follows.delete(id); else follows.add(id);
        return {...profile,sampleFollows:[...follows]};
      });
      refreshControl(button);
      toast('この端末のサンプルフォローを更新しました。');
    },button);
  } else if (action === 'reaction' && findSamplePost(id) && reactionTypes.some(([key])=>key === Number(value))) {
    write(async()=>{
      state.profile = await update('profile',(profile = {})=>{
        const group = new Set(profile.reactions?.[id] ?? []);
        const index = Number(value);
        if (group.has(index)) group.delete(index); else group.add(index);
        return {...profile,reactions:{...profile.reactions,[id]:[...group]}};
      });
      refreshControl(button);
      toast('この端末の反応を更新しました。');
    },button);
  } else if (action === 'delete-record' && confirm('この記録を削除しますか？')) {
    write(async()=>{
      const key = recordGroup(type);
      state.data = await update('records',(data = {trips:[],journals:[]})=>({...data,[key]:data[key].filter(item=>item.id !== id)}));
      go('#my');
      toast('記録を削除しました。');
    },button);
  } else if (action === 'clear' && confirm('このブラウザーの旅人、自宅、絵日記、写真、栞、スタンプなど、すべての記録を消去しますか？')) {
    write(async()=>{
      await clear();
      state.profile = {};
      state.data = {trips:[],journals:[]};
      state.route = null;
      state.nearby = null;
      pilotRequest = undefined;
      gallery.reset();
      world.load({});
      go('#village');
      toast('この端末のアプリ記録を消去しました。');
    },button);
  }
});

view.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  const fields = new FormData(form);
  if(form.id==='stamp-search'){
    go('#stamps/'+form.dataset.book+'?'+new URLSearchParams({q:fields.get('q')}));
  }else if(form.id==='stamp-custom'){
    try{
      const book=personalBook(fields);
      write(async()=>{state.profile=await update('profile',(p={})=>({...p,customBooks:[...(p.customBooks??[]),book]}));go('#stamps/'+book.id);},event.submitter);
    }catch(error){toast(error.message);}
  }else if(form.id==='visit-stamp'){
    const key=findStamp(state.profile,form.dataset.book,form.dataset.item);
    if(key)saveStamp(key,fields.get('date'),'self',event.submitter);
  }else if (form.id === 'community-search') {
    go(homeUrl(form.dataset.feed,fields.get('q').trim()));
  } else if (form.id === 'pilot-form' && pilot) {
    pilotRequest = {from:fields.get('from'),to:fields.get('to'),date:fields.get('date'),time:fields.get('time'),limit:Number(fields.get('limit')),order:fields.get('order'),mixed:fields.has('mixed')};
    render();
    document.querySelector('#pilot-results')?.focus();
  } else if (form.id === 'effects-form') {
    write(async()=>{
      state.profile = await update('profile',(profile = {})=>({...profile,effects:{motion:fields.has('motion'),sound:fields.has('sound')}}));
      render();
      toast('部屋の設定を保存しました。');
    },event.submitter);
  } else if (form.id === 'quiz-form') {
    const answers = questions.map((_,index)=>fields.get('q'+index));
    if (!answers.every((answer,index)=>questions[index][1].some(([name])=>name===answer))) return;
    write(async()=>{
      state.profile = await update('profile',(profile = {})=>({...profile,quiz:answers,quizSaved:fields.has('saved'),quizActivity:fields.has('activity')}));
      render();
      const result = view.querySelector('.quiz-results');
      if (result) { result.tabIndex=-1; result.focus(); }
      toast('旅人タイプの診断を保存しました。');
    },event.submitter);
  } else if (form.id === 'discover-search') {
    go(discoverUrl(form.dataset.theme,fields.get('q').trim()));
  } else if (form.id === 'route-form') {
    const from = fields.get('from').trim();
    const to = fields.get('to').trim();
    const url = mapsTransit(from,to);
    if (!url) {
      showMessage('route-error','出発地と目的地を入力してください。');
      return;
    }
    state.route = { from,to,url,walk:Number(fields.get('walk')),priority:fields.get('priority'),placeId:places.find(place=>place.name===to)?.id };
    if (currentLocation().params.has('to')) history.replaceState(null,'','#route');
    render();
    const result = view.querySelector('section h2');
    result?.setAttribute('tabindex','-1');
    result?.focus();
  } else if (form.id === 'nearby-form') {
    if (findPlace(fields.get('anchor'))) go(`#nearby?anchor=${fields.get('anchor')}`);
    else showMessage('nearby-message','基準にする旅先を選んでください。');
  } else if (form.id === 'traveler-form') {
    write(async()=>{
      state.profile = await update('profile',(profile = {})=>({...profile,traveler:fields.get('type')}));
      toast('旅の好みを保存しました。');
    },event.submitter);
  } else if (form.id === 'record-form') {
    write(async()=>{
      const {type,id} = form.dataset;
      const group = recordGroup(type);
      const current = state.data[group].find(item=>item.id === id);
      const record = await submitRecord(form,current);
      state.data = await update('records',(data = {trips:[],journals:[]})=>{
        const latest = data[group].find(item=>item.id === id);
        if (id && (!latest || latest.updatedAt !== current?.updatedAt)) {
          throw new Error('別のタブで記録が変更されました。この画面を開き直してから再度お試しください。');
        }
        return {...data,[group]:[record,...data[group].filter(item=>item.id !== record.id)]};
      });
      if (form.isConnected) go(`#${type}/${record.id}`);
      toast('記録を保存しました。');
    },event.submitter,error=>{
      const text = error instanceof DOMException ? '記録を保存できませんでした。端末の空き容量をご確認ください。' : error.message;
      showMessage('record-error',text);
    });
  }
});

document.querySelector('.skip').addEventListener('click',event=>{
  event.preventDefault();
  document.querySelector('#content').focus();
});
document.querySelector('#saved-icon').innerHTML = icon('heart');
window.addEventListener('hashchange',()=>render({navigate:true}));
view.innerHTML = '<p class="loading" role="status">旅のページを開いています。</p>';
showFirstOpening(()=>go('#opening-photo'));
try {
  const [profile,data,worldState] = await Promise.all([read('profile'),read('records'),read('world'),gallery.load()]);
  world.load(worldState);
  state.profile = profile ?? {};
  state.data = data ?? state.data;
} catch {
  storageAvailable = false;
  toast('このブラウザーでは旅の記録を保存できません。');
}
render();
if ('serviceWorker' in navigator && !['localhost','127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
