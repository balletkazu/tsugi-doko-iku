// Geographical facts and sources only. All keepsake names and artwork are original.
export const regionalItems={
  'himi-buri':{name:'寒ブリの木彫り',place:'富山県 氷見市',aliases:['氷見'],pref:'JP-16',themes:['meal'],icon:'fish',source:'https://himi-teichiami.com/teichiami',story:'冬の富山湾と氷見の寒ブリを、手のひらに乗る木彫りに。'},
  'oma-tuna':{name:'大間のマグロの置物',place:'青森県 大間町',aliases:['大間'],pref:'JP-02',themes:['meal'],icon:'tuna',source:'https://oma-wide.net/oomatuna/',story:'津軽海峡でマグロ漁が営まれる大間。濃い藍の背と銀色の腹を、小さな置物にしました。'},
  'nose-star':{name:'北極星のランタン',place:'大阪府・兵庫県 能勢妙見山',aliases:['能勢妙見山','能勢の妙見山'],pref:['JP-27','JP-28'],themes:['hike','tour'],art:15,source:'https://www.myoken.org/omen/',story:'北極星と結びつく妙見信仰から着想を得た、小さな星窓の灯りです。'},
  'miwa-snake':{name:'三輪の白蛇の置物',place:'奈良県 桜井市・大神神社',aliases:['大神神社','三輪山'],pref:'JP-29',themes:['tour','walk'],icon:'snake',source:'https://oomiwa.or.jp/keidaimap/04-minokamisugi/',story:'三輪で大切にされてきた蛇の伝承を、小さな白い陶の形に。'},
  'inaba-rabbit':{name:'因幡の白兎の木彫り',place:'鳥取県 鳥取市・白兎海岸',aliases:['白兎海岸','白兎神社'],pref:'JP-31',themes:['beach','tour','photo'],icon:'rabbit',source:'https://www.torican.jp/spot/detail_1066.html',story:'海辺に伝わる因幡の白兎の物語から、耳の長い小さな木彫りを作りました。'},
  'itoigawa-jade':{name:'翡翠の標本',place:'新潟県 糸魚川市',aliases:['糸魚川'],pref:'JP-15',themes:['beach','tour','photo'],art:12,source:'https://www.itoigawa-kanko.net/spot/fossamagna_museum/',story:'糸魚川の翡翠文化にちなむ緑の標本。現地での採取を条件にはしていません。'},
  'tateyama-bird':{name:'雷鳥の小さな彫刻',place:'富山県 立山',aliases:['立山','室堂'],pref:'JP-16',themes:['hike','peak','photo'],art:13,source:'https://www.pref.toyama.jp/1709/kurashi/kankyoushizen/shizen/raichou/kj00017342.html',story:'立山の高山帯に暮らすライチョウ。羽の模様を木の彫刻に写しました。'},
  'heisenji-moss':{name:'苔のテラリウム',place:'福井県 勝山市・平泉寺白山神社',aliases:['平泉寺','平泉寺白山神社'],pref:'JP-18',themes:['tour','photo','walk'],art:14,source:'https://heisenji.jp/',story:'平泉寺の境内に広がる苔の光景を、ガラスの中に描いたものです。'}
};
export const activityEvents={
  hike:['稜線で深呼吸','風がひんやり。稜線から遠くの山が見えました。','climb'],
  peak:['山頂からの便り','ここまで歩いてきた道が、小さく見えます。','joy'],
  meal:['ひと口の思い出','最初のひと口を、旅の手帖に残しました。','eat'],
  cafe:['窓辺の一杯','カップから、ひと息ぶんの湯気。','drink'],
  play:['遊びに夢中','遊んだ時間も、旅の大切な一頁。','joy'],
  resort:['木陰でのんびり','今日は、急がずに風の音を聞いていました。','sit'],
  train:['車窓のひとこま','車窓の風景が次々と流れていきます。','look'],
  photo:['光をひとつ','その瞬間を、写真と一緒に持ち帰ります。','photo'],
  spa:['湯けむり日和','温かな湯気で、肩の力がふっと抜けました。','sit'],
  art:['色を集める日','記憶に残った色をひとつ、手帖に。','read']
};
export function keepsakesFor(entry){
  const place=String(entry.place??'').normalize('NFKC').replace(/\s/g,'');
  return Object.entries(regionalItems).filter(([,item])=>[item.pref].flat().includes(entry.pref)&&
    item.aliases.some(alias=>place.includes(alias))&&(!item.themes||item.themes.includes(entry.activity))).map(([id])=>id);
}

export function eventFor(activity,interest){
  const scene=activityEvents[activity];
  if(!scene)return null;
  const hints={
    '冒険家':'手帖の端に、次に寄ってみたい場所をひとつ。',
    'ネイチャーラバー':'風や水の音を、少しだけ思い出してみる。',
    'アーティスト':'今日見つけた色を、手帖の隅にひとつ。',
    '登山家':'来た道と、これから歩く道を見渡す。'
  };
  return [...scene,hints[interest]??''];
}
