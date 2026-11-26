import { icon, link, page } from './ui.js';

const objects = [
  ['globe','地球儀','旅先を探す','#discover'], ['shelf','本棚','日記と旅の栞','#my?view=list'],
  ['camera','カメラ','写真の下書き','#photos'], ['medal','メダル','受け取った記念','#medals'],
  ['stamps','スタンプ帳','旅の足あと','#stamps'], ['mirror','鏡','旅人タイプ','#type'],
  ['case','スーツケース','旅の栞を作る','#trip/new'], ['mail','郵便受け','部屋へのお知らせ','#mail']
];

export function roomScreen(profile, layout, list) {
  const mode = layout === 'list' || layout === 'room' ? layout : profile.roomLayout ?? 'room';
  const controls = `<div class="actions room-settings"><button type="button" class="chip" data-action="room-layout" data-value="room" aria-pressed="${mode==='room'}">旅の部屋</button>
    <button type="button" class="chip" data-action="room-layout" data-value="list" aria-pressed="${mode==='list'}">一覧表示</button>
    ${link('#room-settings','音と動き',null,'text-link')}</div>`;
  const scene = `<div class="room-scene"><img src="./assets/travel-room.webp" width="1050" height="788" alt="" decoding="async" fetchpriority="high">
    ${objects.map(([id,name,description,href])=>`<a class="room-object ${id}" href="${href}" aria-label="${name} — ${description}"><span>${name}</span></a>`).join('')}</div>`;
  const navigation = `<nav class="room-links" aria-label="旅の部屋の道具">${objects.map(([,name,description,href])=>
    `<a href="${href}"><strong>${name}</strong><small>${description}</small></a>`).join('')}</nav>`;
  return page('私の旅','',`<div class="flow">${controls}${mode === 'room' ? scene : `${navigation}${list}`}</div>`);
}

export function roomSettings(profile) {
  const {motion = true, sound = false} = profile.effects ?? {};
  return page('音と動き','自分のペースで、旅の部屋を楽しむ。',`<form id="effects-form" class="surface flow">
    <label class="check-row"><input type="checkbox" name="motion" ${motion?'checked':''}>スタンプやページ送りの動きを使う</label>
    <label class="check-row"><input type="checkbox" name="sound" ${sound?'checked':''}>スタンプとメダルの音を使う</label>
    <p class="muted">端末の「視差効果を減らす」「アニメーションを減らす」設定も反映します。</p>
    <div class="actions"><button class="button">設定を保存</button>${link('#cottage','自分の世界へ','back','text-link')}</div></form>`,{narrow:true});
}

function realStampCount(profile){
  const keys=new Set(Object.keys(profile.stamps??{}));
  for(const [key,entries] of Object.entries(profile.visits??{}))if(entries.some(x=>x.kind==='self'||x.kind==='gps'))keys.add(key);
  return keys.size;
}
export const milestones = [
  {id:'first-stamp',name:'旅のはじまり',detail:'スタンプを1個押す', isEarned:profile=>realStampCount(profile) >= 1},
  {id:'three-stamps',name:'あちこち旅する人',detail:'スタンプを3個押す', isEarned:profile=>realStampCount(profile) >= 3},
  {id:'first-booklet',name:'小さな旅の支度',detail:'旅の栞を1冊保存する', isEarned:(_profile,data)=>data.trips.length >= 1}
];

export function medalPage(profile,data) {
  return page('旅のメダル','旅を重ねて見つけた、自分だけの記念。',`<div class="medal-list">
    ${milestones.map(medal=>{
      const claimed = (profile.medals ?? []).includes(medal.id);
      const earned = medal.isEarned(profile,data);
      return `<article data-medal="${medal.id}" class="surface medal-card${claimed?' obtained':''}"><span class="medal-icon" aria-hidden="true">${icon('stamp')}</span>
        <h2>${medal.name}</h2><p>${medal.detail}</p>${claimed ? '<small>受け取り済み</small>' : earned ?
          `<button type="button" class="button" data-action="claim-medal" data-id="${medal.id}">メダルを受け取る</button>` : '<small>まだ受け取れません</small>'}</article>`;
    }).join('')}</div><p>${link('#cottage','自分の世界へ','back','text-link')}</p>`);
}

export function mailbox(profile,data) {
  const available = milestones.filter(m=>m.isEarned(profile,data) && !(profile.medals ?? []).includes(m.id));
  return page('郵便受け','旅の部屋に届くお知らせ。',`<div class="surface flow">
    ${available.length ? `<h2>メダルが届きました</h2><ul>${available.map(m=>`<li>${m.name}</li>`).join('')}</ul>${link('#medals','メダルを見に行く','arrow')}` : '<p>新しいお知らせはありません。</p>'}
    <p class="muted">この版には部屋で獲得した記念のお知らせが届きます。旅人どうしの通知は準備中です。</p>
    ${link('#cottage','自分の世界へ','back','text-link')}</div>`,{narrow:true});
}

let audio;
export function playRoomSound(profile, effect) {
  if (!profile.effects?.sound) return;
  const Audio = window.AudioContext ?? window.webkitAudioContext;
  if (!Audio) return;
  try {
    audio ??= new Audio();
    audio.resume().catch(()=>{});
    const notes = effect === 'medal' ? [523,659,784] : [392];
    const start = audio.currentTime;
    notes.forEach((frequency,index)=>{
      const at = start+index*.075;
      const tone = audio.createOscillator(), volume = audio.createGain();
      tone.type = 'sine';
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(.001,at);
      volume.gain.exponentialRampToValueAtTime(.052,at+.016);
      volume.gain.exponentialRampToValueAtTime(.001,at+.19);
      tone.connect(volume).connect(audio.destination);
      tone.start(at);
      tone.stop(at+.20);
    });
  } catch {}
}

export function allowMotion(profile) {
  return profile.effects?.motion !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function roomMotion(profile,target,effect) {
  if (!target?.animate || !allowMotion(profile)) return;
  const frames = effect === 'page' ? [{opacity:.65,transform:'translateX(7px)'},{opacity:1,transform:'translateX(0)'}] :
    [{transform:'scale(.90)'},{transform:'scale(1.05)'},{transform:'scale(1)'}];
  target.animate(frames,{duration:effect==='page'?170:240,easing:'ease-out'});
}
