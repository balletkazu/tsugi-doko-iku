import {referenceGuides} from './reference-guides.js';
import {bodyFrame,equipmentSlots,sockets} from './avatar-frame.js';
import {hairPalette,skinPalette,clothPalette} from './avatar-palette.js';
import {channelsOf,lightness,toneValue,skinInk} from './material-color.js';

const CELL=256;
const fileNames=['heads','heads-material','heads-features','clothes','clothes-material','gear','hats'];
const atlas=new Map();
let pending;
export function referenceAssets(){
  pending??=Promise.all(fileNames.map(name=>{
    const art=new Image();
    art.src='./assets/rig/'+name+'.webp';
    atlas.set(name,art);
    return art.decode().catch(()=>{});
  }));
  return pending;
}
export const referenceReady=()=>fileNames.every(name=>atlas.get(name)?.naturalWidth);
if(typeof window!=='undefined')window.addEventListener('online',()=>{if(!referenceReady())pending=null;});

function surface(w,h){
  const canvas=document.createElement('canvas');
  canvas.width=w;canvas.height=h;
  return canvas;
}
function sample(name,i){
  const [w,h]=referenceGuides[name][i][0];
  return {sx:i%5*CELL,sy:Math.floor(i/5)*CELL,w,h};
}
function draw(ctx,name,i,x,y,w,h){
  const source=sample(name.replace(/-features$/,''),i);
  ctx.drawImage(atlas.get(name),source.sx,source.sy,source.w,source.h,x,y,w,h);
}
function pixels(name,i,source){
  const canvas=surface(source.w,source.h),ctx=canvas.getContext('2d',{willReadFrequently:true});
  const image=atlas.get(name);
  ctx.drawImage(image,source.sx,source.sy,source.w,source.h,0,0,source.w,source.h);
  return ctx.getImageData(0,0,source.w,source.h);
}
const painted=new Map();
function remember(key,cache){
  if(painted.size>=20)painted.delete(painted.keys().next().value);
  painted.set(key,cache);
  return cache;
}
function ramp(color,role){
  const rgb=channelsOf(color);
  return Array.from({length:256},(_,value)=>rgb.map(channel=>toneValue(channel,value,role)));
}
function texture(source){
  const canvas=surface(source.width,source.height),ctx=canvas.getContext('2d');
  ctx.putImageData(source,0,0);
  return canvas;
}
function dyedClothes(i,a){
  const tint=clothPalette[a.clothColor][1];
  if(!tint&&!a.pattern&&!a.material)return null;
  const key=['cloth',i,tint,a.pattern,a.material].join('|');
  if(painted.has(key))return painted.get(key);
  const s=sample('clothes',i);
  const rgb=pixels('clothes',i,s),material=pixels('clothes-material',i,s).data;
  const colors=tint?ramp(tint,'fabric'):null;
  for(let at=0;at<rgb.data.length;at+=4){
    if(!rgb.data[at+3]||!material[at+2])continue;
    const x=Math.floor((at/4%s.w)/2),y=Math.floor(at/4/s.w/2);
    const pattern=a.pattern===1&&y%17<2||a.pattern===2&&x%16<2&&y%13<2||a.pattern===3&&(x%17<2||y%17<2);
    const tone=colors?.[Math.round(lightness(rgb.data[at],rgb.data[at+1],rgb.data[at+2]))];
    const fraction=material[at+2]/255;
    const weave=(a.material?(x*13+y*29)%(a.material+4)-2:0)+(pattern?16:0);
    for(let c=0;c<3;c++)rgb.data[at+c]+=fraction*((tone?tone[c]-rgb.data[at+c]:0)+weave);
  }
  return remember(key,texture(rgb));
}
function headTextures(i,a){
  const hair=a.hairTint??hairPalette[a.hairColor][1],skin=skinPalette[a.skin][1];
  const key=['head',i,hair,skin].join('|');
  if(painted.has(key))return painted.get(key);
  const s=sample('heads',i),source=pixels('heads',i,s),map=pixels('heads-material',i,s).data;
  const data=['frontHair','skin','rearHair'].map(()=>new ImageData(s.w,s.h));
  const colors=[ramp(hair,'hair'),ramp(skin,'skin')];
  for(let at=0;at<source.data.length;at+=4){
    const opacity=source.data[at+3]/255;
    if(!opacity)continue;
    const value=Math.round(lightness(source.data[at],source.data[at+1],source.data[at+2]));
    const sum=map[at]+map[at+1]+map[at+2];
    if(!sum)continue;
    let left=1;
    // These are the effective coverages when composited back to front.
    for(let slot=0;slot<3;slot++){
      const coverage=opacity*map[at+slot]/sum;
      if(coverage<=0)continue;
      const rgb=colors[slot===1?1:0][value],out=data[slot].data;
      for(let c=0;c<3;c++)out[at+c]=rgb[c];
      out[at+3]=255*Math.min(1,coverage/Math.max(.001,left));
      left-=coverage;
    }
  }
  return remember(key,data.map(texture));
}
function rounded(ctx,x,y,rx,ry,base,shade){
  if(!rx||!ry)return;
  const light=ctx.createLinearGradient(x-rx,y-ry,x+rx,y+ry);
  light.addColorStop(0,base);light.addColorStop(1,shade);
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=light;ctx.fill();
  ctx.lineWidth=.58;ctx.strokeStyle=shade;ctx.stroke();
}
function line(ctx,from,control,to,color,width){
  ctx.beginPath();ctx.moveTo(...from);ctx.quadraticCurveTo(...control,...to);
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();
}
function strap(ctx,from,control,to,base,width){
  line(ctx,[from[0]+.3,from[1]+.4],[control[0]+.3,control[1]+.6],[to[0]+.3,to[1]+.6],'#37291b6b',width+.9);
  line(ctx,from,control,to,base,width);
  line(ctx,[from[0]-.4,from[1]],[control[0]-.4,control[1]],[to[0]-.4,to[1]],'#d0a97a88',.47);
}
function sized(ctx,name,i,cx,baseY,h,width=1){
  const s=sample(name,i),w=h*s.w/s.h*width;
  draw(ctx,name,i,cx-w/2,baseY-h,w,h);
}
function cloth(ctx,i,cx,baseY,h,a){
  const {w:pw,h:ph}=sample('clothes',i);
  const w=h*pw/ph,color=dyedClothes(i,a);
  if(color)ctx.drawImage(color,cx-w/2,baseY-h,w,h);
  else draw(ctx,'clothes',i,cx-w/2,baseY-h,w,h);
  return {x:cx-w/2,y:baseY-h,w,h};
}

export function referenceBody(ctx,a,turn,{steps,drawShoes,layer,walking}){
  const view=turn.index,p=bodyFrame(view);
  const [nx,ny]=p.neck;
  const sk=skinPalette[a.skin][1];
  const warm=skinInk(sk,213),shade=skinInk(sk,143);
  const front=view<3;
  const boots=()=>{
    if(a.shoes){drawShoes();return;}
    // The anatomical ankle and shoes are independent of the hem.
    const dx=walking?steps[view===2?1:0].x*.4:0;
    const rise=walking?Math.min(steps[0].lift,steps[1].lift)*.46:0;
    sized(ctx,'gear',5+view,view===2?3+dx:dx,-rise,14,view===2?.82:.95);
  };
  const ankles=[[-5.6,5.6],[-5.3,6.7],[.7],[-4.6,6.3],[-5.6,5.6]][view];
  ankles.forEach(x=>rounded(ctx,x,-13.5,2.1,3.8,warm,shade));
  boots();
  const pantsClock={...a,pattern:0,material:0,clothColor:0};
  cloth(ctx,10+view,view===2?.8:0,-15,19.5,pantsClock);
  rounded(ctx,nx,ny+.8,4.4,7,warm,shade);
  const box={...sample('clothes',a.outfit*5+view)};
  const h=35,w=h*box.w/box.h;
  // Cuffs belong to the outer clothing and cover the independent hands.
  const cuffs=[[.11,.89],[.14,.89],[.47],[.13,.86],[.13,.88]][view];
  cuffs.forEach((at,i)=>rounded(ctx,(at-.5)*w,ny+h*(view===1&&i===1?.72:.83),2.5,3.75,warm,shade));
  cloth(ctx,a.outfit*5+view,0,-24,h,a);
  if(a.layer&&front)layer(w,ny);
  return {neck:ny,w,pageTurn:0};
}

export function referencePack(ctx,a,turn,behind){
  const slot=equipmentSlots(a).back;
  if(!slot||behind===turn.behind)return;
  const view=turn.index;
  const [x,y]=bodyFrame(view).back;
  const index=[4,3,2,1,0][view];
  ctx.save();
  if(slot===2)ctx.filter='saturate(0.47) hue-rotate(130deg)';
  if(behind){
    const behindX=view===0?-6:x-3;
    sized(ctx,'gear',index,behindX,y+16,27,view===0?1.08:1);
  }else{
    const [sx,sy]=bodyFrame(view).shoulders.at(-1);
    if(view===3)strap(ctx,[sx,sy],[sx-6,sy+9],[sx-5,sy+21],slot===1?'#7e5335':'#526762',3.2);
    sized(ctx,'gear',index,x,y+17,29);
  }
  ctx.restore();
}
export function referenceTorsoGear(ctx,a,turn,width,pose){
  if(turn.behind)return;
  const p=bodyFrame(turn.index),{shoulder,neck,camera,chest,cameraRoots}=sockets(a,p,width/40);
  const slot=equipmentSlots(a);
  if(slot.back){
    const shade=slot.back===1?'#785037':'#4b625d';
    for(const [sx,sy] of shoulder){
      const direction=sx>0?1:-1;
      strap(ctx,[sx,sy],[sx-direction*4,sy+8],[sx-direction*4,sy+21],shade,2.8);
    }
  }
  if(slot.neck===1&&pose!=='read'){
    const [x,y]=camera;
    const h=10.2;
    const frame=10+turn.index;
    const s=sample('gear',frame),w=s.w*h/s.h;
    const roots=turn.index===2?[cameraRoots[0]]:cameraRoots;
    roots.forEach(([rx,ry],i)=>{
      const end=x+(i===0?-1:1)*w*.39;
      strap(ctx,[rx,ry],[(rx+end)/2,ry+11],[end,y-h*.25],'#7b5539',1.42);
    });
    rounded(ctx,x+.9,y+4,w*.44,h*.37,'#33241a4c','#33241a27');
    sized(ctx,'gear',frame,x,y+7,h);
  }
  if(slot.neck===5){
    const [x,y]=neck,cx=chest[0];
    line(ctx,[x-5,y+1],[cx-4,y+13],[cx,y+13],'#5e4833',1.25);
    line(ctx,[cx,y+13],[cx+4,y+13],[x+5,y+1],'#5e4833',1.25);
    rounded(ctx,cx,y+14.5,1.65,2.24,'#acc0a7','#35483e');
  }
}
export function referenceHeadGeometry(a,turn,hair){
  const i=hair*5+turn.index;
  const [[w,h],pivot,eyes,mouth,ears]=referenceGuides.heads[i];
  const pose=bodyFrame(turn.index);
  const scale=(hair===1?46:44)/h;
  const x=pose.head[0]-pivot[0]*scale,y=pose.neck[1]+1.4-pivot[1]*scale;
  const place=([px,py])=>[x+px*scale,y+py*scale];
  const centers=eyes.map(place);
  const eye=centers.length===2?[(centers[0][0]+centers[1][0])/2,(centers[0][1]+centers[1][1])/2,
    (centers[1][0]-centers[0][0])/2]:centers[0]?[...centers[0],0]:null;
  return {i,x,y,w:w*scale,h:h*scale,eye,centers,ear:ears.map(place),mouth:mouth?place(mouth):null,side:turn.index===2,
    axis:pose.head[0],temple:pose.neck[1]-24};
}
export function referenceHat(a,turn,shape){
  if(!a.hat)return null;
  const i=(a.hat-1)*5+turn.index,{w:pw,h:ph}=sample('hats',i);
  const styles=[{width:50,visit:0},{width:42,visit:.5},{width:47,visit:-.4},{width:46,visit:-1.3}][a.hat-1];
  const width=styles.width*Math.min(1.06,Math.max(.90,shape.w/46))*(turn.index===2?.88:1);
  const h=Math.min(width*ph/pw,a.hat===2?28:30);
  const cx=shape.axis+(turn.index===2?-2.4:turn.index===1?1.7:0);
  const seat=shape.temple+styles.visit;
  return {i,x:cx-width/2,y:seat-h,width,h,seat,cx};
}
function hairUnderHat(ctx,hat){
  const r=hat.width*.405;
  const {cx,seat}=hat;
  ctx.beginPath();ctx.moveTo(cx-r-16,seat+22);
  ctx.bezierCurveTo(cx-r+1,seat+11,cx-r-1,seat-7,cx-r+5,seat-20);
  ctx.bezierCurveTo(cx-r+8,seat-31,cx+r-8,seat-31,cx+r-5,seat-20);
  ctx.bezierCurveTo(cx+r+1,seat-5,cx+r-1,seat+10,cx+r+16,seat+22);
  ctx.lineTo(cx+r+25,20);ctx.lineTo(cx-r-25,20);ctx.closePath();ctx.clip();
}
export function referenceHairAndSkin(ctx,a,shape,mount,layer){
  const {i,x,y,w,h}=shape,parts=headTextures(i,a);
  if(layer==='skin'){
    ctx.drawImage(parts[1],x,y,w,h);
    return;
  }
  ctx.save();
  if(mount)hairUnderHat(ctx,mount);
  if(mount){
    ctx.filter='brightness(.94)';
  }
  ctx.drawImage(parts[layer==='behind'?2:0],x,y,w,h);
  ctx.restore();
}
export function referenceFeatures(ctx,shape){
  draw(ctx,'heads-features',shape.i,shape.x,shape.y,shape.w,shape.h);
}
export function referenceGlasses(ctx,a,shape,turn){
  if(!a.glasses||!shape.centers.length)return;
  const ink=['','#765140','#423a34','#946944','#47746c'][a.glasses];
  const centers=shape.centers;
  const temple=(point,index)=>{
    const ear=shape.ear[index];
    if(!ear)return;
    const outer=index===1?1:-1;
    const from=[point[0]+outer*3.9,point[1]-.9];
    const end=[ear[0],ear[1]-3];
    line(ctx,from,[(from[0]+end[0])*.5,from[1]-1.25],end,ink,.78);
  };
  centers.forEach(temple);
  const lensWidth=a.glasses===4?4.25:a.glasses===2?4.15:3.85;
  centers.forEach(([x,y],i)=>{
    const w=lensWidth*(turn.index===2?.72:turn.index===1&&i===1?.79:1);
    const h=a.glasses===1?3.45:a.glasses===4?2.72:2.85;
    ctx.beginPath();
    if(a.glasses===2)ctx.roundRect(x-w,y-h,2*w,2*h,1.6);
    else ctx.ellipse(x,y,w,h,0,0,Math.PI*2);
    ctx.fillStyle='#f6f1de15';ctx.fill();
    ctx.strokeStyle=ink;ctx.lineWidth=a.glasses===3?.65:.90;ctx.stroke();
    line(ctx,[x-w*.62,y-h*.75],[x-.4,y-h],[x+w*.42,y-h*.8],'#f7d9a86e',.53);
  });
  if(centers.length===2){
    const [[ax,ay],[bx,by]]=centers;
    line(ctx,[ax+lensWidth-.2,ay-.45],[(ax+bx)/2,(ay+by)/2-2.0],
      [bx-lensWidth*(turn.index===1?.8:1),by-.45],ink,.80);
  }
}
export function drawReferenceHat(ctx,hat,turn,style){
  if(!hat)return;
  if(style===4&&turn.mirror&&[1,2].includes(turn.index)){
    // Keep embroidery on the intended temple. The left panel omits it.
    draw(ctx,'hats',19+turn.index,hat.x,hat.y,hat.width,hat.h);
    return;
  }
  draw(ctx,'hats',hat.i,hat.x,hat.y,hat.width,hat.h);
}
