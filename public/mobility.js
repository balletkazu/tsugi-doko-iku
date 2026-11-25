// Public route shapes are only evidence. Parallel roads and rails remain ambiguous.
function meters(a,b){
  return Math.hypot((a[0]-b[0])*111200,(a[1]-b[1])*111200*Math.cos(a[0]*Math.PI/180));
}
function nearLine(point,line,tolerance){
  return line.some((b,i)=>{
    if(!i)return false;
    const a=line[i-1],s=Math.cos(point[0]*Math.PI/180);
    const dy=b[0]-a[0],dx=(b[1]-a[1])*s;
    const length=dy*dy+dx*dx;
    const offset=length?Math.max(0,Math.min(1,((point[0]-a[0])*dy+(point[1]-a[1])*s*dx)/length)):0;
    return meters(point,[a[0]+(b[0]-a[0])*offset,a[1]+(b[1]-a[1])*offset])<tolerance;
  });
}
export function nearbyTransport(samples,network){
  if(!network||samples.length<3)return [];
  const series=samples.slice(-3);
  if(series.some(x=>!Number.isFinite(x.accuracy)||x.accuracy>45))return [];
  const coords=series.map(x=>[x.lat,x.lon]);
  if(meters(coords[0],coords.at(-1))<140)return [];
  return ['train','bus'].filter(mode=>network[mode].some(line=>coords.every(p=>nearLine(p,line,48))));
}
export async function toyamaMobility(){
  const [{default:s},{default:g}]=await Promise.all([import('./data/toyama-schedule.js'),import('./data/toyama-geometry.js')]);
  if(s.pointHash!==g.pointHash)return null;
  const lines={train:new Set(),bus:new Set()};
  for(const [pattern,,,alignment] of s.journeys){
    if(!Number.isInteger(alignment))continue;
    const mode=s.routes[s.patterns[pattern][0]][2]==='bus'?'bus':'train';
    lines[mode].add(g.alignments[alignment][0]);
  }
  return Object.fromEntries(Object.entries(lines).map(([key,v])=>[key,[...v].map(i=>g.lines[i])]));
}
