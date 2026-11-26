import {items} from './world-data.js';
import {escapeHtml as e} from './core.js';
import {page,link} from './ui.js';
import {ornament,character} from './world-art.js';

export const shopItems=[
  {id:'fern',price:12,rarity:'通常',note:'木陰の緑を窓辺に。'},
  {id:'teaset',price:18,rarity:'通常',note:'旅の話をしながら、お茶をもう一杯。'},
  {id:'rug',price:26,rarity:'通常',note:'西日を写した色の織物。'},
  {id:'lantern',price:45,rarity:'レア',note:'山小屋で見つけたような灯籠。'},
  {id:'brooch',price:55,rarity:'レア',note:'朝の葉に残った露のかたち。'}
];
export const dateInJapan=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{dateStyle:'short',timeZone:'Asia/Tokyo'}).format(now);
const initial={ledger:[{key:'welcome',amount:24,label:'旅の支度金'}],steps:{},owned:[],goal:4000};
export const economy=game=>({...initial,...game.economy});
export const balance=coins=>coins.ledger.reduce((n,event)=>n+event.amount,0);
export function reward(coins,key,amount,label){
  return coins.ledger.some(event=>event.key===key)?coins:{...coins,ledger:[{key,amount,label},...coins.ledger]};
}
export function recordSteps(coins,date,value,today=dateInJapan()){
  const time=Date.parse(date);
  if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==date||date>today||date<'2000-01-01')
    throw new Error('今日か過去の日付を選んでください。');
  if(!Number.isInteger(value)||value<0||value>150000)throw new Error('歩数は0〜150,000歩で入力してください。');
  const goal=coins.steps[date]?.goal??coins.goal;
  const next={...coins,steps:{...coins.steps,[date]:{value,goal}}};
  return value>=goal?reward(next,'steps:'+date,8,'歩数目標を達成'):next;
}
export function purchase(coins,id){
  const item=shopItems.find(i=>i.id===id);
  if(!item||coins.owned.includes(id))throw new Error('すでに持っている道具です。');
  if(balance(coins)<item.price)throw new Error('旅コインが足りません。');
  return {...reward(coins,'purchase:'+id,-item.price,items[id]),owned:[...coins.owned,id]};
}
const stepFootnote='端末の健康データとの同期は今後の対応です。ここでは歩数計などで見た歩数を手入力できます。';
export function shopScreen(game){
  const coins=economy(game),today=dateInJapan();
  return page('風待ちの旅道具店','',`<div class="life-balance"><span>旅コイン</span><strong>${balance(coins)}</strong><span aria-hidden="true">◉</span></div>
    <section><h2>棚から選ぶ</h2><div class="life-shop">${shopItems.map(item=>`<article><canvas width="32" height="32" aria-hidden="true" data-item="${item.id}"></canvas><small>${item.rarity}</small><h3>${items[item.id]}</h3><p>${item.note}</p><button class="world-btn" type="button" data-world="buy" data-id="${item.id}" ${coins.owned.includes(item.id)||balance(coins)<item.price?'disabled':''}>${coins.owned.includes(item.id)?'所持済み':item.price+' コインで購入'}</button></article>`).join('')}</div>${link('#decorate','家に飾る','home','text-link')} · ${link('#avatar','着替え・記念品','edit','text-link')}</section>
    <section class="surface flow"><h2>歩数の手帖</h2><p>${stepFootnote}</p><form id="step-goal" class="actions"><label>自分の歩数目標<input name="goal" type="number" min="100" max="100000" step="1" required value="${coins.goal}"></label><button class="button button-outline">目標を保存</button></form><form id="step-log" class="flow"><div class="field-grid"><label>日付<input name="date" type="date" required min="2000-01-01" max="${today}" value="${today}"></label><label>その日の歩数<input name="steps" type="number" min="0" max="150000" step="1" required value="${coins.steps[today]?.value??''}" inputmode="numeric"></label></div><button class="button">歩数を記録</button></form><p class="muted">設定した目標を達成した日は8コイン。過去の日の記録も追加できます。達成できない日も、そのままで大丈夫です。</p>
    <ul>${Object.entries(coins.steps).sort(([a],[b])=>b.localeCompare(a)).slice(0,12).map(([day,log])=>`<li>${day}　${log.value.toLocaleString('ja-JP')} / ${log.goal.toLocaleString('ja-JP')} 歩</li>`).join('')}</ul></section>
    <section class="surface flow"><h2>コインの記録</h2><ul>${coins.ledger.slice(0,16).map(row=>`<li>${e(row.label)}　${row.amount>0?'+':''}${row.amount}</li>`).join('')}</ul><p class="muted">コインと獲得した道具は、この端末に期限なしで残ります。</p></section>`,{narrow:true});
}

const residents=[
  {id:'violet',name:'すみれ',pref:'JP-16',design:2,hair:1,clothColor:5,hat:4},
  {id:'wind',name:'かぜ',pref:'JP-26',design:2,hair:3,clothColor:2,hat:3},
  {id:'clover',name:'よつば',pref:'JP-01',design:2,hair:2,clothColor:0,hat:0},
  {id:'nagi',name:'なぎ',pref:'JP-18',design:2,hair:5,clothColor:3,hat:1},
  {id:'sio',name:'しお',pref:'JP-42',design:2,hair:4,clothColor:1,hat:2},
  {id:'haku',name:'はく',pref:'JP-47',design:2,hair:6,clothColor:4,hat:1}
];
export const companionLimits={free:{daily:5,guests:20},paid:{daily:10,guests:30}};
export function lifeTrips(game){
  return {drafts:[],joins:[],hosted:[],thanks:[],automatic:false,...game.companions};
}
export function parseInvitation(fields,today=dateInJapan()){
  const date=String(fields.get('date')??'');
  const dt=Date.parse(date);
  const place=String(fields.get('place')??'').trim();
  const audience=String(fields.get('audience')??'self');
  if(!Number.isFinite(dt)||new Date(dt).toISOString().slice(0,10)!==date||date<today||!place||place.length>60||!['self','friends','public'].includes(audience))
    throw new Error('今日以降の日付、行き先、公開範囲を確認してください。');
  return {date,place,audience,note:String(fields.get('note')??'').slice(0,320).trim()};
}
export function addDemoJoin(trips,target,today=dateInJapan()){
  const resident=residents.find(x=>x.id===target);
  if(!resident)throw new Error('おともを選んでください。');
  if(trips.joins.some(x=>x.day===today&&x.target===target))return trips;
  if(trips.joins.filter(x=>x.day===today).length>=companionLimits.free.daily)throw new Error('今日のおとも参加は5回までです。');
  return {...trips,joins:[...trips.joins,{day:today,target,pref:resident.pref}]};
}
export function completeDemoHost(trips,id,guests,today=dateInJapan()){
  const draft=trips.drafts.find(x=>x.id===id);
  if(trips.hosted.some(x=>x.id===id))return trips;
  const group=[...new Set(guests)].filter(value=>residents.some(person=>person.id===value));
  if(!draft||draft.closed||draft.date>today||!group.length||group.length>companionLimits.free.guests)
    throw new Error('出発日を迎えた募集と、連れていく街の住人を選んでください。');
  return {...trips,hosted:[...trips.hosted,{id,day:draft.date,guests:group}],drafts:trips.drafts.map(x=>x.id===id?{...x,closed:true}:x)};
}
function postcards(trips){
  const grouped=new Map();
  for(const join of trips.joins){
    if(!grouped.has(join.day))grouped.set(join.day,[]);
    grouped.get(join.day).push(join);
  }
  const groups=[...grouped.entries()].map(([day,joins])=>({id:day,day,people:joins.map(x=>x.target)}));
  for(const host of trips.hosted)groups.push({id:host.id,day:host.day,people:host.guests});
  return groups.sort((a,b)=>b.day.localeCompare(a.day)).flatMap(({id,day,people})=>Array.from({length:Math.ceil(people.length/3)},(_,i)=>({
    id:id+'-'+i,day,group:people.slice(3*i,3*i+3).map(id=>residents.find(person=>person.id===id)).filter(Boolean)
  })));
}
export function companionFeed(game,query=''){
  const drafts=lifeTrips(game).drafts.filter(d=>!d.closed && (d.place+' '+d.note).includes(query.trim()));
  return `<section class="surface flow"><h2>この端末の募集</h2>
    ${drafts.length?drafts.map(d=>`<article class="life-invitation"><div><small>自分の下書き</small><h3>${e(d.date)}　${e(d.place)}</h3>${d.note?`<p class="prewrap">${e(d.note)}</p>`:''}</div></article>`).join(''):'<p>該当する下書きがありません。</p>'}
    ${link('#companions','おとも旅で募集を書く','edit')}</section>`;
}
export function companionScreen(game){
  const trips=lifeTrips(game),today=dateInJapan();
  const active=trips.drafts.filter(x=>!x.closed);
  const draftList=active.map(draft=>`<article class="life-invitation"><div><small>この端末の下書き · ${{self:'自分だけ',friends:'友達向け',public:'一般公開向け'}[draft.audience]}</small><h3>${e(draft.date)}　${e(draft.place)}</h3>${draft.note?`<p class="prewrap">${e(draft.note)}</p>`:''}
    ${draft.date<=today?`<details><summary>街の住人を連れていく練習</summary><form class="flow" data-host-draft="${e(draft.id)}"><fieldset><legend>一緒に行く住人</legend><div class="life-guest-list">${residents.map(r=>`<label class="check-row"><input type="checkbox" name="guest" value="${r.id}">${r.name}</label>`).join('')}</div></fieldset><button class="button button-outline">試遊の旅を終えて絵はがきを受け取る</button></form></details>`:''}</div>
    <button type="button" class="world-text" data-world="close-draft" data-id="${e(draft.id)}">募集を取り下げる</button></article>`).join('');
  const cards=postcards(trips);
  return page('おとも旅','',`<p class="notice">試遊の募集はこの端末の下書きです。おとも参加と絵はがきは街の架空の住人で試せます。</p>
    <section><h2>旅の募集を書く</h2><form id="companion-draft" class="surface flow">
      <div class="field-grid"><label>出発日<input type="date" name="date" required min="${today}" value="${today}"></label><label>おおまかな行き先<input name="place" required maxlength="60" placeholder="例：富山の海辺"></label></div>
      <label>ひとこと<textarea name="note" maxlength="320" rows="3" placeholder="景色を眺める旅。おとも募集中！"></textarea></label>
      <label>公開範囲の希望<select name="audience"><option value="self">自分だけ</option><option value="friends">友達</option><option value="public">みんな</option></select></label><button class="button">この端末に募集を保存</button></form>${draftList}</section>
    <section class="surface flow"><h2>おともを送る練習</h2><p>本体の旅人は自分の家や街に残り、おともの姿だけが別の旅に参加します。</p><div class="life-residents">${residents.map(person=>`<div><canvas data-companion="${person.id}" width="96" height="96" aria-hidden="true"></canvas><strong>${person.name}</strong><button type="button" class="button button-outline" data-world="demo-join" data-id="${person.id}" ${trips.joins.some(x=>x.target===person.id&&x.day===today)?'disabled':''}>${person.name}のおともに</button></div>`).join('')}</div>
      <label class="check-row"><input type="checkbox" data-world="companion-consent" ${trips.automatic?'checked':''}>自動同行の希望をこの端末に記録する</label>
      <p class="muted">運用案は、1日につき無料5回・有料10回。自分の旅には無料20人・有料30人まで。友達登録は原則人数制限なし。</p></section>
    ${cards.length?`<section><h2>おともから届いた絵はがき</h2>${cards.map(({id,day,group})=>`<article class="companion-postcard" data-postcard="${id}"><div class="postcard-people"><canvas data-companion="self" width="96" height="96" aria-hidden="true"></canvas>${group.map(person=>`<canvas data-companion="${person.id}" width="96" height="96" aria-hidden="true"></canvas>`).join('')}</div><h3>${day}のおみやげ</h3><p>${group.map(person=>person.name).join('、')}との思い出</p><div class="actions"><button type="button" class="world-btn" data-world="demo-postcard">絵はがきを保存する</button><button type="button" class="button button-outline" data-world="thank-companions" data-id="${id}" ${trips.thanks.includes(id)?'disabled':''}>${trips.thanks.includes(id)?'ありがとうを記録済み':'ありがとうを残す'}</button></div></article>`).join('')}</section>`:''}
    <p>${link('#home','広場へ','back','text-link')}</p>`,{narrow:true});
}
export function mountLife(root,avatar){
  for(const c of root.querySelectorAll('canvas[data-companion]')) {
    const other=residents.find(person=>person.id===c.dataset.companion);
    character(c,other?{...avatar,...other,glasses:0,accessory:0,bag:0}:avatar,'joy',1);
  }
  for(const c of root.querySelectorAll('.life-shop canvas'))ornament(c,c.dataset.item);
}
export async function downloadCompanionPostcard(picture){
  if(!picture)return;
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=560;
  const c=canvas.getContext('2d');c.fillStyle='#f4e6bf';c.fillRect(0,0,800,560);
  const img=new Image();img.src='./assets/world/trail.webp';await img.decode();
  c.drawImage(img,22,22,756,380);
  const figures=picture.querySelectorAll('canvas');
  for(const [i,figure] of [...figures].entries())c.drawImage(figure,400-65*figures.length+130*i,220,130,130);
  c.font='bold 38px serif';c.fillStyle='#514532';c.fillText('おともからの絵はがき',55,474);
  c.font='20px sans-serif';c.fillText('風待ちの街の住人と　・　試遊のイラスト',58,520);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('画像を作成できませんでした。');
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='おとも旅の絵はがき.png';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
