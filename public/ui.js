import { escapeHtml as e } from './core.js';
import { photoCredit, photoFor, renderPhoto } from './photos.js';

const paths = {
  home:'<path d="m3 10 9-7 9 7M5 9v11h14V9M10 20v-6h4v6"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>',
  route:'<circle cx="5" cy="17" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 17h9a3 3 0 0 0 0-6H8a2.5 2.5 0 0 1 0-5h9"/>',
  book:'<path d="M4 5h12a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3V5zM4 17a2 2 0 0 1 2-2h13M8 8h7"/>',
  heart:'<path d="M20.8 9.1c0 4.6-8.8 9.9-8.8 9.9s-8.8-5.3-8.8-9.9A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.8 2.1Z"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back:'<path d="M20 12H5m6-6-6 6 6 6"/>',
  pin:'<path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  stamp:'<path d="M12 3 9 5l-3 1-1 4-2 2 2 3 1 3 3 1 3 2 3-2 3-1 1-3 2-3-2-2-1-4-3-1-3-2Z"/><path d="m9 12 2 2 4-4"/>',
  send:'<path d="M13 5h6v6M19 5l-9 9m0-9H5v14h14v-5"/>',
  edit:'<path d="m4 16 11-11 4 4-11 11H4v-4zm9-9 4 4"/>'
};
export const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;

export function link(url, label, symbol, style = 'button') {
  return `<a class="${style}" href="${e(url)}">${e(label)}${symbol ? icon(symbol) : ''}</a>`;
}
export function external(url, label) {
  return `<a class="button button-outline" href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)}${icon('send')}<span class="visually-hidden">（別のタブ）</span></a>`;
}
export function page(title, intro, content, { narrow = false, eyebrow = '' } = {}) {
  return `<div class="page${narrow ? ' page-narrow' : ''}"><header class="page-title">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1>${e(title)}</h1>${intro ? `<p class="section-intro">${e(intro)}</p>` : ''}</header>${content}</div>`;
}
export const empty = (title, body) => `<div class="empty flow"><h3>${e(title)}</h3><p class="muted">${e(body)}</p></div>`;
export function saveButton(id, active, small = false) {
  const label = active ? '保存を取り消す' : '行きたい場所に保存';
  return `<button type="button" class="${small ? 'icon-button card-save' : 'button button-outline'}" data-action="save-place" data-id="${id}" aria-pressed="${active}" aria-label="${label}">${icon('heart')}${small ? '' : label}</button>`;
}
export function placeCard(place, saved) {
  const photo = photoFor(place.photoId);
  return `<article class="place-card${photo ? '' : ' place-card-text'}">
    <a class="place-link" href="#place/${place.id}">
      ${photo ? renderPhoto(photo,'card-image') : ''}
      <div class="card-main"><div class="card-meta">${icon('pin')}${place.region} · ${place.theme}</div>
        <h3>${place.name}</h3><p>${place.intro}</p>
      </div>
    </a>
    ${saveButton(place.id,saved,true)}
    ${photo ? `<details class="credit-details place-credit"><summary>撮影者・ライセンス</summary>${photoCredit(photo)}</details>` : ''}
  </article>`;
}

export const chips = (labels, selected, makeUrl) => `<div class="chip-list">${labels.map(label=>`<a class="chip" href="${e(makeUrl(label))}" ${label === selected ? 'aria-current="true"' : ''}>${e(label)}</a>`).join('')}</div>`;
export const options = (name, labels, selected, format = String) => `<div class="options">${labels.map(value=>`<label class="option"><input type="radio" name="${name}" value="${e(value)}" ${String(value) === String(selected) ? 'checked' : ''}><span class="chip">${e(format(value))}</span></label>`).join('')}</div>`;
