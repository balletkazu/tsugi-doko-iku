import {avatarFrom} from './world-data.js';

const ink='#584638', wood='#957458';
const skin=['#f1c38c','#d3a478','#ad7959','#825843','#f5cfaa','#dfaf77'];
const blush=['#d99777','#bf775a','#965d49','#a66655','#dc9f8e','#c78560'];
const hair=['#895e44','#3d4038','#bf925a','#a05941','#94918a','#654b3c','#558478'];
const clothes=['#819664','#bc7355','#567e8e','#d3a459','#ccbc98','#9a8296'];
const trousers=['#5d7271','#6f654f','#587785','#77664e','#9c7956'];
const shoes=['#7c5a3d','#c5a37c','#9c513e','#6e7f5e'];

function illustrator(canvas) {
  const c=canvas.getContext('2d');
  c.setTransform(canvas.width/96,0,0,canvas.height/96,0,0);
  c.clearRect(0,0,96,96);
  c.lineCap='round';c.lineJoin='round';
  function paint(color,border,width=1.55) {
    if(color){c.fillStyle=color;c.fill();}
    if(border){c.lineWidth=width;c.strokeStyle=border;c.stroke();}
  }
  function oval(x,y,rx,ry,color,border,width) {
    c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);paint(color,border,width);
  }
  function box(x,y,w,h,r,color,border,width) {
    c.beginPath();c.roundRect(x,y,w,h,r);paint(color,border,width);
  }
  function shape(points,color,border,width) {
    c.beginPath();c.moveTo(...points[0]);
    for(const point of points.slice(1)) {
      if(point.length===2)c.lineTo(...point);
      if(point.length===4)c.quadraticCurveTo(...point);
      if(point.length===6)c.bezierCurveTo(...point);
    }
    if(color)c.closePath();
    paint(color,border,width);
  }
  return {c,oval,box,shape};
}

export function character(canvas,appearance,pose='look',frame=0,activity='') {
  const a=appearance?.design===2?appearance:avatarFrom(appearance);
  const {c,oval,box,shape}=illustrator(canvas);
  const phase=frame*Math.PI/4, sway=Math.sin(phase), walk=['walk','run','climb'].includes(pose);
  const stride=walk?(pose==='run'?7:4)*sway:0;
  const seated=['sit','sleep','eat','drink','read'].includes(pose);
  let bounce=walk?-Math.abs(sway)*2:Math.sin(frame/7)*.45;
  if(pose==='joy')bounce=-Math.abs(sway)*5;
  const coat=clothes[a.clothColor], h=hair[a.hairColor], s=skin[a.skin], cheek=blush[a.skin];
  const turned=canvas.dataset.direction==='left'?-1:1;
  oval(48,86,25,5,'#70604732');
  c.save();
  c.translate(48,84);c.scale(turned*(a.body===1?.94:a.body===2?1.07:1),a.height===1?.93:a.height===2?1.06:1);
  c.translate(-48,-84+bounce+(seated?5:0));
  if(pose==='sleep'){c.translate(49,60);c.rotate(-.22);c.translate(-49,-60);}
  if(a.hair===2||a.hair===5)oval(33,a.hair===5?18:40,10,11,h,ink);
  if(a.hair===1||a.hair===3)box(23,30,50,31,14,h,ink);
  if(a.bag)box(29,54,16,25,6,a.bag===1?'#a37b4f':'#647b68',ink);
  for(const side of [-1,1]){
    const shift=side*stride, x=48+side*8, y=seated?78:80-Math.max(0,-shift*.45);
    box(x-4+shift*.55,y-8,8,10,3,trousers[a.outfit],ink);
    box(x-5+shift,y-1,11,6,2,shoes[a.shoes],ink);
    shape([[x-3+shift,y+3],[x+4+shift,y+3]],null,'#c3a585',1);
  }
  const hem=a.outfit===3?79:73;
  shape([[37,55],[42,52],[54,52],[61,56],[a.outfit===3?65:61,hem],[49,hem+2],[a.outfit===3?32:36,hem]],coat,ink);
  shape([[40,56],[40,hem-3],[35,hem-1]],'#4a3e3022');
  if(a.outfit===0||a.outfit===2)shape([[49,56],[49,hem]],null,ink,1);
  if(a.outfit===2)shape([[41,56],[48,62],[56,56]],'#e2ce9d',ink,1);
  if(a.outfit===4){
    shape([[42,55],[42,66],[55,66],[55,55]],null,'#dcc99e',3);
    box(41,65,15,10,2,'#668180',ink,1);
  }
  if(a.pattern===1||a.pattern===3)for(const y of [63,67,71])shape([[40,y],[58,y]],null,'#f8ecc48f',1.3);
  if(a.pattern===2)for(const [x,y] of [[43,64],[52,67],[46,71],[56,72]])oval(x,y,1,1,'#f5ebd0');
  if(a.pattern===3)for(const x of [44,53])shape([[x,63],[x,72]],null,'#f8ecc48f',1);
  if(a.bag)shape([[37,57],[41,68]],null,'#6a5342',2.0);
  if(a.pin)oval(55,61,3,3,'#e8bb62',ink);
  const lift=pose==='joy'||pose==='surprise'?12:pose==='photo'?10:pose==='eat'||pose==='drink'?Math.max(0,sway)*8:0;
  for(const side of [-1,1]){
    c.save();c.translate(48+side*12,58);c.rotate(side*(-.18+stride*.035-lift*.06));
    box(-3,-1,7,13,3,coat,ink);oval(0,12,3.5,4,s,ink);
    c.restore();
  }
  const headWidths=[20,18.5,22,17.6], radius=headWidths[a.face], faceY=41;
  oval(48,faceY,radius,a.face===1?17:15.4,s,ink,1.9);
  for(const side of [-1,1])oval(48+side*(radius-.2),43,a.ears===1?2.4:a.ears===2?4.6:3.5,4.3,s,ink,1.25);
  shape([[24,40],[24,26,35,20,48,21],[63,20,73,28,71,42],[66,42],[62,33],[57,36],[a.hair===4?50:53,28],[48,37],[44,32],[40,39],[36,33],[33,43],[27,45]],h,ink,1.8);
  if(a.hair===3){
    for(const [x,y] of [[26,37],[32,30],[39,26],[55,26],[63,30],[69,37]])oval(x,y,4.4,4.4,h,ink,.9);
  }
  if(a.hair===6)shape([[27,39],[29,29],[33,28],[32,39]],'#4e4136');
  shape([[32,31],[38,25,47,25],[51,25]],null,'#f1ce9465',1.7);
  shape([[54,25],[62,26,66,31]],null,'#f1ce9455',1.3);
  const blink=pose==='sleep'||pose==='joy'||a.eyes===2||frame%48===46;
  for(const x of [40.5,55.5]){
    if(a.brows!==3)shape([[x-3,38],[x,37-(a.brows===2?1:0),x+2.5,38]],null,h,a.brows===1?1.5:1.0);
    if(blink)shape([[x-2.4,43],[x,40.9,x+2.4,43]],null,ink,1.65);
    else {
      oval(x,43,a.eyes===4?2.4:a.eyes===3?1.35:1.7,a.eyes===4?3.15:a.eyes===1?1.8:2.55,ink);
      oval(x+.5,42.15,.67,.67,'#fff2dc');
    }
    oval(x+(x<48?-4.1:4.1),47,2.9,1.4,cheek);
    if(a.glasses) {
      const rim=a.glasses===3?'#9b763f':ink;
      if(a.glasses===2)box(x-5,39,10,8,2,null,rim,1.4);
      else oval(x,43,5,4.4,null,rim,1.5);
    }
  }
  if(a.glasses)shape([[45.5,42],[50.5,42]],null,ink,1.2);
  if(a.nose===1)oval(48,46,1.4,1.05,cheek);
  if(a.nose===2)shape([[48,43],[47,46],[48.5,46]],null,cheek,1.2);
  if(a.beard===2||a.beard===3)shape([[41,49],[48,56,55,49],[54,54],[48,56],[42,54]],a.beard===2?h:'#6d50394e');
  if(a.beard===1)shape([[42,49],[47,46],[48,48],[50,46],[54,49]],h);
  if(pose==='surprise'||a.mouth===2)oval(48,50,2.1,2.6,'#9a5844',ink,1.05);
  else if(pose==='joy'||pose==='eat'||a.mouth===1)shape([[44,49],[52,49],[51,54,48,53],[45,53,44,49]],'#b87159',ink,1.1);
  else shape([[45.5,49.5],[48,52,50.5,a.mouth===3?51:49.5]],null,ink,1.25);
  if(a.hat===1){
    shape([[27,30],[27,15,40,12,49,13],[62,12,68,20,68,30]],'#d7b77f',ink);
    shape([[29,24],[47,27,67,24],[69,29],[30,32]],'#a88058',ink,1);
    shape([[21,33],[23,28,35,29],[60,29],[72,26,76,31],[77,36,67,38],[47,35],[26,38],[20,37,21,33]],'#e5c999',ink,1.75);
    shape([[34,19],[42,15,54,17]],null,'#f3dec0',1.6);
  }
  if(a.hat===2){oval(49,14,5,5,'#d9a35c',ink);shape([[27,33],[29,17,49,17],[67,17,71,32]],'#c2914e',ink);box(25,29,48,7,2,'#e1b46d',ink);}
  if(a.hat===3){shape([[26,33],[24,17,47,17],[65,17,69,31]],'#668b91',ink);shape([[46,32],[59,28,76,35],[72,39,55,36]],'#557980',ink);}
  if(a.hat===4)oval(48,24,24,7,'#ae6658',ink);
  if(a.accessory===2){box(36,54,22,4,2,'#ba6c50',ink,1);box(36,57,6,12,2,'#c77e5d',ink,1);}
  if(a.accessory===3){for(let k=0;k<5;k++)oval(31+Math.cos(k*1.26)*3,32+Math.sin(k*1.26)*3,2.1,2.1,'#eed18f');oval(31,32,1.8,1.8,'#b76852');}
  if(a.accessory===4)oval(68,46,2,3,'#dfb46f',ink,1);
  if(a.accessory===1||pose==='photo'){
    const y=pose==='photo'?45+sway:63;
    box(44,y,19,11,2,'#665748',ink);box(46,y+1,4,3,1,'#eee0b5');oval(55,y+6,4,4,'#819c9a',ink);
    if(pose==='photo'&&frame%24===8)oval(56,y+5,2.1,2.1,'#fff7dd');
  }
  if(pose==='drink'||pose==='eat'){
    const y=65-Math.max(0,sway)*9;
    if(pose==='drink'){box(53,y,11,9,2,'#aec3ae',ink);oval(64,y+4,2.5,3,null,ink,1);}
    else shape([[49,y],[66,y],[62,y+7,57,y+8],[52,y+6]],'#ddb789',ink);
  }
  if(pose==='read')shape([[32,63],[43,60],[48,63],[58,59],[64,63],[61,72],[48,73],[37,71]],'#eaddb9',ink);
  if(pose==='climb'){shape([[70,58],[67,83]],null,wood,2.4);oval(74,35+sway,2,4,'#87b7bb');}
  if(pose==='sleep'){c.font='bold 9px sans-serif';c.fillStyle='#6f9293';c.fillText('z',70,26+sway);c.font='bold 7px sans-serif';c.fillText('z',76,19+sway);}
  if(pose==='joy'||pose==='surprise')for(const [x,y,d] of [[26,18,-1],[69,17,1],[74,25,1]])shape([[x,y],[x+3*d,y-4-Math.abs(sway)]],null,pose==='joy'?'#e5b962':'#b77958',2);
  if(activity==='rain')shape([[63,38],[63,61],[64,23],[72,10,86,24],[70,28],[54,24]],'#9ab4a6',ink,1.2);
  if(activity==='snow')box(32,54,29,5,2,'#e3d2b1',ink,1);
  c.restore();
  drawRide(activity,{box,oval,shape},sway);
}

function drawRide(activity,{box,oval,shape},sway){
  if(['train','bus'].includes(activity)){
    const hue=activity==='train'?'#a96c58':'#859664';
    box(14,51,68,32,7,hue,ink);
    box(18,54,60,8,3,'#eadbb5',ink);
    box(22,61,15,12,2,'#b3ccc2',ink);box(59,61,15,12,2,'#b3ccc2',ink);
    for(const x of [29,68])oval(x,84,5,4,ink);
    shape([[20,78],[75,78]],null,'#edd8ae',1.6);
  }
  if(activity==='boat'){shape([[14,66],[80,66],[71,83],[27,83]],'#7893a0',ink);shape([[16,87],[25,87+sway,39,87],[66,88],[81,85]],null,'#92bec2',2);}
  if(activity==='plane'){shape([[12,72],[51,66],[70,60],[79,67],[92,73],[87,81],[18,81]],'#b0bfb0',ink);shape([[52,75],[35,89],[48,89],[68,75]],'#d4c9b4',ink);}
  if(activity==='cycle'){for(const x of [26,72])oval(x,78,10,10,null,ink,2);shape([[26,78],[45,61],[57,78],[39,78],[55,66],[73,78]],null,'#98775c',2);}
}

export function animateWorld(root,avatar,reduced){
  const portraits=[...root.querySelectorAll('canvas[data-person]:not([data-static])')];
  let frame=0;
  function draw(){
    for(const canvas of portraits)character(canvas,canvas._avatar??avatar,canvas.dataset.pose,frame,canvas.dataset.activity);
  }
  draw();
  if(reduced||!portraits.length)return ()=>{};
  const timer=setInterval(()=>{
    if(document.hidden)return;
    frame++;
    if(frame%84===0)for(const canvas of portraits)if(canvas.hasAttribute('data-idle')) {
      canvas.dataset.pose=['look','read','drink','sleep','photo'][Math.floor(frame/84)%5];
    }
    draw();
  },115);
  return ()=>clearInterval(timer);
}
