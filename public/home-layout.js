import {items,inventory} from './world-data.js';
import {regionalItems} from './regional-data.js';

// Each footprint is measured in tiles. Furniture artwork is drawn above the occupied floor tiles.
export const furnishings={
  bed:{name:'窓辺のベッド',art:0,w:2,h:3,pose:'sleep',line:'毛布にくるまって、ひと休み。'},
  shelf:{name:'木の本棚',art:1,w:2,h:1,pose:'read',line:'旅の本をめくりました。'},
  tea:{name:'お茶のテーブル',art:2,w:2,h:2,pose:'drink',line:'あたたかいお茶をどうぞ。'},
  chair:{name:'森色の椅子',art:3,w:1,h:1,pose:'sit',line:'ゆっくり腰かけました。'},
  plant:{name:'窓辺の鉢植え',art:4,w:1,h:1},fern:{name:'シダの鉢',art:4,w:1,h:1},
  rug:{name:'夕焼けの織物',art:5,w:2,h:2,flat:true},lamp:{name:'山小屋のランプ',art:6,w:1,h:1},
  lantern:{name:'星あかりの灯籠',art:6,w:1,h:1},bench:{name:'庭のベンチ',art:7,w:2,h:1,pose:'sit',line:'庭を眺めて、ひと休み。'},
  pond:{name:'睡蓮の小池',art:8,w:2,h:2,outside:true},greenhouse:{name:'小さな温室',art:9,w:2,h:2,outside:true},
  stream:{name:'石を並べた小川',art:10,w:3,h:1,outside:true}
};
const starters=['bed','shelf','tea','chair','plant','rug','bench','pond','greenhouse','stream','lamp'];
export const homeAreas={
  room:{name:'居間',width:9,height:7,arrival:[4,6],outside:false},
  garden:{name:'庭',width:12,height:9,arrival:[5,0],outside:true},
  studio:{name:'小さな離れ',width:9,height:7,arrival:[4,6],outside:false,addition:true},
  orchard:{name:'奥の庭',width:12,height:9,arrival:[5,0],outside:true,addition:true}
};
export const coverings={
  walls:[['クリーム',null],['黄昏','#b77853'],['若葉','#819764'],['白樺','#b5bcb0']],
  floor:[['蜂蜜の板張り',null],['胡桃','#714438'],['白木','#d8c7aa'],['青緑','#70918a']],
  window:[['丸窓','round'],['小窓','square'],['なし',null]],
  light:[['昼の光',null],['夕方の光','#df9e44'],['ランプの灯','#65607c']],
  roof:[['赤瓦',null],['藍','#526b82'],['苔色','#6f8358']],
  siding:[['板壁',null],['白壁','#e3d3b7'],['山小屋','#82563f']],
  ground:[['草花の庭',null],['春の庭','#b49e72'],['木陰の庭','#6b8e71']]
};
const available={
  room:['walls','floor','window','light'],studio:['walls','floor','window','light'],
  garden:['roof','siding','ground','light'],orchard:['roof','siding','ground','light']
};
export const coveringsFor=area=>available[area];
export const furniture=id=>Object.hasOwn(furnishings,id)?furnishings[id]:Object.hasOwn(regionalItems,id)?
  {name:regionalItems[id].name,art:regionalItems[id].art,icon:regionalItems[id].icon,w:1,h:1}:
  Object.hasOwn(items,id)?{name:items[id],w:1,h:1}:null;
export const homeStock=game=>[...new Set([...starters,...inventory(game),...(game.localFinds??[])])];
export function readHome(game){
  if(game.homestead)return game.homestead;
  const room=[
    {id:'starter-bed',kind:'bed',x:6,y:0,r:0},
    {id:'starter-shelf',kind:'shelf',x:1,y:0,r:0},
    {id:'starter-tea',kind:'tea',x:5,y:4,r:0},
    {id:'starter-fern',kind:'plant',x:1,y:4,r:0}
  ];
  for(const [i,kind] of (game.slots??[]).entries()){
    if(kind&&kind!=='plant'&&furniture(kind))room.push({id:'old-slot-'+i,kind,x:i+1,y:2,r:0});
  }
  return {revision:0,items:{room,garden:[],studio:[],orchard:[]},styles:{},additions:[],wallPhoto:game.wallPhoto??null};
}
export function footprint(item){
  const {w,h}=furniture(item.kind);
  return item.r%2?[h,w]:[w,h];
}
export function canPlace(area,placed,item){
  const spec=homeAreas[area],model=furniture(item.kind);
  if(!spec||!model||model.outside&&!spec.outside||![item.x,item.y,item.r].every(Number.isInteger)||item.r<0||item.r>3)return false;
  const [w,h]=footprint(item);
  if(item.x<0||item.y<0||item.x+w>spec.width||item.y+h>spec.height)return false;
  if(!model.flat&&covers(item,spec.arrival[0],spec.arrival[1]))return false;
  return placed.every(other=>{
    if(other.id===item.id||!!model.flat!==!!furniture(other.kind).flat)return true;
    const [ow,oh]=footprint(other);
    return item.x+w<=other.x||other.x+ow<=item.x||item.y+h<=other.y||other.y+oh<=item.y;
  });
}
function covers(item,x,y){
  const [w,h]=footprint(item);
  return x>=item.x&&x<item.x+w&&y>=item.y&&y<item.y+h;
}
export function homePath(area,placed,from,destinations){
  const {width,height}=homeAreas[area];
  const blocks=placed.filter(item=>!furniture(item.kind).flat);
  const valid=(x,y)=>x>=0&&y>=0&&x<width&&y<height&&!blocks.some(item=>covers(item,x,y));
  const targets=new Set(destinations.filter(([x,y])=>valid(x,y)).map(([x,y])=>y*width+x));
  if(!targets.size)return null;
  const start=from[1]*width+from[0],queue=[start],parent=new Map([[start,null]]);
  for(let i=0;i<queue.length;i++){
    const key=queue[i],x=key%width,y=Math.floor(key/width);
    if(targets.has(key)){
      const path=[];
      for(let k=key;k!==start;k=parent.get(k))path.unshift([k%width,Math.floor(k/width)]);
      return path;
    }
    for(const [cx,cy] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
      const next=cy*width+cx;
      if(valid(cx,cy)&&!parent.has(next)){parent.set(next,key);queue.push(next);}
    }
  }
  return null;
}
export function around(item){
  const [w,h]=footprint(item),result=[];
  for(let x=item.x;x<item.x+w;x++)result.push([x,item.y+h],[x,item.y-1]);
  for(let y=item.y;y<item.y+h;y++)result.push([item.x+w,y],[item.x-1,y]);
  return result;
}
export function validateHome(game,candidate){
  const stock=homeStock(game);
  if(candidate.wallPhoto&&!(game.entries??[]).some(entry=>entry.id===candidate.wallPhoto&&entry.photo))candidate={...candidate,wallPhoto:null};
  const ids=new Set(),stockInUse=new Set();
  for(const [area] of Object.entries(homeAreas)){
    const row=candidate.items[area]??[];
    for(const item of row){
      if(ids.has(item.id)||stockInUse.has(item.kind)||!stock.includes(item.kind)||!canPlace(area,row,item))throw new Error('置き場所を確認してください。');
      ids.add(item.id);stockInUse.add(item.kind);
    }
  }
  return candidate;
}
