import {escapeHtml as e,stampKey} from './core.js';
import {collections,places} from './data.js';
import {page,link} from './ui.js';
import {dateInJapan} from './travel-life.js';
import {prefectures} from './world-data.js';

export const visitLabels={self:'自己申告',gps:'GPSで範囲を確認',virtual:'仮想旅行',companion:'おとも旅'};
const colors=['#946348','#636c54','#5b737b','#a4774e','#7e615c','#526f66'];
const titleLimit=48;

export function personalBook(fields){
  const name=String(fields.get('name')??'').trim();
  const names=[...new Set(String(fields.get('places')??'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean))];
  if(!name||name.length>titleLimit||!names.length||names.length>50||names.some(n=>n.length>titleLimit))
    throw new Error('帳名と場所を入力してください。各48文字、場所は50件までです。');
  return {country:'JP',id:'personal-'+crypto.randomUUID(),name,personal:true,items:names.map((name,i)=>({id:'place-'+(i+1),name,motif:'letter'}))};
}
function exactDate(date){
  const t=Date.parse(date);
  return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===date;
}
export function recordVisit(profile,key,date,kind,today=dateInJapan()){
  if(!Object.hasOwn(visitLabels,kind)||!exactDate(date)||date>today||date<'1900-01-01')throw new Error('訪問した日を選んでください。');
  const list=profile.visits?.[key]??[];
  if(list.some(entry=>entry.date===date&&entry.kind===kind))return profile;
  return {...profile,visits:{...profile.visits,[key]:[{date,kind},...list]}};
}
export function entryKinds(profile,key,item,game){
  const output=[...(profile.visits?.[key]??[])];
  const legacy=profile.stamps?.[key];
  if(legacy)output.push({kind:'self',date:legacy.slice(0,10)});
  if(key.startsWith('JP/prefecture/')){
    for(const entry of game.entries??[])if(entry.pref===item.id)output.push({kind:'self',date:dateInJapan(new Date(entry.date))});
    if(game.explored?.includes(item.id))output.push({kind:'virtual',date:''});
    for(const join of game.companions?.joins??[])if(join.pref===item.id)output.push({kind:'companion',date:join.day});
  }
  return output;
}
function pointInRing(x,y,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [a,b]=ring[i],[c,d]=ring[j];
    if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
  }
  return inside;
}
function distanceToRing(x,y,ring){
  let closest=Infinity;
  const scale=111200*Math.cos(y*Math.PI/180);
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [a,b]=ring[i],[c,d]=ring[j];
    const dx=(c-a)*scale,dy=(d-b)*111200,px=(x-a)*scale,py=(y-b)*111200;
    const length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,(px*dx+py*dy)/length)):0;
    closest=Math.min(closest,Math.hypot(px-t*dx,py-t*dy));
  }
  return closest;
}
export function gpsMatches(polygons,{latitude,longitude,accuracy}){
  if(![latitude,longitude,accuracy].every(Number.isFinite)||accuracy<0||accuracy>80)return false;
  const margin=accuracy+2500; // The generalized outlines are unsuitable for confirmation close to a border.
  return polygons.some(([outer,...holes])=>pointInRing(longitude,latitude,outer)&&
    !holes.some(ring=>pointInRing(longitude,latitude,ring))&&
    [outer,...holes].every(ring=>distanceToRing(longitude,latitude,ring)>margin));
}
function shapeStamp(canvas,item,inked){
  const c=canvas.getContext('2d');
  c.clearRect(0,0,112,112);
  const hash=[...item.id].reduce((n,ch)=>(n*31+ch.charCodeAt(0))>>>0,31);
  const color=colors[hash%colors.length];
  c.strokeStyle=color;c.fillStyle=color;c.lineWidth=2.2;c.lineCap='round';c.lineJoin='round';
  c.globalAlpha=inked?1:.58;
  function line(points,filled=false){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);if(filled){c.closePath();c.fill();}else c.stroke();}
  function disc(x,y,r,filled=false){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(filled)c.fill();else c.stroke();}
  if(hash%3===0){c.strokeRect(12,12,88,88);c.setLineDash([3,3]);c.strokeRect(16,16,80,80);}
  else{disc(56,56,47);c.setLineDash([2,3]);disc(56,56,42);}
  c.setLineDash([]);
  const sign=item.motif??'peak';
  const center=52+(hash%9)-4;
  const summit=item.altitude?Math.round(51-Math.min(3000,item.altitude)/180):37;
  disc(73,36+(hash%5),4);
  if(item.id==='fuji'){
    line([[24,74],[43,56],[49,40],[58,40],[65,57],[88,74]]);
    line([[43,55],[49,51],[52,55],[57,52],[62,54]]);
    line([[29,78],[82,78]]);
  }else if(item.id==='tsukuba'){
    line([[27,73],[43,49],[51,54],[56,52],[65,45],[85,73]]);
  }else if(item.id==='himeji'){
    for(const [y,width] of [[43,22],[52,30],[61,38],[71,46]])line([[56-width/2,y],[56,y-8],[56+width/2,y],[56-width/2,y]]);
    line([[37,72],[37,81],[75,81],[75,72]]);
  }else if(sign==='peak'||sign==='volcano'){
    line([[27,72],[center,summit],[63,58],[70,50],[87,73]]);
    line([[center-7,summit+15],[center-3,summit+12],[center+1,summit+16],[center+4,summit+12]]);
    if(sign==='volcano')line([[center,summit-5],[center+5,summit-10],[center+2,summit-15]]);
  }else if(['coast','island','lake','river','wetland'].includes(sign)){
    line([[27,58],[39,48],[54,54],[66,43],[79,50],[85,59]]);
    for(let y=64;y<=75;y+=5)line([[26,y],[39,y+1],[54,y],[68,y+1],[86,y]]);
    if(sign==='wetland')for(const x of [41,47,54])line([[x,72],[x-2,54],[x+2,52]]);
  }else if(['gate','village','castle','mine','bridge'].includes(sign)){
    if(sign==='gate'){line([[31,42],[42,40],[68,40],[81,42]]);line([[39,49],[74,49]]);line([[44,45],[44,72]]);line([[67,45],[67,72]]);}
    else if(sign==='mine'){line([[38,71],[38,55],[56,47],[74,55],[74,71],[38,71]]);line([[41,76],[50,68],[62,68],[71,76]]);}
    else if(sign==='bridge'){line([[26,69],[38,57],[56,51],[72,57],[87,69]]);line([[33,73],[76,73]]);}
    else{line([[30,55],[56,38],[83,55],[30,55]]);line([[39,55],[39,73],[73,73],[73,55]]);if(sign==='castle'){line([[41,46],[56,33],[72,46]]);line([[50,58],[50,68],[60,68],[60,58]]);}else line([[53,73],[53,63],[61,63],[61,73]]);}
  }else if(sign==='tea'){
    for(const y of [55,64,73])line([[28,y+4],[40,y],[57,y+1],[71,y-4],[83,y-4]]);
  }else if(sign==='garden'){
    disc(46,65,9);disc(62,56,7);disc(72,69,9);
    line([[30,78],[48,77],[60,79],[80,77]]);
  }else if(sign==='spa'){
    line([[33,64],[45,73],[69,73],[80,64]]);
    for(const x of [47,57,67])line([[x,61],[x-2,55],[x+2,49],[x,43]]);
  }else if(sign==='letter'){
    line([[33,49],[79,49],[79,73],[33,73],[33,49],[56,64],[79,49]]);
  }else{
    for(const [x,y] of [[37,62],[55,51],[73,60]]){line([[x,y-13],[x-9,y+5],[x+9,y+5]],true);line([[x,y+4],[x,y+13]]);}
  }
  for(let n=0;n<33;n++){
    const x=21+((hash+n*149)%69),y=22+(Math.floor(hash/7+n*37)%66);
    c.globalAlpha=.12;c.fillRect(x,y,1,1);
  }
  c.globalAlpha=1;
}
const searchable=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('ja');
const prefCenter=id=>{const p=prefectures.find(p=>p.id===id);return p?[p.lat,p.lon]:null;};
const selectedBooks=profile=>[...collections,...(profile.customBooks??[])];

export function stampScreen(id,params,profile,game){
  const books=selectedBooks(profile),book=books.find(x=>x.id===id)??books[0];
  const query=(params.get('q')??'').slice(0,48);
  const item=book.items.find(x=>x.id===params.get('item'));
  const list=book.items.filter(x=>searchable(x.name+' '+(x.area??'')).includes(searchable(query)));
  const collected=book.items.filter(x=>entryKinds(profile,stampKey(book,x),x,game).some(y=>y.kind==='self'||y.kind==='gps')).length;
  const option=(b)=>`<option value="${e(b.id)}" ${b.id===book.id?'selected':''}>${e(b.name)}（${b.items.length}）</option>`;
  const nav=`<form class="stamp-filters" id="stamp-search" data-book="${e(book.id)}"><label>スタンプ帳<select id="stamp-category">${books.map(option).join('')}</select></label><label>場所を探す<input name="q" type="search" value="${e(query)}" maxlength="48" placeholder="名前・地域"></label><button class="button button-outline">探す</button></form>`;
  const listMarkup=`<p class="stamp-progress"><strong>${collected} / ${book.items.length}</strong> 現実の旅${book.complete?'':' · 収録済みの場所'}</p><div class="passport-grid">${list.map(x=>{
    const marks=entryKinds(profile,stampKey(book,x),x,game);
    const real=marks.some(d=>d.kind==='self'||d.kind==='gps');
    const href='#stamps/'+book.id+'?'+new URLSearchParams({item:x.id,...(query?{q:query}:{})});
    return `<a href="${e(href)}" ${real?'data-inked':''} aria-label="${e(x.name)}${real?'・訪問記録あり':''}"><canvas data-stamp-art="${e(x.id)}" width="112" height="112" aria-hidden="true"></canvas><span>${e(x.name)}</span>${marks.length?`<small>${e([...new Set(marks.map(m=>visitLabels[m.kind]))].join(' · '))}</small>`:''}</a>`;}).join('')}</div>${!list.length?'<p>名前や地域を変えて探してください。</p>':''}`;
  const editor=`<details class="passport-personal"><summary>自分だけのスタンプ帳を作る</summary><form class="flow" id="stamp-custom"><label>スタンプ帳の名前<input name="name" required maxlength="${titleLimit}"></label><label>場所を1行に1か所ずつ<textarea name="places" rows="5" maxlength="2450" required placeholder="例：海辺の灯台"></textarea></label><button class="button">スタンプ帳を作る</button></form></details>`;
  return page('旅のスタンプ帳','',`<div class="passport" data-stamp-book="${e(book.id)}">${item?detail(book,item,profile,game,query):nav+listMarkup+editor}</div>`);
}

function detail(book,item,profile,game,query){
  const key=stampKey(book,item),marks=entryKinds(profile,key,item,game);
  const coords=item.coords?.[0]??(book.id==='prefecture'?prefCenter(item.id):null);
  const place=places.find(p=>p.id===item.id);
  const where=item.area??(book.id==='prefecture'?item.name:place?.region);
  const date=dateInJapan();
  const jump=(coords??(place?[place.lat,place.lng]:null));
  const source=item.source??book.source??place?.source;
  const back='#stamps/'+book.id+(query?'?'+new URLSearchParams({q:query}):'');
  return `<article class="passport-detail" data-inked><p>${link(back,book.name+'へ','back','text-link')}</p><canvas data-stamp-art="${e(item.id)}" width="112" height="112" aria-hidden="true"></canvas><h2>${e(item.name)}</h2>
    ${where?`<p>範囲・所在地　${e(where)}</p>`:''}${item.altitude?`<p>代表する山頂　${e(item.peak)}（${item.altitude.toLocaleString('ja-JP')}m）</p>`:''}
    ${jump?`<p><a href="https://maps.gsi.go.jp/#12/${jump[0]}/${jump[1]}/" target="_blank" rel="noopener noreferrer">代表地点を地理院地図で見る（別のタブ）</a></p>`:''}
    ${item.coords?.length>1?`<small>構成資産の公開座標 ${item.coords.length}地点</small>`:''}
    <form id="visit-stamp" class="flow" data-book="${e(book.id)}" data-item="${e(item.id)}"><h3>訪れた日を記録</h3><label>訪問日<input type="date" name="date" required value="${date}" min="1900-01-01" max="${date}"></label><button class="button">自己申告でスタンプを押す</button></form>
    ${book.id==='prefecture'?`<div class="flow"><button class="button button-outline" type="button" data-stamp-gps="${e(item.id)}">現在地をGPSで確認</button><p class="muted">位置はこの確認だけに使用します。記録には都道府県名と日付だけが残ります。境界周辺では自己申告をお使いください。</p><p data-gps-message role="status"></p></div>`:''}
    <h3>この場所の記録</h3>${marks.length?`<ul>${marks.map(mark=>`<li>${visitLabels[mark.kind]}${mark.date?'　'+e(mark.date):''} ${(profile.visits?.[key]?.some(x=>x===mark)||(profile.stamps?.[key]?.slice(0,10)===mark.date&&mark.kind==='self'))?` <button type="button" class="world-text" data-stamp-remove="${e(mark.kind)}" data-date="${e(mark.date)}" data-item="${e(item.id)}">取り消す</button>`:''}</li>`).join('')}</ul>`:'<p>まだ記録はありません。</p>'}
    ${item.source&&book.source&&item.source!==book.source?`<p><a href="${e(book.source)}" target="_blank" rel="noopener noreferrer">全件一覧の出典（別のタブ）</a></p>`:''}
    ${source?`<p class="muted">確認日 ${e(book.updated??'2026-11-25')}${book.dataVersion?' · 資料 '+e(book.dataVersion):''} · <a href="${e(source)}" target="_blank" rel="noopener noreferrer">一覧・指定範囲の出典（別のタブ）</a></p>`:''}${book.id==='prefecture'?'<p class="muted">範囲の目安は <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a> の簡略境界を使用します。</p>':''}</article>`;
}
export function mountStampArt(root,profile){
  const book=selectedBooks(profile).find(b=>b.id===root.querySelector('[data-stamp-book]')?.dataset.stampBook);
  if(!book)return;
  const items=new Map(book.items.map(item=>[item.id,item]));
  for(const canvas of root.querySelectorAll('[data-stamp-art]'))shapeStamp(canvas,items.get(canvas.dataset.stampArt),canvas.closest('[data-inked]')!==null);
}
export function findStamp(profile,book,id){
  const collection=selectedBooks(profile).find(b=>b.id===book);
  const item=collection?.items.find(entry=>entry.id===id);
  return item?stampKey(collection,item):null;
}
