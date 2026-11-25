import {escapeHtml as e} from './core.js';
import {parts,poses,items} from './world-data.js';
import {character} from './traveler-art.js';

const groups = [
  ['face','顔',['face','eyes','brows','nose','mouth','ears','beard']],
  ['hair','髪・肌',['hair','hairColor','skin']],
  ['clothes','服',['outfit','clothColor','pattern','shoes']],
  ['gear','小物',['hat','glasses','bag','accessory','pin']],
  ['body','体型',['body','height']],
  ['motion','しぐさ',['pose']]
];

export function dressingRoom(avatar,owned,guided){
  return `<section class="world dressing"><form id="avatar-form" data-guide="${guided}" data-pin="${e(avatar.pin)}">
    <header class="dressing-header"><a href="${guided?'#welcome':'#cottage'}" aria-label="戻る">‹</a><h1>旅人の身支度</h1><button class="world-btn">${guided?'この姿で家へ':'できあがり'}</button></header>
    <div class="fitting"><div class="fitting-portrait"><canvas aria-label="選んだ旅人の全身" role="img" data-person data-pose="look" width="128" height="128"></canvas></div>
      <label>旅人の名前<input name="name" required maxlength="24" value="${e(avatar.name)}"></label></div>
    <nav class="fitting-groups" aria-label="身支度の種類">${groups.map(([id,label],i)=>`<button type="button" data-fitting-group="${id}" aria-pressed="${i===0}">${label}</button>`).join('')}</nav>
    <div class="fitting-tray"><div class="fitting-parts" aria-label="選ぶパーツ"></div><div class="fitting-options" aria-label="パーツのイラスト"></div></div>
    <div class="fitting-foot">${guided?'<button type="button" class="world-text" data-world="skip">案内をスキップ</button>':'<a class="world-text" href="#cottage">家へ戻る</a>'}</div></form>
    <template data-fitting-owned>${owned.map(id=>`<span data-id="${id}"></span>`).join('')}</template></section>`;
}

export function mountDressing(root,initial){
  const form=root.querySelector('#avatar-form');
  if(!form)return;
  const person=form.querySelector('[data-person]');
  const tray=form.querySelector('.fitting-options');
  const partNav=form.querySelector('.fitting-parts');
  const owned=[...root.querySelector('[data-fitting-owned]').content.children].map(node=>node.dataset.id);
  const draft={...initial};
  let group=groups[0], part=group[2][0], pose='look';
  function renderOptions(){
    const portraitParts=['face','eyes','brows','nose','mouth','ears','beard','hair','hairColor','skin'];
    const headOnly=portraitParts.includes(part);
    const full=document.createElement('canvas');full.width=full.height=96;
    const options=part==='pose'?Object.entries(poses):part==='pin'?[['','なし'],...owned.map(key=>[key,items[key]])]:parts[part].slice(1).map((label,i)=>[i,label]);
    const selected=part==='pose'?pose:draft[part]??'';
    tray.innerHTML=options.map(([value,label])=>`<button type="button" data-fitting-value="${e(value)}" aria-pressed="${value===selected}"><canvas width="88" height="88" aria-hidden="true"></canvas><span>${e(label)}</span></button>`).join('');
    for(const [index,c] of [...tray.querySelectorAll('canvas')].entries()){
      const value=options[index][0];
      const look=part==='pose'?{...draft}:{...draft,[part]:value};
      if(headOnly){
        // Clear the crown and accessories so each face and hair option is visible.
        look.hat=0;
        if(part!=='eyes'&&part!=='brows')look.glasses=0;
      }
      if(headOnly){
        character(full,look,'look',2);
        c.getContext('2d').drawImage(full,19,15,58,54,4,4,80,74);
      }else character(c,look,part==='pose'?value:'look',3);
    }
  }
  function renderParts(){
    partNav.innerHTML=group[2].map(key=>`<button type="button" data-fitting-part="${key}" aria-pressed="${key===part}">${parts[key]?.[0]??(key==='pin'?'記念品':'動きを試す')}</button>`).join('');
    renderOptions();
  }
  function preview(){
    person._avatar={...draft};
    person.dataset.pose=pose;
    character(person,draft,pose);
  }
  form.onclick=event=>{
    const button=event.target.closest('button');
    if(!button)return;
    if(button.dataset.fittingGroup){
      group=groups.find(([id])=>id===button.dataset.fittingGroup);
      part=group[2][0];
      for(const b of form.querySelectorAll('[data-fitting-group]'))b.setAttribute('aria-pressed',String(b===button));
      renderParts();
    }else if(button.dataset.fittingPart){
      part=button.dataset.fittingPart;
      renderParts();
      partNav.querySelector('[aria-pressed=true]')?.focus();
    }else if(Object.hasOwn(button.dataset,'fittingValue')){
      const value=button.dataset.fittingValue;
      if(part==='pose')pose=value;
      else draft[part]=part==='pin'?value:Number(value);
      for(const b of tray.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===button));
      preview();
    }
  };
  form.readAppearance=()=>({...draft,name:form.elements.name.value});
  renderParts();preview();
}
