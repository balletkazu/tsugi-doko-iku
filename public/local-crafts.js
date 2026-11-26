// Location data is separate from the imaginative in-game illustration.
const records = [
  ['toyama-glass','水紋ガラスの飾り','富山県 富山市','JP-16','craft',
    ['富山市ガラス美術館','富山ガラス工房','ガラスの街とやま'],['art','tour','photo'],
    '富山市は制作・教育・展示を通じてガラス文化を育てています。','富山で出会ったガラスの透明感を、水紋のかたちで表した飾り。','https://www.city.toyama.lg.jp/bunka/bunka/1010544/1003019.html'],
  ['koyasan-pine','三鈷の松の小さな額','和歌山県 高野町','JP-30','tradition',
    ['高野山','金剛峯寺','壇上伽藍','三鈷の松'],['tour','nature','photo'],
    '壇上伽藍には三鈷の松があり、三本の葉にまつわる話が伝わっています。','三本の松葉を図案にした額。現地で採取せず、図案を持ち帰る記念品です。','https://www.koyasan.or.jp/meguru/'],
  ['izumo-bead','出雲の玉作をたどる置き玉','島根県 松江市 玉湯町','JP-32','tradition',
    ['出雲玉作跡','玉造温泉','古代出雲歴史博物館'],['tour','art','photo','spa'],
    '出雲玉作跡には、古代に玉類を作った工房の跡が残っています。','玉作の歴史を思い出せるよう、曲がった輪郭を小さな台に乗せた置き玉。','https://www.pref.shimane.lg.jp/life/bunka/bunkazai/shiseki/shisekidesu/shiseki06.html'],
  ['hakone-mosaic','木の色を重ねた小さな盆','神奈川県 箱根町','JP-14','craft',
    ['箱根寄木細工','箱根町畑宿','畑宿寄木会館'],['art','tour'],
    '箱根寄木細工は、さまざまな木の色や質を組み合わせて文様を作ります。','いくつかの木片で、旅の道が交わるような図案を作った小さな盆。','https://www.hakone.or.jp/yosegizaiku/about/'],
  ['echizen-paper','繊維を透かす和紙','福井県 越前市','JP-18','craft',
    ['越前和紙','越前和紙の里','紙の文化博物館','卯立の工芸館'],['art','tour'],
    '越前市の今立地域では、さまざまな紙を漉く技が伝えられています。','光にかざすと繊維の流れが見えるように描いた、旅のしおりにも添えられる紙。','https://www.city.echizen.lg.jp/office/060/050/k-03.html'],
  ['beppu-basket','手仕事の小さな竹かご','大分県 別府市','JP-44','craft',
    ['別府竹細工','別府市竹細工伝統産業会館'],['art','tour'],
    '別府竹細工では、竹を細いひごにして編む技術が受け継がれています。','庭で拾った思い出を入れておくための、創作の小さなかご。','https://takezaikudensankaikan.jp/'],
  ['takaoka-bell','澄んだ音をしのぶ銅の鈴','富山県 高岡市','JP-16','craft',
    ['高岡銅器','高岡市金屋町','高岡市デザイン・工芸センター'],['art','tour'],
    '高岡では鋳物の技が伝えられ、銅合金を使ったさまざまな品が作られています。','旅の静けさを思い出すための、実在の製品をもとにしない鈴。','https://suncenter.co.jp/takaoka/traditional/douki/'],
  ['kiso-lacquer','木地を残した漆の椀','長野県 塩尻市 木曽平沢','JP-20','craft',
    ['木曽漆器','木曽平沢','木曽漆器館'],['art','tour'],
    '木曽平沢では、椀や盆などの漆器づくりが伝えられてきました。','木地の形から塗りの重なりまで見てみたくなる、架空の椀。','https://www.city.shiojiri.lg.jp/site/shikki/index.html'],
  ['uji-tea','宇治の一服を思う茶碗','京都府 宇治市','JP-26','food',
    ['宇治茶','宇治の抹茶','対鳳庵'],['meal','cafe','tour'],
    '宇治市では茶の文化が育まれ、市営の茶室でもお茶に親しめます。','泡立てる前のお茶の色をヒントに作った、架空の茶碗。','https://www.city.uji.kyoto.jp/site/murasaki/7035.html']
];
export const localCrafts=Object.fromEntries(records.map(([id,name,place,pref,topic,aliases,themes,fact,story,source],art)=>[id,{
  name,place,pref,topic,aliases,themes,fact,story,source,art,sheet:'local-crafts',verified:'2026-11-26',
  lore:id==='koyasan-pine',wall:id==='koyasan-pine',wear:id==='toyama-glass',booklet:true
}]));
