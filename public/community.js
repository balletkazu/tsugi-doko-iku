import { escapeHtml as e } from './core.js';
import { communityTabs, editorial, feedPosts, homeFeature, reactionTypes, samplePosts } from './community-data.js';
import { canFeaturePhoto, photoCredit, photoFigure, photoFor, renderPhoto } from './photos.js';
import { empty, icon, link } from './ui.js';

const labels = Object.fromEntries(communityTabs);
export const findSamplePost = id => samplePosts.find(post => post.id === id);
export const homeUrl = (feed = 'all') => feed === 'all' ? '#home' : `#home?${new URLSearchParams({feed})}`;

const savePostButton = (post, profile) => {
  const saved = (profile.savedPosts ?? []).includes(post.id);
  const label = saved ? '投稿の保存を取り消す' : '投稿を保存する';
  return `<button type="button" class="icon-button" data-action="save-post" data-id="${post.id}" aria-pressed="${saved}" aria-label="${label}">${icon('heart')}</button>`;
};

function followButton(profile) {
  const following = (profile.sampleFollows ?? []).includes(editorial.id);
  return `<button type="button" class="button button-outline" data-action="follow-sample" data-id="${editorial.id}" aria-pressed="${following}">${following ? 'サンプルのフォローを解除' : '編集部のサンプルをフォロー'}</button>`;
}

function tags(post) {
  return `<ul class="post-tags" aria-label="タグ">${post.tags.map(tag=>`<li>#${e(tag)}</li>`).join('')}</ul>`;
}

function card(post, profile, returnTo) {
  const photo = photoFor(post.photoId);
  const url = `#story/${post.id}?${new URLSearchParams({from:returnTo})}`;
  return `<article class="post-card">
    <div class="post-card-top">
      <span class="post-avatar" aria-hidden="true">${icon('book')}</span>
      <span class="post-author">${e(post.author.name)}</span>
      <span class="post-kind">${labels[post.kind]}</span>
    </div>
    ${photo ? `<a class="post-photo" href="${e(url)}" aria-label="${e(post.title)}を開く">${renderPhoto(photo)}
      <span>${icon('pin')}${e(photo.location)}</span></a>` : ''}
    <div class="post-card-content">
      <h2><a href="${e(url)}">${e(post.title)}</a></h2>
      <p>${e(post.intro)}</p>
      ${tags(post)}
      ${photo ? `<details class="credit-details"><summary>撮影者・ライセンス</summary>${photoCredit(photo)}</details>` : ''}
      <div class="post-actions">${link(url,post.kind === 'photos' ? '写真を見る' : '投稿を読む','arrow','text-link')}${savePostButton(post,profile)}</div>
    </div>
  </article>`;
}

export const communityCards = (posts, profile, returnTo) => `<div class="post-grid">${posts.map(post=>card(post,profile,returnTo)).join('')}</div>`;

export function communityHome(params, profile) {
  const tab = Object.hasOwn(labels, params.get('feed')) ? params.get('feed') : 'all';
  const feature = photoFor(homeFeature);
  const posts = feedPosts(samplePosts, tab, profile);
  const results = posts.length ? communityCards(posts,profile,tab) : `<div class="surface flow following-empty">
    <h2>フォロー中のサンプルはありません</h2>
    <p>この端末で編集部をフォローすると、ここにサンプル投稿が表示されます。旅人どうしのフォローは準備中です。</p>
    ${followButton(profile)}
  </div>`;
  return `${canFeaturePhoto(feature) ? `<div class="community-feature">${photoFigure(feature,'community-feature-image',{priority:true})}</div>` : ''}
    <section class="home-section community" aria-labelledby="community-title">
      <div class="section-title"><h1 id="community-title">旅人のひとこま</h1></div>
      <nav class="feed-nav" aria-label="旅の投稿の種類">
        ${communityTabs.map(([id,label])=>`<a href="${e(homeUrl(id))}" class="feed-tab" ${id === tab ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
      </nav>
      <p class="feed-note">掲載している投稿は、編集部が作成したサンプルです。</p>
      ${results}
    </section>
    <div class="home-tools">${link('#discover','旅先を探す','compass','text-link')}${link('#nearby','寄り道を探す','pin','text-link')}${link('#stamps','旅のスタンプ帳','stamp','text-link')}</div>`;
}

export function communityDetail(post, from, profile) {
  const photo = photoFor(post.photoId);
  const returnTo = from === 'saved' ? '#saved?view=posts' : homeUrl(Object.hasOwn(labels, from) ? from : 'all');
  const reactions = profile.reactions?.[post.id] ?? [];
  return `<div class="page page-narrow reading">
    <p>${link(returnTo,from === 'saved' ? '保存した投稿へ' : '投稿一覧へ','back','text-link')}</p>
    <header class="page-title">
      <p class="eyebrow">${labels[post.kind]} · ${e(post.author.name)}</p>
      <h1>${e(post.title)}</h1>
      ${tags(post)}
    </header>
    ${photo ? photoFigure(photo) : ''}
    <div class="detail-body flow">
      <article>${post.body.map(paragraph=>`<p>${e(paragraph)}</p>`).join('')}
        ${post.stops?.length ? `<h2>旅程の例</h2><ol>${post.stops.map(stop=>`<li>${e(stop)}</li>`).join('')}</ol>` : ''}
      </article>
      <div class="actions">
        ${post.placeId ? link(`#place/${post.placeId}`,'旅先の案内を見る','arrow','button button-outline') : ''}
        ${savePostButton(post,profile)}
      </div>
      <section class="surface flow">
        <h2>旅の投稿への反応</h2>
        <p class="muted">試遊の反応はこの端末に保存されます。</p>
        <div class="actions">${reactionTypes.map(([id,label])=>`<button class="chip" type="button" data-action="reaction" data-id="${post.id}" data-value="${id}" aria-pressed="${reactions.includes(id)}">${label}</button>`).join('')}</div>
        ${followButton(profile)}
      </section>
    </div>
  </div>`;
}

export function communitySaved(profile) {
  const posts = samplePosts.filter(post => (profile.savedPosts ?? []).includes(post.id));
  return posts.length ? communityCards(posts,profile,'saved') : empty('保存した投稿がありません','投稿のハートから、この端末に保存できます。');
}
