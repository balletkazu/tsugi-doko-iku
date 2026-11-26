const adjustment={
  hair:{reference:128,shade:.86,light:.75},
  skin:{reference:202,shade:.68,light:.90},
  fabric:{reference:132,shade:.81,light:.70}
};
export const channelsOf=hex=>hex.slice(1).match(/../g).map(byte=>parseInt(byte,16));
export const lightness=(r,g,b)=>r*.229+g*.655+b*.116;
export function toneValue(target,lum,kind) {
  const {reference,shade,light}=adjustment[kind];
  if(lum<reference)return target*(1-shade*(reference-lum)/reference);
  const headroom=kind==='skin'?Math.min(64,255-target):255-target;
  return target+headroom*(lum-reference)*light/(255-reference);
}
export function skinInk(hex,lum){
  return 'rgb('+channelsOf(hex).map(channel=>Math.round(toneValue(channel,lum,'skin'))).join(',')+')';
}
export function pigmentWeights(hair,skin,cloth){
  // The map describes coverage of independently editable roles.
  const sum=Math.max(255,hair+skin+cloth);
  return [hair/sum,skin/sum,cloth/sum];
}
