import { escapeHtml as e, mapsSearch } from './core.js';
import { importPhoto } from './storage.js';
import { empty, external, icon, link, page } from './ui.js';

export const recordGroup = type => type === 'trip' ? 'trips' : 'journals';
const missing = () => page('記録が見つかりません','この端末に保存した記録を開けます。',link('#my','私の旅へ戻る','arrow'),{narrow:true});
const back = `<p class="no-print">${link('#my','私の旅へ','back','text-link')}</p>`;
const moods = ['指定なし','うれしい','穏やか','わくわく','驚き','しみじみ','疲れた'];
const photoUrls = new Set();
const allowedMime = 'image/jpeg,image/png,image/webp,image/avif';

function photoFields(entry) {
  return `<div class="flow"><label class="photo-input">写真を追加<input name="photos" type="file" accept="${allowedMime}" multiple><small>スマートフォン・デジタルカメラの写真を最大3枚。JPEG・PNG・WebP・AVIF、1枚20MBまで。</small></label>${entry?.photos?.length ? `<div class="photo-list" data-photos="${entry.id}"></div><label class="check-row"><input type="checkbox" name="clear-photos">保存済みの写真を取り除く</label>` : ''}</div>`;
}

function formScreen(type, entry) {
  const trip = type === 'trip';
  const name = trip ? '旅の栞' : '旅の日記';
  const title = entry ? `${name}を編集` : trip ? '旅の栞を作る' : '旅の日記を書く';
  const mood = entry?.mood ?? '指定なし';
  return page(title,trip ? '日付、立ち寄り先、移動のメモをまとめる。' : '思い出す風景や、そのときの気持ちを残す。',`${back}<form id="record-form" data-type="${type}" data-id="${entry?.id ?? ''}" class="surface flow"><label>タイトル<input name="title" required maxlength="100" value="${e(entry?.title)}" placeholder="${trip ? '例：海辺をめぐる一日' : '例：森で出会った音'}"></label><div class="field-grid"><label>日付<input type="date" name="date" value="${e(entry?.date)}"></label><label>${trip ? '主な目的地' : '訪ねた場所'}<input name="place" maxlength="120" value="${e(entry?.place)}"></label></div>${trip ? `<label>旅程・立ち寄り先<textarea name="body" maxlength="4000" rows="5">${e(entry?.body)}</textarea></label><label>交通・持ち物のメモ<textarea name="transport" maxlength="2000" rows="3">${e(entry?.transport)}</textarea></label>` : `<label>そのときの気持ち<select name="mood">${moods.map(value=>`<option ${value===mood?'selected':''}>${value}</option>`).join('')}</select></label><label>日記の本文<textarea name="body" maxlength="4000" rows="7">${e(entry?.body)}</textarea></label>`}${photoFields(entry)}<p class="notice">公開範囲：自分だけ。このブラウザーに保存されます。</p><div class="actions"><button class="button" type="submit">${entry ? '変更を保存する' : '保存する'}${icon('arrow')}</button>${link(entry ? `#${type}/${entry.id}` : '#my','戻る',null,'text-link')}</div><p id="record-error" class="error" role="alert" hidden></p></form>`,{narrow:true,eyebrow:trip ? 'Trip booklet' : 'Travel journal'});
}

function itemScreen(type, entry) {
  const trip = type === 'trip';
  return page(entry.title,trip ? '旅の栞' : '旅の日記・自分だけ',`${back}<article class="surface flow">${entry.date || entry.place ? `<p>${[entry.date,entry.place].filter(Boolean).map(e).join(' · ')}</p>` : ''}${entry.mood && entry.mood !== '指定なし' ? `<p class="eyebrow">${e(entry.mood)}</p>` : ''}${entry.photos?.length ? `<div class="photo-list" data-photos="${entry.id}"></div>` : ''}${entry.body ? `<section class="flow"><h2>${trip ? '旅程・立ち寄り先' : '日記'}</h2><p class="prewrap">${e(entry.body)}</p></section>` : ''}${entry.transport ? `<section class="flow"><h2>交通・持ち物のメモ</h2><p class="prewrap">${e(entry.transport)}</p></section>` : ''}${entry.place ? `<div class="no-print">${external(mapsSearch(entry.place),'地図で見る')}</div>` : ''}<div class="actions no-print">${link(`#${type}/${entry.id}/edit`,'編集する','edit','button button-outline')}${trip ? '<button class="button button-outline" type="button" data-action="print">印刷・PDFにする</button><button class="button button-outline" type="button" data-action="share">テキストで共有</button>' : ''}<button class="button button-danger" type="button" data-action="delete-record" data-type="${type}" data-id="${entry.id}">削除</button></div>${trip ? '<small class="muted no-print">テキスト共有には写真を含みません。</small>' : ''}</article>`,{narrow:true,eyebrow:trip ? 'Trip booklet' : 'Travel journal'});
}

export function recordScreen(type, id, edit, data) {
  if (!id || id === 'new') return formScreen(type);
  const entry = data[recordGroup(type)].find(item=>item.id === id);
  if (!entry) return missing();
  return edit === 'edit' ? formScreen(type,entry) : itemScreen(type,entry);
}

export function renderPhotos(view, data) {
  for (const gallery of view.querySelectorAll('[data-photos]')) {
    const entry = [...data.trips,...data.journals].find(item=>item.id === gallery.dataset.photos);
    for (const [index,blob] of (entry?.photos ?? []).entries()) {
      const url = URL.createObjectURL(blob);
      photoUrls.add(url);
      const image = new Image();
      image.src = url;
      image.alt = `旅の記録写真 ${index+1}`;
      gallery.append(image);
    }
  }
}

export function revokePhotos() {
  for (const url of photoUrls) URL.revokeObjectURL(url);
  photoUrls.clear();
}

export async function submitRecord(form, current) {
  const fields = new FormData(form);
  const value = name => String(fields.get(name) ?? '').trim();
  const title = value('title');
  if (!title) throw new Error('タイトルを入力してください。');
  const fresh = fields.getAll('photos').filter(file=>file.size > 0);
  const kept = fields.has('clear-photos') ? [] : current?.photos ?? [];
  if (fresh.length + kept.length > 3) throw new Error('写真は合計3枚までです。');
  const photos = [...kept];
  for (const file of fresh) photos.push(await importPhoto(file));
  return {
    id:current?.id ?? crypto.randomUUID(), title, date:value('date'), place:value('place'), body:value('body'),
    transport:value('transport'), mood:value('mood'), photos, updatedAt:Date.now()
  };
}

export async function shareTrip(entry) {
  const text = [entry.title,entry.date,entry.place,entry.body,entry.transport,entry.place && mapsSearch(entry.place)].filter(Boolean).join('\n\n');
  if (navigator.share) {
    try {
      await navigator.share({ title:entry.title, text });
      return '共有しました。';
    } catch (error) {
      if (error.name === 'AbortError') return '';
    }
  }
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return '栞のテキストをコピーしました。';
    } catch {}
  }
  const url = URL.createObjectURL(new Blob([text], {type:'text/plain;charset=utf-8'}));
  const download = document.createElement('a');
  download.href = url;
  download.download = 'travel-booklet.txt';
  download.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  return '栞のテキストを書き出しました。';
}
