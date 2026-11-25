import { escapeHtml as e } from './core.js';
import { communityTabs, editorial, feedPosts, reactionTypes, samplePosts, searchPosts } from './community-data.js';
import { photoCredit, photoFigure, photoFor, renderPhoto } from './photos.js';
import { empty, icon, link } from './ui.js';

const labels = Object.fromEntries(communityTabs);
export const findSamplePost = id => samplePosts.find(post => post.id === id);
export function homeUrl(feed = 'all', query = '') {
  const params = new URLSearchParams();
  if (feed !== 'all') params.set('feed',feed);
  if (query) params.set('q',query);
  return params.size ? `#home?${params}` : '#home';
}

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
  return `<ul class="post-tags" aria-label="タグ">${post.tags.map(tag=>`<li><a href="${e(homeUrl('all',`#${tag}`))}">#${e(tag)}</a></li>`).join('')}</ul>`;
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
  const query = (params.get('q') ?? '').slice(0,80);
  const results = searchPosts(feedPosts(samplePosts,tab,profile),query);
  const cards = results.length ? communityCards(results,profile,tab) :
    tab === 'following' && !(profile.sampleFollows ?? []).includes(editorial.id) ? `<div class="surface flow following-empty">
      <h2>フォロー中のサンプルはありません</h2>
      <p>編集部のサンプルをフォローすると、ここに表示されます。</p>${followButton(profile)}
    </div>` : empty('見つかりませんでした','キーワードや #タグを変えてお試しください。');
  return `<section class="home-section community" aria-labelledby="community-title">
    <div class="section-title community-title"><h1 id="community-title">旅人のひとこま</h1>
      ${link('#photos/new','投稿を書く','edit')}</div>
    <form id="community-search" class="search" data-feed="${tab}">
      <label><span class="visually-hidden">投稿やハッシュタグを検索</span><input type="search" name="q" value="${e(query)}" maxlength="80" placeholder="投稿・ #タグ を探す"></label>
      <button class="button button-outline">検索</button>
    </form>
    <nav class="feed-nav" aria-label="旅の投稿の種類">
      ${communityTabs.map(([id,label])=>`<a href="${e(homeUrl(id,query))}" class="feed-tab" ${id === tab ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
    </nav>
    <div class="feed-meta"><p class="feed-note">編集部のサンプル投稿${query ? ` · ${results.length}件` : ''}</p>
      ${query ? link(homeUrl(tab),'検索をクリア',null,'text-link') : link('#opening-photo','ここは、どこ？',null,'text-link')}
    </div>
    ${cards}
  </section><div class="home-tools">${link('#photos','投稿の下書き','edit','text-link')}${link('#discover','旅先を探す','compass','text-link')}${link('#nearby','寄り道を探す','pin','text-link')}${link('#stamps','旅のスタンプ帳','stamp','text-link')}</div>`;
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
        ${photo ? `<button type="button" class="button button-outline" data-album="sample" data-picture-id="${post.photoId}">写真を全画面で見る</button>` : ''}
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
