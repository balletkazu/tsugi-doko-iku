import { escapeHtml as e, walkingLimits } from './core.js';
import { link, options, page } from './ui.js';
import { isScheduleDate, searchRegion } from './transit-router.js';

export async function loadToyamaPilot() {
  const [schedule,walking] = await Promise.all([import('./data/toyama-schedule.js'),import('./data/toyama-walking.js')]);
  if (schedule.default.pointHash !== walking.default.pointHash) throw new Error('Unmatched transport snapshots');
  return {schedule:schedule.default,walking:walking.default.durationSeconds,walkDate:walking.default.builtOn};
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
  const titles = ['徒歩のみ','路面電車','バス','路面電車とバス'];
  if (!routes.length) return `<p class="notice">この日時・徒歩${request.limit}分以内で${request.mixed?'路面電車とバスの両方を使う':''}候補は収録データから見つかりませんでした。</p>`;
  return `<div class="flow">${routes.map((route,index)=>`<article class="surface flow pilot-result" data-modes="${route.mask}" data-walking="${route.walk}">
    <h3>${titles[route.mask]}${index===0?' · 到着が最も早い候補':''}</h3>
    <p><strong>${clock(route.start)} → ${clock(route.end)}</strong> <span class="muted">所要 約${minutes(route.end-route.start)} · 徒歩 約${minutes(route.walk)} / 上限${request.limit}分${route.rides>1?` · 乗り換え${route.rides-1}回`:''}</span></p>
    <ol>${route.legs.map(leg=>step(schedule,leg)).join('')}</ol>
    ${route.rides?`<p class="muted">${Number.isFinite(route.fare)?`収録運賃の合計 ${route.fare}円 · 割引などは含みません`:'運賃の全区間分は収録されていません'}</p>`:''}
  </article>`).join('')}</div>`;
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
      <fieldset><legend>歩く時間の合計上限</legend>${options('limit',walkingLimits,request?.limit ?? 30,value=>value===30?'30分':`${value/60}時間`)}</fieldset>
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
