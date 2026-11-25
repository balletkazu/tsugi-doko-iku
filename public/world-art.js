// Original layered pixel drawings. All coordinates use a 32-pixel working grid.
const ink='#35453f', paper='#f5e8c9', gold='#e2b467', wood='#94684e', green='#668675';
const hairColors=['#74513f','#414441','#c59a66','#a76042'],skins=['#f3cf9f','#d7a976','#b58260','#8a5e48'];
const coats=['#698b71','#bc7052','#637f92','#c39c54'],boots=[wood,'#ddcba6','#a85e4a'];
export function character(canvas,a,pose='look',frame=0,activity='') {
  const c=canvas.getContext('2d');
  c.resetTransform(); c.clearRect(0,0,32,32); c.imageSmoothingEnabled=false;
  const beat=frame%2, moving=['walk','run','climb'].includes(pose);
  const seated=['sit','eat','drink','read','sleep'].includes(pose);
  const jump=pose==='joy'?beat*2:(moving?beat:0);
  const r=(color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  r('#74745a65',7,28,19,2);
  c.save();
  c.translate(0,(seated?2:0)-jump);
  if (pose==='sleep') {c.translate(16,20);c.rotate(-0.34);c.translate(-16,-20);}
  const skin=skins[a.skin], hair=hairColors[a.hairColor], coat=coats[a.outfit];
  const leg=pose==='run'?3:2;
  for(const [i,x] of [11,18].entries()){
    const lift=moving && beat===i?leg:0;
    r(ink,x,22,4,seated?3:6-lift);r('#687168',x+1,22,2,3);
    r(ink,x+(seated?1:0),seated?25:27-lift,5,2);r(boots[a.shoes],x+(seated?2:0),seated?24:26-lift,4,2);
  }
  if(a.bag){r(ink,6,17,6,7);r(a.bag===1?wood:green,7,18,4,5);r(gold,7,19,3,1);}
  r(ink,10,15,13,9);r(ink,11,23,11,2);r(coat,11,16,11,7);r(coat,10,19,13,4);
  r('#e4d3aa',15,17,2,6);r(gold,16,20,1,1);r(ink,11,23,11,1);
  const wide=a.face===2?1:0, narrow=a.face===1?1:0;
  r(ink,11,4,10,1);r(ink,9,5,14,3);r(ink,8-wide,8,16+2*wide,6);r(ink,10+narrow,14,12-2*narrow,2);r(ink,12,16,8,1);
  r(skin,9-wide,8,14+2*wide,5);r(skin,10,12,12,3);r(skin,12+narrow,15,8-2*narrow,1);
  r(hair,10,5,12,3);r(hair,8,7,15,2);r(hair,9,9,2,3);r(hair,11,8,3,2);r(hair,21,8,2,4);
  if(a.hair===1){r(hair,8,10,2,6);r(hair,22,10,2,6);} if(a.hair===2){r(ink,5,7,5,5);r(hair,6,7,3,4);r(gold,8,9,2,1);}
  for (const x of [12,18]) {
    const shut=a.eyes===2 || pose==='sleep' || pose==='joy' || (pose==='look' && frame%13===12);
    r(ink,x,shut?12:11,shut?3:2,shut?1:2);
    if(a.eyes===1&&!shut) r(hair,x+1,10,2,1);
    if(a.glasses){r(ink,x-1,10,4,1);r(ink,x-1,11,1,2);r(ink,x+2,11,1,2);r(ink,x+(a.glasses===1?0:-1),13,a.glasses===1?2:4,1);}
  }
  if(a.glasses) r(ink,15,11,2,1);
  r('#ad745d',15,14,pose==='surprise'?2:1,pose==='surprise'?2:1);
  if(a.hat===1){r(ink,11,2,10,2);r(green,10,3,12,3);r('#94754d',10,5,12,1);r(ink,6,6,20,2);r('#a4a377',7,6,18,1);}
  if(a.hat===2){r(ink,13,1,5,2);r('#bc7052',11,3,10,3);r(ink,9,5,14,3);r('#c98b64',10,5,12,2);}
  const raised=['joy','surprise','photo'].includes(pose);
  r(coat,8,raised?15:17,4,4);r(skin,8,raised?14:20,3,2);
  r(coat,21,raised?14:17,4,4);r(skin,23,raised?12:19,2,3);
  if(a.accessory===2){r('#b8634b',11,16,10,2);r('#b8634b',12,17,3,4);}
  if(a.accessory===1||pose==='photo'){const y=pose==='photo'?12+beat:19;r(ink,15,y,8,5);r('#99b4af',18,y+1,3,3);r(paper,16,y+1,1,1);}
  if(pose==='read'){r(wood,12,20,11,4);r(paper,12,19,5,4);r('#e3c88e',17,19,6,4);r(ink,17,20,1,4);r('#ae9a72',beat?13:18,20,3,1);}
  if(pose==='drink'){const y=19-beat*2;r(ink,18,y,6,5);r('#9db7a7',18,y,5,4);r(paper,19,y,3,1);r(green,23,y+1,2,2);}
  if(pose==='eat'){r(paper,15,20,8,2);r(wood,16,22,6,2);r(gold,20,16-beat,3,2);}
  if(pose==='climb'){r('#80b7be',23,8+beat,2,3);r(wood,25,20,1,8);}
  if(pose==='surprise'){r(gold,26,4-beat,2,4);r(ink,26,9-beat,2,1);}
  if(pose==='sleep'){r(green,24,6-beat,4,1);r(green,26,7-beat,1,1);r(green,24,8-beat,4,1);}
  if(activity==='rain'){r(ink,24,1,1,19);r('#a65d4d',19,1,10,1);r('#bb795f',17,2,14,3);}
  if(activity==='snow'){r(paper,11,17,10,2);r(paper,19,19,3,5);}
  if(a.pin){r(ink,10,18,4,4);r(a.pin==='shell'?'#c77f67':gold,11,18,2,3);}
  c.restore();
  if(['train','bus','boat','plane','cycle'].includes(activity)){
    const color={train:'#9e654c',bus:'#647f69',boat:'#627f94',plane:'#819895',cycle:wood}[activity];
    if(activity==='cycle'){for(const x of [5,22]){r(ink,x,24,6,6);r(paper,x+1,25,4,4);}r(color,9,24,16,2);r(ink,24,21,2,5);}
    else{r(ink,1,22,30,6);r(color,2,23,28,4);r(paper,3,23,26,1);
      if(activity==='train'||activity==='bus'){r(color,1,9,3,15);r(color,28,9,3,15);r(color,1,8,30,2);r(ink,4,28,5,2);r(ink,23,28,5,2);}
      if(activity==='boat'){r(color,4,28,24,1);r('#81aead',1,30,12,1);r('#81aead',18,30,12,1);}
      if(activity==='plane'){r(paper,6,27,11,2);r(color,2,16,2,8);}
    }
  }
}
export function ornament(canvas,item) {
  const c=canvas.getContext('2d');c.clearRect(0,0,32,32);
  const r=(color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  r('#68543a50',5,28,23,2);
  if(item==='plant'){r(wood,11,20,11,8);r('#c48962',9,19,15,3);r(ink,15,9,2,11);for(const [x,y] of [[9,11],[16,8],[17,14],[11,5]]){r(green,x,y,6,4);r('#9ba879',x,y,4,2);}return;}
  if(item==='books'){for(const [x,y,w,color] of [[5,24,23,wood],[8,20,19,green],[6,16,18,'#b36b4d']]){r(color,x,y,w,4);r(paper,x+2,y+1,w-3,2);}return;}
  if(['cup','bowl'].includes(item)){r(ink,7,15,17,7);r('#9cafab',8,16,15,6);r(wood,10,22,11,3);r(paper,8,14,15,3);r(wood,10,15,11,1);if(item==='cup')r(green,23,16,4,4);return;}
  if(item==='lamp'){r(ink,10,10,12,2);r(ink,11,12,2,12);r(ink,20,12,2,12);r(gold,13,13,7,11);r(wood,9,24,15,3);r(wood,14,7,5,3);return;}
  r(ink,5,8,23,18);r(wood,6,9,21,16);r(paper,8,11,17,12);r(wood,9,26,3,2);r(wood,21,26,3,2);
  const patterns={leaf:['  g ',' ggg','ggg ','g   '],shell:[' gg ','gggg',' gg ','  g '],ticket:['    ','gggg','g gg','    '],wheel:[' gg ','g  g','g  g',' gg '],wing:['   g',' ggg','ggg ',' g  '],stone:['    ',' gg ','gggg','gggg'],frame:['   g',' g  ','gg g','gggg'],drop:['  g ','  g ',' ggg',' gg '],snow:['g  g',' gg ','gggg','g  g']};
  (patterns[item]??patterns.leaf).forEach((line,y)=>[...line].forEach((p,x)=>{if(p==='g')r(item==='shell'?'#be8268':green,10+x*3,12+y*2,3,2);}));
}
export function animateWorld(root,avatar,reduced) {
  let frame=0,elapsed=0;
  const portraits=[...root.querySelectorAll('canvas[data-person]')];
  root.querySelectorAll('canvas[data-item]').forEach(c=>ornament(c,c.dataset.item));
  const draw=()=>portraits.forEach(c=>character(c,c._avatar??avatar,c.dataset.pose,frame,c.dataset.activity));
  draw();
  if(!portraits.length || reduced) return ()=>{};
  const timer=setInterval(()=>{
    if(document.hidden)return;
    frame++;elapsed++;
    for(const c of portraits.filter(c=>c.hasAttribute('data-idle'))) {
      if(elapsed%20===0) {
        const index=Math.floor(elapsed/20)%5;
        c.dataset.pose=['look','read','drink','sleep','photo'][index];
        const actor=c.closest('.scene-person');
        if(actor)actor.style.left=[46,21,50,81,42][index]+'%';
      }
    }
    draw();
  },420);
  return ()=>clearInterval(timer);
}
