// Coordinates for one fully turned drawing, relative to the feet (0, 0).
// Positive x always points toward the visible face before reflecting a symmetric rig.
export const turnSequence=['south','southeast','east','northeast','north','northwest','west','southwest'];
export const referenceHair=new Map([[0,0],[8,1],[23,2]]);
export const referenceOutfit=new Set([0,1]);

const poses=[
  {head:[0,-78],neck:[0,-57],shoulders:[[-14,-53],[14,-53]],hands:[[-20,-27],[20,-27]],hips:[[-8,-21],[8,-21]],ankles:[[-8,-8],[8,-8]],chest:[0,-38],back:[-1,-42]},
  {head:[3,-78],neck:[1,-57],shoulders:[[-14,-53],[11,-51]],hands:[[-18,-25],[17,-28]],hips:[[-7,-21],[8,-21]],ankles:[[-7,-8],[10,-8]],chest:[6,-37],back:[-6,-42]},
  {head:[6,-78],neck:[0,-57],shoulders:[[-6,-52]],hands:[[-7,-27]],hips:[[-4,-21],[5,-21]],ankles:[[-5,-8],[5,-8]],chest:[9,-37],back:[-9,-43]},
  {head:[-2,-78],neck:[0,-57],shoulders:[[-11,-52],[12,-53]],hands:[[-17,-28],[18,-26]],hips:[[-7,-21],[8,-21]],ankles:[[-7,-8],[9,-8]],chest:[9,-38],back:[-3,-41]},
  {head:[0,-78],neck:[0,-57],shoulders:[[-14,-53],[14,-53]],hands:[[-19,-27],[19,-27]],hips:[[-8,-21],[8,-21]],ankles:[[-8,-8],[8,-8]],chest:[0,-38],back:[0,-41]}
];

export function authoredTurn(facing){
  const angle=Math.max(0,turnSequence.indexOf(facing));
  return {index:angle>4?8-angle:angle,mirror:angle>4,behind:angle>=3&&angle<=5};
}
export function approvedTurns(avatar){
  const coat=referenceOutfit.has(avatar.outfit);
  const hair=referenceHair.has(avatar.hair);
  return turnSequence.filter(direction=>{
    const {index}=authoredTurn(direction);
    if(index===0)return true;
    if(!coat&&avatar.outfit<8)return false;
    if(index===3)return coat&&hair&&!avatar.shoes;
    return index!==1||hair||avatar.hair>=16;
  });
}
export function resolvedTurn(avatar,requested){
  const allowed=approvedTurns(avatar);
  if(allowed.includes(requested))return requested;
  const fallback={southeast:'east',southwest:'west',northeast:'north',northwest:'north'};
  return allowed.includes(fallback[requested])?fallback[requested]:'south';
}
export function bodyFrame(index){return poses[index];}

export function sockets(avatar,pose,fit=1){
  const [cx,cy]=pose.chest;
  const collar=avatar.outfit===1?1.5:0;
  const neck=pose.neck;
  const shoulder=pose.shoulders.map(([x,y])=>[x,y+collar]);
  const camera=[cx,cy+4*fit];
  return {shoulder,neck,back:pose.back,camera,lapel:[cx+9,cy-8],
    chest:[cx,cy+collar],cameraRoots:[[neck[0]-5,neck[1]+1],[neck[0]+5,neck[1]+1]]};
}

// The selected accessory occupies one primary slot. A souvenir uses the lapel,
// and belt and collar paths share the same body transform as the garments.
export function equipmentSlots(avatar){
  return {head:avatar.hat||null,eyes:avatar.glasses||null,back:avatar.bag||null,
    shoes:avatar.shoes||null,neck:[1,2,5].includes(avatar.accessory)?avatar.accessory:null,
    ear:avatar.accessory===4,hair:avatar.accessory===3,lapel:avatar.pin||null};
}
