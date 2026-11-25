import { homeFeature } from './community-data.js';
import { canFeaturePhoto, photoFigure, photoFor, renderPhoto } from './photos.js';
import { link, page } from './ui.js';

export function openingPhotoPage() {
  const photo = photoFor(homeFeature);
  return page('ここは、どこ？','九十九島を望む、長崎県佐世保市の展海峰。',`<div class="flow">
    ${photoFigure(photo)}
    <div class="actions">${link('#home','ホームへ','back','button button-outline')}
      <button class="button button-outline" type="button" data-action="replay-opening">もう一度、風景を見る</button></div>
  </div>`,{narrow:true});
}

export function showOpening(onDetails) {
  const photo = photoFor(homeFeature);
  if (!canFeaturePhoto(photo) || document.querySelector('.opening-dialog')) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'opening-dialog';
  if (typeof dialog.showModal !== 'function') return;
  dialog.setAttribute('aria-label','旅のオープニング');
  dialog.innerHTML = `${renderPhoto(photo,'opening-image',{priority:true})}
    <button class="opening-skip" type="button" autofocus><span>タップでスキップ</span></button>
    <button class="opening-place" type="button">ここは、どこ？</button>`;
  document.body.append(dialog);
  let finish;
  const close = () => { if (dialog.open) dialog.close(); };
  dialog.addEventListener('close',()=>{clearTimeout(finish);dialog.remove();},{once:true});
  dialog.querySelector('.opening-skip').addEventListener('click',close);
  dialog.querySelector('.opening-place').addEventListener('click',()=>{close();onDetails();});
  dialog.showModal();
  const timeout = setTimeout(close,3100);
  dialog.addEventListener('close',()=>clearTimeout(timeout),{once:true});
  dialog.querySelector('img').decode().catch(()=>{}).then(()=>{
    if (dialog.open) finish = setTimeout(close,2500);
  });
}

export function showFirstOpening(onDetails) {
  if (location.hash && location.hash !== '#home') return;
  try {
    const key = 'tsugi-opening-seen';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key,'1');
  } catch {}
  showOpening(onDetails);
}
