import { escapeHtml as e } from './core.js';
import { inputFormats, importGalleryPhoto, maxPhotos, technicalLabel } from './gallery-media.js';
import { read, update } from './storage.js';
import { icon, link, page } from './ui.js';
import { photoFor } from './photos.js';

const storageKey = 'photo-drafts';
const maxStorage = 36 * 1024 * 1024;
const types = {photo:'写真', journal:'旅の日記', booklet:'旅の栞'};
const sizeOf = drafts => drafts.reduce((sum,draft)=>sum+draft.photos.reduce((n,photo)=>n+photo.thumbnail.size+photo.large.size,0),0);

export function movePhoto(photos, id, offset) {
  const index = photos.findIndex(photo=>photo.id === id);
  if (index < 0 || index+offset < 0 || index+offset >= photos.length) return photos;
  const next = photos.slice();
  [next[index],next[index+offset]] = [next[index+offset],next[index]];
  return next;
}

export function createGallery(root, {go, notify}) {
  let drafts = [], editor, busyEditor;
  const urls = new Set();
  const url = blob => {
    const path = URL.createObjectURL(blob);
    urls.add(path);
    return path;
  };
  const release = () => {
    for (const path of urls) URL.revokeObjectURL(path);
    urls.clear();
  };

  function editorForm() {
    return page('写真の投稿を作る','この端末に下書きとして保存できます。',`<form id="gallery-editor" class="surface flow">
      <label>タイトル<input name="title" required maxlength="100" value="${e(editor.title)}"></label>
      <label>投稿の種類<select name="kind">${Object.entries(types).map(([id,label])=>`<option value="${id}" ${id===editor.kind?'selected':''}>${label}</option>`).join('')}</select></label>
      <label>旅のこと<textarea name="body" maxlength="2600" rows="3">${e(editor.body)}</textarea></label>
      <label class="photo-input">写真を選ぶ<input type="file" name="pictures" multiple accept="${inputFormats}" ${busyEditor===editor || editor.photos.length>=maxPhotos?'disabled':''}>
        <small>最大10枚。1枚20MBまで。カメラのJPEGも選べます。HEICは端末が対応している場合に読み込めます。</small>
      </label>
      <p id="gallery-status" class="muted" role="status">${editor.photos.length} / 10枚</p>
      <ol class="gallery-editor-list">${editor.photos.map((photo,index)=>editorPhoto(photo,index)).join('')}</ol>
      <p class="notice">この下書きは非公開です。GPSは読み取らず、保存画像から元のEXIFを除去します。</p>
      <div class="actions"><button type="submit" class="button" ${busyEditor===editor?'disabled':''}>下書きを保存</button>${link('#photos','下書き一覧へ','back','text-link')}</div>
      </form>`,{narrow:true});
  }

  function editorPhoto(photo,index) {
    const caption = technicalLabel(photo.technical);
    return `<li class="gallery-editor-photo" data-picture="${photo.id}">
      <header><img src="${url(photo.thumbnail)}" alt="" width="86" height="76"><div><strong>写真 ${index+1}</strong>${photo.id===editor.cover?' · 表紙':''}</div></header>
      <div class="actions gallery-order">
        <button class="chip" type="button" data-album="earlier" ${index===0?'disabled':''}>前へ</button>
        <button class="chip" type="button" data-album="later" ${index===editor.photos.length-1?'disabled':''}>後ろへ</button>
        <button class="chip" type="button" data-album="cover" aria-pressed="${photo.id===editor.cover}">表紙にする</button>
        <button class="chip" type="button" data-album="remove">削除</button>
      </div>
      <label>写真 ${index+1}の説明<input name="desc" maxlength="160" value="${e(photo.description)}"></label>
      <label>写真 ${index+1}の撮影場所<input name="location" maxlength="100" value="${e(photo.location)}"></label>
      ${caption ? `<label class="check-row"><input type="checkbox" name="technical" ${photo.showTechnical?'checked':''}>プレビューに撮影設定を表示</label>
        <p class="muted">${e(caption)}</p>` : ''}
    </li>`;
  }

  function snapshot(form) {
    editor.title = form.elements.title.value;
    editor.body = form.elements.body.value;
    editor.kind = form.elements.kind.value;
    for (const field of form.querySelectorAll('[data-picture]')) {
      const photo = editor.photos.find(item=>item.id === field.dataset.picture);
      photo.description = field.querySelector('[name=desc]').value;
      photo.location = field.querySelector('[name=location]').value;
      photo.showTechnical = Boolean(field.querySelector('[name=technical]')?.checked);
    }
  }

  function refreshEditor(targetPicture, action, status) {
    release();
    root.innerHTML = editorForm();
    if (status) root.querySelector('#gallery-status').textContent = status;
    const field = [...root.querySelectorAll('[data-picture]')].find(x=>x.dataset.picture===targetPicture);
    const target = field?.querySelector(`[data-album=${action}]:not(:disabled)`) ?? field?.querySelector('[name=desc]');
    if (target) target.focus({preventScroll:true});
  }

  function detail(draft) {
    const cover = draft.photos.find(photo=>photo.id === draft.cover) ?? draft.photos[0];
    return page(draft.title,'この端末の非公開下書き',`<article class="surface flow album-book">
      <button class="album-cover" type="button" data-album="view" data-draft="${draft.id}" data-picture-id="${cover.id}">
        <img src="${url(cover.thumbnail)}" alt="${e(cover.description || '表紙写真')}" width="${cover.width}" height="${cover.height}">
        <span>写真集を開く · ${draft.photos.length}枚</span>
      </button>
      ${draft.body ? `<p class="prewrap">${e(draft.body)}</p>` : ''}
      <div class="album-thumbnails">${draft.photos.map((photo,index)=>`<button type="button" data-album="view" data-draft="${draft.id}" data-picture-id="${photo.id}" aria-label="写真${index+1}を全画面で見る"><img src="${url(photo.thumbnail)}" alt="" loading="lazy"></button>`).join('')}</div>
      <div class="actions">${link(`#photos/${draft.id}/edit`,'下書きを編集','edit','button button-outline')}${link('#photos','下書き一覧へ','back','text-link')}<button type="button" class="button button-danger" data-album="delete-draft" data-draft="${draft.id}">下書きを削除</button></div>
    </article>`,{narrow:true});
  }

  function screen(id, mode) {
    release();
    const draft = drafts.find(item=>item.id === id);
    if (id === 'new' || (draft && mode === 'edit')) {
      editor = draft ? structuredClone(draft) : {id:crypto.randomUUID(),title:'',body:'',kind:'photo',photos:[],cover:null};
      return editorForm();
    }
    editor = null;
    if (draft) return detail(draft);
    const cards = drafts.map(item=>{
      const cover = item.photos.find(photo=>photo.id===item.cover) ?? item.photos[0];
      return `<a class="draft-card" href="#photos/${item.id}"><img src="${url(cover.thumbnail)}" alt="" loading="lazy">
        <span><strong>${e(item.title)}</strong><small>${item.photos.length}枚 · ${types[item.kind] ?? '写真'}</small></span></a>`;
    }).join('');
    return page('写真の下書き','投稿の準備を自分のペースで。',`<div class="flow">${link('#photos/new','新しい下書き','edit')}
      ${cards ? `<div class="draft-list">${cards}</div>` : '<p class="notice">下書きはまだありません。</p>'}
      ${link('#home','みんなの旅へ','back','text-link')}</div>`,{narrow:true});
  }

  async function addFiles(form, files) {
    if (!editor || busyEditor===editor || !files.length) return;
    const current = editor;
    const remaining = maxPhotos-editor.photos.length;
    busyEditor = current;
    form.elements.pictures.disabled = true;
    form.querySelector('[type=submit]').disabled = true;
    form.querySelector('#gallery-status').textContent = '写真を準備しています…';
    const added = [], errors = [];
    for (const file of files.slice(0,remaining)) {
      try { added.push(await importGalleryPhoto(file)); }
      catch (error) { errors.push(error.message); }
      if (!form.isConnected) break;
    }
    if (busyEditor===current) busyEditor = undefined;
    if (!form.isConnected || editor !== current) return;
    snapshot(form);
    editor.photos.push(...added);
    editor.cover ??= editor.photos[0]?.id;
    if (files.length > remaining) errors.push('写真は10枚までです。');
    refreshEditor(null,null,`${editor.photos.length} / 10枚${errors.length ? `。${[...new Set(errors)].join(' ')}` : ''}`);
  }

  root.addEventListener('change',event=>{
    if (event.target.matches('#gallery-editor input[type=file]')) addFiles(event.target.form,[...event.target.files]);
  });
  root.addEventListener('click',event=>{
    const button = event.target.closest('[data-album]');
    if (!button) return;
    const action = button.dataset.album;
    if (action === 'sample') {
      const photo = photoFor(button.dataset.pictureId);
      if (photo) openViewer([{...photo,description:photo.alt}],0);
      return;
    }
    if (action === 'view') {
      const draft = drafts.find(item=>item.id === button.dataset.draft);
      if (draft) openViewer(draft.photos,draft.photos.findIndex(photo=>photo.id===button.dataset.pictureId));
      return;
    }
    if (action === 'delete-draft') {
      const id = button.dataset.draft;
      if (!drafts.some(draft=>draft.id===id) || !confirm('この下書きと写真を削除しますか？')) return;
      button.disabled = true;
      update(storageKey,(existing = [])=>existing.filter(draft=>draft.id!==id)).then(next=>{
        drafts = next;
        if (button.isConnected) go('#photos');
        notify('下書きを削除しました。');
      }).catch(()=>notify('下書きを削除できませんでした。')).finally(()=>{button.disabled=false;});
      return;
    }
    const form = button.closest('#gallery-editor');
    if (!form || !editor || busyEditor===editor) return;
    const id = button.closest('[data-picture]')?.dataset.picture;
    if (!id) return;
    snapshot(form);
    if (action === 'remove') {
      editor.photos = editor.photos.filter(photo=>photo.id!==id);
      if (editor.cover===id) editor.cover = editor.photos[0]?.id ?? null;
    } else if (action === 'cover') editor.cover = id;
    else editor.photos = movePhoto(editor.photos,id,action==='earlier'?-1:1);
    refreshEditor(id,action);
    if (action === 'remove') root.querySelector('input[type=file]').focus({preventScroll:true});
  });
  root.addEventListener('submit',async event=>{
    const form = event.target;
    if (form.id !== 'gallery-editor') return;
    event.preventDefault();
    if (!editor || busyEditor===editor) return;
    snapshot(form);
    const status = form.querySelector('#gallery-status');
    if (!editor.title.trim() || !editor.photos.length) {
      status.textContent = 'タイトルと写真を1枚以上入れてください。';
      return;
    }
    const savedEditor = editor;
    const originalRevision = editor.updatedAt;
    busyEditor = savedEditor;
    const record = {...editor,title:editor.title.trim(),updatedAt:Date.now()};
    const save = event.submitter ?? form.querySelector('[type=submit]');
    save.disabled = true;
    try {
      drafts = await update(storageKey,(existing = [])=>{
        const latest = existing.find(item=>item.id===record.id);
        if (originalRevision && latest?.updatedAt!==originalRevision) throw new Error('この下書きが別画面で更新されました。開き直してください。');
        const next = [record,...existing.filter(item=>item.id!==record.id)];
        if (sizeOf(next) > maxStorage) throw new Error('この端末で写真の下書きに使える容量を超えました。枚数や画素数を減らしてください。');
        return next;
      });
      notify('下書きを保存しました。');
      if (form.isConnected) go(`#photos/${record.id}`);
    } catch (error) {
      status.textContent = error instanceof DOMException ? '下書きを保存できませんでした。端末の空き容量をご確認ください。' : error.message;
    } finally {
      if (busyEditor===savedEditor) busyEditor = undefined;
      save.disabled = false;
    }
  });

  return {screen,release,async load(){drafts = (await read(storageKey)) ?? [];},reset(){drafts=[];editor=null;release();}};
}

function openViewer(photos, initial) {
  if (!photos.length) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'album-viewer';
  dialog.setAttribute('aria-label','写真集');
  dialog.innerHTML = `<header class="album-bar"><span data-count aria-live="polite"></span><button data-close type="button" autofocus aria-label="写真集を閉じる">閉じる</button></header>
    <div class="album-stage"><img alt=""></div><p class="album-caption" aria-live="polite"></p>
    <div class="album-controls"><button type="button" data-step="-1" aria-label="前の写真">←</button>
      <button type="button" data-zoom>拡大</button><button type="button" data-step="1" aria-label="次の写真">→</button></div>`;
  document.body.append(dialog);
  const img = dialog.querySelector('img');
  const stage = dialog.querySelector('.album-stage');
  const caption = dialog.querySelector('.album-caption');
  const zoomButton = dialog.querySelector('button[data-zoom]');
  let index = Math.max(0,initial), zoom = 1, objectUrl, pointer;
  function render() {
    const photo = photos[index];
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = photo.large ? URL.createObjectURL(photo.large) : null;
    img.src = objectUrl ?? photo.src;
    img.alt = photo.description || photo.alt || `写真 ${index+1}`;
    dialog.querySelector('[data-count]').textContent = `${index+1} / ${photos.length}`;
    caption.textContent = [photo.description,photo.location,photo.showTechnical && technicalLabel(photo.technical)].filter(Boolean).join(' · ');
    dialog.querySelector('[data-step="-1"]').disabled = index === 0;
    dialog.querySelector('[data-step="1"]').disabled = index === photos.length-1;
    zoom = 1;
    setZoom();
    if (!document.documentElement.classList.contains('motion-off') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      img.animate([{opacity:.55},{opacity:1}],{duration:170});
    }
  }
  function setZoom() {
    stage.dataset.zoom = zoom;
    zoomButton.textContent = zoom === 1 ? '拡大' : zoom === 2 ? 'さらに拡大' : '元の表示';
    zoomButton.setAttribute('aria-pressed',String(zoom > 1));
    if (zoom === 1) stage.scrollTo({top:0,left:0});
  }
  function step(direction) {
    if (index+direction < 0 || index+direction >= photos.length) return;
    index += direction;
    render();
  }
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  zoomButton.onclick = () => { zoom = zoom === 3 ? 1 : zoom+1; setZoom(); };
  dialog.querySelectorAll('[data-step]').forEach(button=>{button.onclick=()=>step(Number(button.dataset.step));});
  dialog.addEventListener('keydown',event=>{
    if (zoom !== 1 || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    step(event.key === 'ArrowLeft' ? -1 : 1);
  });
  stage.addEventListener('pointerdown',event=>{if (zoom===1 && event.isPrimary) pointer={x:event.clientX,y:event.clientY,id:event.pointerId};});
  stage.addEventListener('pointercancel',()=>{pointer=null;});
  stage.addEventListener('pointerup',event=>{
    if (!pointer || pointer.id !== event.pointerId) return;
    const x = event.clientX-pointer.x, y = event.clientY-pointer.y;
    pointer = null;
    if (Math.abs(x)>45 && Math.abs(x)>Math.abs(y)*1.4) step(x<0 ? 1 : -1);
  });
  dialog.addEventListener('close',()=>{if (objectUrl) URL.revokeObjectURL(objectUrl);dialog.remove();},{once:true});
  render();
  dialog.showModal();
}
