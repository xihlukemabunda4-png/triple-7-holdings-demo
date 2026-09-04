// Sticky nav
const nav = document.querySelector('.nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// Mobile nav
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
if (navToggle && navLinks) {
  const root = document.documentElement;

  if (!navLinks.id) navLinks.id = 'nav-links';
  navToggle.setAttribute('aria-controls', navLinks.id);

  const isOpen = () => navLinks.classList.contains('is-open');

  const setMenu = (open) => {
    navLinks.classList.toggle('is-open', open);
    // drops the nav's backdrop-filter, which would otherwise become a
    // containing block and squash the fixed panel down to the nav bar
    nav.classList.toggle('is-menu-open', open);
    // locks the page behind the panel
    root.classList.toggle('menu-open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  navToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setMenu(!isOpen());
  });

  // any link closes it
  navLinks.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => setMenu(false))
  );

  // tap anywhere outside the panel closes it
  document.addEventListener('click', (e) => {
    if (isOpen() && !navLinks.contains(e.target) && !navToggle.contains(e.target)) {
      setMenu(false);
    }
  });

  // escape closes it
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      setMenu(false);
      navToggle.focus();
    }
  });

  // rotating to landscape / resizing past the breakpoint closes it,
  // so the desktop nav never inherits the open state
  window.addEventListener('resize', () => {
    if (isOpen() && window.innerWidth > 680) setMenu(false);
  });

  // belt and braces: if a scroll gets through the lock anyway (iOS momentum
  // scrolling can), close rather than let the page slide behind the panel
  let lockedAt = 0;
  const onMenuScroll = () => {
    if (isOpen() && Math.abs(window.scrollY - lockedAt) > 4) setMenu(false);
  };
  navToggle.addEventListener('click', () => { lockedAt = window.scrollY; });
  window.addEventListener('scroll', onMenuScroll, { passive: true });
}

// Scroll reveal
const revealEls = document.querySelectorAll('.reveal');
if (revealEls.length) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    revealEls.forEach(el => el.classList.add('is-visible'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => io.observe(el));
  }
}
