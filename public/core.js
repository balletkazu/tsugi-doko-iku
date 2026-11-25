export const walkingLimits = [30, 60, 120];
export const routePriorities = ['移動時間', '風景', '寄り道'];

export function mapsSearch(place) {
  const url = new URL('https://www.google.com/maps/search/');
  url.search = new URLSearchParams({api:'1', query:place});
  return url.href;
}

export function mapsTransit(from, to) {
  if (!from.trim() || !to.trim()) return '';
  const url = new URL('https://www.google.com/maps/dir/');
  url.search = new URLSearchParams({api:'1', origin:from.trim(), destination:to.trim(), travelmode:'transit'});
  return url.href;
}

export function rankPlaces(places, theme, query, preferredThemes = []) {
  const needle = query.trim().normalize('NFKC').toLocaleLowerCase('ja');
  return places.filter(place => (!theme || place.theme === theme) &&
    `${place.name} ${place.region} ${place.theme} ${place.intro}`.normalize('NFKC').toLocaleLowerCase('ja').includes(needle))
    .sort((a,b) => Number(preferredThemes.includes(b.theme)) - Number(preferredThemes.includes(a.theme)));
}

export function nearbyPlaces(places, anchor, maximum = 80) {
  const radians = n => n * Math.PI / 180;
  const distance = place => {
    const lat = Math.sin(radians(place.lat - anchor.lat) / 2);
    const lng = Math.sin(radians(place.lng - anchor.lng) / 2);
    const h = lat ** 2 + Math.cos(radians(anchor.lat)) * Math.cos(radians(place.lat)) * lng ** 2;
    return 12742 * Math.asin(Math.sqrt(Math.min(h, 1)));
  };
  return places.filter(place => place.id !== anchor.id)
    .map(place => ({place, distance:distance(place)}))
    .filter(result => result.distance <= maximum)
    .sort((a,b) => a.distance - b.distance);
}

export function stampKey(collection, item) {
  return `${collection.country}/${collection.id}/${item.id}`;
}

export function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}
