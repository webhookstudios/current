// Starter video templates offered on the start screen. New projects start blank unless one is picked.
// Each builds a timeline from an intro, placeholder scenes (swap in your own clips by dropping them on
// the main track), optional title overlays, an outro and a music bed.
//   introTexts: optional replacement text for the intro's main title.
//   scene: [label, seconds, background, transitionIn, overlay]  overlay: [titleId, texts] shown on top

export const PROJECT_TEMPLATES = [
  {
    id: 'vlog', name: 'YouTube Vlog', aspect: '16:9', music: 'm-acoustic', preview: 'intro-vlog',
    desc: 'Friendly intro, three scenes with captions, and an end screen with subscribe.',
    intro: 'intro-vlog', outro: 'outro-endscreen',
    scenes: [['Your opening shot', 6, 'bg-g-sunset', 'whip-pan', ['lt-pill', ['Your Name', 'Vlog · Day 1']]], ['Main moment', 8, 'bg-g-ocean', 'whip-pan', ['sub-box', ['Add a caption here']]], ['Wrap up', 6, 'bg-g-peach', 'dissolve', null]],
  },
  {
    id: 'travel', name: 'Travel Montage', aspect: '16:9', music: 'm-inspire', preview: 'intro-travel',
    desc: 'Location titles over quick cuts with light-leak transitions.',
    intro: 'intro-travel', outro: 'outro-travel',
    scenes: [['City', 4, 'bg-night-city', 'light-leak', ['lt-location', ['Lisbon, Portugal', '38.72° N, 9.14° W']]], ['Coast', 4, 'bg-beach', 'light-leak', ['lt-location', ['Algarve Coast', '37.02° N, 7.93° W']]], ['Mountains', 4, 'bg-mountains', 'light-leak', ['lt-location', ['Serra da Estrela', '40.32° N, 7.61° W']]], ['Sunset', 4, 'bg-g-sunset', 'film-burn', null]],
  },
  {
    id: 'promo', name: 'Product Promo', aspect: '16:9', music: 'm-edm', preview: 'intro-corporate',
    desc: 'Brand reveal, three feature callouts with a sale badge, and a contact card.',
    intro: 'intro-corporate', outro: 'outro-contact',
    scenes: [['Product hero shot', 5, 'bg-r-teal-glow', 'zoom-in', ['open-box', ['NEW', 'Meet the product']]], ['Feature 1', 4, 'bg-m-ocean-mesh', 'push-left', ['call-step', ['1', 'Lightning fast']]], ['Feature 2', 4, 'bg-m-berry-mesh', 'push-left', ['call-step', ['2', 'Built to last']]], ['Offer', 4, 'bg-sunburst', 'flash', ['call-sale', ['30%', 'OFF']]]],
  },
  {
    id: 'tutorial', name: 'Tutorial / How-To', aspect: '16:9', music: 'm-piano', preview: 'intro-lesson',
    desc: 'Lesson title, numbered steps with highlights, and a class-dismissed ending.',
    intro: 'intro-lesson', outro: 'outro-chalk',
    scenes: [['Step 1 screen recording', 8, 'bg-grid-paper', 'slide-in-left', ['call-step', ['1', 'Open the settings']]], ['Step 2 screen recording', 8, 'bg-grid-paper', 'slide-in-left', ['call-step', ['2', 'Choose your options']]], ['Step 3 screen recording', 8, 'bg-grid-paper', 'slide-in-left', ['call-step', ['3', 'Save and you are done']]]],
  },
  {
    id: 'podcast', name: 'Podcast Clip', aspect: '1:1', music: 'm-chillwave', preview: 'intro-podcast',
    desc: 'Square clip with an episode intro, speaker name and word-by-word captions.',
    intro: 'intro-podcast', outro: 'outro-subscribe',
    scenes: [['Speaker camera', 12, 'bg-r-studio-grey', 'dissolve', ['sub-karaoke', ['Every word lights up as it is spoken']]]],
  },
  {
    id: 'reel', name: 'Reel / Short', aspect: '9:16', music: 'm-funk', preview: 'intro-comic',
    desc: 'Vertical, fast-paced: bold hook text, quick cuts and a follow prompt.',
    intro: 'intro-comic', outro: 'outro-swipe',
    scenes: [['Hook shot', 3, 'bg-g-cotton-candy', 'punch', ['sub-creator', ['WAIT FOR IT...']]], ['Clip 2', 3, 'bg-g-lavender', 'glitch', null], ['Clip 3', 3, 'bg-g-citrus', 'whip-vertical', ['sub-creator', ['NO WAY!']]], ['Payoff', 3, 'bg-g-lime-punch', 'zoom-out', null]],
  },
  {
    id: 'birthday', name: 'Birthday Celebration', aspect: '16:9', music: 'm-kids', preview: 'intro-party',
    desc: 'Party intro with confetti, photo slideshow scenes and a thank-you outro.',
    intro: 'intro-party', outro: 'outro-party',
    scenes: [['Photo 1', 4, 'bg-dots', 'heart', ['fun-sticker-text', ['so cute!']]], ['Photo 2', 4, 'bg-hearts', 'circle-open', null], ['Photo 3', 4, 'bg-confetti-fall', 'star', ['basic-bounce', ['HAPPY BIRTHDAY!']]]],
  },
  {
    id: 'gaming', name: 'Gaming Highlights', aspect: '16:9', music: 'm-dark', preview: 'intro-gaming',
    desc: 'Level-up intro, glitchy cuts between plays, kill-cam captions and a GG outro.',
    intro: 'intro-gaming', outro: 'outro-gg',
    scenes: [['Play 1', 6, 'bg-tunnel', 'glitch', ['sub-creator', ['CLUTCH!']]], ['Play 2', 6, 'bg-hex-pulse', 'rgb-split', ['sub-creator', ['1 v 4']]], ['Play 3', 6, 'bg-code-rain', 'digital', ['fun-comic', ['BOOM!']]]],
  },
  {
    id: 'wedding', name: 'Wedding & Events', aspect: '16:9', music: 'm-piano', preview: 'intro-elegant',
    desc: 'Elegant script titles, soft dissolves, a film look and a closing quote.',
    intro: 'intro-elegant', outro: 'outro-quote',
    scenes: [['Ceremony', 7, 'bg-bokeh', 'blur-dissolve', ['open-elegant', ['The Ceremony', 'JUNE 14 · 2026']]], ['First dance', 7, 'bg-r-warm-glow', 'blur-dissolve', null], ['Celebration', 7, 'bg-fireflies', 'dreamy', ['end-chapter', ['THE PARTY', 'Dancing all night']]]],
  },
  {
    id: 'family', name: 'Family Memories', aspect: '16:9', music: 'm-acoustic', preview: 'intro-welcome', introTexts: ['WELCOME TO THE', 'Johnson Family'],
    desc: 'Warm and gentle: instant-photo frames, soft dissolves, name captions and a heartfelt ending.',
    intro: 'intro-welcome', outro: 'outro-next-time',
    scenes: [['Family photo or clip', 5, 'bg-r-warm-glow', 'blur-dissolve', ['el-frame-polaroid', { caption: 'the whole gang ♥' }]], ['Kids playing', 5, 'bg-g-peach', 'blur-dissolve', ['lt-glass', ['Mia & Leo', 'Summer at Grandma\u2019s']]], ['Holiday moment', 5, 'bg-bokeh', 'blur-dissolve', ['el-frame-polaroid', { caption: 'best day ever' }]], ['Together', 5, 'bg-fireflies', 'dreamy', ['end-see-you', ['Love you all', 'The Johnson Family']]]],
  },
  {
    id: 'travel-highlights', name: 'Travel Highlights', aspect: '16:9', music: 'm-epic', preview: 'intro-cinematic',
    desc: 'Cinematic highlight reel: letterbox opener, fast whip cuts, map-pin titles and a coming-soon ending.',
    intro: 'intro-cinematic', outro: 'outro-coming',
    scenes: [['Arrival shot', 3, 'bg-mountains', 'whip-pan', ['cine-bars-title', ['ICELAND']]], ['Adventure clip', 3, 'bg-aurora', 'whip-pan', ['lt-location', ['Reykjavík', '64.14° N, 21.94° W']]], ['Drone shot', 3, 'bg-clouds', 'zoom-in', null], ['Night clip', 3, 'bg-stars', 'whip-pan', ['cine-date', ['MAR 02 2026', '11:48 PM']]], ['Final view', 4, 'bg-g-sunset', 'film-burn', ['open-split', ['WILD', 'NORTH']]]],
  },
  {
    id: 'recap', name: 'Year in Review', aspect: '16:9', music: 'm-epic', preview: 'intro-year',
    desc: 'Big-year opener, month-by-month chapter cards and a see-you-next-year ending.',
    intro: 'intro-year', outro: 'outro-next-year',
    scenes: [['January highlight', 4, 'bg-snowfall', 'cube-left', ['end-chapter', ['JANUARY', 'A fresh start']]], ['Spring highlight', 4, 'bg-g-mint', 'cube-left', ['end-chapter', ['SPRING', 'Something new']]], ['Summer highlight', 4, 'bg-beach', 'cube-left', ['end-chapter', ['SUMMER', 'The best days']]], ['Winter highlight', 4, 'bg-night-city', 'cube-left', ['end-chapter', ['WINTER', 'Home again']]]],
  },
];
