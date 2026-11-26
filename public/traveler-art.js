import {avatarFrom,avatarDefaults} from './world-data.js';
import {hairPalette,skinPalette,clothPalette} from './avatar-palette.js';
import {front,profile,rear,garment,detail} from './sprite-guides.js';

const cell=128;
const sheets=['neutral-heads','skin-zones','heads-back','garments','details'];
const images=new Map();
const painted=new Map();
const normalized=new WeakMap();
let assets;
export const facings=['south','north','east','west','southeast','southwest','northeast','northwest'];
const outfitIndex=[0,1,4,7,5,2,3,6];
const last=(a,b,t)=>a+(b-a)*t;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const rgb=hex=>hex.slice(1).match(/../g).map(byte=>parseInt(byte,16));

function sheet(name){
  if(!images.has(name)){
    const image=new Image();
    image.src='./assets/atelier/'+name+'.webp';
    images.set(name,image);
  }
  return images.get(name);
}
export function travelerAssets(){
  return assets??=Promise.all(sheets.map(name=>sheet(name).decode().catch(()=>{})));
}
function surface(w=cell,h=cell){
  const target=document.createElement('canvas');
  target.width=w;target.height=h;
  return target;
}
function drawCell(ctx,image,index,x,y,w,h,box=[0,0,cell,cell]){
  if(!(image.naturalWidth??image.width))return;
  const [left,top,right,bottom]=box;
  ctx.drawImage(image,index%4*cell+left,Math.floor(index/4)*cell+top,right-left,bottom-top,x,y,w,h);
}
function paint(name,index,a){
  const head=name!=='garments';
  const hair=head&&(a.hairTint??hairPalette[a.hairColor]?.[1]);
  const skin=name==='neutral-heads'&&a.skin>0&&skinPalette[a.skin][1];
  const cloth=!head&&clothPalette[a.clothColor]?.[1],shoe=!head&&['','#d7ba97','#ae5037','#658b71'][a.shoes];
  if(!(hair||skin||cloth||shoe||(!head&&(a.pattern||a.material))))return null;
  const key=[name,index,hair,skin,cloth,shoe,head?'':a.pattern,head?'':a.material].join('|');
  if(painted.has(key))return painted.get(key);
  const image=surface(),ctx=image.getContext('2d',{willReadFrequently:true});
  drawCell(ctx,sheet(name),index,0,0,cell,cell);
  const data=ctx.getImageData(0,0,cell,cell);
  let masks;
  if(name==='neutral-heads'){
    ctx.clearRect(0,0,cell,cell);
    drawCell(ctx,sheet('skin-zones'),index,0,0,cell,cell);
    masks=ctx.getImageData(0,0,cell,cell).data;
  }
  const inkHair=hair?rgb(hair):null,inkSkin=skin?rgb(skin):null,inkCloth=cloth?rgb(cloth):null;
  const clothingBox=garment[index];
  const inkShoe=shoe?rgb(shoe):null;
  const p=data.data;
  for(let i=0;i<p.length;i+=4){
    if(p[i+3]<20)continue;
    const [r,g,b]=[p[i],p[i+1],p[i+2]];
    const x=i/4%cell,y=Math.floor(i/4/cell),luma=.26*r+.58*g+.16*b;
    const skinWeight=(masks?.[i+3]??0)/255;
    const onCoat=!head&&y<last(clothingBox[1],clothingBox[3],.69);
    const hairWeight=head&&r>g+6&&g>b+4&&r>59?(1-skinWeight)*.87:0;
    const motif=a.pattern===1&&y%9<2||a.pattern===2&&x%9===3&&y%8===4||a.pattern===3&&(x%12===4||y%11===4);
    const fabric=onCoat?((a.material?(x*13+y*29)%(a.material+4)-2:0)+(motif?22:0)):0;
    for(let c=0;c<3;c++){
      let value=p[i+c];
      if(inkHair&&hairWeight)value=last(value,inkHair[c]*clamp(luma/123,.46,1.53),hairWeight);
      if(inkSkin&&skinWeight)value=last(value,inkSkin[c]*clamp(luma/207,.47,1.22)+(c===0?(r-b-48)*.17:0),skinWeight*.94);
      if(inkCloth&&onCoat)value=last(value,inkCloth[c]*clamp(luma/127,.43,1.45),.83);
      if(inkShoe&&y>last(clothingBox[1],clothingBox[3],.86))value=last(value,inkShoe[c]*clamp(luma/113,.39,1.42),.77);
      p[i+c]=value+fabric;
    }
  }
  ctx.putImageData(data,0,0);
  painted.set(key,image);
  if(painted.size>128)painted.delete(painted.keys().next().value);
  return image;
}
function part(ctx,name,index,a,x,y,w,h,box){
  const color=paint(name,index,a);
  drawCell(ctx,color??sheet(name),color?0:index,x,y,w,h,box);
}
function prop(ctx,index,x,y,w,h){
  drawCell(ctx,sheet('details'),index,x,y,w,h,detail[index]);
}
function appearance(input){
  if(!input||typeof input!=='object')return avatarDefaults;
  if(!normalized.has(input))normalized.set(input,{...avatarFrom(input),pin:input.pin});
  return normalized.get(input);
}
function glyph(ctx,x,y,id,a,draw){
  const t=a.tune?.[id]??{};
  ctx.save();
  ctx.translate(x+(t.x??0)*.25,y+(t.y??0)*.25);
  ctx.rotate((t.angle??0)*Math.PI/160);
  ctx.scale(1+(t.size??0)*.036,1+(t.size??0)*.036);
  draw(t.gap??0);
  ctx.restore();
}
function oval(ctx,x,y,rx,ry,color){
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
}
function curve(ctx,x,y,cx,cy,ex,ey,color,width=1){
  ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(cx,cy,ex,ey);
  ctx.lineWidth=width;ctx.strokeStyle=color;ctx.lineCap='round';ctx.stroke();
}
function features(ctx,a,pose,blink,eyes,mouth,side){
  const eyeInk=rgb(skinPalette[a.skin][1])[1]<121?'#312120':'#4c3023';
  const soft=rgb(skinPalette[a.skin][1])[1]<121?'#50332a':'#825543';
  const [x,y,gap]=eyes,[mx,my]=mouth;
  const closed=blink||pose==='sleep'||a.eyes===2,joy=pose==='joy',surprise=pose==='surprise';
  const each=(spacing,draw)=>side?draw(0,1):[-1,1].forEach(sign=>draw(sign*spacing,sign));
  if(a.brows!==3)glyph(ctx,x,y-5.6,'brows',a,t=>each(gap+t*.22,(d,sign)=>{
    curve(ctx,d-2,1,d,[-1.9,0,-2.5][a.brows],d+2,a.brows===2?sign:-.4,soft,.74);
  }));
  glyph(ctx,x,y,'eyes',a,t=>each(gap+t*.25,(d,sign)=>{
    if(closed||joy){
      curve(ctx,d-2,0,d,pose==='sleep'?2.0:-2.8,d+2,0,eyeInk,1.05);
    }else{
      const [w,h]=[[1.45,2.48],[1.75,1.75],[1.5,2],[1.94,1.65],[2.15,2.5]][a.eyes];
      oval(ctx,d,0,w,surprise?h*1.23:h,eyeInk);
      oval(ctx,d-.47,-.76,.47,.55,'#fcebd5');
      if(a.eyes===3)curve(ctx,d-2,-1.4,d,-1.2,d+2,-2.05*sign,eyeInk,.7);
    }
  }));
  if(!side)glyph(ctx,mx,my-3.25,'nose',a,()=>{
    if(a.nose===2)curve(ctx,-.4,-1,.9,1.25,1.2,.2,'#ab745a',.83);
    else oval(ctx,0,0,a.nose?1.05:.55,a.nose?.85:.5,'#b57a5e');
  });
  glyph(ctx,mx,my,'mouth',a,()=>{
    if(pose==='sleep')curve(ctx,-1.1,0,0,.55,1.1,0,soft,.7);
    else if(surprise||a.mouth===2)oval(ctx,0,0,1.4,1.7,eyeInk);
    else if(joy||a.mouth===1||pose==='eat'){
      oval(ctx,0,0,2.45,1.65,eyeInk);oval(ctx,.05,.55,1.63,.58,'#e49b81');
    }else curve(ctx,-2,0,0,a.mouth===3?.82:2.9,2,0,eyeInk,.92);
    if(a.beard===1)curve(ctx,-3.4,-1.6,0,-5,3.4,-1.6,soft,1.3);
    if(a.beard>1)oval(ctx,0,3,2.5,a.beard===2?1.32:.64,soft);
  });
  if(a.ears||Object.values(a.tune?.ears??{}).some(Boolean))glyph(ctx,x,y+2,'ears',a,t=>{
    each(gap+9+t*.21,(d,sign)=>{
      oval(ctx,side?d-11:d,0,a.ears===1?1:2.2,2.35,skinPalette[a.skin][1]);
      oval(ctx,side?d-11:d+sign*.2,.2,.65,1.15,'#ba835e');
    });
  });
}

let faceLayer;
function placeFeatures(ctx,index,offset,scale,a,pose,blink,eyes,mouth,side){
  faceLayer??=surface();
  const face=faceLayer.getContext('2d');
  face.setTransform(1,0,0,1,0,0);face.clearRect(0,0,cell,cell);
  face.save();
  face.translate(64,64);
  features(face,a,pose,blink,eyes,mouth,side);
  face.globalCompositeOperation='destination-in';
  drawCell(face,sheet('skin-zones'),index,...offset,cell*scale,cell*scale);
  face.restore();
  ctx.drawImage(faceLayer,-64,-64);
}
function head(ctx,a,pose,blink,view,headroom){
  const {rearward,side,oblique}=view;
  const tuning=a.tune?.face??{};
  const scale=.62,eyeLine=-11;
  ctx.save();
  ctx.translate((tuning.x??0)*.3,(tuning.y??0)*.33);
  ctx.rotate((tuning.angle??0)*Math.PI/190);
  ctx.scale(([1,.89,1.1,.92][a.face])+(tuning.size??0)*.017,1+(tuning.gap??0)*.014);
  if(rearward){
    const box=rear[a.hair],w=(box[2]-box[0])*scale,h=(box[3]-box[1])*scale;
    part(ctx,'heads-back',a.hair,a,-w/2,-h+1,w,h,box);
  }else if(side){
    const [eyeX,eyeY,mouthX,mouthY]=profile[a.hair];
    const x=(oblique?10:16)-eyeX*scale,y=eyeLine-eyeY*scale;
    part(ctx,'neutral-heads',16+a.hair,a,x,y,128*scale,128*scale);
    placeFeatures(ctx,16+a.hair,[x,y],scale,a,pose,blink,[x+eyeX*scale,eyeLine,0],[x+mouthX*scale,y+mouthY*scale],true);
  }else{
    const [left,right,eyeY,mouthY]=front[a.hair],mid=(left+right)/2;
    const y=eyeLine-eyeY*scale;
    part(ctx,'neutral-heads',a.hair,a,-mid*scale,y,128*scale,128*scale);
    placeFeatures(ctx,a.hair,[-mid*scale,y],scale,a,pose,blink,[0,eyeLine,(right-left)*scale/2],[0,y+mouthY*scale],false);
  }
  // Headwear is a separate layer, seated above the eye line even for the
  // deepest cap. The crop uses its own silhouette, never a fixed atlas box.
  if(a.hat){
    const box=detail[a.hat-1],aspect=(box[2]-box[0])/(box[3]-box[1]);
    const width=[0,68,55,61,59][a.hat]*(side?.84:1);
    const brim=rearward?-23:eyeLine-5;
    const h=Math.min(width/aspect,Math.max(22,headroom+brim-3));
    const w=h*aspect;
    prop(ctx,a.hat-1,-w/2+(side?5:0),brim-h,w,h);
  }
  if(a.glasses&&!rearward){
    const [left,right]=front[a.hair],w=side?21:(right-left)*scale+13;
    if(side){
      ctx.save();ctx.beginPath();ctx.rect(0,eyeLine-6,30,14);ctx.clip();
      prop(ctx,3+a.glasses,-1,eyeLine-6,w,12);ctx.restore();
    }else prop(ctx,3+a.glasses,-w/2,eyeLine-6,w,13);
  }
  if(a.accessory===3)prop(ctx,10,side?0:-26,-28,17,13);
  if(a.accessory===4&&!rearward){
    if(side){
      ctx.save();ctx.beginPath();ctx.rect(-4,-5,8,13);ctx.clip();prop(ctx,11,-4,-5,17,13);ctx.restore();
    }else prop(ctx,11,-25,-5,50,11);
  }
  ctx.restore();
}
function body(ctx,a,view,step){
  const outfit=outfitIndex[a.outfit],box=garment[outfit];
  const w=(box[2]-box[0])*.67*(view.side?.77:1),h=(box[3]-box[1])*.56;
  const x=-w/2,y=-h,strap=(a.bag||view.rearward)?a.bag:0;
  if(strap&&!view.rearward)prop(ctx,11+strap,view.side?-w*.72:-w*.64,y+5,24,33);
  const bootY=last(box[1],box[3],.77),bootH=(box[3]-bootY)*.56;
  const split=(box[0]+box[2])/2;
  part(ctx,'garments',outfit,a,x,y,w,h-bootH,[box[0],box[1],box[2],bootY]);
  for(const side of [-1,1]){
    const crop=side<0?[box[0],bootY,split,box[3]]:[split,bootY,box[2],box[3]];
    ctx.save();
    ctx.translate(x+(side>0?w/2:0)+side*step,y+h-bootH-Math.max(0,side*step)*.33);
    part(ctx,'garments',outfit,a,0,0,w/2,bootH,crop);
    ctx.restore();
  }
  if(view.rearward&&strap)prop(ctx,11+strap,-19,y+7,38,34);
  if(a.layer&&!view.rearward)prop(ctx,13+a.layer,-w*.39,y+4,w*.78,h*.43);
  if(a.pin&&!view.rearward)oval(ctx,w*.22,y+13,2.25,2.25,'#d7a657');
  return y;
}
const actionStyle={
  walk:{pace:.49,stride:3.2,lean:.04},run:{pace:.78,stride:5.4,lean:.13},
  climb:{pace:.52,stride:4,lean:.19},sit:{squat:.77},sleep:{squat:.78,turn:-Math.PI/2},
  joy:{pace:.38,bounce:8},surprise:{pace:.5,bounce:3},eat:{pace:.43},drink:{pace:.37},photo:{pace:.45},read:{pace:.20}
};
function drawCharacter(canvas,a,pose,frame){
  const ctx=canvas.getContext('2d');
  const requested={left:'west',right:'east'}[canvas.dataset.direction]??canvas.dataset.direction??'south';
  const direction=facings.includes(requested)?requested:'south';
  const view={side:direction!=='south'&&direction!=='north',rearward:direction.startsWith('north'),oblique:direction.length>5};
  const motion=actionStyle[pose]??{},wave=Math.sin(frame*(motion.pace??.16));
  const step=wave*(motion.stride??0),bounce=(motion.bounce??Math.abs(step)*.57)*Math.abs(wave);
  const height=[1,.932,1.07][a.height]+(a.tune?.height?.size??0)*.011;
  const width=[1,.87,1.143][a.body]+(a.tune?.body?.size??0)*.014;
  ctx.setTransform(canvas.width/128,0,0,canvas.height/128,0,0);
  ctx.clearRect(0,0,128,128);
  if(!sheets.every(name=>sheet(name).naturalWidth))return;
  // Canvas 128 x 128. Ground contact y = 116. Body and head share the
  // neck origin. Mirror the rig, not individual face layers.
  const sleeping=pose==='sleep',mirror=direction.endsWith('west');
  oval(ctx,64,sleeping?108:116,sleeping?41:20,3.5,'#47332236');
  ctx.save();
  ctx.translate(sleeping?(mirror?19:109):64,sleeping?88:116-bounce);
  const vertical=height*(motion.squat??1);
  ctx.scale(mirror?-width:width,vertical);
  ctx.rotate((motion.turn??0)+(motion.lean??0)+step*.01);
  const neck=body(ctx,a,view,step);
  const neckTone=skinPalette[a.skin][1];
  ctx.beginPath();ctx.roundRect(view.side?-3:-5,neck-5,view.side?8:10,11,3);
  ctx.fillStyle=neckTone;ctx.fill();
  ctx.save();
  ctx.translate(0,neck+1);
  if(pose==='read'||pose==='eat')ctx.rotate(.07*Math.abs(wave));
  head(ctx,a,pose,frame%40>=38,view,sleeping?70:(116-bounce)/vertical+neck);
  ctx.restore();
  if(!view.rearward){
    if(a.accessory===2)prop(ctx,9,-15,neck-2,30,26);
    if(a.accessory===1||pose==='photo')prop(ctx,8,-12,pose==='photo'?neck-13+wave*2:neck+13,24,17);
    if(pose==='drink'||pose==='eat') {
      const y=neck+17-Math.max(0,wave)*9;
      oval(ctx,9,y+4,8,4,'#8b5d3e');oval(ctx,9,y+1,7,4,pose==='drink'?'#f1dab4':'#d38756');
    }
    if(pose==='read'){
      ctx.fillStyle='#f0e1bf';ctx.fillRect(-13,neck+15,26,14);
      curve(ctx,0,neck+16,0,neck+21,0,neck+28,'#765d47',.9);
    }
  }
  ctx.restore();
  if(pose==='sleep'||pose==='joy'||pose==='surprise'||pose==='climb'){
    const point=pose==='sleep'?'…':pose==='joy'?'✦':pose==='climb'?'·':'!';
    ctx.font='bold 14px serif';ctx.fillStyle=pose==='climb'?'#547e90':'#ac773d';
    ctx.fillText(point,pose==='sleep'?(mirror?92:31):93+wave*2,pose==='sleep'?66:25+wave*2);
  }
}
export function character(canvas,input,pose='look',frame=0){
  const a=appearance(input);
  canvas._spriteInput=[a,pose,frame];
  if(!canvas._waitingForArt&&sheets.some(name=>!sheet(name).naturalWidth)){
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
