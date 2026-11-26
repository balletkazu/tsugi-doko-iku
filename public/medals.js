function realStampCount(profile){
  const keys=new Set(Object.keys(profile.stamps??{}));
  for(const [key,entries] of Object.entries(profile.visits??{})){
    if(entries.some(entry=>entry.kind==='self'||entry.kind==='gps'))keys.add(key);
  }
  return keys.size;
}
const realEntries=game=>(game.entries??[]).filter(entry=>entry.source==='self-confirmed');
const activity=(...kinds)=>entry=>kinds.includes(entry.activity);
const recorded=predicate=>(_profile,_records,game)=>realEntries(game).some(predicate);
const nameMatches=pattern=>entry=>pattern.test(String(entry.place??'').normalize('NFKC').replace(/\s/g,''));
const island=nameMatches(/伊豆大島|小値賀|犬島|利尻島|礼文島|屋久島|奄美大島|佐渡島|与那国島/u);
const ravine=nameMatches(/渓谷|峡谷/u);

export const milestones=[
  {id:'first-stamp',name:'旅のはじまり',theme:'記録',detail:'スタンプを1個押す',qualifies:profile=>realStampCount(profile)>=1},
  {id:'three-stamps',name:'あちこち旅する人',theme:'記録',detail:'スタンプを3個押す',qualifies:profile=>realStampCount(profile)>=3},
  {id:'first-booklet',name:'小さな旅の支度',theme:'記録',detail:'旅のしおりを1冊保存する',qualifies:(_profile,records)=>(records.trips??[]).length>=1},
  {id:'mountain-path',name:'風を聴く登山者',theme:'自然',detail:'登山か山頂の体験を記録する',qualifies:recorded(activity('hike','peak'))},
  {id:'hot-spring-note',name:'湯けむり探訪',theme:'休息',detail:'温泉の体験を記録する',qualifies:recorded(activity('spa'))},
  {id:'valley-echo',name:'谷の音を拾う人',theme:'自然',detail:'渓谷や峡谷での体験を、地名とともに記録する',hidden:true,qualifies:recorded(ravine)},
  {id:'island-breeze',name:'島風の旅人',theme:'自然',detail:'図鑑の対象となる離島の旅を、地名とともに記録する',hidden:true,qualifies:recorded(island)},
  {id:'window-seat',name:'車窓の観察者',theme:'移動',detail:'電車で旅した体験を記録する',qualifies:recorded(activity('train'))},
  {id:'field-observer',name:'小さな自然の観察者',theme:'自然',detail:'自然観察の体験を記録する',qualifies:recorded(activity('nature'))},
  {id:'makers-story',name:'作り手の話を聴く人',theme:'文化',detail:'地域の工芸に触れた記念品を持ち帰る',hidden:true,qualifies:recorded(entry=>(entry.finds??[]).includes('nara-brush'))},
  {id:'light-on-the-page',name:'光の採集家',theme:'文化',detail:'風景を撮影した体験に、写真を添えて保存する',qualifies:recorded(entry=>entry.activity==='photo'&&!!entry.photo)},
  {id:'local-storyteller',name:'ふるさとの語り部',theme:'貢献',detail:'編集部が地域の提案を採用した記念',hidden:true,qualifies:()=>false},
  {id:'companion-memory',name:'旅を分かち合う人',theme:'おとも',detail:'旅を終えたおともから届いた記念',hidden:true,qualifies:()=>false}
];
const byId=new Map(milestones.map(medal=>[medal.id,medal]));
export const medalById=id=>byId.get(id);
export const medalEarned=(medal,profile,records,game)=>!!medal&&(
  (profile.medals??[]).includes(medal.id)||(game.earnedMedals??[]).includes(medal.id)||medal.qualifies(profile,records,game)
);
export function keepEarnedMedals(game,profile,records){
  const unlocked=milestones.filter(medal=>medalEarned(medal,profile,records,game)).map(medal=>medal.id);
  return {...game,earnedMedals:[...new Set([...(game.earnedMedals??[]),...unlocked])]};
}
export const selectedTitle=profile=>(profile.medals??[]).includes(profile.title)?medalById(profile.title)?.name??'':'';
