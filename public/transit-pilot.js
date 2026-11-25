import { escapeHtml as e, walkingLimits } from './core.js';
import { link, options, page } from './ui.js';

export async function loadToyamaPilot() {
  const [schedule,walking] = await Promise.all([import('./data/toyama-schedule.js'),import('./data/toyama-walking.js')]);
  return {schedule:schedule.default,walking:walking.default};
}

export function isScheduleDate(schedule,date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) &&
    date.replaceAll('-','') >= schedule.start && date.replaceAll('-','') <= schedule.end &&
    new Date(date).toISOString().slice(0,10) === date;
}

function operates(schedule,service,date,weekday) {
  const exception = schedule.exceptions[`${service}/${date}`];
  if (exception) return exception === 1;
  const valid = schedule.calendars[service];
  return Boolean(valid && date >= valid[0] && date <= valid[1] && schedule.weekdays[service]?.[weekday]);
}

export function searchToyama({schedule,walking}, {from,to,date,time,limit}) {
  const origin = schedule.points.findIndex(([id])=>id===from);
  const target = schedule.points.findIndex(([id])=>id===to);
  if (origin<0 || target<0 || origin===target || !walkingLimits.includes(limit) || !isScheduleDate(schedule,date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return [];
  const start = time.split(':').reduce((hours,minutes)=>Number(hours)*3600+Number(minutes)*60);
  const maxWalk = limit*60;
  const dateKey = date.replaceAll('-','');
  const weekday = new Date(date).getUTCDay();
  const best = new Map();
  const direct = walking[origin][target];
  if (Number.isFinite(direct) && direct<=maxWalk) {
    best.set('徒歩のみ',{type:'walk',start,end:start+direct,walk:direct});
  }
  for (const [route,service,stops] of schedule.trips) {
    if (!operates(schedule,service,dateKey,weekday)) continue;
    for (let board=0; board<stops.length-1; board++) {
      const [at,,departure,pickup] = stops[board];
      const access = walking[origin][at];
      if (!pickup || !Number.isFinite(access) || access>maxWalk || departure<start+access) continue;
      for (let off=board+1; off<stops.length; off++) {
        const [endStop,arrival,,,dropoff] = stops[off];
        const egress = walking[endStop][target];
        if (!dropoff || !Number.isFinite(egress) || access+egress>maxWalk || endStop===at || arrival<=departure) continue;
        const end = arrival+egress;
        const previous = best.get(route);
        if (previous && (previous.end<end || (previous.end===end && previous.walk<=access+egress))) continue;
        best.set(route,{type:'bus',route,at,endStop,departure,arrival,access,egress,
          walk:access+egress,start,end,fare:schedule.fares[route]});
      }
    }
  }
  return [...best.values()].sort((a,b)=>a.end-b.end || a.walk-b.walk);
}

const clock = seconds => {
  const h = Math.floor(seconds/3600), m = Math.floor(seconds/60)%60;
  return `${h>=24?'翌日 ':''}${String(h%24).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
};
const minutes = seconds => `${Math.ceil(seconds/60)}分`;
const iso = short => `${short.slice(0,4)}-${short.slice(4,6)}-${short.slice(6)}`;

function results(pilot, request) {
  const {schedule} = pilot;
  if (!isScheduleDate(schedule,request.date)) return '<p class="notice">収録期間内の日付を選んでください。</p>';
  if (request.from===request.to) return '<p class="notice">出発地と目的地を別に選んでください。</p>';
  const routes = searchToyama(pilot,request);
  if (!routes.length) return `<p class="notice">この日時・徒歩${request.limit}分以内で、収録データから行ける候補は見つかりませんでした。条件を変えて調べられます。</p>`;
  return `<div class="flow">${routes.map(route=>`<article class="surface flow pilot-result">
    <h3>${route.type==='walk'?'徒歩のみ':`まいどはやバス ${e(route.route)}`}</h3>
    <p><strong>${clock(route.start)} → ${clock(route.end)}</strong> <span class="muted">所要 約${minutes(route.end-route.start)} · 徒歩 約${minutes(route.walk)} / 上限${request.limit}分</span></p>
    ${route.type==='bus'?`<ol><li>乗り場まで歩く 約${minutes(route.access)} · ${e(schedule.points[route.at][1])}</li><li>${clock(route.departure)} 発 → ${clock(route.arrival)} 着 · ${e(schedule.points[route.endStop][1])}</li><li>目的地まで歩く 約${minutes(route.egress)}</li></ol><p class="muted">${Number.isFinite(route.fare)?`収録運賃 ${route.fare}円`:'運賃の収録なし'}</p>`:''}
  </article>`).join('')}</div>`;
}

export function pilotPage(pilot,request) {
  const back = link('#route','行き方へ','back','text-link');
  if (!pilot) return page('富山市で行き方を探す','',`<p role="status">${pilot===false?'データを読み込めませんでした。ページを再読み込みしてください。':'時刻表を読み込んでいます。'}</p>${back}`,{narrow:true});
  const {schedule} = pilot;
  const today = new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Tokyo'}).format();
  const select = (name, label, current) => `<label>${label}<select name="${name}">${schedule.points.filter(([,label],index,points)=>points.findIndex(([,other])=>other===label)===index)
    .map(([id,label])=>`<option value="${id}" ${current===id?'selected':''}>${e(label)}</option>`).join('')}</select></label>`;
  return page('富山市で行き方を探す','まいどはやバスの東・西ルートと徒歩を組み合わせます。',`<div class="flow">
    ${!isScheduleDate(schedule,today) ? '<p class="notice">今日の日付は収録対象外です。収録期間の日付を選んで当時の時刻表を確認できます。</p>' : ''}
    <form id="pilot-form" class="surface flow">
      <div class="field-grid">${select('from','出発地',request?.from ?? '1_01')}${select('to','目的地',request?.to ?? '28_01')}</div>
      <div class="field-grid"><label>日付<input type="date" name="date" required min="${iso(schedule.start)}" max="${iso(schedule.end)}" value="${e(request?.date ?? (isScheduleDate(schedule,today)?today:iso(schedule.start)))}"></label>
        <label>出発時刻（日本時間）<input type="time" name="time" required value="${e(request?.time ?? '10:00')}"></label></div>
      <fieldset><legend>歩く時間の合計上限</legend>${options('limit',walkingLimits,request?.limit ?? 30,value=>value===30?'30分':`${value/60}時間`)}</fieldset>
      <button class="button">経路を検索</button>
    </form>
    ${request ? `<section id="pilot-results" tabindex="-1" class="flow"><h2>検索結果</h2>${results(pilot,request)}</section>` : ''}
    <p class="notice">収録した時刻表を使った試作です。バス1便と前後の徒歩、または徒歩のみを検索します。バス同士の乗換、遅延、通行止めには未対応です。徒歩の所要時間は推定で、実際の運行や歩道の状況は出発前に確認してください。</p>
    <p class="muted">収録期間 ${iso(schedule.start)}〜${iso(schedule.end)} · 取得 ${schedule.fetchDate}。<a href="${schedule.source}" target="_blank" rel="noopener noreferrer">富山市 まいどはやバス GTFS-JP（CC0）</a>を加工。徒歩 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors（ODbL）</a>・<a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer">FOSSGIS OSRM</a>。<a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">地図の修正</a></p>${back}
  </div>`,{narrow:true});
}
