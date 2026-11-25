import outline from './data/japan-outline.js';
import { prefectures } from './world-data.js';

export function atlas(canvas,selected,choose) {
  const ctx=canvas.getContext('2d'), w=canvas.width, h=canvas.height;
  const coords=(lon,lat)=>[(lon-121.8)/(147.2-121.8)*w,(46.8-lat)/(46.8-23.6)*h];
  ctx.fillStyle='#b9d8cf';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#9ec8c1';ctx.lineWidth=1;
  for(let y=25;y<h;y+=37)for(let x=(y%5)*14;x<w;x+=96){ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+6,y+3,x+12,y);ctx.stroke();}
  for(const ring of outline){
    ctx.beginPath();ring.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](...coords(x,y)));ctx.closePath();
    ctx.fillStyle='#e1d5ac';ctx.strokeStyle='#6e9183';ctx.lineWidth=2.3;ctx.stroke();ctx.fill();
  }
  const glyph=(lon,lat,symbol)=>{
    const [x,y]=coords(lon,lat);ctx.save();ctx.translate(x,y);ctx.lineWidth=1.7;
    ctx.strokeStyle='#637b60';ctx.fillStyle='#95a57c';ctx.beginPath();
    if(symbol==='peak'){ctx.moveTo(-8,4);ctx.lineTo(-1,-5);ctx.lineTo(3,0);ctx.lineTo(6,-2);ctx.lineTo(11,4);ctx.closePath();ctx.fill();ctx.stroke();}
    if(symbol==='tree'){for(let i=0;i<3;i++){const a=i*5-5,b=(i%2)*3;ctx.fillRect(a,b,2,4);ctx.beginPath();ctx.moveTo(a-3,b);ctx.lineTo(a+1,b-7);ctx.lineTo(a+5,b);ctx.fill();}}
    if(symbol==='gate'){ctx.fillStyle='#af7253';ctx.fillRect(-5,-5,12,2);ctx.fillRect(-4,-1,10,2);ctx.fillRect(-3,-4,2,9);ctx.fillRect(3,-4,2,9);}
    ctx.restore();
  };
  [[142.8,43.6,'peak'],[143.5,43.2,'tree'],[141,40,'tree'],[139.9,39.2,'peak'],[138,36.2,'peak'],[138.7,35.4,'peak'],[135.9,34.2,'gate'],[133.4,35.2,'peak'],[133.3,33.8,'tree'],[131.1,32.9,'peak']].forEach(a=>glyph(...a));
  const markers=prefectures.map(p=>({...p,xy:coords(p.lon,p.lat)}));
  for(const p of markers){
    const [x,y]=p.xy;ctx.fillStyle='#83785b';ctx.fillRect(x-1,y-1,3,3);
    if(p.id===selected){ctx.strokeStyle='#f9f2d9';ctx.fillStyle='#af5c43';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff3cc';ctx.fillRect(x-1,y-1,2,2);}
  }
  ctx.fillStyle='#506f64';ctx.font='16px serif';ctx.fillText('日 本 海',w*.49,h*.30);ctx.fillText('太 平 洋',w*.66,h*.69);
  ctx.fillStyle='#54746b';ctx.font='14px serif';ctx.fillText('沖縄',w*.15,h*.91);ctx.fillText('N',26,30);
  ctx.beginPath();ctx.moveTo(31,34);ctx.lineTo(26,51);ctx.lineTo(31,47);ctx.lineTo(36,51);ctx.closePath();ctx.fill();
  canvas.onclick=event=>{
    const box=canvas.getBoundingClientRect(),x=(event.clientX-box.left)*w/box.width,y=(event.clientY-box.top)*h/box.height;
    const nearest=markers.map(p=>[p,Math.hypot(x-p.xy[0],y-p.xy[1])]).sort((a,b)=>a[1]-b[1])[0];
    if(nearest[1]<30)choose(nearest[0].id);
  };
}
export const tileCredit='<a target="_blank" rel="noopener noreferrer" href="https://maps.gsi.go.jp/development/ichiran.html">出典：国土地理院（地理院タイル）</a>';
export function practicalMarkup(label) {
  return `<div class="tile-widget"><canvas width="600" height="388" aria-label="${label}" role="img"></canvas>
    <div class="tile-bar"><div class="map-keys"><button type="button" data-zoom="1" aria-label="地図を拡大">＋</button><button type="button" data-zoom="-1" aria-label="地図を縮小">−</button><button type="button" data-center>中心に戻る</button></div>${tileCredit}</div><small data-tile-status role="status"></small></div>`;
}
const mercator=([lat,lon],z)=>{const s=256*2**z,r=Math.sin(lat*Math.PI/180);return [(lon+180)/360*s,(.5-Math.log((1+r)/(1-r))/(4*Math.PI))*s];};
export function practicalMap(el,center,{legs=[],zoom=11,fit=false}={}) {
  const canvas=el.querySelector('canvas'),ctx=canvas.getContext('2d'),memo=new Map();
  const w=canvas.width,h=canvas.height, points=legs.flatMap(l=>l.coords);
  if(fit && points.length){
    const bounds=points.reduce(([s,west,n,e],[lat,lon])=>[Math.min(s,lat),Math.min(west,lon),Math.max(n,lat),Math.max(e,lon)],[90,180,-90,-180]);
    center=[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2];
    for(zoom=16;zoom>5;zoom--){const a=mercator(bounds.slice(0,2),zoom),b=mercator(bounds.slice(2),zoom);if(Math.abs(b[0]-a[0])<w-95&&Math.abs(b[1]-a[1])<h-80)break;}
  }
  const initialZoom=zoom;let focus=mercator(center,zoom), pointer,done=false,queued=false;
  const status=el.querySelector('[data-tile-status]');
  function redraw(){if(done||queued)return;queued=true;requestAnimationFrame(()=>{queued=false;if(!done)draw();});}
  function draw(){
    const left=focus[0]-w/2,top=focus[1]-h/2;
    ctx.fillStyle='#e9eada';ctx.fillRect(0,0,w,h);let failed=false;
    for(let x=Math.floor(left/256);x<=Math.floor((left+w)/256);x++)for(let y=Math.floor(top/256);y<=Math.floor((top+h)/256);y++){
      const key=`${zoom}/${x}/${y}`;
      if(!memo.has(key)){
        const img=new Image();memo.set(key,img);
        img.onload=img.onerror=redraw;img.referrerPolicy='no-referrer';
        img.src=`https://cyberjapandata.gsi.go.jp/xyz/pale/${key}.png`;
        if(memo.size>72)memo.delete(memo.keys().next().value);
      }
      const img=memo.get(key);if(img.complete&&img.naturalWidth)ctx.drawImage(img,Math.round(256*x-left),Math.round(256*y-top));
      else if(img.complete)failed=true;
    }
    status.textContent=failed?'背景地図を読み込めません。通信環境をご確認ください。':'';
    const pos=p=>{const [x,y]=mercator(p,zoom);return [x-left,y-top];};
    for(const leg of legs){if(!leg.coords.length)continue;if(leg.mode==='point'){const [x,y]=pos(leg.coords[0]);ctx.fillStyle='#386947';ctx.fillRect(x-3,y-3,6,6);continue;}ctx.strokeStyle={bus:'#b55738',tram:'#285c83',rail:'#285c83',boat:'#765992',walk:'#386947'}[leg.mode];ctx.lineWidth=4;ctx.lineJoin='round';ctx.setLineDash(leg.mode==='walk'?[4,5]:[]);ctx.beginPath();leg.coords.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...pos(p)));ctx.stroke();}
    ctx.setLineDash([]);const marks=points.length?[points[0],points.at(-1)]:[center];
    marks.forEach((p,i)=>{const [x,y]=pos(p);ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fillStyle=i?'#aa543b':'#396353';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();});
  }
  el.onclick=e=>{const btn=e.target.closest('button');if(!btn)return;if(btn.hasAttribute('data-center')){zoom=initialZoom;focus=mercator(center,zoom);}else{const next=Math.min(17,Math.max(5,zoom+Number(btn.dataset.zoom)));focus=focus.map(x=>x*2**(next-zoom));zoom=next;}draw();};
  canvas.onpointerdown=e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(pointer?.id!==e.pointerId)return;const box=canvas.getBoundingClientRect();focus[0]-=(e.clientX-pointer.x)*w/box.width;focus[1]-=(e.clientY-pointer.y)*h/box.height;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};redraw();};
  canvas.onlostpointercapture=()=>{pointer=null;};
  draw();return ()=>{done=true;for(const img of memo.values()){img.onload=img.onerror=null;}memo.clear();};
}
