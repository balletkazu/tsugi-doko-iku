import {escapeHtml as e} from './core.js';
import {places} from './data.js';
import {questions,travelerRanking} from './traveler-quiz.js';

const types=['冒険家','ネイチャーラバー','アーティスト','登山家'];
const illustration=[4,5,6,7];
const newStories=[
  ['旅先に少し早く着いたら、まず何をする？','知らない路地へ出る','川辺で鳥を探す','看板の文字を眺める','見晴らしのいい坂を探す'],
  ['雨の朝、窓を開けると。','次の停留所へ行く','葉に落ちる雨音を聞く','古い喫茶店で絵を描く','雲が上がるまで山を見守る'],
  ['旅先から一枚だけ写真を送るなら？','港を出る船','露のたまった草','店先の工芸品','夜明けの稜線'],
  ['地図に印をひとつつけるなら？','地図の端の島','湿原の木道','昔の映画館','峠の展望台'],
  ['友達を案内するなら、どこに行く？','行き先は二人で決める','海が見える散歩道','職人の工房','お弁当を持って低い山へ'],
  ['帰りの列車まで一時間。最後に何を見る？','行っていない出口の先','日陰に咲く花','駅舎の古い意匠','遠くの山の色'],
  ['森の入口で拾った案内図。どこへ向かう？','図の外へ続く道をたずねる','大きな木のある沢','木彫りがある小屋','頂に向かう尾根道'],
  ['おみやげ箱に入れるなら？','島の船の絵はがき','森の鳥の小さな図鑑','土地の模様の布','山小屋で見た記念バッジ'],
  ['秋の日が暮れそう。どこで夕日を見る？','港の防波堤','池のそば','瓦屋根の続く町角','小さな峠'],
  ['一晩だけ泊まれるとしたら？','船の着く島の宿','水の音がする温泉宿','古い町家の宿','星の見える山小屋'],
  ['ふと聞いてみたい話は？','海の向こうから来た旅人の話','森を守る人の話','古い染め物の話','山の道を手入れする人の話'],
  ['次の休みは自由。どんな靴を選ぶ？','長い寄り道にも向く靴','草道をゆっくり歩く靴','石畳に馴染む靴','岩場を歩ける靴'],
  ['小さな祭りで、何に足を止める？','知らない地区の行列','川沿いの灯り','手で描いた飾り','丘から見える町の灯り'],
  ['初めての島で、誰に道を聞く？','港の船員','浜辺を散歩する人','器を焼く人','島の坂道に詳しい人'],
  ['旅の途中で一日だけ学ぶなら？','船の結び目','花の名前','草木染め','地形と天気の読み方'],
  ['旅のバッグに、あと一つ入るものは？','折りたたみの地図','小さな双眼鏡','色鉛筆の袋','山で飲む温かいお茶'],
  ['遠くの鐘が鳴りました。','音の方へ寄り道','川辺を歩きながら聴く','鐘の模様を見に行く','高い場所から耳を澄ます'],
  ['どの季節の旅を計画する？','初夏、島を結ぶ船','春、水辺に咲く花','秋、ギャラリーと街歩き','冬の雪を遠くに望む山道'],
  ['旅の途中に気持ちが落ち着く場所は？','何本も道が分かれる広場','水面に空が映る池','昼の静かな図書室','稜線を望む休憩所'],
  ['古い写真を一枚もらったら？','撮った場所を訪ねる','木々や季節を見分ける','写った建物を描き写す','背後にある山を調べる'],
  ['野外で食べるならどんな昼ごはん？','港のパンを船で','川辺でおにぎり','庭で職人の器に盛る','山の見える場所で温かい汁物'],
  ['帰ってから、次の旅のために残すものは？','寄り道の道順','水と風の匂いのメモ','見つけた模様のスケッチ','歩いた山道の高低差'],
  ['見たことのない色を探すなら？','入江の船の色','苔や木漏れ日の色','画材店の絵の具','夕焼けに変わる山の色'],
  ['朝の音を一つ持ち帰るとしたら？','港の短い汽笛','湿地の鳥の声','朝の市場の声','尾根を渡る風の音'],
  ['三日間、じっくり過ごすなら？','新しい港を巡る','同じ森の朝と夜を訪ねる','街の建築を描く','近くの山を少しずつ歩く'],
  ['次の旅で人に紹介したいのは？','便利な寄り道の方法','自然を静かに楽しむ場所','工芸の作り手','歩くときの休憩場所'],
  ['思い出の箱を開くと、何が入っている？','乗り物の切符','小さな押し葉','色と模様のメモ','山のかたちを写した写真'],
  ['旅の絵はがき、最後の一行は？','また知らない道へ','次の季節にもここへ','誰かにこの色を届けたい','次はあの稜線の向こうへ']
];
export const allQuestions=[...questions,...newStories.map(([q,...labels],i)=>[q,labels.map((label,j)=>[types[j],label]).sort((a,b)=>(types.indexOf(a[0])+i)%4-(types.indexOf(b[0])+i)%4)])];
const avatarBadge=name=>`<span aria-hidden="true" class="relic-tile relic-${illustration[types.indexOf(name)]}"></span>`;
const scene=`<div class="fortune-scene"><img src="./assets/world/fortune.webp" alt="月の見える丸窓と、ランプを灯して待つ占い師"></div>`;
export function fortunePage(){
  return `<section class="world fortune"><header class="dressing-header"><a href="#village" aria-label="街へ戻る">‹</a><h1>月灯りの占いの館</h1><a class="fortune-leave" href="#discover">旅先へ</a></header>${scene}<div data-fortune></div></section>`;
}
export function mountFortune(root,{profile,activityThemes,save}){
  const view=root.querySelector('[data-fortune]');if(!view)return;
  let answers=[],max=0,step=0,activity=!!profile.quizActivity,bookmarks=!!profile.quizSaved;
  let original=[...(profile.quiz??[])];
  const consent=()=>`<details class="fortune-consent"><summary>旅の記録を使うか選ぶ</summary><label><input type="checkbox" data-consent="saved" ${bookmarks?'checked':''}>保存した旅先のテーマを使う</label><label><input type="checkbox" data-consent="activity" ${activity?'checked':''}>自分で記録した体験の種類を使う</label><p>日記・写真・位置情報は使いません。</p></details>`;
  function welcome(){
    view.innerHTML=`<div class="fortune-letter"><small>占い師・灯（あかり）</small><h2>おかえりなさい、旅人さん。</h2><p>湖の水面に、あなたが好きな旅のかたちが映ります。気になる絵を選んで、旅の話を聞かせてください。</p><div class="world-actions"><button type="button" class="world-btn" data-length="10">短い話 · 10問</button><button type="button" class="world-btn alt" data-length="32">ゆっくり話す · 32問</button>${original.length?`<button type="button" class="world-text" data-fortune-action="review">前の結果を見る</button>`:''}</div><small>遊びの自己発見としてお楽しみください。</small></div>`;
  }
  function next(focus=false){
    if(step===max){result(false);return;}
    const [q,choices]=allQuestions[step];
    view.innerHTML=`<article class="fortune-letter"><div class="fortune-progress"><span>${step+1} / ${max}</span><progress value="${step+1}" max="${max}"></progress><button type="button" data-fortune-action="back" class="world-text">戻る</button></div><h2 tabindex="-1">${q}</h2>
      <div class="omen-choices">${choices.map(([type,label])=>`<button type="button" data-omen="${type}" ${answers[step]===type?'aria-pressed="true"':''}>${avatarBadge(type)}<span>${label}</span></button>`).join('')}</div></article>`;
    if(focus)view.querySelector('h2').focus({preventScroll:true});
  }
  function result(previous){
    const current=previous?original:answers.slice(0,max);
    const themes=[...(bookmarks?places.filter(p=>(profile.saved??[]).includes(p.id)).map(p=>p.theme):[]),...(activity?activityThemes:[])];
    const ranked=travelerRanking(current,themes,allQuestions);
    view.innerHTML=`<article class="fortune-letter"><small>灯からの手紙</small><h2 tabindex="-1">ふたつの旅のかたち</h2><div class="fortune-results">${ranked.slice(0,2).map(({name,description},i)=>`<section>${avatarBadge(name)}<small>${i?'もうひとつの一面':'いまのあなた'}</small><h3>${e(name)}</h3><p>${e(description)}</p></section>`).join('')}</div>${consent()}<div class="world-actions"><button type="button" class="world-btn" data-fortune-action="${previous?'save-previous':'save'}">この結果を旅の手帖に残す</button><button type="button" class="world-text" data-fortune-action="${previous?'leave':'back'}">戻る</button><button type="button" class="world-text" data-fortune-action="leave">もう一度はじめる</button></div>${previous?'<button type="button" class="world-text" data-fortune-action="forget">診断の記録を消す</button>':''}<p data-fortune-status role="status"></p></article>`;
    view.querySelector('h2').focus({preventScroll:true});
  }
  view.onclick=async event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.length){max=Number(b.dataset.length);answers=[];step=0;next(true);return;}
    if(b.dataset.omen){answers[step]=b.dataset.omen;step++;next(true);return;}
    const action=b.dataset.fortuneAction;
    if(action==='back'){if(step){step--;next(true);}else welcome();return;}
    if(action==='review'){result(true);return;}
    if(action==='leave'){step=0;max=0;answers=[];welcome();return;}
    if(!['save','save-previous','forget'].includes(action))return;
    b.disabled=true;
    try{
      if(action==='forget'){await save([],false,false);original=[];welcome();return;}
      const selection=action==='save'?answers.slice(0,max):original;
      await save(selection,bookmarks,activity);
      original=[...selection];
      view.querySelector('[data-fortune-status]').textContent='結果を旅の手帖に残しました。';
    }catch(error){view.querySelector('[data-fortune-status]').textContent=error.message;}
    finally{b.disabled=false;}
  };
  view.onchange=event=>{
    if(event.target.dataset.consent==='saved')bookmarks=event.target.checked;
    if(event.target.dataset.consent==='activity')activity=event.target.checked;
  };
  welcome();
}
