import {escapeHtml as e} from './core.js';
import {relicIcons,collectionCategories,searchCollection} from './item-catalog.js';
import {homeStock} from './home-layout.js';
import {regionalTopics} from './regional-data.js';
import {activities} from './world-data.js';
export function relicArt(item){
  if(item.sheet==='local-crafts'||item.sheet==='home-crafts')return `<span class="collection-tile ${item.sheet} collection-cell-${item.art}" aria-hidden="true"></span>`;
  if(item.sheet==='regional-objects')return `<span class="regional-tile regional-${item.art}" aria-hidden="true"></span>`;
  return Number.isInteger(item.art)?`<span class="furniture-tile furniture-${item.art}" aria-hidden="true"></span>`:
    `<span class="relic-tile relic-${relicIcons[item.icon]}" aria-hidden="true"></span>`;
}
export function cabinetScreen(game,params){
  const found=new Set(homeStock(game));
  const filter=(params.get('q')??'').slice(0,50).trim();
  const category=Object.hasOwn(collectionCategories,params.get('kind'))?params.get('kind'):'regional';
  const topic=category==='regional'&&Object.hasOwn(regionalTopics,params.get('topic'))?params.get('topic'):'';
  const matching=searchCollection(category,filter,topic);
  const regional=searchCollection('regional');
  const pageSize=12,offset=Math.min(Math.max(0,Number.parseInt(params.get('p'),10)||0)*pageSize,Math.max(0,Math.ceil(matching.length/pageSize)-1)*pageSize);
  const pages=(p,label)=>`<a class="world-text" href="#cabinet?${e(new URLSearchParams({kind:category,topic,q:filter,p}))}">${label}</a>`;
  const shelves=matching.slice(offset,offset+pageSize);
  const drafts=game.localProposals??[];
  return `<section class="world cabinet"><header class="dressing-header"><a href="#cottage" aria-label="自分の世界へ">‹</a><h1>旅の冒険図鑑</h1><a class="fortune-leave" href="#activity">旅を記録</a></header>
    <div class="cabinet-banner"><img src="./assets/world/open-garden.webp" alt=""><div><small>土地の記憶を持ち帰る</small><h2>小さなおみやげ</h2><p>${regional.filter(item=>found.has(item.id)).length} / ${regional.length} 種</p></div></div>
    <form id="cabinet-search" class="cabinet-search"><label>分類<select name="kind">${Object.entries(collectionCategories).map(([code,label])=>`<option value="${code}" ${category===code?'selected':''}>${label}</option>`).join('')}</select></label>${category==='regional'?`<label>分野<select name="topic"><option value="">すべて</option>${Object.entries(regionalTopics).map(([key,label])=>`<option value="${key}" ${topic===key?'selected':''}>${label}</option>`).join('')}</select></label>`:''}<label>図鑑で探す<input type="search" name="q" value="${e(filter)}" placeholder="土地の名前・おみやげ" maxlength="50"></label><button class="button button-outline">探す</button></form>
    <div class="cabinet-shelves">${shelves.map(item=>`<article ${found.has(item.id)?'data-owned':''}>
      ${item.category==='regional'?relicArt(item):Number.isInteger(item.placement.art)?relicArt(item.placement):''}
      <div><small>${e(item.place??collectionCategories[item.category])}${found.has(item.id)?' · 所蔵':''}</small><h3>${e(item.name)}</h3>
      <p class="muted">${[item.placement.wall?'壁に飾る':item.placement.outside?'庭に置く':'飾る',...(item.wear?['身につける']:[]),...(item.booklet?['しおりに添える']:[])].join('・')}</p>
      ${item.source?`<details><summary>土地の話と出典</summary>${item.fact?`<p><strong>${item.lore?'伝承':'地域の資料'}　</strong>${e(item.fact)}</p>`:''}
      <p class="muted">関連する場所や題材　${e((item.aliases??[]).join('・'))}</p>
      <p class="muted">獲得　この土地を訪れた体験（${e(item.themes.map(key=>activities[key]?.[0]).filter(Boolean).join('・'))}）を記録</p><p>創作の記念品　${e(item.story)}</p><a href="${e(item.source)}" target="_blank" rel="noopener noreferrer">出典をひらく（別のタブ）</a></details>`:''}</div></article>`).join('')||'<p>別の名前で探してみてください。</p>'}</div>
    ${offset||offset+pageSize<matching.length?`<nav class="catalog-pages" aria-label="図鑑のページ">${offset?pages(offset/pageSize-1,'前へ'):''}<span>${offset+1}–${Math.min(offset+pageSize,matching.length)} / ${matching.length} 件</span>${offset+pageSize<matching.length?pages(offset/pageSize+1,'次へ'):''}</nav>`:''}
    <details class="proposal-desk" ${params.has('draft')?'open':''}><summary>地元の話を書き添える</summary><p>土地の自然や食、伝承を図鑑に加えるための提案を、この端末に下書きできます。</p>
      <form id="proposal-form" class="flow"><label>地名<input name="place" required maxlength="60"></label><label>品物や伝承の題名<input name="title" required maxlength="70"></label><label>伝えたいこと<textarea name="story" rows="4" required maxlength="700"></textarea></label><label>確認に使える出典（httpsのURL・任意）<input type="url" name="source" maxlength="300"></label><button class="world-btn">提案の下書きを保存</button></form>
      ${drafts.length?`<h3>この端末の下書き</h3><ul>${drafts.map(x=>`<li><span>${e(x.place)} · ${e(x.title)}</span><button type="button" class="world-text" data-world="export-proposal" data-id="${e(x.id)}">書き出す</button></li>`).join('')}</ul>`:''}
      <p class="muted">共有サービス接続後は、編集部が出典と地域への配慮を確認し、採用した提案へ「ふるさとの語り部」を贈る予定です。</p></details></section>`;
}
export function proposal(fields){
  const value=key=>String(fields.get(key)??'').trim();
  const place=value('place'),title=value('title'),story=value('story'),source=value('source');
  if(!place||place.length>60||!title||title.length>70||!story||story.length>700||source.length>300)throw new Error('地名、題名、伝えたいことを確認してください。');
  if(source){
    let url;try{url=new URL(source);}catch{}
    if(url?.protocol!=='https:'||url.username||url.password)throw new Error('出典はHTTPSのページを入力してください。');
  }
  return {id:crypto.randomUUID(),place,title,story,source};
}
export function exportProposal(data){
  const content=[data.place,data.title,data.story,data.source].filter(Boolean).join('\n\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='ふるさとの提案.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
