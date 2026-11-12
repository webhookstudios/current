// Favorites: a star on every library card in Audio, Sequences, Titles, Transitions, Effects, Filters
// and Stickers, a Favorites group in each of those tabs, kept between sessions.
const base = new URL('../src/js/', import.meta.url).href;
const log = (...a) => console.log('[test]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const check = (ok, msg) => { if (!ok) bad++; log(ok ? 'ok  ' : 'FAIL', msg); };
try {
  localStorage.removeItem('current.favorites');
  document.querySelector('.start button.primary')?.click();
  const L = await import(base + 'ui/library.js');
  const cats = () => [...document.querySelectorAll('#library .lib-cat')];
  const cat = (name) => cats().find((c) => c.dataset.cat === name);
  const tabs = [['audio', 'Music'], ['pack', 'Intros'], ['title', 'All'], ['transition', 'All'], ['effect', 'All'], ['filter', 'All'], ['element', 'All']];
  for (const [tab, first] of tabs) {
    L.setTab(tab); await wait(150);
    const names = cats().map((c) => c.dataset.cat);
    check(names.includes('Favorites') && document.querySelector('#library .lib-cat.active')?.dataset.cat !== 'Favorites', `${tab}: has a Favorites group, and it is not opened by default (${names.slice(0, 3).join(', ')}…)`);
    cat(first === 'All' ? names.find((n) => n !== 'All' && n !== 'Favorites') : first).click(); await wait(150);
    const cards = [...document.querySelectorAll('#library .grid .card')];
    const pick = cards[1], name = pick.querySelector('.name').textContent;
    check(cards.every((c) => c.querySelector('.fav')), `${tab}: every card has a star (${cards.length})`);
    pick.querySelector('.fav').click(); await wait(100);
    check(pick.querySelector('.fav').classList.contains('on') && pick.querySelector('.fav').title === 'Remove from Favorites', `${tab}: starring “${name}” fills its star`);
    check(cat('Favorites').querySelector('span').textContent === '1', `${tab}: Favorites shows a count of 1`);
    cat('Favorites').click(); await wait(150);
    const favCards = [...document.querySelectorAll('#library .grid .card')];
    check(favCards.length === 1 && favCards[0].querySelector('.name').textContent === name, `${tab}: Favorites lists “${name}”`);
  }
  const saved = JSON.parse(localStorage.getItem('current.favorites') || '[]');
  check(saved.length === 7, `all seven are saved for next time (${saved.join(', ')})`);
  // un-star from inside Favorites: the card leaves and the empty note shows
  L.setTab('element'); cat('Favorites').click(); await wait(150);
  document.querySelector('#library .grid .card .fav').click(); await wait(150);
  check(!document.querySelector('#library .grid .card') && /Nothing starred yet/.test(document.querySelector('#library .grid .empty-note')?.textContent || ''), 'un-starring inside Favorites removes it and explains how to star');
  check(cat('Favorites').querySelector('span').textContent === '', 'the Favorites count clears');
  // media and project audio have no star
  L.setTab('media'); await wait(150);
  check(!document.querySelector('#library .grid .card .fav') && !cats().some((c) => c.dataset.cat === 'Favorites'), 'Media has no stars or Favorites group');
  // search still finds starred items once, from every group
  L.setTab('title'); const q = document.querySelector('#library .search input');
  const starredTitle = saved.find((k) => k.startsWith('title:')).slice(6);
  const { titleById } = await import(base + 'templates/titles.js');
  q.value = titleById(starredTitle).name; q.dispatchEvent(new Event('input')); await wait(150);
  const hits = [...document.querySelectorAll('#library .grid .card .name')].filter((n) => n.textContent === titleById(starredTitle).name);
  check(hits.length === 1, `search lists a starred title once (${hits.length})`);
  q.value = ''; q.dispatchEvent(new Event('input'));
  localStorage.removeItem('current.favorites');
} catch (e) { bad++; log('FAIL error', e.stack || e.message); }
log(bad ? `${bad} FAILED` : 'ALL OK');
window.native.selftestDone(bad ? 1 : 0);
