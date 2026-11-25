export const themes = ['自然', '海・島', '文化・アート', '山', '温泉'];
// Coordinates are indicative map pins for discovery. They are never used as route geometry.
export const places = [
  { id:'mototaki', name:'元滝伏流水', region:'秋田県', theme:'自然', photoId:'mototaki', lat:39.197, lng:139.914, intro:'苔むす森を抜けると、岩肌から幾筋もの水が流れ出します。耳を澄ませたくなる、鳥海山のふもとの風景です。', source:'https://www.city.nikaho.akita.jp/' },
  { id:'ojika', name:'小値賀島', region:'長崎県', theme:'海・島', photoId:'ojika', lat:33.195, lng:129.066, intro:'五島列島の北に浮かぶ島。集落を歩き、海を眺め、島の時間に合わせて過ごす旅へ。', source:'https://ojikajima.jp/' },
  { id:'heisenji', name:'平泉寺白山神社', region:'福井県', theme:'文化・アート', photoId:'heisenji', lat:36.034, lng:136.544, intro:'杉木立の中に苔のじゅうたんが広がる場所。石畳をたどりながら、白山の歴史に触れられます。', source:'https://heisenji.jp/' },
  { id:'akanishi', name:'赤西渓谷', region:'兵庫県', theme:'自然', lat:35.232, lng:134.563, intro:'宍粟の山あいにある渓谷。水の音を聞きながら、季節ごとに変わる森の表情を楽しめます。', source:'https://www.city.shiso.lg.jp/' },
  { id:'inujima', name:'犬島', region:'岡山県', theme:'文化・アート', photoId:'inujima', lat:34.564, lng:134.100, intro:'瀬戸内海の小さな島。産業の記憶が残る風景の中で、建築や現代アートに出会えます。', source:'https://benesse-artsite.jp/art/seirensho.html' },
  { id:'tatsukushi', name:'竜串海岸', region:'高知県', theme:'海・島', photoId:'tatsukushi', lat:32.785, lng:132.864, intro:'土佐清水の海岸。海に向かって続く、波や風が刻んだ岩の模様を眺められます。', source:'https://www.city.tosashimizu.kochi.jp/' },
  { id:'chokai', name:'鳥海山', region:'秋田県・山形県', theme:'山', photoId:'chokai', lat:39.099, lng:140.049, intro:'秋田と山形にまたがる山。山頂を目指す旅のほかに、ふもとから山並みを望む旅もあります。', source:'https://www.env.go.jp/park/' },
  { id:'nyuto', name:'乳頭温泉郷', region:'秋田県', theme:'温泉', photoId:'nyuto', lat:39.806, lng:140.799, intro:'田沢湖の北東の山あいに点在する温泉郷。森のそばで、静かにひと息つく旅へ。', source:'https://www.nyuto-onsenkyo.com/' },
  { id:'hachibodai', name:'八望台', region:'秋田県', theme:'自然', photoId:'hachibodai', lat:39.953, lng:139.724, intro:'男鹿半島の展望地。海と火口湖の重なる地形に、半島の成り立ちが感じられます。', source:'https://www.city.oga.akita.jp/' }
];

export const travelerTypes = [
  { name:'冒険家', themes:['海・島','山'], description:'小さな島や見晴らしのいい場所へ' },
  { name:'ネイチャーラバー', themes:['自然','温泉'], description:'水辺や森でゆっくり過ごす' },
  { name:'アーティスト', themes:['文化・アート'], description:'歴史、建築、アートに出会う' },
  { name:'登山家', themes:['山','自然'], description:'山の風景やふもとの道を楽しむ' }
];

const prefectures = '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
export const collections = [
  { id:'prefecture', name:'都道府県', complete:true, items:prefectures.map((name,index)=>({id:`JP-${String(index+1).padStart(2,'0')}`, name})) },
  { id:'national-park', name:'国立公園', items:[{id:'nikko', name:'日光国立公園'},{id:'fuji-hakone-izu', name:'富士箱根伊豆国立公園'},{id:'setonaikai',name:'瀬戸内海国立公園'}] },
  { id:'world-heritage', name:'世界遺産', items:[{id:'yakushima',name:'屋久島'},{id:'shirakawago',name:'白川郷・五箇山の合掌造り集落'},{id:'himeji',name:'姫路城'}] },
  { id:'mountain-100', name:'日本百名山', items:[{id:'fuji',name:'富士山'},{id:'chokai',name:'鳥海山'},{id:'tsukuba',name:'筑波山'}] },
  { id:'unesco-geopark', name:'世界ジオパーク', items:[{id:'itoigawa',name:'糸魚川ユネスコ世界ジオパーク'},{id:'izu',name:'伊豆半島ユネスコ世界ジオパーク'},{id:'muroto',name:'室戸ユネスコ世界ジオパーク'}] }
].map(collection=>({...collection, country:'JP'}));
