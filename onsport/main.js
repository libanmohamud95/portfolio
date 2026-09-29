const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Nav: slightly more opaque after 40px of scroll
const nav = document.getElementById('nav');
const onNavScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
window.addEventListener('scroll', onNavScroll, { passive: true });
onNavScroll();

// Hero video: plays unless reduced motion is on; the toggle lets anyone pause or play it
const video = document.getElementById('hero-video');
const toggle = document.getElementById('video-toggle');
const setToggle = (paused) => {
  toggle.setAttribute('aria-pressed', String(paused));
  toggle.setAttribute('aria-label', paused ? 'Play background video' : 'Pause background video');
  toggle.querySelector('.video-toggle__icon').textContent = paused ? '▶' : '❚❚';
  toggle.querySelector('.video-toggle__text').textContent = paused ? 'Play' : 'Pause';
};
const playVideo = () => {
  video.play().then(() => setToggle(false)).catch(() => setToggle(true));
};
if (reduceMotion) {
  setToggle(true);
} else {
  playVideo();
}
toggle.addEventListener('click', () => {
  if (video.paused) {
    playVideo();
  } else {
    video.pause();
    setToggle(true);
  }
});

// Stat count-up: from 0 over 1400ms (ease-out cubic) once 60% visible, once only
if (!reduceMotion && 'IntersectionObserver' in window) {
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const end = Number(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const t0 = performance.now();
      const dur = 1400;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const k = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(end * k) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });

  document.querySelectorAll('[data-count]').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.textContent = '0' + (el.dataset.suffix || '');
    countIO.observe(el);
  });
}

// Subtle image drift on the photo cards
if (!reduceMotion) {
  const driftEls = document.querySelectorAll('[data-drift]');
  let raf = null;
  const drift = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const vh = window.innerHeight;
      driftEls.forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh));
        const amt = Number(el.dataset.drift);
        const scale = 1 + (1 - Math.abs(p)) * 0.035;
        el.style.transform = `translate3d(0, ${(p * amt).toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
      });
    });
  };
  window.addEventListener('scroll', drift, { passive: true });
  window.addEventListener('resize', drift);
  drift();
}

// Demo form: validate, then post to Netlify Forms (emails info@onsport.ai).
// If the handler can't be reached, fall back to a pre-filled email.
const form = document.getElementById('demo-form');
const done = document.getElementById('demo-done');
const errors = document.getElementById('form-errors');
const errName = document.getElementById('err-name');
const errEmail = document.getElementById('err-email');
const errSend = document.getElementById('err-send');
const submitBtn = form.querySelector('button[type="submit"]');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const setInvalid = (input, invalid, msg) => {
  input.closest('.field').classList.toggle('is-invalid', invalid);
  input.setAttribute('aria-invalid', String(invalid));
  msg.hidden = !invalid;
};

const mailtoFallback = (data) => {
  const team = data.get('team').trim();
  const subject = 'Demo request' + (team ? ' – ' + team : '');
  const body = [
    'Name: ' + data.get('name').trim(),
    'Email: ' + data.get('email').trim(),
    'Team / organization: ' + team,
    '',
    data.get('message').trim(),
  ].join('\n');
  window.location.href = 'mailto:info@onsport.ai?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
};

form.addEventListener('input', (e) => {
  const input = e.target;
  if (input.getAttribute('aria-invalid') !== 'true') return;
  if (input.name === 'name' && input.value.trim()) setInvalid(input, false, errName);
  if (input.name === 'email' && EMAIL_RE.test(input.value.trim())) setInvalid(input, false, errEmail);
  errors.hidden = errName.hidden && errEmail.hidden && errSend.hidden;
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = form.elements.name;
  const email = form.elements.email;
  const nameBad = !name.value.trim();
  const emailBad = !EMAIL_RE.test(email.value.trim());
  setInvalid(name, nameBad, errName);
  setInvalid(email, emailBad, errEmail);
  errSend.hidden = true;
  errors.hidden = !(nameBad || emailBad);
  if (nameBad || emailBad) {
    (nameBad ? name : email).focus();
    return;
  }

  const data = new FormData(form);
  const team = data.get('team').trim();
  data.set('subject', 'Demo request' + (team ? ' – ' + team : ''));

  submitBtn.disabled = true;
  try {
    const res = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data).toString(),
    });
    if (!res.ok) throw new Error('Form handler returned ' + res.status);
    form.hidden = true;
    done.hidden = false;
    done.focus();
  } catch (err) {
    errSend.hidden = false;
    errors.hidden = false;
    mailtoFallback(data);
  } finally {
    submitBtn.disabled = false;
  }
});
