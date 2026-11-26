// Allocate real device pixels for the dressing room without changing its CSS size.
export function fitPortrait(canvas){
  const {width,height}=canvas.getBoundingClientRect();
  if(!width||!height)return false;
  const ratio=Math.min(window.devicePixelRatio||1,3,768/Math.max(width,height));
  const w=Math.round(width*ratio),h=Math.round(height*ratio);
  if(canvas.width===w&&canvas.height===h)return false;
  canvas.width=w;canvas.height=h;
  return true;
}
