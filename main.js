// ============================================================
// MARQUEE: duplicate track content once so the CSS loop (0 -> -50%)
// is seamless, unless the visitor asked for reduced motion.
// ============================================================
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.marquee__track').forEach((track) => {
    track.innerHTML += track.innerHTML;
    track.querySelectorAll(':scope > *:nth-child(n + ' + (track.children.length / 2 + 1) + ')').forEach((el) => {
      el.setAttribute('aria-hidden', 'true');
    });
  });
}

// ============================================================
// IMAGE SLOTS: neutral empty-state placeholder (icon), matching the
// design handoff's <image-slot> component — no photo was supplied for
// these spots, so they stay as placeholders until real photos are added.
// ============================================================
const IMG_SLOT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle>' +
  '<path d="m21 15-5-5L5 21"></path></svg>';
document.querySelectorAll('.img-slot').forEach((slot) => {
  slot.innerHTML = IMG_SLOT_ICON;
});

// ============================================================
// NAV: scroll effect, smooth scroll, scroll-spy, mobile menu
// ============================================================
const nav = document.getElementById('nav');

const navLinks = document.querySelectorAll('.nav__link[data-scroll-to], .nav__mobile button[data-scroll-to]');
const scrollTriggers = document.querySelectorAll('[data-scroll-to]');

function scrollToSection(key) {
  const target = document.getElementById(key);
  if (!target) return;
  const top = target.getBoundingClientRect().top + window.pageYOffset - 80;
  window.scrollTo({ top, behavior: 'smooth' });
}

scrollTriggers.forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    scrollToSection(el.getAttribute('data-scroll-to'));
  });
});

// Scroll-spy: highlight active nav item based on visible section
const observedSections = document.querySelectorAll('[data-observe]');
if (observedSections.length && navLinks.length) {
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const key = entry.target.getAttribute('data-observe');
        navLinks.forEach((link) => {
          link.classList.toggle('is-active', link.getAttribute('data-scroll-to') === key);
        });
      });
    },
    { rootMargin: '-40% 0px -50% 0px' }
  );
  observedSections.forEach((section) => spy.observe(section));
}

// Mobile menu
const hamburger = document.querySelector('.nav__hamburger');
const mobileMenu = document.querySelector('.nav__mobile');
hamburger?.addEventListener('click', () => {
  const open = mobileMenu.classList.toggle('is-open');
  hamburger.setAttribute('aria-expanded', open);
});
mobileMenu?.querySelectorAll('a, button').forEach((el) => {
  el.addEventListener('click', () => {
    mobileMenu.classList.remove('is-open');
    hamburger?.setAttribute('aria-expanded', 'false');
  });
});

// ============================================================
// iOS DEVICE FRAME: inject dynamic island / status bar / home indicator
// ============================================================
function buildStatusIcons(color) {
  return `
    <svg width="19" height="12" viewBox="0 0 19 12">
      <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill="${color}"/>
      <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill="${color}"/>
      <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill="${color}"/>
      <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill="${color}"/>
    </svg>
    <svg width="17" height="12" viewBox="0 0 17 12">
      <path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" fill="${color}"/>
      <path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" fill="${color}"/>
      <circle cx="8.5" cy="10.5" r="1.5" fill="${color}"/>
    </svg>
    <svg width="27" height="13" viewBox="0 0 27 13">
      <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="${color}" stroke-opacity="0.35" fill="none"/>
      <rect x="2" y="2" width="20" height="9" rx="2" fill="${color}"/>
      <path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill="${color}" fill-opacity="0.4"/>
    </svg>`;
}

document.querySelectorAll('.ios-frame').forEach((frame) => {
  const dark = frame.classList.contains('ios-frame--dark');
  const color = dark ? '#fff' : '#000';

  const island = document.createElement('div');
  island.className = 'ios-frame__island';
  frame.prepend(island);

  const status = document.createElement('div');
  status.className = 'ios-frame__status';
  status.innerHTML = `<span class="ios-frame__time" style="color:${color};">9:41</span><div class="ios-frame__icons">${buildStatusIcons(color)}</div>`;
  frame.prepend(status);

  const home = document.createElement('div');
  home.className = 'ios-frame__home-indicator';
  home.innerHTML = '<span></span>';
  frame.append(home);
});

// ============================================================
// APP TAB BAR: render bottom nav (home/search/favourites/post)
// ============================================================
const TAB_ICONS = {
  home: (c) => `<svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 9l7-6 7 6v8a1 1 0 01-1 1h-4v-6H8v6H4a1 1 0 01-1-1V9z" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"></path></svg>`,
  search: (c) => `<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="9" cy="9" r="6" fill="none" stroke="${c}" stroke-width="1.6"></circle><path d="M14 14l4 4" stroke="${c}" stroke-width="1.6" stroke-linecap="round"></path></svg>`,
  favourites: (c, active) => `<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 17s-7-4.4-7-9.7C3 4.4 5.2 3 7.3 3 8.9 3 10 4 10 4s1.1-1 2.7-1C14.8 3 17 4.4 17 7.3 17 12.6 10 17 10 17z" fill="${active ? c : 'none'}" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"></path></svg>`,
  post: (c, active) => `<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="${active ? c : 'none'}" stroke="${c}" stroke-width="1.5"></circle><path d="M10 6.5v7M6.5 10h7" stroke="${active ? '#fff' : c}" stroke-width="1.5" stroke-linecap="round"></path></svg>`,
};
const TAB_ORDER = ['home', 'search', 'favourites', 'post'];
const TAB_LABELS = { home: 'Home', search: 'Search', favourites: 'Favourites', post: 'Post' };
const TAB_TONES = {
  wire: { active: '#3A3742', inactive: '#8B8776' },
  final: { active: '#FF6B4A', inactive: { icon: '#221E2A', label: '#6E6876' } },
};

document.querySelectorAll('.app-tabbar').forEach((bar) => {
  const activeKey = bar.getAttribute('data-tabbar-active');
  const tone = TAB_TONES[bar.getAttribute('data-tabbar-tone') || 'final'];
  bar.innerHTML = TAB_ORDER.map((key) => {
    const isActive = key === activeKey;
    let iconColor, labelColor, weight;
    if (bar.getAttribute('data-tabbar-tone') === 'wire') {
      iconColor = isActive ? tone.active : tone.inactive;
      labelColor = iconColor;
      weight = isActive ? '600' : '400';
    } else {
      iconColor = isActive ? tone.active : tone.inactive.icon;
      labelColor = isActive ? tone.active : tone.inactive.label;
      weight = isActive ? '600' : '400';
    }
    return `<div class="app-tabbar__item">${TAB_ICONS[key](iconColor, isActive)}<span style="color:${labelColor};font-weight:${weight};">${TAB_LABELS[key]}</span></div>`;
  }).join('');
});

// ============================================================
// MUNCH: interactive Confirm & Split -> push notification
// ============================================================
const confirmBtn = document.getElementById('confirmSplitBtn');
const notificationBanner = document.getElementById('notificationBanner');
const replayBtn = document.getElementById('replayNotificationBtn');

confirmBtn?.addEventListener('click', () => {
  notificationBanner?.classList.add('is-visible');
});
replayBtn?.addEventListener('click', () => {
  notificationBanner?.classList.remove('is-visible');
  requestAnimationFrame(() => {
    setTimeout(() => notificationBanner?.classList.add('is-visible'), 50);
  });
});

// ============================================================
// TOKENIZED: podcast waveform
// ============================================================
const waveform = document.getElementById('waveform');
if (waveform) {
  const bars = Array.from({ length: 40 }, (_, i) => 6 + Math.round(Math.abs(Math.sin(i * 0.7)) * 16));
  waveform.innerHTML = bars.map((h) => `<div class="waveform__bar" style="height:${h}px;"></div>`).join('');
}
