import {escapeHtml as e} from './core.js';
import {icon} from './ui.js';
import {character} from './traveler-art.js';

const town=[
  ['家',27,45,41,52,'#cottage','home'],['駅',79,44,62,50,'#pilot','route'],
  ['案内所',20,65,37,66,'#discover','compass'],['広場',79,67,64,66,'#home','heart'],
  ['旅の店',20,82,39,79,'#shop','stamp'],['郵便',81,85,62,79,'#companions','send'],['占いの館',51,33,50,41,'#type','compass']
];
const home=[
  ['本棚',20,29,33,40,'#my?view=list','book'],['ベッド',82,34,63,45,'sleep','home'],
  ['机',18,59,34,60,'#memories','edit'],['お茶',82,66,64,64,'drink','heart'],
  ['鏡',79,14,64,41,'#avatar','compass'],['模様替え',19,82,36,79,'#decorate','stamp']
];
export function gameStage(kind,title,avatar,extras='',guide=''){
  const inside=kind==='inside';
  const actions=inside?home:town;
  return `<section class="world playable-world">
    <div class="game-stage ${kind}" data-stage="${kind}">
      <img class="stage-background" src="./assets/world/${kind}.webp" alt="" width="764" height="1024">${extras}
      <header class="stage-hud"><a href="#menu" aria-label="旅のメニュー">≡</a><h1>${e(title)}</h1><a href="#shop" aria-label="旅コインとお店">◉</a></header>
      <div class="stage-player"><canvas data-person data-pose="look" width="112" height="112" aria-hidden="true"></canvas></div>
      <span class="footfall" aria-hidden="true"></span>
      <button class="stage-floor" type="button" aria-label="床をタップして旅人を移動"></button>
      ${actions.map(([label,x,y,, ,target,glyph],i)=>`<button type="button" class="stage-point point-${i}" data-spot="${i}" data-x="${x}" data-y="${y}" aria-label="${label}">${icon(glyph)}<span>${label}</span><span class="visually-hidden">${target.startsWith('#')?'へ歩く':'を使う'}</span></button>`).join('')}
      <div class="stage-dock"><span class="stage-name">${e(avatar.name)}</span><a class="stage-action" href="${inside?'#atlas':'#activity'}">${inside?'地図をひらく':'体験を記録'} →</a></div>
      <div id="stage-message" role="status" aria-live="polite"></div>
    </div>${guide}</section>`;
}

export function mountStage(root,go,reduced){
  const stage=root.querySelector('[data-stage]');
  if(!stage)return ()=>{};
  const inside=stage.dataset.stage==='inside', points=inside?home:town;
  const actor=stage.querySelector('.stage-player'),canvas=actor.querySelector('canvas');
  const message=stage.querySelector('#stage-message');
  const ripple=stage.querySelector('.footfall');
  let location={x:50,y:81}, path=[], intent=null, last=0, animation=0, rest=0;
  let touch=null,touchHandledAt=-Infinity;
  const place=()=>{
    actor.style.left=location.x+'%';actor.style.top=location.y+'%';
    actor.style.setProperty('--depth',String(.68+.38*(location.y/100)));
  };
  for(const b of stage.querySelectorAll('[data-spot]')){
    b.style.left=b.dataset.x+'%';b.style.top=b.dataset.y+'%';
  }
  const arrive=()=>{
    canvas.dataset.pose=intent?.startsWith('#')||!intent?'look':intent;
    if(reduced&&canvas._avatar)character(canvas,canvas._avatar,canvas.dataset.pose);
    if(intent?.startsWith('#'))go(intent);
    else if(intent){message.textContent=intent==='drink'?'お茶をいれました。':'ベッドでひと休み。';rest=setTimeout(()=>{canvas.dataset.pose='look';if(reduced)character(canvas,canvas._avatar,'look');message.textContent='';},4400);}
    intent=null;
  };
  function tick(now){
    const elapsed=Math.min(now-last,32)||16;
    last=now;
    const goal=path[0], dx=goal.x-location.x, dy=goal.y-location.y;
    const distance=Math.hypot(dx,dy),step=.077*elapsed;
    if(Math.abs(dy)>Math.abs(dx)*1.8)canvas.dataset.direction=dy<0?'north':'south';
    else if(Math.abs(dx)>Math.abs(dy)*1.8)canvas.dataset.direction=dx<0?'west':'east';
    else canvas.dataset.direction=(dy<0?'north':'south')+(dx<0?'west':'east');
    if(distance<=step){location=path.shift();place();}
    else{location={x:location.x+dx/distance*step,y:location.y+dy/distance*step};place();}
    if(path.length)animation=requestAnimationFrame(tick);else arrive();
  }
  function walk(x,y,target){
    clearTimeout(rest);cancelAnimationFrame(animation);last=0;intent=target;
    if(reduced){location={x,y};place();arrive();return;}
    ripple.style.left=x+'%';ripple.style.top=y+'%';
    ripple.getAnimations().forEach(animation=>animation.cancel());
    ripple.animate([{opacity:.75,transform:'translate(-50%,-50%) scale(.6)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.4)'}],{duration:480});
    path=[];
    // The main aisle joins the side doors without walking through furniture.
    if(Math.abs(x-location.x)>16&&Math.abs(y-location.y)>14)path.push({x:50,y:location.y},{x:50,y});
    path.push({x,y});canvas.dataset.pose='walk';animation=requestAnimationFrame(tick);
  }
  function enter(spot){
    const [label,,,x,y,target]=points[Number(spot.dataset.spot)];
    message.textContent=label+'へ…';walk(x,y,target);
  }
  stage.onpointerdown=event=>{
    const spot=event.target.closest('[data-spot]');
    if(event.pointerType==='touch'&&spot)touch={spot,id:event.pointerId,x:event.clientX,y:event.clientY};
  };
  stage.onpointercancel=()=>{touch=null;};
  stage.onpointerup=event=>{
    if(!touch||event.pointerId!==touch.id)return;
    const {spot,x,y}=touch;touch=null;
    if(Math.hypot(x-event.clientX,y-event.clientY)>12)return;
    touchHandledAt=performance.now();
    enter(spot);
  };
  stage.onclick=event=>{
    if(event.detail && performance.now()-touchHandledAt<420)return;
    const spot=event.target.closest('[data-spot]');
    if(spot){enter(spot);return;}
    if(!event.target.closest('.stage-floor'))return;
    const b=stage.getBoundingClientRect();
    const x=event.detail?(event.clientX-b.left)/b.width*100:50;
    const y=event.detail?(event.clientY-b.top)/b.height*100:72;
    const band=inside?23:y>72?13:10;
    message.textContent='';
    walk(Math.max(50-band,Math.min(50+band,x)),Math.max(inside?39:35,Math.min(91,y)),null);
  };
  stage.onkeydown=event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||!event.target.closest('.stage-floor'))return;
    event.preventDefault();
    const dx=event.key==='ArrowLeft'?-5:event.key==='ArrowRight'?5:0;
    const dy=event.key==='ArrowUp'?-6:event.key==='ArrowDown'?6:0;
    walk(Math.max(38,Math.min(62,location.x+dx)),Math.max(inside?40:35,Math.min(91,location.y+dy)),null);
  };
  place();
  return ()=>{cancelAnimationFrame(animation);clearTimeout(rest);};
}
