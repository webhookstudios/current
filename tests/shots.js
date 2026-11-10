// Screenshots: start-screen template cards and the Arrows sticker category.
const OUT = new URL('./out/', import.meta.url).pathname;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(1200);
const main = document.querySelector('.start-main');
main.scrollTop = 140;
await wait(300);
await window.native.selftestCapture(OUT + '3-templates.png');
document.querySelector('.start button.primary').click();
await wait(300);
document.querySelector('.lib-tab[data-tab="element"]').click();
await wait(200);
[...document.querySelectorAll('.lib-cat')].find((c) => c.textContent.startsWith('Arrows')).click();
await wait(800);
await window.native.selftestCapture(OUT + '3-arrows.png');
window.native.selftestDone(0);
