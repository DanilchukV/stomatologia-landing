'use strict';
// Header on every page: the burger menu below 1280 px.
(function () {
  const hdr = document.getElementById('hdr');
  const burger = hdr.querySelector('.hdr__burger');
  // opening moves the focus into the menu (it comes before the burger in the markup, so Tab skipped it);
  // closing from the keyboard brings it back to the burger
  // open, the page doesn't scroll; a desktop's scrollbar width goes to padding, so nothing shifts sideways
  function lockScroll(on) {
    const de = document.documentElement;
    const sw = on ? window.innerWidth - de.clientWidth : 0;
    de.style.overflow = on ? 'hidden' : '';
    document.body.style.paddingRight = sw > 0 ? sw + 'px' : '';
  }
  // iOS before 16 scrolls a page with overflow: hidden by touch: outside the menu a move is cancelled
  document.addEventListener('touchmove', (e) => {
    if (hdr.classList.contains('is-menu') && !e.target.closest('.hdr__menu')) e.preventDefault();
  }, { passive: false });
  function setMenu(open, refocus) {
    if (open === hdr.classList.contains('is-menu')) return;
    hdr.classList.toggle('is-menu', open);
    lockScroll(open);
    burger.setAttribute('aria-expanded', open);
    if (open) hdr.querySelector('.hdr__menu a').focus({ preventScroll: true });
    else if (refocus) burger.focus();
  }
  burger.addEventListener('click', () => setMenu(!hdr.classList.contains('is-menu')));
  // a link in the menu, a click outside the header (the blurred page is the header's ::before, so the header itself
  // is the target there) or Escape closes it
  document.addEventListener('click', (e) => {
    if (hdr.classList.contains('is-menu') && (!e.target.closest('.hdr') || e.target === hdr || e.target.closest('.hdr__menu a'))) setMenu(false);
  });
  // wider than the burger the menu is the header's row again: a menu left open would keep the page locked
  window.matchMedia('(max-width: 1279px)').addEventListener('change', (e) => { if (!e.matches) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false, hdr.contains(document.activeElement)); });

  // a phone held sideways (the rotate notice, style.css): the device's turn, not the window's shape — with the
  // keyboard up a portrait window is wider than tall. iOS reports the screen's portrait size whichever way it is
  // turned, so a phone is told by its short side
  function sideways() {
    const o = screen.orientation && screen.orientation.type;
    const turned = o ? o.indexOf('landscape') === 0 : Math.abs(window.orientation || 0) === 90;
    return turned && Math.min(screen.width, screen.height) < 500 && window.matchMedia('(pointer: coarse)').matches;
  }
  const syncSide = () => document.documentElement.classList.toggle('is-sideways', sideways());
  syncSide();
  if (screen.orientation) screen.orientation.addEventListener('change', syncSide);
  window.addEventListener('orientationchange', syncSide);
  window.addEventListener('resize', syncSide);

  // links (most buttons on the site are links) and pictures can't be dragged out: dropped into another window or
  // tab, a link opened there
  document.addEventListener('dragstart', (e) => { if (e.target.closest && e.target.closest('a, img')) e.preventDefault(); });

  // computers: phone numbers are plain text (a tel: link opens Skype or a similar app there); phones and tablets keep the link
  if (!window.matchMedia('(pointer: coarse)').matches) {
    document.querySelectorAll('a[href^="tel:"]').forEach((a) => { a.removeAttribute('href'); a.classList.add('tel-text'); });
    // 1280–1389 px the header phone is only an icon: focusable there, so a click or Tab shows its numbers (style.css)
    const phone = hdr.querySelector('.hdr__phone');
    const iconOnly = window.matchMedia('(min-width: 1280px) and (max-width: 1389px)');
    const sync = () => {
      if (iconOnly.matches) { phone.tabIndex = 0; phone.setAttribute('aria-label', 'Телефоны для записи: ' + Array.from(phone.querySelectorAll('.hdr__phone-num'), (n) => n.textContent).join(', ')); }
      else { phone.removeAttribute('tabindex'); phone.removeAttribute('aria-label'); }
    };
    sync();
    iconOnly.addEventListener('change', sync);
  }
})();
