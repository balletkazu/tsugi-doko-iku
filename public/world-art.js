import {animateWorld as animatePeople} from './traveler-art.js';
export {character} from './traveler-art.js';
const ink='#35453f', paper='#f5e8c9', gold='#e2b467', wood='#94684e', green='#668675';
export function ornament(canvas,item) {
  const c=canvas.getContext('2d');c.clearRect(0,0,32,32);
  const r=(color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  r('#68543a50',5,28,23,2);
  if(['plant','fern'].includes(item)){r(wood,11,20,11,8);r('#c48962',9,19,15,3);r(ink,15,9,2,11);for(const [x,y] of [[9,11],[16,8],[17,14],[11,5]]){r(green,x,y,6,4);r('#9ba879',x,y,4,2);}return;}
  if(item==='books'){for(const [x,y,w,color] of [[5,24,23,wood],[8,20,19,green],[6,16,18,'#b36b4d']]){r(color,x,y,w,4);r(paper,x+2,y+1,w-3,2);}return;}
  if(['cup','bowl','teaset'].includes(item)){r(ink,7,15,17,7);r('#9cafab',8,16,15,6);r(wood,10,22,11,3);r(paper,8,14,15,3);r(wood,10,15,11,1);if(item==='cup')r(green,23,16,4,4);return;}
  if(['lamp','lantern'].includes(item)){r(ink,10,10,12,2);r(ink,11,12,2,12);r(ink,20,12,2,12);r(gold,13,13,7,11);r(wood,9,24,15,3);r(wood,14,7,5,3);return;}
  r(ink,5,8,23,18);r(wood,6,9,21,16);r(paper,8,11,17,12);r(wood,9,26,3,2);r(wood,21,26,3,2);
  const patterns={brooch:[' g  ','ggg ',' ggg','  g '],rug:['gggg','g  g','g  g','gggg'],leaf:['  g ',' ggg','ggg ','g   '],shell:[' gg ','gggg',' gg ','  g '],ticket:['    ','gggg','g gg','    '],wheel:[' gg ','g  g','g  g',' gg '],wing:['   g',' ggg','ggg ',' g  '],stone:['    ',' gg ','gggg','gggg'],frame:['   g',' g  ','gg g','gggg'],drop:['  g ','  g ',' ggg',' gg '],snow:['g  g',' gg ','gggg','g  g']};
  (patterns[item]??patterns.leaf).forEach((line,y)=>[...line].forEach((p,x)=>{if(p==='g')r(item==='shell'?'#be8268':green,10+x*3,12+y*2,3,2);}));
}

export function animateWorld(root,avatar,reduced) {
  root.querySelectorAll('canvas[data-item]').forEach(canvas=>ornament(canvas,canvas.dataset.item));
  return animatePeople(root,avatar,reduced);
}
