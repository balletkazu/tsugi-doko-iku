import {furniture as artBounds,souvenir as relicBounds,regionalObjects} from './sprite-guides.js';
import {materialGuides} from './material-guides.js';
import {escapeHtml as e} from './core.js';
import {travelerAssets} from './traveler-art.js';
import {relicIcons} from './item-catalog.js';
import {character,ornament} from './world-art.js';
import {homeAreas,coverings,coveringsFor,homeProjection,furniture,homeStock,readHome,canPlace,footprint,homePath,around} from './home-layout.js';

// A little warmth on an explicit tap, inspired by the four well-being factors.
const greetings=[
  '気が向いたら、知らない小道を一本だけ歩いてみよう。',
  '一緒に過ごせるのがうれしいな。',
  'ひと息ついてから、ゆっくり考えよう。',
  '今日はここで休んでいこう。'
];

const textures=['./assets/world/empty-room.webp','./assets/world/open-garden.webp'];
const furnitureSheet='./assets/atelier/furnishings.webp';
const option=(key,label,pressed=false)=>`<button type="button" data-house="${key}" aria-pressed="${pressed}">${label}</button>`;
const areaLink=(area,edit)=>`<a href="#${edit?'decorate':'cottage'}${area==='room'?'':'/'+area}">${homeAreas[area].name}</a>`;
export function homesteadScreen(game,avatar,id,edit,guide='',title=''){
  const layout=readHome(game);
  const area=Object.hasOwn(homeAreas,id)&&(id==='room'||id==='garden'||layout.additions.includes(id))?id:'room';
  return `<section class="world home-play" data-homestead="${area}" data-edit="${edit}">
    <header class="house-header"><a href="${edit?'#cottage':'#avatar'}" aria-label="${edit?'家に戻る':'着せ替え'}">${edit?'‹':'✦'}</a><div><h1>${edit?'模様替え':e(avatar.name)+'の家'}</h1>${title?`<small class="house-title">${e(title)}</small>`:''}</div>
    ${edit?'<button type="button" class="house-save" data-house="save">配置を保存</button>':'<a class="house-save" href="#decorate'+(area==='room'?'':'/'+area)+'">模様替え</a>'}</header>
    <nav class="house-areas" aria-label="家と庭">${['room','garden',...layout.additions].map(zone=>areaLink(zone,edit)).join('')} ${edit&&layout.additions.length<2?`<button type="button" data-house="expand">＋ 広げる</button>`:''}</nav>
    <div class="house-stage"><canvas data-home-view aria-label="${homeAreas[area].name}の風景、家具、旅人。矢印キーで移動、Enterで決定" tabindex="0"></canvas>
    <div class="house-map-control">${option('zoom-out','−')}${option('zoom-in','＋')}</div>
    <p data-house-status role="status"></p><div class="house-choices" hidden></div></div>
    ${edit?`<div class="house-dock"><nav aria-label="模様替えの種類">${option('objects','家具',true)}${option('styles',homeAreas[area].outside?'外観':'壁・床')}${option('pictures','写真')}</nav><div class="house-toolbox"></div></div>`:
    `<nav class="house-dock visits" aria-label="自分の世界">
      <a href="#avatar">着せ替え</a><a href="#memories">思い出</a><button type="button" data-house="list">家具を使う</button>
      <details class="house-inventory"><summary>持ちもの</summary><div><a href="#cabinet">冒険図鑑</a><a href="#medals">勲章</a><a href="#shop">旅コインと道具</a><a href="#mail">お知らせ</a></div></details></nav>`}
    ${guide}</section>`;
}
function image(url,draw){
  const img=new Image();img.onload=draw;img.src=url;return img;
}
function loaded(img){return img?.complete&&img.naturalWidth>0;}
export function mountHomestead(root,{game,avatar,reduced,commit,notify}){
  const scene=root.querySelector('[data-homestead]');
  if(!scene)return ()=>{};
  const area=scene.dataset.homestead,spec=homeAreas[area],editing=scene.dataset.edit==='true';
  const layout=structuredClone(readHome(game));
  const canvas=scene.querySelector('[data-home-view]'),ctx=canvas.getContext('2d');
  const status=scene.querySelector('[data-house-status]');
  const projection=homeProjection(spec);
  const ground=projection.toPlane;
  const tileCenter=([x,y])=>ground([x+.5,y+.5]);
  const wallPoint=([x,y])=>[ground([x,0])[0],projection.top*(.27+.52*y/spec.height)];
  const cellPoint=(point,wall=false)=>wall?[
    (point[0]-ground([0,0])[0])*spec.width/projection.visible(0),
    (point[1]/projection.top-.27)*spec.height/.52
  ]:projection.fromPlane(point);
  const tools=scene.querySelector('.house-toolbox'),quick=scene.querySelector('.house-choices');
  const art=document.createElement('canvas');art.width=art.height=256;
  const fallback=document.createElement('canvas');fallback.width=fallback.height=32;
  const pointers=new Map(),hits=[];
  const dims={w:projection.width,h:projection.height};
  const initial={x:dims.w/2,y:dims.h*.50,z:1};
  let cam={...initial},view={w:1,h:1,ratio:1},mode='objects',drag=null,selected=null,armed=null,gesture=null;
  let cursor=[...spec.arrival],actor=tileCenter(spec.arrival),cell=[...spec.arrival],pose='look',facing='south',animation=0,queue=[],pending=null,rest=0,raf=0,dirty=false,disposed=false,busy=false;
  let picture=null,photoUrl=null,frame=0,poseStart=0,greetingIndex=0;
  const objects=()=>layout.items[area]??[];
  const zoom=()=>Math.max(view.h/dims.h,view.w/(dims.w*1.2))*cam.z;
  const screen=(x,y)=>[(x-cam.x)*zoom()+view.w/2,(y-cam.y)*zoom()+view.h/2];
  const world=(x,y)=>[(x-view.w/2)/zoom()+cam.x,(y-view.h/2)/zoom()+cam.y];
  const fromPointer=event=>{const b=canvas.getBoundingClientRect();return [event.clientX-b.left,event.clientY-b.top];};
  const toTile=(point,wall=false)=>cellPoint(point,wall).map(Math.floor);
  function request(){if(!disposed&&!raf)raf=requestAnimationFrame(draw);}
  const background=image(textures[spec.outside?1:0],request);
  const sheet=image(furnitureSheet,()=>{if(!disposed){request();refreshTools();}});
  const relics=image('./assets/atelier/relics.webp',()=>{if(!disposed){request();refreshTools();}});
  const regionArt=image('./assets/atelier/regional-objects.webp',()=>{if(!disposed){request();refreshTools();}});
  const collectionArt=new Map();
  function artFor(model){
    if(model.sheet==='regional-objects')return {source:regionArt,boxes:regionalObjects};
    if(model.sheet){
      if(!collectionArt.has(model.sheet)){
        collectionArt.set(model.sheet,image('./assets/catalog/'+model.sheet+'.webp',()=>{if(!disposed){request();refreshTools();}}));
      }
      return {source:collectionArt.get(model.sheet),boxes:materialGuides[model.sheet]};
    }
    return {source:sheet,boxes:artBounds};
  }
  travelerAssets(avatar).then(request);
  function refreshPhoto(){
    if(photoUrl)URL.revokeObjectURL(photoUrl);
    const data=(game.entries??[]).find(entry=>entry.id===layout.wallPhoto)?.photo;
    photoUrl=data?URL.createObjectURL(data):null;picture=photoUrl?image(photoUrl,request):null;
  }
  function resize(){
    const {width,height}=canvas.getBoundingClientRect();
    view={w:width||1,h:height||1,ratio:Math.min(2,devicePixelRatio||1)};
    canvas.width=Math.round(view.w*view.ratio);canvas.height=Math.round(view.h*view.ratio);request();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  function applyCover(type,rect,alpha){
    const color=coverings[type][layout.styles[area]?.[type]??0]?.[1];
    if(!color)return;
    ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(...rect);ctx.restore();
  }
  function drawTerrain(){
    ctx.fillStyle=spec.outside?'#a1ad70':'#ba8e60';ctx.fillRect(0,0,dims.w,dims.h);
    if(loaded(background))ctx.drawImage(background,0,0,dims.w,dims.h);
    if(spec.outside){
      applyCover('roof',[dims.w*.28,dims.h*.065,dims.w*.40,dims.h*.10],.25);
      applyCover('siding',[dims.w*.30,dims.h*.165,dims.w*.36,dims.h*.125],.28);
      applyCover('ground',[0,projection.top,dims.w,dims.h-projection.top],.20);
    }else{
      applyCover('walls',[0,0,dims.w,projection.top],.39);
      applyCover('floor',[0,projection.top,dims.w,dims.h-projection.top],.32);
      const window=coverings.window[layout.styles[area]?.window??0]?.[1];
      if(window&&loaded(sheet)){
        ctx.save();ctx.beginPath();
        if(window==='round')ctx.ellipse(dims.w*.5,124,75,62,0,0,Math.PI*2);else ctx.rect(dims.w*.5-68,71,136,106);
        ctx.clip();paintSheet(ctx,11,dims.w*.5-80,54,160,140);ctx.restore();
        ctx.strokeStyle='#6d4d37';ctx.lineWidth=4;ctx.stroke();
      }
    }
    applyCover('light',[0,0,dims.w,dims.h],.2);
    if(loaded(picture)&&!spec.outside){
      const x=dims.w*.69,y=93;
      ctx.fillStyle='#745335';ctx.fillRect(x-6,y-6,111,78);
      ctx.fillStyle='#e8d4a5';ctx.fillRect(x-2,y-2,103,70);
      const scale=Math.min(98/picture.width,64/picture.height);
      ctx.drawImage(picture,x+(99-picture.width*scale)/2,y+(66-picture.height*scale)/2,picture.width*scale,picture.height*scale);
    }
  }
  function paintSheet(context,index,x,y,w,h,source=sheet,box=[0,0,128,128]){
    const [left,top,right,bottom]=box;
    context.drawImage(source,index%4*128+left,Math.floor(index/4)*128+top,right-left,bottom-top,x,y,w,h);
  }
  function traceFloor(item){
    const [w,h]=footprint(item),x=item.x,y=item.y;
    const corners=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(ground);
    ctx.beginPath();corners.forEach((point,i)=>ctx[i?'lineTo':'moveTo'](...point));ctx.closePath();
  }
  function markItem(item,valid,model,x,y,w,h){
    ctx.strokeStyle=valid?'#fff0bf':'#d34e3f';ctx.lineWidth=3/zoom();
    if(model.wall){ctx.beginPath();ctx.rect(x-w/2,y-h/2,w,h);}else traceFloor(item);
    ctx.stroke();
    if(!valid){ctx.fillStyle='#c743334a';ctx.fill();}
  }
  function itemSprite(item,{ghost=false,valid=true}={}){
    const f=furniture(item.kind),[w,h]=footprint(item),rel=f.icon&&relicIcons[f.icon];
    const point=f.wall?wallPoint:ground,surface=f.flat||f.groundArt;
    const [x,y]=point([item.x+w/2,item.y+(surface||f.wall?h*.5:h-.12)]);
    const {source,boxes}=artFor(f);
    const box=Number.isInteger(f.art)?boxes[f.art]:f.icon?relicBounds[rel]:[0,0,32,32];
    const assetRatio=(box[3]-box[1])/(box[2]-box[0]);
    const depth=(item.y+h)/spec.height;
    const cellWidth=projection.visible(depth)/spec.width;
    const intrinsic={bed:1.52,shelf:1.96,tea:1.74,chair:1.03,plant:.78,fern:.74,bench:1.74,pond:1.9,stream:2.26,greenhouse:1.85,rug:1.9,lamp:.63,lantern:.63};
    const width=cellWidth*(f.scale??intrinsic[item.kind]??.59)*(f.wall?.58:1);
    const wide=width*(item.r%2&&!f.flat&&!f.wall?.84:1);
    const high=surface?Math.max(cellWidth*.53,ground([0,item.y+h])[1]-ground([0,item.y])[1])*.96:width*assetRatio;
    const top=surface||f.wall?-high/2:-high;
    ctx.save();
    ctx.globalAlpha=ghost?.62:1;
    if(!f.wall&&!surface){
      ctx.beginPath();ctx.ellipse(x,y-1,wide*.43,wide*.10,0,0,Math.PI*2);
      ctx.fillStyle='#56331943';ctx.fill();
    }
    ctx.translate(x,y);
    if(item.r===1||item.r===2)ctx.scale(-1,1);
    if(Number.isInteger(f.art)&&loaded(source))paintSheet(ctx,f.art,-wide/2,top,wide,high,source,box);
    else if(f.icon&&loaded(relics))paintSheet(ctx,rel,-wide/2,top,wide,high,relics,box);
    else{ornament(fallback,item.kind);ctx.drawImage(fallback,-wide/2,top,wide,high);}
    ctx.restore();
    if(!ghost)hits.push({item,x1:x-wide/2,x2:x+wide/2,y1:y+top,y2:y+top+high+4});
    if(editing&&(ghost||selected===item.id))markItem(item,valid,f,x,y,wide,high);
  }
  function draw(){
    raf=0;if(disposed)return;
    const scale=zoom(),[x,y]=screen(0,0),d=view.ratio;
    ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle=spec.outside?'#566a46':'#594738';ctx.fillRect(0,0,view.w,view.h);
    ctx.translate(x,y);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=true;
    drawTerrain();hits.length=0;
    if(editing&&(drag||selected||armed)){
      ctx.strokeStyle='#fff1d655';ctx.lineWidth=1/scale;
      ctx.beginPath();
      for(let i=0;i<=spec.width;i++){ctx.moveTo(...ground([i,0]));ctx.lineTo(...ground([i,spec.height]));}
      for(let i=0;i<=spec.height;i++){ctx.moveTo(...ground([0,i]));ctx.lineTo(...ground([spec.width,i]));}
      ctx.stroke();
    }
    const ordered=objects().filter(item=>drag?.item.id!==item.id).map(item=>({item,depth:furniture(item.kind).wall?-2:furniture(item.kind).flat?-1:item.y+footprint(item)[1]-.12}));
    if(!editing)ordered.push({depth:cellPoint(actor)[1]});
    ordered.sort((a,b)=>a.depth-b.depth);
    for(const layer of ordered){
      if(layer.item)itemSprite(layer.item);
      else{
        art.dataset.direction=facing;
        character(art,avatar,pose,reduced?0:pose==='read'?frame-poseStart:frame);
        const size=projection.visible(cellPoint(actor)[1]/spec.height)/spec.width*1.22;
        ctx.drawImage(art,actor[0]-size/2,actor[1]-size*116/128,size,size);
      }
    }
    if(drag)itemSprite(drag.item,{ghost:true,valid:canPlace(area,objects(),drag.item)});
    if(canvas.matches(':focus-visible')){
      traceFloor({kind:'chair',x:cursor[0],y:cursor[1],r:0});
      ctx.strokeStyle='#fff7cc';ctx.lineWidth=3/scale;ctx.stroke();
    }
  }
  function tell(text){status.textContent=text;}
  function place(item){
    if(!canPlace(area,objects(),item)){tell('ここは重なります。別の場所に置いてください。');return false;}
    layout.items[area]=[...objects().filter(x=>x.id!==item.id),item];selected=item.id;armed=null;dirty=true;
    tell(furniture(item.kind).name+'を置きました。');refreshTools();request();return true;
  }
  function allUsed(){return new Set(Object.values(layout.items).flat().map(item=>item.kind));}
  function refreshTools(){
    if(!tools)return;
    for(const b of scene.querySelectorAll('.house-dock nav button'))b.setAttribute('aria-pressed',String(b.dataset.house===mode));
    if(mode==='styles'){
      tools.innerHTML=coveringsFor(area).map(type=>`<div class="finish-strip"><span>${{walls:'壁紙',floor:'床',window:'窓',light:'照明',roof:'屋根',siding:'外壁',ground:'庭'}[type]}</span>${coverings[type].map(([label,color],i)=>`<button type="button" data-finish="${type}" data-value="${i}" aria-pressed="${i===(layout.styles[area]?.[type]??0)}">${label}</button>`).join('')}</div>`).join('');
      return;
    }
    if(mode==='pictures'){
      tools.innerHTML=`<div class="furniture-strip"><button type="button" data-picture="">外す</button>${(game.entries??[]).filter(x=>x.photo).map((entry,i)=>`<button type="button" data-picture="${e(entry.id)}" aria-pressed="${entry.id===layout.wallPhoto}">${e(entry.place||'旅の写真 '+(i+1))}</button>`).join('')}</div>`;
      return;
    }
    const used=allUsed(), chosen=objects().find(x=>x.id===selected);
    const stock=homeStock(game).filter(kind=>!used.has(kind)&&(!furniture(kind).outside||spec.outside));
    tools.innerHTML=`<div class="furniture-strip">${stock.map(kind=>`<button type="button" data-furnish="${kind}" aria-pressed="${armed===kind}"><canvas width="64" height="64" aria-hidden="true"></canvas>${e(furniture(kind).name)}</button>`).join('')}</div>${chosen?`<div class="furniture-actions"><span>${e(furniture(chosen.kind).name)}</span>${option('rotate','↻ 回す')}${option('remove','片づける')}</div>`:''}`;
    for(const button of tools.querySelectorAll('[data-furnish]')){
      const c=button.querySelector('canvas'),dest=c.getContext('2d'),f=furniture(button.dataset.furnish);
      const {source}=artFor(f);
      if(Number.isInteger(f.art)&&loaded(source))paintSheet(dest,f.art,0,0,64,64,source);
      else if(f.icon&&loaded(relics))paintSheet(dest,relicIcons[f.icon],0,0,64,64,relics);
      else{ornament(fallback,button.dataset.furnish);dest.drawImage(fallback,0,0,64,64);}
    }
  }
  function clampCamera(){
    cam.x=Math.max(dims.w*.17,Math.min(dims.w*.83,cam.x));cam.y=Math.max(dims.h*.23,Math.min(dims.h*.83,cam.y));
  }
  function setZoom(z,[x,y]=[view.w/2,view.h/2]){
    const before=world(x,y);cam.z=Math.max(.64,Math.min(2.55,z));
    const after=world(x,y);cam.x+=before[0]-after[0];cam.y+=before[1]-after[1];clampCamera();request();
  }
  function hit(x,y){return hits.findLast(({x1,x2,y1,y2,item})=>x>=x1&&x<=x2&&y>=y1&&y<=y2&&!furniture(item.kind).flat)?.item??
    hits.findLast(({x1,x2,y1,y2})=>x>=x1&&x<=x2&&y>=y1&&y<=y2)?.item;}
  function walk(point,item){
    clearTimeout(rest);cancelAnimationFrame(animation);
    const start=queue.length?toTile(actor):cell;
    const targets=item?(furniture(item.kind).wall?[[item.x,0],...around({...item,y:0})]:around(item)):[toTile(point)];
    const route=homePath(area,objects(),start,targets);
    if(route===null){tell('そこには、まだ道がありません。');queue=[];pose='look';request();return;}
    queue=route;pending=item;
    if(reduced||!queue.length){cell=queue.at(-1)??cell;actor=tileCenter(cell);queue=[];arrived();return;}
    let last=0;
    const animate=now=>{
      if(disposed)return;
      const step=Math.min(38,now-last||16)*.31;last=now;
      const next=tileCenter(queue[0]),dx=next[0]-actor[0],dy=next[1]-actor[1],dist=Math.hypot(dx,dy);
      facing=Math.abs(dx)>Math.abs(dy)?(dx<0?'west':'east'):(dy<0?'north':'south');
      pose='walk';
      if(dist<=step){actor=next;cell=queue.shift();}else actor=[actor[0]+dx/dist*step,actor[1]+dy/dist*step];
      const [sx,sy]=screen(...actor);
      if(sx<view.w*.16||sx>view.w*.84)cam.x+=(actor[0]-cam.x)*.08;
      if(sy<view.h*.15||sy>view.h*.84)cam.y+=(actor[1]-cam.y)*.08;
      clampCamera();request();
      if(queue.length)animation=requestAnimationFrame(animate);else arrived();
    };
    animation=requestAnimationFrame(animate);
  }
  function arrived(){
    const model=pending?furniture(pending.kind):null;pending=null;pose=model?.pose??'look';
    tell(model?.line??(model?.name??''));request();
    if(pose==='read'){facing='south';poseStart=frame;}
    if(model?.pose)rest=setTimeout(()=>{pose='look';tell('');request();},4600);
  }
  function finishDrag(p){
    if(!drag)return;
    const item=drag.item;drag=null;
    if(p&&p.moved)place(item);else {selected=objects().some(x=>x.id===item.id)?item.id:null;refreshTools();}
    request();
  }
  canvas.onpointerdown=event=>{
    const p=fromPointer(event),point=world(...p);pointers.set(event.pointerId,{at:p,start:p,moved:false});
    canvas.setPointerCapture(event.pointerId);
    if(pointers.size===2){
      drag=null;
      const [a,b]=[...pointers.values()].map(x=>x.at);gesture={distance:Math.hypot(a[0]-b[0],a[1]-b[1])||1,zoom:cam.z};
      request();return;
    }
    if(pointers.size>1)return;
    if(editing&&mode==='objects'){
      const item=hit(...point);
      if(item&&!armed){
        const [x,y]=toTile(point,furniture(item.kind).wall);
        drag={item:{...item},offset:[x-item.x,y-item.y]};
      }
    }
  };
  canvas.onpointermove=event=>{
    const p=pointers.get(event.pointerId);if(!p)return;
    const next=fromPointer(event),delta=[next[0]-p.at[0],next[1]-p.at[1]];
    p.at=next;p.moved||=Math.hypot(next[0]-p.start[0],next[1]-p.start[1])>7;
    if(gesture&&pointers.size===2){
      const [a,b]=[...pointers.values()].map(x=>x.at);
      setZoom(gesture.zoom*Math.hypot(a[0]-b[0],a[1]-b[1])/gesture.distance,[(a[0]+b[0])/2,(a[1]+b[1])/2]);return;
    }
    if(gesture||!p.moved)return;
    if(drag){
      const [x,y]=toTile(world(...next),furniture(drag.item.kind).wall);drag.item.x=x-drag.offset[0];drag.item.y=y-drag.offset[1];
    }else{cam.x-=delta[0]/zoom();cam.y-=delta[1]/zoom();clampCamera();}
    request();
  };
  canvas.onpointerup=event=>{
    const p=pointers.get(event.pointerId);pointers.delete(event.pointerId);if(!p)return;
    if(gesture){if(!pointers.size)gesture=null;return;}
    if(drag){finishDrag(p);return;}
    if(p.moved)return;
    const point=world(...p.at);
    if(editing&&armed&&mode==='objects'){
      const [x,y]=toTile(point,furniture(armed).wall);place({id:crypto.randomUUID(),kind:armed,x,y,r:0});return;
    }
    const target=hit(...point);
    if(!editing&&!target&&Math.abs(point[0]-actor[0])<24&&point[1]>=actor[1]-63&&point[1]<=actor[1]+6){
      clearTimeout(rest);pose='joy';tell(greetings[greetingIndex++%greetings.length]);request();
      rest=setTimeout(()=>{pose='look';tell('');request();},1800);return;
    }
    if(!editing)walk(point,target);
  };
  canvas.onkeydown=event=>{
    const vectors={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    const vector=vectors[event.key];
    if(vector){
      event.preventDefault();
      cursor=[Math.max(0,Math.min(spec.width-1,cursor[0]+vector[0])),Math.max(0,Math.min(spec.height-1,cursor[1]+vector[1]))];
      request();return;
    }
    if(event.key!=='Enter')return;
    event.preventDefault();
    const point=tileCenter(cursor),target=hit(...point);
    if(editing&&armed){place({id:crypto.randomUUID(),kind:armed,x:cursor[0],y:cursor[1],r:0});return;}
    if(editing){selected=target?.id??null;refreshTools();request();}
    else walk(point,target);
  };
  canvas.onfocus=canvas.onblur=request;
  canvas.onpointercancel=event=>{pointers.delete(event.pointerId);drag=null;if(!pointers.size)gesture=null;request();};
  canvas.onwheel=event=>{event.preventDefault();setZoom(cam.z*(event.deltaY<0?1.10:.91),fromPointer(event));};
  // Pointer capture from the tray supports real dragging into the room, and a tap arms placement.
  if(tools){
    let trayStart=null;
    tools.onpointerdown=event=>{
      const button=event.target.closest('[data-furnish]');if(!button)return;
      trayStart={kind:button.dataset.furnish,id:event.pointerId,x:event.clientX,y:event.clientY,dragging:false};
      button.setPointerCapture(event.pointerId);
    };
    tools.onpointermove=event=>{
      if(trayStart?.id!==event.pointerId)return;
      if(!trayStart.dragging&&Math.abs(event.clientY-trayStart.y)>10)trayStart.dragging=true;
      if(!trayStart.dragging)return;
      const [x,y]=toTile(world(...fromPointer(event)),furniture(trayStart.kind).wall);
      drag={item:{id:drag?.item?.id??crypto.randomUUID(),kind:trayStart.kind,x,y,r:0},offset:[0,0]};request();
    };
    tools.onpointerup=event=>{
      if(trayStart?.id!==event.pointerId)return;
      if(trayStart.dragging){finishDrag({moved:true});event.preventDefault();}
      trayStart=null;
    };
    tools.onpointercancel=()=>{trayStart=null;drag=null;request();};
  }
  async function press(b){
    if(b.dataset.furnish){armed=b.dataset.furnish;selected=null;tell('置きたい場所をタップ、または絵をドラッグ。');refreshTools();request();return;}
    if(b.dataset.finish){layout.styles[area]={...layout.styles[area],[b.dataset.finish]:Number(b.dataset.value)};dirty=true;refreshTools();request();return;}
    if(Object.hasOwn(b.dataset,'picture')){layout.wallPhoto=b.dataset.picture||null;refreshPhoto();dirty=true;refreshTools();request();return;}
    if(b.dataset.useItem){const item=objects().find(i=>i.id===b.dataset.useItem);quick.hidden=true;if(item)walk(null,item);return;}
    switch(b.dataset.house){
      case 'objects':case 'styles':case 'pictures':mode=b.dataset.house;armed=null;refreshTools();request();break;
      case 'zoom-in':setZoom(cam.z*1.21);break;
      case 'zoom-out':setZoom(cam.z/1.21);break;
      case 'rotate':{const item=objects().find(x=>x.id===selected);if(item)place({...item,r:(item.r+1)%4});break;}
      case 'remove':layout.items[area]=objects().filter(x=>x.id!==selected);selected=null;dirty=true;refreshTools();request();break;
      case 'list':
        quick.hidden=!quick.hidden;
        if(!quick.hidden)quick.innerHTML=objects().map(i=>`<button type="button" data-use-item="${e(i.id)}">${e(furniture(i.kind).name)}</button>`).join('')||'<p>ここにはまだ家具がありません。</p>';
        break;
      case 'expand':{
        const next=['studio','orchard'].find(id=>!layout.additions.includes(id));
        if(next){layout.additions.push(next);dirty=true;await save(b,'#decorate/'+next);}
        break;
      }
      case 'save':await save(b,'#cottage'+(area==='room'?'':'/'+area));break;
    }
  };
  let finger=null,handledAt=-Infinity;
  scene.addEventListener('pointerdown',event=>{
    const button=event.target.closest('button:not([data-furnish])');
    if(event.pointerType==='touch'&&button)finger={button,id:event.pointerId,x:event.clientX,y:event.clientY};
  });
  scene.addEventListener('pointercancel',()=>{finger=null;});
  scene.addEventListener('pointerup',event=>{
    if(!finger||event.pointerId!==finger.id)return;
    const {button,x,y}=finger;finger=null;
    if(!button.isConnected||Math.hypot(x-event.clientX,y-event.clientY)>12)return;
    handledAt=performance.now();press(button);
  });
  scene.onclick=event=>{
    const button=event.target.closest('button');
    if(!button)return;
    if(event.detail&&performance.now()-handledAt<400)return;
    press(button);
  };
  for(const link of scene.querySelectorAll('.house-areas a'))link.setAttribute('aria-current',link.textContent===spec.name?'page':'false');
  const navigation=new AbortController();
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href^="#"]');
    if(dirty&&link&&(scene.contains(link)||link.closest('#nav'))){
      event.preventDefault();
      save(link,link.hash);
    }
  },{signal:navigation.signal});
  async function save(control,dest){
    if(busy)return;
    busy=true;control.setAttribute('aria-disabled','true');
    try{await commit(layout,dest);dirty=false;}catch(error){notify(error.message);}
    finally{busy=false;control.removeAttribute('aria-disabled');}
  }
  refreshPhoto();refreshTools();resize();
  const timer=reduced?0:setInterval(()=>{if(!document.hidden){frame++;request();}},110);
  return ()=>{disposed=true;navigation.abort();observer.disconnect();clearInterval(timer);cancelAnimationFrame(raf);cancelAnimationFrame(animation);clearTimeout(rest);if(photoUrl)URL.revokeObjectURL(photoUrl);};
}
