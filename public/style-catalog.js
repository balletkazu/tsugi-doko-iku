export const styleGroups = {outdoor:'野山', town:'街歩き', japanese:'和装', coast:'海辺', home:'部屋着', winter:'冬', formal:'フォーマル', short:'短髪', medium:'ミディアム', long:'ロング・結び髪', curls:'くせ毛'};
const outfit = (id,name,groups,cell,sheet='garments') => ({id,name,groups,cell,sheet});
const rows = {
  hair:[
    ...[
      ['field-short','風に遊ぶショート','short'],['round-bob','丸いボブ','medium'],['two-braids','二つ編み','long'],['round-curls','くるくるカール','curls'],
      ['side-part','斜め分け','medium'],['high-bun','高いおだんご','long'],['short-undercut','短い刈り上げ','short'],['wolf-cut','ウルフカット','medium'],
      ['shoulder-bob','肩までのボブ','medium'],['ribbon-tie','リボンの低い結び髪','long'],['side-braid','片側の三つ編み','long'],['middle-part','真ん中分け','medium'],
      ['long-wave','ゆれるロング','long'],['pixie','はねるピクシー','short'],['double-bun','二つのおだんご','long'],['soft-ringlets','丸い短いカール','curls']
    ].map(([id,name,group],i)=>({id,name,groups:[group],sheet:'head-core',cell:i})),
    ...[
      ['buzz-cut','坊主','short'],['open-middle','短めのセンターパート','medium'],['two-block','ツーブロック','short'],['tight-fade','細かなカールの短髪','curls'],
      ['crew-cut','立ち上げたクルーカット','short'],['receding-wave','生え際の高いウェーブ','curls'],['short-drape','前髪を長めに流すショート','short'],['brush-back','後ろに流すショート','short']
    ].map(([id,name,group],i)=>({id,name,groups:[group],sheet:i<4?'head-cuts-a-v1':'head-cuts-b-v1',cell:(i%4)*4}))
  ],
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
    outfit('cotton-roomwear','木綿の部屋着',['home'],12,'wardrobe'),
    outfit('town-overshirt','街歩きのオーバーシャツ',['town'],0,'atelier-towns'),
    outfit('charcoal-tailoring','チャコールのジャケットスーツ',['formal','town'],4,'atelier-towns'),
    outfit('quilted-workwear','キルトの仕事着',['winter','outdoor'],8,'atelier-towns'),
    outfit('haori-hakama','藍の羽織と袴',['japanese','formal'],12,'atelier-towns')
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
    {id:'flower-hairpin',name:'花飾り'}, {id:'leaf-earrings',name:'イヤリング'}, {id:'river-pendant',name:'小さな石のネックレス'}
  ]
};
export const styles = Object.freeze(rows);
export const styleGroupNames=slot=>Object.entries(styleGroups).filter(([id])=>(styles[slot]??[]).some(item=>item.groups?.includes(id)));
const indices = Object.fromEntries(Object.entries(styles).map(([slot,items])=>{
  const ids=new Map(items.map((item,index)=>[item.id,index]));
  if(ids.size!==items.length)throw new Error('Duplicate style ID in '+slot);
  return [slot,ids];
}));
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
