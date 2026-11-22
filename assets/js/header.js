'use strict';
// Header on every page: the burger menu below 1280 px.
(function () {
  const hdr = document.getElementById('hdr');
  const burger = hdr.querySelector('.hdr__burger');
  // opening moves the focus into the menu (it comes before the burger in the markup, so Tab skipped it);
  // closing from the keyboard brings it back to the burger
  function setMenu(open, refocus) {
    if (open === hdr.classList.contains('is-menu')) return;
    hdr.classList.toggle('is-menu', open);
    burger.setAttribute('aria-expanded', open);
    if (open) hdr.querySelector('.hdr__menu a').focus({ preventScroll: true });
    else if (refocus) burger.focus();
  }
  burger.addEventListener('click', () => setMenu(!hdr.classList.contains('is-menu')));
  // a link in the menu, a click outside the header or Escape closes it
  document.addEventListener('click', (e) => {
    if (hdr.classList.contains('is-menu') && (!e.target.closest('.hdr') || e.target.closest('.hdr__menu a'))) setMenu(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false, hdr.contains(document.activeElement)); });

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
