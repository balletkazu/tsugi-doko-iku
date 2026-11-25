import {avatarFrom,avatarDefaults} from './world-data.js';
import {hairPalette,skinPalette,clothPalette} from './avatar-palette.js';

const atlasNames=['directions','actions','heads','heads-profile','heads-back','garments','details'];
const atlases={};
const variants=new Map();
const normalized=new WeakMap();
const pixels=128;
let assetsPromise;
const directions={
  south:[0,2,3,false],north:[11,12,13,false],
  east:[8,9,10,false],west:[8,9,10,true],
  southeast:[4,5,6,false],southwest:[4,5,6,true],
  northeast:[7,14,15,false],northwest:[7,14,15,true]
};
export const facings=Object.keys(directions);
const actions={run:[0,1],climb:[2,3],sleep:[4,5],eat:[6,7],sit:[8],drink:[8,9],photo:[10,11],joy:[12,13],read:[14],surprise:[15]};
const outfitIndex=[0,1,4,7,5,2,3,6];
const ratio=(n,min,max)=>Math.max(min,Math.min(max,n));
const sampleHex=hex=>hex.match(/\w\w/g).map(x=>parseInt(x,16));
function getSheet(name){
  if(!atlases[name]){
    const image=new Image();image.src='./assets/atelier/'+name+'.webp';atlases[name]=image;
  }
  return atlases[name];
}
export function travelerAssets(){
  assetsPromise??=Promise.all(atlasNames.map(name=>getSheet(name).decode().catch(()=>{})));
  return assetsPromise;
}
function picture(context,image,index,x,y,w,h){
  if(!image?.naturalWidth)return;
  context.drawImage(image,index%4*pixels,Math.floor(index/4)*pixels,pixels,pixels,x,y,w,h);
}
function pigment(image,name,index,a){
  const main=a.hairTint??(a.hairColor?hairPalette[a.hairColor][1]:null);
  const skin=a.skin?skinPalette[a.skin][1]:null,cloth=clothPalette[a.clothColor]?.[1];
  if(!main&&!skin&&!cloth&&!a.pattern&&!a.material)return null;
  const key=[name,index,main,skin,cloth,a.pattern,a.material].join('|');
  if(variants.has(key))return variants.get(key);
  const c=document.createElement('canvas');c.width=c.height=pixels;
  const ctx=c.getContext('2d',{willReadFrequently:true});picture(ctx,image,index,0,0,pixels,pixels);
  const img=ctx.getImageData(0,0,pixels,pixels),p=img.data;
  const rgbHair=main?sampleHex(main):null,rgbSkin=skin?sampleHex(skin):null,rgbCloth=cloth?sampleHex(cloth):null;
  const head=name.startsWith('heads');
  for(let i=0;i<p.length;i+=4){
    if(p[i+3]<20)continue;
    const [r,g,b]=[p[i],p[i+1],p[i+2]],x=i/4%pixels,y=Math.floor(i/4/pixels);
    const isSkin=r>170&&g>105&&r-g<69&&g-b>9&&g-b<60;
    const isHair=r>62&&r-g>13&&g-b>9&&r<210&&g<151&&(head||y<67)&&name!=='garments'&&!isSkin;
    const isFabric=name==='garments'?p[i+3]>220&&y>20&&y<89&&!isSkin:
      !head&&y>58&&y<101&&(g>r*.81&&g-b>11||b>r*.85&&r>55);
    const colored=(isHair&&rgbHair)||(isSkin&&name!=='garments'&&(head||y<85)&&rgbSkin)||(isFabric&&rgbCloth);
    if(colored){
      const light=(r*.258+g*.582+b*.16);
      const source=isSkin?190:isHair?104:121;
      const amount=ratio(light/source,.48,1.41);
      for(let channel=0;channel<3;channel++)p[i+channel]=Math.round(colored[channel]*amount*.82+[r,g,b][channel]*.18);
    }
    if(isFabric){
      const motif=a.pattern===1&&y%9<2||a.pattern===2&&x%9===3&&y%8===4||a.pattern===3&&(x%12===4||y%11===4);
      const grain=a.material?(a.material===1?(x*13+y*29)%11-5:a.material===2?(x+y*2)%5-2:(x*3+y*2)%4-1):0;
      for(let channel=0;channel<3;channel++)p[i+channel]+=grain+(motif?23:0);
    }
  }
  ctx.putImageData(img,0,0);
  variants.set(key,c);
  if(variants.size>160)variants.delete(variants.keys().next().value);
  return c;
}
function tinted(ctx,name,index,a,x=0,y=0,w=128,h=128){
  const image=getSheet(name);if(!image.naturalWidth)return;
  const colored=pigment(image,name,index,a);
  if(colored)ctx.drawImage(colored,x,y,w,h);else picture(ctx,image,index,x,y,w,h);
}
function appearance(input){
  if(!input||typeof input!=='object')return avatarDefaults;
  if(!normalized.has(input))normalized.set(input,{...avatarFrom(input),pin:input.pin});
  return normalized.get(input);
}
function glyph(ctx,x,y,id,a,draw){
  const tune=a.tune?.[id]??{};
  ctx.save();ctx.translate(x+(tune.x??0)*.34,y+(tune.y??0)*.34);ctx.rotate((tune.angle??0)*Math.PI/130);
  ctx.scale(1+(tune.size??0)*.042,1+(tune.size??0)*.042);
  draw(tune.gap??0);ctx.restore();
}
function facialFeatures(ctx,a){
  const ink='#694937',base=skinPalette[a.skin]?.[1]??'#f0bd91';
  const tuned=key=>Object.values(a.tune?.[key]??{}).some(Boolean);
  const dot=(x,y,rx,ry,color)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();};
  const stroke=(points,color=ink)=>{ctx.beginPath();ctx.moveTo(...points[0]);ctx.quadraticCurveTo(...points[1]);ctx.lineWidth=.8;ctx.strokeStyle=color;ctx.lineCap='round';ctx.stroke();};
  if(a.eyes||tuned('eyes')){
    for(const x of [58,72])dot(x,48,4,5,base);
    glyph(ctx,65,48,'eyes',a,gap=>{
      for(const side of [-1,1]){
        const x=side*(6.7+gap*.28);
        if(a.eyes===2)stroke([[x-2,0],[x,-3.2,x+2,0]]);
        else {dot(x,0,a.eyes===4?2.1:1.5,a.eyes===1?1.9:2.7,ink);dot(x+.4,-.75,.55,.55,'#fff2c6');}
      }
    });
  }
  if(a.brows||tuned('brows'))glyph(ctx,65,42,'brows',a,gap=>{
    if(a.brows===3)return;
    for(const side of [-1,1]){
      const x=side*(6.4+gap*.29);stroke([[x-2,0],[x,-1.2-side*(a.brows-1)*.6,x+2,0]],'#8b654b');
    }
  });
  if(a.nose||tuned('nose'))glyph(ctx,65,52,'nose',a,()=>dot(0,0,a.nose===1?1.15:.76,1,'#c58663'));
  if(a.mouth||tuned('mouth')){
    dot(65,56,3.9,2.55,base);
    glyph(ctx,65,56,'mouth',a,()=>{
      if(a.mouth===2)dot(0,0,1.5,1.6,ink);
      else stroke([[-2,0],[0,a.mouth===1?3.3:1.8,2,0]]);
    });
  }
  if(a.beard)glyph(ctx,65,57,'mouth',a,()=>{
    if(a.beard===1)stroke([[-3,-2],[0,-4,3,-2]]);
    else dot(0,3,3.2,1.3,a.beard===2?ink:'#987762');
  });
  if(a.ears||tuned('ears'))glyph(ctx,65,49,'ears',a,gap=>{
    for(const x of [-16-gap*.25,16+gap*.25]){
      dot(x,0,a.ears===1?1.3:2.4,2.7,base);dot(x,0,1,1.5,'#d39171');
    }
  });
}
function paperDoll(ctx,a,blink){
  const face=a.tune?.face??{},body=a.tune?.body??{};
  const bodyScale=1+(a.body===1?-.055:a.body===2?.068:0)+(body.size??0)*.012;
  const detail=(i,x,y,w,h)=>picture(ctx,getSheet('details'),i,x,y,w,h);
  ctx.save();ctx.translate(64,112);
  ctx.scale(bodyScale,1+(a.height===1?-.065:a.height===2?.07:0)+(a.tune?.height?.size??0)*.013);
  ctx.translate(-64,-112);
  if(a.bag)detail(11+a.bag,23,48,60,57);
  tinted(ctx,'garments',outfitIndex[a.outfit],a,18,57,92,62);
  if(a.layer)detail(a.layer===1?14:15,35,58,60,39);
  if(a.shoes){
    ctx.save();ctx.globalAlpha=.35;ctx.globalCompositeOperation='source-atop';
    ctx.fillStyle=['','#e0c9a2','#bf5d4c','#667d5e'][a.shoes];ctx.fillRect(45,102,39,11);ctx.restore();
  }
  ctx.save();ctx.translate(64+(face.x??0)*.38,44+(face.y??0)*.38);ctx.rotate((face.angle??0)*Math.PI/170);
  ctx.scale((a.face===1?.91:a.face===2?1.09:a.face===3?.88:1)+(face.size??0)*.021,1+(face.gap??0)*.015);
  ctx.translate(-64,-44);
  tinted(ctx,'heads',a.hair,a,19,0,90,72);
  facialFeatures(ctx,blink?{...a,eyes:2}:a);
  if(a.hat)detail(a.hat-1,21,-6,87,56);
  if(a.glasses)detail(3+a.glasses,40,31,49,32);
  if(a.accessory===3||a.accessory===4)detail(a.accessory===3?10:11,a.accessory===3?38:36,a.accessory===3?19:38,24,25);
  ctx.restore();
  if(a.accessory===1||a.accessory===2)detail(a.accessory===1?8:9,45,a.accessory===1?65:47,41,35);
  if(a.pin){ctx.fillStyle='#caa65d';ctx.strokeStyle='#694937';ctx.lineWidth=1;ctx.beginPath();ctx.arc(76,72,2.8,0,Math.PI*2);ctx.fill();ctx.stroke();}
  ctx.restore();
}
function drawCharacter(canvas,a,pose,frame){
  const ctx=canvas.getContext('2d');ctx.setTransform(canvas.width/128,0,0,canvas.height/128,0,0);
  ctx.clearRect(0,0,128,128);
  const direction={left:'west',right:'east'}[canvas.dataset.direction]??canvas.dataset.direction??'south';
  const [idle,left,right,mirror]=directions[direction]??directions.south;
  const blink=frame%38>=36,action=actions[pose],beat=Math.floor(frame/2)%4;
  const moving=pose==='walk',fullDoll=!action&&!moving&&idle===0&&(canvas.hasAttribute('data-doll')||a.hair||a.hat||a.outfit||a.layer||a.eyes||a.glasses||a.accessory||a.face||a.shoes||a.bag!==1);
  ctx.fillStyle='#6b51353b';ctx.beginPath();ctx.ellipse(64,119,pose==='sleep'?31:23,4,0,0,Math.PI*2);ctx.fill();
  if(fullDoll){paperDoll(ctx,a,blink);return;}
  ctx.save();
  if(mirror){ctx.translate(128,0);ctx.scale(-1,1);}
  if(action)tinted(ctx,'actions',action[Math.floor(frame/3)%action.length],a);
  else {
    const frameId=moving?[idle,left,idle,right][beat]:(idle===0&&blink?1:idle);
    if(a.hair>0&&!fullDoll){
      ctx.save();ctx.beginPath();ctx.rect(0,58,128,70);ctx.clip();
      tinted(ctx,'directions',frameId,a);ctx.restore();
      const head=direction.startsWith('north')?'heads-back':direction==='south'?'heads':'heads-profile';
      const bob=moving&&beat%2?-2:0;
      tinted(ctx,head,a.hair,a,20,bob,87,70);
      if(a.hat)picture(ctx,getSheet('details'),a.hat-1,26,0,77,50);
    }else tinted(ctx,'directions',frameId,a);
  }
  ctx.restore();
}
export function character(canvas,input,pose='look',frame=0){
  const a=appearance(input);
  canvas._spriteInput=[a,pose,frame];
  if(!canvas._waitingForArt&&atlasNames.some(name=>!getSheet(name).naturalWidth)){
    canvas._waitingForArt=true;
    travelerAssets().then(()=>{canvas._waitingForArt=false;if(canvas._spriteInput)drawCharacter(canvas,...canvas._spriteInput);});
  }
  drawCharacter(canvas,a,pose,frame);
}
export function animateWorld(root,avatar,reduced){
  const portraits=[...root.querySelectorAll('canvas[data-person]:not([data-static])')];
  let frame=0;
  const draw=()=>portraits.forEach(canvas=>character(canvas,canvas._avatar??avatar,canvas.dataset.pose,frame));
  draw();if(reduced||!portraits.length)return ()=>{};
  const timer=setInterval(()=>{if(!document.hidden){frame++;draw();}},105);
  return ()=>clearInterval(timer);
}
