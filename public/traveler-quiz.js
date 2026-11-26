import { travelerTypes } from './data.js';

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

export function travelerRanking(answers, savedThemeNames = [], quizQuestions=questions) {
  const score = new Map(travelerTypes.map(type=>[type.name,0]));
  answers.forEach((name,index)=>{
    if (quizQuestions[index]?.[1].some(([type])=>type===name)) score.set(name, score.get(name)+4);
  });
  for (const type of travelerTypes) {
    const matches = savedThemeNames.filter(theme=>type.themes.includes(theme)).length;
    score.set(type.name,score.get(type.name)+Math.min(matches,3));
  }
  return travelerTypes.map(type=>({...type,score:score.get(type.name)})).sort((a,b)=>b.score-a.score);
}

