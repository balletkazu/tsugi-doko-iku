import {escapeHtml as e} from './core.js';
import {parts,poses,items,avatarFrom} from './world-data.js';
import {facings,character,travelerAssets} from './traveler-art.js';
import {hairPalette,skinPalette,clothPalette,tuningParts,tuningFields} from './avatar-palette.js';

const groups=[
  ['hair','髪・肌',['hair','hairColor','skin']],
  ['face','顔',['face','eyes','brows','nose','mouth','ears','beard']],
  ['clothes','服',['outfit','clothColor','pattern','material','layer','shoes']],
  ['gear','小物',['hat','glasses','bag','accessory','pin']],
  ['body','体型',['body','height']],
  ['motion','しぐさ',['pose']]
];
const labels={pin:'記念品',pose:'動きを試す'};
const directions=['正面','背面','右向き','左向き','右斜め','左斜め','右斜め後ろ','左斜め後ろ'];
const sequence=['south','southeast','east','northeast','north','northwest','west','southwest'];
const swatches={hairColor:hairPalette,skin:skinPalette,clothColor:clothPalette};
const faceParts=new Set(['face','eyes','brows','nose','mouth','ears','beard','hair']);

export function dressingRoom(avatar,owned,guided){
  return `<section class="world dressing atelier"><form id="avatar-form" data-guide="${guided}">
    <header class="dressing-header"><a href="${guided?'#welcome':'#cottage'}" aria-label="戻る">‹</a><h1>旅人の身支度</h1><button class="world-btn">${guided?'この姿で家へ':'できあがり'}</button></header>
    <div class="atelier-view">
      <button type="button" class="atelier-hero" data-studio="greet" aria-label="旅人に話しかける"><canvas aria-label="選んだ旅人の全身" role="img" data-person data-doll data-pose="look" width="160" height="160"></canvas></button>
      <div class="atelier-controls"><button type="button" data-studio="previous" aria-label="左へ回す">↶</button><span data-facing>正面</span><button type="button" data-studio="next" aria-label="右へ回す">↷</button></div>
      <label class="atelier-name">名前<input name="name" aria-label="旅人の名前" required maxlength="24" value="${e(avatar.name)}"></label>
      <p class="atelier-note" role="status"></p>
    </div>
    <nav class="fitting-groups" aria-label="身支度の種類">${groups.map(([id,label],i)=>`<button type="button" data-fitting-group="${id}" aria-pressed="${i===0}">${label}</button>`).join('')}</nav>
    <div class="fitting-tray"><div class="fitting-parts" aria-label="選ぶパーツ"></div><div class="fitting-options" aria-label="パーツのイラスト"></div><div class="fitting-tune"></div></div>
    <div class="atelier-sets"><button type="button" data-studio="surprise">おまかせ</button><button type="button" data-studio="undo" aria-label="一つ戻す">↶</button><button type="button" data-studio="redo" aria-label="やり直す">↷</button><button type="button" data-studio="save-look">＋ コーデを保存</button></div>
    <div data-looks></div>
    ${guided?'<div class="fitting-foot"><button type="button" class="world-text" data-world="skip">案内をスキップ</button></div>':''}
    </form><template data-fitting-owned>${owned.map(id=>`<span data-id="${id}"></span>`).join('')}</template></section>`;
}
export function mountDressing(root,initial,{looks=[],saveLook}={}){
  const form=root.querySelector('#avatar-form');
  if(!form)return ()=>{};
  const person=form.querySelector('[data-person]'),tray=form.querySelector('.fitting-options');
  const partNav=form.querySelector('.fitting-parts'),tune=form.querySelector('.fitting-tune');
  const status=form.querySelector('.atelier-note'),setList=form.querySelector('[data-looks]');
  const owned=[...root.querySelector('[data-fitting-owned]').content.children].map(node=>node.dataset.id);
  let draft={...avatarFrom(initial),pin:initial.pin}, group=groups[0],part=group[2][0],pose='look',direction=0;
  let past=[],future=[],saved=[...looks],reactTimer=0,released=false,saving=false;
  const checkpoint=()=>{past=[...past.slice(-39),structuredClone(draft)];future=[];};
  function drawOptions(){
    for(const button of tray.querySelectorAll('button[data-fitting-value]')){
      const canvas=button.querySelector('canvas');if(!canvas)continue;
      const value=button.dataset.fittingValue;
      const look=part==='pose'?{...draft}:{...draft,[part]:part==='pin'?value:Number(value)};
      if(faceParts.has(part)){
        look.hat=0;if(part!=='eyes')look.glasses=0;
        const source=document.createElement('canvas');source.width=source.height=128;source.dataset.doll='1';
        character(source,look);
        canvas.getContext('2d').drawImage(source,27,6,74,64,0,0,88,76);
      }else {canvas.dataset.doll='1';character(canvas,look,part==='pose'?value:'look',3);}
    }
  }
  function renderOptions(){
    const options=part==='pose'?Object.entries(poses):part==='pin'?[['','なし'],...owned.map(key=>[key,items[key]])]:parts[part].slice(1).map((label,i)=>[i,label]);
    const selected=part==='pose'?pose:draft[part]??'',palette=swatches[part];
    tray.classList.toggle('swatches',!!palette);
    tray.innerHTML=options.map(([value,label])=>`<button type="button" data-fitting-value="${e(value)}" aria-label="${e(label)}" aria-pressed="${value===selected&&!(part==='hairColor'&&draft.hairTint)}">${palette?'<i aria-hidden="true"></i>':'<canvas width="88" height="88" aria-hidden="true"></canvas>'}<span>${e(label)}</span></button>`).join('');
    if(palette)[...tray.querySelectorAll('i')].forEach((color,i)=>{color.style.background=palette[i][1]??'#dcc99b';});
    else drawOptions();
    if(part==='hairColor')tune.innerHTML=`<label class="hair-color-free">自由な髪色<input aria-label="自由な髪色" type="color" value="${draft.hairTint??hairPalette[draft.hairColor][1]}"></label>`;
    else if(tuningParts.includes(part)){
      const fieldKeys=['body','height'].includes(part)?['size']:part==='face'?['x','y','angle','size','gap']:
        ['eyes','brows','ears'].includes(part)?Object.keys(tuningFields):['x','y','size','angle'];
      tune.innerHTML=`<details><summary>位置・形を微調整</summary><div class="tune-grid">${fieldKeys.map(key=>`<label>${tuningFields[key]}<input type="range" min="-10" max="10" value="${draft.tune?.[part]?.[key]??0}" data-tuning="${key}"></label>`).join('')}<button type="button" data-studio="reset-part">元に戻す</button></div></details>`;
    }else tune.innerHTML='';
  }
  function renderParts(){
    partNav.innerHTML=group[2].map(key=>`<button type="button" data-fitting-part="${key}" aria-pressed="${key===part}">${parts[key]?.[0]??labels[key]}</button>`).join('');
    renderOptions();
  }
  function preview(nextPose=pose){
    person._avatar={...draft};
    person.dataset.pose=nextPose;person.dataset.direction=sequence[direction];
    form.querySelector('[data-facing]').textContent=directions[facings.indexOf(sequence[direction])];
    character(person,person._avatar,nextPose);
    form.querySelector('[data-studio=undo]').disabled=!past.length;
    form.querySelector('[data-studio=redo]').disabled=!future.length;
  }
  function showLooks(){
    setList.innerHTML=saved.map((look,index)=>`<button type="button" data-look="${index}" aria-label="コーデ ${index+1}"><canvas data-doll width="62" height="62"></canvas><span>${index+1}</span></button>`).join('');
    [...setList.querySelectorAll('canvas')].forEach((c,i)=>character(c,saved[i]));
    form.querySelector('[data-studio=save-look]').textContent=saved.length>=6?'↻ コーデに上書き':'＋ コーデを保存';
  }
  function react(kind,line){
    clearTimeout(reactTimer);preview(kind);status.textContent=line;
    reactTimer=setTimeout(()=>{preview();status.textContent='';},1500);
  }
  form.addEventListener('focusin',event=>{
    if(event.target.matches('[data-tuning], [type=color]'))checkpoint();
  });
  form.oninput=event=>{
    const field=event.target;
    if(field.dataset.tuning)draft={...draft,tune:{...draft.tune,[part]:{...draft.tune?.[part],[field.dataset.tuning]:Number(field.value)}}};
    else if(field.type==='color')draft={...draft,hairTint:field.value};
    else return;
    direction=0;pose='look';preview();
  };
  form.onclick=async event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.fittingGroup){
      group=groups.find(([id])=>id===button.dataset.fittingGroup);part=group[2][0];
      for(const b of form.querySelectorAll('[data-fitting-group]'))b.setAttribute('aria-pressed',String(b===button));
      renderParts();return;
    }
    if(button.dataset.fittingPart){part=button.dataset.fittingPart;renderParts();partNav.querySelector('[aria-pressed=true]')?.focus();return;}
    if(Object.hasOwn(button.dataset,'fittingValue')){
      const value=button.dataset.fittingValue;
      if(part==='pose')pose=value;
      else {
        checkpoint();
        draft={...draft,[part]:part==='pin'?value:Number(value),...(part==='hairColor'?{hairTint:null}:{})};
        direction=0;pose='look';
      }
      for(const b of tray.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===button));
      preview();return;
    }
    if(Object.hasOwn(button.dataset,'look')){checkpoint();draft={...saved[Number(button.dataset.look)],name:draft.name};direction=0;pose='look';renderOptions();react('joy','着替えました。');return;}
    switch(button.dataset.studio){
      case 'previous':case 'next':direction=(direction+(button.dataset.studio==='next'?1:7))%8;pose='look';preview();break;
      case 'greet':direction=0;react('joy','いっしょに旅に出よう。');break;
      case 'reset-part':checkpoint();draft={...draft,tune:{...draft.tune,[part]:{}}};renderOptions();tune.querySelector('details')?.setAttribute('open','');preview();break;
      case 'surprise':{
        checkpoint();const roll=key=>Math.floor(Math.random()*(parts[key].length-1));
        draft={...draft,hair:roll('hair'),outfit:roll('outfit'),hairColor:roll('hairColor'),hat:roll('hat'),skin:roll('skin'),accessory:roll('accessory'),hairTint:null};
        direction=0;pose='look';renderOptions();react('joy','新しい組み合わせ。');break;
      }
      case 'undo':case 'redo':{
        const source=button.dataset.studio==='undo'?past:future,target=source===past?future:past;
        if(source.length){target.push(draft);draft=source.pop();direction=0;pose='look';renderOptions();preview();}
        break;
      }
      case 'save-look':
        if(saving)break;
        saving=true;
        try{saved=await saveLook?.(draft)??saved;showLooks();react('joy','コーデを保存しました。');}
        catch(error){status.textContent=error.message;}
        finally{saving=false;}
        break;
    }
  };
  form.readAppearance=()=>({...draft,name:form.elements.name.value});
  renderParts();showLooks();preview();
  travelerAssets().then(()=>{if(!released){drawOptions();showLooks();}});
  return ()=>{released=true;clearTimeout(reactTimer);};
}
