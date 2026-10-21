'use strict';
// Header on every page: the burger menu below 1280 px.
(function () {
  const hdr = document.getElementById('hdr');
  const burger = hdr.querySelector('.hdr__burger');
  function setMenu(open) {
    hdr.classList.toggle('is-menu', open);
    burger.setAttribute('aria-expanded', open);
  }
  burger.addEventListener('click', () => setMenu(!hdr.classList.contains('is-menu')));
  // a link in the menu, a click outside the header or Escape closes it
  document.addEventListener('click', (e) => {
    if (hdr.classList.contains('is-menu') && (!e.target.closest('.hdr') || e.target.closest('.hdr__menu a'))) setMenu(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
})();
