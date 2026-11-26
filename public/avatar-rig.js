// Logical pixels in the sprite canvas. View changes apply to the whole rig.
export const spriteSize=128;
export const groundY=116;
export const eyeLine=-11;
export const facings=['south','north','east','west','southeast','southwest','northeast','northwest'];
export const releasedMotions=['look','walk','joy','read'];
export const visibleMotion=pose=>releasedMotions.includes(pose)?pose:'look';

export function rigView(direction) {
  const rearward=direction.startsWith('north');
  const side=direction!=='south'&&direction!=='north';
  const oblique=direction.length>5;
  return {rearward,side,oblique,mirror:direction.endsWith('west'),angle:rearward?3:side?oblique?1:2:0};
}

const hats = [
  {width:69,seat:-23,origin:[.5,.46,.43,.50],brim:true},
  {width:54,seat:-19,origin:[.5,.54,.53,.50],brim:false},
  {width:60,seat:-20,origin:[.5,.39,.36,.50],brim:true},
  {width:56,seat:-22,origin:[.56,.53,.51,.49],brim:false}
];

export function fitHat(hat,view,headWidth,headroom,assetBox){
  const style=hats[hat-1];
  const aspect=(assetBox[2]-assetBox[0])/(assetBox[3]-assetBox[1]);
  const seat=style.seat+(view.side?1:0)-(view.rearward?2:0);
  const width=style.width*Math.max(.88,Math.min(1.09,headWidth/53))*(view.rearward&&view.side?.93:1);
  const h=Math.min(width/aspect,Math.max(17,headroom+seat-4));
  const w=h*aspect;
  const x=-w*style.origin[view.angle]+(view.rearward&&view.side?-4:0);
  return {x,y:seat-h,w,h,seat,brim:style.brim,center:x+w*style.origin[view.angle]};
}

export function stride(phase,side){
  const cycle=(phase+(side===1?.5:0))%1;
  const air=cycle>=.55;
  const time=air?(cycle-.55)/.45:cycle/.55;
  return {x:(air?-1+2*time:1-2*time)*4.2,lift:air?4*Math.sin(Math.PI*time):0,angle:air?.26*Math.sin(Math.PI*time):.04*(time-.5)};
}
