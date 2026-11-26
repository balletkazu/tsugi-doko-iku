export const communityTabs = [
  ['all', 'みんなの旅'],
  ['following', 'フォロー中'],
  ['photos', '写真'],
  ['journals', '旅の日記'],
  ['booklets', '旅の栞']
];

export const reactionTypes = [
  // Keep the original three IDs stable for reactions saved in the first preview.
  [3, 'いいね'], [0, 'ありがとう'], [1, '行ってみたい'], [2, '参考になった'], [4, '旅してきたよ'], [5, 'すごい'], [6, '美味しそう']
];

export const editorial = { id: 'editors', name: '編集部のサンプル' };
export const homeFeature = 'kujukushima';
export const samplePosts = [
  {
    id:'forest-walk', kind:'journals', photoId:'heisenji', placeId:'heisenji', title:'森の音を覚えて帰る',
    intro:'杉の森で耳をすませる時間を、旅の日記に残す。', tags:['福井','森の散歩'],
    body:['森の入り口でスマートフォンを鞄に入れてみる。少し歩くと、水の音、枝が揺れる音、遠くの鳥の声。それまで静かだと思っていた森に、音が重なっていく。','帰ってから、その日の匂いや音も一緒に書き留めておこう。']
  },
  {
    id:'island-time', kind:'booklets', photoId:'ojika', placeId:'ojika', title:'小値賀島で半日の栞',
    intro:'港から集落へ。予定を詰め込まず、海辺で立ち止まる。', tags:['長崎','島の旅'],
    body:['小値賀島でゆっくり過ごす旅の構成例です。港の周辺を歩き、集落を散策して、気になった海辺へ戻る余白を残します。','渡航日が決まったら、往復の運航状況と利用する港を事業者の案内で確認します。'],
    stops:['港で帰りの便を確認する','集落を散策する','海辺でひと休みする']
  },
  {
    id:'mototaki-light', kind:'photos', photoId:'mototaki', placeId:'mototaki', title:'元滝伏流水に差す光',
    intro:'苔の緑と細く落ちる水に、森の光が重なる。', tags:['秋田','水辺'],
    body:['秋田県にかほ市の元滝伏流水。岩肌を流れる水と木漏れ日を収めた写真です。']
  },
  {
    id:'nyuto-note', kind:'journals', photoId:'nyuto', placeId:'nyuto', title:'温泉へ向かう道で',
    intro:'木々の色と、湯気の向こうに思い出したこと。', tags:['秋田','温泉'],
    body:['温泉の旅に出たら、湯に入る前と出た後で、同じ道の見え方が変わるかもしれません。今日いちばん覚えておきたい色を、日記の最後に一つ残してみます。']
  },
  {
    id:'kujukushima-view', kind:'photos', photoId:'kujukushima', title:'展海峰から眺める九十九島',
    intro:'佐世保の展海峰。海に浮かぶ小さな島々を、展望台から。', tags:['長崎','海のある風景'],
    body:['佐世保の展海峰から眺めた九十九島。濃い青の海に島々が浮かび、奥には海岸線が重なっています。撮影者と公開ライセンスは写真欄から確認できます。']
  },
  {
    id:'oga-booklet', kind:'booklets', photoId:'hachibodai', placeId:'hachibodai', title:'男鹿で、湖と海を眺める栞',
    intro:'八望台を目当てに、展望台で過ごす時間を決めておく。', tags:['秋田','展望台'],
    body:['男鹿半島の八望台へ行く旅の構成例です。二ノ目潟と戸賀湾を見渡す時間を旅程に入れておきます。','実際の移動手段や道路の状況は、旅の日程に合わせて自治体や交通事業者の情報で確認します。'],
    stops:['天候と周辺の交通情報を調べる','八望台で湖と海を見る','景色の変化を日記に残す']
  }
].map(post => ({...post, author:editorial, status:'sample', visibility:'public'}));

export function feedPosts(posts, tab, profile = {}) {
  return posts.filter(post => !profile.sampleMuted && !profile.sampleBlocked && post.status === 'sample' && post.visibility === 'public' && (
    tab === 'all' ||
    (tab === 'following' ? (profile.sampleFollows ?? []).includes(post.author.id) : post.kind === tab)
  ));
}

const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ja');

export function searchPosts(posts, query) {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return posts.filter(post=>terms.every(term=>{
    const tags = post.tags.map(normalize);
    if (term.startsWith('#')) return tags.includes(term.slice(1));
    return normalize([post.title,post.intro,...post.body,...post.tags].join(' ')).includes(term);
  }));
}
