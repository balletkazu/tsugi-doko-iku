// Prefectural capital coordinates are approximate anchors for the illustrated atlas.
import {hairPalette,skinPalette,clothPalette,tuningParts,tuningFields} from './avatar-palette.js';
import { collections } from './data.js';
import {itemNames, collectionItem} from './item-catalog.js';
import {styles,styleIndex,styleIds} from './style-catalog.js';

const capitals = [
  [43.06,141.35],[40.82,140.74],[39.70,141.15],[38.27,140.87],[39.72,140.10],[38.24,140.36],[37.75,140.47],
  [36.37,140.47],[36.57,139.88],[36.39,139.06],[35.86,139.65],[35.61,140.12],[35.69,139.69],[35.45,139.64],
  [37.90,139.02],[36.70,137.21],[36.59,136.63],[36.07,136.22],[35.66,138.57],[36.65,138.18],[35.39,136.72],
  [34.98,138.38],[35.18,136.91],[34.73,136.51],[35.00,135.87],[35.02,135.76],[34.69,135.50],[34.69,135.18],
  [34.69,135.83],[34.23,135.17],[35.50,134.24],[35.47,133.05],[34.66,133.93],[34.40,132.46],[34.19,131.47],
  [34.07,134.56],[34.34,134.04],[33.84,132.77],[33.56,133.53],[33.61,130.42],[33.25,130.30],[32.74,129.87],
  [32.79,130.74],[33.24,131.61],[31.91,131.42],[31.60,130.56],[26.21,127.68]
];
export const regions = ['北海道','東北','関東','中部','近畿','中国','四国','九州・沖縄'];
export const prefectures = collections[0].items.map((item,i)=>({...item,lat:capitals[i][0],lon:capitals[i][1],
  region:regions[[1,7,14,23,30,35,39,47].findIndex(end=>i<end)]}));
export const parts = {
  face:['輪郭','まる','たまご','ふっくら','すっきり'],
  eyes:['目','つぶら','たれ目','にっこり','きりっと','まんまる'],
  brows:['眉','やわらか','まっすぐ','きりっと','なし'],
  nose:['鼻','ちいさな鼻','まるい鼻','すっとした鼻'],
  mouth:['口','ほほえみ','にっこり','まあるい口','きゅっと'],
  ears:['耳','ふつう','小さめ','大きめ'], beard:['髭','なし','口髭','あご髭','うっすら','短く整えた髭','細い横ひげ'],
  hair:['髪型',...styles.hair.map(item=>item.name)],
  hairColor:['髪色',...hairPalette.map(([name])=>name)],
  skin:['肌色',...skinPalette.map(([name])=>name)],
  outfit:['洋服',...styles.outfit.map(item=>item.name)],
  clothColor:['服の色',...clothPalette.map(([name])=>name)],
  pattern:['服の柄','元の柄','しま','水玉','格子'],
  material:['生地','そのまま','ざらりとした麻','起毛ウール','なめらかな綿'],
  layer:['重ね着','なし','格子のベスト','生成りの肩掛け'],
  body:['体型','ふつう','ほっそり','ふっくら'], height:['身長','ふつう','小柄','高め'],
  hat:['帽子',...styles.hat.map(item=>item.name)],
  shoes:['靴',...styles.shoes.map(item=>item.name)],
  glasses:['眼鏡',...styles.glasses.map(item=>item.name)],
  bag:['リュック',...styles.bag.map(item=>item.name)],
  accessory:['小物',...styles.accessory.map(item=>item.name)]
};
export const poses = {walk:'歩く',run:'走る',sit:'座る',sleep:'眠る',joy:'喜ぶ',surprise:'驚く',climb:'汗をかく',eat:'食べる',drink:'お茶を飲む',photo:'写真を撮る',read:'本を読む',look:'景色を眺める'};
export const activities = {
  walk:['徒歩','walk','leaf'], cycle:['自転車','run','wheel'],train:['電車','look','ticket'],bus:['バス','sit','ticket'],boat:['船','look','shell'],plane:['飛行機','sit','wing'],
  hike:['登山','climb','leaf'],peak:['山頂','joy','stone'],spa:['温泉','sit','bowl'],hotel:['宿泊','sleep','lamp'],hut:['山小屋','read','lamp'],
  meal:['ご当地の食事','eat','bowl'],cafe:['カフェ','drink','cup'],beach:['海辺','look','shell'],resort:['休養','sit','shell'],
  art:['アート鑑賞','read','frame'],tour:['観光','look','frame'],nature:['自然観察','look','leaf'],play:['レジャー','joy','wheel'],photo:['風景の撮影','photo','frame'],rain:['雨の散歩','walk','drop'],snow:['雪の散歩','walk','snow']
};
export const items = itemNames;
export const starterSlots = ['plant',null,'books'];
export const avatarDefaults = {design:2,name:'旅人',...Object.fromEntries(Object.keys(parts).map(key=>[key,0])),bag:1,hat:0};
export function avatarFrom(input = {}) {
  // The first release encoded coat colors in the outfit field.
  if (input.design !== 2 && input.outfit !== undefined) input = {...input, clothColor:input.outfit, outfit:0};
  const bounded=n=>Number.isFinite(n)?Math.max(-10,Math.min(10,Math.round(n))):0;
  const tune=Object.fromEntries(tuningParts.map(part=>[part,Object.fromEntries(Object.keys(tuningFields).map(key=>[key,bounded(input.tune?.[part]?.[key])]))]));
  const hairTint=typeof input.hairTint==='string'&&/^#[a-f0-9]{6}$/i.test(input.hairTint)?input.hairTint:null;
  return Object.fromEntries([['design',2],['tune',tune],['hairTint',hairTint],['name',String(input.name??'').trim().slice(0,24)||'旅人'],
    ...Object.entries(parts).map(([key,choices])=>{
      const value=styleIndex(key,input);
      return [key,Number.isInteger(value)&&value>=0&&value<choices.length-1?value:avatarDefaults[key]];
    })]);
}
export function saveAppearance(input){
  const avatar=avatarFrom(input);
  return {...avatar,styleIds:styleIds(avatar)};
}
export function inventory(game) {
  return [...new Set(['plant','books',...(game.economy?.owned??[]),...(game.localFinds??[]),...(game.entries??[]).map(entry=>activities[entry.activity]?.[2]).filter(Boolean)])];
}
export function estimateActivity(previous,current) {
  if (!Number.isFinite(current.accuracy) || current.accuracy>80) return {kind:null,confidence:'低',reason:'位置の誤差が大きいため、活動を選んでください。'};
  let speed=current.speed;
  if ((!Number.isFinite(speed)||speed<0) && previous) {
    const dt=(current.time-previous.time)/1000;
    const dist=Math.hypot((current.lat-previous.lat)*111200,(current.lon-previous.lon)*111200*Math.cos(current.lat*Math.PI/180));
    if (dt>=4 && dt<=90 && dist>previous.accuracy+current.accuracy) speed=dist/dt;
  }
  if (!Number.isFinite(speed)||speed<0) return {kind:null,confidence:'低',reason:'移動速度を確かめられる測位を待っています。'};
  if (speed>=0.45 && speed<=2.2) {
    if(previous && current.time>previous.time && current.time-previous.time<=90000 && [current.alt,previous.alt,current.altError,previous.altError].every(Number.isFinite) && current.alt-previous.alt>Math.max(6,current.altError+previous.altError))
      return {kind:'hike',confidence:'低',reason:'歩く速さで標高が上がりました。登山かどうかを選んでください。'};
    return {kind:'walk',confidence:'中',reason:'測位した速度が歩く速さに近いです。'};
  }
  if (speed>2.2 && speed<7) return {kind:'cycle',confidence:'低',reason:'自転車でも移動できる速さです。乗り物の種類は確認が必要です。'};
  return {kind:null,confidence:'低',reason:speed>=7?'乗り物での移動が考えられます。種類を選んでください。':'今の速度からは、活動を絞り込めません。'};
}
export function newEntry({activity,place,pref,avatar,date,id,photo}) {
  if(!Object.hasOwn(activities,activity)) throw new Error('活動を選んでください。');
  if(pref && !prefectures.some(p=>p.id===pref)) throw new Error('都道府県を選び直してください。');
  return {id,date,activity,place:String(place||'').trim().slice(0,80),pref:pref||'',avatar:{...saveAppearance(avatar),...(avatar?.pin && collectionItem(avatar.pin)?.wear?{pin:avatar.pin}:{})},...(photo?{photo}:{}),source:'self-confirmed'};
}
