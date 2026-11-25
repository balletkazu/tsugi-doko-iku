import { travelerTypes } from './data.js';
import { escapeHtml as e } from './core.js';
import { link, page } from './ui.js';

export const questions = [
  ['旅の朝、不思議な鍵をひとつ渡されました。どの扉を開ける？',[
    ['冒険家','海の向こうへ続く扉'],['ネイチャーラバー','水音がする森の扉'],['アーティスト','古い工房につながる扉'],['登山家','雲の上へ続く扉']]],
  ['夕方まで自由な時間ができたら？',[
    ['ネイチャーラバー','水辺に座って季節の音を聞く'],['アーティスト','小さなギャラリーに寄る'],['登山家','高台まで歩いて街を見渡す'],['冒険家','行き先を決めず、次に来た船に乗る']]],
  ['旅のお守りに、ひとつだけ持っていくなら？',[
    ['アーティスト','色を残せるスケッチ帳'],['登山家','よく馴染んだ靴'],['冒険家','書き込みのない地図'],['ネイチャーラバー','鳥や草花の小さな図鑑']]],
  ['夜、日記の最後に残したい一行は？',[
    ['登山家','あの坂の先の風が忘れられない'],['冒険家','次はあの道の続きを見てみたい'],['ネイチャーラバー','森と水の匂いを覚えていたい'],['アーティスト','あの街で出会った色を描いておこう']]]
];

export function travelerRanking(answers, savedThemeNames = []) {
  const score = new Map(travelerTypes.map(type=>[type.name,0]));
  answers.forEach((name,index)=>{
    if (questions[index]?.[1].some(([type])=>type===name)) score.set(name, score.get(name)+4);
  });
  for (const type of travelerTypes) {
    const matches = savedThemeNames.filter(theme=>type.themes.includes(theme)).length;
    score.set(type.name,score.get(type.name)+Math.min(matches,3));
  }
  return travelerTypes.map(type=>({...type,score:score.get(type.name)})).sort((a,b)=>b.score-a.score);
}

export function quizPage(profile, places) {
  const answers = profile.quiz ?? [];
  const consent = profile.quizSaved === true;
  const themes = consent ? places.filter(place=>(profile.saved ?? []).includes(place.id)).map(place=>place.theme) : [];
  const ranking = travelerRanking(answers,themes);
  const results = answers.length === questions.length ? `<section class="surface flow quiz-results"><h2>鏡に映った旅のかたち</h2>
    ${ranking.slice(0,2).map((type,index)=>`<div class="quiz-type"><small>${index===0?'いまのあなた':'もうひとつの一面'}</small><h3>${type.name}</h3><p>${type.description}</p></div>`).join('')}
    <p>次に試すなら、${ranking[2].description}。</p>${link('#discover','旅先を探す','arrow','button button-outline')}</section>` : '';
  return page('旅人の鏡','今日は、どんな旅人？',`<div class="flow">${results}<form id="quiz-form" class="surface flow">
    <p class="notice">遊びとして自分の旅を振り返る診断です。科学的な心理検査とは異なります。</p>
    ${questions.map(([question,choices],index)=>`<fieldset><legend>${e(question)}</legend><div class="options quiz-choices">
      ${choices.map(([type,label])=>`<label class="option"><input type="radio" name="q${index}" value="${type}" ${answers[index]===type?'checked':''} required><span class="chip">${e(label)}</span></label>`).join('')}</div></fieldset>`).join('')}
    <label class="check-row"><input type="checkbox" name="saved" ${consent?'checked':''}>保存した旅先のテーマも使う</label>
    <p class="muted">回答と、許可した場合の保存先のテーマだけをこの端末で使います。日記、写真、位置情報は使いません。</p>
    <div class="actions"><button class="button">診断して保存</button>${answers.length ? '<button class="button button-outline" type="button" data-action="reset-quiz">診断を消去</button>' : ''}${link('#my','旅の部屋へ','back','text-link')}</div></form></div>`,{narrow:true});
}
