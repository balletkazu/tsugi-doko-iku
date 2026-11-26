import {avatarFrom,avatarDefaults} from './world-data.js';
import {hairPalette,skinPalette,clothPalette} from './avatar-palette.js';
import {detail,headwear,footwear,regionalObjects} from './sprite-guides.js';
import {materialGuides} from './material-guides.js';
import {channelsOf as rgb,lightness,toneValue,skinInk,pigmentWeights} from './material-color.js';
import {styles} from './style-catalog.js';
import {collectionItem} from './item-catalog.js';
import {spriteSize as cell,groundY,eyeLine,facings,rigView,fitHat,stride,visibleMotion} from './avatar-rig.js';

export {facings};

const core=['head-core','head-core-map','garments','garments-map','wardrobe','wardrobe-map','details','headwear','footwear','regional-objects'];
const addon=new Set(['head-cuts-a-v1','head-cuts-b-v1','atelier-towns','local-crafts']);
const images=new Map();
const painted=new Map();
const normalized=new WeakMap();
const maskCells=new Map();
let assets;
const last=(a,b,t)=>a+(b-a)*t;


function sheet(name){
  if(!images.has(name)){
    const image=new Image();
    image.src='./assets/'+(addon.has(name.replace(/-map$/,''))?'catalog':'atelier')+'/'+name+'.webp';
    images.set(name,{image,ready:image.decode().catch(()=>{})});
  }
  return images.get(name).image;
}
const available=name=>!!sheet(name).naturalWidth;
const faces=avatar=>styles.hair[avatar.hair].sheet;
const materialReady=name=>available(name)&&available(name+'-map');
function additions(a){
  const parts=[faces(a),styles.outfit[a.outfit].sheet].filter(name=>addon.has(name));
  const art=a.pin&&collectionItem(a.pin)?.sheet;
  return [...new Set([...parts.flatMap(part=>[part,part+'-map']),...(addon.has(art)?[art]:[])])];
}
function readAll(names){
  return Promise.all(names.map(name=>{sheet(name);return images.get(name).ready;}));
}
export function travelerAssets(input){
  assets??=readAll(core);
  return input?Promise.all([assets,readAll(additions(appearance(input)))]):assets;
}
if(typeof window!=='undefined')window.addEventListener('online',()=>{
  for(const [name,{image}] of images)if(!image.naturalWidth)images.delete(name);
  assets=null;
});
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
function materialCell(name,index){
  const key=name+':'+index;
  if(maskCells.has(key))return maskCells.get(key);
  const c=surface(), ctx=c.getContext('2d',{willReadFrequently:true});
  drawCell(ctx,sheet(name+'-map'),index,0,0,cell,cell);
  const raw=ctx.getImageData(0,0,cell,cell), pixels=raw.data.slice();
  // Features remain on the face by using the very same skin coverage.
  for(let i=0;i<raw.data.length;i+=4)raw.data[i+3]=pixels[i+1];
  ctx.putImageData(raw,0,0);
  const value={pixels,skin:c};
  maskCells.set(key,value);
  if(maskCells.size>64)maskCells.delete(maskCells.keys().next().value);
  return value;
}
function paint(name,index,a){
  const head=name.startsWith('head');
  const hair=head&&(a.hairTint??hairPalette[a.hairColor][1]);
  const skin=skinPalette[a.skin][1];
  const cloth=!head&&clothPalette[a.clothColor]?.[1];
  const key=[name,index,hair,skin,cloth,head?'':a.pattern,head?'':a.material].join('|');
  if(painted.has(key))return painted.get(key);
  const image=surface(),ctx=image.getContext('2d',{willReadFrequently:true});
  drawCell(ctx,sheet(name),index,0,0,cell,cell);
  const pixels=materialCell(name,index).pixels;
  const data=ctx.getImageData(0,0,cell,cell), dst=data.data;
  const rgbHair=hair?rgb(hair):null,rgbSkin=rgb(skin),rgbCloth=cloth?rgb(cloth):null;
  for(let i=0;i<dst.length;i+=4){
    if(!dst[i+3])continue;
    const [hairArea,skinArea,fabric]=pigmentWeights(pixels[i],pixels[i+1],pixels[i+2]);
    if(!hairArea&&!skinArea&&!fabric)continue;
    const x=i/4%cell,y=Math.floor(i/4/cell),light=lightness(dst[i],dst[i+1],dst[i+2]);
    const pattern=a.pattern===1&&y%9<2||a.pattern===2&&x%9===3&&y%8===4||a.pattern===3&&(x%12===4||y%11===4);
    const texture=fabric*((a.material?(x*13+y*29)%(a.material+4)-2:0)+(pattern?18:0));
    const h=rgbHair?hairArea:0, s=skinArea, f=rgbCloth?fabric:0;
    for(let c=0;c<3;c++)dst[i+c]=dst[i+c]*(1-h-s-f)+
      (h?toneValue(rgbHair[c],light,'hair')*h:0)+
      (s?toneValue(rgbSkin[c],light,'skin')*s:0)+
      (f?toneValue(rgbCloth[c],light,'fabric')*f:0)+texture;
  }
  ctx.putImageData(data,0,0);
  painted.set(key,image);
  if(painted.size>96)painted.delete(painted.keys().next().value);
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
  const skin=skinPalette[a.skin][1],hair=a.hairTint??hairPalette[a.hairColor][1];
  const soft=skinInk(skin,128),hairInk=skinInk(hair,150);
  const [x,y,gap]=eyes,[mx,my]=mouth;
  const closed=blink||pose==='sleep'||a.eyes===2,joy=pose==='joy',surprise=pose==='surprise';
  const each=(spacing,draw)=>side?draw(0,1):[-1,1].forEach(sign=>draw(sign*spacing,sign));
  if(a.brows!==3)glyph(ctx,x,y-5.6,'brows',a,t=>each(gap+t*.22,(d,sign)=>{
    curve(ctx,d-2,1,d,[-1.9,0,-2.5][a.brows],d+2,a.brows===2?sign:-.4,hairInk,.74);
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
    if(a.beard===1||a.beard===5)curve(ctx,-3.4,-1.6,0,-5,3.4,-1.6,hairInk,a.beard===5?.82:1.3);
    if(a.beard>=2&&a.beard<=4){
      oval(ctx,0,3,a.beard===4?4.8:2.5,a.beard===3?.64:1.38,hairInk);
      if(a.beard===4)curve(ctx,-4,2.1,0,5.4,4,2.1,hairInk,1.05);
    }
  });
  if(a.ears||Object.values(a.tune?.ears??{}).some(Boolean))glyph(ctx,x,y+2,'ears',a,t=>{
    each(gap+9+t*.21,(d,sign)=>{
      oval(ctx,side?d-11:d,0,a.ears===1?1:2.2,2.35,skinPalette[a.skin][1]);
      oval(ctx,side?d-11:d+sign*.2,.2,.65,1.15,skinInk(skin,156));
    });
  });
}

let faceLayer;
function placeFeatures(ctx,name,index,offset,scale,a,pose,blink,eyes,mouth,side){
  faceLayer??=surface();
  const face=faceLayer.getContext('2d');
  face.setTransform(1,0,0,1,0,0);face.clearRect(0,0,cell,cell);
  face.save();
  face.translate(64,64);
  features(face,a,pose,blink,eyes,mouth,side);
  face.globalCompositeOperation='destination-in';
  face.drawImage(materialCell(name,index).skin,...offset,cell*scale,cell*scale);
  face.restore();
  ctx.drawImage(faceLayer,-64,-64);
}
function headShape(a,view){
  const scale=.62;
  const asset=styles.hair[a.hair],name=asset.sheet,old=name==='head-core';
  const side=view.side&&(!view.oblique||old);
  const direction=view.rearward?(old?32:2):side?(old?16:1):view.oblique?3:0;
  const index=asset.cell+direction;
  const [box,points,earGuides]=materialGuides[name][index];
  const headWidth=(box[2]-box[0])*scale;
  if(view.rearward){
    const w=headWidth,h=(box[3]-box[1])*scale;
    return {name,index,x:-w/2+(view.side?-3:0),y:1-h,w,h,box,headWidth};
  }
  const middle=side?points[0]:(points[0]+points[1])/2;
  const ey=side?points[1]:points[2],my=points[3];
  const eyeX=side?(view.oblique?10:16):view.oblique?7:0;
  const x=eyeX-middle*scale,y=eyeLine-ey*scale;
  const mouthX=side?points[2]:points[4]??middle;
  return {name,index,x,y,w:cell*scale,h:cell*scale,
    eyes:[eyeX,eyeLine,side?0:(points[1]-points[0])*scale/2],mouth:[x+mouthX*scale,y+my*scale],
    ears:earGuides?.map(([px,py])=>[x+px*scale,y+py*scale]),
    headWidth,side,scale};
}
function shadeBrim(ctx,mount){
  const {x,w,seat}=mount;
  const shadow=ctx.createLinearGradient(0,seat-2,0,seat+8);
  shadow.addColorStop(0,'#32201763');shadow.addColorStop(1,'#32201700');
  ctx.save();
  ctx.globalCompositeOperation='source-atop';
  ctx.fillStyle=shadow;
  ctx.beginPath();
  ctx.moveTo(x+w*.06,seat-5);
  ctx.quadraticCurveTo(x+w*.53,seat-1,x+w*.94,seat-5);
  ctx.lineTo(x+w*.84,seat+6);
  ctx.quadraticCurveTo(x+w*.5,seat+12,x+w*.16,seat+6);
  ctx.closePath();ctx.fill();ctx.restore();
}
function behindBrim(ctx,mount,a){
  if(!mount.brim)return;
  const {x,w,seat}=mount;
  oval(ctx,x+w*.5,seat-2,w*.47,4,a.hat===3?'#272b32':'#694727');
}
let headLayer;
function paintHead(ctx,a,shape,view,pose,blink,mount){
  headLayer??=surface();
  const layer=headLayer.getContext('2d');
  layer.clearRect(0,0,cell,cell);
  layer.save();layer.translate(64,64);
  if(mount){
    // Keep the locks and ear-level hair below the cap. A bun cannot poke
    // through the crown, even when its natural height exceeds the brim.
    layer.beginPath();
    layer.moveTo(-64,mount.seat-13);
    layer.quadraticCurveTo(0,mount.seat+3,64,mount.seat-13);
    layer.lineTo(64,64);layer.lineTo(-64,64);layer.closePath();layer.clip();
  }
  const {name,index,x,y,w,h,box}=shape;
  part(layer,name,index,a,x,y,w,h,box);
  if(shape.eyes)placeFeatures(layer,name,index,[x,y],shape.scale,a,pose,blink,shape.eyes,shape.mouth,shape.side);
  if(mount)shadeBrim(layer,mount);
  layer.restore();
  ctx.drawImage(headLayer,-64,-64);
}
function eyewear(ctx,a,shape,view){
  if(!a.glasses||!shape.eyes)return;
  const index=3+a.glasses,box=detail[index], [eyeX,y,gap]=shape.eyes;
  const ink=['','#70432e','#3e352e','#a27b4e','#38574f'][a.glasses];
  if(shape.side){
    curve(ctx,eyeX-5,y-2,eyeX-13,y-3,eyeX-22,y+.2,ink,1.18);
    const half=[box[0],box[1],(box[0]+box[2])/2,box[3]];
    drawCell(ctx,sheet('details'),index,eyeX-6,y-4.8,13,10,half);
    curve(ctx,eyeX+5,y-1,eyeX+7,y-2,eyeX+8,y-.3,ink,.8);
  }else{
    const w=gap*2+12;
    curve(ctx,eyeX-w/2,y-2,eyeX-w/2-3,y-2,eyeX-w/2-5,y+1,ink,1);
    curve(ctx,eyeX+w/2,y-2,eyeX+w/2+3,y-2,eyeX+w/2+5,y+1,ink,1);
    prop(ctx,index,eyeX-w/2,y-5.6,w,11);
  }
}
function head(ctx,a,pose,blink,view,headroom){
  const tuning=a.tune?.face??{},shape=headShape(a,view);
  const index=(a.hat-1)*4+view.angle;
  const mount=a.hat?fitHat(a.hat,view,shape.headWidth,headroom,headwear[index]):null;
  ctx.save();
  ctx.translate((tuning.x??0)*.3,(tuning.y??0)*.33);
  ctx.rotate((tuning.angle??0)*Math.PI/190);
  ctx.scale(([1,.89,1.1,.92][a.face])+(tuning.size??0)*.017,1+(tuning.gap??0)*.014);
  if(mount)behindBrim(ctx,mount,a);
  paintHead(ctx,a,shape,view,pose,blink,mount);
  eyewear(ctx,a,shape,view);
  if(mount)drawCell(ctx,sheet('headwear'),index,mount.x,mount.y,mount.w,mount.h,headwear[index]);
  if(a.accessory===3){
    const y=mount?mount.seat+2:-25;
    prop(ctx,10,view.side?-17:-25,y,14,9);
  }
  if(a.accessory===4&&!view.rearward){
    const box=detail[11],split=(box[0]+box[2])/2;
    const half=[box[0],box[1],split,box[3]];
    for(const [earX,earY] of shape.ears??[]){
      oval(ctx,earX,earY+.6,2.3,1.7,'#3f2a2240');
      drawCell(ctx,sheet('details'),11,earX-2.3,earY-1.6,4.6,7.8,half);
    }
  }
  ctx.restore();
}

function wearPack(ctx,a,view,width,y,behind){
  if(!a.bag||behind===view.rearward)return;
  const index=11+a.bag;
  const w=view.rearward?33:view.side?21:23;
  const x=view.rearward?-w/2:view.side?-width*.60-w*.26:-width*.52-w*.26;
  const h=view.rearward?31:28;
  prop(ctx,index,x,y+(view.rearward?4:6),w,h);
}
function collarAndHolding(ctx,a,view,w,neck,pose,pageTurn){
  if(view.rearward)return;
  const side=view.side;
  if(a.bag){
    const shade=a.bag===1?'#66452ed9':'#38424bd9';
    for(const sign of side?[-1]:[-1,1])curve(ctx,sign*w*.29,neck+4,sign*w*.22,neck+10,sign*w*.29,neck+19,shade,2);
  }
  if(a.accessory===2){
    oval(ctx,side?1:0,neck+5,w*.25,4,'#35271c44');
    prop(ctx,9,-(side?8.7:11.8),neck-1,side?19:24,19);
  }
  if(a.accessory===5){
    const center=side?3:0,edge=side?7:9;
    curve(ctx,center-edge,neck+2,center-5,neck+7,center,neck+11,'#493329',1.37);
    curve(ctx,center,neck+11,center+5,neck+8,center+edge,neck+2,'#493329',1.37);
    oval(ctx,center,neck+12.7,2,2.7,'#445a54');
    oval(ctx,center-.34,neck+11.8,.7,.67,'#a9b9a2');
  }
  if(a.accessory===1&&pose!=='read'){
    const x=side?6:0,y=neck+16;
    curve(ctx,-w*.16,neck+2,-w*.14,y-6,x-8,y+2,'#63452f',1.18);
    curve(ctx,w*.15,neck+2,w*.19,y-6,x+9,y+2,'#63452f',1.18);
    prop(ctx,8,x-10,y,21,14);
  }
  if(a.pin&&pose!=='read'){
    const item=collectionItem(a.pin);
    const y=neck+12,x=w*.24;
    if(item?.sheet&&available(item.sheet)){
      const bounds=item.sheet==='regional-objects'?regionalObjects:materialGuides[item.sheet];
      drawCell(ctx,sheet(item.sheet),item.art,x-4,y-4,8.4,8.4,bounds[item.art]);
    }
    else oval(ctx,x,y,2.25,2.25,'#d7a657');
  }
  if(pose==='read')openBook(ctx,a,w,neck,pageTurn);
}
function openBook(ctx,a,w,y,pageTurn){
  const left=-w*.34,right=w*.34,middle=y+20;
  const skin=skinPalette[a.skin][1];
  ctx.save();ctx.lineJoin='round';
  ctx.shadowColor='#3f2b224d';ctx.shadowBlur=2;ctx.shadowOffsetY=1;
  ctx.beginPath();ctx.moveTo(left,middle-4);ctx.quadraticCurveTo(-7,middle-8,0,middle-3);
  ctx.quadraticCurveTo(8,middle-8,right,middle-4);
  ctx.lineTo(right-2,middle+6);ctx.quadraticCurveTo(6,middle+5,0,middle+9);
  ctx.quadraticCurveTo(-5,middle+5,left+2,middle+6);ctx.closePath();
  ctx.fillStyle='#efdfb7';ctx.fill();ctx.shadowColor='transparent';
  ctx.strokeStyle='#775941';ctx.lineWidth=1.15;ctx.stroke();
  curve(ctx,0,middle-2,0,middle+3,0,middle+8,'#ac8b59',.8);
  for(const side of [-1,1])for(let line=0;line<2;line++){
    const at=middle+line*2;
    curve(ctx,side*4,at,side*7,at-1,side*10,at,'#b89c6b',.65);
  }
  if(pageTurn>.06){
    ctx.beginPath();ctx.moveTo(0,middle+7);ctx.quadraticCurveTo(9*pageTurn,middle-11,11*pageTurn,middle-5);
    ctx.lineTo(0,middle-3);ctx.closePath();
    ctx.fillStyle='#faf0cd';ctx.fill();ctx.strokeStyle='#b99867';ctx.lineWidth=.7;ctx.stroke();
  }
  oval(ctx,left+.7,middle+3.5,2.6,2.4,skin);
  oval(ctx,right-.7-7*pageTurn,middle+3-5*pageTurn,2.6,2.3,skin);
  ctx.restore();
}

function drawFoot(ctx,a,view,clothing,box,leg,w,bootY,bootH,side,step,walking){
  const split=(box[0]+box[2])/2;
  const half=side<0?[box[0],bootY,split,box[3]]:[split,bootY,box[2],box[3]];
  const footSpacing=a.shoes&&view.angle===2?.075:.25;
  const x=side*w*footSpacing+(view.side?3:0);
  ctx.save();
  ctx.translate(x+(walking?step.x*(view.side?.95:.30):0),-step.lift);
  ctx.rotate(step.angle*(view.side?1:side*.65));
  if(!a.shoes)part(ctx,clothing.sheet,leg,a,-w/4,-bootH,w/2,bootH,half);
  else{
    const pick=(a.shoes-1)*4+view.angle,full=footwear[pick];
    const single=view.angle===2;
    const mid=(full[0]+full[2])/2;
    const crop=single?full:side<0?[full[0],full[1],mid,full[3]]:[mid,full[1],full[2],full[3]];
    const width=w*(single?.39:.27);
    const height=Math.max(bootH-.4,a.shoes===3?12:8.5);
    const ankle=w*(single?.14:.105);
    ctx.beginPath();
    ctx.roundRect(-ankle/2,-bootH-3,ankle,Math.max(3.5,bootH+4-height*.61),1.7);
    ctx.fillStyle=clothing.id==='coast-embroidered'?skinInk(skinPalette[a.skin][1],184):'#695343';
    ctx.fill();
    drawCell(ctx,sheet('footwear'),pick,-width/2,-height,width,height,crop);
  }
  ctx.restore();
}
function body(ctx,a,view,pose,frame){
  const clothing=styles.outfit[a.outfit],old=clothing.sheet==='garments';
  const bounds=materialGuides[clothing.sheet],leg=clothing.cell+(old?0:view.angle),box=bounds[leg],frontBox=bounds[clothing.cell];
  const h=(frontBox[3]-frontBox[1])*.55;
  const w=(box[2]-box[0])*h/(box[3]-box[1])*(old?.98:1.09)*(old&&view.side?.84:1);
  const neck=-h,walking=pose==='walk',phase=(frame%32)/32;
  const readingTick=frame%68;
  const pageTurn=pose==='read'&&readingTick>=14&&readingTick<=29?Math.sin((readingTick-14)*Math.PI/15):0;
  wearPack(ctx,a,view,w,neck,true);
  const bootY=last(box[1],box[3],a.shoes?.82:.76),bootH=(box[3]-bootY)*h/(box[3]-box[1]);
  const steps=[walking?stride(phase,-1):{x:0,lift:0,angle:0},walking?stride(phase,1):{x:0,lift:0,angle:0}];
  // Shoes attach at the ankle, and the overlapping cuffs conceal the joint.
  for(const side of [-1,1])drawFoot(ctx,a,view,clothing,box,leg,w,bootY,bootH,side,steps[(side+1)/2],walking);
  part(ctx,clothing.sheet,leg,a,-w/2,neck,w,h-bootH+1,[box[0],box[1],box[2],bootY+2]);
  if(a.layer&&!view.rearward)prop(ctx,13+a.layer,-w*.38,neck+4,w*.76,h*.40);
  wearPack(ctx,a,view,w,neck,false);
  const skin=skinPalette[a.skin][1];
  // Round hand ends sit inside the sleeve cuffs; skin follows the selected palette.
  if(!view.rearward&&pose!=='read'){
    for(const side of view.side?[-1]:[-1,1]){
      const x=side*(w*.405), y=neck+h*(clothing.id==='coast-embroidered'?.37:.54);
      oval(ctx,x,y,2.45,3.5,skinInk(skin,178));
      oval(ctx,x-.4,y-.36,1.55,2.25,skinInk(skin,206));
    }
  }
  ctx.beginPath();ctx.roundRect(view.side?-3:-5,neck-5,view.side?8:10,8,3);
  const shade=ctx.createLinearGradient(0,neck-5,0,neck+4);
  shade.addColorStop(0,skinInk(skin,150));shade.addColorStop(1,skinInk(skin,206));
  ctx.fillStyle=shade;ctx.fill();
  return {neck,w,pageTurn};
}
function drawCharacter(canvas,a,inputPose,frame){
  const ctx=canvas.getContext('2d');
  const requested={left:'west',right:'east'}[canvas.dataset.direction]??canvas.dataset.direction??'south';
  const view=rigView(facings.includes(requested)?requested:'south');
  const pose=visibleMotion(inputPose);
  const height=[1,.932,1.07][a.height]+(a.tune?.height?.size??0)*.011;
  const width=[1,.87,1.143][a.body]+(a.tune?.body?.size??0)*.014;
  ctx.setTransform(canvas.width/cell,0,0,canvas.height/cell,0,0);
  ctx.clearRect(0,0,cell,cell);
  if(!core.every(available))return;
  if(!materialReady(faces(a)))a={...a,hair:0};
  if(!materialReady(styles.outfit[a.outfit].sheet))a={...a,outfit:0};
  const step=pose==='walk'?Math.cos((frame%16)/16*Math.PI*2):0;
  oval(ctx,64,groundY,20+Math.abs(step),3.2,'#47332236');
  ctx.save();
  ctx.translate(64,groundY);
  ctx.scale(view.mirror?-width:width,height);
  const garment=body(ctx,a,view,pose,frame);
  const breathe=Math.sin(frame*.085)*.64;
  ctx.save();
  ctx.translate(step*.65,garment.neck+1+breathe);
  ctx.rotate(pose==='read'?.085:step*.025);
  head(ctx,a,pose,frame%43>=40,view,groundY/height+garment.neck);
  ctx.restore();
  collarAndHolding(ctx,a,view,garment.w,garment.neck,pose,garment.pageTurn);
  ctx.restore();
}
export function character(canvas,input,pose='look',frame=0){
  const a=appearance(input);
  canvas._spriteInput=[a,pose,frame];
  const missing=[...core,...additions(a)].filter(name=>!available(name));
  const pending=missing.join('|');
  if(pending&&canvas._waitingForArt!==pending){
    canvas._waitingForArt=pending;
    travelerAssets(a).then(()=>{if(canvas._spriteInput)drawCharacter(canvas,...canvas._spriteInput);});
  }else if(!pending)canvas._waitingForArt='';

  drawCharacter(canvas,a,pose,frame);
}
export function animateWorld(root,avatar,reduced){
  const portraits=[...root.querySelectorAll('canvas[data-person]:not([data-static])')];
  let frame=0;
  const draw=()=>portraits.forEach(canvas=>character(canvas,canvas._avatar??avatar,canvas.dataset.pose,frame));
  draw();if(reduced||!portraits.length)return ()=>{};
  const timer=setInterval(()=>{if(!document.hidden){frame+=2;draw();}},72);
  return ()=>clearInterval(timer);
}
