export const styleGroups = {outdoor:'野山', town:'街歩き', japanese:'和装', coast:'海辺', home:'部屋着', winter:'冬'};
const outfit = (id,name,groups,cell,sheet='garments') => ({id,name,groups,cell,sheet});
const rows = {
  outfit:[
    outfit('field-jacket','旅の上着',['outdoor'],0),
    outfit('ochre-overcoat','山吹の作業着',['outdoor','town'],1),
    outfit('rain-poncho','雨のポンチョ',['outdoor'],4),
    outfit('summer-dress','夏のワンピース',['town','coast'],7),
    outfit('overalls','オーバーオール',['outdoor'],5),
    outfit('indigo-travel-robe','藍の旅着',['japanese'],2),
    outfit('knit-sweater','ニットのセーター',['home','winter'],3),
    outfit('winter-duffle','冬のダッフル',['winter'],6),
    outfit('town-cardigan','街角のカーディガン',['town'],0,'wardrobe'),
    outfit('coast-embroidered','海辺の刺しゅうシャツ',['coast'],4,'wardrobe'),
    outfit('long-town-coat','長い街歩きコート',['town','winter'],8,'wardrobe'),
    outfit('cotton-roomwear','木綿の部屋着',['home'],12,'wardrobe')
  ],
  hat:[
    {id:'none',name:'なし'}, {id:'straw-trail',name:'山歩き帽'},
    {id:'rib-knit',name:'ニット帽'}, {id:'indigo-cap',name:'キャップ'}, {id:'leaf-beret',name:'ベレー'}
  ],
  glasses:[
    {id:'none',name:'なし'}, {id:'round-frames',name:'丸眼鏡'}, {id:'square-frames',name:'角眼鏡'},
    {id:'gold-half-rim',name:'金縁のハーフリム'}, {id:'teal-oval',name:'青緑の楕円眼鏡'}
  ],
  shoes:[
    {id:'outfit-default',name:'服に合わせる'}, {id:'canvas-shoes',name:'帆布靴'},
    {id:'red-shoes',name:'赤い靴'}, {id:'rain-boots',name:'長靴'}
  ],
  bag:[
    {id:'none',name:'なし'}, {id:'leather-pack',name:'革のリュック'}, {id:'cloth-pack',name:'布のリュック'}
  ],
  accessory:[
    {id:'none',name:'なし'}, {id:'film-camera',name:'カメラ'}, {id:'knit-scarf',name:'スカーフ'},
    {id:'flower-hairpin',name:'花飾り'}, {id:'leaf-earrings',name:'イヤリング'}
  ]
};
export const styles = Object.freeze(rows);
const indices = Object.fromEntries(Object.entries(styles).map(([slot,items])=>[slot,new Map(items.map((item,index)=>[item.id,index]))]));
const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ja-JP').trim();
const searchIndex=Object.fromEntries(Object.entries(styles).map(([slot,items])=>[slot,items.map((item,value)=>({
  ...item,value,terms:normalize([item.name,...(item.groups??[]).map(key=>styleGroups[key])].join(' '))
}))]));
export function styleIndex(slot,input) {
  return indices[slot]?.get(input.styleIds?.[slot]) ?? input[slot];
}
export function styleIds(avatar) {
  return Object.fromEntries(Object.entries(styles).map(([slot,items])=>[slot,items[avatar[slot]].id]));
}
export function searchStyles(slot,query='',group='') {
  const keyword=normalize(query);
  return (searchIndex[slot]??[]).filter(item=>(!group||item.groups?.includes(group))&&item.terms.includes(keyword));
}
