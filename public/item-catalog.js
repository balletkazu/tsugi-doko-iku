import {regionalItems,regionalTopic} from './regional-data.js';

const commonItems = {plant:'窓辺の鉢植え',books:'積み重ねた本',leaf:'押し葉の標本',shell:'貝殻の標本',wheel:'車輪の置物',ticket:'乗車券の額',wing:'翼の模型',stone:'山石の標本',bowl:'旅の小鉢',lamp:'山小屋のランプ',cup:'陶器のカップ',frame:'小さな写真額',drop:'雨粒の風鈴',snow:'雪の結晶飾り',fern:'シダの鉢',teaset:'藍染めの茶器',lantern:'星あかりの灯籠',brooch:'朝露のブローチ',rug:'夕焼けの織物'};
// Each footprint is measured in tiles. Furniture artwork is drawn above the occupied floor tiles.
const furnishings={
  bed:{name:'窓辺のベッド',art:0,w:2,h:3,pose:'look',line:'ベッドのそばで、ひと休み。'},
  shelf:{name:'木の本棚',art:1,w:2,h:1,pose:'read',line:'旅の本をめくりました。'},
  tea:{name:'お茶のテーブル',art:2,w:2,h:2,pose:'look',line:'お茶のテーブルで、ひと息。'},
  chair:{name:'森色の椅子',art:3,w:1,h:1,pose:'look',line:'椅子のそばで、ひと休み。'},
  plant:{name:'窓辺の鉢植え',art:4,w:1,h:1},fern:{name:'シダの鉢',art:4,w:1,h:1},
  rug:{name:'夕焼けの織物',art:5,w:2,h:2,flat:true},lamp:{name:'山小屋のランプ',art:6,w:1,h:1},
  lantern:{name:'星あかりの灯籠',art:6,w:1,h:1},bench:{name:'庭のベンチ',art:7,w:2,h:1,pose:'look',line:'庭を眺めて、ひと休み。'},
  pond:{name:'睡蓮の小池',art:8,w:2,h:2,outside:true,groundArt:true},greenhouse:{name:'小さな温室',art:9,w:2,h:2,outside:true},
  stream:{name:'石を並べた小川',art:10,w:3,h:1,outside:true,groundArt:true},
  'oak-desk':{name:'オークの旅机',sheet:'home-crafts',art:0,w:2,h:1,scale:1.65,pose:'read',line:'旅先のことを手帖で振り返りました。'},
  'rocking-chair':{name:'木のロッキングチェア',sheet:'home-crafts',art:1,w:1,h:1,scale:1.11,pose:'look',line:'椅子のそばで、少しひと休み。'},
  'potted-hydrangea':{name:'あじさいの鉢',sheet:'home-crafts',art:2,w:1,h:1,scale:.93,outside:true},
  'cedar-birdbath':{name:'庭の小さな水鉢',sheet:'home-crafts',art:3,w:1,h:1,scale:.8,outside:true}
};

export const relicIcons = {fish:0,tuna:1,snake:2,rabbit:3};
export const collectionCategories = {regional:'ご当地',objects:'家具・道具',garden:'植物・庭',memory:'思い出'};
const garden = new Set(['plant','fern','bench','pond','greenhouse','stream','lantern','potted-hydrangea','cedar-birdbath']);
const objects = new Set([...Object.keys(furnishings), 'books','teaset','cup','frame']);
const olderWearables = new Set(Object.keys(commonItems).filter(id=>id!=='plant'&&id!=='books'));
const entries = Object.entries({...commonItems,...Object.fromEntries(Object.entries(furnishings).map(([id,model])=>[id,model.name]))})
  .map(([id,name])=>[id,{id,name,category:garden.has(id)?'garden':objects.has(id)?'objects':'memory',
    wear:olderWearables.has(id),placement:{name,w:1,h:1,wall:id==='frame'||id==='ticket',...furnishings[id]}}]);
for(const [id,item] of Object.entries(regionalItems)){
  entries.push([id,{id,...item,topic:regionalTopic(id),category:'regional',wear:!!item.wear,
    placement:{name:item.name,art:item.art,sheet:item.sheet,icon:item.icon,wall:!!item.wall,scale:item.wall?.93:.72,w:1,h:1}}]);
}
export const collection = new Map(entries);
if(collection.size!==entries.length)throw new Error('Duplicate collection ID');
export const collectionItem = id=>collection.get(id);
export const itemNames = Object.fromEntries(entries.map(([id,item])=>[id,item.name]));
const normalize = text=>text.normalize('NFKC').toLocaleLowerCase('ja-JP').trim();
const terms = new Map(entries.map(([id,item])=>[id,normalize([item.name,item.place,...(item.aliases??[])].filter(Boolean).join(' '))]));
const shelves = new Map(Object.keys(collectionCategories).map(category=>[category,entries.flatMap(([,item])=>item.category===category?[item]:[])]));
export function searchCollection(category,query='',topic=''){
  const keyword=normalize(query);
  return (category?shelves.get(category)??[]:[...collection.values()]).filter(item=>(!topic||item.topic===topic)&&terms.get(item.id).includes(keyword));
}
