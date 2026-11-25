import { practicalMap, practicalMarkup } from './world-map.js';
import { escapeHtml as e, walkingLimits } from './core.js';
import { link, page } from './ui.js';
import { isScheduleDate, searchRegion } from './transit-router.js';

export async function loadToyamaPilot() {
  const [schedule,walking,geometry,footpaths] = await Promise.all([import('./data/toyama-schedule.js'),import('./data/toyama-walking.js'),import('./data/toyama-geometry.js'),import('./data/toyama-footpaths.js')]);
  if ([walking,geometry].some(module=>module.default.pointHash!==schedule.default.pointHash)) throw new Error('Unmatched transport snapshots');
  return {geometry:geometry.default,footpaths:footpaths.default.pointHash===schedule.default.pointHash?footpaths.default.paths:{},schedule:schedule.default,walking:walking.default.durationSeconds,walkDate:walking.default.builtOn};
}

const modeLabel = {bus:'バス',tram:'路面電車',rail:'鉄道',place:'周辺地点'};
const clock = seconds => {
  const h = Math.floor(seconds/3600), m = Math.floor(seconds/60)%60;
  return `${h>=24?'翌日 ':''}${String(h%24).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
};
const minutes = seconds => `${Math.ceil(seconds/60)}分`;
const iso = short => `${short.slice(0,4)}-${short.slice(4,6)}-${short.slice(6)}`;

function step(schedule,leg) {
  const from = e(schedule.points[leg.from][1]), to = e(schedule.points[leg.to][1]);
  if (leg.mode==='walk') return `<li><strong>徒歩 約${minutes(leg.end-leg.start)}</strong> <span>${from} → ${to}</span></li>`;
  const [,name,mode] = schedule.routes[leg.route];
  return `<li><strong>${modeLabel[mode]} · ${e(name)}</strong> <span>${clock(leg.start)}発 ${from} → ${clock(leg.end)}着 ${to}</span></li>`;
}

function results(pilot,request) {
  const {schedule} = pilot;
  if (!isScheduleDate(schedule,request.date)) return '<p class="notice">収録期間内の日付を選んでください。</p>';
  if (request.from===request.to) return '<p class="notice">出発地と目的地を別に選んでください。</p>';
  const routes = searchRegion(pilot,request);
  const firstArrival=routes[0]?.end;
  if(request.order==='fare')routes.sort((a,b)=>(a.fare??Infinity)-(b.fare??Infinity)||a.end-b.end);
  const titles = ['徒歩のみ','路面電車','バス','路面電車とバス'];
  if (!routes.length) return `<p class="notice">この日時・徒歩${request.limit}分以内で${request.mixed?'路面電車とバスの両方を使う':''}候補は収録データから見つかりませんでした。</p>`;
  return `<div class="flow">${routes.map(route=>`<article class="surface flow pilot-result" data-modes="${route.mask}" data-walking="${route.walk}">
    <h3>${titles[route.mask]}${route.end===firstArrival?' · 到着が最も早い候補':''}</h3>
    <p><strong>${clock(route.start)} → ${clock(route.end)}</strong> <span class="muted">所要 約${minutes(route.end-route.start)} · 徒歩 約${minutes(route.walk)} / 上限${request.limit}分${route.rides>1?` · 乗り換え${route.rides-1}回`:''}</span></p>
    <ol>${route.legs.map(leg=>step(schedule,leg)).join('')}</ol>
    <details data-route-legs="${e(JSON.stringify(route.legs))}"><summary>実際の地図で見る</summary><p class="muted">青は路面電車、赤はバス、緑の点線は収録済みの徒歩経路です。未収録の徒歩区間は両端の地点だけを示します。</p>${practicalMarkup('この候補の乗車と徒歩の地図')}</details>
    ${detour(pilot,route,request.limit)}
    ${route.rides?`<p class="muted">${Number.isFinite(route.fare)?`収録運賃の合計 ${route.fare}円 · 割引などは含みません`:'運賃の全区間分は収録されていません'}</p>`:''}
  </article>`).join('')}</div>`;
}

function detour({schedule,walking},route,limit) {
  const exits=new Set(route.legs.filter(l=>l.mode==='ride').map(l=>l.to));
  const best=new Map();
  schedule.points.forEach((point,index)=>{
    if(point[2]!=='place'||route.legs.at(-1)?.to===index)return;
    for(const stop of exits){
      const out=walking[stop][index],back=walking[index][stop];
      if(!Number.isFinite(out)||!Number.isFinite(back)||out+back>1800||route.walk+out+back>limit*60)continue;
      if(!best.has(index)||out+back<best.get(index).time)best.set(index,{stop,time:out+back});
    }
  });
  if(!best.size)return '';
  return `<details><summary>降車地点からの寄り道</summary><ul>${[...best].map(([i,d])=>`<li>${e(schedule.points[d.stop][1])}から${e(schedule.points[i][1])}まで往復徒歩 約${minutes(d.time)}</li>`).join('')}</ul><p class="muted">歩ける時間内の候補です。滞在時間と乗り継ぐ便は再検索してください。</p></details>`;
}

export function pilotPage(pilot,request) {
  const back = link('#route','行き方へ','back','text-link');
  if (!pilot) return page('富山市で行き方を探す','',`<p role="status">${pilot===false?'データを読み込めませんでした。ページを再読み込みしてください。':'時刻表を読み込んでいます。'}</p>${back}`,{narrow:true});
  const {schedule} = pilot;
  const today = new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:schedule.timezone}).format();
  const select = (name,label,current) => {
    const seen = new Set();
    const list = schedule.points.filter(([,text,mode])=>{
      const key=`${mode}/${text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return `<label><span id="pilot-${name}-label">${label}</span><select name="${name}" aria-labelledby="pilot-${name}-label">${list.map(([id,text,mode])=>`<option value="${e(id)}" ${current===id?'selected':''}>${e(text)}${mode==='place'?'':`（${modeLabel[mode]}）`}</option>`).join('')}</select></label>`;
  };
  return page('富山市で行き方を探す','富山地方鉄道の市内電車、まいどはやバス、徒歩を組み合わせます。',`<div class="flow">
    ${!isScheduleDate(schedule,today) ? '<p class="notice">今日の日付は収録対象外です。収録期間の日付を選んで当時の時刻表を確認できます。</p>' : ''}
    <form id="pilot-form" class="surface flow">
      <div class="field-grid">${select('from','出発地',request?.from ?? 'maidohaya/31_01')}${select('to','目的地',request?.to ?? 'chitetsu-tram/3003-C39_01')}</div>
      <div class="field-grid"><label>日付<input type="date" name="date" required min="${iso(schedule.start)}" max="${iso(schedule.end)}" value="${e(request?.date ?? (isScheduleDate(schedule,today)?today:iso(schedule.start)))}"></label>
        <label>出発時刻（日本時間）<input type="time" name="time" required value="${e(request?.time ?? '10:00')}"></label></div>
      <fieldset><legend>歩く時間の合計上限</legend><div class="world-actions">${walkingLimits.map(n=>`<button type="button" class="chip" data-walk-minutes="${n}">${n===30?'30分':n/60+'時間'}</button>`).join('')}</div><label>分単位で設定（0〜180分）<input type="number" min="0" max="180" step="1" required name="limit" value="${request?.limit??30}"></label></fieldset>
      <label>表示する候補の順番<select name="order"><option value="arrival">到着が早い順</option><option value="fare" ${request?.order==='fare'?'selected':''}>収録された運賃が低い順</option></select></label>
      <small>全区間の運賃が分かる候補を比較します。運賃が未収録の候補は運賃順の末尾に表示します。</small>
      <label class="check-row"><input type="checkbox" name="mixed" ${request?.mixed?'checked':''}>路面電車とバスの両方を使う</label>
      <button class="button">経路を検索</button>
    </form>
    ${request ? `<section id="pilot-results" tabindex="-1" class="flow"><h2>検索結果</h2>${results(pilot,request)}</section>` : ''}
    <p class="notice">出発から6時間以内、乗り換え2回までの時刻表検索です。徒歩の時間は推定です。運休、遅延、通行止め、他社の路線は反映されません。</p>
    <details><summary>時刻表と徒歩データの出典</summary><p class="muted">両方の時刻表に対応する期間 ${iso(schedule.start)}〜${iso(schedule.end)} · 検証日 ${schedule.verified}</p>
      <ul class="muted">${schedule.feeds.map(feed=>`<li><a href="${e(feed.source)}" target="_blank" rel="noopener noreferrer">${e(feed.name)}（${e(feed.license)}）</a></li>`).join('')}</ul>
      <p class="muted">徒歩 ${pilot.walkDate}算出 · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors（ODbL）</a>・<a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer">FOSSGIS OSRM</a>。<a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">地図の修正</a></p>
    </details>${back}
  </div>`,{narrow:true});
}

export function geometryForLeg(pilot,leg) {
  const {schedule,geometry,footpaths}=pilot;
  if(leg.mode==='walk'){
    const key=schedule.points[leg.from][0]+'>'+schedule.points[leg.to][0];
    return footpaths[key]?[{mode:'walk',coords:footpaths[key]}]:
      [leg.from,leg.to].map(stop=>({mode:'point',coords:[geometry.stops[stop]]}));
  }
  const aligned=geometry.alignments[leg.alignment];
  const mode=schedule.routes[leg.route][2];
  if(!aligned)return [leg.from,leg.to].map(stop=>({mode:'point',coords:[geometry.stops[stop]]}));
  const [lineId,offsets]=aligned,line=geometry.lines[lineId],start=offsets[leg.firstCall],end=offsets[leg.lastCall];
  const point=n=>{const i=Math.floor(n),a=line[i],b=line[Math.min(i+1,line.length-1)];return a.map((v,k)=>v+(b[k]-v)*(n-i));};
  return [{mode,coords:[point(start),...line.slice(Math.floor(start)+1,Math.ceil(end)),point(end)]}];
}
export function mountRouteMaps(root,pilot) {
  const mounted=new Map();
  for(const details of root.querySelectorAll('details[data-route-legs]'))details.ontoggle=()=>{
    if(!details.isConnected)return;
    mounted.get(details)?.();mounted.delete(details);
    if(details.open){
      const legs=JSON.parse(details.dataset.routeLegs).flatMap(leg=>geometryForLeg(pilot,leg));
      mounted.set(details,practicalMap(details.querySelector('.tile-widget'),[36.7,137.21],{legs,fit:true}));
    }
  };
  for(const button of root.querySelectorAll('[data-walk-minutes]'))button.onclick=()=>{button.form.elements.limit.value=button.dataset.walkMinutes;};
  return ()=>{for(const close of mounted.values())close();mounted.clear();};
}
