// Intro and outro packs: ready-made stacks of separate clips (background, titles, stickers, sound).
// Each layer becomes its own clip, so text can be edited and every piece moved or resized.
// Layers are listed bottom to top. Layer: [kind, templateId, opts]
//   kind: 'background' | 'title' | 'element' | 'audio'   (audio = library sound id)
//   opts: { at, dur, x, y, scale, texts, colors, params }

const P = [];
const pack = (cat, id, name, dur, layers) => P.push({ id, name, cat, dur, layers: layers.map(([kind, tid, o = {}]) => ({ kind, id: tid, ...o })) });
const intro = (id, name, dur, layers) => pack('Intros', `intro-${id}`, name, dur, layers);
const outro = (id, name, dur, layers) => pack('Outros', `outro-${id}`, name, dur, layers);

// ---------------- Intros ----------------
// Professional: calm openers for lessons and company videos, each with a matching outro below.
intro('pro-block', 'Block Reveal', 5, [['background', 'bg-white', { colors: ['#f3efe6'] }], ['title', 'pro-block'], ['audio', 'sfx-swipe', { at: 0.45 }]]);
intro('pro-lesson', 'Lesson Opener', 5, [['background', 'bg-navy', { colors: ['#0f1e36'] }], ['title', 'pro-lesson'], ['audio', 'sfx-swipe', { at: 0.2 }]]);
intro('pro-panel', 'Side Panel', 5, [['background', 'bg-white', { colors: ['#f4f6f9'] }], ['title', 'pro-panel'], ['audio', 'sfx-swipe']]);
intro('pro-frame', 'Line Frame', 5, [['background', 'bg-charcoal', { colors: ['#15181d'] }], ['title', 'pro-frame']]);
intro('pro-bands', 'Bold Bands', 5, [['background', 'bg-black', { colors: ['#0e1116'] }], ['title', 'pro-bands'], ['audio', 'sfx-whoosh', { at: 0.05 }]]);
intro('pro-agenda', 'Lesson Agenda', 5, [['background', 'bg-white', { colors: ['#f7f7fb'] }], ['title', 'pro-agenda'], ['audio', 'sfx-swipe', { at: 0.1 }]]);
intro('pro-chart', 'Chart Rise', 5, [['background', 'bg-black', { colors: ['#111827'] }], ['title', 'pro-chart'], ['audio', 'sfx-whoosh', { at: 0.15 }]]);
intro('pro-number', 'Chapter Number', 5, [['background', 'bg-charcoal', { colors: ['#18181b'] }], ['title', 'pro-number'], ['audio', 'sfx-swipe', { at: 0.35 }]]);
intro('pro-monogram', 'Monogram', 5, [['background', 'bg-white'], ['title', 'pro-monogram'], ['audio', 'sfx-pop', { at: 0.1 }]]);
intro('pro-shutter', 'Shutter', 5, [['background', 'bg-white', { colors: ['#fdf6e3'] }], ['title', 'pro-shutter'], ['audio', 'sfx-swipe', { at: 0.35 }]]);
intro('neon', 'Neon Nights', 5, [['background', 'bg-synth'], ['title', 'open-retro'], ['element', 'el-sparkle-burst', { at: 0.4, dur: 3 }], ['audio', 'sfx-whoosh']]);
intro('cinematic', 'Cinematic Opener', 6, [['background', 'bg-stars'], ['title', 'open-cinematic'], ['element', 'el-frame-bars'], ['audio', 'sfx-boom', { at: 0.2 }]]);
intro('vlog', 'Hey Vlog', 5, [['background', 'bg-g-sunset'], ['title', 'open-vlog'], ['element', 'emo-wave', { x: 0.3, y: -0.25, scale: 0.45 }], ['audio', 'sfx-pop', { at: 0.3 }]]);
intro('welcome', 'Welcome to the Channel', 5, [['background', 'bg-flow'], ['title', 'open-welcome'], ['element', 'el-confetti', { at: 0.5, dur: 4 }], ['audio', 'sfx-success', { at: 0.4 }]]);
intro('corporate', 'Clean Corporate', 5, [['background', 'bg-r-studio-grey'], ['element', 'el-bars'], ['title', 'open-brand'], ['audio', 'sfx-swipe']]);
intro('glitch', 'Glitch Tech', 5, [['background', 'bg-particles'], ['element', 'el-rings'], ['title', 'cine-glitch-logo'], ['audio', 'sfx-glitch']]);
intro('elegant', 'Elegant Script', 6, [['background', 'bg-bokeh'], ['element', 'el-dust'], ['title', 'open-elegant']]);
intro('logo', 'Logo Reveal', 5, [['background', 'bg-g-night-sky'], ['element', 'el-logo-badge', { y: -0.08, params: { initials: 'AB' } }], ['title', 'basic-track', { y: 0.26, scale: 0.55, texts: ['YOUR BRAND'] }], ['element', 'el-light-sweep', { at: 0.9, dur: 2.5 }], ['audio', 'sfx-magic', { at: 0.2 }]]);
intro('leader', 'Film Leader Countdown', 5, [['background', 'bg-leader'], ['element', 'el-frame-film'], ['audio', 'sfx-tick']]);
intro('travel', 'Travel Journal', 5, [['background', 'bg-beach'], ['title', 'open-split', { texts: ['WANDER', 'LUST'] }], ['title', 'lt-location', { at: 1.2, dur: 3.8 }], ['audio', 'sfx-whoosh']]);
intro('kinetic', 'Kinetic Bold', 4, [['background', 'bg-black'], ['element', 'el-speed-lines'], ['title', 'open-kinetic'], ['audio', 'sfx-hit']]);
intro('year', 'Year in Review', 5, [['background', 'bg-r-red-glow'], ['title', 'open-year'], ['element', 'el-sparkle-burst', { at: 0.6, dur: 3 }]]);
intro('neon-sign', 'Neon Sign', 5, [['background', 'bg-r-purple-glow'], ['element', 'el-dust'], ['title', 'open-neon-sign']]);
intro('gaming', 'Level Up Gaming', 5, [['background', 'bg-tunnel'], ['element', 'el-speed-lines'], ['title', 'fun-pixel', { texts: ['LET’S PLAY!', 'PRESS START'] }], ['audio', 'sfx-level-up', { at: 0.3 }]]);
intro('comic', 'Comic Pow', 3, [['background', 'bg-sunburst'], ['title', 'fun-comic', { texts: ['HELLO!'] }], ['audio', 'sfx-hit']]);
intro('news', 'Breaking News', 5, [['background', 'bg-g-royal'], ['title', 'open-box'], ['title', 'lt-news', { at: 0.8, dur: 4.2 }], ['audio', 'sfx-notify']]);
intro('lesson', 'Chalk Lesson', 5, [['background', 'bg-chalkboard'], ['title', 'basic-marker', { texts: ['Lesson 1'] }], ['element', 'el-underline', { y: 0.06, at: 0.6, dur: 4.4 }]]);
intro('countdown', 'Countdown', 4, [['background', 'bg-r-blue-glow'], ['title', 'open-countdown'], ['audio', 'sfx-tick']]);
intro('aurora', 'Aurora Dream', 6, [['background', 'bg-aurora'], ['element', 'el-dust'], ['title', 'open-minimal']]);
intro('chrome', 'Chrome Legend', 5, [['background', 'bg-g-electric'], ['title', 'open-chrome'], ['element', 'el-light-sweep', { at: 1.2, dur: 2.5 }], ['audio', 'sfx-riser', { dur: 3 }]]);
intro('stomp', 'Stomp', 4, [['background', 'bg-stripes'], ['title', 'open-stomp'], ['audio', 'sfx-boom']]);
intro('chill', 'Chill Vibes', 6, [['background', 'bg-fireflies'], ['element', 'el-bubbles'], ['title', 'basic-script', { texts: ['chill vibes'] }]]);
intro('party', 'Party Time', 5, [['background', 'bg-confetti-fall'], ['title', 'fun-rainbow'], ['element', 'emo-party', { x: 0.33, y: -0.28, scale: 0.4 }], ['audio', 'sfx-success']]);
intro('podcast', 'Podcast Episode', 5, [['background', 'bg-m-ocean-mesh'], ['element', 'el-rings'], ['title', 'open-welcome', { texts: ['EPISODE 24', 'The Big Talk'] }], ['audio', 'sfx-swipe']]);
intro('hacker', 'Access Granted', 5, [['background', 'bg-code-rain'], ['element', 'el-corner-frame'], ['title', 'basic-glitch', { texts: ['ACCESS GRANTED'] }], ['audio', 'sfx-glitch']]);

// ---------------- Outros ----------------
// Professional: the matching closers for the professional intros above.
outro('pro-block', 'Block Reveal Thanks', 6, [['background', 'bg-white', { colors: ['#f3efe6'] }], ['title', 'pro-block-end']]);
outro('pro-lesson', 'Lesson Complete', 6, [['background', 'bg-navy', { colors: ['#0f1e36'] }], ['title', 'pro-lesson-end'], ['audio', 'sfx-ding', { at: 1.0 }]]);
outro('pro-panel', 'Side Panel Contact', 6, [['background', 'bg-white', { colors: ['#f4f6f9'] }], ['title', 'pro-panel-end']]);
outro('pro-frame', 'Line Frame Questions', 6, [['background', 'bg-charcoal', { colors: ['#15181d'] }], ['title', 'pro-frame-end']]);
outro('pro-bands', 'Bold Bands Thanks', 6, [['background', 'bg-black', { colors: ['#0e1116'] }], ['title', 'pro-bands-end'], ['audio', 'sfx-swipe', { at: 5.3 }]]);
outro('pro-agenda', 'Lesson Recap', 6, [['background', 'bg-white', { colors: ['#f7f7fb'] }], ['title', 'pro-agenda-end'], ['audio', 'sfx-ding', { at: 1.5 }]]);
outro('pro-chart', 'Chart Rise Thanks', 6, [['background', 'bg-black', { colors: ['#111827'] }], ['title', 'pro-chart-end']]);
outro('pro-number', 'Chapter Complete', 6, [['background', 'bg-charcoal', { colors: ['#18181b'] }], ['title', 'pro-number-end']]);
outro('pro-monogram', 'Monogram Contact', 6, [['background', 'bg-white'], ['title', 'pro-monogram-end']]);
outro('pro-shutter', 'Shutter Close', 6, [['background', 'bg-white', { colors: ['#fdf6e3'] }], ['title', 'pro-shutter-end'], ['audio', 'sfx-swipe', { at: 5.4 }]]);
outro('endscreen', 'End Screen', 8, [['background', 'bg-flow'], ['element', 'el-endcards'], ['title', 'end-thanks', { y: -0.3, scale: 0.6, texts: ['Thanks for watching!', ''] }], ['title', 'social-subscribe', { y: 0.06 }]]);
outro('neon-thanks', 'Neon Thanks', 6, [['background', 'bg-synth'], ['title', 'end-thanks'], ['element', 'el-confetti', { at: 0.6, dur: 4 }]]);
outro('credits', 'Rolling Credits', 12, [['background', 'bg-black'], ['title', 'end-roll']]);
outro('coming', 'Coming Soon', 6, [['background', 'bg-stars'], ['title', 'end-coming'], ['element', 'el-light-sweep', { at: 1.6, dur: 2.5 }]]);
outro('follow', 'Follow Me', 6, [['background', 'bg-g-purple-haze'], ['title', 'end-see-you', { y: -0.12, texts: ['Follow for more', '@yourchannel'] }], ['title', 'social-like', { at: 0.8, dur: 5.2 }]]);
outro('the-end', 'The End', 6, [['background', 'bg-charcoal'], ['title', 'end-chapter', { texts: ['FIN', 'The End'] }], ['element', 'el-frame-vignette']]);
outro('logo', 'Logo Outro', 6, [['background', 'bg-bokeh'], ['element', 'el-logo-badge', { y: -0.08, params: { initials: 'AB' } }], ['title', 'basic-fade', { y: 0.27, scale: 0.5, texts: ['yourwebsite.com'] }]]);
outro('see-ya', 'See Ya!', 3, [['background', 'bg-g-fire'], ['title', 'fun-comic', { texts: ['SEE YA!'] }], ['element', 'el-confetti'], ['audio', 'sfx-pop']]);
outro('subscribe', 'Subscribe Reminder', 6, [['background', 'bg-r-red-glow'], ['title', 'end-subscribe-text', { y: -0.08 }], ['title', 'social-subscribe', { at: 1.2, dur: 4.8, y: 0.06 }], ['audio', 'sfx-click', { at: 2.6 }]]);
outro('next-time', 'See You Next Time', 6, [['background', 'bg-mountains'], ['element', 'el-dust'], ['title', 'end-see-you']]);
outro('like-share', 'Like & Share', 6, [['background', 'bg-g-ocean'], ['title', 'end-thanks', { y: -0.18, scale: 0.8, texts: ['Thanks for watching!', ''] }], ['title', 'social-like', { at: 0.6, dur: 5.4 }], ['element', 'emo-thumbs-up', { x: 0.36, y: -0.3, scale: 0.35 }]]);
outro('quote', 'Closing Quote', 7, [['background', 'bg-black'], ['title', 'call-quote']]);
outro('chalk', 'Class Dismissed', 5, [['background', 'bg-chalkboard'], ['title', 'basic-marker', { texts: ['Thanks for learning!'] }], ['element', 'el-check', { x: 0.32, y: -0.25, scale: 0.45, at: 0.8, dur: 4.2 }], ['audio', 'sfx-ding', { at: 0.9 }]]);
outro('neon-bye', 'Neon Goodbye', 5, [['background', 'bg-tunnel'], ['title', 'open-neon-sign', { texts: ['BYE', 'see you soon'] }]]);
outro('party', 'Party Outro', 5, [['background', 'bg-confetti-fall'], ['title', 'fun-rainbow', { texts: ['THANKS!'] }], ['element', 'emo-party', { x: -0.33, y: -0.28, scale: 0.4 }], ['audio', 'sfx-applause', { dur: 4 }]]);
outro('next-year', 'See You Next Year', 5, [['background', 'bg-r-blue-glow'], ['title', 'open-year', { texts: ['2027', 'SEE YOU NEXT YEAR'] }], ['element', 'el-sparkle-burst', { at: 0.8, dur: 3 }]]);
outro('comment', 'Comment Below', 6, [['background', 'bg-m-berry-mesh'], ['title', 'social-comment'], ['title', 'basic-bounce', { y: 0.12, scale: 0.6, texts: ['COMMENT BELOW!'] }], ['element', 'el-arrow-bounce', { y: 0.3, scale: 0.5, at: 1, dur: 5 }]]);
outro('gg', 'GG Gaming', 5, [['background', 'bg-hex-pulse'], ['title', 'fun-pixel', { texts: ['GG!', 'THANKS FOR PLAYING'] }], ['element', 'el-sparkle-burst', { at: 0.5, dur: 3 }], ['audio', 'sfx-coin', { at: 0.4 }]]);
outro('contact', 'Contact Card', 6, [['background', 'bg-r-studio-grey'], ['element', 'el-bars'], ['title', 'open-brand', { texts: ['THANK YOU', 'hello@company.com'] }]]);
outro('travel', 'Next Adventure', 6, [['background', 'bg-beach'], ['title', 'end-see-you', { texts: ['Until the next adventure', '@travelwithme'] }], ['element', 'emo-camera', { x: 0.35, y: -0.3, scale: 0.35 }]]);
outro('cinema', 'Cinematic Ending', 6, [['background', 'bg-stars'], ['title', 'cine-bars-title', { texts: ['THE END'] }]]);
outro('goodnight', 'Good Night', 6, [['background', 'bg-night-city'], ['title', 'basic-script', { texts: ['Good night'], y: -0.15 }], ['element', 'emo-sleepy', { x: 0.32, y: -0.3, scale: 0.35 }]]);
outro('watch-next', 'Watch Next', 8, [['background', 'bg-flow'], ['element', 'el-endcards'], ['title', 'basic-fade', { y: -0.3, scale: 0.6, texts: ['Watch these next'] }], ['element', 'el-arrow-bounce', { y: 0.33, scale: 0.45 }]]);
outro('swipe', 'Swipe Up', 6, [['background', 'bg-g-lavender'], ['title', 'end-thanks', { y: -0.15, texts: ['Thanks for watching!', ''] }], ['title', 'social-swipe']]);
outro('stay-tuned', 'Stay Tuned', 5, [['background', 'bg-sunburst'], ['title', 'basic-zoom', { texts: ['STAY TUNED'] }], ['element', 'el-loading', { y: 0.28, scale: 0.6, at: 0.8, dur: 4.2 }]]);

export const PACKS = P;
export const PACK_CATS = ['Intros', 'Outros'];
export const packById = (id) => P.find((p) => p.id === id);
