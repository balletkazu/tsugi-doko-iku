import { escapeHtml as e } from './core.js';
import { photos } from './photo-data.js';

export const photoFor = id => Object.hasOwn(photos, id) ? photos[id] : undefined;

export function canFeaturePhoto(photo) {
  if (!photo?.originalUrl || !photo?.creator || !photo?.location || !photo?.src || !photo?.alt) return false;
  if (photo.origin === 'commons') return Boolean(photo.license?.name && photo.license?.url);
  return photo.origin === 'user' && photo.visibility === 'public' &&
    photo.homeConsent?.status === 'granted' && Boolean(photo.homeConsent?.version) && photo.moderation === 'approved';
}

export function renderPhoto(photo, classes = '', { priority = false } = {}) {
  const load = priority ? 'fetchpriority="high"' : 'loading="lazy"';
  const image = `<img class="${e(classes)}" src="${e(photo.src)}" width="${photo.width}" height="${photo.height}" decoding="async" ${load} alt="${e(photo.alt)}">`;
  return priority && photo.smallSrc
    ? `<picture><source media="(max-width: 680px)" srcset="${e(photo.smallSrc)}">${image}</picture>`
    : image;
}

function externalCredit(url, label) {
  try {
    if (new URL(url).protocol === 'https:') {
      return `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)}<span class="visually-hidden">（別のタブ）</span></a>`;
    }
  } catch {}
  return e(label);
}

export function photoCredit(photo) {
  return `<div class="photo-credit">
    <span class="credit-location">${e(photo.location)}</span>
    <span>撮影 ${e(photo.creator)} · ${externalCredit(photo.originalUrl, photo.origin === 'commons' ? 'Wikimedia Commons' : '元の投稿')}${photo.license ? ` · ${externalCredit(photo.license.url, photo.license.name)}` : ''}</span>
    ${photo.originalTitle ? `<span class="credit-original">${e(photo.originalTitle)}</span>` : ''}
    ${photo.edits ? `<span>${e(photo.edits)}</span>` : ''}
  </div>`;
}

export function photoFigure(photo, classes = 'detail-image', { priority = false } = {}) {
  return `<figure class="photo-figure">
    <div class="${e(classes)}">${renderPhoto(photo, '', { priority })}</div>
    <figcaption>${photoCredit(photo)}</figcaption>
  </figure>`;
}
